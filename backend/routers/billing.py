from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
import httpx
import os
import hmac
import hashlib
import logging
from db import get_pool
from jose import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
logger = logging.getLogger("NovaStock")
billing_limiter = Limiter(key_func=get_remote_address)

MP_ACCESS_TOKEN = os.environ.get("MP_ACCESS_TOKEN", "")
MP_WEBHOOK_SECRET = os.environ.get("MP_WEBHOOK_SECRET", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-insecure-change-me")

class SubscribeRequest(BaseModel):
    plan_id: str
    is_yearly: bool

def get_current_business_id(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalido")

@router.post("/subscribe")
@billing_limiter.limit("5/10minutes")
async def create_subscription(body: SubscribeRequest, request: Request):
    biz_id = get_current_business_id(request)
    
    from core.plan_pricing import PLANS_CONFIG
    
    if body.plan_id not in PLANS_CONFIG:
        raise HTTPException(status_code=400, detail="Plan no valido")
    
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT mp_subscription_id, plan FROM businesses WHERE id = $1", biz_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Negocio no encontrado")
        if existing["plan"] == body.plan_id and existing["mp_subscription_id"]:
            raise HTTPException(status_code=400, detail="Ya tenes una suscripcion activa a este plan. Contacta a soporte para cambios.")
        payer_email = await conn.fetchval("SELECT email FROM businesses WHERE id = $1", biz_id)
        if not payer_email:
            raise HTTPException(status_code=404, detail="Negocio no encontrado")

    plan_info = PLANS_CONFIG[body.plan_id]
    amount = plan_info["yearly"] if body.is_yearly else plan_info["monthly"]
    frequency_type = "months"
    frequency = 12 if body.is_yearly else 1
    reason = f"{plan_info['name']} {'Anual' if body.is_yearly else 'Mensual'} - MiNegocio"

    # Llamar a MercadoPago para crear la suscripción (Preapproval)
    mp_payload = {
        "reason": reason,
        "auto_recurring": {
            "frequency": frequency,
            "frequency_type": frequency_type,
            "transaction_amount": amount,
            "currency_id": "ARS"
        },
        "back_url": "https://mi-negocio.app/panel/configuracion",
        "payer_email": payer_email,
        "external_reference": f"{biz_id}|{body.plan_id}"
    }

    headers = {
        "Authorization": f"Bearer {MP_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://api.mercadopago.com/preapproval", json=mp_payload, headers=headers)
        if resp.status_code >= 400:
            logger.error(f"Error de MercadoPago subscribe: {resp.text}")
            raise HTTPException(status_code=400, detail="Error al generar link de pago")
        
        data = resp.json()
        preapproval_id = data.get("id")
        if preapproval_id:
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE businesses SET mp_subscription_id = $1, plan_pending = $2, updated_at = now() WHERE id = $3",
                    preapproval_id, body.plan_id, biz_id
                )
            logger.info(f"Preapproval MP creado: {preapproval_id} para {biz_id} (plan: {body.plan_id})")
        return {"init_point": data["init_point"], "subscription_id": preapproval_id}

def _verify_mp_signature(request: Request, data_id: str) -> bool:
    """Verifica la firma HMAC-SHA256 que MercadoPago envía en x-signature."""
    if not MP_WEBHOOK_SECRET:
        logger.warning("MP_WEBHOOK_SECRET no configurado — firma del webhook no verificada")
        return True  # degradar con gracia hasta configurar el secret
    sig_header = request.headers.get("x-signature", "")
    request_id = request.headers.get("x-request-id", "")
    ts = ""
    v1 = ""
    for part in sig_header.split(","):
        part = part.strip()
        if part.startswith("ts="):
            ts = part[3:]
        elif part.startswith("v1="):
            v1 = part[3:]
    if not ts or not v1:
        return False
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts}"
    expected = hmac.new(MP_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)


@router.post("/webhook")
async def mercadopago_webhook(request: Request):
    """
    Webhook que recibe notificaciones de MercadoPago.
    Verifica firma HMAC y luego consulta el estado real del preapproval.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    action = body.get("action")
    data_id = body.get("data", {}).get("id")

    if data_id and not _verify_mp_signature(request, str(data_id)):
        logger.warning(f"Webhook MP rechazado: firma inválida para data_id={data_id}")
        raise HTTPException(status_code=400, detail="Firma inválida")

    if action in ("created", "updated"):
        if data_id and MP_ACCESS_TOKEN:
            headers = {"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"https://api.mercadopago.com/preapproval/{data_id}", headers=headers)
                if resp.status_code == 200:
                    sub_data = resp.json()
                    status = sub_data.get("status")
                    ext_ref = sub_data.get("external_reference")
                    
                    if ext_ref:
                        try:
                            parts = ext_ref.split("|")
                            if len(parts) != 2:
                                logger.warning(f"Webhook MP: external_reference invalido: {ext_ref}")
                                return {"detail": "external_reference invalido"}
                            biz_id, plan_id = parts
                        except Exception:
                            logger.warning(f"Webhook MP: error parseando external_reference: {ext_ref}")
                            return {"detail": "error parseando external_reference"}
                    else:
                        pool = await get_pool()
                        async with pool.acquire() as conn:
                            row = await conn.fetchrow("SELECT id, plan_pending FROM businesses WHERE mp_subscription_id = $1", data_id)
                            if row and row["plan_pending"]:
                                biz_id = row["id"]
                                plan_id = row["plan_pending"]
                                logger.info(f"Webhook MP: matched {biz_id} via mp_subscription_id={data_id}")
                            else:
                                logger.warning(f"Webhook MP: no ext_ref and no matching mp_subscription_id={data_id}")
                                return {"detail": "no matching subscription"}

                    freq = sub_data.get("auto_recurring", {})
                    months = freq.get("frequency", 1) * (12 if freq.get("frequency_type") == "years" else 1)
                    pool = await get_pool()
                    async with pool.acquire() as conn:
                            if status == "authorized":
                                # Idempotencia: MP re-entrega los webhooks. Si el negocio YA está
                                # activo con este mismo plan y suscripción, es un duplicado → no
                                # re-extender plan_end_date ni reenviar el email de activación.
                                current = await conn.fetchrow(
                                    "SELECT status, plan, mp_subscription_id FROM businesses WHERE id = $1", biz_id
                                )
                                already_active = bool(current) and current["status"] == "active" \
                                    and current["plan"] == plan_id and current["mp_subscription_id"] == data_id
                                if already_active:
                                    logger.info(f"Webhook MP (re-entrega ignorada): {biz_id} ya activo en {plan_id}, sub={data_id}")
                                else:
                                    await conn.execute(
                                        "UPDATE businesses SET plan = $1, status = 'active', plan_end_date = CURRENT_DATE + make_interval(months => $2), plan_pending = NULL, mp_subscription_id = $3, updated_at = now() WHERE id = $4",
                                        plan_id, months, data_id, biz_id
                                    )
                                    logger.info(f"Webhook MP: {biz_id} activado {plan_id} ({months}m), sub={data_id}")
                                    row = await conn.fetchrow("SELECT email, business_name FROM businesses WHERE id = $1", biz_id)
                                    if row:
                                        from core.plan_pricing import PLANS_CONFIG
                                        plan_label = PLANS_CONFIG.get(plan_id, {}).get("name", plan_id)
                                        is_yearly = months >= 12
                                        import asyncio as _asyncio
                                        _asyncio.create_task(_send_plan_email(row["email"], row["business_name"], plan_label, is_yearly))
                            elif status == "pending":
                                await conn.execute(
                                    "UPDATE businesses SET mp_subscription_id = $1, plan_pending = $2, updated_at = now() WHERE id = $3",
                                    data_id, plan_id, biz_id
                                )
                            elif status in ("cancelled", "paused"):
                                await conn.execute(
                                    "UPDATE businesses SET status = 'past_due', mp_subscription_id = NULL, updated_at = now() WHERE id = $1",
                                    biz_id
                                )
                                logger.info(f"Webhook MP: {biz_id} cancelado/pausado")
        return {"detail": "ok"}

    if action == "cancelled" and data_id:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE businesses SET status = 'past_due', mp_subscription_id = NULL, updated_at = now() WHERE mp_subscription_id = $1",
                data_id
            )
        return {"detail": "cancelled"}

    return {"detail": "ignored"}

async def _send_plan_email(email: str, name: str, plan_label: str, is_yearly: bool):
    try:
        from services.email_service import send_plan_activated
        await send_plan_activated(email, name, plan_label.split()[-1].lower() if ' ' in plan_label else plan_label.lower(), is_yearly)
    except Exception as e:
        logger.warning(f"No se pudo enviar email de activacion a {email}: {e}")

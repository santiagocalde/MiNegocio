from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
import httpx
import os
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from db import get_pool
from jose import jwt

router = APIRouter()
logger = logging.getLogger("NovaStock")
# Limiter central: keyea por IP real, no por la IP del proxy nginx.
from core.ratelimit import limiter as billing_limiter

from core.config import JWT_SECRET

MP_ACCESS_TOKEN = os.environ.get("MP_ACCESS_TOKEN", "")
MP_WEBHOOK_SECRET = os.environ.get("MP_WEBHOOK_SECRET", "")
APP_ENV = os.environ.get("APP_ENV", "production")

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


class CancelRequest(BaseModel):
    reason: str = ""
    detail: str = ""


# Motivos de baja que ofrecemos en el flujo de cancelación in-app.
CANCEL_REASONS = {"precio", "no_lo_uso", "cambie_sistema", "cerro_negocio", "faltan_funciones", "otro"}


@router.post("/cancel")
@billing_limiter.limit("5/hour")
async def cancel_subscription(body: CancelRequest, request: Request):
    """Cancela la suscripción del negocio y registra el motivo de la baja (churn).
    El motivo alimenta el análisis de churn del panel de admin."""
    biz_id = get_current_business_id(request)
    reason = body.reason if body.reason in CANCEL_REASONS else "otro"

    pool = await get_pool()
    async with pool.acquire() as conn:
        biz = await conn.fetchrow(
            "SELECT business_name, plan, billing_period, created_at, status, mp_subscription_id FROM businesses WHERE id = $1",
            biz_id,
        )
        if not biz:
            raise HTTPException(status_code=404, detail="Negocio no encontrado")
        sub_id = biz["mp_subscription_id"]

    # Cancelar la suscripción en MercadoPago (best-effort) para frenar cobros futuros.
    if sub_id and MP_ACCESS_TOKEN:
        try:
            headers = {"Authorization": f"Bearer {MP_ACCESS_TOKEN}", "Content-Type": "application/json"}
            async with httpx.AsyncClient() as client:
                await client.put(
                    f"https://api.mercadopago.com/preapproval/{sub_id}",
                    json={"status": "cancelled"}, headers=headers,
                )
        except Exception as e:
            logger.warning(f"No se pudo cancelar preapproval {sub_id} en MP: {e}")

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Registrar la baja con el motivo elegido por el cliente (dato de primera mano).
            already = await conn.fetchval(
                "SELECT 1 FROM cancellations WHERE business_id = $1 AND created_at >= now() - interval '7 days'",
                biz_id,
            )
            if not already and biz["status"] == "active":
                mrr_lost = _mrr_for(biz["plan"], biz["billing_period"] or "monthly") if biz["plan"] not in ("trial", "", None) else 0
                days_active = (datetime.now(timezone.utc) - biz["created_at"]).days if biz["created_at"] else None
                await conn.execute(
                    """INSERT INTO cancellations (business_id, business_name, plan, billing_period, reason, detail, mrr_lost, days_active)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
                    biz_id, biz["business_name"], biz["plan"], biz["billing_period"] or "",
                    reason, (body.detail or "")[:500], mrr_lost, days_active,
                )
            # Frenar cobros futuros: se quita la suscripción. El acceso se mantiene
            # hasta plan_end_date (ya pagó el período en curso).
            await conn.execute(
                "UPDATE businesses SET mp_subscription_id = NULL, plan_pending = NULL, updated_at = now() WHERE id = $1",
                biz_id,
            )
    logger.info(f"Baja in-app registrada: {biz_id} motivo={reason}")
    return {"success": True, "reason": reason}


def _verify_mp_signature(request: Request, data_id: str) -> bool:
    """Verifica la firma HMAC-SHA256 que MercadoPago envía en x-signature."""
    if not MP_WEBHOOK_SECRET:
        # En producción NO se acepta un webhook sin verificar: sin el secret,
        # cualquiera que conozca la URL podría activar planes gratis. Solo se
        # degrada con gracia fuera de producción (dev/test) para poder probar.
        if APP_ENV == "production":
            logger.error("MP_WEBHOOK_SECRET no configurado en producción — webhook RECHAZADO")
            return False
        logger.warning("MP_WEBHOOK_SECRET no configurado (no-prod) — firma del webhook no verificada")
        return True
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
    # MP firma el data.id que viaja en el query string (?data.id=...); si no está,
    # usamos el del body. MP recomienda pasarlo en minúsculas si es alfanumérico.
    try:
        qs_id = request.query_params.get("data.id")
    except Exception:
        qs_id = None
    ids = {str(data_id)}
    if qs_id:
        ids.add(str(qs_id))
    ids |= {i.lower() for i in list(ids)}
    # La plantilla del manifest de MP ha variado entre versiones de su doc respecto
    # del ';' final. Toleramos ambas: una firma mal formada rechazaría TODOS los
    # webhooks (y en prod eso frena las activaciones). Sigue siendo seguro: sin el
    # secret no se puede generar ninguna firma válida.
    for did in ids:
        for tail in (";", ""):
            manifest = f"id:{did};request-id:{request_id};ts:{ts}{tail}"
            expected = hmac.new(MP_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected, v1):
                return True
    return False


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
    topic = body.get("type") or body.get("topic") or ""
    data_id = body.get("data", {}).get("id")

    if data_id and not _verify_mp_signature(request, str(data_id)):
        logger.warning(f"Webhook MP rechazado: firma inválida para data_id={data_id}")
        raise HTTPException(status_code=400, detail="Firma inválida")

    # Cobro recurrente de una suscripción (renovación mensual/anual). Se registra
    # cada pago real en payment_events para que los ingresos por mes sean fieles,
    # no solo las altas. Antes las renovaciones no quedaban registradas.
    if topic == "subscription_authorized_payment" and data_id:
        return await _handle_authorized_payment(str(data_id))

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
                                    billing_period = "yearly" if months >= 12 else "monthly"
                                    await conn.execute(
                                        "UPDATE businesses SET plan = $1, status = 'active', plan_end_date = CURRENT_DATE + make_interval(months => $2), plan_pending = NULL, mp_subscription_id = $3, billing_period = $4, updated_at = now() WHERE id = $5",
                                        plan_id, months, data_id, billing_period, biz_id
                                    )
                                    # Registro contable del pago (payment_events). Idempotente por
                                    # idempotency_key: si MP re-entrega el mismo webhook, no se duplica.
                                    amount = freq.get("transaction_amount")
                                    try:
                                        await conn.execute(
                                            """INSERT INTO payment_events (business_id, mp_subscription_id, amount, status, event_type, idempotency_key, processed_at)
                                               VALUES ($1, $2, $3, 'authorized', 'subscription', $4, now())
                                               ON CONFLICT (idempotency_key) DO NOTHING""",
                                            biz_id, data_id, amount, f"{data_id}:authorized:{plan_id}",
                                        )
                                    except Exception as _e:
                                        logger.warning(f"No se pudo registrar payment_event de {biz_id}: {_e}")
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
                                await _record_churn(conn, biz_id, "mp_cancelled")
                                await conn.execute(
                                    "UPDATE businesses SET status = 'past_due', mp_subscription_id = NULL, updated_at = now() WHERE id = $1",
                                    biz_id
                                )
                                logger.info(f"Webhook MP: {biz_id} cancelado/pausado")
        return {"detail": "ok"}

    if action == "cancelled" and data_id:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT id FROM businesses WHERE mp_subscription_id = $1", data_id)
            if row:
                await _record_churn(conn, row["id"], "mp_cancelled")
            await conn.execute(
                "UPDATE businesses SET status = 'past_due', mp_subscription_id = NULL, updated_at = now() WHERE mp_subscription_id = $1",
                data_id
            )
        return {"detail": "cancelled"}

    return {"detail": "ignored"}


async def _handle_authorized_payment(auth_payment_id: str) -> dict:
    """Registra un cobro recurrente de suscripción (renovación) en payment_events.
    Idempotente por el id del pago autorizado: si MP re-entrega, no duplica."""
    if not MP_ACCESS_TOKEN:
        return {"detail": "sin access token"}
    try:
        headers = {"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.mercadopago.com/authorized_payments/{auth_payment_id}", headers=headers
            )
        if resp.status_code != 200:
            logger.warning(f"Webhook MP: no se pudo leer authorized_payment {auth_payment_id}: {resp.status_code}")
            return {"detail": "authorized_payment no encontrado"}
        data = resp.json()
        preapproval_id = data.get("preapproval_id")
        # El estado puede venir plano o anidado en `payment`.
        status = data.get("status") or (data.get("payment") or {}).get("status")
        amount = data.get("transaction_amount")
        if status not in ("approved", "authorized", "accredited"):
            return {"detail": f"pago no aprobado ({status})"}
        if not preapproval_id:
            return {"detail": "sin preapproval_id"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            biz = await conn.fetchrow("SELECT id FROM businesses WHERE mp_subscription_id = $1", preapproval_id)
            if not biz:
                logger.warning(f"Webhook MP: authorized_payment sin negocio (preapproval={preapproval_id})")
                return {"detail": "sin negocio"}
            await conn.execute(
                """INSERT INTO payment_events (business_id, mp_subscription_id, amount, status, event_type, idempotency_key, processed_at)
                   VALUES ($1, $2, $3, 'authorized', 'renewal', $4, now())
                   ON CONFLICT (idempotency_key) DO NOTHING""",
                biz["id"], preapproval_id, amount, f"authpay:{auth_payment_id}",
            )
            logger.info(f"Webhook MP: renovación registrada {biz['id']} monto={amount} (authpay={auth_payment_id})")
        return {"detail": "renovación registrada"}
    except Exception as e:
        logger.warning(f"Webhook MP: error procesando authorized_payment {auth_payment_id}: {e}")
        return {"detail": "error"}


def _mrr_for(plan_id: str, billing_period: str) -> int:
    """MRR normalizado a mes según el plan y el ciclo de facturación."""
    from core.plan_pricing import PLANS_CONFIG
    p = PLANS_CONFIG.get(plan_id)
    if not p:
        return 0
    if billing_period == "yearly":
        return round(p["yearly"] / 12)
    return p["monthly"]


async def _record_churn(conn, business_id: str, reason: str, detail: str = ""):
    """Registra una baja en `cancellations` de forma idempotente por día.
    Evita duplicar si el webhook de cancelación se re-entrega el mismo día."""
    try:
        biz = await conn.fetchrow(
            "SELECT business_name, plan, billing_period, created_at, status FROM businesses WHERE id = $1",
            business_id,
        )
        # Solo contamos como baja a un negocio que estaba activo (paga → deja de pagar).
        # Si ya estaba past_due/suspended/expired, no re-contamos.
        if not biz or biz["status"] != "active":
            return
        # Idempotencia: una baja por negocio dentro de una ventana corta, sin importar
        # el motivo. Evita doble conteo cuando el usuario cancela in-app (registra su
        # motivo) y además llega el webhook 'cancelled' de MercadoPago.
        dup = await conn.fetchval(
            "SELECT 1 FROM cancellations WHERE business_id = $1 AND created_at >= now() - interval '7 days'",
            business_id,
        )
        if dup:
            return
        mrr_lost = _mrr_for(biz["plan"], biz["billing_period"] or "monthly") if biz["plan"] not in ("trial", "", None) else 0
        days_active = None
        if biz["created_at"]:
            days_active = (datetime.now(timezone.utc) - biz["created_at"]).days
        await conn.execute(
            """INSERT INTO cancellations (business_id, business_name, plan, billing_period, reason, detail, mrr_lost, days_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
            business_id, biz["business_name"], biz["plan"], biz["billing_period"] or "",
            reason, detail, mrr_lost, days_active,
        )
        logger.info(f"Churn registrado: {business_id} ({reason}), MRR perdido {mrr_lost}")
    except Exception as e:
        logger.warning(f"No se pudo registrar churn de {business_id}: {e}")

async def _send_plan_email(email: str, name: str, plan_label: str, is_yearly: bool):
    try:
        from services.email_service import send_plan_activated
        await send_plan_activated(email, name, plan_label.split()[-1].lower() if ' ' in plan_label else plan_label.lower(), is_yearly)
    except Exception as e:
        logger.warning(f"No se pudo enviar email de activacion a {email}: {e}")

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
import httpx
import os
import logging
from db_helpers import get_pool
from jose import jwt

router = APIRouter()
logger = logging.getLogger("NovaStock")

MP_ACCESS_TOKEN = os.environ.get("MP_ACCESS_TOKEN", "APP_USR-5284702967347426-061321-4b16af9c02cf24d023fff0e3471bfa34-801610889")
JWT_SECRET = os.environ.get("JWT_SECRET", "super-secret-key-change-in-prod")

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
async def create_subscription(body: SubscribeRequest, request: Request):
    biz_id = get_current_business_id(request)
    
    # Precios fijos (en prod se puede leer de la DB)
    plans_config = {
        "simple": {"name": "Plan Simple", "monthly": 20000, "yearly": 200000},
        "pro":    {"name": "Plan Pro",    "monthly": 30000, "yearly": 300000},
        "ia":     {"name": "Plan IA",     "monthly": 40000, "yearly": 400000}
    }
    
    if body.plan_id not in plans_config:
        raise HTTPException(status_code=400, detail="Plan no válido")
        
    plan_info = plans_config[body.plan_id]
    amount = plan_info["yearly"] if body.is_yearly else plan_info["monthly"]
    frequency_type = "months"
    frequency = 12 if body.is_yearly else 1
    reason = f"{plan_info['name']} {'Anual' if body.is_yearly else 'Mensual'} - MiNegocio"

    # Buscar el email del negocio
    pool = await get_pool()
    async with pool.acquire() as conn:
        biz = await conn.fetchrow("SELECT email FROM businesses WHERE id = $1", biz_id)
        if not biz:
            raise HTTPException(status_code=404, detail="Negocio no encontrado")
        payer_email = biz["email"]

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
            logger.error(f"Error de MercadoPago: {resp.text}")
            raise HTTPException(status_code=400, detail="Error al generar link de pago")
        
        data = resp.json()
        return {"init_point": data["init_point"]}

@router.post("/webhook")
async def mercadopago_webhook(request: Request):
    """
    Webhook que recibe notificaciones de MercadoPago (IPN o Webhooks).
    En este MVP, asumiremos que si llega una notificacion de preapproval, actualizamos la DB.
    """
    # En Producción real, MP envía topic y id por query params o body.
    try:
        body = await request.json()
    except Exception:
        body = {}
        
    action = body.get("action")
    data_id = body.get("data", {}).get("id")

    if action == "created" or action == "updated":
        # Es una suscripción nueva o actualizada. Consultamos la API de MP para verificar.
        if data_id:
            headers = {"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"https://api.mercadopago.com/preapproval/{data_id}", headers=headers)
                if resp.status_code == 200:
                    sub_data = resp.json()
                    status = sub_data.get("status")
                    ext_ref = sub_data.get("external_reference")
                    
                    if status == "authorized" and ext_ref:
                        biz_id, plan_id = ext_ref.split("|")
                        pool = await get_pool()
                        async with pool.acquire() as conn:
                            await conn.execute("""
                                UPDATE businesses 
                                SET plan = $1, status = 'active', 
                                    plan_end_date = CURRENT_DATE + INTERVAL '1 month',
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = $2
                            """, plan_id, biz_id)
                            logger.info(f"Suscripción de {biz_id} activada (Plan: {plan_id})")

    return {"status": "ok"}

"""
Cobro con QR de Mercado Pago (auto-confirmación) en el mostrador.

  POST /api/mp/intent        crea el cobro + preferencia MP → devuelve el link p/ QR
  GET  /api/mp/intent/{id}   la notebook hace poll; verifica el pago real en MP

Gateado: requiere que el negocio tenga Access Token de MP y `mp_auto_confirm`.
Protegido por el TenantMiddleware (token del negocio) como el resto de /api.
"""
import uuid

from fastapi import APIRouter, Body, HTTPException, Request

import main
from core.ratelimit import limiter
from services.mercadopago import client, repo

router = APIRouter(prefix="/api/mp")


def _biz() -> str:
    return (main.business_id_ctx.get() if hasattr(main, "business_id_ctx") else None) or "kiosco_default"


@router.post("/intent", summary="Crear cobro MP con QR")
@limiter.limit("60/minute")
async def create_intent(request: Request, body: dict = Body(...)) -> dict:
    total = body.get("total")
    if total is None or float(total) <= 0:
        raise HTTPException(400, detail="Total inválido")
    biz = _biz()
    settings = await repo.get_merchant_settings(biz)
    if not settings["token"]:
        raise HTTPException(409, detail="Falta el Access Token de Mercado Pago en Configuración.")
    if not settings["auto_confirm"]:
        raise HTTPException(409, detail="La auto-confirmación de pagos no está activada.")

    intent_id = uuid.uuid4().hex
    await repo.create_intent(biz, intent_id, float(total), body.get("description") or "Venta")
    try:
        pref = await client.create_preference(
            settings["token"], amount=float(total),
            description=body.get("description") or "Venta", external_reference=intent_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, detail=f"No se pudo crear el cobro en Mercado Pago: {e}")
    if not pref.get("init_point"):
        raise HTTPException(502, detail="Mercado Pago no devolvió el link de pago.")
    return {"intent_id": intent_id, "init_point": pref["init_point"]}


@router.get("/intent/{intent_id}", summary="Estado del cobro MP")
@limiter.limit("240/minute")
async def get_intent(request: Request, intent_id: str) -> dict:
    biz = _biz()
    intent = await repo.get_intent(biz, intent_id)
    if not intent:
        raise HTTPException(404, detail="Cobro no encontrado")

    status = intent["status"]
    if status == "pending":
        # Verificación real contra MP (no confiamos en nada del cliente).
        settings = await repo.get_merchant_settings(biz)
        if settings["token"]:
            try:
                pay = await client.search_approved_payment(settings["token"], intent_id)
            except Exception:  # noqa: BLE001
                pay = None
            if pay:
                await repo.mark_approved(biz, intent_id, pay["id"])
                status = "approved"

    return {"status": status, "total": intent.get("total"), "mp_payment_id": intent.get("mp_payment_id") or ""}

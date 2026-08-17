"""
Cobro con QR Presencial (caja fija) de Mercado Pago en el mostrador.

  POST /api/mp/setup-caja      crea sucursal + caja con QR fijo (una sola vez)
  POST /api/mp/intent          arma la orden con el monto sobre el QR fijo
  GET  /api/mp/intent/{id}     poll: verifica el pago real en MP (monto incluido)
  POST /api/mp/intent/{id}/cancel   desarma la orden (venta cancelada / abandonada)

Modelo: hay UN QR fijo pegado en el mostrador (una caja por negocio). Por cada
venta se "arma" una orden con el monto; el cliente escanea SIEMPRE el mismo QR y
paga ese monto. Solo puede haber una orden pendiente por caja: siempre se desarma
antes de armar y al cancelar.

Gateado: requiere Access Token de MP, `mp_auto_confirm` y la caja ya configurada.
Protegido por el TenantMiddleware (token del negocio) como el resto de /api.
"""
import logging
import re
import uuid

from fastapi import APIRouter, Body, HTTPException, Request

import main
from core.ratelimit import limiter
from services.mercadopago import client, repo

logger = logging.getLogger("mp_pos")
router = APIRouter(prefix="/api/mp")


def _biz() -> str:
    return (main.business_id_ctx.get() if hasattr(main, "business_id_ctx") else None) or "kiosco_default"


def _ext_ids(biz: str) -> tuple[str, str]:
    """IDs externos (sucursal, caja) derivados del business_id. MP los quiere
    alfanuméricos; sacamos todo lo demás."""
    clean = re.sub(r"[^A-Za-z0-9]", "", biz)[:32] or "DEFAULT"
    return f"MNSTORE{clean}", f"MNPOS{clean}"


@router.post("/setup-caja", summary="Crear la caja fija con QR imprimible")
@limiter.limit("6/minute")
async def setup_caja(request: Request, body: dict = Body(default=None)) -> dict:
    """Crea (una sola vez) la sucursal + caja en MP y devuelve la URL del QR fijo
    para imprimir. Idempotente: si ya está configurada, devuelve la existente."""
    biz = _biz()
    cfg = await repo.get_qr_pos_config(biz)
    if not cfg["token"]:
        raise HTTPException(409, detail="Falta el Access Token de Mercado Pago en Configuración.")
    # Ya configurada → no recrear, devolver la que hay.
    if cfg["qr_pos_url"] and cfg["external_pos_id"]:
        return {"qr_pos_url": cfg["qr_pos_url"], "already": True}

    token = cfg["token"]
    ext_store, ext_pos = _ext_ids(biz)
    nombre = (body or {}).get("name") or "MiNegocio"
    try:
        collector = cfg["collector_id"] or await client.get_user_id(token)
        await client.create_store(token, collector, external_store_id=ext_store, name=nombre)
        pos = await client.create_pos(token, external_store_id=ext_store,
                                      external_pos_id=ext_pos, name=f"{nombre} - Caja")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, detail=f"No se pudo crear la caja en Mercado Pago: {e}")
    if not pos.get("qr_image"):
        raise HTTPException(502, detail="Mercado Pago no devolvió el QR de la caja.")
    await repo.save_qr_pos_config(biz, collector_id=collector, external_store_id=ext_store,
                                  external_pos_id=ext_pos, qr_pos_url=pos["qr_image"])
    return {"qr_pos_url": pos["qr_image"], "already": False}


@router.post("/intent", summary="Armar cobro MP sobre el QR fijo")
@limiter.limit("60/minute")
async def create_intent(request: Request, body: dict = Body(...)) -> dict:
    total = body.get("total")
    if total is None or float(total) <= 0:
        raise HTTPException(400, detail="Total inválido")
    biz = _biz()
    cfg = await repo.get_qr_pos_config(biz)
    if not cfg["token"]:
        raise HTTPException(409, detail="Falta el Access Token de Mercado Pago en Configuración.")
    if not cfg["auto_confirm"]:
        raise HTTPException(409, detail="La auto-confirmación de pagos no está activada.")
    if not cfg["external_pos_id"] or not cfg["qr_pos_url"]:
        raise HTTPException(409, detail="Configurá la caja QR primero (Configuración → Cobro con QR).")

    intent_id = uuid.uuid4().hex  # 32 hex, sirve como external_reference (≤64, alfanumérico)
    await repo.create_intent(biz, intent_id, float(total), body.get("description") or "Venta")
    try:
        # Regla del QR fijo: una sola orden pendiente por caja. Desarmamos cualquier
        # orden previa antes de armar la nueva (idempotente).
        await client.clear_qr_order(cfg["token"], cfg["collector_id"], external_pos_id=cfg["external_pos_id"])
        await client.arm_qr_order(
            cfg["token"], cfg["collector_id"],
            external_store_id=cfg["external_store_id"], external_pos_id=cfg["external_pos_id"],
            amount=float(total), external_reference=intent_id,
            title=body.get("description") or "Venta")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, detail=f"No se pudo armar el cobro en Mercado Pago: {e}")
    # El QR es el fijo del mostrador; devolvemos su URL por si la UI lo quiere mostrar.
    return {"intent_id": intent_id, "qr_pos_url": cfg["qr_pos_url"], "total": float(total)}


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
        cfg = await repo.get_qr_pos_config(biz)
        if cfg["token"]:
            try:
                pay = await client.search_approved_payment(cfg["token"], intent_id)
            except Exception:  # noqa: BLE001
                pay = None
            if pay:
                # Red de seguridad: solo confirmamos si el monto pagado coincide
                # con el del cobro (tolerancia de medio peso). Con QR fijo esto es
                # más crítico todavía por el riesgo de una orden vieja colgada.
                try:
                    paid_ok = abs(float(pay.get("amount") or 0) - float(intent["total"])) < 0.5
                except (TypeError, ValueError):
                    paid_ok = False
                if paid_ok:
                    await repo.mark_approved(biz, intent_id, pay["id"])
                    status = "approved"
                else:
                    logger.warning(
                        "MP pago %s con monto distinto al cobro %s ($%s vs $%s) — no confirmo.",
                        pay["id"], intent_id, pay.get("amount"), intent["total"])

    return {"status": status, "total": intent.get("total"), "mp_payment_id": intent.get("mp_payment_id") or ""}


@router.post("/intent/{intent_id}/cancel", summary="Desarmar la orden del QR fijo")
@limiter.limit("60/minute")
async def cancel_intent(request: Request, intent_id: str) -> dict:
    """Desarma la orden pendiente de la caja. Se llama cuando la venta se confirma
    o cuando el cobro se cancela/abandona, para dejar el QR fijo libre y que el
    próximo cliente no vea un monto viejo."""
    biz = _biz()
    cfg = await repo.get_qr_pos_config(biz)
    if cfg["token"] and cfg["external_pos_id"]:
        await client.clear_qr_order(cfg["token"], cfg["collector_id"], external_pos_id=cfg["external_pos_id"])
    return {"ok": True}

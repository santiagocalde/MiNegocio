"""
Cliente HTTP de Mercado Pago (POS / cobros en el mostrador).

Aislado y con el TOKEN del comercio (nunca uno global): cada negocio cobra a su
propia cuenta. async con httpx. Solo lo que necesita el cobro con QR:
  - crear una preferencia de pago (devuelve el link que se convierte en QR)
  - buscar si ya entró un pago APROBADO para ese cobro (por external_reference)

No confiamos en el webhook para confirmar: siempre verificamos el pago real
contra MP con el token del comercio (fuente de verdad).
"""
import logging
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger("mercadopago.client")

MP_API = "https://api.mercadopago.com"
TIMEOUT = 15

# Zona horaria de Argentina para el expiration_date de las órdenes QR.
_AR_TZ = timezone(timedelta(hours=-3))


async def create_preference(token: str, *, amount: float, description: str,
                            external_reference: str) -> dict:
    """Crea una preferencia de Checkout. Devuelve {init_point, preference_id}.
    `external_reference` = id de nuestro intent → match exacto al confirmar."""
    payload = {
        "items": [{
            "title": (description or "Venta")[:250],
            "quantity": 1,
            "unit_price": round(float(amount), 2),
            "currency_id": "ARS",
        }],
        "external_reference": external_reference,
        # binary_mode: el pago queda aprobado o rechazado, sin estado 'pending'
        # intermedio (mejor para cobrar en el mostrador).
        "binary_mode": True,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(f"{MP_API}/checkout/preferences", json=payload,
                         headers={"Authorization": f"Bearer {token}"})
    if r.status_code not in (200, 201):
        raise RuntimeError(f"MP preference HTTP {r.status_code}: {r.text[:200]}")
    d = r.json()
    return {"init_point": d.get("init_point") or d.get("sandbox_init_point", ""),
            "preference_id": str(d.get("id", ""))}


async def search_approved_payment(token: str, external_reference: str) -> dict | None:
    """Busca un pago APROBADO para ese external_reference. Devuelve {id, amount}
    o None. Esta es la verificación real contra MP (no confiamos en el webhook)."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(f"{MP_API}/v1/payments/search",
                        params={"external_reference": external_reference,
                                "sort": "date_created", "criteria": "desc"},
                        headers={"Authorization": f"Bearer {token}"})
    if r.status_code != 200:
        logger.info("MP payments/search HTTP %s para ref %s", r.status_code, external_reference)
        return None
    for p in r.json().get("results", []):
        if p.get("status") == "approved":
            return {"id": str(p.get("id", "")), "amount": p.get("transaction_amount")}
    return None


# ── QR Presencial (caja fija) ─────────────────────────────────
# Modelo: se crea UNA vez una sucursal + caja (POS) con un QR fijo imprimible.
# Después, por cada venta se "arma" una orden con el monto sobre esa caja; el
# cliente escanea SIEMPRE el mismo QR pegado en el mostrador y paga ese monto.
# Solo puede haber UNA orden pendiente por caja: siempre desarmar antes de armar.

async def get_user_id(token: str) -> str:
    """Devuelve el user_id (collector) de la cuenta MP dueña del token."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(f"{MP_API}/users/me", headers={"Authorization": f"Bearer {token}"})
    if r.status_code != 200:
        raise RuntimeError(f"MP users/me HTTP {r.status_code}: {r.text[:200]}")
    return str(r.json().get("id", ""))


async def create_store(token: str, user_id: str, *, external_store_id: str, name: str) -> dict:
    """Crea (o devuelve) una sucursal. Devuelve {id, external_id}."""
    payload = {
        "name": name[:60],
        "external_id": external_store_id,
        # location mínima: MP exige el objeto pero tolera datos genéricos para
        # comercios sin dirección cargada. Se puede refinar con la config del negocio.
        "location": {"street_number": "0", "street_name": name[:50], "city_name": "N/D",
                     "state_name": "N/D", "latitude": 0, "longitude": 0, "reference": ""},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(f"{MP_API}/users/{user_id}/stores", json=payload,
                         headers={"Authorization": f"Bearer {token}"})
    if r.status_code not in (200, 201):
        raise RuntimeError(f"MP crear sucursal HTTP {r.status_code}: {r.text[:200]}")
    d = r.json()
    return {"id": str(d.get("id", "")), "external_id": d.get("external_id", external_store_id)}


async def create_pos(token: str, *, external_store_id: str, external_pos_id: str,
                     name: str, category: int = 621102) -> dict:
    """Crea la caja (POS) con QR fijo. Devuelve {id, external_id, qr_image}.
    `fixed_amount=False` → el monto lo pone la orden que armamos por venta.
    `category` = MCC (621102 comercio general por defecto)."""
    payload = {
        "name": name[:60],
        "fixed_amount": False,
        "external_store_id": external_store_id,
        "external_id": external_pos_id,
        "category": category,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(f"{MP_API}/pos", json=payload,
                         headers={"Authorization": f"Bearer {token}"})
    if r.status_code not in (200, 201):
        raise RuntimeError(f"MP crear caja HTTP {r.status_code}: {r.text[:200]}")
    d = r.json()
    qr = d.get("qr") or {}
    return {"id": str(d.get("id", "")), "external_id": d.get("external_id", external_pos_id),
            "qr_image": qr.get("image", "")}


async def arm_qr_order(token: str, user_id: str, *, external_store_id: str, external_pos_id: str,
                       amount: float, external_reference: str, title: str = "Venta",
                       expiration_minutes: int = 8) -> None:
    """Arma la orden con el monto sobre la caja fija (PUT → 204). El cliente que
    escanee el QR fijo verá este monto. Expira sola a los `expiration_minutes`
    para no dejar un monto viejo colgado si el cliente no paga."""
    expira = (datetime.now(_AR_TZ) + timedelta(minutes=expiration_minutes)).isoformat(timespec="milliseconds")
    payload = {
        "external_reference": external_reference,
        "title": title[:250],
        "description": title[:250],
        "total_amount": round(float(amount), 2),
        "expiration_date": expira,
        "items": [{
            "sku_number": "VENTA",
            "category": "marketplace",
            "title": title[:250],
            "description": title[:250],
            "unit_price": round(float(amount), 2),
            "quantity": 1,
            "unit_measure": "unit",
            "total_amount": round(float(amount), 2),
        }],
    }
    url = (f"{MP_API}/instore/qr/seller/collectors/{user_id}"
           f"/stores/{external_store_id}/pos/{external_pos_id}/orders")
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.put(url, json=payload, headers={"Authorization": f"Bearer {token}"})
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"MP armar orden HTTP {r.status_code}: {r.text[:200]}")


async def clear_qr_order(token: str, user_id: str, *, external_pos_id: str) -> None:
    """Desarma la orden pendiente de la caja (DELETE). Se llama al confirmar la
    venta y al cancelar/abandonar el cobro, para dejar el QR libre. No lanza si
    ya no había orden (idempotente)."""
    url = (f"{MP_API}/instore/qr/seller/collectors/{user_id}"
           f"/pos/{external_pos_id}/orders")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            await c.delete(url, headers={"Authorization": f"Bearer {token}"})
    except Exception as e:  # noqa: BLE001
        logger.info("MP clear_qr_order (ignorado): %s", e)

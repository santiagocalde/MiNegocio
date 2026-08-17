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

import httpx

logger = logging.getLogger("mercadopago.client")

MP_API = "https://api.mercadopago.com"
TIMEOUT = 15


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

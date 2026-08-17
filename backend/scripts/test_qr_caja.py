"""
Prueba end-to-end del QR Presencial (caja fija) de Mercado Pago en SANDBOX.

No mueve plata real: se corre con el Access Token de un VENDEDOR DE PRUEBA
(credencial TEST, se genera en el panel de MP -> "Cuentas de prueba"). El pago se
simula con una CUENTA COMPRADORA de prueba escaneando el QR que imprime el paso 3.

Uso:
    MP_TEST_TOKEN="TEST-xxxx" python scripts/test_qr_caja.py

Qué valida:
    1. user_id de la cuenta            (GET /users/me)
    2. crear sucursal                  (POST /users/{uid}/stores)
    3. crear caja + QR fijo            (POST /pos)  -> imprime la URL del QR
    4. armar orden con monto           (PUT  .../orders)
    5. confirmar pago real + monto     (GET  /v1/payments/search)
    6. desarmar la orden               (DELETE .../orders)
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.mercadopago import client  # noqa: E402

EXT_STORE = "MNTESTSTORE"
EXT_POS = "MNTESTPOS"


async def main() -> None:
    token = os.getenv("MP_TEST_TOKEN", "").strip()
    if not token:
        print("[X] Falta MP_TEST_TOKEN (Access Token TEST de un vendedor de prueba de MP).")
        print("  Generalo en https://www.mercadopago.com.ar/developers/panel -> Cuentas de prueba.")
        return

    print("1) user_id ...")
    uid = await client.get_user_id(token)
    print(f"   [OK] user_id: {uid}")

    print("2) crear sucursal ...")
    st = await client.create_store(token, uid, external_store_id=EXT_STORE, name="Test MiNegocio")
    print(f"   [OK] store: {st}")

    print("3) crear caja + QR fijo ...")
    pos = await client.create_pos(token, external_store_id=EXT_STORE, external_pos_id=EXT_POS, name="Test Caja")
    print(f"   [OK] QR imprimible: {pos.get('qr_image')}")
    print("   -> Abrí ese link, mostralo, y escancealo con una CUENTA COMPRADORA de prueba.")

    ref = "MNTEST" + os.urandom(4).hex()
    print(f"4) armar orden $100 (ref {ref}) ...")
    await client.arm_qr_order(token, uid, external_store_id=EXT_STORE, external_pos_id=EXT_POS,
                              amount=100.0, external_reference=ref, title="Prueba MiNegocio")
    print("   [OK] orden armada. Pagá $100 con el comprador de prueba escaneando el QR del paso 3.")

    print("5) esperando pago aprobado (60s) ...")
    pay = None
    for _ in range(20):
        pay = await client.search_approved_payment(token, ref)
        if pay:
            break
        await asyncio.sleep(3)
    if pay:
        ok = abs(float(pay.get("amount") or 0) - 100.0) < 0.5
        print(f"   [OK] PAGO detectado: {pay} — monto coincide: {ok}")
    else:
        print("   (sin pago — normal si no llegaste a escanear/pagar en 60s)")

    print("6) desarmar la orden ...")
    await client.clear_qr_order(token, uid, external_pos_id=EXT_POS)
    print("   [OK] orden desarmada. Prueba completa.")


if __name__ == "__main__":
    asyncio.run(main())

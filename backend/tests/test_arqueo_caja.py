"""
Tests de regresión del arqueo de caja (cierre de turno).

Cubren los fixes de lógica reales del cierre:
  - ventas anuladas (reverted) no cuentan en el efectivo esperado
  - pagos mixtos (split): la porción en efectivo cuenta en el esperado
  - devolución parcial en efectivo registra egreso de caja
  - cobro de fiado registra ingreso (egreso negativo) en el turno actual
  - anulación de venta de un turno anterior registra egreso en el turno actual

Corren en SQLite (modo local) sin red, como el resto de la suite.
"""

import asyncio
import logging
import os
import sys

import aiosqlite
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tests.test_sales_flow import _open_turn, _create_product  # noqa: E402


@pytest.fixture()
def test_db(tmp_path):
    db_path = str(tmp_path / "test_arqueo.db")
    os.environ["DB_PATH"] = db_path
    import main as main_module
    main_module.DB_PATH = db_path
    from core.database import init_db
    asyncio.run(init_db(db_path, logging.getLogger("test")))
    return db_path


@pytest.fixture()
def client(test_db):
    from httpx import AsyncClient, ASGITransport
    from main import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _seed_admin_pin(test_db, pin="1234"):
    async with aiosqlite.connect(test_db) as db:
        await db.execute("INSERT INTO operators (name, pin, role) VALUES (?,?,?)", ("Admin", pin, "admin"))
        await db.commit()


async def _sale(ac, turn_id, items, payment_method="efectivo", payment=None, total=None, payments=None, is_fiado=False, fiado_name=None):
    total = total if total is not None else (payment if payment is not None else sum(i["quantity"] * i["unit_price"] for i in items))
    payload = {
        "turn_id": turn_id,
        "total": total,
        "payment": payment if payment is not None else total,
        "operator": "Tester",
        "payment_method": payment_method,
        "is_fiado": is_fiado,
        "fiado_name": fiado_name,
        "items": items,
    }
    if payments is not None:
        payload["payments"] = payments
    r = await ac.post("/api/sales", json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _close(ac, turn_id, counted):
    r = await ac.post(f"/api/turns/{turn_id}/close", json={"sales_total": 0, "counted_cash": counted})
    assert r.status_code == 200, r.text
    return r.json()


async def test_split_efectivo_cuenta_en_esperado(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        pv = await _create_product(ac, "ARQ1", "Gaseosa", price=1000, stock=10)
        await _sale(ac, turn, [{"product_id": pv, "product_name": "Gaseosa", "quantity": 1, "unit_price": 1000}])
        await _sale(ac, turn, [{"product_id": pv, "product_name": "Gaseosa", "quantity": 1, "unit_price": 1000}],
                    payment_method="split", payments=[{"method": "efectivo", "amount": 700}, {"method": "tarjeta", "amount": 300}])
        r = await _close(ac, turn, 1700)
        assert r["expected_cash"] == 1700, r
        assert r["difference"] == 0, r


async def test_venta_anulada_no_cuenta(test_db, client):
    await _seed_admin_pin(test_db)
    async with client as ac:
        turn = await _open_turn(ac)
        pv = await _create_product(ac, "ARQ2", "Alfajor", price=2000, stock=10)
        sale_id = await _sale(ac, turn, [{"product_id": pv, "product_name": "Alfajor", "quantity": 1, "unit_price": 2000}])
        rv = await ac.post(f"/api/sales/{sale_id}/revert", json={"supervisor_pin": "1234", "operator": "Tester"})
        assert rv.status_code == 200, rv.text
        r = await _close(ac, turn, 0)
        assert r["expected_cash"] == 0, r
        assert r["difference"] == 0, r


async def test_devolucion_parcial_registra_egreso(test_db, client):
    await _seed_admin_pin(test_db)
    async with client as ac:
        turn = await _open_turn(ac)
        pv = await _create_product(ac, "ARQ3", "Pan", price=1500, stock=10)
        sale_id = await _sale(ac, turn, [{"product_id": pv, "product_name": "Pan", "quantity": 1, "unit_price": 1500}])
        rv = await ac.post(f"/api/sales/{sale_id}/revert-item", json={"product_id": pv, "quantity": 1, "supervisor_pin": "1234", "operator": "Tester"})
        assert rv.status_code == 200, rv.text
        r = await _close(ac, turn, 0)
        assert r["expected_cash"] == 0, r
        assert r["difference"] == 0, r


async def test_cobro_fiado_registra_ingreso(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        pv = await _create_product(ac, "ARQ4", "Cerveza", price=800, stock=10)
        sale_id = await _sale(ac, turn, [{"product_id": pv, "product_name": "Cerveza", "quantity": 1, "unit_price": 800}],
                              payment_method="fiado", payment=0, total=800, is_fiado=True, fiado_name="Juan")
        rc = await ac.post(f"/api/sales/{sale_id}/cobrar-fiado")
        assert rc.status_code == 200, rc.text
        r = await _close(ac, turn, 800)
        assert r["expected_cash"] == 800, r
        assert r["difference"] == 0, r


async def test_anulacion_turno_anterior_registra_egreso(test_db, client):
    await _seed_admin_pin(test_db)
    async with client as ac:
        turn1 = await _open_turn(ac)
        pv = await _create_product(ac, "ARQ5", "Fideos", price=2000, stock=10)
        sale_id = await _sale(ac, turn1, [{"product_id": pv, "product_name": "Fideos", "quantity": 1, "unit_price": 2000}])
        r1 = await _close(ac, turn1, 2000)
        assert r1["difference"] == 0, r1

        turn2 = await _open_turn(ac)
        await _sale(ac, turn2, [{"product_id": pv, "product_name": "Fideos", "quantity": 2, "unit_price": 2000}], payment=4000)
        rv = await ac.post(f"/api/sales/{sale_id}/revert", json={"supervisor_pin": "1234", "operator": "Tester"})
        assert rv.status_code == 200, rv.text
        # el cajón: 4000 vendidos - 2000 devueltos al cliente
        r2 = await _close(ac, turn2, 2000)
        assert r2["expected_cash"] == 2000, r2
        assert r2["difference"] == 0, r2

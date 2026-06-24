"""
Tests de los flujos de plata: venta, descuento de stock, fiado y cierre de caja.
Corren en SQLite (modo local, SAAS_MODE=false) — sin PostgreSQL ni red.

Cubren los bugs reales encontrados en produccion:
  - fiado que no creaba el cliente / quedaba en deuda 0
  - fiado parcial que cobraba el total en vez de lo no pagado
  - venta que no exige turno abierto
  - recalculo de precio desde DB (no confiar en el frontend)
  - idempotencia (no duplicar venta ni descontar stock dos veces)
"""

import asyncio
import logging
import os
import sys

import aiosqlite
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# El modo local/SQLite lo fuerza tests/conftest.py antes de importar main.


# ── Fixtures (DB limpia por test) ─────────────────────────────

@pytest.fixture()
def test_db(tmp_path):
    db_path = str(tmp_path / "test_sales.db")
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


# ── Helpers ───────────────────────────────────────────────────

async def _open_turn(ac, initial_cash=0):
    r = await ac.post("/api/turns", json={"operator": "Tester", "sucursal_id": 1, "initial_cash": initial_cash})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _create_product(ac, code, name, price, stock):
    r = await ac.post("/api/products", json={
        "code": code, "name": name, "price": price, "cost_price": 0,
        "stock": stock, "min_stock": 5, "iva": "21%",
    })
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _sale(turn_id, items, **kw):
    body = {
        "turn_id": turn_id, "total": kw.get("total", 0), "payment": kw.get("payment", 0),
        "change_given": kw.get("change_given", 0), "operator": "Tester",
        "payment_method": kw.get("payment_method", "efectivo"),
        "is_fiado": kw.get("is_fiado", False), "fiado_name": kw.get("fiado_name"),
        "items": items,
    }
    return body


async def _stock(db_path, pid):
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute("SELECT stock FROM products WHERE id=?", (pid,))
        row = await cur.fetchone()
        return row[0] if row else None


async def _customer(db_path, name):
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute("SELECT balance FROM customers WHERE name=?", (name,))
        row = await cur.fetchone()
        return row[0] if row else None


async def _sale_item_price(db_path, sale_id):
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute("SELECT unit_price FROM sale_items WHERE sale_id=?", (sale_id,))
        row = await cur.fetchone()
        return row[0] if row else None


# ── Venta y stock ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sale_decrements_stock(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "P1", "Agua", 1000, 10)
        r = await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Agua", "quantity": 3, "unit_price": 1000}],
            total=3000, payment=3000))
        assert r.status_code in (200, 201), r.text
    assert await _stock(test_db, pid) == 7


@pytest.mark.asyncio
async def test_sale_insufficient_stock_rejected(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "P2", "Coca", 1500, 5)
        r = await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Coca", "quantity": 99, "unit_price": 1500}],
            total=148500, payment=148500))
        assert r.status_code == 400
    # stock intacto
    assert await _stock(test_db, pid) == 5


@pytest.mark.asyncio
async def test_sale_requires_open_turn(test_db, client):
    async with client as ac:
        pid = await _create_product(ac, "P3", "Pan", 800, 10)
        r = await ac.post("/api/sales", json=_sale(
            None, [{"product_id": pid, "product_name": "Pan", "quantity": 1, "unit_price": 800}],
            total=800, payment=800))
        assert r.status_code == 400


@pytest.mark.asyncio
async def test_sale_price_recalculated_from_db(test_db, client):
    """Seguridad: el precio de venta sale de la DB, no del frontend."""
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "P4", "Yerba", 100, 10)
        r = await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Yerba", "quantity": 2, "unit_price": 1}],  # precio falso
            total=2, payment=2))
        assert r.status_code in (200, 201), r.text
        sale_id = r.json()["id"]
    # el item quedo guardado al precio real (100), no al falso (1)
    assert await _sale_item_price(test_db, sale_id) == 100


# ── Fiado ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fiado_creates_customer_with_full_debt(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "F1", "Galleta", 1000, 10)
        r = await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Galleta", "quantity": 2, "unit_price": 1000}],
            total=2000, payment=0, is_fiado=True, fiado_name="Dona Maria", payment_method="fiado"))
        assert r.status_code in (200, 201), r.text
    assert await _customer(test_db, "Dona Maria") == 2000


@pytest.mark.asyncio
async def test_fiado_partial_only_owes_unpaid(test_db, client):
    """Fiado parcial: la deuda es lo NO pagado, no el total."""
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "F2", "Caramelo", 1000, 10)
        r = await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Caramelo", "quantity": 1, "unit_price": 1000}],
            total=1000, payment=400, is_fiado=True, fiado_name="Don Pedro", payment_method="split"))
        assert r.status_code in (200, 201), r.text
    assert await _customer(test_db, "Don Pedro") == 600


@pytest.mark.asyncio
async def test_fiado_manual_without_products(test_db, client):
    """Anotar deuda manual sin productos en el carrito (bug histórico)."""
    async with client as ac:
        turn = await _open_turn(ac)
        r = await ac.post("/api/sales", json=_sale(
            turn, [], total=5000, payment=0, is_fiado=True, fiado_name="Vecino Juan", payment_method="fiado"))
        assert r.status_code in (200, 201), r.text
    assert await _customer(test_db, "Vecino Juan") == 5000


# ── Idempotencia ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sale_idempotency_no_double_charge(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "I1", "Jugo", 1200, 10)
        payload = _sale(turn, [{"product_id": pid, "product_name": "Jugo", "quantity": 2, "unit_price": 1200}],
                        total=2400, payment=2400)
        r1 = await ac.post("/api/sales?idempotency_key=key-abc", json=payload)
        assert r1.status_code in (200, 201), r1.text
        r2 = await ac.post("/api/sales?idempotency_key=key-abc", json=payload)
        assert r2.status_code in (200, 201)
        assert r2.json().get("duplicate") is True
    # stock descontado UNA sola vez (10 - 2 = 8)
    assert await _stock(test_db, pid) == 8


# ── Cierre de caja ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_turn_close_balanced(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        r = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 1000, "counted_cash": 1000})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["difference"] == 0
        assert data["status"] == "perfecto"


@pytest.mark.asyncio
async def test_turn_close_shortage_detected(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        r = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 1000, "counted_cash": 800})
        assert r.status_code == 200, r.text
        assert r.json()["difference"] == -200
        assert r.json()["status"] == "faltante"


@pytest.mark.asyncio
async def test_turn_close_twice_rejected(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        r1 = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 0, "counted_cash": 0})
        assert r1.status_code == 200
        r2 = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 0, "counted_cash": 0})
        assert r2.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

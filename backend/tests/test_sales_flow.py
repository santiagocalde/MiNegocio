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
# El efectivo esperado lo calcula el backend = base_inicial + ventas_efectivo
# (no fiado) - egresos. NO se confía en el total que manda el front (que sumaba
# todos los métodos -> faltante falso). Estos tests cubren ese bug real.

async def _egreso(ac, turn_id, monto):
    r = await ac.post("/api/egresos", json={"turn_id": turn_id, "monto": monto, "motivo": "Retiro test"})
    assert r.status_code in (200, 201), r.text


async def _faltante_egresos(db_path):
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute("SELECT COUNT(*) FROM egresos_caja WHERE motivo LIKE 'Ajuste por Faltante%'")
        return (await cur.fetchone())[0]


@pytest.mark.asyncio
async def test_turn_close_balanced_with_cash_sale(test_db, client):
    """Venta en efectivo de 1000, cuento 1000 -> cuadra."""
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "C1", "Agua", 1000, 10)
        await ac.post("/api/sales", json=_sale(turn, [{"product_id": pid, "product_name": "Agua", "quantity": 1, "unit_price": 1000}], total=1000, payment=1000))
        r = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 1000, "counted_cash": 1000})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["difference"] == 0, data
        assert data["status"] == "perfecto"


@pytest.mark.asyncio
async def test_turn_close_shortage_detected(test_db, client):
    """Venta efectivo 1000, cuento 800 -> faltante de 200."""
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "C2", "Coca", 1000, 10)
        await ac.post("/api/sales", json=_sale(turn, [{"product_id": pid, "product_name": "Coca", "quantity": 1, "unit_price": 1000}], total=1000, payment=1000))
        r = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 1000, "counted_cash": 800})
        assert r.status_code == 200, r.text
        assert r.json()["difference"] == -200, r.json()
        assert r.json()["status"] == "faltante"


@pytest.mark.asyncio
async def test_turn_close_ignores_noncash_payments(test_db, client):
    """BUG REAL: tarjeta y fiado NO van al cajón. Solo cuenta el efectivo.
    Efectivo 1000 + tarjeta 5000 + fiado 3000, cuento 1000 -> cuadra (no faltante)."""
    async with client as ac:
        turn = await _open_turn(ac)
        p1 = await _create_product(ac, "N1", "P1", 1000, 10)
        p2 = await _create_product(ac, "N2", "P2", 5000, 10)
        p3 = await _create_product(ac, "N3", "P3", 3000, 10)
        await ac.post("/api/sales", json=_sale(turn, [{"product_id": p1, "product_name": "P1", "quantity": 1, "unit_price": 1000}], total=1000, payment=1000, payment_method="efectivo"))
        await ac.post("/api/sales", json=_sale(turn, [{"product_id": p2, "product_name": "P2", "quantity": 1, "unit_price": 5000}], total=5000, payment=5000, payment_method="tarjeta"))
        await ac.post("/api/sales", json=_sale(turn, [{"product_id": p3, "product_name": "P3", "quantity": 1, "unit_price": 3000}], total=3000, payment=0, is_fiado=True, fiado_name="Fiado Test", payment_method="fiado"))
        r = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 9000, "counted_cash": 1000})
        assert r.status_code == 200, r.text
        assert r.json()["difference"] == 0, r.json()
        assert r.json()["status"] == "perfecto"
    # y NO se creó ningún egreso falso "Ajuste por Faltante"
    assert await _faltante_egresos(test_db) == 0


@pytest.mark.asyncio
async def test_turn_close_respects_initial_cash(test_db, client):
    """Base inicial 5000, sin ventas, cuento 5000 -> cuadra (el bug la ignoraba)."""
    async with client as ac:
        turn = await _open_turn(ac, initial_cash=5000)
        r = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 0, "counted_cash": 5000})
        assert r.status_code == 200, r.text
        assert r.json()["difference"] == 0, r.json()


@pytest.mark.asyncio
async def test_turn_close_subtracts_egresos(test_db, client):
    """Venta efectivo 1000, egreso 300, cuento 700 -> cuadra."""
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "E1", "Pan", 1000, 10)
        await ac.post("/api/sales", json=_sale(turn, [{"product_id": pid, "product_name": "Pan", "quantity": 1, "unit_price": 1000}], total=1000, payment=1000))
        await _egreso(ac, turn, 300)
        r = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 1000, "counted_cash": 700})
        assert r.status_code == 200, r.text
        assert r.json()["difference"] == 0, r.json()


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

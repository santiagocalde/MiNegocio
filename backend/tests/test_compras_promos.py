"""
Tests de flujos de compras (proveedores) y promociones.
Corren en SQLite (modo local) — sin PostgreSQL ni red. Cubren plata y stock.
"""

import asyncio
import logging
import os
import sys

import aiosqlite
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture()
def test_db(tmp_path):
    db_path = str(tmp_path / "test_cp.db")
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


async def _create_product(ac, code, name, price, stock, cost=0):
    r = await ac.post("/api/products", json={
        "code": code, "name": name, "price": price, "cost_price": cost,
        "stock": stock, "min_stock": 5, "iva": "21%",
    })
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _open_turn(ac, initial_cash=0):
    r = await ac.post("/api/turns", json={"operator": "Tester", "sucursal_id": 1, "initial_cash": initial_cash})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _product_row(db_path, pid):
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute("SELECT stock, cost_price FROM products WHERE id=?", (pid,))
        return await cur.fetchone()


# ── Compras ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_purchase_increases_stock_and_cost(test_db, client):
    async with client as ac:
        pid = await _create_product(ac, "CP1", "Fideos", price=500, stock=5, cost=0)
        r = await ac.post("/api/purchases", json={
            "invoice_number": "F-001", "operator": "Tester",
            "items": [{"product_id": pid, "product_name": "Fideos", "quantity": 10, "unit_cost": 50}],
        })
        assert r.status_code in (200, 201), r.text
        assert r.json()["total_cost"] == 500
    stock, cost = await _product_row(test_db, pid)
    assert stock == 15          # 5 + 10
    assert cost == 50           # cost_price actualizado


@pytest.mark.asyncio
async def test_purchase_paid_from_register_reduces_cash_at_close(test_db, client):
    """Una compra pagada del cajón debe restar del efectivo esperado al cerrar.
    Venta efectivo 1000, compra pagada de caja 300, cuento 700 -> debe cuadrar."""
    async with client as ac:
        turn = await _open_turn(ac)
        pv = await _create_product(ac, "CP2", "Gaseosa", price=1000, stock=10)
        await ac.post("/api/sales", json={
            "turn_id": turn, "total": 1000, "payment": 1000, "operator": "Tester",
            "payment_method": "efectivo", "is_fiado": False,
            "items": [{"product_id": pv, "product_name": "Gaseosa", "quantity": 1, "unit_price": 1000}],
        })
        pc = await _create_product(ac, "CP3", "Insumo", price=0, stock=0)
        r = await ac.post("/api/purchases", json={
            "invoice_number": "F-002", "operator": "Tester", "turn_id": turn, "paid_from_register": True,
            "items": [{"product_id": pc, "product_name": "Insumo", "quantity": 1, "unit_cost": 300}],
        })
        assert r.status_code in (200, 201), r.text
        rc = await ac.patch(f"/api/turns/{turn}/close", json={"sales_total": 1000, "counted_cash": 700})
        assert rc.status_code == 200, rc.text
        assert rc.json()["difference"] == 0, rc.json()   # expone el bug si la compra no se ata al turno


# ── Promociones ───────────────────────────────────────────────

async def _create_promo(ac, **kw):
    r = await ac.post("/api/promotions", json=kw)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.mark.asyncio
async def test_promo_discount_percent_savings(test_db, client):
    """20% off sobre un producto: 2 x $1000 -> ahorro $400."""
    async with client as ac:
        pid = await _create_product(ac, "PR1", "Cerveza", price=1000, stock=20)
        await _create_promo(ac, name="20% Cerveza", type="discount", discount_percent=20,
                            conditions=[{"product_id": pid, "min_qty": 1}])
        r = await ac.post("/api/promotions/evaluate", json={
            "items": [{"product_id": pid, "unit_price": 1000, "quantity": 2}]
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) == 1, data
        assert data[0]["savings"] == 400, data


@pytest.mark.asyncio
async def test_promo_combo_savings(test_db, client):
    """Combo A+B a precio fijo 1500 (valen 1800) -> ahorro 300."""
    async with client as ac:
        a = await _create_product(ac, "PC-A", "Pan", price=1000, stock=20)
        b = await _create_product(ac, "PC-B", "Fiambre", price=800, stock=20)
        await _create_promo(ac, name="Combo Sandwich", type="combo", combo_price=1500,
                            conditions=[{"product_id": a, "min_qty": 1}, {"product_id": b, "min_qty": 1}])
        r = await ac.post("/api/promotions/evaluate", json={
            "items": [{"product_id": a, "unit_price": 1000, "quantity": 1},
                      {"product_id": b, "unit_price": 800, "quantity": 1}]
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) == 1, data
        assert data[0]["savings"] == 300, data


@pytest.mark.asyncio
async def test_promo_not_applied_when_condition_unmet(test_db, client):
    """Si falta un producto del combo, no hay ahorro."""
    async with client as ac:
        a = await _create_product(ac, "PX-A", "Pan", price=1000, stock=20)
        b = await _create_product(ac, "PX-B", "Fiambre", price=800, stock=20)
        await _create_promo(ac, name="Combo", type="combo", combo_price=1500,
                            conditions=[{"product_id": a, "min_qty": 1}, {"product_id": b, "min_qty": 1}])
        r = await ac.post("/api/promotions/evaluate", json={
            "items": [{"product_id": a, "unit_price": 1000, "quantity": 1}]  # falta B
        })
        assert r.status_code == 200, r.text
        assert r.json() == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Tests del reporte de ganancias mensuales (ingresos - costo - gastos).

Cubren:
  - unit_cost guardado en sale_items al momento de vender
  - costo con fallback al cost_price actual para ventas sin unit_cost (historial)
  - gastos vs retiros (los retiros NO afectan la ganancia)
  - totales agregados por mes
"""

import asyncio
import logging
import os
import sys

import aiosqlite
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── Fixtures (mismos que test_sales_flow) ─────────────────────

@pytest.fixture()
def test_db(tmp_path):
    db_path = str(tmp_path / "test_ganancias.db")
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


async def _open_turn(ac, initial_cash=0):
    r = await ac.post("/api/turns", json={"operator": "Tester", "sucursal_id": 1, "initial_cash": initial_cash})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _create_product(ac, code, name, price, cost, stock=100):
    r = await ac.post("/api/products", json={
        "code": code, "name": name, "price": price, "cost_price": cost,
        "stock": stock, "min_stock": 5, "iva": "21%",
    })
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _sale(turn_id, items, **kw):
    return {
        "turn_id": turn_id, "total": kw.get("total", 0), "payment": kw.get("payment", 0),
        "change_given": kw.get("change_given", 0), "operator": "Tester",
        "payment_method": kw.get("payment_method", "efectivo"),
        "is_fiado": kw.get("is_fiado", False), "fiado_name": kw.get("fiado_name"),
        "items": items,
    }


async def _unit_cost(db_path, sale_id):
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute("SELECT unit_cost FROM sale_items WHERE sale_id=?", (sale_id,))
        row = await cur.fetchone()
        return row[0] if row else None


async def _egreso(ac, turn_id, monto, tipo="gasto"):
    r = await ac.post("/api/egresos", json={"turn_id": turn_id, "monto": monto, "motivo": "Test", "type": tipo})
    assert r.status_code in (200, 201), r.text


# ── Tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sale_guarda_unit_cost(test_db, client):
    """Al vender se guarda el costo del producto al momento de la venta."""
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "GC1", "Chocolate", 1000, 400)
        r = await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Chocolate", "quantity": 2, "unit_price": 1000}],
            total=2000, payment=2000))
        assert r.status_code in (200, 201), r.text
        sale_id = r.json()["id"]
    assert await _unit_cost(test_db, sale_id) == 400


@pytest.mark.asyncio
async def test_ganancias_resta_costo_y_gastos(test_db, client):
    """Ganancia neta = ventas - costo - gastos (los retiros no cuentan)."""
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "GC2", "Gaseosa", 1500, 700)
        r = await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Gaseosa", "quantity": 4, "unit_price": 1500}],
            total=6000, payment=6000))
        assert r.status_code in (200, 201), r.text
        await _egreso(ac, turn, 500)   # gasto: afecta ganancia
        await _egreso(ac, turn, 2000, tipo="retiro")  # retiro: no afecta

        res = await ac.get("/api/reports/ganancias")
        assert res.status_code == 200, res.text
        data = res.json()

    assert data["totales"]["ingresos"] == 6000
    assert data["totales"]["costo"] == 2800   # 700 * 4
    assert data["totales"]["bruto"] == 3200
    assert data["totales"]["gastos"] == 500
    assert data["totales"]["retiros"] == 2000
    assert data["totales"]["ganancia"] == 2700  # 6000 - 2800 - 500
    assert len(data["mensual"]) == 1
    mes = data["mensual"][0]
    assert mes["ingresos"] == 6000 and mes["ganancia"] == 2700


@pytest.mark.asyncio
async def test_ganancias_fallback_cost_price_para_ventas_historicas(test_db, client):
    """Ventas sin unit_cost (historial) usan el cost_price actual del producto."""
    import aiosqlite
    async with aiosqlite.connect(test_db) as db:
        cur = await db.execute("INSERT INTO products (code, name, price, cost_price, stock) VALUES ('HC1', 'Historico', 1200, 500, 10)")
        await db.commit()
        pid = cur.lastrowid
        # Insertar venta "vieja" sin unit_cost (simula venta previa al cambio)
        cur = await db.execute("INSERT INTO turns (operator, initial_cash) VALUES ('Tester', 0)")
        await db.commit()
        turn = cur.lastrowid
        await db.execute("INSERT INTO sales (turn_id, total, payment, operator, payment_method) VALUES (?, 1200, 1200, 'Tester', 'efectivo')", (turn,))
        await db.commit()
        cur = await db.execute("SELECT last_insert_rowid()")
        sale_id = (await cur.fetchone())[0]
        await db.execute(
            "INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, item_discount, unit_cost) VALUES (?, ?, 'Historico', 1, 1200, 0, 0)",
            (sale_id, pid)
        )
        await db.commit()

    async with client as ac:
        res = await ac.get("/api/reports/ganancias")
        assert res.status_code == 200, res.text
        data = res.json()

    assert data["totales"]["ingresos"] == 1200
    assert data["totales"]["costo"] == 500   # fallback al cost_price actual
    assert data["totales"]["ganancia"] == 700


@pytest.mark.asyncio
async def test_ganancias_respeta_rango_de_fechas(test_db, client):
    """El filtro desde/hasta filtra tanto ventas como gastos."""
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "GC3", "Snack", 800, 300)
        r = await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Snack", "quantity": 1, "unit_price": 800}],
            total=800, payment=800))
        assert r.status_code in (200, 201), r.text
        await _egreso(ac, turn, 100)

        res = await ac.get("/api/reports/ganancias?desde=2099-01-01&hasta=2099-12-31")
        assert res.status_code == 200, res.text
        data = res.json()
    assert data["mensual"] == []
    assert data["totales"]["ingresos"] == 0
    assert data["totales"]["ganancia"] == 0

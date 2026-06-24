"""
Tests de las mejoras de calidad (junio 2026). Corren en SQLite (SAAS_MODE=false).

Cubren:
  - /api/turns/{id}/detail: ahora adjunta las listas `sales` y `egresos`
    (antes devolvía solo la fila del turno, listas vacías).
  - PATCH /api/products/{id}/stock: ya no defaultea a 0 (footgun que podía
    vaciar inventario real). Exige `stock` numérico >= 0.
  - /api/stock-alerts: nueva lista `sin_costo` (productos con stock y cost_price 0).
  - /api/reports/margins: margen por producto y flags de rentabilidad.
"""

import asyncio
import logging
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# El modo local/SQLite lo fuerza tests/conftest.py antes de importar main.


@pytest.fixture()
def test_db(tmp_path):
    db_path = str(tmp_path / "test_mejoras.db")
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


async def _create_product(ac, code, name, price, stock, cost_price=0):
    r = await ac.post("/api/products", json={
        "code": code, "name": name, "price": price, "cost_price": cost_price,
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


# ── /api/turns/{id}/detail ────────────────────────────────────

@pytest.mark.asyncio
async def test_turn_detail_includes_sales_and_egresos(test_db, client):
    async with client as ac:
        turn = await _open_turn(ac)
        pid = await _create_product(ac, "D1", "Agua", 1000, 10)
        await ac.post("/api/sales", json=_sale(
            turn, [{"product_id": pid, "product_name": "Agua", "quantity": 2, "unit_price": 1000}],
            total=2000, payment=2000))
        await ac.post("/api/egresos", json={"turn_id": turn, "monto": 300, "motivo": "Retiro test"})

        r = await ac.get(f"/api/turns/{turn}/detail")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("sales"), list) and len(data["sales"]) == 1, data
        assert data["sales"][0]["total"] == 2000
        assert isinstance(data.get("egresos"), list) and len(data["egresos"]) == 1, data
        assert data["egresos"][0]["monto"] == 300


@pytest.mark.asyncio
async def test_turn_detail_404_for_unknown(test_db, client):
    async with client as ac:
        r = await ac.get("/api/turns/999999/detail")
        assert r.status_code == 404


# ── PATCH /api/products/{id}/stock ────────────────────────────

@pytest.mark.asyncio
async def test_update_stock_sets_absolute_value(test_db, client):
    async with client as ac:
        pid = await _create_product(ac, "S1", "Pan", 800, 10)
        r = await ac.patch(f"/api/products/{pid}/stock", json={"stock": 25})
        assert r.status_code == 200, r.text
        assert r.json()["new_stock"] == 25


@pytest.mark.asyncio
async def test_update_stock_rejects_missing_value(test_db, client):
    """Footgun: body sin `stock` ya NO vacía el inventario; responde 422."""
    async with client as ac:
        pid = await _create_product(ac, "S2", "Coca", 1500, 30)
        r = await ac.patch(f"/api/products/{pid}/stock", json={"operator": "Tester"})
        assert r.status_code == 422, r.text
        # y el stock quedó intacto
        check = await ac.get("/api/products")
        prod = next(p for p in check.json() if p["id"] == pid)
        assert prod["stock"] == 30


@pytest.mark.asyncio
async def test_update_stock_rejects_non_numeric(test_db, client):
    async with client as ac:
        pid = await _create_product(ac, "S3", "Jugo", 1200, 5)
        r = await ac.patch(f"/api/products/{pid}/stock", json={"stock": "abc"})
        assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_update_stock_rejects_negative(test_db, client):
    async with client as ac:
        pid = await _create_product(ac, "S4", "Leche", 900, 5)
        r = await ac.patch(f"/api/products/{pid}/stock", json={"stock": -3})
        assert r.status_code == 422, r.text


# ── /api/stock-alerts (sin_costo) ─────────────────────────────

@pytest.mark.asyncio
async def test_stock_alerts_flags_products_without_cost(test_db, client):
    async with client as ac:
        await _create_product(ac, "K1", "Con costo", 1000, 10, cost_price=600)
        await _create_product(ac, "K2", "Sin costo", 1000, 10, cost_price=0)
        r = await ac.get("/api/stock-alerts")
        assert r.status_code == 200, r.text
        nombres = {p["name"] for p in r.json()["sin_costo"]}
        assert "Sin costo" in nombres
        assert "Con costo" not in nombres


# ── /api/reports/margins ──────────────────────────────────────

@pytest.mark.asyncio
async def test_margins_report_computes_and_flags(test_db, client):
    async with client as ac:
        await _create_product(ac, "M1", "Buen margen", 1000, 10, cost_price=600)
        await _create_product(ac, "M2", "Sin costo", 1000, 10, cost_price=0)
        await _create_product(ac, "M3", "A perdida", 1000, 10, cost_price=1200)
        r = await ac.get("/api/reports/margins")
        assert r.status_code == 200, r.text
        data = r.json()
        by_name = {i["name"]: i for i in data["items"]}
        assert by_name["Buen margen"]["margen"] == 400
        assert by_name["Buen margen"]["margen_pct"] == 40.0
        assert by_name["Buen margen"]["flag"] is None
        assert by_name["Sin costo"]["flag"] == "sin_costo"
        assert by_name["A perdida"]["flag"] == "costo_mayor"
        assert data["resumen"]["sin_costo"] == 1
        assert data["resumen"]["costo_mayor_o_igual"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

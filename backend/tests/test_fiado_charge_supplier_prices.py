"""
Tests de las 2 features nuevas (corren en SQLite, modo local):
  - POST /api/customers/{id}/charge  → cargar deuda manual con descripcion
  - POST /api/suppliers/{id}/price-update → aumento masivo de precios por proveedor
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
    db_path = str(tmp_path / "test_fiado_sup.db")
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


async def _create_product(ac, code, name, price, supplier_id=None):
    body = {"code": code, "name": name, "price": price, "cost_price": 0,
            "stock": 10, "min_stock": 5, "iva": "21%"}
    if supplier_id is not None:
        body["supplier_id"] = supplier_id
    r = await ac.post("/api/products", json=body)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _price(db_path, pid):
    async with aiosqlite.connect(db_path) as db:
        cur = await db.execute("SELECT price FROM products WHERE id=?", (pid,))
        row = await cur.fetchone()
        return row[0] if row else None


# ── Feature 1: cargar fiado ────────────────────────────────────

@pytest.mark.asyncio
async def test_charge_adds_debt_with_description(test_db, client):
    async with client as ac:
        r = await ac.post("/api/customers", json={"name": "Olga", "amount": 2000})
        cid = r.json()["id"]

        r = await ac.post(f"/api/customers/{cid}/charge",
                          json={"amount": 2800, "description": "dos pan y una coca", "operator": "Vero"})
        assert r.status_code == 200, r.text
        assert r.json()["new_balance"] == 4800  # 2000 + 2800

        r = await ac.get(f"/api/customers/{cid}/transactions")
        txs = r.json()
        # buscamos el charge por descripcion (el orden por timestamp puede empatar
        # con el "Saldo inicial" si caen en el mismo segundo)
        cargo = next(t for t in txs if t["description"] == "dos pan y una coca")
        assert cargo["type"] == "charge"
        assert cargo["amount"] == 2800
        assert cargo["operator"] == "Vero"


@pytest.mark.asyncio
async def test_charge_rejects_zero_and_negative(test_db, client):
    async with client as ac:
        r = await ac.post("/api/customers", json={"name": "Pepe"})
        cid = r.json()["id"]
        assert (await ac.post(f"/api/customers/{cid}/charge", json={"amount": 0})).status_code == 400
        assert (await ac.post(f"/api/customers/{cid}/charge", json={"amount": -100})).status_code == 400


@pytest.mark.asyncio
async def test_charge_empty_description_defaults(test_db, client):
    async with client as ac:
        r = await ac.post("/api/customers", json={"name": "Ana"})
        cid = r.json()["id"]
        r = await ac.post(f"/api/customers/{cid}/charge", json={"amount": 500})
        assert r.status_code == 200
        txs = (await ac.get(f"/api/customers/{cid}/transactions")).json()
        assert txs[0]["description"] == "Fiado"


# ── Feature 2: aumento masivo por proveedor ────────────────────

@pytest.mark.asyncio
async def test_price_update_applies_percent_only_to_supplier(test_db, client):
    async with client as ac:
        s1 = (await ac.post("/api/suppliers", json={"name": "Coca Cola"})).json()["id"]
        s2 = (await ac.post("/api/suppliers", json={"name": "Otro"})).json()["id"]

        p1 = await _create_product(ac, "C1", "Coca 500", 1000, supplier_id=s1)
        p2 = await _create_product(ac, "C2", "Coca 2L", 2000, supplier_id=s1)
        p3 = await _create_product(ac, "X1", "Ajeno", 500, supplier_id=s2)

        # preview
        r = await ac.get(f"/api/suppliers/{s1}/products-count")
        assert r.json()["count"] == 2

        # +10%
        r = await ac.post(f"/api/suppliers/{s1}/price-update", json={"percent": 10})
        assert r.status_code == 200, r.text
        assert r.json()["updated"] == 2

        assert await _price(test_db, p1) == 1100
        assert await _price(test_db, p2) == 2200
        assert await _price(test_db, p3) == 500  # el de otro proveedor NO cambia


@pytest.mark.asyncio
async def test_price_update_negative_and_rounding(test_db, client):
    async with client as ac:
        s = (await ac.post("/api/suppliers", json={"name": "Prov"})).json()["id"]
        p = await _create_product(ac, "P1", "Prod", 999, supplier_id=s)
        # +5% de 999 = 1048.95 -> redondea a 1049
        r = await ac.post(f"/api/suppliers/{s}/price-update", json={"percent": 5})
        assert r.status_code == 200
        assert await _price(test_db, p) == 1049
        # -10% de 1049 = 944.1 -> 944
        await ac.post(f"/api/suppliers/{s}/price-update", json={"percent": -10})
        assert await _price(test_db, p) == 944


@pytest.mark.asyncio
async def test_price_update_rejects_zero(test_db, client):
    async with client as ac:
        s = (await ac.post("/api/suppliers", json={"name": "Prov"})).json()["id"]
        assert (await ac.post(f"/api/suppliers/{s}/price-update", json={"percent": 0})).status_code == 400


@pytest.mark.asyncio
async def test_price_update_supplier_not_found(test_db, client):
    async with client as ac:
        assert (await ac.post("/api/suppliers/9999/price-update", json={"percent": 5})).status_code == 404

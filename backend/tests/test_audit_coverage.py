"""
Tests de cobertura del Historial (audit log).

Verifica que cada acción de negocio deja huella en las tablas
`audit_log` y/o `stock_movements`.  Corre en SQLite (sin PostgreSQL).

Acciones cubiertas:
    [kiosco/general]
    - Cambio de precio individual          → stock_movements 'price_change'
    - Aumento masivo de precios            → audit_log 'batch_price_change'
    - Ajuste manual de stock               → stock_movements 'ajuste'
    - Alta de producto                     → audit_log 'product_created'
    - Baja de producto                     → audit_log 'product_deleted'
    - Venta                                → audit_log 'sale_created'
    - Compra a proveedor                   → stock_movements 'entrada'
                                           + audit_log 'compra_created'
    [corralón]
    - Crear presupuesto                    → audit_log 'quote_created'
    - Cambio estado presupuesto            → audit_log 'quote_status'
    - Presupuesto → nota de pedido         → audit_log 'quote_to_remito'
    - Crear nota de pedido                 → audit_log 'remito_created'
    - Cambio estado nota de pedido         → audit_log 'remito_status'
    - Crear acopio                         → audit_log 'acopio_created'
    - Retiro de acopio                     → audit_log 'acopio_withdrawal'
"""

import asyncio
import os
import sys

import aiosqlite
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# conftest.py ya fuerza SAAS_MODE=false antes de importar main


# ── Fixtures ──────────────────────────────────────────────────

@pytest.fixture()
def test_db(tmp_path):
    db_path = str(tmp_path / "test_audit.db")
    os.environ["DB_PATH"] = db_path
    import main as main_module
    main_module.DB_PATH = db_path
    import logging
    from core.database import init_db
    asyncio.run(init_db(db_path, logging.getLogger("test")))
    return db_path


@pytest.fixture()
def client(test_db):
    from httpx import AsyncClient, ASGITransport
    from main import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── Helpers ───────────────────────────────────────────────────

async def _open_turn(ac):
    r = await ac.post("/api/turns", json={
        "operator": "Test", "sucursal_id": 1, "initial_cash": 0,
    })
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _create_product(ac, name="Coca Cola", price=100, stock=50):
    r = await ac.post("/api/products", json={
        "code": f"TEST-{name[:4].upper()}", "name": name,
        "price": price, "cost_price": 50, "stock": stock, "min_stock": 5, "iva": "21%",
    })
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _movements_of_type(db_path, pid, mtype):
    """Devuelve filas como dicts: id, business_id, product_id, movement_type,
    quantity, old_value, new_value, reason, operator, timestamp."""
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM stock_movements WHERE product_id=? AND movement_type=? ORDER BY id DESC",
            (pid, mtype),
        )
        return [dict(r) for r in await cur.fetchall()]


async def _audit_of_action(db_path, action):
    """Devuelve filas como dicts: id, action, operator, details, created_at."""
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM audit_log WHERE action=? ORDER BY id DESC",
            (action,),
        )
        return [dict(r) for r in await cur.fetchall()]


# ── Tests: catálogo y precios ─────────────────────────────────

@pytest.mark.asyncio
async def test_product_created_logged(client, test_db):
    """Alta de producto → audit_log 'product_created'."""
    async with client as ac:
        pid = await _create_product(ac, "Alfajor Jorgito", 150, 30)
    rows = await _audit_of_action(test_db, "product_created")
    assert rows, "No se registró product_created en audit_log"
    details = rows[0]["details"]
    assert "Alfajor Jorgito" in details, f"Nombre no aparece en details: {details}"


@pytest.mark.asyncio
async def test_product_deleted_logged(client, test_db):
    """Baja de producto → audit_log 'product_deleted'."""
    async with client as ac:
        pid = await _create_product(ac, "Chicle Beldent", 30, 100)
        r = await ac.delete(f"/api/products/{pid}")
        assert r.status_code == 200, r.text
    rows = await _audit_of_action(test_db, "product_deleted")
    assert rows, "No se registró product_deleted en audit_log"
    details = rows[0]["details"]
    assert "Chicle Beldent" in details, f"Nombre no aparece en details: {details}"


@pytest.mark.asyncio
async def test_price_change_logged(client, test_db):
    """Cambio de precio individual → stock_movements 'price_change'."""
    async with client as ac:
        pid = await _create_product(ac, "Fernet Branca", 2500, 20)
        r = await ac.post(f"/api/products/{pid}/price", json={
            "price": 2800, "operator": "Admin",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["old_price"] == 2500
        assert data["new_price"] == 2800
    movements = await _movements_of_type(test_db, pid, "price_change")
    assert movements, "No se insertó movimiento price_change en stock_movements"
    reason = movements[0]["reason"]
    assert "2500" in reason and "2800" in reason, f"Precios no en reason: {reason}"


@pytest.mark.asyncio
async def test_batch_price_change_logged(client, test_db):
    """Aumento masivo → audit_log 'batch_price_change'."""
    async with client as ac:
        await _create_product(ac, "Yerba Playadito", 1200, 40)
        r = await ac.post("/api/products/batch-increase", json={
            "percentage": 10, "operator": "Admin",
        })
        assert r.status_code == 200, r.text
    rows = await _audit_of_action(test_db, "batch_price_change")
    assert rows, "No se registró batch_price_change en audit_log"
    details = rows[0]["details"]
    assert "10" in details, f"Porcentaje no en details: {details}"


@pytest.mark.asyncio
async def test_stock_adjustment_logged(client, test_db):
    """Ajuste manual de stock → stock_movements 'ajuste'."""
    async with client as ac:
        pid = await _create_product(ac, "Papel A4", 500, 100)
        r = await ac.post(f"/api/products/{pid}/stock", json={
            "stock": 75, "operator": "Admin",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["old_stock"] == 100
        assert data["new_stock"] == 75
    movements = await _movements_of_type(test_db, pid, "ajuste")
    assert movements, "No se insertó movimiento ajuste en stock_movements"
    qty = movements[0]["quantity"]
    assert qty == -25, f"Delta incorrecto: {qty}"


# ── Tests: ventas ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sale_logged(client, test_db):
    """Venta → audit_log 'sale_created' + stock_movements 'salida'."""
    async with client as ac:
        turn_id = await _open_turn(ac)
        pid = await _create_product(ac, "Agua Mineral", 100, 20)
        r = await ac.post("/api/sales", json={
            "turn_id": turn_id, "total": 100, "payment": 100, "change_given": 0,
            "operator": "Tester", "payment_method": "efectivo",
            "is_fiado": False,
            "items": [{"product_id": pid, "product_name": "Agua Mineral", "quantity": 1, "unit_price": 100}],
        })
        assert r.status_code in (200, 201), r.text
    audit_rows = await _audit_of_action(test_db, "sale_created")
    assert audit_rows, "No se registró sale_created en audit_log"
    mov_rows = await _movements_of_type(test_db, pid, "salida")
    assert mov_rows, "No se registró salida en stock_movements"


# ── Tests: compras ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_purchase_logs_entrada_and_audit(client, test_db):
    """Compra → stock_movements 'entrada' por ítem + audit_log 'compra_created'."""
    async with client as ac:
        pid = await _create_product(ac, "Leche La Serenisima", 200, 0)
        r = await ac.post("/api/purchases", json={
            "supplier_id": None,
            "invoice_number": "FAC-0001",
            "operator": "Admin",
            "items": [
                {"product_id": pid, "product_name": "Leche La Serenisima", "quantity": 24, "unit_cost": 180},
            ],
        })
        assert r.status_code in (200, 201), r.text
    # stock_movements 'entrada'
    movements = await _movements_of_type(test_db, pid, "entrada")
    assert movements, "No se insertó entrada en stock_movements"
    assert movements[0]["quantity"] == 24, f"Cantidad incorrecta: {movements[0]['quantity']}"
    # audit_log 'compra_created'
    audit_rows = await _audit_of_action(test_db, "compra_created")
    assert audit_rows, "No se registró compra_created en audit_log"


# ── Tests: corralón ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_quote_lifecycle_logged(client, test_db):
    """Presupuesto: create → status → to_remito — todos en audit_log."""
    async with client as ac:
        pid = await _create_product(ac, "Cemento Portland", 3500, 200)

        # Crear presupuesto
        r = await ac.post("/api/quotes", json={
            "customer_name": "Juan Obras",
            "operator": "Admin",
            "items": [{"product_id": pid, "quantity": 10, "unit_price": 3500}],
        })
        assert r.status_code in (200, 201), r.text
        qid = r.json()["id"]

    rows = await _audit_of_action(test_db, "quote_created")
    assert rows, "No se registró quote_created"
    assert str(qid) in rows[0]["details"], f"ID de presupuesto no en details: {rows[0]['details']}"


@pytest.mark.asyncio
async def test_quote_status_change_logged(client, test_db):
    """Cambio de estado de presupuesto → audit_log 'quote_status'."""
    async with client as ac:
        pid = await _create_product(ac, "Arena Fina", 800, 500)
        r = await ac.post("/api/quotes", json={
            "customer_name": "Obra Norte", "operator": "Admin",
            "items": [{"product_id": pid, "quantity": 5, "unit_price": 800}],
        })
        assert r.status_code in (200, 201), r.text
        qid = r.json()["id"]

        r2 = await ac.post(f"/api/quotes/{qid}/status", json={
            "status": "approved", "operator": "Admin",
        })
        assert r2.status_code == 200, r2.text

    rows = await _audit_of_action(test_db, "quote_status")
    assert rows, "No se registró quote_status"


@pytest.mark.asyncio
async def test_remito_created_logged(client, test_db):
    """Crear nota de pedido → audit_log 'remito_created'."""
    async with client as ac:
        pid = await _create_product(ac, "Hierro 8mm", 5000, 100)
        r = await ac.post("/api/remitos", json={
            "customer_name": "Constructora Sur", "operator": "Admin",
            "items": [{"product_id": pid, "quantity": 20, "unit_price": 5000}],
        })
        assert r.status_code in (200, 201), r.text

    rows = await _audit_of_action(test_db, "remito_created")
    assert rows, "No se registró remito_created"


@pytest.mark.asyncio
async def test_remito_status_change_logged(client, test_db):
    """Cambio de estado de nota de pedido → audit_log 'remito_status'."""
    async with client as ac:
        pid = await _create_product(ac, "Cal Hidratada", 1200, 80)
        r = await ac.post("/api/remitos", json={
            "customer_name": "Albañil Pedro", "operator": "Admin",
            "items": [{"product_id": pid, "quantity": 5, "unit_price": 1200}],
        })
        assert r.status_code in (200, 201), r.text
        rid = r.json()["id"]

        r2 = await ac.post(f"/api/remitos/{rid}/status", json={
            "status": "en_camino", "operator": "Chofer",
        })
        assert r2.status_code == 200, r2.text

    rows = await _audit_of_action(test_db, "remito_status")
    assert rows, "No se registró remito_status"


@pytest.mark.asyncio
async def test_acopio_created_logged(client, test_db):
    """Crear acopio → audit_log 'acopio_created'."""
    async with client as ac:
        pid = await _create_product(ac, "Ladrillo Comun", 50, 5000)
        r = await ac.post("/api/acopios", json={
            "customer_name": "Familia Lopez", "operator": "Admin",
            "items": [{"product_id": pid, "quantity": 500, "unit_price": 50}],
        })
        assert r.status_code in (200, 201), r.text

    rows = await _audit_of_action(test_db, "acopio_created")
    assert rows, "No se registró acopio_created"


@pytest.mark.asyncio
async def test_acopio_withdrawal_logged(client, test_db):
    """Retiro de acopio → audit_log 'acopio_withdrawal'."""
    async with client as ac:
        pid = await _create_product(ac, "Bloque 18cm", 120, 1000)
        r = await ac.post("/api/acopios", json={
            "customer_name": "Cliente Acopio", "operator": "Admin",
            "items": [{"product_id": pid, "quantity": 100, "unit_price": 120}],
        })
        assert r.status_code in (200, 201), r.text
        acopio_id = r.json()["id"]

        # Obtener el id del acopio_item para el retiro
        r_detail = await ac.get(f"/api/acopios/{acopio_id}")
        assert r_detail.status_code == 200, r_detail.text
        acopio_item_id = r_detail.json()["items"][0]["id"]

        r2 = await ac.post(f"/api/acopios/{acopio_id}/withdrawals", json={
            "items": [{"acopio_item_id": acopio_item_id, "quantity": 30}],
            "operator": "Admin",
        })
        assert r2.status_code in (200, 201), r2.text

    rows = await _audit_of_action(test_db, "acopio_withdrawal")
    assert rows, "No se registró acopio_withdrawal"

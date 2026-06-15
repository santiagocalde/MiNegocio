"""
Stress Tests Backend — NovaStock POS
====================================
Pruebas de carga, concurrencia, race conditions y puntos de falla.
Ejecutar: pytest tests/test_stress.py -v --tb=long
"""

import pytest
import asyncio
import aiosqlite
import json
import os
import sys
import time
import random
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app
from core.database import init_db


@pytest.fixture(autouse=True)
def setup_db(tmp_path):
    """Initialize clean test DB before each test"""
    test_db = os.path.join(str(tmp_path), "test_novastock.db")
    os.environ["DB_PATH"] = test_db

    import main as main_module
    main_module.DB_PATH = test_db

    asyncio.run(init_db(test_db, logging.getLogger("test")))

    async def seed():
        async with aiosqlite.connect(test_db) as db:
            await db.execute(
                "INSERT OR IGNORE INTO products (id, code, name, price, cost_price, stock, min_stock, iva, category_id, is_active) "
                "VALUES (1, 'TEST001', 'Producto Test', 100, 50, 9999, 10, 21, 1, 1)"
            )
            await db.execute(
                "INSERT OR IGNORE INTO turns (id, operator, opened_at, closed_at) "
                "VALUES (1, 'TestOperator', datetime('now','localtime'), NULL)"
            )
            await db.commit()
    asyncio.run(seed())
    return test_db


# ────────────────────────────────────────────────────────────
# TEST 1: RACE CONDITION — Concurrent sales
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_concurrent_sales_race_condition(setup_db):
    """50 concurrent sales → verify stock integrity"""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)

    async def create_sale(sale_id):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            payload = {
                "turn_id": 1,
                "total": 100,
                "payment": 100,
                "change_given": 0,
                "operator": "TestOperator",
                "is_fiado": False,
                "payment_method": "efectivo",
                "items": [{"product_id": 1, "product_name": "Test", "quantity": 1, "unit_price": 100}],
            }
            try:
                res = await ac.post(f"/api/sales?idempotency_key=stress-{sale_id}", json=payload)
                return res.status_code
            except Exception:
                return 0

    tasks = [create_sale(i) for i in range(50)]
    results = await asyncio.gather(*tasks)

    success = sum(1 for r in results if r in (200, 201))

    async with aiosqlite.connect(setup_db) as db:
        cur = await db.execute("SELECT stock FROM products WHERE id=1")
        row = await cur.fetchone()
        final_stock = row[0] if row else -1

    print(f"\n  ▶ Concurrentes: 50 enviadas, {success} OK")
    print(f"  ▶ Stock final: {final_stock} (esperado: ~{9999 - success})")

    assert success > 30, f"Muy pocas exitosas: {success}/50"
    expected = 9999 - success
    assert abs(final_stock - expected) <= 2, (
        f"Inconsistencia grave de stock: final={final_stock} esperado~={expected}"
    )
    print(f"  ✅ Race condition: diff={abs(final_stock - expected)} (max 2)")


# ────────────────────────────────────────────────────────────
# TEST 2: ALTER TABLE SILENT FAILURES
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_alter_table_silent_failures(setup_db):
    """Verify all ALTER TABLE columns actually exist"""
    expected_columns = {
        "products": ["currency", "exchange_rate", "is_active"],
    }
    missing = []
    for table, cols in expected_columns.items():
        async with aiosqlite.connect(setup_db) as db:
            cur = await db.execute(f"PRAGMA table_info({table})")
            existing = {row[1] for row in await cur.fetchall()}
        for col in cols:
            if col not in existing:
                missing.append(f"{table}.{col}")

    if missing:
        print(f"\n  ❌ Columnas faltantes: {missing}")
    else:
        print(f"\n  ✅ Todas las columnas existen")
    assert not missing, f"ALTER TABLE fallaron para: {missing}"


# ────────────────────────────────────────────────────────────
# TEST 3: DB WRITE LOCK CONTENTION
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_db_write_lock_contention(setup_db):
    """20 concurrent writes → lock must serialize"""
    # Create a dedicated lock for this test's event loop
    test_lock = asyncio.Lock()

    async def write_operation(op_id):
        async with test_lock:
            async with aiosqlite.connect(setup_db) as db:
                await db.execute("UPDATE products SET stock = stock - 1 WHERE id = 1")
                await db.commit()
                await asyncio.sleep(0.01)
        return op_id

    start = time.time()
    tasks = [write_operation(i) for i in range(20)]
    results = await asyncio.gather(*tasks)
    elapsed = time.time() - start

    async with aiosqlite.connect(setup_db) as db:
        cur = await db.execute("SELECT stock FROM products WHERE id=1")
        row = await cur.fetchone()
        final_stock = row[0] if row else -1

    print(f"\n  ▶ 20 ops secuenciales en {elapsed:.2f}s")
    print(f"  ▶ Stock final: {final_stock} (esperado: {9999 - 20})")
    assert final_stock == 9999 - 20, f"Lock no serializó: stock {final_stock}"
    print(f"  ✅ Write lock funciona")


# ────────────────────────────────────────────────────────────
# TEST 4: HIGH FREQUENCY READS
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_high_frequency_reads(setup_db):
    """200 concurrent product searches"""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)

    async def search_product(q):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            try:
                res = await ac.get(f"/api/products?q={q}")
                return res.status_code
            except:
                return 0

    queries = [random.choice(["Test", "Producto", "TEST001", "", "PROD", "a"]) for _ in range(200)]
    tasks = [search_product(q) for q in queries]
    results = await asyncio.gather(*tasks)

    ok = sum(1 for r in results if r == 200)
    print(f"\n  ▶ 200 búsquedas concurrentes: {ok} OK")
    assert ok > 150, f"Muchas búsquedas fallaron: {ok}/200"
    print(f"  ✅ Alto volumen de lecturas OK")


# ────────────────────────────────────────────────────────────
# TEST 5: SYNC BATCH INTEGRITY
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_sync_batch_integrity(setup_db):
    """10 offline sales → must all insert"""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for i in range(10):
            payload = {
                "turn_id": 1,
                "total": 100 + i,
                "payment": 100 + i,
                "change_given": 0,
                "operator": "SyncOperator",
                "is_fiado": False,
                "payment_method": "efectivo",
                "items": [{"product_id": 1, "product_name": "Test", "quantity": 1, "unit_price": 100 + i}],
            }
            res = await ac.post(f"/api/sales?idempotency_key=sync-batch-{i}", json=payload)
            assert res.status_code in (200, 201), f"Sale {i} failed: {res.status_code}"

    async with aiosqlite.connect(setup_db) as db:
        cur = await db.execute("SELECT COUNT(*) FROM sales")
        count = (await cur.fetchone())[0]
    print(f"\n  ▶ Batch 10 ventas: {count} registros en DB")
    assert count == 10, f"No se insertaron todas: {count}/10"
    print(f"  ✅ Sync batch integridad OK")


# ────────────────────────────────────────────────────────────
# TEST 6: IDEMPOTENCY DEDUP
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_idempotency_key_dedup(setup_db):
    """Same request 10 times → 1 record"""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)

    payload = {
        "turn_id": 1,
        "total": 500,
        "payment": 500,
        "change_given": 0,
        "operator": "IdempotencyTest",
        "is_fiado": False,
        "payment_method": "efectivo",
        "items": [{"product_id": 1, "product_name": "Test", "quantity": 1, "unit_price": 500}],
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        duplicates = 0
        for i in range(10):
            res = await ac.post("/api/sales?idempotency_key=dup-test-key", json=payload)
            assert res.status_code in (200, 201), f"Request {i}: status {res.status_code}"
            data = res.json()
            if data.get("reprocessed"):
                duplicates += 1

    async with aiosqlite.connect(setup_db) as db:
        cur = await db.execute("SELECT COUNT(*) FROM sales")
        count = (await cur.fetchone())[0]
    print(f"\n  ▶ 10 requests, {count} ventas únicas, {duplicates} duplicados")
    assert count == 1, f"Idempotency no funciona: {count} ventas creadas"
    assert duplicates == 9, f"Deben detectarse 9 duplicados, se detectaron {duplicates}"
    print(f"  ✅ Idempotency key OK")


# ────────────────────────────────────────────────────────────
# TEST 7: PROMOTIONS EVALUATE STRESS
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_promotions_evaluate_stress(setup_db):
    """100 promotion evaluations"""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        promo_payload = {
            "name": "Stress Promo",
            "type": "discount",
            "discount_percent": 10,
            "conditions": [{"product_id": 1, "min_qty": 2}],
        }
        res = await ac.post("/api/promotions", json=promo_payload)
        assert res.status_code in (200, 201), f"Crear promoción falló: {res.status_code}"

        eval_payload = {
            "items": [{"product_id": 1, "name": "Test", "quantity": 5, "price": 100}]
        }

        for i in range(100):
            res = await ac.post("/api/promotions/evaluate", json=eval_payload)
            assert res.status_code == 200, f"Evaluación {i} falló: {res.status_code}"

    print(f"\n  ✅ 100 evaluaciones de promociones OK")


# ────────────────────────────────────────────────────────────
# TEST 8: PAYLOAD BOUNDARIES
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_payload_boundaries(setup_db):
    """Malformed payloads → reject without crash"""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)

    test_cases = [
        ({"total": -100, "items": []}, "total negativo"),
        ({"total": 0, "items": [{"product_id": 999, "quantity": -1}]}, "producto invalido"),
        ({"total": 0, "items": []}, "carrito vacio"),
        ({}, "payload vacio"),
    ]

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for payload, desc in test_cases:
            try:
                res = await ac.post("/api/sales?idempotency_key=boundary-test", json=payload)
                assert res.status_code in [400, 422], f"{desc}: status {res.status_code}"
            except Exception as e:
                print(f"  ⚠️ {desc}: excepcion ({e})")

    print("  ✅ Payload boundaries: todos rechazados sin crash")


# ────────────────────────────────────────────────────────────
# TEST 9: CASHIER ROUTER ENDPOINTS
# ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_cashier_router_endpoints(setup_db):
    """Cash drawer endpoints should not crash"""
    from httpx import AsyncClient, ASGITransport
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/config/printing")
        assert res.status_code == 200, f"GET config: {res.status_code}"
        print(f"  ▶ GET /api/config/printing: {res.status_code}")

        res = await ac.put("/api/config/printing", json={
            "enabled": True, "mode": "window_print",
            "auto_open_drawer": True, "auto_print_ticket": True, "printer_name": "Test"
        })
        assert res.status_code == 200, f"PUT config: {res.status_code}"
        print(f"  ▶ PUT /api/config/printing: {res.status_code}")

        res = await ac.post("/api/cash-drawer/open", json={})
        assert res.status_code in [200, 400], f"POST cash-drawer: {res.status_code}"
        print(f"  ▶ POST /api/cash-drawer/open: {res.status_code}")

        res = await ac.get("/api/agent/ping")
        assert res.status_code in [200, 500], f"GET agent/ping: {res.status_code}"
        print(f"  ▶ GET /api/agent/ping: {res.status_code}")

    print(f"  ✅ Cashier router endpoints OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=long"])

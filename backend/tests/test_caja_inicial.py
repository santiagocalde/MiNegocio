import asyncio
import logging
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tests.test_sales_flow import _open_turn, _create_product  # noqa: E402


@pytest.fixture()
def test_db(tmp_path):
    db_path = str(tmp_path / "test_caja_inicial.db")
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


async def test_nuevo_turno_sugiere_caja_inicial_del_ultimo_cierre(test_db, client):
    """Al abrir un turno nuevo (login owner), la caja inicial sugerida es el
    counted_cash del último turno cerrado con arqueo."""
    import aiosqlite
    async with aiosqlite.connect(test_db) as db:
        await db.execute("INSERT INTO operators (name, pin, role) VALUES (?,?,?)", ("Admin", "1234", "admin"))
        await db.commit()

    async with client as ac:
        turn1 = await _open_turn(ac)
        pv = await _create_product(ac, "CI1", "Gaseosa", price=1000, stock=10)
        r = await ac.post("/api/sales", json={
            "turn_id": turn1, "total": 1000, "payment": 1000, "operator": "Admin",
            "payment_method": "efectivo",
            "items": [{"product_id": pv, "product_name": "Gaseosa", "quantity": 1, "unit_price": 1000}],
        })
        assert r.status_code in (200, 201), r.text
        rc = await ac.post(f"/api/turns/{turn1}/close", json={"sales_total": 1000, "counted_cash": 1000})
        assert rc.status_code == 200, rc.text

        rl = await ac.post("/api/login/owner")
        assert rl.status_code == 200, rl.text
        data = rl.json()
        assert data["turn_auto_opened"] is True
        assert data["suggested_initial_cash"] == 1000, data
        assert data["initial_cash"] == 1000, data


async def test_nuevo_turno_sin_cierres_previos_caja_inicial_cero(test_db, client):
    import aiosqlite
    async with aiosqlite.connect(test_db) as db:
        await db.execute("INSERT INTO operators (name, pin, role) VALUES (?,?,?)", ("Admin", "1234", "admin"))
        await db.commit()

    async with client as ac:
        rl = await ac.post("/api/login/owner")
        assert rl.status_code == 200, rl.text
        data = rl.json()
        assert data["suggested_initial_cash"] == 0, data
        assert data["initial_cash"] == 0, data

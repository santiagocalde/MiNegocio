"""
Tests de negocio: auth (PIN), operadores, plan limits y helpers JWT.
Corren en SQLite en memoria — sin PostgreSQL ni servicios externos.
"""

import asyncio
import logging
import os
import sys

import aiosqlite
import bcrypt
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("SAAS_MODE", "false")
os.environ.setdefault("APP_ENV", "test")


# ── Fixture: DB limpia en tmp por test ────────────────────────

@pytest.fixture()
def test_db(tmp_path):
    db_path = str(tmp_path / "test_core.db")
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

async def _seed_operator(db_path: str, name: str = "Admin", pin: str = "1234", role: str = "admin"):
    hashed = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "INSERT INTO operators (name, pin, role) VALUES (?,?,?)", (name, hashed, role)
        )
        await db.execute(
            "INSERT INTO turns (operator, opened_at) VALUES (?, datetime('now','localtime'))", (name,)
        )
        await db.commit()


# ── Tests de login por PIN ────────────────────────────────────

@pytest.mark.asyncio
async def test_login_valid_pin(test_db, client):
    await _seed_operator(test_db, pin="5678")
    async with client as ac:
        res = await ac.post("/api/login", json={"pin": "5678"})
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Admin"
    assert data["role"] == "admin"
    assert "turn_id" in data


@pytest.mark.asyncio
async def test_login_wrong_pin(test_db, client):
    await _seed_operator(test_db, pin="9999")
    async with client as ac:
        res = await ac.post("/api/login", json={"pin": "0000"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_invalid_pin_format(test_db, client):
    async with client as ac:
        res = await ac.post("/api/login", json={"pin": "abc"})
    assert res.status_code == 400

    async with client as ac:
        res = await ac.post("/api/login", json={"pin": "123"})
    assert res.status_code == 400


# ── Tests de operadores CRUD ──────────────────────────────────

@pytest.mark.asyncio
async def test_create_operator(test_db, client):
    async with client as ac:
        res = await ac.post("/api/operators", json={"name": "Cajero", "pin": "4321", "role": "cashier"})
    assert res.status_code == 200
    assert res.json()["name"] == "Cajero"


@pytest.mark.asyncio
async def test_create_operator_invalid_pin(test_db, client):
    async with client as ac:
        res = await ac.post("/api/operators", json={"name": "X", "pin": "ab", "role": "employee"})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_create_operator_invalid_role(test_db, client):
    async with client as ac:
        res = await ac.post("/api/operators", json={"name": "X", "pin": "1234", "role": "god"})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_list_operators_empty(test_db, client):
    async with client as ac:
        res = await ac.get("/api/operators")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_delete_operator_not_found(test_db, client):
    async with client as ac:
        res = await ac.delete("/api/operators/9999")
    assert res.status_code == 404


# ── Tests de plan limits ──────────────────────────────────────

@pytest.mark.asyncio
async def test_plan_limits_local_mode_unrestricted():
    from core.plan_limits import check_plan_limits
    limits = await check_plan_limits("multi_sucursal", business=None)
    assert limits["multi_sucursal"] is True


@pytest.mark.asyncio
async def test_plan_limits_trial_blocks_multi_sucursal():
    from fastapi import HTTPException
    from core.plan_limits import check_plan_limits
    with pytest.raises(HTTPException) as exc:
        await check_plan_limits("multi_sucursal", business={"plan": "trial", "sub": "test"})
    assert exc.value.status_code == 402


@pytest.mark.asyncio
async def test_plan_limits_pro_allows_multi_sucursal():
    from core.plan_limits import check_plan_limits
    limits = await check_plan_limits("multi_sucursal", business={"plan": "pro", "sub": "test"})
    assert limits["multi_sucursal"] is True


@pytest.mark.asyncio
async def test_plan_limits_trial_blocks_purchases():
    from fastapi import HTTPException
    from core.plan_limits import check_plan_limits
    with pytest.raises(HTTPException) as exc:
        await check_plan_limits("purchases", business={"plan": "trial", "sub": "test"})
    assert exc.value.status_code == 402


# ── Tests de JWT helpers ──────────────────────────────────────

def test_create_access_token_contains_type():
    from core.jwt_helpers import create_access_token, JWT_SECRET, JWT_ALGORITHM
    from jose import jwt
    token = create_access_token({"sub": "biz-123"})
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert payload["type"] == "access"
    assert payload["sub"] == "biz-123"


def test_create_refresh_token_contains_type():
    from core.jwt_helpers import create_refresh_token, JWT_SECRET, JWT_ALGORITHM
    from jose import jwt
    token = create_refresh_token({"sub": "biz-456"})
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert payload["type"] == "refresh"


# ── Tests de endpoints de salud ───────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint(test_db, client):
    async with client as ac:
        res = await ac.get("/api/health")
    assert res.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

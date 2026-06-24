"""
Operadores y login local por PIN.
"""
import os
import logging
from datetime import datetime
from typing import Optional

import aiosqlite
import bcrypt
import main
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.plan_limits import PLAN_LIMITS
from core.jwt_helpers import get_current_business
from core.context import business_id_ctx

logger = logging.getLogger("NovaStock")

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

USE_PG  = bool(os.getenv("DATABASE_URL", ""))
# DB_PATH se lee dinámico desde main.DB_PATH en cada handler (igual que el resto
# de routers). Capturarlo acá al importar rompía los tests y cualquier cambio de
# path en runtime. Se deja solo como fallback histórico, no se usa en los handlers.
DB_PATH = os.getenv("DB_PATH") or os.path.join(os.path.dirname(__file__), "..", "data", "minegocio.db")


def _row_to_dict(row, description):
    return {description[i][0]: row[i] for i in range(len(description))}


# ── Helpers de turno ──────────────────────────────────────────

async def _ensure_open_turn_pg(conn, operator: str, b_id: str) -> dict:
    row = await conn.fetchrow(
        "SELECT id, opened_at FROM turns WHERE closed_at IS NULL AND business_id = $1 ORDER BY opened_at DESC LIMIT 1",
        b_id,
    )
    if row:
        hours = await conn.fetchval(
            "SELECT EXTRACT(EPOCH FROM (now() - $1::timestamptz))/3600",
            row["opened_at"],
        )
        if hours and hours >= 14:
            await conn.execute(
                "UPDATE turns SET closed_at = now(), "
                "sales_total = COALESCE((SELECT SUM(total) FROM sales WHERE turn_id = $1 AND business_id = $2), 0), "
                "notes = 'Cierre automatico > 14hs' WHERE id = $1",
                row["id"], b_id,
            )
        else:
            return {"turn_id": row["id"], "turn_auto_opened": False, "turn_opened_at": str(row["opened_at"])}
    new_row = await conn.fetchrow(
        "INSERT INTO turns (business_id, operator) VALUES ($1, $2) RETURNING id, opened_at",
        b_id, operator,
    )
    return {"turn_id": new_row["id"], "turn_auto_opened": True, "turn_opened_at": str(new_row["opened_at"])}


async def _ensure_open_turn(operator: str) -> dict:
    async with aiosqlite.connect(main.DB_PATH) as db:
        async with db.execute(
            "SELECT id, opened_at FROM turns WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1"
        ) as cur:
            row = await cur.fetchone()
            if row:
                async with db.execute(
                    "SELECT (julianday('now','localtime') - julianday(?)) * 24.0", (row[1],)
                ) as cur2:
                    diff = await cur2.fetchone()
                if diff and diff[0] >= 14:
                    await db.execute(
                        "UPDATE turns SET closed_at = datetime('now','localtime'), "
                        "sales_total = COALESCE((SELECT SUM(total) FROM sales WHERE turn_id = ?), 0), "
                        "notes = 'Cierre automatico > 14hs' WHERE id = ?",
                        (row[0], row[0]),
                    )
                    await db.commit()
                else:
                    return {"turn_id": row[0], "turn_auto_opened": False, "turn_opened_at": row[1]}
        cur = await db.execute(
            "INSERT INTO turns (operator, opened_at) VALUES (?, datetime('now','localtime'))", (operator,)
        )
        await db.commit()
        return {
            "turn_id": cur.lastrowid,
            "turn_auto_opened": True,
            "turn_opened_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }


# ── Login por PIN ─────────────────────────────────────────────

@router.post("/api/login", summary="Validar PIN de operador")
@limiter.limit("5/minute")
async def login(request: Request, data: dict) -> dict:
    pin = str(data.get("pin", ""))
    if not pin.isdigit() or len(pin) != 4:
        raise HTTPException(status_code=400, detail="El PIN debe tener exactamente 4 digitos numericos")

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            rows = await conn.fetch("SELECT id, name, pin, role FROM operators WHERE business_id = $1", b_id)
            for row in rows:
                try:
                    if bcrypt.checkpw(pin.encode(), row["pin"].encode()):
                        t = await _ensure_open_turn_pg(conn, row["name"], b_id)
                        return {**_base_op(row), **t}
                except Exception:
                    if not row["pin"].startswith("$2b$") and pin == row["pin"]:
                        t = await _ensure_open_turn_pg(conn, row["name"], b_id)
                        return {**_base_op(row), **t}
        raise HTTPException(status_code=401, detail="PIN incorrecto")
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            async with db.execute("SELECT id, name, pin, role FROM operators") as cur:
                rows = await cur.fetchall()
        for op_id, op_name, op_pin_hash, op_role in rows:
            try:
                if bcrypt.checkpw(pin.encode(), op_pin_hash.encode()):
                    t = await _ensure_open_turn(op_name)
                    return {"operator_id": op_id, "id": op_id, "name": op_name, "role": op_role, **t}
            except Exception:
                if not op_pin_hash.startswith("$2b$") and pin == op_pin_hash:
                    t = await _ensure_open_turn(op_name)
                    return {"operator_id": op_id, "id": op_id, "name": op_name, "role": op_role, **t}
        raise HTTPException(status_code=401, detail="PIN incorrecto")


def _base_op(row) -> dict:
    return {"operator_id": row["id"], "id": row["id"], "name": row["name"], "role": row["role"]}


# ── CRUD Operadores ───────────────────────────────────────────

@router.get("/api/operators", summary="Listar operadores")
async def list_operators() -> list:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, name, role FROM operators WHERE business_id = $1 ORDER BY name",
                business_id_ctx.get(),
            )
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            async with db.execute("SELECT id, name, role FROM operators") as cur:
                rows = await cur.fetchall()
                return [_row_to_dict(r, cur.description) for r in rows]


@router.put("/api/operators", summary="Reemplazar todos los operadores")
async def update_operators(request: Request, data: list[dict]) -> dict:
    if USE_PG:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            biz = await get_current_business(auth)
            if biz:
                plan = biz.get("plan", "trial")
                max_ops = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])["max_operators"]
                if max_ops and len(data) > max_ops:
                    raise HTTPException(402, detail=f"Limite de {max_ops} operadores (plan {plan}). Recibidos {len(data)}. Actualiza tu plan.")
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            await conn.execute("DELETE FROM operators WHERE business_id = $1", b_id)
            for op in data:
                pin_to_store = _hash_pin(op.get("pin", ""))
                await conn.execute(
                    "INSERT INTO operators (business_id, name, pin, role) VALUES ($1,$2,$3,$4)",
                    b_id, op.get("name", ""), pin_to_store, op.get("role", "employee"),
                )
        return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("DELETE FROM operators")
            for op in data:
                pin_to_store = _hash_pin(op.get("pin", ""))
                await db.execute(
                    "INSERT INTO operators (name, pin, role) VALUES (?,?,?)",
                    (op.get("name", ""), pin_to_store, op.get("role", "employee")),
                )
            await db.commit()
        return {"success": True}


@router.post("/api/operators", summary="Crear operador individual")
@limiter.limit("10/minute")
async def create_operator(request: Request, data: dict) -> dict:
    name = str(data.get("name", "")).strip()
    pin  = str(data.get("pin", ""))
    role = str(data.get("role", "employee"))
    if not name:
        raise HTTPException(400, detail="Nombre requerido")
    if not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
        raise HTTPException(400, detail="PIN 4-6 digitos")
    if role not in ("admin", "manager", "employee", "cashier"):
        raise HTTPException(400, detail="Rol invalido")

    if USE_PG:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            biz = await get_current_business(auth)
            if biz:
                plan    = biz.get("plan", "trial")
                max_ops = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])["max_operators"]
                if max_ops:
                    from db_helpers import get_pg_pool
                    pool = await get_pg_pool()
                    async with pool.acquire() as conn:
                        count = await conn.fetchval(
                            "SELECT COUNT(*) FROM operators WHERE business_id = $1", biz["sub"]
                        )
                        if count >= max_ops:
                            raise HTTPException(
                                402, detail=f"Limite de {max_ops} operadores alcanzado (plan {plan}). Actualiza tu plan."
                            )
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            row = await conn.fetchrow(
                "INSERT INTO operators (business_id, name, pin, role) VALUES ($1,$2,$3,$4) RETURNING id",
                b_id, name, _hash_pin(pin), role,
            )
            return {"id": row["id"], "name": name, "role": role}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "INSERT INTO operators (name, pin, role) VALUES (?,?,?)", (name, _hash_pin(pin), role)
            )
            await db.commit()
            return {"id": cur.lastrowid, "name": name, "role": role}


@router.patch("/api/operators/{operator_id}", summary="Actualizar operador")
async def patch_operator(operator_id: int, data: dict) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            if not await conn.fetchrow(
                "SELECT id FROM operators WHERE id = $1 AND business_id = $2", operator_id, b_id
            ):
                raise HTTPException(404, detail="Operador no encontrado")
            updates, params, n = [], [], 1
            if "name" in data:
                updates.append(f"name = ${n}"); params.append(str(data["name"]).strip()); n += 1
            if "pin" in data:
                p = str(data["pin"])
                if not p.isdigit() or len(p) < 4 or len(p) > 6:
                    raise HTTPException(400, detail="PIN 4-6 digitos")
                updates.append(f"pin = ${n}"); params.append(_hash_pin(p)); n += 1
            if "role" in data:
                r = str(data["role"])
                if r not in ("admin", "manager", "employee", "cashier"):
                    raise HTTPException(400, detail="Rol invalido")
                updates.append(f"role = ${n}"); params.append(r); n += 1
            if not updates:
                return {"message": "Sin cambios"}
            params.append(operator_id)
            await conn.execute(f"UPDATE operators SET {', '.join(updates)} WHERE id = ${n}", *params)
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT id FROM operators WHERE id = ?", (operator_id,))
            if not await cur.fetchone():
                raise HTTPException(404, detail="Operador no encontrado")
            updates, params = [], []
            if "name" in data:
                updates.append("name = ?"); params.append(str(data["name"]).strip())
            if "pin" in data:
                p = str(data["pin"])
                if not p.isdigit() or len(p) < 4 or len(p) > 6:
                    raise HTTPException(400, detail="PIN 4-6 digitos")
                updates.append("pin = ?"); params.append(_hash_pin(p))
            if "role" in data:
                r = str(data["role"])
                if r not in ("admin", "manager", "employee", "cashier"):
                    raise HTTPException(400, detail="Rol invalido")
                updates.append("role = ?"); params.append(r)
            if not updates:
                return {"message": "Sin cambios"}
            params.append(operator_id)
            await db.execute(f"UPDATE operators SET {', '.join(updates)} WHERE id = ?", tuple(params))
            await db.commit()
            return {"success": True}


@router.delete("/api/operators/{operator_id}", summary="Eliminar operador")
async def delete_operator(operator_id: int) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM operators WHERE id = $1 AND business_id = $2",
                operator_id, business_id_ctx.get(),
            )
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Operador no encontrado")
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT id FROM operators WHERE id = ?", (operator_id,))
            if not await cur.fetchone():
                raise HTTPException(status_code=404, detail="Operador no encontrado")
            await db.execute("DELETE FROM operators WHERE id = ?", (operator_id,))
            await db.commit()
        return {"success": True}


# ── Utilidad interna ──────────────────────────────────────────

def _hash_pin(plain: str) -> str:
    """Devuelve hash bcrypt si el PIN no está ya hasheado."""
    if plain and not plain.startswith("$2b$"):
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()
    return plain

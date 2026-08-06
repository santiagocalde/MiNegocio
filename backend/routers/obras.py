"""
Módulo de Obras — Rubro Corralón.
Agrupa presupuestos y remitos bajo un proyecto de construcción.
"""

from fastapi import APIRouter, HTTPException, Query, Body, Request
from datetime import datetime, timezone
from typing import Optional
from core.ratelimit import limiter

router = APIRouter()


def _biz_id():
    import main
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


def _now():
    return datetime.now(timezone.utc)


@router.get("/api/obras", summary="Listar obras")
@limiter.limit("30/minute")
async def list_obras(request: Request, status: Optional[str] = Query(None)) -> list:
    from main import USE_PG, row_to_dict
    import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            where = ["business_id = $1"]
            params = [b_id]; n = 2
            if status:
                where.append(f"status = ${n}"); params.append(status); n += 1
            rows = await conn.fetch(f"SELECT * FROM obras WHERE {' AND '.join(where)} ORDER BY created_at DESC", *params)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            clauses = []; params = []
            if status:
                clauses.append("status = ?"); params.append(status)
            w = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            cur = await db.execute(f"SELECT * FROM obras {w} ORDER BY created_at DESC", tuple(params))
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]


@router.post("/api/obras", summary="Crear obra")
@limiter.limit("30/minute")
async def create_obra(request: Request, body: dict = Body(...)) -> dict:
    from main import USE_PG
    import main
    b_id = _biz_id()
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, detail="El nombre de la obra es obligatorio")
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO obras (business_id, name, customer_id, address, status, created_at)
                VALUES ($1,$2,$3,$4,'activa',$5) RETURNING id
            """, b_id, name, body.get("customer_id"), body.get("address", ""), _now())
            await conn.execute("INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                b_id, "obra_created", body.get("operator", "Sistema"), f"Obra '{name}' creada")
            return {"id": row["id"], "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("""
                INSERT INTO obras (name, customer_id, address, status, created_at)
                VALUES (?,?,?,'activa',?)
            """, (name, body.get("customer_id"), body.get("address", ""), _now()))
            await db.commit()
            return {"id": cur.lastrowid, "success": True}


@router.post("/api/obras/{obra_id}/update", summary="Actualizar obra")
@limiter.limit("30/minute")
async def update_obra(request: Request, obra_id: int, body: dict = Body(...)) -> dict:
    from main import USE_PG
    import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE obras SET name = COALESCE($1, name), address = COALESCE($2, address), status = COALESCE($3, status) WHERE id = $4 AND business_id = $5",
                body.get("name"), body.get("address"), body.get("status"), obra_id, b_id
            )
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("UPDATE obras SET name = COALESCE(?, name) WHERE id = ?", (body.get("name"), obra_id))
            await db.commit()
            return {"success": True}

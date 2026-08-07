"""
Módulo de Remitos y Logística — Rubro Corralón.
El remito viaja en el camión. Stock se descuenta al confirmar entrega, no al crear.
"""

from fastapi import APIRouter, HTTPException, Query, Body, Request
from datetime import datetime, timezone, date
from typing import Optional
from core.ratelimit import limiter

router = APIRouter()


def _biz_id():
    import main
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


def _now():
    return datetime.now(timezone.utc)


# ── LIST ──────────────────────────────────────────────────────

@router.get("/api/remitos", summary="Listar remitos")
@limiter.limit("30/minute")
async def list_remitos(request: Request, status: Optional[str] = Query(None), fecha: Optional[str] = Query(None), limit: int = Query(200)) -> list:
    from main import USE_PG, row_to_dict
    import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            where = ["r.business_id = $1"]
            params = [b_id]; n = 2
            if status:
                where.append(f"r.status = ${n}"); params.append(status); n += 1
            if fecha:
                from datetime import date as _date
                where.append(f"r.scheduled_date::date = ${n}"); params.append(_date.fromisoformat(fecha)); n += 1
            rows = await conn.fetch(f"""
                SELECT r.*, c.name as customer_name
                FROM remitos r LEFT JOIN customers c ON c.id = r.customer_id
                WHERE {' AND '.join(where)} ORDER BY r.created_at DESC LIMIT ${n}
            """, *params, limit)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            clauses = []; params_sql = []
            if status: clauses.append("r.status = ?"); params_sql.append(status)
            if fecha: clauses.append("date(r.scheduled_date) = ?"); params_sql.append(fecha)
            w = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            cur = await db.execute(f"""
                SELECT r.*, c.name as customer_name
                FROM remitos r LEFT JOIN customers c ON c.id = r.customer_id
                {w} ORDER BY r.created_at DESC LIMIT ?
            """, tuple(params_sql) + (limit,))
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]


# ── CREATE ────────────────────────────────────────────────────

@router.post("/api/remitos", summary="Crear remito")
@limiter.limit("30/minute")
async def create_remito(request: Request, body: dict = Body(...)) -> dict:
    from main import USE_PG
    import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("""
                    INSERT INTO remitos (business_id, quote_id, customer_id, address, driver, scheduled_date, status, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id
                """, b_id, body.get("quote_id"), body.get("customer_id"),
                    body.get("address", ""), body.get("driver", ""),
                    date.fromisoformat(body.get("scheduled_date", str(_now().date())[:10])), _now())
                rid = row["id"]
                for it in body.get("items", []):
                    await conn.execute("""
                        INSERT INTO remito_items (remito_id, product_id, quantity, unit_price)
                        VALUES ($1,$2,$3,$4)
                    """, rid, it.get("product_id"), it.get("quantity", 1), it.get("unit_price", 0))
                await conn.execute("INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "remito_created", body.get("operator", "Sistema"), f"Remito #{rid} creado")
            return {"id": rid, "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            cur = await db.execute("""
                INSERT INTO remitos (quote_id, customer_id, address, driver, scheduled_date, status, created_at)
                VALUES (?,?,?,?,?,?,'pending',?)
            """, (body.get("quote_id"), body.get("customer_id"), body.get("address", ""),
                  body.get("driver", ""), body.get("scheduled_date", str(_now().date())), _now()))
            rid = cur.lastrowid
            for it in body.get("items", []):
                await db.execute("INSERT INTO remito_items (remito_id, product_id, quantity, unit_price) VALUES (?,?,?,?)",
                    (rid, it.get("product_id"), it.get("quantity", 1), it.get("unit_price", 0)))
            await db.commit()
        return {"id": rid, "success": True}


# ── UPDATE STATUS / DELIVER ───────────────────────────────────

@router.post("/api/remitos/{remito_id}/status", summary="Cambiar estado de remito")
@limiter.limit("30/minute")
async def update_remito_status(request: Request, remito_id: int, body: dict = Body(...)) -> dict:
    from main import USE_PG
    import main
    b_id = _biz_id()
    new_status = body.get("status")
    VALID_STATUSES = {"pending", "en_camino", "delivered", "failed", "postponed", "cancelled"}
    if new_status not in VALID_STATUSES:
        raise HTTPException(400, detail="Estado inválido")

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "UPDATE remitos SET status = $1 WHERE id = $2 AND business_id = $3",
                    new_status, remito_id, b_id
                )
                await conn.execute("INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "remito_status", body.get("operator", "Sistema"), f"Remito #{remito_id} → {new_status}")
                # Descontar stock al confirmar entrega
                if new_status == "delivered":
                    items = await conn.fetch("SELECT * FROM remito_items WHERE remito_id = $1", remito_id)
                    for it in items:
                        await conn.execute(
                            "UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2 AND business_id = $3",
                            it["quantity"], it["product_id"], b_id
                        )
                return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("UPDATE remitos SET status = ? WHERE id = ?", (new_status, remito_id))
            if new_status == "delivered":
                items = await db.execute("SELECT * FROM remito_items WHERE remito_id = ?", (remito_id,))
                async for it in items:
                    await db.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (it["quantity"], it["product_id"]))
            await db.commit()
        return {"success": True}


# ── DETAIL ────────────────────────────────────────────────────

@router.get("/api/remitos/{remito_id}", summary="Detalle de remito")
@limiter.limit("30/minute")
async def get_remito(request: Request, remito_id: int) -> dict:
    from main import USE_PG, row_to_dict
    import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            r = await conn.fetchrow("SELECT * FROM remitos WHERE id = $1 AND business_id = $2", remito_id, b_id)
            if not r: raise HTTPException(404, "Remito no encontrado")
            items = await conn.fetch("SELECT ri.*, p.name as product_name FROM remito_items ri JOIN products p ON p.id = ri.product_id WHERE ri.remito_id = $1", remito_id)
            return {"remito": dict(r), "items": [dict(i) for i in items]}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM remitos WHERE id = ?", (remito_id,))
            r = await cur.fetchone()
            if not r: raise HTTPException(404, "Remito no encontrado")
            cur2 = await db.execute("SELECT ri.*, p.name as product_name FROM remito_items ri JOIN products p ON p.id = ri.product_id WHERE ri.remito_id = ?", (remito_id,))
            items = [row_to_dict(it, cur2.description) for it in await cur2.fetchall()]
            return {"remito": row_to_dict(r, cur.description), "items": items}

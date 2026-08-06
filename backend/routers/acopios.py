"""Acopios — material pagado no retirado (Corralón V2)."""
from fastapi import APIRouter, HTTPException, Query, Body, Request
from datetime import datetime, timezone
from typing import Optional
from core.ratelimit import limiter

router = APIRouter()

def _biz_id():
    import main
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None

def _now(): return datetime.now(timezone.utc)

@router.get("/api/acopios", summary="Listar acopios")
@limiter.limit("30/minute")
async def list_acopios(request: Request, status: Optional[str] = Query(None)) -> list:
    from main import USE_PG, row_to_dict; import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            w = ["a.business_id = $1"]; p = [b_id]; n = 2
            if status: w.append(f"a.status = ${n}"); p.append(status); n += 1
            rows = await conn.fetch(f"SELECT a.*, c.name as customer_name FROM acopios a LEFT JOIN customers c ON c.id = a.customer_id WHERE {' AND '.join(w)} ORDER BY a.created_at DESC", *p)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            clauses = []; params = []
            if status: clauses.append("a.status = ?"); params.append(status)
            w = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            cur = await db.execute(f"SELECT a.*, c.name as customer_name FROM acopios a LEFT JOIN customers c ON c.id = a.customer_id {w} ORDER BY a.created_at DESC", tuple(params))
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]

@router.get("/api/acopios/{acopio_id}", summary="Detalle de acopio")
@limiter.limit("30/minute")
async def get_acopio(request: Request, acopio_id: int) -> dict:
    from main import USE_PG, row_to_dict; import main
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            a = await conn.fetchrow("SELECT *, (SELECT name FROM customers WHERE id = a.customer_id) as customer_name FROM acopios a WHERE id = $1", acopio_id)
            if not a: raise HTTPException(404)
            items = await conn.fetch("SELECT ai.*, p.name as product_name FROM acopio_items ai JOIN products p ON p.id = ai.product_id WHERE ai.acopio_id = $1", acopio_id)
            wdraws = await conn.fetch("SELECT aw.*, (SELECT COUNT(*) FROM acopio_withdrawal_items WHERE withdrawal_id = aw.id) as item_count FROM acopio_withdrawals aw WHERE aw.acopio_id = $1 ORDER BY aw.created_at DESC", acopio_id)
            return {"acopio": dict(a), "items": [dict(i) for i in items], "withdrawals": [dict(w) for w in wdraws]}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            a = await db.execute("SELECT *, (SELECT name FROM customers WHERE id = a.customer_id) as customer_name FROM acopios a WHERE id = ?", (acopio_id,)); a = await a.fetchone()
            if not a: raise HTTPException(404)
            items = await db.execute("SELECT ai.*, p.name as product_name FROM acopio_items ai JOIN products p ON p.id = ai.product_id WHERE ai.acopio_id = ?", (acopio_id,))
            items = [row_to_dict(r, items.description) for r in await items.fetchall()]
            wdraws = await db.execute("SELECT aw.*, (SELECT COUNT(*) FROM acopio_withdrawal_items WHERE withdrawal_id = aw.id) as item_count FROM acopio_withdrawals aw WHERE aw.acopio_id = ? ORDER BY aw.created_at DESC", (acopio_id,))
            return {"acopio": row_to_dict(a, a.description), "items": items, "withdrawals": [row_to_dict(w, wdraws.description) for w in await wdraws.fetchall()]}

@router.post("/api/acopios", summary="Crear acopio")
@limiter.limit("30/minute")
async def create_acopio(request: Request, body: dict = Body(...)) -> dict:
    from main import USE_PG; import main; b_id = _biz_id()
    items = body.get("items", [])
    if not items: raise HTTPException(400, detail="Items requeridos")
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                r = await conn.fetchrow("INSERT INTO acopios (business_id, customer_id, obra_id, status) VALUES ($1,$2,$3,'active') RETURNING id", b_id, body.get("customer_id"), body.get("obra_id"))
                aid = r["id"]
                for it in items:
                    await conn.execute("INSERT INTO acopio_items (acopio_id, product_id, quantity_total, quantity_retirada, unit_price) VALUES ($1,$2,$3,0,$4)", aid, it["product_id"], it["quantity"], it.get("unit_price", 0))
                    await conn.execute("UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2 AND business_id = $3", it["quantity"], it["product_id"], b_id)
                await conn.execute("INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "acopio_created", body.get("operator", "Sistema"), f"Acopio #{aid} creado")
            return {"id": aid, "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            c = await db.execute("INSERT INTO acopios (customer_id, obra_id, status) VALUES (?,?,'active')", (body.get("customer_id"), body.get("obra_id")))
            aid = c.lastrowid
            for it in items:
                await db.execute("INSERT INTO acopio_items (acopio_id, product_id, quantity_total, quantity_retirada, unit_price) VALUES (?,?,?,0,?)", (aid, it["product_id"], it["quantity"], it.get("unit_price", 0)))
                await db.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (it["quantity"], it["product_id"]))
            await db.commit()
        return {"id": aid, "success": True}

@router.post("/api/acopios/{acopio_id}/withdrawals", summary="Registrar retiro parcial")
@limiter.limit("30/minute")
async def create_withdrawal(request: Request, acopio_id: int, body: dict = Body(...)) -> dict:
    from main import USE_PG, row_to_dict; import main; b_id = _biz_id()
    items = body.get("items", [])
    if not items: raise HTTPException(400)
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                r = await conn.fetchrow("INSERT INTO acopio_withdrawals (acopio_id, driver, notes) VALUES ($1,$2,$3) RETURNING id", acopio_id, body.get("driver", ""), body.get("notes", ""))
                wid = r["id"]
                for it in items:
                    await conn.execute("UPDATE acopio_items SET quantity_retirada = quantity_retirada + $1 WHERE id = $2 AND acopio_id = $3 AND quantity_total - quantity_retirada >= $1", it["quantity"], it["acopio_item_id"], acopio_id)
                    await conn.execute("INSERT INTO acopio_withdrawal_items (withdrawal_id, acopio_item_id, quantity) VALUES ($1,$2,$3)", wid, it["acopio_item_id"], it["quantity"])
                # Check if all items are fully withdrawn
                remaining = await conn.fetchval("SELECT COUNT(*) FROM acopio_items WHERE acopio_id = $1 AND quantity_retirada < quantity_total", acopio_id)
                if remaining == 0:
                    await conn.execute("UPDATE acopios SET status = 'completed', completed_at = $1 WHERE id = $2", _now(), acopio_id)
                await conn.execute("INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "acopio_withdrawal", body.get("operator", "Sistema"), f"Retiro parcial acopio #{acopio_id}")
            return {"id": wid, "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            c = await db.execute("INSERT INTO acopio_withdrawals (acopio_id, driver, notes) VALUES (?,?,?)", (acopio_id, body.get("driver", ""), body.get("notes", "")))
            wid = c.lastrowid
            for it in items:
                await db.execute("UPDATE acopio_items SET quantity_retirada = quantity_retirada + ? WHERE id = ? AND acopio_id = ? AND quantity_total - quantity_retirada >= ?", (it["quantity"], it["acopio_item_id"], acopio_id, it["quantity"]))
                await db.execute("INSERT INTO acopio_withdrawal_items (withdrawal_id, acopio_item_id, quantity) VALUES (?,?,?)", (wid, it["acopio_item_id"], it["quantity"]))
            remaining = await db.execute("SELECT COUNT(*) FROM acopio_items WHERE acopio_id = ? AND quantity_retirada < quantity_total", (acopio_id,))
            if (await remaining.fetchone())[0] == 0:
                await db.execute("UPDATE acopios SET status = 'completed', completed_at = ? WHERE id = ?", (_now().isoformat(), acopio_id))
            await db.commit()
        return {"id": wid, "success": True}

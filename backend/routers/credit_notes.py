"""Devoluciones con Nota de Crédito (Corralón V2)."""
from fastapi import APIRouter, HTTPException, Body, Request
from datetime import datetime, timezone
from core.ratelimit import limiter

router = APIRouter()

def _biz_id():
    import main
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None

def _now(): return datetime.now(timezone.utc)

@router.get("/api/credit-notes", summary="Listar notas de crédito")
@limiter.limit("30/minute")
async def list_credit_notes(request: Request) -> list:
    from main import USE_PG, row_to_dict; import main; b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT cn.*, c.name as customer_name FROM credit_notes cn LEFT JOIN customers c ON c.id = cn.customer_id WHERE cn.business_id = $1 ORDER BY cn.created_at DESC LIMIT 200", b_id)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT cn.*, c.name as customer_name FROM credit_notes cn LEFT JOIN customers c ON c.id = cn.customer_id ORDER BY cn.created_at DESC LIMIT 200")
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]

@router.post("/api/credit-notes", summary="Crear nota de crédito (devolución)")
@limiter.limit("30/minute")
async def create_credit_note(request: Request, body: dict = Body(...)) -> dict:
    from main import USE_PG, row_to_dict; import main; b_id = _biz_id()
    items = body.get("items", [])
    if not items: raise HTTPException(400, detail="Items requeridos")
    total = sum((it.get("quantity", 0) or 0) * (it.get("unit_price", 0) or 0) for it in items)
    customer_id = body.get("customer_id")
    reason = body.get("reason", "")
    operator = body.get("operator", "Sistema")

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                r = await conn.fetchrow("INSERT INTO credit_notes (business_id, customer_id, total, reason, operator) VALUES ($1,$2,$3,$4,$5) RETURNING id", b_id, customer_id, round(total, 2), reason, operator)
                nid = r["id"]
                for it in items:
                    await conn.execute("INSERT INTO credit_note_items (credit_note_id, product_id, product_name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)", nid, it.get("product_id"), it.get("product_name", ""), it.get("quantity", 1), it.get("unit_price", 0))
                    # Reintegrar stock
                    await conn.execute("UPDATE products SET stock = stock + $1 WHERE id = $2 AND business_id = $3", it.get("quantity", 1), it.get("product_id"), b_id)
                # Acreditar a cuenta del cliente
                if customer_id:
                    await conn.execute("UPDATE customers SET balance = balance - $1 WHERE id = $2 AND business_id = $3", round(total, 2), customer_id, b_id)
                await conn.execute("INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "credit_note_created", operator, f"Nota de Crédito #{nid} por ${round(total,2)}")
            return {"id": nid, "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            c = await db.execute("INSERT INTO credit_notes (customer_id, total, reason, operator) VALUES (?,?,?,?)", (customer_id, round(total, 2), reason, operator))
            nid = c.lastrowid
            for it in items:
                await db.execute("INSERT INTO credit_note_items (credit_note_id, product_id, product_name, quantity, unit_price) VALUES (?,?,?,?,?)", (nid, it.get("product_id"), it.get("product_name", ""), it.get("quantity", 1), it.get("unit_price", 0)))
                await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (it.get("quantity", 1), it.get("product_id")))
            if customer_id:
                await db.execute("UPDATE customers SET balance = balance - ? WHERE id = ?", (round(total, 2), customer_id))
            await db.commit()
            return {"id": nid, "success": True}

@router.get("/api/credit-notes/{note_id}", summary="Detalle de nota de crédito")
@limiter.limit("30/minute")
async def get_credit_note(request: Request, note_id: int) -> dict:
    from main import USE_PG, row_to_dict; import main
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            cn = await conn.fetchrow("SELECT cn.*, c.name as customer_name FROM credit_notes cn LEFT JOIN customers c ON c.id = cn.customer_id WHERE cn.id = $1", note_id)
            if not cn: raise HTTPException(404)
            items = await conn.fetch("SELECT * FROM credit_note_items WHERE credit_note_id = $1", note_id)
            return {"credit_note": dict(cn), "items": [dict(i) for i in items]}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cn = await db.execute("SELECT cn.*, c.name as customer_name FROM credit_notes cn LEFT JOIN customers c ON c.id = cn.customer_id WHERE cn.id = ?", (note_id,)); cn = await cn.fetchone()
            if not cn: raise HTTPException(404)
            items = await db.execute("SELECT * FROM credit_note_items WHERE credit_note_id = ?", (note_id,))
            return {"credit_note": row_to_dict(cn, cn.description), "items": [row_to_dict(i, items.description) for i in await items.fetchall()]}

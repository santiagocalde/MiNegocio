"""
Módulo de Presupuestos — Rubro Corralón.
Un presupuesto es una venta que aún no se cobró ni entregó.
Puede aprobarse, convertirse en remito, o vencerse.
"""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from core.ratelimit import limiter

router = APIRouter()


def _USE_PG(): from main import USE_PG; return USE_PG


def _biz_id():
    import main
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


def _now():
    return datetime.now(timezone.utc)


# ── LIST ──────────────────────────────────────────────────────

@router.get("/api/quotes", summary="Listar presupuestos")
async def list_quotes(status: Optional[str] = Query(None), limit: int = Query(200)) -> list:
    from main import USE_PG, row_to_dict
    import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            where = ["q.business_id = $1"]
            params = [b_id]
            n = 2
            if status:
                where.append(f"q.status = ${n}")
                params.append(status)
                n += 1
            rows = await conn.fetch(f"""
                SELECT q.*, c.name as customer_name
                FROM quotes q LEFT JOIN customers c ON c.id = q.customer_id
                WHERE {' AND '.join(where)}
                ORDER BY q.created_at DESC LIMIT ${n}
            """, *params, limit)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            clauses = []
            params = []
            if status:
                clauses.append("q.status = ?")
                params.append(status)
            where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            cur = await db.execute(f"""
                SELECT q.*, c.name as customer_name
                FROM quotes q LEFT JOIN customers c ON c.id = q.customer_id
                {where} ORDER BY q.created_at DESC LIMIT ?
            """, tuple(params) + (limit,))
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]


# ── DETAIL ────────────────────────────────────────────────────

@router.get("/api/quotes/{quote_id}", summary="Detalle de presupuesto")
async def get_quote(quote_id: int) -> dict:
    from main import USE_PG, row_to_dict
    import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            q = await conn.fetchrow(
                "SELECT * FROM quotes WHERE id = $1 AND business_id = $2", quote_id, b_id
            )
            if not q:
                raise HTTPException(404, "Presupuesto no encontrado")
            items = await conn.fetch(
                "SELECT qi.*, p.name as product_name, p.code as product_code, p.unit_label FROM quote_items qi JOIN products p ON p.id = qi.product_id WHERE qi.quote_id = $1", quote_id
            )
            return {"quote": dict(q), "items": [dict(i) for i in items]}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM quotes WHERE id = ?", (quote_id,))
            q = await cur.fetchone()
            if not q:
                raise HTTPException(404, "Presupuesto no encontrado")
            cur = await db.execute("SELECT qi.*, p.name as product_name, p.code as product_code, p.unit_label FROM quote_items qi JOIN products p ON p.id = qi.product_id WHERE qi.quote_id = ?", (quote_id,))
            items = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            return {"quote": row_to_dict(q, cur.description), "items": items}


# ── CREATE ────────────────────────────────────────────────────

@router.post("/api/quotes", summary="Crear presupuesto")
async def create_quote(body: dict = Body(...)) -> dict:
    from main import USE_PG, row_to_dict
    import main
    b_id = _biz_id()
    customer_id = body.get("customer_id")
    items = body.get("items", [])
    if not items:
        raise HTTPException(400, detail="El presupuesto debe tener al menos un item")

    valid_days = int(body.get("valid_days", 15))
    expires_at = _now() + timedelta(days=valid_days)

    discount_pct = float(body.get("discount_pct", 0) or 0)
    forma_pago = body.get("forma_pago", "Contado") or "Contado"

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("""
                    INSERT INTO quotes (business_id, customer_id, status, list_type, note, valid_days, created_at, expires_at, discount_pct, forma_pago)
                    VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9) RETURNING id
                """, b_id, customer_id, body.get("list_type", "a"),
                    body.get("note", ""), valid_days, _now(), expires_at, discount_pct, forma_pago)
                qid = row["id"]
                for it in items:
                    await conn.execute("""
                        INSERT INTO quote_items (quote_id, product_id, quantity, unit_price)
                        VALUES ($1,$2,$3,$4)
                    """, qid, it.get("product_id"), it.get("quantity", 1), it.get("unit_price", 0))
                await conn.execute("INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "quote_created", body.get("operator", "Sistema"), f"Presupuesto #{qid} creado")
            return {"id": qid, "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            cur = await db.execute("""
                INSERT INTO quotes (customer_id, status, list_type, note, valid_days, created_at, expires_at, discount_pct, forma_pago)
                VALUES (?,?,'draft',?,?,?,?,?,?)
            """, (customer_id, body.get("list_type", "a"),
                  body.get("note", ""), valid_days, _now(), expires_at, discount_pct, forma_pago))
            qid = cur.lastrowid
            for it in items:
                await db.execute("""
                    INSERT INTO quote_items (quote_id, product_id, quantity, unit_price)
                    VALUES (?,?,?,?)
                """, (qid, it.get("product_id"), it.get("quantity", 1), it.get("unit_price", 0)))
            await db.commit()
        return {"id": qid, "success": True}


# ── UPDATE STATUS ─────────────────────────────────────────────

@router.post("/api/quotes/{quote_id}/status", summary="Cambiar estado de presupuesto")
async def update_quote_status(quote_id: int, body: dict = Body(...)) -> dict:
    from main import USE_PG
    import main
    new_status = body.get("status")
    if new_status not in ("draft", "sent", "approved", "delivered", "expired", "rejected"):
        raise HTTPException(400, detail="Estado inválido")
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE quotes SET status = $1 WHERE id = $2 AND business_id = $3",
                new_status, quote_id, _biz_id()
            )
            await conn.execute("INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                _biz_id(), "quote_status", body.get("operator", "Sistema"), f"Presupuesto #{quote_id} → {new_status}")
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("UPDATE quotes SET status = ? WHERE id = ?", (new_status, quote_id))
            await db.commit()
            return {"success": True}


# ── DELETE ────────────────────────────────────────────────────

@router.delete("/api/quotes/{quote_id}", summary="Eliminar presupuesto")
async def delete_quote(quote_id: int) -> dict:
    from main import USE_PG
    import main
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("DELETE FROM quote_items WHERE quote_id = $1", quote_id)
                await conn.execute("DELETE FROM quotes WHERE id = $1 AND business_id = $2", quote_id, _biz_id())
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("DELETE FROM quote_items WHERE quote_id = ?", (quote_id,))
            await db.execute("DELETE FROM quotes WHERE id = ?", (quote_id,))
            await db.commit()
            return {"success": True}


# ── CONVERTIR PRESUPUESTO → NOTA DE PEDIDO ───────────────────────
@router.post("/api/quotes/{quote_id}/to-remito", summary="Convertir presupuesto aprobado en nota de pedido")
async def quote_to_remito(quote_id: int, body: dict = Body(default={})) -> dict:
    """
    Crea un remito/nota de pedido a partir de un presupuesto aprobado.
    Copia los ítems del presupuesto al remito y cambia el presupuesto a 'delivered'.
    El stock se descuenta cuando el remito se marca como 'delivered', no aquí.
    """
    from main import USE_PG, row_to_dict
    import main
    from datetime import date
    b_id = _biz_id()

    address   = body.get("address", "")
    driver    = body.get("driver", "")
    sched_raw = body.get("scheduled_date", str(_now().date())[:10])

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            quote = await conn.fetchrow(
                "SELECT * FROM quotes WHERE id = $1 AND business_id = $2", quote_id, b_id
            )
            if not quote:
                raise HTTPException(404, "Presupuesto no encontrado")
            if quote["status"] not in ("approved", "sent"):
                raise HTTPException(400, "Solo se pueden convertir presupuestos aprobados o enviados")
            items = await conn.fetch(
                "SELECT * FROM quote_items WHERE quote_id = $1", quote_id
            )
            async with conn.transaction():
                row = await conn.fetchrow("""
                    INSERT INTO remitos (business_id, quote_id, customer_id, address, driver, scheduled_date, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING id
                """, b_id, quote_id, quote["customer_id"],
                    address, driver,
                    date.fromisoformat(sched_raw[:10]), _now())
                remito_id = row["id"]
                for it in items:
                    await conn.execute("""
                        INSERT INTO remito_items (remito_id, product_id, quantity, unit_price)
                        VALUES ($1, $2, $3, $4)
                    """, remito_id, it["product_id"], it["quantity"], it["unit_price"])
                await conn.execute(
                    "UPDATE quotes SET status = 'delivered' WHERE id = $1 AND business_id = $2",
                    quote_id, b_id
                )
                await conn.execute(
                    "INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "quote_to_remito", body.get("operator", "Sistema"),
                    f"Presupuesto #{quote_id} → Nota de pedido #{remito_id}"
                )
            return {"remito_id": remito_id, "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM quotes WHERE id = ?", (quote_id,))
            quote = await cur.fetchone()
            if not quote:
                raise HTTPException(404, "Presupuesto no encontrado")
            q = row_to_dict(quote, cur.description)
            if q["status"] not in ("approved", "sent"):
                raise HTTPException(400, "Solo se pueden convertir presupuestos aprobados o enviados")
            cur2 = await db.execute("SELECT * FROM quote_items WHERE quote_id = ?", (quote_id,))
            items = [row_to_dict(r, cur2.description) for r in await cur2.fetchall()]
            await db.execute("BEGIN IMMEDIATE")
            cur3 = await db.execute("""
                INSERT INTO remitos (quote_id, customer_id, address, driver, scheduled_date, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'pending', ?)
            """, (quote_id, q.get("customer_id"), address,
                  driver, sched_raw[:10], _now()))
            remito_id = cur3.lastrowid
            for it in items:
                await db.execute(
                    "INSERT INTO remito_items (remito_id, product_id, quantity, unit_price) VALUES (?,?,?,?)",
                    (remito_id, it["product_id"], it["quantity"], it["unit_price"])
                )
            await db.execute("UPDATE quotes SET status = 'delivered' WHERE id = ?", (quote_id,))
            await db.commit()
            return {"remito_id": remito_id, "success": True}

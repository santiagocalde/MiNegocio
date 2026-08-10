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

@router.get("/api/acopios/despachos", summary="Despachos (entregas a domicilio, últimos 30 días o por fecha exacta)")
@limiter.limit("30/minute")
async def list_despachos(request: Request, fecha: Optional[str] = Query(None)) -> list:
    """
    Sin fecha → últimos 30 días (para agrupar por fecha en el frontend).
    Con fecha=YYYY-MM-DD → solo ese día.
    Incluye los reprogramados (status='rescheduled') para mostrarlos en gris.
    """
    from main import USE_PG, row_to_dict; import main; b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            if fecha:
                where_date = "aw.created_at::date = $2::date"
                params = [b_id, fecha]
            else:
                where_date = "aw.created_at::date >= (CURRENT_DATE - INTERVAL '30 days')"
                params = [b_id]
            rows = await conn.fetch(f"""
                SELECT
                    aw.id AS withdrawal_id,
                    aw.acopio_id,
                    aw.notes,
                    aw.driver,
                    aw.created_at,
                    COALESCE(aw.status, 'completed') AS status,
                    aw.rescheduled_date,
                    c.name    AS customer_name,
                    c.address AS customer_address,
                    (SELECT string_agg(p.name || ' x' || awi.quantity::text, ', ')
                     FROM acopio_withdrawal_items awi
                     JOIN acopio_items ai ON ai.id = awi.acopio_item_id
                     JOIN products p      ON p.id  = ai.product_id
                     WHERE awi.withdrawal_id = aw.id) AS items_summary
                FROM acopio_withdrawals aw
                JOIN acopios a ON a.id = aw.acopio_id AND a.business_id = $1
                LEFT JOIN customers c ON c.id = a.customer_id
                WHERE {where_date}
                  AND aw.notes ILIKE 'Entrega%%'
                ORDER BY aw.created_at DESC
            """, *params)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            if fecha:
                where_date = "date(aw.created_at) = ?"
                params = (fecha,)
            else:
                where_date = "date(aw.created_at) >= date('now', '-30 days', 'localtime')"
                params = ()
            cur = await db.execute(f"""
                SELECT
                    aw.id AS withdrawal_id,
                    aw.acopio_id,
                    aw.notes,
                    aw.driver,
                    aw.created_at,
                    COALESCE(aw.status, 'completed') AS status,
                    aw.rescheduled_date,
                    c.name    AS customer_name,
                    c.address AS customer_address,
                    (SELECT GROUP_CONCAT(p.name || ' x' || awi.quantity, ', ')
                     FROM acopio_withdrawal_items awi
                     JOIN acopio_items ai ON ai.id = awi.acopio_item_id
                     JOIN products p      ON p.id  = ai.product_id
                     WHERE awi.withdrawal_id = aw.id) AS items_summary
                FROM acopio_withdrawals aw
                JOIN acopios a ON a.id = aw.acopio_id
                LEFT JOIN customers c ON c.id = a.customer_id
                WHERE {where_date}
                  AND aw.notes LIKE 'Entrega%%'
                ORDER BY aw.created_at DESC
            """, params)
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]


@router.get("/api/acopios/{acopio_id}", summary="Detalle de acopio")
@limiter.limit("30/minute")
async def get_acopio(request: Request, acopio_id: int) -> dict:
    from main import USE_PG, row_to_dict; import main
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            a = await conn.fetchrow("SELECT a.*, (SELECT name FROM customers WHERE id = a.customer_id) as customer_name, (SELECT address FROM customers WHERE id = a.customer_id) as customer_address FROM acopios a WHERE id = $1", acopio_id)
            if not a: raise HTTPException(404)
            items = await conn.fetch("SELECT ai.*, p.name as product_name FROM acopio_items ai JOIN products p ON p.id = ai.product_id WHERE ai.acopio_id = $1", acopio_id)
            wdraws = await conn.fetch("SELECT aw.*, (SELECT COUNT(*) FROM acopio_withdrawal_items WHERE withdrawal_id = aw.id) as item_count FROM acopio_withdrawals aw WHERE aw.acopio_id = $1 ORDER BY aw.created_at DESC", acopio_id)
            return {"acopio": dict(a), "items": [dict(i) for i in items], "withdrawals": [dict(w) for w in wdraws]}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur_a = await db.execute("SELECT a.*, (SELECT name FROM customers WHERE id = a.customer_id) as customer_name, (SELECT address FROM customers WHERE id = a.customer_id) as customer_address FROM acopios a WHERE id = ?", (acopio_id,))
            a = await cur_a.fetchone()
            if not a: raise HTTPException(404)
            cur_items = await db.execute("SELECT ai.*, p.name as product_name FROM acopio_items ai JOIN products p ON p.id = ai.product_id WHERE ai.acopio_id = ?", (acopio_id,))
            items = [row_to_dict(r, cur_items.description) for r in await cur_items.fetchall()]
            cur_wdraws = await db.execute("SELECT aw.*, (SELECT COUNT(*) FROM acopio_withdrawal_items WHERE withdrawal_id = aw.id) as item_count FROM acopio_withdrawals aw WHERE aw.acopio_id = ? ORDER BY aw.created_at DESC", (acopio_id,))
            return {"acopio": row_to_dict(a, cur_a.description), "items": items, "withdrawals": [row_to_dict(w, cur_wdraws.description) for w in await cur_wdraws.fetchall()]}

@router.post("/api/acopios/{acopio_id}/cobrar", summary="Registrar cobro de un acopio")
@limiter.limit("20/minute")
async def cobrar_acopio(request: Request, acopio_id: int, body: dict = Body(...)) -> dict:
    """
    Registra el pago de un acopio.
    method: 'efectivo' | 'tarjeta' | 'transferencia' | 'cc'
    Para efectivo/tarjeta/transferencia: payment_status = 'paid'
    Para cc (cuenta corriente): payment_status = 'cc'
    """
    from main import USE_PG, row_to_dict; import main; b_id = _biz_id()
    method = (body.get("method") or "efectivo").lower()
    amount  = float(body.get("amount") or 0)
    operator = body.get("operator", "Sistema")
    payment_status = "cc" if method == "cc" else "paid"

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM acopios WHERE id = $1 AND business_id = $2", acopio_id, b_id
            )
            if not row: raise HTTPException(404)
            await conn.execute(
                """UPDATE acopios
                   SET payment_status = $1, payment_method = $2, paid_amount = $3, paid_at = now()
                   WHERE id = $4 AND business_id = $5""",
                payment_status, method, amount, acopio_id, b_id
            )
            await conn.execute(
                "INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                b_id, "acopio_cobrado", operator,
                f"Acopio #{acopio_id} cobrado via {method} — ${amount:,.2f}"
            )
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT id FROM acopios WHERE id = ?", (acopio_id,))
            if not await cur.fetchone(): raise HTTPException(404)
            await db.execute(
                """UPDATE acopios
                   SET payment_status = ?, payment_method = ?, paid_amount = ?,
                       paid_at = datetime('now','localtime')
                   WHERE id = ?""",
                (payment_status, method, amount, acopio_id)
            )
            await db.execute(
                "INSERT INTO audit_log (action, operator, details) VALUES (?,?,?)",
                ("acopio_cobrado", operator, f"Acopio #{acopio_id} cobrado via {method} — ${amount:,.2f}")
            )
            await db.commit()
    return {"ok": True, "payment_status": payment_status}


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
            await db.execute(
                "INSERT INTO audit_log (action, operator, details) VALUES (?,?,?)",
                ("acopio_created", body.get("operator", "Sistema"), f"Acopio #{aid} creado"),
            )
            await db.commit()
        return {"id": aid, "success": True}

@router.post("/api/acopios/withdrawals/{wid}/reschedule", summary="Reprogramar entrega a otra fecha")
@limiter.limit("20/minute")
async def reschedule_withdrawal(request: Request, wid: int, body: dict = Body(...)) -> dict:
    """Marca una entrega como reprogramada y guarda la nueva fecha propuesta."""
    new_date = body.get("new_date")
    if not new_date:
        raise HTTPException(400, detail="new_date requerido (YYYY-MM-DD)")
    from main import USE_PG; import main; b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(
                """UPDATE acopio_withdrawals aw
                   SET status = 'rescheduled', rescheduled_date = $2
                   FROM acopios a
                   WHERE aw.id = $1 AND aw.acopio_id = a.id AND a.business_id = $3""",
                wid, new_date, b_id
            )
            if result == "UPDATE 0":
                raise HTTPException(404)
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                """UPDATE acopio_withdrawals SET status = 'rescheduled', rescheduled_date = ?
                   WHERE id = ? AND acopio_id IN (SELECT id FROM acopios WHERE id = acopio_id)""",
                (new_date, wid)
            )
            await db.commit()
            if cur.rowcount == 0:
                raise HTTPException(404)
    return {"ok": True}


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
            await db.execute(
                "INSERT INTO audit_log (action, operator, details) VALUES (?,?,?)",
                ("acopio_withdrawal", body.get("operator", "Sistema"), f"Retiro parcial acopio #{acopio_id}"),
            )
            await db.commit()
        return {"id": wid, "success": True}

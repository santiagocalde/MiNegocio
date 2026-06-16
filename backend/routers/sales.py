from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

import main
from main import JWT_SECRET, JWT_ALGORITHM, row_to_dict, logger, TurnOpen, TurnClose, SaleCreate, USE_PG
from event_stream import events

router = APIRouter()


async def _get_db():
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            yield conn
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            yield db


def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


def _sqlite_now():
    return "datetime('now','localtime')"


def _pg_now():
    return "now()"


def _now():
    return _pg_now() if USE_PG else _sqlite_now()


PLACEHOLDER = "$1" if USE_PG else "?"


# ────────────────────────────────────────────────────────────
# TURNS ENDPOINTS
# ────────────────────────────────────────────────────────────
@router.post("/api/turns", status_code=201, summary="Abrir turno")
async def open_turn(body: TurnOpen) -> dict:
    b_id = _biz_id()
    now = _now()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "UPDATE turns SET closed_at = $1, notes = 'Cierre automatico por abandono de caja' WHERE closed_at IS NULL AND business_id = $2",
                    now, b_id
                )
                row = await conn.fetchrow(
                    "INSERT INTO turns (business_id, operator, sucursal_id, initial_cash) VALUES ($1,$2,$3,$4) RETURNING id",
                    b_id, body.operator, body.sucursal_id, body.initial_cash
                )
                return {"id": row["id"], "operator": body.operator}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            await db.execute(
                "UPDATE turns SET closed_at = datetime('now','localtime'), notes = 'Cierre automatico' WHERE closed_at IS NULL AND sucursal_id = ?",
                (body.sucursal_id,)
            )
            cur = await db.execute(
                "INSERT INTO turns (operator, sucursal_id, initial_cash) VALUES (?, ?, ?)",
                (body.operator, body.sucursal_id, body.initial_cash)
            )
            await db.commit()
            return {"id": cur.lastrowid, "operator": body.operator}


@router.get("/api/turns/active", summary="Recuperar turno abierto")
async def get_active_turn() -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, operator, opened_at FROM turns WHERE closed_at IS NULL AND business_id = $1 ORDER BY id DESC LIMIT 1",
                b_id
            )
            if row:
                hours = await conn.fetchval(
                    "SELECT EXTRACT(EPOCH FROM (now() - $1::timestamptz))/3600",
                    row["opened_at"]
                )
                if hours and hours >= 14:
                    await conn.execute(
                        "UPDATE turns SET closed_at = now(), notes = 'Cierre automatico > 14hs' WHERE id = $1",
                        row["id"]
                    )
                    return {"id": None}
                return {"id": row["id"], "operator": row["operator"]}
            return {"id": None}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT id, operator, opened_at FROM turns WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1")
            row = await cur.fetchone()
            if row:
                cur = await db.execute("SELECT (julianday('now','localtime') - julianday(?)) * 24.0", (row[2],))
                diff = await cur.fetchone()
                if diff and diff[0] >= 14:
                    await db.execute("UPDATE turns SET closed_at = datetime('now','localtime'), notes = 'Cierre automatico > 14hs' WHERE id = ?", (row[0],))
                    await db.commit()
                    return {"id": None}
                return {"id": row[0], "operator": row[1]}
            return {"id": None}


@router.patch("/api/turns/{turn_id}/close", summary="Cerrar turno con balance")
async def close_turn(turn_id: int, body: TurnClose) -> dict:
    import bcrypt
    b_id = _biz_id()

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()

        if body.operator_id and body.pin:
            async with pool.acquire() as conn:
                op_row = await conn.fetchrow(
                    "SELECT pin FROM operators WHERE id = $1 AND business_id = $2",
                    body.operator_id, b_id
                )
                if not op_row:
                    raise HTTPException(403, detail="Operador no encontrado")
                if not bcrypt.checkpw(body.pin.encode(), op_row["pin"].encode()):
                    if not (not op_row["pin"].startswith("$2b$") and body.pin == op_row["pin"]):
                        raise HTTPException(403, detail="PIN incorrecto")

        difference = body.counted_cash - body.sales_total
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("SELECT closed_at FROM turns WHERE id = $1 AND business_id = $2", turn_id, b_id)
                if not row:
                    raise HTTPException(404, detail="Turno no encontrado")
                if row["closed_at"] is not None:
                    raise HTTPException(400, detail="Este turno ya esta cerrado")

                await conn.execute(
                    "UPDATE turns SET closed_at = now(), sales_total = $1, counted_cash = $2, difference = $3, notes = $4 WHERE id = $5",
                    body.sales_total, body.counted_cash, difference, body.notes, turn_id
                )
                if difference < 0:
                    await conn.execute(
                        "INSERT INTO egresos_caja (business_id, monto, motivo, type, turn_id) VALUES ($1,$2,$3,$4,$5)",
                        b_id, abs(difference), f"Ajuste por Faltante de Caja (Turno {turn_id})", "gasto", turn_id
                    )
        return {"success": True, "difference": difference, "status": "perfecto" if difference == 0 else ("sobrante" if difference > 0 else "faltante")}
    else:
        import aiosqlite
        if body.operator_id and body.pin:
            async with aiosqlite.connect(main.DB_PATH) as db:
                cur = await db.execute("SELECT pin FROM operators WHERE id = ?", (body.operator_id,))
                op_row = await cur.fetchone()
                if not op_row:
                    raise HTTPException(403, detail="Operador no encontrado")
                if not bcrypt.checkpw(body.pin.encode(), op_row[0].encode()):
                    if not (not op_row[0].startswith("$2b$") and body.pin == op_row[0]):
                        raise HTTPException(403, detail="PIN incorrecto")

        difference = body.counted_cash - body.sales_total
        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                cur = await db.execute("SELECT closed_at FROM turns WHERE id=?", (turn_id,))
                turn = await cur.fetchone()
                if not turn: raise HTTPException(404, detail="Turno no encontrado")
                if turn[0] is not None: raise HTTPException(400, detail="Este turno ya esta cerrado")
                await db.execute(
                    "UPDATE turns SET closed_at=datetime('now','localtime'), sales_total=?, counted_cash=?, difference=?, notes=? WHERE id=?",
                    (body.sales_total, body.counted_cash, difference, body.notes, turn_id)
                )
                if difference < 0:
                    await db.execute(
                        "INSERT INTO egresos_caja (monto, motivo, type, turn_id) VALUES (?,?,?,?)",
                        (abs(difference), f"Ajuste por Faltante de Caja (Turno {turn_id})", "gasto", turn_id)
                    )
                await db.commit()
        return {"success": True, "difference": difference, "status": "perfecto" if difference == 0 else ("sobrante" if difference > 0 else "faltante")}


@router.get("/api/turns", summary="Historial de turnos")
async def list_turns(limit: int = 30) -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM turns WHERE business_id = $1 ORDER BY opened_at DESC LIMIT $2",
                b_id, limit
            )
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM turns ORDER BY opened_at DESC LIMIT ?", (limit,))
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


# ────────────────────────────────────────────────────────────
# SALES ENDPOINTS
# ────────────────────────────────────────────────────────────
@router.post("/api/sales", status_code=201, summary="Registrar venta")
async def create_sale(body: SaleCreate, idempotency_key: Optional[str] = Query(None)) -> dict:
    effective_key = idempotency_key or str(uuid.uuid4())
    b_id = _biz_id()

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                existing = await conn.fetchval(
                    "SELECT id FROM sales WHERE idempotency_key = $1 AND business_id = $2",
                    effective_key, b_id
                )
                if existing:
                    return {"id": existing, "duplicate": True, "message": "Venta ya procesada"}

                if body.turn_id:
                    turn = await conn.fetchrow("SELECT closed_at FROM turns WHERE id = $1", body.turn_id)
                    if turn and turn["closed_at"] is not None:
                        raise HTTPException(400, detail="El turno asociado ya se encuentra cerrado")

                is_split = len(body.payments) > 0
                primary_method = 'split' if is_split else body.payment_method
                primary_payment = round(sum(p.amount for p in body.payments), 2) if is_split else round(body.payment, 2)
                total_sale = round(body.total, 2) if body.total else round(primary_payment, 2)
                change_sale = round(body.change_given, 2)

                row = await conn.fetchrow(
                    """INSERT INTO sales (business_id, turn_id, total, payment, change_given, operator, is_fiado, fiado_name, payment_method, client_cuit, idempotency_key)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id""",
                    b_id, body.turn_id, total_sale, primary_payment, change_sale,
                    body.operator, 1 if body.is_fiado else 0, body.fiado_name,
                    primary_method, body.client_cuit, effective_key
                )
                sale_id = row["id"]
                db_total = 0

                for item in body.items:
                    prod = await conn.fetchrow(
                        "SELECT id, price, stock, is_virtual, parent_id, pack_size FROM products WHERE id = $1 AND business_id = $2",
                        item.product_id, b_id
                    )
                    if not prod:
                        raise HTTPException(404, detail=f"Producto {item.product_name} no encontrado")

                    # Recalcular precio desde DB (no confiar en frontend)
                    db_price = round(prod["price"], 2)
                    db_total += db_price * item.quantity
                    db_name = prod.get("name") or item.product_name

                    await conn.execute(
                        "INSERT INTO sale_items (business_id, sale_id, product_id, product_name, quantity, unit_price, item_discount) VALUES ($1,$2,$3,$4,$5,$6,$7)",
                        b_id, sale_id, item.product_id, item.product_name, item.quantity, db_price, item.item_discount
                    )

                    if prod["is_virtual"] == 1 and prod["parent_id"]:
                        real_qty = item.quantity * (prod["pack_size"] or 1)
                        result = await conn.execute(
                            "UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 AND business_id = $3",
                            real_qty, prod["parent_id"], b_id
                        )
                        if result == "UPDATE 0":
                            raise HTTPException(400, detail=f"Stock insuficiente de {item.product_name} (Pack Virtual)")
                        await conn.execute(
                            "INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, reason, operator, source_id) VALUES ($1,$2,'salida',$3,$4,$5,$6)",
                            b_id, prod["parent_id"], real_qty, f"Venta #{sale_id} (Pack Virtual)", body.operator, f"sale-{sale_id}-{item.product_id}"
                        )
                    else:
                        result = await conn.execute(
                            "UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 AND business_id = $3",
                            item.quantity, item.product_id, b_id
                        )
                        if result == "UPDATE 0":
                            raise HTTPException(400, detail=f"Stock insuficiente de {item.product_name}")
                        await conn.execute(
                            "INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, reason, operator, source_id) VALUES ($1,$2,'salida',$3,$4,$5,$6)",
                            b_id, item.product_id, item.quantity, f"Venta #{sale_id}", body.operator, f"sale-{sale_id}-{item.product_id}"
                        )

                if body.is_fiado and body.fiado_name:
                    cust = await conn.fetchrow("SELECT id FROM customers WHERE name = $1 AND business_id = $2", body.fiado_name, b_id)
                    if not cust:
                        cust_row = await conn.fetchrow(
                            "INSERT INTO customers (business_id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id",
                            b_id, body.fiado_name
                        )
                        if not cust_row:
                            cust_row = await conn.fetchrow("SELECT id FROM customers WHERE name = $1 AND business_id = $2", body.fiado_name, b_id)
                        cust_id = cust_row["id"] if cust_row else None
                    else:
                        cust_id = cust["id"]
                    if cust_id:
                        await conn.execute("UPDATE customers SET balance = balance + $1 WHERE id = $2", total_sale, cust_id)
                        await conn.execute(
                            "INSERT INTO customer_transactions (business_id, customer_id, amount, type, description, turn_id, operator) VALUES ($1,$2,$3,'sale',$4,$5,$6)",
                            b_id, cust_id, total_sale, f"Venta Fiada #{sale_id}", body.turn_id, body.operator
                        )

                await events.emit("sale-created", {"id": sale_id, "business_id": b_id})
                return {"id": sale_id, "ticket": sale_id}

    else:
        import aiosqlite
        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                existing = await db.execute("SELECT id FROM sales WHERE idempotency_key = ?", (effective_key,))
                if await existing.fetchone():
                    await db.commit()
                    return {"id": None, "duplicate": True, "message": "Venta ya procesada"}

                if body.turn_id:
                    cur_t = await db.execute("SELECT closed_at FROM turns WHERE id=?", (body.turn_id,))
                    t = await cur_t.fetchone()
                    if t and t[0] is not None:
                        raise HTTPException(400, detail="El turno asociado ya se encuentra cerrado")

                is_split = len(body.payments) > 0
                primary_method = 'split' if is_split else body.payment_method
                primary_payment = round(sum(p.amount for p in body.payments), 2) if is_split else round(body.payment, 2)
                total_sale = round(body.total, 2)
                change_sale = round(body.change_given, 2)

            cur = await db.execute(
                "INSERT INTO sales (turn_id,total,payment,change_given,operator,is_fiado,fiado_name,payment_method,client_cuit,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (body.turn_id, total_sale, primary_payment, change_sale, body.operator,
                 1 if body.is_fiado else 0, body.fiado_name, primary_method, body.client_cuit, effective_key)
            )
            sale_id = cur.lastrowid
            db_total_sql = 0

            for item in body.items:
                p_cur = await db.execute(
                    "SELECT id, price, stock, is_virtual, parent_id, pack_size FROM products WHERE id = ?",
                    (item.product_id,)
                )
                prod = await p_cur.fetchone()
                if not prod:
                    raise HTTPException(404, detail=f"Producto {item.product_name} no encontrado")

                db_price = round(prod[1], 2)
                db_total_sql += db_price * item.quantity

                await db.execute(
                    "INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,item_discount) VALUES (?,?,?,?,?,?)",
                    (sale_id, item.product_id, item.product_name, item.quantity, item.unit_price, item.item_discount)
                )

                p_stock, p_is_virtual, p_parent_id, p_pack_size = prod
                if p_is_virtual == 1 and p_parent_id:
                    real_qty = item.quantity * (p_pack_size or 1)
                    result = await db.execute(
                        "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
                        (real_qty, p_parent_id, real_qty)
                    )
                    if result.rowcount == 0:
                        raise HTTPException(400, detail=f"Stock insuficiente de {item.product_name} (Pack Virtual)")
                    await db.execute(
                        "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                        (p_parent_id, "salida", real_qty, f"Venta #{sale_id} (Pack Virtual)", body.operator)
                    )
                else:
                    result = await db.execute(
                        "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
                        (item.quantity, item.product_id, item.quantity)
                    )
                    if result.rowcount == 0:
                        raise HTTPException(400, detail=f"Stock insuficiente de {item.product_name}")
                    await db.execute(
                        "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                        (item.product_id, "salida", item.quantity, f"Venta #{sale_id}", body.operator)
                    )

                if body.is_fiado and body.fiado_name:
                    cur_c = await db.execute("SELECT id FROM customers WHERE name = ?", (body.fiado_name,))
                    c_row = await cur_c.fetchone()
                    if not c_row:
                        await db.execute("INSERT INTO customers (name) VALUES (?)", (body.fiado_name,))
                        cust_id = db.last_insert_rowid
                    else:
                        cust_id = c_row[0]
                    await db.execute("UPDATE customers SET balance = balance + ? WHERE id = ?", (total_sale, cust_id))
                    await db.execute(
                        "INSERT INTO customer_transactions (customer_id, amount, type, description, turn_id, operator) VALUES (?,?,?,?,?,?)",
                        (cust_id, total_sale, 'sale', f"Venta Fiada #{sale_id}", body.turn_id, body.operator)
                    )

                await db.commit()
                await events.emit("sale-created", {"id": sale_id})
                return {"id": sale_id, "ticket": sale_id}


@router.get("/api/sales/today", summary="Resumen de ventas del dia")
async def today_sales(sucursal_id: Optional[int] = Query(None)) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            if sucursal_id:
                row = await conn.fetchrow("""
                    SELECT COUNT(*) as total_tickets, COALESCE(SUM(total),0) as total_vendido,
                           COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) as total_fiado,
                           COALESCE(SUM(CASE WHEN payment_method='efectivo' AND is_fiado=0 THEN total ELSE 0 END),0) as total_efectivo,
                           COALESCE(SUM(CASE WHEN payment_method='mercadopago' THEN total ELSE 0 END),0) as total_mp
                    FROM sales WHERE business_id = $1 AND date(timestamp)=current_date AND (sucursal_id=$2 OR sucursal_id IS NULL)
                """, b_id, sucursal_id)
            else:
                row = await conn.fetchrow("""
                    SELECT COUNT(*) as total_tickets, COALESCE(SUM(total),0) as total_vendido,
                           COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) as total_fiado,
                           COALESCE(SUM(CASE WHEN payment_method='efectivo' AND is_fiado=0 THEN total ELSE 0 END),0) as total_efectivo,
                           COALESCE(SUM(CASE WHEN payment_method='tarjeta' THEN total ELSE 0 END),0) as total_tarjeta,
                           COALESCE(SUM(CASE WHEN payment_method='transferencia' THEN total ELSE 0 END),0) as total_transferencia,
                           COALESCE(SUM(CASE WHEN payment_method='mercadopago' THEN total ELSE 0 END),0) as total_mp
                    FROM sales WHERE business_id = $1 AND date(timestamp)=current_date
                """, b_id)
            return dict(row) if row else {"total_tickets": 0, "total_vendido": 0, "total_fiado": 0, "total_efectivo": 0, "total_tarjeta": 0, "total_transferencia": 0, "total_mp": 0}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            if sucursal_id:
                cur = await db.execute("""
                    SELECT COUNT(*) as total_tickets, COALESCE(SUM(total),0) as total_vendido,
                           COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) as total_fiado,
                           COALESCE(SUM(CASE WHEN payment_method='efectivo' AND is_fiado=0 THEN total ELSE 0 END),0) as total_efectivo,
                           COALESCE(SUM(CASE WHEN payment_method='mercadopago' THEN total ELSE 0 END),0) as total_mp
                    FROM sales WHERE date(timestamp)=date('now','localtime') AND (sucursal_id IS NULL OR sucursal_id = ?)
                """, (sucursal_id,))
            else:
                cur = await db.execute("""
                    SELECT COUNT(*) as total_tickets, COALESCE(SUM(total),0) as total_vendido,
                           COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) as total_fiado,
                           COALESCE(SUM(CASE WHEN payment_method='efectivo' AND is_fiado=0 THEN total ELSE 0 END),0) as total_efectivo,
                           COALESCE(SUM(CASE WHEN payment_method='tarjeta' THEN total ELSE 0 END),0) as total_tarjeta,
                           COALESCE(SUM(CASE WHEN payment_method='transferencia' THEN total ELSE 0 END),0) as total_transferencia,
                           COALESCE(SUM(CASE WHEN payment_method='mercadopago' THEN total ELSE 0 END),0) as total_mp
                    FROM sales WHERE date(timestamp)=date('now','localtime')
                """)
            row = await cur.fetchone()
            return row_to_dict(row, cur.description)


@router.get("/api/sales", summary="Listar ventas con filtros")
async def list_sales(limit: int = Query(50), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), sucursal_id: Optional[int] = Query(None)) -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        params = [b_id]
        clauses = ["s.business_id = $1"]
        n = 2
        if date_from: clauses.append(f"date(s.timestamp) >= ${n}::date"); params.append(date_from); n += 1
        if date_to: clauses.append(f"date(s.timestamp) <= ${n}::date"); params.append(date_to); n += 1
        if sucursal_id: clauses.append(f"s.sucursal_id = ${n}"); params.append(sucursal_id); n += 1
        where = " AND ".join(clauses)
        params.append(limit)
        async with pool.acquire() as conn:
            rows = await conn.fetch(f"""
                SELECT s.*, COALESCE(SUM(si.item_discount),0) as total_discount
                FROM sales s LEFT JOIN sale_items si ON s.id = si.sale_id
                WHERE {where} GROUP BY s.id ORDER BY s.timestamp DESC LIMIT ${n}
            """, *params)
            sales = [dict(r) for r in rows]
            for sale in sales:
                items = await conn.fetch("SELECT * FROM sale_items WHERE sale_id = $1", sale["id"])
                sale["items"] = [dict(i) for i in items]
            return sales
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            params = []
            clauses = ["1=1"]
            if date_from: clauses.append("date(s.timestamp) >= ?"); params.append(date_from)
            if date_to: clauses.append("date(s.timestamp) <= ?"); params.append(date_to)
            where = " AND ".join(clauses)
            params.append(limit)
            cur = await db.execute(f"""
                SELECT s.*, COALESCE(SUM(si.item_discount),0) as total_discount
                FROM sales s LEFT JOIN sale_items si ON s.id = si.sale_id
                WHERE {where} GROUP BY s.id ORDER BY s.timestamp DESC LIMIT ?
            """, params)
            rows = await cur.fetchall()
            sales = [row_to_dict(r, cur.description) for r in rows]
            for sale in sales:
                cur2 = await db.execute("SELECT * FROM sale_items WHERE sale_id=?", (sale["id"],))
                sale["items"] = [row_to_dict(r, cur2.description) for r in await cur2.fetchall()]
            return sales


@router.get("/api/turns/{turn_id}/detail", summary="Detalle de turno")
async def turn_detail(turn_id: int) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM turns WHERE id = $1 AND business_id = $2", turn_id, b_id)
            if not row: raise HTTPException(404, detail="Turno no encontrado")
            return dict(row)
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM turns WHERE id=?", (turn_id,))
            row = await cur.fetchone()
            if not row: raise HTTPException(404, detail="Turno no encontrado")
            return row_to_dict(row, cur.description)


@router.get("/api/customers", summary="Listar clientes con cuentas corrientes")
async def list_customers(q: Optional[str] = Query(None)) -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            if q:
                rows = await conn.fetch(
                    "SELECT * FROM customers WHERE business_id = $1 AND balance > 0 AND (name ILIKE $2 OR phone ILIKE $2) ORDER BY balance DESC",
                    b_id, f"%{q}%"
                )
            else:
                rows = await conn.fetch("SELECT * FROM customers WHERE business_id = $1 AND balance > 0 ORDER BY balance DESC", b_id)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            if q:
                cur = await db.execute("SELECT * FROM customers WHERE balance > 0 AND (name LIKE ? OR phone LIKE ?) ORDER BY balance DESC", (f"%{q}%", f"%{q}%"))
            else:
                cur = await db.execute("SELECT * FROM customers WHERE balance > 0 ORDER BY balance DESC")
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.get("/api/customers/{customer_id}/transactions", summary="Transacciones de cliente")
async def customer_transactions(customer_id: int) -> list:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM customer_transactions WHERE customer_id = $1 ORDER BY timestamp DESC", customer_id)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY timestamp DESC", (customer_id,))
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.post("/api/customers", summary="Crear cliente")
async def create_customer(name: str = Body(...), phone: Optional[str] = Body(None)) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "INSERT INTO customers (business_id, name, phone) VALUES ($1,$2,$3) RETURNING id",
                b_id, name.strip(), phone
            )
            return {"id": row["id"], "name": name.strip(), "phone": phone}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("INSERT INTO customers (name, phone) VALUES (?,?)", (name.strip(), phone))
            await db.commit()
            return {"id": cur.lastrowid, "name": name.strip(), "phone": phone}


@router.post("/api/customers/{customer_id}/pay", summary="Registrar pago de cliente")
async def pay_customer_balance(customer_id: int, payment: dict = Body(...)) -> dict:
    b_id = _biz_id()
    amount = round(payment.get("amount", 0), 2)
    operator = payment.get("operator", "Sistema")
    desc = payment.get("description", f"Pago cliente #{customer_id}")
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                cust = await conn.fetchrow("SELECT id, balance FROM customers WHERE id = $1 AND business_id = $2", customer_id, b_id)
                if not cust: raise HTTPException(404, detail="Cliente no encontrado")
                new_balance = max(0, (cust["balance"] or 0) - amount)
                await conn.execute("UPDATE customers SET balance = $1 WHERE id = $2", new_balance, customer_id)
                await conn.execute(
                    "INSERT INTO customer_transactions (business_id, customer_id, amount, type, description, operator) VALUES ($1,$2,$3,'payment',$4,$5)",
                    b_id, customer_id, amount, desc, operator
                )
            return {"success": True, "new_balance": new_balance}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            cur = await db.execute("SELECT balance FROM customers WHERE id=?", (customer_id,))
            row = await cur.fetchone()
            if not row: raise HTTPException(404, detail="Cliente no encontrado")
            new_balance = max(0, (row[0] or 0) - amount)
            await db.execute("UPDATE customers SET balance = ? WHERE id = ?", (new_balance, customer_id))
            await db.execute(
                "INSERT INTO customer_transactions (customer_id, amount, type, description, operator) VALUES (?,?,?,?,?)",
                (customer_id, amount, 'payment', desc, operator)
            )
            await db.commit()
        return {"success": True, "new_balance": new_balance}

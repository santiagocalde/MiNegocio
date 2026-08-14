from fastapi import APIRouter, HTTPException, Query, Body, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

import main
from main import JWT_SECRET, JWT_ALGORITHM, row_to_dict, logger, TurnOpen, TurnClose, SaleCreate, USE_PG
from event_stream import events
from core.ratelimit import limiter

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
    # datetime real: _now() se usa como parámetro bind ($1), no interpolado en SQL
    return datetime.now(timezone.utc)


def _now():
    return _pg_now() if USE_PG else _sqlite_now()


PLACEHOLDER = "$1" if USE_PG else "?"


async def _open_turn_pg(conn, b_id):
    """Turno abierto actual del negocio (o None)."""
    return await conn.fetchval(
        "SELECT id FROM turns WHERE closed_at IS NULL AND business_id = $1 ORDER BY id DESC LIMIT 1", b_id)


async def _open_turn_sqlite(db):
    cur = await db.execute("SELECT id FROM turns WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1")
    row = await cur.fetchone()
    return row[0] if row else None


# ────────────────────────────────────────────────────────────
# VENTAS POR CATEGORÍA (resumen de caja / cierre de turno)
# ────────────────────────────────────────────────────────────
async def _por_categoria_pg(conn, b_id, turn_id=None, sucursal_id=None):
    """Totales vendidos agrupados por categoría del producto (modo PG)."""
    base = (
        "SELECT COALESCE(c.name, 'Sin categoría') AS categoria, "
        "ROUND(SUM(si.quantity * si.unit_price)::numeric, 2) AS total, "
        "ROUND(SUM(si.quantity)::numeric, 2) AS cantidad "
        "FROM sale_items si "
        "JOIN sales s ON s.id = si.sale_id "
        "LEFT JOIN products p ON p.id = si.product_id "
        "LEFT JOIN categories c ON c.id = p.category_id "
    )
    if turn_id is not None:
        rows = await conn.fetch(
            base + "WHERE s.business_id = $1 AND s.turn_id = $2 AND s.reverted = 0 "
                   "GROUP BY COALESCE(c.name, 'Sin categoría') ORDER BY total DESC",
            b_id, turn_id,
        )
    elif sucursal_id:
        rows = await conn.fetch(
            base + "WHERE s.business_id = $1 AND s.sucursal_id = $2 AND s.reverted = 0 "
                   "AND s.timestamp >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' "
                   "AND s.timestamp < date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' + INTERVAL '1 day' "
                   "GROUP BY COALESCE(c.name, 'Sin categoría') ORDER BY total DESC",
            b_id, sucursal_id,
        )
    else:
        rows = await conn.fetch(
            base + "WHERE s.business_id = $1 AND s.reverted = 0 "
                   "AND s.timestamp >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' "
                   "AND s.timestamp < date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' + INTERVAL '1 day' "
                   "GROUP BY COALESCE(c.name, 'Sin categoría') ORDER BY total DESC",
            b_id,
        )
    return [
        {"categoria": r["categoria"], "total": float(r["total"] or 0), "cantidad": float(r["cantidad"] or 0)}
        for r in rows
    ]


async def _por_categoria_sqlite(db, turn_id=None, sucursal_id=None):
    """Totales vendidos agrupados por categoría del producto (modo SQLite)."""
    base = (
        "SELECT COALESCE(c.name, 'Sin categoría') AS categoria, "
        "ROUND(SUM(si.quantity * si.unit_price), 2) AS total, "
        "ROUND(SUM(si.quantity), 2) AS cantidad "
        "FROM sale_items si "
        "JOIN sales s ON s.id = si.sale_id "
        "LEFT JOIN products p ON p.id = si.product_id "
        "LEFT JOIN categories c ON c.id = p.category_id "
    )
    if turn_id is not None:
        cur = await db.execute(
            base + "WHERE s.turn_id = ? AND s.reverted = 0 "
                   "GROUP BY COALESCE(c.name, 'Sin categoría') ORDER BY total DESC",
            (turn_id,),
        )
    elif sucursal_id:
        cur = await db.execute(
            base + "WHERE s.sucursal_id = ? AND s.reverted = 0 AND date(s.timestamp) = date('now','localtime') "
                   "GROUP BY COALESCE(c.name, 'Sin categoría') ORDER BY total DESC",
            (sucursal_id,),
        )
    else:
        cur = await db.execute(
            base + "WHERE s.reverted = 0 AND date(s.timestamp) = date('now','localtime') "
                   "GROUP BY COALESCE(c.name, 'Sin categoría') ORDER BY total DESC",
        )
    rows = await cur.fetchall()
    return [
        {"categoria": r["categoria"], "total": float(r["total"] or 0), "cantidad": float(r["cantidad"] or 0)}
        for r in (row_to_dict(r, cur.description) for r in rows)
    ]


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
                "SELECT id, operator, opened_at, initial_cash FROM turns WHERE closed_at IS NULL AND business_id = $1 ORDER BY id DESC LIMIT 1",
                b_id
            )
            if row:
                hours = await conn.fetchval(
                    "SELECT EXTRACT(EPOCH FROM (now() - $1::timestamptz))/3600",
                    row["opened_at"]
                )
                if hours and hours >= 14:
                    await conn.execute(
                        "UPDATE turns SET closed_at = now(), sales_total = COALESCE((SELECT SUM(total) FROM sales WHERE turn_id = $1 AND business_id = $2), 0), notes = 'Cierre automatico > 14hs' WHERE id = $1",
                        row["id"], b_id
                    )
                    return {"id": None}
                return {"id": row["id"], "operator": row["operator"], "opened_at": str(row["opened_at"]), "initial_cash": float(row["initial_cash"] or 0)}
            return {"id": None}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT id, operator, opened_at, initial_cash FROM turns WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1")
            row = await cur.fetchone()
            if row:
                cur = await db.execute("SELECT (julianday('now','localtime') - julianday(?)) * 24.0", (row[2],))
                diff = await cur.fetchone()
                if diff and diff[0] >= 14:
                    await db.execute("UPDATE turns SET closed_at = datetime('now','localtime'), sales_total = COALESCE((SELECT SUM(total) FROM sales WHERE turn_id = ?), 0), notes = 'Cierre automatico > 14hs' WHERE id = ?", (row[0], row[0],))
                    await db.commit()
                    return {"id": None}
                return {"id": row[0], "operator": row[1], "opened_at": row[2], "initial_cash": float(row[3] or 0)}
            return {"id": None}


@router.post("/api/turns/{turn_id}/close", summary="Cerrar turno con balance")
async def close_turn(turn_id: int, body: TurnClose) -> dict:
    import bcrypt
    b_id = _biz_id()

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()

        if body.operator_id:
            async with pool.acquire() as conn:
                op_row = await conn.fetchrow(
                    "SELECT pin, role FROM operators WHERE id = $1 AND business_id = $2",
                    body.operator_id, b_id
                )
                if not op_row:
                    raise HTTPException(403, detail="Operador no encontrado")
                if op_row["role"] not in ("admin", "logistica", "manager"):
                    if not body.pin:
                        raise HTTPException(403, detail="El cajero debe ingresar su PIN para cerrar el turno")
                    if not bcrypt.checkpw(body.pin.encode(), op_row["pin"].encode()):
                        if not (not op_row["pin"].startswith("$2b$") and body.pin == op_row["pin"]):
                            raise HTTPException(403, detail="PIN incorrecto")

        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("SELECT closed_at, initial_cash FROM turns WHERE id = $1 AND business_id = $2", turn_id, b_id)
                if not row:
                    raise HTTPException(404, detail="Turno no encontrado")
                if row["closed_at"] is not None:
                    raise HTTPException(400, detail="Este turno ya esta cerrado")

                # Efectivo esperado en el cajón = base inicial + ventas EN EFECTIVO (no fiado,
                # no anuladas) + porción efectivo de pagos mixtos - egresos de caja del turno.
                # NO se cuentan tarjeta/transferencia/MP (no van al cajón) ni fiado (no se cobró).
                # Se calcula en el backend, no se confía en el total que manda el front.
                cash_sales = await conn.fetchval(
                    "SELECT COALESCE(SUM(total),0) FROM sales WHERE turn_id = $1 AND business_id = $2 "
                    "AND payment_method = 'efectivo' AND is_fiado = 0 AND reverted = 0",
                    turn_id, b_id
                )
                split_efectivo = await conn.fetchval(
                    "SELECT COALESCE(SUM(sp.amount),0) FROM sale_payments sp "
                    "JOIN sales s2 ON s2.id = sp.sale_id "
                    "WHERE s2.turn_id = $1 AND s2.business_id = $2 AND sp.method = 'efectivo' AND s2.reverted = 0",
                    turn_id, b_id
                )
                cash_sales = float(cash_sales or 0) + float(split_efectivo or 0)
                egresos = await conn.fetchval(
                    "SELECT COALESCE(SUM(monto),0) FROM egresos_caja WHERE turn_id = $1 AND business_id = $2",
                    turn_id, b_id
                )
                expected_cash = round(float(row["initial_cash"] or 0) + float(cash_sales) - float(egresos), 2)
                difference = round(body.counted_cash - expected_cash, 2)

                await conn.execute(
                    "UPDATE turns SET closed_at = now(), sales_total = $1, counted_cash = $2, difference = $3, notes = $4 WHERE id = $5",
                    body.sales_total, body.counted_cash, difference, body.notes, turn_id
                )
                if difference < -0.01:
                    await conn.execute(
                        "INSERT INTO egresos_caja (business_id, monto, motivo, type, turn_id) VALUES ($1,$2,$3,$4,$5)",
                        b_id, abs(difference), f"Ajuste por Faltante de Caja (Turno {turn_id})", "gasto", turn_id
                    )
        return {"success": True, "difference": difference, "expected_cash": expected_cash,
                "status": "perfecto" if abs(difference) < 0.01 else ("sobrante" if difference > 0 else "faltante")}
    else:
        import aiosqlite
        if body.operator_id:
            async with aiosqlite.connect(main.DB_PATH) as db:
                cur = await db.execute("SELECT pin, role FROM operators WHERE id = ?", (body.operator_id,))
                op_row = await cur.fetchone()
                if not op_row:
                    raise HTTPException(403, detail="Operador no encontrado")
                if op_row[1] not in ("admin", "logistica", "manager"):
                    if not body.pin:
                        raise HTTPException(403, detail="El cajero debe ingresar su PIN para cerrar el turno")
                    if not bcrypt.checkpw(body.pin.encode(), op_row[0].encode()):
                        if not (not op_row[0].startswith("$2b$") and body.pin == op_row[0]):
                            raise HTTPException(403, detail="PIN incorrecto")

        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                cur = await db.execute("SELECT closed_at, initial_cash FROM turns WHERE id=?", (turn_id,))
                turn = await cur.fetchone()
                if not turn: raise HTTPException(404, detail="Turno no encontrado")
                if turn[0] is not None: raise HTTPException(400, detail="Este turno ya esta cerrado")
                # Efectivo esperado = base inicial + ventas EN EFECTIVO (no fiado, no anuladas)
                # + porción efectivo de pagos mixtos - egresos.
                # (mismo criterio que la rama PG; no se confía en el total del front)
                cur2 = await db.execute(
                    "SELECT COALESCE(SUM(total),0) FROM sales WHERE turn_id=? AND payment_method='efectivo' AND is_fiado=0 AND reverted=0",
                    (turn_id,)
                )
                cash_sales = (await cur2.fetchone())[0] or 0
                cur_split = await db.execute(
                    "SELECT COALESCE(SUM(sp.amount),0) FROM sale_payments sp "
                    "JOIN sales s2 ON s2.id = sp.sale_id "
                    "WHERE s2.turn_id=? AND sp.method='efectivo' AND s2.reverted=0",
                    (turn_id,)
                )
                cash_sales = float(cash_sales) + float((await cur_split.fetchone())[0] or 0)
                cur3 = await db.execute("SELECT COALESCE(SUM(monto),0) FROM egresos_caja WHERE turn_id=?", (turn_id,))
                egresos = (await cur3.fetchone())[0] or 0
                expected_cash = round(float(turn[1] or 0) + float(cash_sales) - float(egresos), 2)
                difference = round(body.counted_cash - expected_cash, 2)
                await db.execute(
                    "UPDATE turns SET closed_at=datetime('now','localtime'), sales_total=?, counted_cash=?, difference=?, notes=? WHERE id=?",
                    (body.sales_total, body.counted_cash, difference, body.notes, turn_id)
                )
                if difference < -0.01:
                    await db.execute(
                        "INSERT INTO egresos_caja (monto, motivo, type, turn_id) VALUES (?,?,?,?)",
                        (abs(difference), f"Ajuste por Faltante de Caja (Turno {turn_id})", "gasto", turn_id)
                    )
                await db.commit()
        return {"success": True, "difference": difference, "expected_cash": expected_cash,
                "status": "perfecto" if abs(difference) < 0.01 else ("sobrante" if difference > 0 else "faltante")}


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
@limiter.limit("120/minute")
async def create_sale(request: Request, body: SaleCreate, idempotency_key: Optional[str] = Query(None)) -> dict:
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

                if not body.turn_id:
                    raise HTTPException(400, detail="Se requiere un turno abierto para registrar ventas")
                turn = await conn.fetchrow("SELECT id, closed_at FROM turns WHERE id = $1 AND business_id = $2", body.turn_id, b_id)
                if not turn:
                    raise HTTPException(404, detail="Turno no encontrado")
                if turn["closed_at"] is not None:
                    raise HTTPException(400, detail="El turno asociado ya se encuentra cerrado")

                is_split = len(body.payments) > 0
                primary_method = 'split' if is_split else body.payment_method
                primary_payment = round(sum(p.amount for p in body.payments), 2) if is_split else round(body.payment, 2)
                total_sale = round(body.total, 2) if body.total is not None else round(primary_payment, 2)
                is_cash = primary_method == 'efectivo' or any(p.method == 'efectivo' for p in body.payments)
                change_sale = round(body.change_given, 2) if is_cash else 0

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
                    if item.is_virtual or item.product_id is None:
                        # Producto virtual (acceso rápido, monto manual) — sin stock DB
                        db_price = round(item.unit_price, 2)
                        db_total += db_price * item.quantity
                        await conn.execute(
                            "INSERT INTO sale_items (business_id, sale_id, product_id, product_name, quantity, unit_price, item_discount) VALUES ($1,$2,$3,$4,$5,$6,$7)",
                            b_id, sale_id, None, item.product_name, item.quantity, db_price, item.item_discount
                        )
                        continue

                    prod = await conn.fetchrow(
                        "SELECT id, price, stock, is_virtual, parent_id, pack_size, cost_price FROM products WHERE id = $1 AND business_id = $2",
                        item.product_id, b_id
                    )
                    if not prod:
                        raise HTTPException(404, detail=f"Producto {item.product_name} no encontrado")

                    # Recalcular precio desde DB (no confiar en frontend)
                    db_price = round(prod["price"], 2)
                    db_cost = round(prod["cost_price"] or 0, 2)
                    db_total += db_price * item.quantity
                    db_name = prod.get("name") or item.product_name

                    await conn.execute(
                        "INSERT INTO sale_items (business_id, sale_id, product_id, product_name, quantity, unit_price, item_discount, unit_cost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                        b_id, sale_id, item.product_id, db_name, item.quantity, db_price, item.item_discount, db_cost
                    )

                    if prod["is_virtual"] == 1 and prod["parent_id"]:
                        real_qty = item.quantity * (prod["pack_size"] or 1)
                        result = await conn.execute(
                            "UPDATE products SET stock = stock - $1 WHERE id = $2 AND business_id = $3",
                            real_qty, prod["parent_id"], b_id
                        )
                        if result == "UPDATE 0":
                            raise HTTPException(400, detail=f"Stock insuficiente de {item.product_name} (Pack Virtual)")
                        await conn.execute(
                            "INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, reason, operator, source_id) VALUES ($1,$2,'salida',$3,$4,$5,$6)",
                            b_id, prod["parent_id"], real_qty, f"Venta #{sale_id} (Pack Virtual)", body.operator, f"sale-{sale_id}-{item.product_id}"
                        )
                    else:
                        await conn.execute(
                            "UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2 AND business_id = $3",
                            item.quantity, item.product_id, b_id
                        )
                        await conn.execute(
                            "INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, reason, operator, source_id) VALUES ($1,$2,'salida',$3,$4,$5,$6)",
                            b_id, item.product_id, item.quantity, f"Venta #{sale_id}", body.operator, f"sale-{sale_id}-{item.product_id}"
                        )

                # Nota: db_total no incluye descuentos/promos (que sí están en total_sale),
                # así que una diferencia es normal en ventas con descuento. Se deja en debug
                # como diagnóstico; solo es señal de alarma si el front cobró MÁS que los ítems.
                if total_sale - db_total > 0.02:
                    logger.warning(f"Venta #{sale_id}: cobrado ({total_sale}) > suma de items en DB ({db_total}) — revisar")
                elif abs(db_total - total_sale) > 0.02:
                    logger.debug(f"Venta #{sale_id}: total DB={db_total} vs cobrado={total_sale} (descuento/promo)")

                if body.is_fiado and body.fiado_name:
                    # Deuda = parte NO pagada (total - lo abonado ahora).
                    # Fiado completo -> primary_payment 0 -> deuda = total.
                    fiado_debt = round(total_sale - primary_payment, 2)
                    fiado_name = body.fiado_name.strip()
                    if fiado_debt > 0 and fiado_name:
                        cust = await conn.fetchrow("SELECT id FROM customers WHERE name = $1 AND business_id = $2", fiado_name, b_id)
                        if not cust:
                            cust_row = await conn.fetchrow(
                                "INSERT INTO customers (business_id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id",
                                b_id, fiado_name
                            )
                            if not cust_row:
                                cust_row = await conn.fetchrow("SELECT id FROM customers WHERE name = $1 AND business_id = $2", fiado_name, b_id)
                            cust_id = cust_row["id"] if cust_row else None
                        else:
                            cust_id = cust["id"]
                        if cust_id:
                            await conn.execute("UPDATE customers SET balance = balance + $1 WHERE id = $2", fiado_debt, cust_id)
                            await conn.execute(
                                "INSERT INTO customer_transactions (business_id, customer_id, amount, type, description, turn_id, operator) VALUES ($1,$2,$3,'sale',$4,$5,$6)",
                                 b_id, cust_id, fiado_debt, f"Venta Fiada #{sale_id}", body.turn_id, body.operator
                            )

                if is_split and body.payments:
                    await conn.executemany(
                        "INSERT INTO sale_payments (sale_id, method, amount) VALUES ($1,$2,$3)",
                        [(sale_id, p.method, round(p.amount, 2)) for p in body.payments if getattr(p, "amount", 0) > 0]
                    )

                await events.emit("sale-created", {"id": sale_id, "business_id": b_id}, business_id=b_id)
                await conn.execute(
                    "INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "sale_created", body.operator or "Sistema",
                    f"Venta #{sale_id} — ${total_sale:.2f} ({primary_method})"
                )
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
                    cur_t = await db.execute("SELECT id, closed_at FROM turns WHERE id=?", (body.turn_id,))
                    t = await cur_t.fetchone()
                    if not t:
                        raise HTTPException(404, detail="Turno no encontrado")
                    if t[1] is not None:
                        raise HTTPException(400, detail="El turno asociado ya se encuentra cerrado")
                else:
                    raise HTTPException(400, detail="Se requiere un turno abierto para registrar ventas")

                is_split = len(body.payments) > 0
                primary_method = 'split' if is_split else body.payment_method
                primary_payment = round(sum(p.amount for p in body.payments), 2) if is_split else round(body.payment, 2)
                total_sale = round(body.total, 2) if body.total is not None else round(primary_payment, 2)
                change_sale = round(body.change_given, 2)

                cur = await db.execute(
                    "INSERT INTO sales (turn_id,total,payment,change_given,operator,is_fiado,fiado_name,payment_method,client_cuit,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (body.turn_id, total_sale, primary_payment, change_sale, body.operator,
                     1 if body.is_fiado else 0, body.fiado_name, primary_method, body.client_cuit, effective_key)
                )
                sale_id = cur.lastrowid
                db_total_sql = 0

                for item in body.items:
                    if item.is_virtual or item.product_id is None:
                        # Producto virtual — sin DB lookup ni descuento de stock
                        db_price = round(item.unit_price, 2)
                        db_total_sql += db_price * item.quantity
                        await db.execute(
                            "INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,item_discount) VALUES (?,?,?,?,?,?)",
                            (sale_id, None, item.product_name, item.quantity, db_price, item.item_discount)
                        )
                        continue

                    p_cur = await db.execute(
                        "SELECT id, price, stock, is_virtual, parent_id, pack_size, cost_price FROM products WHERE id = ?",
                        (item.product_id,)
                    )
                    prod = await p_cur.fetchone()
                    if not prod:
                        raise HTTPException(404, detail=f"Producto {item.product_name} no encontrado")

                    db_price = round(prod[1], 2)
                    db_cost = round(prod[6] or 0, 2)
                    db_total_sql += db_price * item.quantity

                    await db.execute(
                        "INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,item_discount,unit_cost) VALUES (?,?,?,?,?,?,?)",
                        (sale_id, item.product_id, item.product_name, item.quantity, db_price, item.item_discount, db_cost)
                    )

                    p_stock, p_is_virtual, p_parent_id, p_pack_size = prod[2], prod[3], prod[4], prod[5]
                    if p_is_virtual == 1 and p_parent_id:
                        real_qty = item.quantity * (p_pack_size or 1)
                        result = await db.execute(
                            "UPDATE products SET stock = stock - ? WHERE id = ?",
                            (real_qty, item.product_id)
                        )
                        if result.rowcount == 0:
                            raise HTTPException(400, detail=f"Stock insuficiente de {item.product_name} (Pack Virtual)")
                        await db.execute(
                            "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                            (p_parent_id, "salida", real_qty, f"Venta #{sale_id} (Pack Virtual)", body.operator)
                        )
                    else:
                        result = await db.execute(
                            "UPDATE products SET stock = stock - ? WHERE id = ?",
                            (item.quantity, item.product_id)
                        )
                        if result.rowcount == 0:
                            raise HTTPException(400, detail=f"Stock insuficiente de {item.product_name}")
                        await db.execute(
                            "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                            (item.product_id, "salida", item.quantity, f"Venta #{sale_id}", body.operator)
                        )

                if body.is_fiado and body.fiado_name:
                    fiado_debt = round(total_sale - primary_payment, 2)
                    fiado_name = body.fiado_name.strip()
                    if fiado_debt > 0 and fiado_name:
                        cur_c = await db.execute("SELECT id FROM customers WHERE name = ?", (fiado_name,))
                        c_row = await cur_c.fetchone()
                        if not c_row:
                            ins_c = await db.execute("INSERT INTO customers (name) VALUES (?)", (fiado_name,))
                            cust_id = ins_c.lastrowid
                        else:
                            cust_id = c_row[0]
                        await db.execute("UPDATE customers SET balance = balance + ? WHERE id = ?", (fiado_debt, cust_id))
                        await db.execute(
                            "INSERT INTO customer_transactions (customer_id, amount, type, description, turn_id, operator) VALUES (?,?,?,?,?,?)",
                            (cust_id, fiado_debt, 'sale', f"Venta Fiada #{sale_id}", body.turn_id, body.operator)
                        )

                if is_split and body.payments:
                    await db.executemany(
                        "INSERT INTO sale_payments (sale_id, method, amount) VALUES (?,?,?)",
                        [(sale_id, p.method, round(p.amount, 2)) for p in body.payments if getattr(p, "amount", 0) > 0]
                    )

                await db.commit()
                await db.execute(
                    "INSERT INTO audit_log (action, operator, details) VALUES (?,?,?)",
                    ("sale_created", body.operator or "Sistema", f"Venta #{sale_id} — ${total_sale:.2f} ({primary_method})")
                )
                await db.commit()
                await events.emit("sale-created", {"id": sale_id, "business_id": b_id}, business_id=b_id)
                return {"id": sale_id, "ticket": sale_id}



@router.post("/api/sales/{sale_id}/cobrar-fiado", summary="Cobrar fiado y actualizar balance")
async def cobrar_fiado(sale_id: int) -> dict:
    """Marca un fiado como cobrado y actualiza el balance del cliente.
    El efectivo que entra al cajón se registra como ingreso (egreso negativo)
    en el turno abierto actual, así el arqueo del cierre cuadra."""
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            sale = await conn.fetchrow(
                "SELECT id, is_fiado, fiado_name, total, payment_method FROM sales WHERE id = $1 AND business_id = $2",
                sale_id, b_id
            )
            if not sale:
                raise HTTPException(404, detail="Venta no encontrada")
            if not sale["is_fiado"]:
                raise HTTPException(400, detail="Esta venta no es un fiado")
            if sale["fiado_name"]:
                await conn.execute(
                    "UPDATE customers SET balance = balance - $1 WHERE business_id = $2 AND name = $3",
                    sale["total"], b_id, sale["fiado_name"]
                )
            await conn.execute("UPDATE sales SET is_fiado = false WHERE id = $1", sale_id)
            # Si el fiado se creó como 'fiado' (o split con parte fiada), el cobro
            # nunca entra a cash_sales: se registra como ingreso del turno actual.
            if sale["payment_method"] != 'efectivo':
                already_cash = await conn.fetchval(
                    "SELECT COALESCE(SUM(amount),0) FROM sale_payments WHERE sale_id = $1 AND method = 'efectivo'", sale_id)
                cobro = round(float(sale["total"] or 0) - float(already_cash or 0), 2)
                if cobro > 0:
                    open_turn = await _open_turn_pg(conn, b_id)
                    if open_turn:
                        await conn.execute(
                            "INSERT INTO egresos_caja (business_id, turn_id, monto, motivo, type, operator) VALUES ($1,$2,$3,$4,'ingreso','Sistema')",
                            b_id, open_turn, -cobro, f"Cobro fiado Venta #{sale_id}"
                        )
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            sale_row = await db.execute_fetchall(
                "SELECT id, is_fiado, fiado_name, total, payment_method FROM sales WHERE id = ?",
                (sale_id,)
            )
            if not sale_row:
                raise HTTPException(404, detail="Venta no encontrada")
            sale = sale_row[0]
            if not sale[1]:
                raise HTTPException(400, detail="Esta venta no es un fiado")
            if sale[2]:
                await db.execute(
                    "UPDATE customers SET balance = balance - ? WHERE name = ?",
                    (sale[3], sale[2])
                )
            await db.execute("UPDATE sales SET is_fiado = 0 WHERE id = ?", (sale_id,))
            if sale[4] != 'efectivo':
                cur_ap = await db.execute(
                    "SELECT COALESCE(SUM(amount),0) FROM sale_payments WHERE sale_id = ? AND method = 'efectivo'", (sale_id,))
                already_cash = (await cur_ap.fetchone())[0] or 0
                cobro = round(float(sale[3] or 0) - float(already_cash), 2)
                if cobro > 0:
                    open_turn = await _open_turn_sqlite(db)
                    if open_turn:
                        await db.execute(
                            "INSERT INTO egresos_caja (turn_id, monto, motivo, type, operator) VALUES (?,?,?,'ingreso','Sistema')",
                            (open_turn, -cobro, f"Cobro fiado Venta #{sale_id}")
                        )
            await db.commit()
    return {"success": True, "message": "Fiado cobrado"}


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
                           COALESCE(SUM(CASE WHEN payment_method='tarjeta' THEN total ELSE 0 END),0) as total_tarjeta,
                           COALESCE(SUM(CASE WHEN payment_method='transferencia' THEN total ELSE 0 END),0) as total_transferencia,
                           COALESCE(SUM(CASE WHEN payment_method='mercadopago' THEN total ELSE 0 END),0) as total_mp
                     FROM sales WHERE business_id = $1 AND reverted = 0 AND timestamp >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' AND timestamp < date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' + INTERVAL '1 day' AND sucursal_id = $2
                """, b_id, sucursal_id)
                egresos_row = await conn.fetchrow("SELECT COALESCE(SUM(monto),0) as total_egresos FROM egresos_caja WHERE business_id = $1 AND timestamp >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' AND timestamp < date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' + INTERVAL '1 day'", b_id)
            else:
                row = await conn.fetchrow("""
                    SELECT COUNT(*) as total_tickets, COALESCE(SUM(total),0) as total_vendido,
                           COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) as total_fiado,
                           COALESCE(SUM(CASE WHEN payment_method='efectivo' AND is_fiado=0 THEN total ELSE 0 END),0) as total_efectivo,
                           COALESCE(SUM(CASE WHEN payment_method='tarjeta' THEN total ELSE 0 END),0) as total_tarjeta,
                           COALESCE(SUM(CASE WHEN payment_method='transferencia' THEN total ELSE 0 END),0) as total_transferencia,
                           COALESCE(SUM(CASE WHEN payment_method='mercadopago' THEN total ELSE 0 END),0) as total_mp
                     FROM sales WHERE business_id = $1 AND reverted = 0 AND timestamp >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' AND timestamp < date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' + INTERVAL '1 day'
                """, b_id)
                egresos_row = await conn.fetchrow("SELECT COALESCE(SUM(monto),0) as total_egresos FROM egresos_caja WHERE business_id = $1 AND timestamp >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' AND timestamp < date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' + INTERVAL '1 day'", b_id)
            result = dict(row) if row else {"total_tickets": 0, "total_vendido": 0, "total_fiado": 0, "total_efectivo": 0, "total_tarjeta": 0, "total_transferencia": 0, "total_mp": 0}
            result["total_egresos"] = float(egresos_row["total_egresos"] or 0) if egresos_row else 0
            # Porción en efectivo de pagos mixtos (split): esa plata sí está en el cajón.
            _split_q = (
                "SELECT COALESCE(SUM(sp.amount),0) FROM sale_payments sp "
                "JOIN sales s2 ON s2.id = sp.sale_id "
                "WHERE s2.business_id = $1 AND sp.method = 'efectivo' AND s2.reverted = 0 "
                "AND s2.timestamp >= date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' "
                "AND s2.timestamp < date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' + INTERVAL '1 day'"
            )
            if sucursal_id:
                split_efectivo = await conn.fetchval(_split_q + " AND s2.sucursal_id = $2", b_id, sucursal_id)
            else:
                split_efectivo = await conn.fetchval(_split_q, b_id)
            result["total_efectivo"] = round(float(result.get("total_efectivo") or 0) + float(split_efectivo or 0), 2)
            result["por_categoria"] = await _por_categoria_pg(conn, b_id, sucursal_id=sucursal_id)
            return result
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            if sucursal_id:
                cur = await db.execute("""
                    SELECT COUNT(*) as total_tickets, COALESCE(SUM(total),0) as total_vendido,
                           COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) as total_fiado,
                           COALESCE(SUM(CASE WHEN payment_method='efectivo' AND is_fiado=0 THEN total ELSE 0 END),0) as total_efectivo,
                           COALESCE(SUM(CASE WHEN payment_method='tarjeta' THEN total ELSE 0 END),0) as total_tarjeta,
                           COALESCE(SUM(CASE WHEN payment_method='transferencia' THEN total ELSE 0 END),0) as total_transferencia,
                           COALESCE(SUM(CASE WHEN payment_method='mercadopago' THEN total ELSE 0 END),0) as total_mp
                     FROM sales WHERE date(timestamp)=date('now','localtime') AND sucursal_id = ? AND reverted = 0
                """, (sucursal_id,))
            else:
                cur = await db.execute("""
                    SELECT COUNT(*) as total_tickets, COALESCE(SUM(total),0) as total_vendido,
                           COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) as total_fiado,
                           COALESCE(SUM(CASE WHEN payment_method='efectivo' AND is_fiado=0 THEN total ELSE 0 END),0) as total_efectivo,
                           COALESCE(SUM(CASE WHEN payment_method='tarjeta' THEN total ELSE 0 END),0) as total_tarjeta,
                           COALESCE(SUM(CASE WHEN payment_method='transferencia' THEN total ELSE 0 END),0) as total_transferencia,
                           COALESCE(SUM(CASE WHEN payment_method='mercadopago' THEN total ELSE 0 END),0) as total_mp
                     FROM sales WHERE date(timestamp)=date('now','localtime') AND reverted = 0
                """)
            row = await cur.fetchone()
            egresos_cur = await db.execute("SELECT COALESCE(SUM(monto),0) as total_egresos FROM egresos_caja WHERE date(timestamp)=date('now','localtime')")
            egresos_row = await egresos_cur.fetchone()
            result = row_to_dict(row, cur.description)
            result["total_egresos"] = float(egresos_row[0] or 0)
            # Porción en efectivo de pagos mixtos (split): esa plata sí está en el cajón.
            if sucursal_id:
                cur_split = await db.execute(
                    "SELECT COALESCE(SUM(sp.amount),0) FROM sale_payments sp "
                    "JOIN sales s2 ON s2.id = sp.sale_id "
                    "WHERE sp.method='efectivo' AND s2.reverted=0 AND date(s2.timestamp)=date('now','localtime') AND s2.sucursal_id=?",
                    (sucursal_id,))
            else:
                cur_split = await db.execute(
                    "SELECT COALESCE(SUM(sp.amount),0) FROM sale_payments sp "
                    "JOIN sales s2 ON s2.id = sp.sale_id "
                    "WHERE sp.method='efectivo' AND s2.reverted=0 AND date(s2.timestamp)=date('now','localtime')")
            result["total_efectivo"] = round(float(result.get("total_efectivo") or 0) + float((await cur_split.fetchone())[0] or 0), 2)
            result["por_categoria"] = await _por_categoria_sqlite(db, sucursal_id=sucursal_id)
            return result


@router.get("/api/sales", summary="Listar ventas con filtros")
async def list_sales(limit: int = Query(50), date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), sucursal_id: Optional[int] = Query(None)) -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        params = [b_id]
        clauses = ["s.business_id = $1"]
        n = 2
        if date_from:
            try: parsed = datetime.strptime(date_from, '%Y-%m-%d').date()
            except: parsed = date_from
            clauses.append(f"s.timestamp::date >= ${n}::date"); params.append(parsed); n += 1
        if date_to:
            try: parsed = datetime.strptime(date_to, '%Y-%m-%d').date()
            except: parsed = date_to
            clauses.append(f"s.timestamp::date <= ${n}::date"); params.append(parsed); n += 1
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
    """Devuelve el turno con sus ventas y egresos asociados.

    Antes solo devolvía la fila de `turns`, dejando vacíos los listados que
    necesita el detalle de cierre de caja. Ahora adjunta `sales` y `egresos`
    scopeados por turno + tenant.
    """
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM turns WHERE id = $1 AND business_id = $2", turn_id, b_id)
            if not row: raise HTTPException(404, detail="Turno no encontrado")
            sales = await conn.fetch(
                "SELECT id, total, payment, change_given, payment_method, is_fiado, fiado_name, operator, timestamp "
                "FROM sales WHERE turn_id = $1 AND business_id = $2 ORDER BY timestamp ASC",
                turn_id, b_id
            )
            egresos = await conn.fetch(
                "SELECT id, monto, motivo, type, operator, timestamp "
                "FROM egresos_caja WHERE turn_id = $1 AND business_id = $2 ORDER BY timestamp ASC",
                turn_id, b_id
            )
            detail = dict(row)
            detail["sales"] = [dict(r) for r in sales]
            detail["egresos"] = [dict(r) for r in egresos]
            detail["por_categoria"] = await _por_categoria_pg(conn, b_id, turn_id=turn_id)
            return detail
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM turns WHERE id=?", (turn_id,))
            row = await cur.fetchone()
            if not row: raise HTTPException(404, detail="Turno no encontrado")
            detail = row_to_dict(row, cur.description)
            cur = await db.execute(
                "SELECT id, total, payment, change_given, payment_method, is_fiado, fiado_name, operator, timestamp "
                "FROM sales WHERE turn_id = ? ORDER BY timestamp ASC",
                (turn_id,)
            )
            detail["sales"] = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            cur = await db.execute(
                "SELECT id, monto, motivo, type, operator, timestamp "
                "FROM egresos_caja WHERE turn_id = ? ORDER BY timestamp ASC",
                (turn_id,)
            )
            detail["egresos"] = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            detail["por_categoria"] = await _por_categoria_sqlite(db, turn_id=turn_id)
            return detail


@router.get("/api/customers", summary="Listar clientes")
async def list_customers(
    q: Optional[str] = Query(None),
    solo_deudores: bool = Query(False),
) -> list:
    """
    Por defecto devuelve TODOS los clientes.
    Con ?solo_deudores=true devuelve solo los que tienen balance > 0 (Cuentas corrientes).
    """
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            clauses = ["business_id = $1"]
            params = [b_id]; n = 2
            if solo_deudores:
                clauses.append("balance > 0")
            if q:
                clauses.append(f"(name ILIKE ${n} OR phone ILIKE ${n})")
                params.append(f"%{q}%"); n += 1
            order = "balance DESC" if solo_deudores else "name ASC"
            rows = await conn.fetch(
                f"SELECT * FROM customers WHERE {' AND '.join(clauses)} ORDER BY {order}",
                *params
            )
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            clauses = []; params = []
            if solo_deudores:
                clauses.append("balance > 0")
            if q:
                clauses.append("(name LIKE ? OR phone LIKE ?)")
                params.extend([f"%{q}%", f"%{q}%"])
            w = ("WHERE " + " AND ".join(clauses)) if clauses else ""
            order = "balance DESC" if solo_deudores else "name ASC"
            cur = await db.execute(f"SELECT * FROM customers {w} ORDER BY {order}", tuple(params))
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]


# ── Direcciones de cliente ─────────────────────────────────────

@router.get("/api/customers/{customer_id}/addresses", summary="Listar direcciones de un cliente")
async def list_customer_addresses(customer_id: int) -> list:
    from main import USE_PG, row_to_dict; import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT ca.* FROM customer_addresses ca JOIN customers c ON c.id = ca.customer_id WHERE ca.customer_id = $1 AND c.business_id = $2 ORDER BY ca.is_default DESC, ca.created_at ASC",
                customer_id, b_id
            )
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at ASC",
                (customer_id,)
            )
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]


@router.post("/api/customers/{customer_id}/addresses", summary="Agregar dirección a un cliente")
async def add_customer_address(customer_id: int, body: dict = Body(...)) -> dict:
    from main import USE_PG; import main
    b_id = _biz_id()
    label = (body.get("label") or "Dirección").strip()
    address = (body.get("address") or "").strip()
    if not address:
        raise HTTPException(400, detail="La dirección no puede estar vacía")
    is_default = bool(body.get("is_default", False))
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Verificar que el cliente pertenece al negocio
                ok = await conn.fetchval("SELECT id FROM customers WHERE id = $1 AND business_id = $2", customer_id, b_id)
                if not ok:
                    raise HTTPException(404, detail="Cliente no encontrado")
                if is_default:
                    await conn.execute("UPDATE customer_addresses SET is_default = false WHERE customer_id = $1", customer_id)
                row = await conn.fetchrow(
                    "INSERT INTO customer_addresses (business_id, customer_id, label, address, is_default) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                    b_id, customer_id, label, address, is_default
                )
                return {"id": row["id"], "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            if is_default:
                await db.execute("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?", (customer_id,))
            cur = await db.execute(
                "INSERT INTO customer_addresses (customer_id, label, address, is_default) VALUES (?,?,?,?)",
                (customer_id, label, address, 1 if is_default else 0)
            )
            await db.commit()
            return {"id": cur.lastrowid, "success": True}


@router.delete("/api/customers/addresses/{address_id}", summary="Eliminar dirección de un cliente")
async def delete_customer_address(address_id: int) -> dict:
    from main import USE_PG; import main
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            r = await conn.execute(
                "DELETE FROM customer_addresses ca USING customers c WHERE ca.id = $1 AND ca.customer_id = c.id AND c.business_id = $2",
                address_id, b_id
            )
            if r == "DELETE 0":
                raise HTTPException(404, detail="Dirección no encontrada")
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("DELETE FROM customer_addresses WHERE id = ?", (address_id,))
            await db.commit()
            return {"success": True}


@router.get("/api/customers/{customer_id}/transactions", summary="Transacciones de cliente")
async def customer_transactions(customer_id: int) -> list:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM customer_transactions WHERE customer_id = $1 AND business_id = $2 ORDER BY timestamp DESC",
                customer_id, b_id
            )
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY timestamp DESC", (customer_id,))
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.post("/api/customers", summary="Crear cliente")
async def create_customer(name: str = Body(...), phone: Optional[str] = Body(None),
                          amount: float = Body(0), operator: str = Body("Sistema"),
                          address: Optional[str] = Body(None), email: Optional[str] = Body(None),
                          dni_cuit: Optional[str] = Body(None)) -> dict:
    b_id = _biz_id()
    try:
        debt = round(float(amount or 0), 2)
    except (TypeError, ValueError):
        debt = 0
    if debt < 0:
        debt = 0
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    "INSERT INTO customers (business_id, name, phone, balance, address, email, dni_cuit) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
                    b_id, name.strip(), phone, debt, address or '', email or '', dni_cuit or ''
                )
                if debt > 0:
                    await conn.execute(
                        "INSERT INTO customer_transactions (business_id, customer_id, amount, type, description, operator) VALUES ($1,$2,$3,'charge',$4,$5)",
                        b_id, row["id"], debt, "Saldo inicial", operator
                    )
            return {"id": row["id"], "name": name.strip(), "phone": phone, "balance": debt}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("INSERT INTO customers (name, phone, balance, address, email, dni_cuit) VALUES (?,?,?,?,?,?)", (name.strip(), phone, debt, address or '', email or '', dni_cuit or ''))
            cid = cur.lastrowid
            if debt > 0:
                await db.execute(
                    "INSERT INTO customer_transactions (customer_id, amount, type, description, operator) VALUES (?,?,?,?,?)",
                    (cid, debt, 'charge', "Saldo inicial", operator)
                )
            await db.commit()
            return {"id": cid, "name": name.strip(), "phone": phone, "balance": debt}


@router.patch("/api/customers/{customer_id}", summary="Actualizar datos de un cliente")
@limiter.limit("30/minute")
async def update_customer(request: Request, customer_id: int, body: dict = Body(...)) -> dict:
    """Actualiza campos opcionales del cliente (address, phone, name). Solo pisa los campos que vienen."""
    from main import USE_PG, row_to_dict; import main
    b_id = _biz_id()
    allowed = {"address", "phone", "name", "email", "dni_cuit"}
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        raise HTTPException(400, detail="Sin campos para actualizar")
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            sets = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates))
            vals = list(updates.values())
            row = await conn.fetchrow(
                f"UPDATE customers SET {sets} WHERE id = $1 AND business_id = ${len(vals)+2} RETURNING id",
                customer_id, *vals, b_id
            )
            if not row:
                raise HTTPException(404, detail="Cliente no encontrado")
            return {"ok": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            sets = ", ".join(f"{k} = ?" for k in updates)
            vals = list(updates.values())
            await db.execute(
                f"UPDATE customers SET {sets} WHERE id = ?",
                (*vals, customer_id)
            )
            await db.commit()
        return {"ok": True}


@router.get("/api/customers/{customer_id}/obras", summary="Obras de un cliente")
async def customer_obras(customer_id: int) -> list:
    from main import USE_PG, row_to_dict; import main
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM obras WHERE customer_id = $1 ORDER BY created_at DESC", customer_id)
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM obras WHERE customer_id = ? ORDER BY created_at DESC", (customer_id,))
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]


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
                # El efectivo del abono entra al cajón: ingreso del turno abierto actual.
                if amount > 0:
                    open_turn = await _open_turn_pg(conn, b_id)
                    if open_turn:
                        await conn.execute(
                            "INSERT INTO egresos_caja (business_id, turn_id, monto, motivo, type, operator) VALUES ($1,$2,$3,$4,'ingreso',$5)",
                            b_id, open_turn, -amount, desc, operator
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
            # El efectivo del abono entra al cajón: ingreso del turno abierto actual.
            if amount > 0:
                open_turn = await _open_turn_sqlite(db)
                if open_turn:
                    await db.execute(
                        "INSERT INTO egresos_caja (turn_id, monto, motivo, type, operator) VALUES (?,?,?,'ingreso',?)",
                        (open_turn, -amount, desc, operator)
                    )
            await db.commit()
        return {"success": True, "new_balance": new_balance}

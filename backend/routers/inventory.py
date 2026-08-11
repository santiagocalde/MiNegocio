from fastapi import APIRouter, HTTPException, Depends, Query, Body, Request
from pydantic import BaseModel
from typing import Optional, List
import hmac
import aiosqlite
import bcrypt
import main
from main import row_to_dict, USE_PG, get_current_business, check_plan_limits

router = APIRouter()


def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


def _pin_matches(pin: str, stored: str) -> bool:
    """Compara un PIN contra el hash guardado (bcrypt), con fallback constant-time
    para PINs legacy en texto plano."""
    stored = stored or ""
    if stored.startswith("$2b$"):
        try:
            return bcrypt.checkpw(pin.encode(), stored.encode())
        except Exception:
            return False
    return hmac.compare_digest(pin, stored)


async def _require_supervisor_pin_pg(conn, pin: Optional[str], b_id) -> None:
    """Exige el PIN de un operador admin/manager del negocio. Lanza 403 si falta
    o no corresponde a ningún supervisor. Obligatorio para anular ventas."""
    pin = str(pin or "").strip()
    if not pin:
        raise HTTPException(403, detail="Se requiere el PIN de un administrador para anular")
    rows = await conn.fetch(
        "SELECT pin, role FROM operators WHERE business_id = $1 AND role IN ('admin','manager')", b_id
    )
    if any(_pin_matches(pin, r["pin"]) for r in rows):
        return
    raise HTTPException(403, detail="PIN de administrador incorrecto")


async def _require_supervisor_pin_sqlite(db, pin: Optional[str]) -> None:
    pin = str(pin or "").strip()
    if not pin:
        raise HTTPException(403, detail="Se requiere el PIN de un administrador para anular")
    cur = await db.execute("SELECT pin FROM operators WHERE role IN ('admin','manager')")
    rows = await cur.fetchall()
    if any(_pin_matches(pin, r[0]) for r in rows):
        return
    raise HTTPException(403, detail="PIN de administrador incorrecto")


@router.get("/api/movements", summary="Listar movimientos de stock")
async def list_movements(limit: int = 100) -> list:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM stock_movements WHERE business_id = $1 ORDER BY timestamp DESC LIMIT $2",
                b_id, limit
            )
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM stock_movements ORDER BY timestamp DESC LIMIT ?", (limit,))
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.get("/api/sales/fiado", summary="Listar ventas fiadas pendientes")
async def list_fiados() -> list:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM sales WHERE business_id = $1 AND is_fiado = 1 AND cobrado = 0 ORDER BY timestamp DESC",
                b_id
            )
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM sales WHERE is_fiado = 1 AND cobrado = 0 ORDER BY timestamp DESC")
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.post("/api/sales/{sale_id}/cobrar-fiado", summary="Marcar fiado como cobrado")
async def cobrar_fiado(sale_id: int) -> dict:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute("UPDATE sales SET cobrado = 1 WHERE id = $1 AND business_id = $2", sale_id, b_id)
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("UPDATE sales SET cobrado = 1 WHERE id = ?", (sale_id,))
            await db.commit()
            return {"success": True}


@router.post("/api/sales/{sale_id}/revert-item", summary="Revertir item de venta")
async def revert_sale_item(sale_id: int, body: dict) -> dict:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            # Devolver un ítem (revierte stock y baja deuda de fiado) requiere el
            # PIN de un supervisor. Obligatorio: antes el check estaba dentro de
            # `if op_id and op_pin` y se salteaba omitiendo esos campos.
            await _require_supervisor_pin_pg(conn, body.get("supervisor_pin") or body.get("operator_pin"), b_id)

            async with conn.transaction():
                sale = await conn.fetchrow("SELECT id, reverted FROM sales WHERE id = $1 AND business_id = $2", sale_id, b_id)
                if not sale: raise HTTPException(404, detail="Venta no encontrada")
                if sale["reverted"] == 1: raise HTTPException(400, detail="Venta ya anulada")

                item = await conn.fetchrow(
                    "SELECT quantity FROM sale_items WHERE sale_id = $1 AND product_id = $2",
                    sale_id, body.get("product_id")
                )
                if not item: raise HTTPException(404, detail="Producto no encontrado en venta")

                qty = body.get("quantity", 1)
                await conn.execute("UPDATE products SET stock = stock + $1 WHERE id = $2", qty, body.get("product_id"))
                await conn.execute(
                    "INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, reason, operator, source_id) VALUES ($1,$2,'devolucion',$3,$4,$5,$6)",
                    b_id, body.get("product_id"), qty, f"Devolucion parcial Venta #{sale_id}", body.get("operator", "Sistema"),
                    f"revert-{sale_id}-{body.get('product_id')}"
                )

                fiado = await conn.fetchrow("SELECT is_fiado, fiado_name FROM sales WHERE id = $1", sale_id)
                if fiado and fiado["is_fiado"] == 1 and fiado["fiado_name"]:
                    price_row = await conn.fetchrow(
                        "SELECT unit_price FROM sale_items WHERE sale_id = $1 AND product_id = $2",
                        sale_id, body.get("product_id")
                    )
                    if price_row:
                        refund = round(price_row["unit_price"] * qty, 2)
                        cust = await conn.fetchrow("SELECT id FROM customers WHERE name = $1 AND business_id = $2", fiado["fiado_name"], b_id)
                        if cust:
                            await conn.execute("UPDATE customers SET balance = GREATEST(0, balance - $1) WHERE id = $2", refund, cust["id"])
                            await conn.execute(
                                "INSERT INTO customer_transactions (business_id, customer_id, amount, type, description, operator) VALUES ($1,$2,$3,'credit',$4,$5)",
                                b_id, cust["id"], refund, f"Devolucion parcial Venta #{sale_id}", body.get("operator", "Sistema")
                            )
            return {"success": True}
    else:
        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await _require_supervisor_pin_sqlite(db, body.get("supervisor_pin") or body.get("operator_pin"))
                await db.execute("BEGIN IMMEDIATE")
                cur = await db.execute("SELECT id, reverted FROM sales WHERE id = ?", (sale_id,))
                sale = await cur.fetchone()
                if not sale: raise HTTPException(404, detail="Venta no encontrada")
                if sale[1] == 1: raise HTTPException(400, detail="Venta ya anulada")
                cur = await db.execute("SELECT quantity FROM sale_items WHERE sale_id = ? AND product_id = ?", (sale_id, body.get("product_id")))
                item = await cur.fetchone()
                if not item: raise HTTPException(404, detail="Producto no encontrado")
                qty = body.get("quantity", 1)
                await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (qty, body.get("product_id")))
                await db.execute(
                    "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                    (body.get("product_id"), "devolucion", qty, f"Devolucion parcial Venta #{sale_id}", body.get("operator", "Sistema"))
                )
                await db.commit()
            return {"success": True}


@router.post("/api/sales/{sale_id}/revert", summary="Anular venta completa")
async def revert_sale(sale_id: int, body: dict = Body(default={}), operator: str = Query("Sistema")) -> dict:
    # Anular una venta completa (devuelve todo el stock) requiere el PIN de un
    # supervisor. El PIN viaja en el body, nunca en la URL/query.
    pin = body.get("supervisor_pin") or body.get("operator_pin")
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await _require_supervisor_pin_pg(conn, pin, b_id)
            async with conn.transaction():
                sale = await conn.fetchrow("SELECT * FROM sales WHERE id = $1 AND business_id = $2", sale_id, b_id)
                if not sale: raise HTTPException(404, detail="Venta no encontrada")
                if sale["reverted"] == 1: raise HTTPException(400, detail="Venta ya anulada")
                items = await conn.fetch("SELECT * FROM sale_items WHERE sale_id = $1", sale_id)
                for it in items:
                    await conn.execute("UPDATE products SET stock = stock + $1 WHERE id = $2", it["quantity"], it["product_id"])
                await conn.execute("UPDATE sales SET reverted = 1 WHERE id = $1", sale_id)
            return {"success": True}
    else:
        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await _require_supervisor_pin_sqlite(db, pin)
                await db.execute("BEGIN IMMEDIATE")
                sale = await db.execute("SELECT * FROM sales WHERE id = ?", (sale_id,))
                s = await sale.fetchone()
                if not s: raise HTTPException(404, detail="Venta no encontrada")
                items = await db.execute("SELECT * FROM sale_items WHERE sale_id = ?", (sale_id,))
                for it in await items.fetchall():
                    await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (it[4], it[3]))
                await db.execute("UPDATE sales SET reverted = 1 WHERE id = ?", (sale_id,))
                await db.commit()
            return {"success": True}


@router.post("/api/egresos", summary="Registrar egreso")
async def create_egreso(body: dict = Body(...)) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            monto = body.get("monto")
            motivo = body.get("motivo") or ""
            tipo = body.get("type", "gasto")
            operador = body.get("operator", "Sistema")
            await conn.execute(
                "INSERT INTO egresos_caja (business_id, turn_id, monto, motivo, type, operator) VALUES ($1,$2,$3,$4,$5,$6)",
                b_id, body.get("turn_id"), monto, motivo, tipo, operador
            )
            await conn.execute(
                "INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                b_id, "egreso_" + tipo, operador,
                f"{'Gasto' if tipo == 'gasto' else 'Retiro del dueño'} — ${float(monto or 0):.0f} ({motivo})"
            )
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            monto = body.get("monto")
            motivo = body.get("motivo") or ""
            tipo = body.get("type", "gasto")
            operador = body.get("operator", "Sistema")
            await db.execute(
                "INSERT INTO egresos_caja (turn_id, monto, motivo, type, operator) VALUES (?,?,?,?,?)",
                (body.get("turn_id"), monto, motivo, tipo, operador)
            )
            await db.execute(
                "INSERT INTO audit_log (action, operator, details) VALUES (?,?,?)",
                ("egreso_" + tipo, operador, f"{'Gasto' if tipo == 'gasto' else 'Retiro del dueño'} — ${float(monto or 0):.0f} ({motivo})")
            )
            await db.commit()
            return {"success": True}


@router.get("/api/egresos", summary="Listar egresos")
async def list_egresos(turn_id: Optional[int] = Query(None)) -> list:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            if turn_id:
                rows = await conn.fetch("SELECT * FROM egresos_caja WHERE business_id = $1 AND turn_id = $2", b_id, turn_id)
            else:
                rows = await conn.fetch("SELECT * FROM egresos_caja WHERE business_id = $1 ORDER BY timestamp DESC", b_id)
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            if turn_id:
                cur = await db.execute("SELECT * FROM egresos_caja WHERE turn_id = ?", (turn_id,))
            else:
                cur = await db.execute("SELECT * FROM egresos_caja ORDER BY timestamp DESC")
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.get("/api/suppliers", summary="Listar proveedores")
async def list_suppliers() -> list:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM suppliers WHERE business_id = $1 ORDER BY name", b_id)
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM suppliers ORDER BY name")
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.post("/api/suppliers", summary="Crear proveedor")
async def create_supplier(body: dict) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "INSERT INTO suppliers (business_id, name, contact, phone) VALUES ($1,$2,$3,$4) RETURNING id",
                b_id, body.get("name"), body.get("contact"), body.get("phone")
            )
            return {"id": row["id"], **body}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "INSERT INTO suppliers (name, contact, phone) VALUES (?,?,?)",
                (body.get("name"), body.get("contact"), body.get("phone"))
            )
            await db.commit()
            return {"id": cur.lastrowid, **body}


@router.post("/api/suppliers/{supplier_id}/pay", summary="Registrar abono a proveedor")
async def pay_supplier(supplier_id: int, body: dict) -> dict:
    """Reduce supplier debt and create an egreso (expense) record."""
    b_id = _biz_id()
    amount = float(body.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, detail="El monto debe ser mayor a cero.")
    motivo = body.get("motivo") or "Abono a proveedor"
    operator = body.get("operator") or "Sistema"
    turn_id = body.get("turn_id")

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Reduce debt
                result = await conn.fetchrow(
                    "UPDATE suppliers SET debt = GREATEST(COALESCE(debt, 0) - $1, 0) WHERE id = $2 AND business_id = $3 RETURNING debt",
                    amount, supplier_id, b_id
                )
                if not result:
                    raise HTTPException(404, detail="Proveedor no encontrado.")
                # Record egreso (expense)
                await conn.execute(
                    "INSERT INTO egresos_caja (business_id, turn_id, monto, motivo, type, operator) VALUES ($1,$2,$3,$4,$5,$6)",
                    b_id, turn_id, amount, motivo, "pago_proveedor", operator
                )
                return {"success": True, "new_debt": float(result["debt"])}
    else:
        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                curs = await db.execute("SELECT id, debt FROM suppliers WHERE id = ?", (supplier_id,))
                row = await curs.fetchone()
                if not row:
                    await db.rollback()
                    raise HTTPException(404, detail="Proveedor no encontrado.")
                current = row[1] or 0
                new_debt = max(current - amount, 0)
                await db.execute("UPDATE suppliers SET debt = ? WHERE id = ?", (new_debt, supplier_id))
                await db.execute(
                    "INSERT INTO egresos_caja (turn_id, monto, motivo, type, operator) VALUES (?,?,?,?,?)",
                    (turn_id, amount, motivo, "pago_proveedor", operator)
                )
                await db.commit()
                return {"success": True, "new_debt": new_debt}


@router.post("/api/purchases", summary="Crear compra (confirmed o pending)")
async def create_purchase(request: Request, body: dict) -> dict:
    """
    status='confirmed' (default) → actualiza stock, deuda de proveedor y caja.
    status='pending'             → solo guarda el pedido; no toca stock ni deuda.
    """
    b_id = _biz_id()
    is_pending = (body.get("status") or "confirmed") == "pending"
    if USE_PG:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            biz = await get_current_business(auth)
            if biz: await check_plan_limits("purchases", biz)
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                cost = sum((i.get("unit_cost", 0) or 0) * (i.get("quantity", 0) or 0) for i in body.get("items", []))
                row = await conn.fetchrow(
                    "INSERT INTO purchases (business_id, supplier_id, invoice_number, total_cost, operator, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
                    b_id, body.get("supplier_id"), body.get("invoice_number"),
                    round(cost, 2), body.get("operator", "Sistema"),
                    "pending" if is_pending else "confirmed"
                )
                purchase_id = row["id"]
                for item in body.get("items", []):
                    await conn.execute(
                        "INSERT INTO purchase_items (business_id, purchase_id, product_id, product_name, quantity, unit_cost) VALUES ($1,$2,$3,$4,$5,$6)",
                        b_id, purchase_id, item.get("product_id"), item.get("product_name"),
                        item.get("quantity"), item.get("unit_cost", 0)
                    )
                    if not is_pending and item.get("product_id"):
                        qty = item.get("quantity", 0)
                        cost_val = item.get("unit_cost", 0)
                        await conn.execute(
                            "UPDATE products SET stock = stock + $1, cost_price = $2, updated_at = now() WHERE id = $3",
                            qty, cost_val, item.get("product_id")
                        )
                        await conn.execute(
                            "INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, reason, operator) VALUES ($1,$2,'entrada',$3,$4,$5)",
                            b_id, item["product_id"], qty,
                            f"Compra #{purchase_id} — {item.get('product_name', '')}",
                            body.get("operator", "Sistema"),
                        )
                if not is_pending:
                    if not body.get("paid_from_register"):
                        await conn.execute(
                            "UPDATE suppliers SET debt = COALESCE(debt, 0) + $1 WHERE id = $2",
                            round(cost, 2), body.get("supplier_id")
                        )
                    elif body.get("paid_from_register"):
                        turn_id = body.get("turn_id") or await conn.fetchval(
                            "SELECT id FROM turns WHERE closed_at IS NULL AND business_id = $1 ORDER BY id DESC LIMIT 1", b_id
                        )
                        await conn.execute(
                            "INSERT INTO egresos_caja (business_id, turn_id, monto, motivo, type, operator) VALUES ($1,$2,$3,$4,$5,$6)",
                            b_id, turn_id, round(cost, 2), f"Compra #{purchase_id}", "pago_proveedor", body.get("operator", "Sistema")
                        )
                await conn.execute(
                    "INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "compra_created", body.get("operator", "Sistema"),
                    f"Compra #{purchase_id} ({'PENDIENTE' if is_pending else 'confirmada'}) — ${round(cost, 2)}",
                )
                return {"id": purchase_id, "total_cost": round(cost, 2), "status": "pending" if is_pending else "confirmed"}
    else:
        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                cost = sum((i.get("unit_cost", 0) or 0) * (i.get("quantity", 0) or 0) for i in body.get("items", []))
                cur = await db.execute(
                    "INSERT INTO purchases (supplier_id, invoice_number, total_cost, operator, status) VALUES (?,?,?,?,?)",
                    (body.get("supplier_id"), body.get("invoice_number"), round(cost, 2),
                     body.get("operator", "Sistema"), "pending" if is_pending else "confirmed")
                )
                purchase_id = cur.lastrowid
                for item in body.get("items", []):
                    await db.execute(
                        "INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_cost) VALUES (?,?,?,?,?)",
                        (purchase_id, item.get("product_id"), item.get("product_name"),
                         item.get("quantity"), item.get("unit_cost", 0))
                    )
                    if not is_pending and item.get("product_id"):
                        qty = item.get("quantity", 0)
                        await db.execute(
                            "UPDATE products SET stock = stock + ?, cost_price = ?, updated_at = datetime('now','localtime') WHERE id = ?",
                            (qty, item.get("unit_cost", 0), item.get("product_id"))
                        )
                        await db.execute(
                            "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                            (item["product_id"], "entrada", qty,
                             f"Compra #{purchase_id} — {item.get('product_name', '')}",
                             body.get("operator", "Sistema")),
                        )
                if not is_pending:
                    if not body.get("paid_from_register"):
                        await db.execute(
                            "UPDATE suppliers SET debt = COALESCE(debt, 0) + ? WHERE id = ?",
                            (round(cost, 2), body.get("supplier_id"))
                        )
                    elif body.get("paid_from_register"):
                        curt = await db.execute("SELECT id FROM turns WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1")
                        rowt = await curt.fetchone()
                        turn_id = body.get("turn_id") or (rowt[0] if rowt else None)
                        await db.execute(
                            "INSERT INTO egresos_caja (turn_id, monto, motivo, type, operator) VALUES (?,?,?,?,?)",
                            (turn_id, round(cost, 2), f"Compra #{purchase_id}", "pago_proveedor", body.get("operator", "Sistema"))
                        )
                await db.execute(
                    "INSERT INTO audit_log (action, operator, details) VALUES (?,?,?)",
                    ("compra_created", body.get("operator", "Sistema"),
                     f"Compra #{purchase_id} ({'PENDIENTE' if is_pending else 'confirmada'}) — ${round(cost, 2)}"),
                )
                await db.commit()
                return {"id": purchase_id, "total_cost": round(cost, 2), "status": "pending" if is_pending else "confirmed"}


@router.post("/api/purchases/{purchase_id}/confirm", summary="Confirmar entrada de pedido pendiente")
async def confirm_purchase(request: Request, purchase_id: int, body: dict) -> dict:
    """
    Confirma la entrada de un pedido pendiente.
    Actualiza stock, costo unitario de cada item y deuda del proveedor.
    body.items: [{product_id, quantity, unit_cost}, ...]  — permite ajustar cantidades/costos.
    """
    b_id = _biz_id()
    operator = body.get("operator", "Sistema")
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, status, supplier_id, total_cost FROM purchases WHERE id = $1 AND business_id = $2",
                purchase_id, b_id
            )
            if not row: raise HTTPException(404)
            if row["status"] == "confirmed": raise HTTPException(400, detail="Esta compra ya fue confirmada")
            async with conn.transaction():
                # Actualizar items (pueden venir precios reales)
                items = body.get("items", [])
                total = 0.0
                for it in items:
                    qty  = float(it.get("quantity") or 0)
                    cost = float(it.get("unit_cost") or 0)
                    pid  = it.get("product_id")
                    total += qty * cost
                    await conn.execute(
                        "UPDATE purchase_items SET quantity = $1, unit_cost = $2 WHERE purchase_id = $3 AND product_id = $4",
                        qty, cost, purchase_id, pid
                    )
                    if pid:
                        await conn.execute(
                            "UPDATE products SET stock = stock + $1, cost_price = $2, updated_at = now() WHERE id = $3 AND business_id = $4",
                            qty, cost, pid, b_id
                        )
                        await conn.execute(
                            "INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, reason, operator) VALUES ($1,$2,'entrada',$3,$4,$5)",
                            b_id, pid, qty, f"Pedido confirmado #{purchase_id}", operator
                        )
                # Actualizar total y marcar confirmed
                await conn.execute(
                    "UPDATE purchases SET status = 'confirmed', total_cost = $1 WHERE id = $2 AND business_id = $3",
                    round(total, 2), purchase_id, b_id
                )
                # Incrementar deuda del proveedor
                if row["supplier_id"]:
                    await conn.execute(
                        "UPDATE suppliers SET debt = COALESCE(debt, 0) + $1 WHERE id = $2",
                        round(total, 2), row["supplier_id"]
                    )
                await conn.execute(
                    "INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                    b_id, "compra_confirmed", operator,
                    f"Pedido #{purchase_id} confirmado — ${round(total, 2)}"
                )
            return {"ok": True, "total_cost": round(total, 2)}
    else:
        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                cur = await db.execute(
                    "SELECT id, status, supplier_id, total_cost FROM purchases WHERE id = ?", (purchase_id,)
                )
                row = await cur.fetchone()
                if not row: raise HTTPException(404)
                if row[1] == "confirmed": raise HTTPException(400, detail="Esta compra ya fue confirmada")
                items = body.get("items", [])
                total = 0.0
                for it in items:
                    qty  = float(it.get("quantity") or 0)
                    cost = float(it.get("unit_cost") or 0)
                    pid  = it.get("product_id")
                    total += qty * cost
                    await db.execute(
                        "UPDATE purchase_items SET quantity = ?, unit_cost = ? WHERE purchase_id = ? AND product_id = ?",
                        (qty, cost, purchase_id, pid)
                    )
                    if pid:
                        await db.execute(
                            "UPDATE products SET stock = stock + ?, cost_price = ?, updated_at = datetime('now','localtime') WHERE id = ?",
                            (qty, cost, pid)
                        )
                        await db.execute(
                            "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                            (pid, "entrada", qty, f"Pedido confirmado #{purchase_id}", operator)
                        )
                await db.execute(
                    "UPDATE purchases SET status = 'confirmed', total_cost = ? WHERE id = ?",
                    (round(total, 2), purchase_id)
                )
                if row[2]:  # supplier_id
                    await db.execute(
                        "UPDATE suppliers SET debt = COALESCE(debt, 0) + ? WHERE id = ?",
                        (round(total, 2), row[2])
                    )
                await db.execute(
                    "INSERT INTO audit_log (action, operator, details) VALUES (?,?,?)",
                    ("compra_confirmed", operator, f"Pedido #{purchase_id} confirmado — ${round(total, 2)}")
                )
                await db.commit()
        return {"ok": True, "total_cost": round(total, 2)}


@router.get("/api/purchases", summary="Listar compras")
async def list_purchases(limit: int = 50) -> list:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM purchases WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2", b_id, limit)
            purchases = [dict(r) for r in rows]
            for p in purchases:
                items = await conn.fetch("SELECT * FROM purchase_items WHERE purchase_id = $1", p["id"])
                p["items"] = [dict(i) for i in items]
            return purchases
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            # SQLite usa 'timestamp'; PG usa 'created_at'. Aliaseamos para que el
            # frontend reciba created_at igual y no crashee en modo local/offline.
            cur = await db.execute("SELECT *, timestamp AS created_at FROM purchases ORDER BY timestamp DESC LIMIT ?", (limit,))
            rows = await cur.fetchall()
            purchases = [row_to_dict(r, cur.description) for r in rows]
            for p in purchases:
                cur2 = await db.execute("SELECT * FROM purchase_items WHERE purchase_id = ?", (p["id"],))
                p["items"] = [row_to_dict(r, cur2.description) for r in await cur2.fetchall()]
            return purchases


@router.get("/api/stock-alerts", summary="Alertas de stock")
async def stock_alerts() -> dict:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            empty = await conn.fetch("SELECT * FROM products WHERE business_id = $1 AND is_active = 1 AND stock = 0", b_id)
            low = await conn.fetch("SELECT * FROM products WHERE business_id = $1 AND is_active = 1 AND stock > 0 AND stock <= min_stock", b_id)
            sin_costo = await conn.fetch("SELECT * FROM products WHERE business_id = $1 AND is_active = 1 AND stock > 0 AND COALESCE(cost_price, 0) = 0", b_id)
            return {"empty": [dict(r) for r in empty], "low": [dict(r) for r in low], "sin_costo": [dict(r) for r in sin_costo]}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM products WHERE is_active = 1 AND stock = 0")
            empty = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            cur = await db.execute("SELECT * FROM products WHERE is_active = 1 AND stock > 0 AND stock <= min_stock")
            low = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            cur = await db.execute("SELECT * FROM products WHERE is_active = 1 AND stock > 0 AND COALESCE(cost_price, 0) = 0")
            sin_costo = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            return {"empty": empty, "low": low, "sin_costo": sin_costo}

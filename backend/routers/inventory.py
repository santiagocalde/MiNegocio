from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel
from typing import Optional, List
import aiosqlite
import main
from main import row_to_dict, USE_PG

router = APIRouter()


def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


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


@router.patch("/api/sales/{sale_id}/cobrar-fiado", summary="Marcar fiado como cobrado")
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


@router.patch("/api/sales/{sale_id}/revert-item", summary="Revertir item de venta")
async def revert_sale_item(sale_id: int, body: dict) -> dict:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            # Validar PIN supervisor
            op_id = body.get("operator_id")
            op_pin = body.get("operator_pin")
            if op_id and op_pin:
                op_row = await conn.fetchrow("SELECT pin, role FROM operators WHERE id = $1 AND business_id = $2", op_id, b_id)
                if not op_row or (op_row["role"] not in ("admin", "manager")):
                    raise HTTPException(403, detail="Solo administradores pueden anular ventas")
                import bcrypt
                if not bcrypt.checkpw(op_pin.encode(), op_row["pin"].encode()):
                    raise HTTPException(403, detail="PIN incorrecto")

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


@router.patch("/api/sales/{sale_id}/revert", summary="Anular venta completa")
async def revert_sale(sale_id: int, operator: str = Query("Sistema")) -> dict:
    if USE_PG:
        b_id = _biz_id()
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
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
async def create_egreso(body: dict) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO egresos_caja (business_id, turn_id, monto, motivo, type, operator) VALUES ($1,$2,$3,$4,$5,$6)",
                b_id, body.get("turn_id"), body.get("monto"), body.get("motivo"), body.get("type", "gasto"), body.get("operator", "Sistema")
            )
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute(
                "INSERT INTO egresos_caja (turn_id, monto, motivo, type, operator) VALUES (?,?,?,?,?)",
                (body.get("turn_id"), body.get("monto"), body.get("motivo"), body.get("type", "gasto"), body.get("operator", "Sistema"))
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


@router.post("/api/purchases", summary="Crear compra")
async def create_purchase(body: dict) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                cost = sum((i.get("unit_cost", 0) or 0) * (i.get("quantity", 0) or 0) for i in body.get("items", []))
                row = await conn.fetchrow(
                    "INSERT INTO purchases (business_id, supplier_id, invoice_number, total_cost, operator) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                    b_id, body.get("supplier_id"), body.get("invoice_number"), round(cost, 2), body.get("operator", "Sistema")
                )
                purchase_id = row["id"]
                for item in body.get("items", []):
                    await conn.execute(
                        "INSERT INTO purchase_items (business_id, purchase_id, product_id, product_name, quantity, unit_cost) VALUES ($1,$2,$3,$4,$5,$6)",
                        b_id, purchase_id, item.get("product_id"), item.get("product_name"), item.get("quantity"), item.get("unit_cost")
                    )
                    if item.get("product_id"):
                        qty = item.get("quantity", 0)
                        cost_val = item.get("unit_cost", 0)
                        await conn.execute(
                            "UPDATE products SET stock = stock + $1, cost_price = $2, updated_at = now() WHERE id = $3",
                            qty, cost_val, item.get("product_id")
                        )
                if body.get("paid_from_register"):
                    await conn.execute(
                        "INSERT INTO egresos_caja (business_id, monto, motivo, type, operator) VALUES ($1,$2,$3,$4,$5)",
                        b_id, round(cost, 2), f"Compra #{purchase_id}", "pago_proveedor", body.get("operator", "Sistema")
                    )
                return {"id": purchase_id, "total_cost": round(cost, 2)}
    else:
        async with main.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                cost = sum((i.get("unit_cost", 0) or 0) * (i.get("quantity", 0) or 0) for i in body.get("items", []))
                cur = await db.execute(
                    "INSERT INTO purchases (supplier_id, invoice_number, total_cost, operator) VALUES (?,?,?,?)",
                    (body.get("supplier_id"), body.get("invoice_number"), round(cost, 2), body.get("operator", "Sistema"))
                )
                purchase_id = cur.lastrowid
                for item in body.get("items", []):
                    await db.execute(
                        "INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_cost) VALUES (?,?,?,?,?)",
                        (purchase_id, item.get("product_id"), item.get("product_name"), item.get("quantity"), item.get("unit_cost"))
                    )
                    if item.get("product_id"):
                        await db.execute(
                            "UPDATE products SET stock = stock + ?, cost_price = ?, updated_at = datetime('now','localtime') WHERE id = ?",
                            (item.get("quantity", 0), item.get("unit_cost", 0), item.get("product_id"))
                        )
                if body.get("paid_from_register"):
                    await db.execute(
                        "INSERT INTO egresos_caja (monto, motivo, type, operator) VALUES (?,?,?,?)",
                        (round(cost, 2), f"Compra #{purchase_id}", "pago_proveedor", body.get("operator", "Sistema"))
                    )
                await db.commit()
                return {"id": purchase_id, "total_cost": round(cost, 2)}


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
            cur = await db.execute("SELECT * FROM purchases ORDER BY created_at DESC LIMIT ?", (limit,))
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
            return {"empty": [dict(r) for r in empty], "low": [dict(r) for r in low]}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM products WHERE is_active = 1 AND stock = 0")
            empty = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            cur = await db.execute("SELECT * FROM products WHERE is_active = 1 AND stock > 0 AND stock <= min_stock")
            low = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            return {"empty": empty, "low": low}

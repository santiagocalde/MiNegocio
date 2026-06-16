from fastapi import APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import aiosqlite
import main
from main import row_to_dict, USE_PG

router = APIRouter()


def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


@router.get("/api/categories", summary="Listar categorias")
async def list_categories() -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT id, name FROM categories WHERE business_id = $1 ORDER BY name", b_id)
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT id, name FROM categories ORDER BY name")
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

@router.post("/api/categories", summary="Crear categoria")
async def create_category(body: dict = Body(...)) -> dict:
    name = body.get("name", "").strip()
    if not name: raise HTTPException(400, "Nombre requerido")
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("INSERT INTO categories (business_id, name) VALUES ($1, $2) RETURNING id", b_id, name)
            return {"id": row["id"], "name": name}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("INSERT INTO categories (name) VALUES (?)", (name,))
            await db.commit()
            return {"id": cur.lastrowid, "name": name}



@router.get("/api/products", summary="Listar productos")
async def list_products(q: Optional[str] = Query(None), limit: int = Query(500), sucursal_id: Optional[int] = Query(None)) -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            if q:
                rows = await conn.fetch(
                    "SELECT * FROM products WHERE business_id = $1 AND is_active = 1 AND (code ILIKE $2 OR name ILIKE $2) ORDER BY name LIMIT $3",
                    b_id, f"%{q}%", limit
                )
            else:
                rows = await conn.fetch(
                    "SELECT * FROM products WHERE business_id = $1 AND is_active = 1 ORDER BY name LIMIT $2",
                    b_id, limit
                )
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            if q:
                cur = await db.execute(
                    "SELECT * FROM products WHERE is_active = 1 AND (code LIKE ? OR name LIKE ?) ORDER BY name LIMIT ?",
                    (f"%{q}%", f"%{q}%", limit)
                )
            else:
                cur = await db.execute("SELECT * FROM products WHERE is_active = 1 ORDER BY name LIMIT ?", (limit,))
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.get("/api/products/dead-stock", summary="Productos sin rotacion")
async def get_dead_stock(days: int = 30) -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT p.* FROM products p WHERE p.business_id = $1 AND p.is_active = 1
                AND p.id NOT IN (SELECT DISTINCT product_id FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.timestamp > now() - interval '1 day' * $2)
                AND p.stock > 0 ORDER BY p.stock DESC
            """, b_id, days)
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(f"""
                SELECT p.* FROM products p WHERE p.is_active = 1
                AND p.id NOT IN (SELECT DISTINCT product_id FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.timestamp > datetime('now','-' || ? || ' days'))
                AND p.stock > 0 ORDER BY p.stock DESC
            """, (str(days),))
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.get("/api/products/price-suggestions", summary="Sugerencias de precio")
async def price_suggestions(threshold_pct: float = Query(15.0), category_id: Optional[int] = Query(None)) -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            where = "p.business_id = $1 AND p.is_active = 1 AND p.cost_price > 0"
            params = [b_id]
            n = 2
            if category_id:
                where += f" AND p.category_id = ${n}"
                params.append(category_id)
                n += 1
            rows = await conn.fetch(f"""
                SELECT p.*, ROUND((p.price - p.cost_price) / NULLIF(p.cost_price,0) * 100, 1) as current_margin,
                       ROUND(p.cost_price * (1 + ${n} / 100.0) / 10) * 10 as suggested_price
                FROM products p WHERE {where}
                ORDER BY current_margin ASC
            """, *params, threshold_pct)
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            where = "is_active = 1 AND cost_price > 0"
            params = []
            if category_id:
                where += " AND category_id = ?"
                params.append(category_id)
            rows = await db.execute_fetchall(f"""
                SELECT *, ROUND((price - cost_price) / NULLIF(cost_price,0) * 100, 1) as current_margin,
                       ROUND(cost_price * (1 + ? / 100.0) / 10) * 10 as suggested_price
                FROM products WHERE {where} ORDER BY current_margin ASC
            """, (threshold_pct, *params))
            return [row_to_dict(r, cur.description) for r in rows] if hasattr(rows[0], 'keys') else [dict(zip([c[0] for c in cur.description], r)) for r in rows]


@router.post("/api/products/import", summary="Importar productos CSV")
async def import_products_csv(csv_text: str = Body(..., media_type="text/plain")) -> dict:
    import csv, io
    b_id = _biz_id()
    text = csv_text
    delimiter = ',' if ',' in text.split('\n')[0] else ';'
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        raise HTTPException(400, detail="Archivo CSV vacio")

    parsed = []
    errors = []
    for i, row in enumerate(rows):
        try:
            code = row.get('code', '').strip()
            name = row.get('name', '').strip()
            if not code or not name: errors.append(f"Fila {i+2}: code y name requeridos"); continue
            price = float(row.get('price', 0))
            cost_price = float(row.get('cost_price', 0))
            stock = int(float(row.get('stock', 0)))
            min_stock = int(float(row.get('min_stock', 5)))
            iva = row.get('iva', '21%').strip()
            parsed.append((code, name, price, cost_price, stock, min_stock, iva))
        except Exception as e:
            errors.append(f"Fila {i+2}: {str(e)}")

    imported = 0
    if parsed:
        if USE_PG:
            from db_helpers import get_pg_pool
            pool = await get_pg_pool()
            async with pool.acquire() as conn:
                async with conn.transaction():
                    for code, name, price, cost, stock, min_stock, iva in parsed:
                        existing = await conn.fetchrow("SELECT id FROM products WHERE code = $1 AND business_id = $2", code, b_id)
                        if existing:
                            await conn.execute(
                                "UPDATE products SET name=$1, price=$2, cost_price=$3, stock=$4, min_stock=$5, iva=$6, updated_at=now() WHERE code=$7 AND business_id=$8",
                                name, price, cost, stock, min_stock, iva, code, b_id
                            )
                        else:
                            await conn.execute(
                                "INSERT INTO products (business_id, code, name, price, cost_price, stock, min_stock, iva) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                                b_id, code, name, price, cost, stock, min_stock, iva
                            )
                        imported += 1
        else:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                for code, name, price, cost, stock, min_stock, iva in parsed:
                    cur = await db.execute("SELECT id FROM products WHERE code = ?", (code,))
                    if await cur.fetchone():
                        await db.execute(
                            "UPDATE products SET name=?, price=?, cost_price=?, stock=?, min_stock=?, iva=?, updated_at=datetime('now','localtime') WHERE code=?",
                            (name, price, cost, stock, min_stock, iva, code)
                        )
                    else:
                        await db.execute(
                            "INSERT INTO products (code, name, price, cost_price, stock, min_stock, iva) VALUES (?,?,?,?,?,?,?)",
                            (code, name, price, cost, stock, min_stock, iva)
                        )
                    imported += 1
                await db.commit()
    return {"imported": imported, "errors": errors, "total_rows": len(rows)}


@router.post("/api/products", status_code=201, summary="Crear producto")
async def create_product(product: dict = Body(...)) -> Dict[str, Any]:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO products (business_id, code, name, price, cost_price, stock, min_stock, iva, category_id, is_virtual, parent_id, pack_size, expiry_date)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id
            """, b_id, product.get("code"), product.get("name"), product.get("price", 0), product.get("cost_price", 0),
                product.get("stock", 0), product.get("min_stock", 5), product.get("iva", "21%"),
                product.get("category_id"), 1 if product.get("is_virtual") else 0,
                product.get("parent_id"), product.get("pack_size", 1), product.get("expiry_date", ""))
            return {"id": row["id"], **product}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "INSERT INTO products (code,name,price,cost_price,stock,min_stock,iva,category_id,is_virtual,parent_id,pack_size,expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (product.get("code"), product.get("name"), product.get("price", 0), product.get("cost_price", 0),
                 product.get("stock", 0), product.get("min_stock", 5), product.get("iva", "21%"),
                 product.get("category_id"), 1 if product.get("is_virtual") else 0,
                 product.get("parent_id"), product.get("pack_size", 1), product.get("expiry_date", ""))
            )
            await db.commit()
            return {"id": cur.lastrowid, **product}


@router.patch("/api/products/{product_id}/price", summary="Actualizar precio")
async def update_price(product_id: int, body: dict) -> dict:
    price = body.get("price", 0)
    operator = body.get("operator", "Sistema")
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            old = await conn.fetchrow("SELECT price FROM products WHERE id = $1 AND business_id = $2", product_id, b_id)
            if not old: raise HTTPException(404, detail="Producto no encontrado")
            await conn.execute("UPDATE products SET price = $1, updated_at = now() WHERE id = $2", price, product_id)
            return {"success": True, "old_price": old["price"], "new_price": price}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT price FROM products WHERE id = ?", (product_id,))
            row = await cur.fetchone()
            if not row: raise HTTPException(404, detail="Producto no encontrado")
            await db.execute("UPDATE products SET price = ?, updated_at = datetime('now','localtime') WHERE id = ?", (price, product_id))
            await db.commit()
            return {"success": True, "old_price": row[0], "new_price": price}


@router.patch("/api/products/{product_id}/stock", summary="Actualizar stock")
async def update_stock(product_id: int, body: dict) -> dict:
    stock = body.get("stock", 0)
    operator = body.get("operator", "Sistema")
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            old = await conn.fetchrow("SELECT stock FROM products WHERE id = $1 AND business_id = $2", product_id, b_id)
            if not old: raise HTTPException(404, detail="Producto no encontrado")
            await conn.execute("UPDATE products SET stock = $1, updated_at = now() WHERE id = $2", stock, product_id)
            return {"success": True, "old_stock": old["stock"], "new_stock": stock}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT stock FROM products WHERE id = ?", (product_id,))
            row = await cur.fetchone()
            if not row: raise HTTPException(404, detail="Producto no encontrado")
            await db.execute("UPDATE products SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?", (stock, product_id))
            await db.commit()
            return {"success": True, "old_stock": row[0], "new_stock": stock}


@router.put("/api/products/{product_id}", summary="Actualizar producto")
async def update_product(product_id: int, body: dict) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            existing = await conn.fetchrow("SELECT id FROM products WHERE id = $1 AND business_id = $2", product_id, b_id)
            if not existing: raise HTTPException(404, detail="Producto no encontrado")
            sets = []
            params = []
            n = 1
            for k in ('code', 'name', 'price', 'cost_price', 'stock', 'min_stock', 'iva', 'category_id', 'expiry_date'):
                if k in body:
                    sets.append(f"{k} = ${n}")
                    params.append(body[k])
                    n += 1
            if not sets: return {"message": "Sin cambios"}
            params.append(product_id)
            await conn.execute(f"UPDATE products SET {', '.join(sets)}, updated_at = now() WHERE id = ${n}", *params)
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT id FROM products WHERE id = ?", (product_id,))
            if not await cur.fetchone(): raise HTTPException(404, detail="Producto no encontrado")
            sets = []
            params = []
            for k in ('code', 'name', 'price', 'cost_price', 'stock', 'min_stock', 'iva', 'category_id', 'expiry_date'):
                if k in body:
                    sets.append(f"{k} = ?")
                    params.append(body[k])
            if not sets: return {"message": "Sin cambios"}
            params.append(product_id)
            await db.execute(f"UPDATE products SET {', '.join(sets)}, updated_at = datetime('now','localtime') WHERE id = ?", tuple(params))
            await db.commit()
            return {"success": True}


@router.delete("/api/products/{product_id}", summary="Soft-delete producto")
async def delete_product(product_id: int) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute("UPDATE products SET is_active = 0, updated_at = now() WHERE id = $1 AND business_id = $2", product_id, b_id)
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("UPDATE products SET is_active = 0, updated_at = datetime('now','localtime') WHERE id = ?", (product_id,))
            await db.commit()
            return {"success": True}


@router.post("/api/products/batch-increase", summary="Aumento masivo de precios")
async def batch_increase(body: dict) -> dict:
    percentage = body.get("percentage", 0)
    category_id = body.get("category_id")
    b_id = _biz_id()
    multiplier = 1.0 + (percentage / 100.0)
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                if category_id:
                    result = await conn.execute(
                        "UPDATE products SET price = ROUND(price * $1, 2), updated_at = now() WHERE business_id = $2 AND category_id = $3 AND is_active = 1",
                        multiplier, b_id, category_id
                    )
                else:
                    result = await conn.execute(
                        "UPDATE products SET price = ROUND(price * $1, 2), updated_at = now() WHERE business_id = $2 AND is_active = 1",
                        multiplier, b_id
                    )
            return {"success": True, "message": f"Precios aumentados {percentage}%"}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            if category_id:
                await db.execute(
                    "UPDATE products SET price = ROUND(price * ?, 2), updated_at = datetime('now','localtime') WHERE category_id = ? AND is_active = 1",
                    (multiplier, category_id)
                )
            else:
                await db.execute(
                    "UPDATE products SET price = ROUND(price * ?, 2), updated_at = datetime('now','localtime') WHERE is_active = 1",
                    (multiplier,)
                )
            await db.commit()
            return {"success": True, "message": f"Precios aumentados {percentage}%"}


@router.post("/api/products/{product_id}/unpack", summary="Desarmar bulto virtual")
async def unpack_product(product_id: int, operator: str = Query("Sistema")) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("SELECT name, is_virtual, parent_id, pack_size, stock FROM products WHERE id = $1 AND business_id = $2", product_id, b_id)
                if not row: raise HTTPException(404, detail="Producto no encontrado")
                if not row["is_virtual"] or not row["parent_id"]: raise HTTPException(400, detail="No es un bulto virtual")
                if row["stock"] <= 0: raise HTTPException(400, detail="Sin stock del bulto")
                units = row["pack_size"] or 1
                await conn.execute("UPDATE products SET stock = stock - 1 WHERE id = $1", product_id)
                await conn.execute("UPDATE products SET stock = stock + $1 WHERE id = $2", units, row["parent_id"])
            return {"success": True, "message": f"Bulto desarmado: +{units} unidades"}
    else:
        import main as m
        async with m.db_write_lock:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                cur = await db.execute("SELECT name, is_virtual, parent_id, pack_size, stock FROM products WHERE id = ?", (product_id,))
                row = await cur.fetchone()
                if not row: raise HTTPException(404, detail="Producto no encontrado")
                if not row[1] or not row[2]: raise HTTPException(400, detail="No es un bulto virtual")
                if row[4] <= 0: raise HTTPException(400, detail="Sin stock del bulto")
                units = row[3] or 1
                await db.execute("UPDATE products SET stock = stock - 1 WHERE id = ?", (product_id,))
                await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (units, row[2]))
                await db.commit()
            return {"success": True, "message": f"Bulto desarmado: +{units} unidades"}


@router.post("/api/audit", summary="Crear log de auditoria")
async def create_audit_log(body: dict) -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO audit_log (business_id, action, operator, details) VALUES ($1,$2,$3,$4)",
                b_id, body.get("action"), body.get("operator"), body.get("details", "")
            )
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute(
                "INSERT INTO audit_log (action, operator, details) VALUES (?,?,?)",
                (body.get("action"), body.get("operator"), body.get("details", ""))
            )
            await db.commit()
            return {"success": True}


@router.get("/api/audit", summary="Listar auditoria")
async def get_audit_logs(limit: int = Query(100)) -> list:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM audit_log WHERE business_id = $1 ORDER BY timestamp DESC LIMIT $2",
                b_id, limit
            )
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?", (limit,))
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

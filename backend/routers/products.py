from fastapi import APIRouter, HTTPException, Depends, Query, Body, Request
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import re
import aiosqlite
import main
from main import row_to_dict, USE_PG, get_current_business, check_product_limit, check_plan_limits
from core.ratelimit import limiter

router = APIRouter()

def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None

def _parse_extra_codes(value, main_code: str = "") -> list[str]:
    """Normaliza codigos de barra alternativos (lista o string separado por coma/barra/enter)."""
    if value is None:
        return []
    if isinstance(value, str):
        parts = re.split(r"[|;,\n]", value)
    else:
        parts = [str(v) for v in value]
    seen = set()
    out = []
    for p in parts:
        c = p.strip()
        if c and c != main_code and c not in seen:
            seen.add(c)
            out.append(c)
    return out

async def _check_product_limit(request: Request, extra: int = 0):
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        biz = await get_current_business(auth)
        if biz: await check_product_limit(biz, extra)


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
    # LEFT JOIN a categories para devolver category_name (la tabla de inventario
    # lo muestra; antes el SELECT * no lo traía y siempre salía "Sin categoría").
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            if q:
                rows = await conn.fetch(
                    "SELECT p.*, c.name AS category_name, "
                    "(SELECT COALESCE(string_agg(pb.code, ','), '') FROM product_barcodes pb WHERE pb.product_id = p.id) AS extra_codes_raw "
                    "FROM products p "
                    "LEFT JOIN categories c ON c.id = p.category_id "
                    "WHERE p.business_id = $1 AND p.is_active = 1 AND (p.code ILIKE $2 OR p.name ILIKE $2) ORDER BY p.name LIMIT $3",
                    b_id, f"%{q}%", limit
                )
            else:
                rows = await conn.fetch(
                    "SELECT p.*, c.name AS category_name, "
                    "(SELECT COALESCE(string_agg(pb.code, ','), '') FROM product_barcodes pb WHERE pb.product_id = p.id) AS extra_codes_raw "
                    "FROM products p "
                    "LEFT JOIN categories c ON c.id = p.category_id "
                    "WHERE p.business_id = $1 AND p.is_active = 1 ORDER BY p.name LIMIT $2",
                    b_id, limit
                )
            out = []
            for r in rows:
                d = dict(r)
                d["extra_codes"] = [c for c in (d.pop("extra_codes_raw", "") or "").split(",") if c]
                out.append(d)
            return out
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            if q:
                cur = await db.execute(
                    "SELECT p.*, c.name AS category_name, "
                    "(SELECT COALESCE(GROUP_CONCAT(pb.code, ','), '') FROM product_barcodes pb WHERE pb.product_id = p.id) AS extra_codes_raw "
                    "FROM products p "
                    "LEFT JOIN categories c ON c.id = p.category_id "
                    "WHERE p.is_active = 1 AND (p.code LIKE ? OR p.name LIKE ?) ORDER BY p.name LIMIT ?",
                    (f"%{q}%", f"%{q}%", limit)
                )
            else:
                cur = await db.execute(
                    "SELECT p.*, c.name AS category_name, "
                    "(SELECT COALESCE(GROUP_CONCAT(pb.code, ','), '') FROM product_barcodes pb WHERE pb.product_id = p.id) AS extra_codes_raw "
                    "FROM products p "
                    "LEFT JOIN categories c ON c.id = p.category_id "
                    "WHERE p.is_active = 1 ORDER BY p.name LIMIT ?", (limit,))
            rows = await cur.fetchall()
            out = []
            for r in rows:
                d = row_to_dict(r, cur.description)
                d["extra_codes"] = [c for c in (d.pop("extra_codes_raw", "") or "").split(",") if c]
                out.append(d)
            return out


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
                SELECT p.*, ROUND(CAST((p.price - p.cost_price) / NULLIF(p.cost_price,0) * 100 AS numeric), 1) as current_margin,
                       ROUND(CAST(p.cost_price * (1 + ${n} / 100.0) / 10 AS numeric)) * 10 as suggested_price
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
@limiter.limit("10/minute")
async def import_products_csv(request: Request, csv_text: str = Body(..., media_type="text/plain")) -> dict:
    import csv, io
    b_id = _biz_id()
    text = csv_text
    delimiter = ',' if ',' in text.split('\n')[0] else ';'
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        raise HTTPException(400, detail="Archivo CSV vacio")

    await _check_product_limit(request, len(rows))

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
            iva = (row.get('iva', '21%') or '21%').strip()
            categoria = (row.get('categoria') or row.get('category') or '').strip()
            extra = _parse_extra_codes(row.get('codigos_extra') or row.get('extra_codes'), code)
            parsed.append((code, name, price, cost_price, stock, min_stock, iva, categoria, extra))
        except Exception as e:
            errors.append(f"Fila {i+2}: {str(e)}")

    imported = 0
    categories_created = []
    if parsed:
        if USE_PG:
            from db_helpers import get_pg_pool
            pool = await get_pg_pool()
            async with pool.acquire() as conn:
                async with conn.transaction():
                    for code, name, price, cost, stock, min_stock, iva, categoria, extra in parsed:
                        cat_id = None
                        if categoria:
                            cat_id = await conn.fetchval(
                                "SELECT id FROM categories WHERE business_id = $1 AND name = $2", b_id, categoria)
                            if not cat_id:
                                cat_id = await conn.fetchval(
                                    "INSERT INTO categories (business_id, name) VALUES ($1, $2) RETURNING id",
                                    b_id, categoria)
                                categories_created.append(categoria)
                        existing = await conn.fetchrow("SELECT id FROM products WHERE code = $1 AND business_id = $2", code, b_id)
                        if existing:
                            pid = existing["id"]
                            await conn.execute(
                                "UPDATE products SET name=$1, price=$2, cost_price=$3, stock=$4, min_stock=$5, iva=$6, category_id=$7, updated_at=now() WHERE code=$8 AND business_id=$9",
                                name, price, cost, stock, min_stock, iva, cat_id, code, b_id
                            )
                        else:
                            pid = await conn.fetchval(
                                "INSERT INTO products (business_id, code, name, price, cost_price, stock, min_stock, iva, category_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
                                b_id, code, name, price, cost, stock, min_stock, iva, cat_id
                            )
                        if extra:
                            await conn.execute("DELETE FROM product_barcodes WHERE product_id = $1", pid)
                            await conn.executemany(
                                "INSERT INTO product_barcodes (business_id, product_id, code) VALUES ($1, $2, $3)",
                                [(b_id, pid, c) for c in extra],
                            )
                        imported += 1
        else:
            async with aiosqlite.connect(main.DB_PATH) as db:
                await db.execute("BEGIN IMMEDIATE")
                for code, name, price, cost, stock, min_stock, iva, categoria, extra in parsed:
                    cat_id = None
                    if categoria:
                        cur = await db.execute("SELECT id FROM categories WHERE name = ?", (categoria,))
                        row = await cur.fetchone()
                        if row:
                            cat_id = row[0]
                        else:
                            cur = await db.execute("INSERT INTO categories (name) VALUES (?)", (categoria,))
                            cat_id = cur.lastrowid
                            categories_created.append(categoria)
                    sel = await db.execute("SELECT id FROM products WHERE code = ?", (code,))
                    prow = await sel.fetchone()
                    if prow:
                        pid = prow[0]
                        await db.execute(
                            "UPDATE products SET name=?, price=?, cost_price=?, stock=?, min_stock=?, iva=?, category_id=?, updated_at=datetime('now','localtime') WHERE code=?",
                            (name, price, cost, stock, min_stock, iva, cat_id, code)
                        )
                    else:
                        cur = await db.execute(
                            "INSERT INTO products (code, name, price, cost_price, stock, min_stock, iva, category_id) VALUES (?,?,?,?,?,?,?,?)",
                            (code, name, price, cost, stock, min_stock, iva, cat_id)
                        )
                        pid = cur.lastrowid
                    if extra:
                        await db.execute("DELETE FROM product_barcodes WHERE product_id = ?", (pid,))
                        await db.executemany(
                            "INSERT INTO product_barcodes (product_id, code) VALUES (?, ?)",
                            [(pid, c) for c in extra],
                        )
                    imported += 1
                await db.commit()
    return {"imported": imported, "errors": errors, "categories_created": categories_created, "total_rows": len(rows)}


@router.post("/api/products", status_code=201, summary="Crear producto")
@limiter.limit("60/minute")
async def create_product(request: Request, product: dict = Body(...)) -> Dict[str, Any]:
    b_id = _biz_id()
    await _check_product_limit(request, 1)
    import uuid as _uuid
    code = product.get("code") or product.get("barcode") or f"AUTO-{_uuid.uuid4().hex[:8].upper()}"
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO products (business_id, code, name, price, cost_price, stock, min_stock, iva, category_id, is_virtual, parent_id, pack_size, expiry_date)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id
            """, b_id, code, product.get("name"), product.get("price", 0), product.get("cost_price", 0),
                product.get("stock", 0), product.get("min_stock", 5), product.get("iva", "21%"),
                product.get("category_id"), 1 if product.get("is_virtual") else 0,
                product.get("parent_id"), product.get("pack_size", 1), product.get("expiry_date", ""))
            extra = _parse_extra_codes(product.get("extra_codes"), code)
            if extra:
                await conn.executemany(
                    "INSERT INTO product_barcodes (business_id, product_id, code) VALUES ($1, $2, $3)",
                    [(b_id, row["id"], c) for c in extra],
                )
            return {"id": row["id"], **product, "extra_codes": extra}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "INSERT INTO products (code,name,price,cost_price,stock,min_stock,iva,category_id,is_virtual,parent_id,pack_size,expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (code, product.get("name"), product.get("price", 0), product.get("cost_price", 0),
                 product.get("stock", 0), product.get("min_stock", 5), product.get("iva", "21%"),
                 product.get("category_id"), 1 if product.get("is_virtual") else 0,
                 product.get("parent_id"), product.get("pack_size", 1), product.get("expiry_date", ""))
            )
            extra = _parse_extra_codes(product.get("extra_codes"), code)
            if extra:
                await db.executemany(
                    "INSERT INTO product_barcodes (product_id, code) VALUES (?, ?)",
                    [(cur.lastrowid, c) for c in extra],
                )
            await db.commit()
            return {"id": cur.lastrowid, **product, "extra_codes": extra}


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


@router.patch("/api/products/{product_id}/stock", summary="Fijar stock absoluto")
async def update_stock(product_id: int, body: dict) -> dict:
    """Fija el stock ABSOLUTO del producto (no es un movimiento sumable).

    El valor es obligatorio: antes defaulteaba a 0, por lo que un body sin
    `stock` (o con valor no numérico) podía vaciar el inventario real en silencio.
    Ahora se rechaza con 422 si falta o no es un número >= 0.
    """
    if "stock" not in body or body.get("stock") is None:
        raise HTTPException(422, detail="Falta el campo 'stock' (valor absoluto a fijar)")
    try:
        stock = float(body["stock"])
    except (TypeError, ValueError):
        raise HTTPException(422, detail="'stock' debe ser numérico")
    if stock < 0:
        raise HTTPException(422, detail="'stock' no puede ser negativo")
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
    extra_codes = _parse_extra_codes(body.get("extra_codes"), body.get("code", "")) if "extra_codes" in body else None
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            existing = await conn.fetchrow("SELECT id FROM products WHERE id = $1 AND business_id = $2", product_id, b_id)
            if not existing: raise HTTPException(404, detail="Producto no encontrado")
            sets = []
            params = []
            n = 1
            for k in ('code', 'name', 'price', 'cost_price', 'stock', 'min_stock', 'iva', 'category_id', 'expiry_date', 'en_catalogo'):
                if k in body:
                    sets.append(f"{k} = ${n}")
                    params.append(body[k])
                    n += 1
            if sets:
                params.append(product_id)
                await conn.execute(f"UPDATE products SET {', '.join(sets)}, updated_at = now() WHERE id = ${n}", *params)
            if extra_codes is not None:
                await conn.execute("DELETE FROM product_barcodes WHERE product_id = $1", product_id)
                if extra_codes:
                    await conn.executemany(
                        "INSERT INTO product_barcodes (business_id, product_id, code) VALUES ($1, $2, $3)",
                        [(b_id, product_id, c) for c in extra_codes],
                    )
            if not sets and extra_codes is None: return {"message": "Sin cambios"}
            return {"success": True}
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT id FROM products WHERE id = ?", (product_id,))
            if not await cur.fetchone(): raise HTTPException(404, detail="Producto no encontrado")
            sets = []
            params = []
            for k in ('code', 'name', 'price', 'cost_price', 'stock', 'min_stock', 'iva', 'category_id', 'expiry_date', 'en_catalogo'):
                if k in body:
                    sets.append(f"{k} = ?")
                    params.append(body[k])
            if sets:
                params.append(product_id)
                await db.execute(f"UPDATE products SET {', '.join(sets)}, updated_at = datetime('now','localtime') WHERE id = ?", tuple(params))
            if extra_codes is not None:
                await db.execute("DELETE FROM product_barcodes WHERE product_id = ?", (product_id,))
                if extra_codes:
                    await db.executemany(
                        "INSERT INTO product_barcodes (product_id, code) VALUES (?, ?)",
                        [(product_id, c) for c in extra_codes],
                    )
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
async def create_audit_log(request: Request, body: dict) -> dict:
    b_id = _biz_id()
    if USE_PG:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            biz = await get_current_business(auth)
            if biz: await check_plan_limits("audit_cloud", biz)
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
async def get_audit_logs(request: Request, limit: int = Query(100)) -> list:
    b_id = _biz_id()
    if USE_PG:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            biz = await get_current_business(auth)
            if biz: await check_plan_limits("audit_cloud", biz)
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

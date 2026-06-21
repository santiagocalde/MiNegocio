from fastapi import APIRouter, HTTPException, Query, Body, Request
from typing import Optional
import main
from main import USE_PG, row_to_dict, get_current_business, check_plan_limits

router = APIRouter()

def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


@router.get("/api/config", summary="Obtener configuracion del negocio")
async def get_config() -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = _biz_id()
            row = await conn.fetchrow("SELECT * FROM business_config WHERE business_id = $1", b_id)
            return dict(row) if row else {}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM business_config LIMIT 1")
            row = await cur.fetchone()
            return row_to_dict(row, cur.description) if row else {}


@router.get("/api/catalogo", summary="Catálogo público de un comercio (sin auth)")
async def public_catalogo(slug: str = Query("")) -> dict:
    """Endpoint PÚBLICO (sin token). Devuelve solo datos no sensibles del catálogo
    de un comercio que tenga el catálogo activado. Nunca expone costo, stock ni
    datos internos del negocio."""
    import re
    slug = re.sub(r"[^a-z0-9-]", "", (slug or "").strip().lower())[:60]
    if not slug:
        raise HTTPException(404, detail="Catálogo no encontrado")
    if not USE_PG:
        return {"nombre": "Catálogo", "catalogo_whatsapp": "", "products": []}

    from db_helpers import get_pg_pool
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        cfg = await conn.fetchrow(
            "SELECT business_id, nombre, catalogo_whatsapp FROM business_config "
            "WHERE catalogo_slug = $1 AND catalogo_activo = 1 LIMIT 1",
            slug,
        )
        if not cfg:
            raise HTTPException(404, detail="Catálogo no disponible")
        prods = await conn.fetch(
            "SELECT id, name, price, category_id FROM products "
            "WHERE business_id = $1 AND is_active = 1 AND price > 0 "
            "ORDER BY name LIMIT 2000",
            cfg["business_id"],
        )
        return {
            "nombre": cfg["nombre"] or "Catálogo",
            "catalogo_whatsapp": cfg["catalogo_whatsapp"] or "",
            "products": [dict(p) for p in prods],
        }


@router.put("/api/config", summary="Actualizar configuracion del negocio")
async def update_config(data: dict) -> dict:
    iva_rate_raw = data.get("iva_rate")
    if iva_rate_raw is not None:
        try:
            float(str(iva_rate_raw))
        except (ValueError, TypeError):
            raise HTTPException(400, detail="iva_rate debe ser un numero")
    cuit = data.get("cuit", "")
    if cuit and len(str(cuit)) > 20:
        raise HTTPException(400, detail="CUIT demasiado largo")
    
    if USE_PG:
        import re
        from db_helpers import get_pg_pool
        # Alias de los nombres que usa el frontend del catálogo
        if "name" in data and "nombre" not in data: data["nombre"] = data["name"]
        if "whatsapp" in data and "catalogo_whatsapp" not in data: data["catalogo_whatsapp"] = data["whatsapp"]
        if "slug" in data and "catalogo_slug" not in data: data["catalogo_slug"] = data["slug"]
        if data.get("catalogo_slug"):
            data["catalogo_slug"] = re.sub(r"[^a-z0-9-]", "", str(data["catalogo_slug"]).strip().lower())[:60]
        if "catalogo_activo" in data:
            data["catalogo_activo"] = 1 if data["catalogo_activo"] in (True, 1, "1", "true", "True") else 0

        COLS = ["nombre", "subtitulo", "direccion", "telefono", "cuit", "condicion_iva",
                "numero_caja", "mensaje_ticket", "iva_rate", "mp_access_token", "mp_collector_id",
                "catalogo_activo", "catalogo_slug", "catalogo_whatsapp"]
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = _biz_id()
            async with conn.transaction():
                # Merge no destructivo: lo enviado pisa, lo no enviado se conserva
                existing = await conn.fetchrow("SELECT * FROM business_config WHERE business_id = $1", b_id)
                cur = dict(existing) if existing else {}
                merged = {c: (data[c] if c in data else cur.get(c)) for c in COLS}
                placeholders = ", ".join(f"${i + 2}" for i in range(len(COLS)))
                setters = ", ".join(f"{c}=EXCLUDED.{c}" for c in COLS)
                await conn.execute(
                    f"INSERT INTO business_config (business_id, {', '.join(COLS)}) VALUES ($1, {placeholders}) "
                    f"ON CONFLICT (business_id) DO UPDATE SET {setters}",
                    b_id, *[merged[c] for c in COLS]
                )
        return {"success": True}
    else:
        import aiosqlite
        b_id = _biz_id() or ""
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("DELETE FROM business_config WHERE id IN (SELECT id FROM business_config LIMIT 1)")
            await db.execute(
                "INSERT INTO business_config (nombre, subtitulo, direccion, telefono, cuit, condicion_iva, numero_caja, mensaje_ticket, iva_rate, mp_access_token, mp_collector_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (data.get("nombre"), data.get("subtitulo"), data.get("direccion"), data.get("telefono"),
                 data.get("cuit"), data.get("condicion_iva"), data.get("numero_caja"), data.get("mensaje_ticket"),
                 data.get("iva_rate"), data.get("mp_access_token"), data.get("mp_collector_id"))
            )
            await db.commit()
        return {"success": True}


@router.get("/api/sucursales", summary="Listar sucursales")
async def list_sucursales() -> list:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM sucursales WHERE business_id = $1", _biz_id())
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM sucursales")
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.post("/api/sucursales", summary="Crear sucursal")
async def create_sucursal(request: Request, name: str = Query(...), address: str = Query(""), phone: str = Query("")) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            biz = await get_current_business(auth)
            if biz: await check_plan_limits("multi_sucursal", biz)
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "INSERT INTO sucursales (business_id, name, address, phone) VALUES ($1,$2,$3,$4) RETURNING id",
                _biz_id(), name, address or "", phone or ""
            )
            return {"id": row["id"], "name": name, "address": address, "phone": phone}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("INSERT INTO sucursales (name, address, phone) VALUES (?,?,?)", (name, address or "", phone or ""))
            await db.commit()
            return {"id": cur.lastrowid, "name": name, "address": address, "phone": phone}


@router.patch("/api/sucursales/{sucursal_id}", summary="Actualizar sucursal")
async def update_sucursal(sucursal_id: int, name: str = Query(None), address: str = Query(None), phone: str = Query(None)) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE sucursales SET name = COALESCE($1, name), address = COALESCE($2, address), phone = COALESCE($3, phone) WHERE id = $4 AND business_id = $5",
                name, address, phone, sucursal_id, _biz_id()
            )
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute(
                "UPDATE sucursales SET name = COALESCE(?, name), address = COALESCE(?, address), phone = COALESCE(?, phone) WHERE id = ?",
                (name, address, phone, sucursal_id)
            )
            await db.commit()
            return {"success": True}


@router.delete("/api/sucursales/{sucursal_id}", summary="Eliminar sucursal")
async def delete_sucursal(sucursal_id: int) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM sucursales WHERE id = $1 AND business_id = $2", sucursal_id, _biz_id())
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("DELETE FROM sucursales WHERE id = ?", (sucursal_id,))
            await db.commit()
            return {"success": True}

from fastapi import APIRouter, HTTPException, Query, Body, Request
from typing import Optional
import main
from main import USE_PG, row_to_dict, get_current_business, check_plan_limits
from core.ratelimit import limiter

router = APIRouter()

def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


def _redact_secrets(cfg: dict) -> dict:
    """Nunca devolver el mp_access_token (secreto de MercadoPago del negocio) al
    cliente. Se reemplaza por un flag booleano para que la UI sepa si ya estÃ¡
    configurado sin exponer el valor. El PUT preserva el token si llega vacÃ­o."""
    if not cfg:
        return cfg
    cfg["mp_access_token_set"] = bool(cfg.get("mp_access_token"))
    cfg["mp_access_token"] = ""
    return cfg


@router.get("/api/config", summary="Obtener configuracion del negocio")
async def get_config() -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = _biz_id()
            row = await conn.fetchrow("SELECT * FROM business_config WHERE business_id = $1", b_id)
            cfg = dict(row) if row else {}
            # Siempre traemos business_name y business_type de la tabla businesses:
            # - business_name como fallback si no hay nombre en Ajustes
            # - business_type para que el frontend lo sincronice en cada F5 sin
            #   necesidad de cerrar sesiÃ³n (PanelContext lo escribe en localStorage)
            biz = await conn.fetchrow(
                "SELECT business_name, business_type FROM businesses WHERE id = $1", b_id
            )
            if biz:
                if not cfg.get("nombre") and biz["business_name"]:
                    cfg["nombre"] = biz["business_name"]
                cfg["business_type"] = biz["business_type"] or ""
            return _redact_secrets(cfg)
    else:
        import aiosqlite
        # business_config en SQLite es clave-valor (core/database.py), no una tabla ancha
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT key, value FROM business_config")
            rows = await cur.fetchall()
            return _redact_secrets({key: value for key, value in rows})


@router.get("/api/catalogo", summary="CatÃ¡logo pÃºblico de un comercio (sin auth)")
@limiter.limit("30/minute")
async def public_catalogo(request: Request, slug: str = Query("")) -> dict:
    """Endpoint PÃšBLICO (sin token). Devuelve solo datos no sensibles del catÃ¡logo
    de un comercio que tenga el catÃ¡logo activado. Nunca expone costo, stock ni
    datos internos del negocio."""
    import re
    slug = re.sub(r"[^a-z0-9-]", "", (slug or "").strip().lower())[:60]
    if not slug:
        raise HTTPException(404, detail="CatÃ¡logo no encontrado")
    if not USE_PG:
        return {"nombre": "CatÃ¡logo", "catalogo_whatsapp": "", "products": []}

    from db_helpers import get_pg_pool
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        cfg = await conn.fetchrow(
            "SELECT bc.business_id, bc.nombre, bc.subtitulo, bc.direccion, "
            "bc.catalogo_whatsapp, COALESCE(bc.catalogo_tema, 'ocean') AS catalogo_tema, "
            "b.plan, b.status "
            "FROM business_config bc JOIN businesses b ON b.id = bc.business_id "
            "WHERE bc.catalogo_slug = $1 AND bc.catalogo_activo = 1 LIMIT 1",
            slug,
        )
        # El CatÃ¡logo web es un feature del Plan Pro+: si el negocio no estÃ¡ en
        # Pro/IA no existimos (404, no revelamos el motivo).
        if not cfg or cfg["plan"] not in ("pro", "ia"):
            raise HTTPException(404, detail="CatÃ¡logo no disponible")
        prods = await conn.fetch(
            "SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name, "
            "CASE WHEN p.stock <= 0 THEN 'agotado' "
            "     WHEN p.stock <= COALESCE(p.min_stock, 5) THEN 'queda-poco' "
            "     ELSE 'hay' END AS availability "
            "FROM products p LEFT JOIN categories c ON c.id = p.category_id "
            "WHERE p.business_id = $1 AND p.is_active = 1 AND p.price > 0 "
            "AND p.en_catalogo = 1 "
            "ORDER BY p.name LIMIT 2000",
            cfg["business_id"],
        )
        return {
            "nombre": cfg["nombre"] or "CatÃ¡logo",
            "subtitulo": cfg["subtitulo"] or "",
            "direccion": cfg["direccion"] or "",
            "catalogo_whatsapp": cfg["catalogo_whatsapp"] or "",
            "theme": cfg["catalogo_tema"] or "ocean",
            "products": [dict(p) for p in prods],
        }


@router.put("/api/config", summary="Actualizar configuracion del negocio")
@router.post("/api/config", summary="Actualizar configuracion del negocio")
async def update_config(request: Request, data: dict) -> dict:
    iva_rate_raw = data.get("iva_rate")
    if iva_rate_raw is not None:
        try:
            float(str(iva_rate_raw))
        except (ValueError, TypeError):
            raise HTTPException(400, detail="iva_rate debe ser un numero")
    cuit = data.get("cuit", "")
    if cuit and len(str(cuit)) > 20:
        raise HTTPException(400, detail="CUIT demasiado largo")

    # El GET nunca devuelve el mp_access_token real (llega vacÃ­o al form). Si el
    # usuario no cargÃ³ uno nuevo, no pisar el existente con "" â†’ se quita del
    # payload para conservar el token ya guardado.
    if not data.get("mp_access_token"):
        data.pop("mp_access_token", None)

    if USE_PG:
        import re
        from db_helpers import get_pg_pool
        # Alias de los nombres que usa el frontend del catÃ¡logo
        if "name" in data and "nombre" not in data: data["nombre"] = data["name"]
        if "whatsapp" in data and "catalogo_whatsapp" not in data: data["catalogo_whatsapp"] = data["whatsapp"]
        if "slug" in data and "catalogo_slug" not in data: data["catalogo_slug"] = data["slug"]
        if data.get("catalogo_slug"):
            data["catalogo_slug"] = re.sub(r"[^a-z0-9-]", "", str(data["catalogo_slug"]).strip().lower())[:60]
        if "catalogo_activo" in data:
            data["catalogo_activo"] = 1 if data["catalogo_activo"] in (True, 1, "1", "true", "True") else 0
        # Tema del catÃ¡logo: solo 5 paletas fijas (whitelist), nunca CSS arbitrario.
        if "catalogo_tema" in data:
            tema = str(data["catalogo_tema"]).strip().lower()
            if tema not in ("ocean", "esmeralda", "medianoche", "ambar", "claro"):
                tema = "ocean"
            data["catalogo_tema"] = tema

        COLS = ["nombre", "subtitulo", "direccion", "telefono", "cuit", "condicion_iva",
                "numero_caja", "mensaje_ticket", "iva_rate", "mp_access_token", "mp_collector_id",
                "catalogo_activo", "catalogo_slug", "catalogo_whatsapp", "catalogo_tema",
                "instagram", "propietario", "ing_brutos", "inicio_actividades", "logo_url",
                "price_list_a_name", "price_list_b_name", "price_list_c_name",
                "price_list_d_name", "price_list_e_name", "margen_estimado"]
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = _biz_id()
            # CatÃ¡logo web = feature de Plan Pro+. Niego la activaciÃ³n si el plan
            # no lo incluye y exijo un enlace Ãºnico antes de activar.
            if data.get("catalogo_activo") == 1:
                biz = await conn.fetchrow("SELECT plan FROM businesses WHERE id = $1", b_id)
                if not biz or biz["plan"] not in ("pro", "ia"):
                    raise HTTPException(
                        status_code=402,
                        detail="El catÃ¡logo web requiere Plan Pro o superior. Tu plan actual es '{}'.".format(
                            biz["plan"] or "desconocido" if biz else "desconocido"
                        ),
                    )
                if not data.get("catalogo_slug"):
                    raise HTTPException(400, detail="ElegÃ­ un enlace Ãºnico para tu catÃ¡logo antes de activarlo.")
            if data.get("catalogo_slug"):
                dup = await conn.fetchrow(
                    "SELECT business_id FROM business_config WHERE catalogo_slug = $1 AND business_id <> $2 LIMIT 1",
                    data["catalogo_slug"], b_id,
                )
                if dup:
                    raise HTTPException(409, "Ese enlace de catÃ¡logo ya estÃ¡ en uso por otro negocio. ElegÃ­ otro.")
            async with conn.transaction():
                # Merge no destructivo: lo enviado pisa, lo no enviado se conserva
                existing = await conn.fetchrow("SELECT * FROM business_config WHERE business_id = $1", b_id)
                cur = dict(existing) if existing else {}
                merged = {c: (data[c] if c in data else cur.get(c)) for c in COLS}
                placeholders = ", ".join(f"${i + 2}" for i in range(len(COLS)))
                setters = ", ".join(f"{c}=EXCLUDED.{c}" for c in COLS)
                try:
                    await conn.execute(
                        f"INSERT INTO business_config (business_id, {', '.join(COLS)}) VALUES ($1, {placeholders}) "
                        f"ON CONFLICT (business_id) DO UPDATE SET {setters}",
                        b_id, *[merged[c] for c in COLS]
                    )
                except Exception as e:
                    # Aunque ya chequeamos duplicados arriba, el Ã­ndice Ãºnico de la DB
                    # (uq_business_config_catalogo_slug) cierra la carrera: si dos
                    # negocios eligen el mismo enlace a la vez, uno recibe 409.
                    if getattr(e, "sqlstate", "") == "23505":
                        raise HTTPException(409, "Ese enlace de catÃ¡logo ya estÃ¡ en uso por otro negocio. ElegÃ­ otro.")
                    raise
        return {"success": True}
    else:
        import aiosqlite
        # business_config en SQLite es clave-valor: upsert no destructivo (lo enviado pisa,
        # lo no enviado se conserva), igual que la rama Postgres de arriba.
        COLS = ["nombre", "subtitulo", "direccion", "telefono", "cuit", "condicion_iva",
                "numero_caja", "mensaje_ticket", "iva_rate", "mp_access_token", "mp_collector_id",
                "instagram", "propietario", "ing_brutos", "inicio_actividades", "logo_url",
                "price_list_a_name", "price_list_b_name", "price_list_c_name",
                "price_list_d_name", "price_list_e_name", "margen_estimado"]
        async with aiosqlite.connect(main.DB_PATH) as db:
            # business_config key-value: upsert no destructivo. mp_access_token ya
            # fue removido de data arriba si llegÃ³ vacÃ­o, asÃ­ se conserva el guardado.
            for c in COLS:
                if c in data:
                    await db.execute(
                        "INSERT INTO business_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                        (c, str(data[c]) if data[c] is not None else "")
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


@router.post("/api/sucursales/{sucursal_id}", summary="Actualizar sucursal")
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


# â”€â”€ LOGO UPLOAD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
from fastapi import UploadFile, File
import pathlib, uuid, os

LOGO_DIR = pathlib.Path(__file__).parent.parent / "static" / "logos"
LOGO_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB

@router.post("/api/config/logo", summary="Subir logo del negocio")
async def upload_logo(file: UploadFile = File(...)) -> dict:
    ext = pathlib.Path(file.filename or "logo.png").suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, "Formato no soportado. UsÃ¡ PNG, JPG, WEBP o SVG.")
    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "El archivo excede el lÃ­mite de 2 MB.")
    b_id = str(_biz_id() or "unknown").replace("/", "_")
    ts = uuid.uuid4().hex[:8]
    filename = f"{b_id}_{ts}{ext}"
    dest = LOGO_DIR / filename
    dest.write_bytes(data)
    logo_url = f"/static/logos/{filename}"
    # Guardar en business_config
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE business_config SET logo_url = $1 WHERE business_id = $2",
                logo_url, _biz_id()
            )
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("UPDATE business_config SET logo_url = ? WHERE business_id = ?",
                             (logo_url, _biz_id()))
            await db.commit()
    return {"success": True, "logo_url": logo_url}

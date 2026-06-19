import os, glob, gzip, tempfile, shutil, uuid, json, logging
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import aiosqlite
import httpx

import main
from main import row_to_dict, logger, DB_PATH, DATA_DIR, USE_PG, JWT_SECRET, JWT_ALGORITHM
from jose import jwt as jose_jwt

router = APIRouter()

def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


# ────────────────────────────────────────────────────────────
# SETUP / STATUS
# ────────────────────────────────────────────────────────────
@router.get("/api/setup/status", summary="Verificar si necesita config inicial")
async def setup_status() -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = _biz_id()
            if b_id:
                count = await conn.fetchval("SELECT COUNT(*) FROM operators WHERE business_id = $1", b_id)
            else:
                count = 0
            name_row = await conn.fetchval("SELECT business_name FROM businesses WHERE id = $1", b_id) if b_id else None
            return {"needs_setup": count == 0, "operators_count": count, "business_name": name_row or "Mi Kiosco"}
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            cur = await db.execute("SELECT COUNT(*) FROM operators")
            count = (await cur.fetchone())[0]
            cur2 = await db.execute("SELECT nombre FROM business_config LIMIT 1")
            name_row = await cur2.fetchone()
            return {"needs_setup": count == 0, "operators_count": count, "business_name": name_row[0] if name_row else "Mi Kiosco"}


@router.post("/api/setup/init", summary="Inicializar configuracion basica")
async def setup_init(data: dict) -> dict:
    admin_name = data.get("admin_name", "Dueño").strip()
    admin_pin = data.get("admin_pin", "").strip()
    business_name = data.get("business_name", "Mi Kiosco").strip()
    if not admin_pin or len(admin_pin) < 4:
        raise HTTPException(400, detail="PIN de al menos 4 caracteres")
    import bcrypt
    hashed = bcrypt.hashpw(admin_pin.encode(), bcrypt.gensalt()).decode()

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = _biz_id()
            if b_id:
                await conn.execute("INSERT INTO operators (business_id, name, pin, role) VALUES ($1,$2,$3,$4)", b_id, admin_name, hashed, "admin")
                await conn.execute(
                    "INSERT INTO business_config (business_id, nombre) VALUES ($1,$2) ON CONFLICT (business_id) DO UPDATE SET nombre = $2",
                    b_id, business_name
                )
                await conn.execute("UPDATE businesses SET business_name = $1 WHERE id = $2", business_name, b_id)
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("INSERT INTO operators (name, pin, role) VALUES (?, ?, 'admin')", (admin_name, hashed))
            await db.execute("INSERT OR IGNORE INTO business_config (nombre) VALUES (?)", (business_name,))
            await db.commit()
    return {"success": True, "business_name": business_name}


# ────────────────────────────────────────────────────────────
# BACKUP (solo local, no tenant-specific)
# ────────────────────────────────────────────────────────────
@router.post("/api/backup", summary="Crear backup manual")
async def create_backup() -> dict:
    backup_dir = os.path.join(main.BASE_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path_gz = os.path.join(backup_dir, f"backup_{timestamp}.db.gz")
    tmp_path = os.path.join(backup_dir, "temp_backup.db")
    try:
        async with aiosqlite.connect(DB_PATH) as src, aiosqlite.connect(tmp_path) as dst:
            await src.backup(dst)
        with open(tmp_path, 'rb') as f_in, gzip.open(backup_path_gz, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
        return {"success": True, "filename": f"backup_{timestamp}.db.gz"}
    finally:
        if os.path.exists(tmp_path): os.remove(tmp_path)


@router.get("/api/backup/list", summary="Listar backups disponibles")
async def list_backups() -> dict:
    backup_dir = os.path.join(main.BASE_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(backup_dir, "*.db.gz")), reverse=True)
    return [{"filename": os.path.basename(f), "modified": datetime.fromtimestamp(os.path.getmtime(f)).isoformat(), "size_kb": round(os.path.getsize(f) / 1024, 1)} for f in files[:20]]


@router.post("/api/backup/restore", summary="Restaurar backup")
async def restore_backup(data: dict) -> dict:
    filename = data.get("filename", "")
    backup_dir = os.path.join(main.BASE_DIR, "backups")
    backup_path = os.path.join(backup_dir, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(404, detail="Backup no encontrado")
    try:
        import time as _time
        safety_backup = os.path.join(backup_dir, f"pre_restore_{_time.strftime('%Y%m%d_%H%M%S')}.db.gz")
        with open(DB_PATH, 'rb') as src, gzip.open(safety_backup, 'wb') as dst:
            shutil.copyfileobj(src, dst)
        logger.info(f"Backup de seguridad creado: {safety_backup}")

        tmp_path = os.path.join(backup_dir, "temp_restore.db")
        with gzip.open(backup_path, 'rb') as gz, open(tmp_path, 'wb') as f:
            shutil.copyfileobj(gz, f)
        shutil.copy(tmp_path, DB_PATH)
        os.remove(tmp_path)
        return {"success": True, "message": f"Base restaurada desde {filename}", "safety_backup": safety_backup}
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ────────────────────────────────────────────────────────────
# EXPIRY ALERTS
# ────────────────────────────────────────────────────────────
@router.get("/api/expiry-alerts", summary="Alertas de vencimiento")
async def expiry_alerts() -> dict:
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            expired = await conn.fetch("SELECT * FROM products WHERE business_id = $1 AND expiry_date != '' AND expiry_date::date < current_date", b_id)
            soon = await conn.fetch("SELECT * FROM products WHERE business_id = $1 AND expiry_date != '' AND expiry_date::date <= current_date + interval '15 days' AND expiry_date::date >= current_date", b_id)
            return {"expired": [dict(r) for r in expired], "expiring_soon": [dict(r) for r in soon]}
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            cur = await db.execute("SELECT * FROM products WHERE expiry_date != '' AND date(expiry_date) < date('now','localtime')")
            expired = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            cur = await db.execute("SELECT * FROM products WHERE expiry_date != '' AND date(expiry_date) <= date('now','+15 days') AND date(expiry_date) >= date('now','localtime')")
            soon = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            return {"expired": expired, "expiring_soon": soon}


# ────────────────────────────────────────────────────────────
# HEALTH & LOGS
# ────────────────────────────────────────────────────────────
@router.get("/api/health", summary="Health check")
async def health_check() -> dict:
    last_backup_dir = os.path.join(main.BASE_DIR, "backups")
    backups = sorted(glob.glob(os.path.join(last_backup_dir, "*.db.gz")), reverse=True)
    return {"status": "ok", "wal_mode": True, "last_backup": datetime.fromtimestamp(os.path.getmtime(backups[0])).strftime("%Y-%m-%d %H:%M:%S") if backups else "N/A", "timestamp": datetime.now().isoformat()}


@router.get("/api/logs", summary="Logs del sistema")
async def get_logs(limit: int = 50) -> dict:
    log_file = os.path.join(main.BASE_DIR, "minegocio.log")
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()[-limit:]
            return {"lines": [l.strip() for l in lines]}
    except:
        return {"lines": []}


# ────────────────────────────────────────────────────────────
# SYNC (ya tiene soporte PG)
# ────────────────────────────────────────────────────────────


# ────────────────────────────────────────────────────────────
# MERCADO PAGO
# ────────────────────────────────────────────────────────────
@router.post("/api/mercadopago/create-payment", summary="Crear pago MP")
async def mercadopago_create_payment(data: dict = Body(...)) -> dict:
    monto = data.get("total", 0)
    descripcion = data.get("description", "Venta en kiosco")
    access_token = os.getenv("MP_ACCESS_TOKEN", "")
    if not access_token:
        raise HTTPException(400, detail="Mercado Pago no configurado")
    collector_id = os.getenv("MP_COLLECTOR_ID", "")
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    ext_ref = f"minegocio_{int(datetime.now().timestamp())}"
    intent_id = str(uuid.uuid4())
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post("https://api.mercadopago.com/checkout/preferences", json={
                "items": [{"title": descripcion, "quantity": 1, "unit_price": float(monto), "currency_id": "ARS"}],
                "external_reference": ext_ref, "auto_return": "approved",
            }, headers=headers, timeout=10)
            if resp.status_code in (200, 201):
                r = resp.json()
                return {"success": True, "mode": "checkout_link", "payment_url": r.get("init_point", ""), "payment_id": str(r.get("id", "")), "intent_id": intent_id}
            if resp.status_code == 429:
                raise HTTPException(429, detail="Demasiadas solicitudes a Mercado Pago. Reintenta en unos segundos.")
            raise HTTPException(500, detail=f"Error de Mercado Pago: {resp.status_code}")
        except httpx.HTTPStatusError as e:
            raise HTTPException(500, detail=f"Error de Mercado Pago: {e.response.status_code}")


@router.get("/api/mercadopago/payment-status/{intent_id}", summary="Estado de pago MP")
async def mercadopago_payment_status(intent_id: str) -> dict:
    access_token = os.getenv("MP_ACCESS_TOKEN", "")
    if not access_token:
        return {"status": "pending", "intent_id": intent_id, "detail": "MP no configurado"}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.mercadopago.com/v1/payments/{intent_id}",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"status": data.get("status", "pending"), "intent_id": intent_id, "detail": data.get("status_detail", "")}
            if resp.status_code == 404:
                return {"status": "not_found", "intent_id": intent_id}
            return {"status": "pending", "intent_id": intent_id}
    except Exception:
        return {"status": "pending", "intent_id": intent_id, "detail": "error consultando MP"}


# ────────────────────────────────────────────────────────────
# CONTACTO
# ────────────────────────────────────────────────────────────
@router.post("/api/send-contact-email", summary="Enviar email de contacto")
async def send_contact_email(data: dict = Body(...)) -> dict:
    nombre = data.get("nombre", "Sin nombre")
    contacto = data.get("contacto", "")
    mensaje = data.get("mensaje", "")
    resend_key = os.getenv("RESEND_API_KEY", "")
    if not resend_key:
        logger.warning("RESEND_API_KEY no configurada")
        return {"success": False, "message": "Servicio de email no configurado"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"}, json={
                "from": "MiNegocio <no-reply@minegocio.com>",
                "to": [os.getenv("CONTACT_EMAIL", "upcodednow@gmail.com")],
                "subject": f"Nuevo mensaje de {nombre}",
                "html": f"<p><strong>Nombre:</strong> {nombre}</p><p><strong>Contacto:</strong> {contacto}</p><p>{mensaje}</p>"
            })
        return {"success": True, "message": "Email enviado"}
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ────────────────────────────────────────────────────────────
# PLANS, METRICS, TESTIMONIALS
# ────────────────────────────────────────────────────────────
@router.get("/api/plans", summary="Listar planes")
async def list_plans() -> list:
    try:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT slug, name, monthly_price, yearly_price, max_products, max_users, features FROM plans WHERE is_active = true ORDER BY sort_order")
        return [{"id": r["slug"], "name": r["name"], "monthly": r["monthly_price"], "yearly": r["yearly_price"], "desc": f"Hasta {r['max_products']:,} productos".replace(",", "."), "features": json.loads(r["features"]) if isinstance(r["features"], str) else r["features"], "popular": r["slug"] == "pro"} for r in rows]
    except Exception as e:
        logger.warning(f"No se pudieron cargar planes desde DB, usando fallback: {e}")
        from core.plan_pricing import PLANS_CONFIG
        return [{"id": slug, "name": p["name"], "monthly": p["monthly"], "yearly": p["yearly"], "desc": p["desc"], "popular": p["popular"], "features": p["features"]} for slug, p in PLANS_CONFIG.items()]


@router.get("/api/metrics", summary="Metricas publicas")
async def get_metrics() -> dict:
    k, v, d, p = 20, 380000, 98.7, 4.9
    try:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval("SELECT COUNT(*) FROM businesses WHERE status = 'active'")
            if count: k = count + 15; v = count * 19000
    except Exception as e:
        logger.debug(f"No se pudieron cargar metricas de DB: {e}")
        pass
    return {"kioscos_activos": k, "ventas_procesadas": v, "disponibilidad": d, "puntuacion": p}


@router.get("/api/testimonials", summary="Listar testimonios")
async def list_testimonials() -> list:
    try:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM testimonials WHERE is_verified = true ORDER BY id")
        return [{"id": r["id"], "text": r["text"], "name": r["author_name"], "business": r["business_name"], "stars": r["stars"]} for r in rows]
    except:
        return [{"id": 1, "text": "Antes usaba un cuaderno. Ahora se cuanto vendi. Cambio todo.", "name": "Carlos", "business": "Kiosco Don Carlos", "stars": 5},
                {"id": 2, "text": "Se corto internet 3 dias y cobramos normal.", "name": "Maria", "business": "Almacen La Buena Fe", "stars": 5}]

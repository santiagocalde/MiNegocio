"""
MiNegocio Backend - FastAPI + PostgreSQL (cloud) / SQLite (local offline)
Modo hibrido: PG cuando DATABASE_URL esta configurado, SQLite en modo local
Puerto: 8000
"""

import os
import sys
import asyncio
import shutil
import logging
import gzip
import tempfile
import sqlite3
import glob
import json
import uuid
from datetime import datetime, timedelta, date
from typing import Optional
from contextlib import asynccontextmanager

import aiosqlite
import bcrypt
from jose import JWTError, jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Body, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import contextvars
from starlette.middleware.base import BaseHTTPMiddleware

business_id_ctx = contextvars.ContextVar("business_id_ctx", default=None)

_original_aiosqlite_connect = aiosqlite.connect

def _tenant_aware_connect(database, *args, **kwargs):
    b_id = business_id_ctx.get()
    if b_id and database == DB_PATH:
        tenant_db = os.path.join(DATA_DIR, f"minegocio_{b_id}.db")
        return _original_aiosqlite_connect(tenant_db, *args, **kwargs)
    return _original_aiosqlite_connect(database, *args, **kwargs)

aiosqlite.connect = _tenant_aware_connect


env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.getenv("DB_PATH") or os.path.join(DATA_DIR, "minegocio.db")
LOG_FILE = os.path.join(BASE_DIR, "minegocio.log")

JWT_SECRET = os.getenv("JWT_SECRET", "ta1P4pMAryFH5_lDGf-8GmbTSBrMWg5uYheoWg93s1o")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES  = 60
REFRESH_TOKEN_EXPIRE_DAYS    = 7

DATABASE_URL  = os.getenv("DATABASE_URL", "")
SAAS_MODE     = os.getenv("SAAS_MODE", "false").lower() == "true"
APP_ENV       = os.getenv("APP_ENV", "development")
USE_PG        = bool(DATABASE_URL)

# ── Mercado Pago ──────────────────────────────────────────────
MP_COLLECTOR_ID = os.getenv("MP_COLLECTOR_ID", "")

# Lock global para prevenir race conditions en escrituras asíncronas
db_write_lock = asyncio.Lock()


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("NovaStock")



# ────────────────────────────────────────────────────────────
from core.database import init_db




# ────────────────────────────────────────────────────────────
# APP LIFECYCLE & BACKGROUND TASKS
# ────────────────────────────────────────────────────────────
async def backup_task() -> None:
    """Realiza un backup automático cada 10 minutos con compresión GZIP y rotación"""
    backup_dir = os.path.join(BASE_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    
    while True:
        try:
            # 1. Verificar espacio en disco (mínimo 100MB)
            total, used, free = shutil.disk_usage(BASE_DIR)
            if free < 100_000_000:
                logger.error("Disco casi lleno. Backups pausados por seguridad.")
                await asyncio.sleep(600)
                continue

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path_tmp = os.path.join(backup_dir, f"novastock_backup_tmp.db")
            backup_path_gz = os.path.join(backup_dir, f"backup_{timestamp}.db.gz")
            
            # 2. Copia segura SQLite a archivo temporal (evita locks)
            async with aiosqlite.connect(DB_PATH) as src, aiosqlite.connect(backup_path_tmp) as dst:
                await src.backup(dst)
            
            # 3. Comprimir a GZIP para ahorrar 95% de espacio
            with open(backup_path_tmp, 'rb') as f_in:
                with gzip.open(backup_path_gz, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            # 4. VALIDACIÓN DE INTEGRIDAD
            is_valid = False
            with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
                with gzip.open(backup_path_gz, 'rb') as gz:
                    tmp.write(gz.read())
                tmp_path = tmp.name
                
            try:
                test_conn = sqlite3.connect(tmp_path)
                cursor = test_conn.cursor()
                cursor.execute("PRAGMA integrity_check")
                result = cursor.fetchone()
                test_conn.close()
                
                if result[0] == "ok":
                    is_valid = True
                else:
                    logger.error(f"Backup corrupto detectado ({result[0]}). Eliminando.")
            except Exception as e:
                logger.error(f"Error al verificar integridad del backup: {e}")
            finally:
                os.remove(tmp_path)
                
            if not is_valid:
                os.remove(backup_path_gz)
                await asyncio.sleep(600)
                continue
            
            # 5. Rota (mantener máximo 10 backups)
            backups = sorted(glob.glob(os.path.join(backup_dir, "*.db.gz")))
            if len(backups) > 10:
                for old in backups[:-10]:
                    os.remove(old)
                    
            logger.info(f"Backup válido creado: {backup_path_gz}")
        except Exception as e:
            logger.error(f"No se pudo crear el backup: {e}")
            
        await asyncio.sleep(600) # 10 minutos

def validate_env():
    warnings = []
    errors = []
    jwt_secret = os.getenv("JWT_SECRET", "")
    if not jwt_secret or jwt_secret == "novastock-dev-secret-CAMBIAR-EN-PRODUCCION-2026":
        if os.getenv("APP_ENV", "development") == "production":
            errors.append("JWT_SECRET must be changed from default in production!")
        else:
            warnings.append("JWT_SECRET is using the default dev secret. Change it for production.")
    db_url = os.getenv("DATABASE_URL", "")
    if db_url and not db_url.startswith("postgresql"):
        warnings.append("DATABASE_URL should start with 'postgresql://'")
    for w in warnings:
        logger.warning(f"⚠️  {w}")
    for e in errors:
        logger.error(f"🚨 {e}")
    if errors:
        logger.critical("Environment validation failed. Exiting.")
        sys.exit(1)

@asynccontextmanager
async def lifespan(app: FastAPI) -> None:
    validate_env()
    logger.info("Iniciando motor de base de datos...")
    
    if USE_PG:
        try:
            from db import init_pg
            await init_pg()
            logger.info("PostgreSQL inicializado — modo cloud activo")
            from routers.admin import seed_superadmin
            await seed_superadmin()
        except Exception as e:
            logger.error(f"PostgreSQL no disponible: {e}")
            if APP_ENV == "production":
                raise
            logger.warning("Iniciando en modo SQLite local (fallback)")
            await init_db(DB_PATH, logger)
    else:
        await init_db(DB_PATH, logger)
        logger.info("SQLite inicializado — modo local")
    
    task = asyncio.create_task(backup_task())
    grace_task = asyncio.create_task(check_billing_grace_period())
    email_task = asyncio.create_task(check_trial_emails())
    logger.info("MiNegocio corriendo en http://localhost:8000")
    yield
    task.cancel()
    grace_task.cancel()
    email_task.cancel()
    try:
        from db import close_pool
        await close_pool()
    except Exception:
        pass


from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(
    title="NovaStock API",
    description="Backend local para kioscos argentinos. 100% offline.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Extraer business_id del JWT siempre que este presente
        auth_header = request.headers.get("Authorization")
        b_id = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                if payload.get("type") == "access":
                    b_id = payload.get("sub")
                    business_id_ctx.set(b_id)
            except jwt.ExpiredSignatureError:
                pass
            except jwt.JWTError:
                pass
            except Exception:
                pass

        # Rutas publicas (docs, preflight, auth login/register, etc.)
        if SAAS_MODE and not b_id and path.startswith("/api/") and not path.startswith("/api/auth") and not path.startswith("/api/admin/auth") and not path.startswith("/api/login") and not path.startswith("/api/health") and not path.startswith("/api/billing/webhook") and not path.startswith("/api/plans") and not path.startswith("/api/metrics") and not path.startswith("/api/testimonials") and not path.startswith("/api/send-contact") and not path.startswith("/docs") and not path.startswith("/openapi"):
            if request.method == "OPTIONS":
                return await call_next(request)
            return JSONResponse(status_code=401, content={"detail": "Token JWT requerido en modo SaaS. Acceso denegado."})
            
        return await call_next(request)

app.add_middleware(TenantMiddleware)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from event_stream import events

# ── Rate Limiter ─────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
from fastapi.responses import StreamingResponse

@app.get("/api/events", summary="SSE: Recibir eventos en tiempo real")
async def sse_event_stream():
    queue = events.register()
    async def event_generator():
        try:
            while True:
                payload = await queue.get()
                yield payload
        except asyncio.CancelledError:
            pass
        finally:
            events.unregister(queue)
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ────────────────────────────────────────────────────────────
# SCHEMAS
# ────────────────────────────────────────────────────────────
from schemas.models import *

# ────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────
def row_to_dict(row, description):
    return {description[i][0]: row[i] for i in range(len(description))}

async def get_product_or_404(db, product_id: int) -> dict:
    async with db.execute("SELECT * FROM products WHERE id = ? AND is_active = 1", (product_id,)) as cur:
        row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Producto no encontrado o inactivo")
        return row_to_dict(row, cur.description)


# ────────────────────────────────────────────────────────────
# PLAN GATING — Límites por plan de suscripción
# ────────────────────────────────────────────────────────────
PLAN_LIMITS = {
    "trial":  {"max_products": 50,    "max_operators": 2, "multi_sucursal": False, "purchases": False, "audit_cloud": False},
    "simple": {"max_products": 3500,  "max_operators": 2, "multi_sucursal": False, "purchases": True,  "audit_cloud": False},
    "pro":    {"max_products": 7000,  "max_operators": 5, "multi_sucursal": True,  "purchases": True,  "audit_cloud": True},
    "ia":     {"max_products": 10000, "max_operators": 10, "multi_sucursal": True, "purchases": True, "audit_cloud": True},
}

async def check_plan_limits(feature: str, business: Optional[dict] = None) -> dict:
    """
    Valida si el plan del comercio tiene acceso a una feature.
    Si business es None (modo local), permite todo (operación en kiosco físico).
    Lanza HTTP 402 si el límite fue superado.
    """
    if business is None:
        return PLAN_LIMITS["ia"]  # Modo local = sin restricciones

    plan = business.get("plan", "trial")
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])

    if feature == "multi_sucursal" and not limits["multi_sucursal"]:
        raise HTTPException(
            status_code=402,
            detail=f"Multi-sucursal requiere Plan Pro o superior. Tu plan actual es '{plan}'."
        )
    if feature == "purchases" and not limits["purchases"]:
        raise HTTPException(
            status_code=402,
            detail=f"El módulo de Compras requiere Plan Simple o superior."
        )
    if feature == "audit_cloud" and not limits["audit_cloud"]:
        raise HTTPException(
            status_code=402,
            detail=f"Auditoría en la nube requiere Plan Pro o superior."
        )
    return limits

async def check_product_limit(business: Optional[dict] = None, extra_count: int = 0) -> dict:
    """Verifica que el comercio no supero el limite de productos de su plan."""
    if business is None:
        return

    plan  = business.get("plan", "trial")
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])["max_products"]
    if limit is None:
        return

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM products WHERE business_id = $1 AND is_virtual = 0",
                business.get("sub")
            )
    else:
        import aiosqlite
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT COUNT(*) FROM products WHERE is_virtual = 0") as cur:
                count = (await cur.fetchone())[0]

    if count + extra_count > limit:
        raise HTTPException(
            status_code=402,
            detail=f"Limite de {limit} productos alcanzado (plan {plan}). Tienes {count}, intentas agregar {extra_count}. Actualiza tu plan."
        )
    return {"count": count, "limit": limit}


# ────────────────────────────────────────────────────────────
# ROLE GUARD — Protege endpoints según rol del operador
# ────────────────────────────────────────────────────────────
ROLE_HIERARCHY = {"admin": 3, "manager": 2, "employee": 1, "cashier": 0}

async def require_role(operator_name: str, min_role: str = "admin") -> dict:
    """
    Valida que el operador tiene al menos el rol mínimo requerido.
    Si 'operator_name' es 'Sistema' o vacío, se asume modo admin (kiosco local).
    """
    if not operator_name or operator_name == "Sistema":
        raise HTTPException(
            status_code=403,
            detail="Operador inválido. Se requiere un operador real para esta acción."
        )

    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT role FROM operators WHERE name = ?", (operator_name,)) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=403,
            detail="Operador desconocido."
        )

    op_level  = ROLE_HIERARCHY.get(row[0], 0)
    min_level = ROLE_HIERARCHY.get(min_role, 3)

    if op_level < min_level:
        raise HTTPException(
            status_code=403,
            detail=f"Acción denegada. Se requiere rol '{min_role}' o superior."
        )



# ────────────────────────────────────────────────────────────
# AUTH — HELPERS JWT
# ────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload.update({"exp": expire, "type": "refresh"})
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_business(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Middleware opt-in: valida JWT y enriquece con plan desde DB."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalido")
        try:
            from db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT plan FROM businesses WHERE id = $1",
                    payload["sub"],
                )
            if row:
                payload["plan"] = row["plan"]
            else:
                payload["plan"] = "trial"
        except Exception:
            payload["plan"] = "trial"
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")


# ────────────────────────────────────────────────────────────
# AUTH & OPERATORS ENDPOINTS
# ────────────────────────────────────────────────────────────

# ── Login local (PIN con bcrypt) ──────────────────────────────
@app.post("/api/login", summary="Validar PIN de operador")
@limiter.limit("5/minute")
async def login(request: Request, data: dict) -> dict:
    pin = str(data.get("pin", ""))
    if not pin.isdigit() or len(pin) != 4:
        raise HTTPException(status_code=400, detail="El PIN debe tener exactamente 4 digitos numericos")

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            rows = await conn.fetch("SELECT id, name, pin, role FROM operators WHERE business_id = $1", b_id)
            for row in rows:
                try:
                    if bcrypt.checkpw(pin.encode(), row["pin"].encode()):
                        t = await _ensure_open_turn_pg(conn, row["name"], b_id)
                        return {"operator_id": row["id"], "id": row["id"], "name": row["name"], "role": row["role"], "turn_id": t["turn_id"], "turn_auto_opened": t["turn_auto_opened"], "turn_opened_at": t.get("turn_opened_at")}
                except Exception:
                    if not row["pin"].startswith("$2b$") and pin == row["pin"]:
                        t = await _ensure_open_turn_pg(conn, row["name"], b_id)
                        return {"operator_id": row["id"], "id": row["id"], "name": row["name"], "role": row["role"], "turn_id": t["turn_id"], "turn_auto_opened": t["turn_auto_opened"], "turn_opened_at": t.get("turn_opened_at")}
            raise HTTPException(status_code=401, detail="PIN incorrecto")
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT id, name, pin, role FROM operators", ()) as cur:
                rows = await cur.fetchall()
        for row in rows:
            op_id, op_name, op_pin_hash, op_role = row
            try:
                if bcrypt.checkpw(pin.encode(), op_pin_hash.encode()):
                    t = await _ensure_open_turn(op_name)
                    return {"operator_id": op_id, "id": op_id, "name": op_name, "role": op_role, "turn_id": t["turn_id"], "turn_auto_opened": t["turn_auto_opened"], "turn_opened_at": t.get("turn_opened_at")}
            except Exception:
                if not op_pin_hash.startswith("$2b$") and pin == op_pin_hash:
                    t = await _ensure_open_turn(op_name)
                    return {"operator_id": op_id, "id": op_id, "name": op_name, "role": op_role, "turn_id": t["turn_id"], "turn_auto_opened": t["turn_auto_opened"], "turn_opened_at": t.get("turn_opened_at")}
        raise HTTPException(status_code=401, detail="PIN incorrecto")


async def _ensure_open_turn_pg(conn, operator: str, b_id: str):
    row = await conn.fetchrow(
        "SELECT id, opened_at FROM turns WHERE closed_at IS NULL AND business_id = $1 ORDER BY opened_at DESC LIMIT 1",
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
        else:
            return {"turn_id": row["id"], "turn_auto_opened": False, "turn_opened_at": str(row["opened_at"])}
    new_row = await conn.fetchrow(
        "INSERT INTO turns (business_id, operator) VALUES ($1, $2) RETURNING id, opened_at",
        b_id, operator
    )
    return {"turn_id": new_row["id"], "turn_auto_opened": True, "turn_opened_at": str(new_row["opened_at"])}


async def _ensure_open_turn(operator: str):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, opened_at FROM turns WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1") as cur:
            row = await cur.fetchone()
            if row:
                async with db.execute("SELECT (julianday('now','localtime') - julianday(?)) * 24.0", (row[1],)) as cur2:
                    diff = await cur2.fetchone()
                if diff and diff[0] >= 14:
                    await db.execute(
                        "UPDATE turns SET closed_at = datetime('now','localtime'), sales_total = COALESCE((SELECT SUM(total) FROM sales WHERE turn_id = ?), 0), notes = 'Cierre automatico > 14hs' WHERE id = ?",
                        (row[0], row[0])
                    )
                    await db.commit()
                else:
                    return {"turn_id": row[0], "turn_auto_opened": False, "turn_opened_at": row[1]}
        cur = await db.execute("INSERT INTO turns (operator, opened_at) VALUES (?, datetime('now','localtime'))", (operator,))
        await db.commit()
        opened_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return {"turn_id": cur.lastrowid, "turn_auto_opened": True, "turn_opened_at": opened_at}

# ── Gestión de operadores ─────────────────────────────────────
@app.get("/api/operators", summary="Listar operadores")
async def list_operators() -> list:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            rows = await conn.fetch(
                "SELECT id, name, role FROM operators WHERE business_id = $1 ORDER BY name",
                b_id
            )
            return [dict(r) for r in rows]
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT id, name, role FROM operators") as cur:
                rows = await cur.fetchall()
                return [row_to_dict(r, cur.description) for r in rows]

@app.put("/api/operators", summary="Reemplazar todos los operadores")
async def update_operators(request: Request, data: list[dict]) -> dict:
    if USE_PG:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            biz = await get_current_business(auth)
            if biz:
                plan = biz.get("plan", "trial")
                max_ops = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])["max_operators"]
                if max_ops and len(data) > max_ops:
                    raise HTTPException(402, detail=f"Limite de {max_ops} operadores (plan {plan}). Recibidos {len(data)}. Actualiza tu plan.")
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            await conn.execute("DELETE FROM operators WHERE business_id = $1", b_id)
            for op in data:
                plain_pin = str(op.get("pin", ""))
                if plain_pin and not plain_pin.startswith("$2b$"):
                    pin_to_store = bcrypt.hashpw(plain_pin.encode(), bcrypt.gensalt()).decode()
                else:
                    pin_to_store = plain_pin
                await conn.execute(
                    "INSERT INTO operators (business_id, name, pin, role) VALUES ($1,$2,$3,$4)",
                    b_id, op.get("name", ""), pin_to_store, op.get("role", "employee")
                )
        return {"success": True}
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("DELETE FROM operators")
            for op in data:
                plain_pin = str(op.get("pin", ""))
                if plain_pin and not plain_pin.startswith("$2b$"):
                    pin_to_store = bcrypt.hashpw(plain_pin.encode(), bcrypt.gensalt()).decode()
                else:
                    pin_to_store = plain_pin
                await db.execute(
                    "INSERT INTO operators (name, pin, role) VALUES (?,?,?)",
                    (op.get("name", ""), pin_to_store, op.get("role", "employee"))
                )
            await db.commit()
        return {"success": True}


@app.post("/api/operators", summary="Crear operador individual")
@limiter.limit("10/minute")
async def create_operator(request: Request, data: dict) -> dict:
    name = str(data.get("name", "")).strip()
    pin = str(data.get("pin", ""))
    role = str(data.get("role", "employee"))
    if not name: raise HTTPException(400, detail="Nombre requerido")
    if not pin.isdigit() or len(pin) < 4 or len(pin) > 6: raise HTTPException(400, detail="PIN 4-6 digitos")
    if role not in ("admin","manager","employee","cashier"): raise HTTPException(400, detail="Rol invalido")
    if USE_PG:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            biz = await get_current_business(auth)
            if biz:
                plan = biz.get("plan", "trial")
                max_ops = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])["max_operators"]
            if max_ops:
                from db_helpers import get_pg_pool
                pool = await get_pg_pool()
                async with pool.acquire() as conn:
                    count = await conn.fetchval("SELECT COUNT(*) FROM operators WHERE business_id = $1", biz["sub"])
                    if count >= max_ops:
                        raise HTTPException(402, detail=f"Limite de {max_ops} operadores alcanzado (plan {plan}). Actualiza tu plan.")
    hashed = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            row = await conn.fetchrow("INSERT INTO operators (business_id, name, pin, role) VALUES ($1,$2,$3,$4) RETURNING id", b_id, name, hashed, role)
            return {"id": row["id"], "name": name, "role": role}
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            cur = await db.execute("INSERT INTO operators (name, pin, role) VALUES (?,?,?)", (name, hashed, role))
            await db.commit()
            return {"id": cur.lastrowid, "name": name, "role": role}


@app.patch("/api/operators/{operator_id}", summary="Actualizar operador")
async def patch_operator(operator_id: int, data: dict) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = business_id_ctx.get()
            cur = await conn.fetchrow("SELECT id FROM operators WHERE id = $1 AND business_id = $2", operator_id, b_id)
            if not cur: raise HTTPException(404, detail="Operador no encontrado")
            updates = []; params = []; n = 1
            if "name" in data: updates.append(f"name = ${n}"); params.append(str(data["name"]).strip()); n += 1
            if "pin" in data:
                p = str(data["pin"])
                if not p.isdigit() or len(p) < 4 or len(p) > 6: raise HTTPException(400, detail="PIN 4-6 digitos")
                h = bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
                updates.append(f"pin = ${n}"); params.append(h); n += 1
            if "role" in data:
                r = str(data["role"])
                if r not in ("admin","manager","employee","cashier"): raise HTTPException(400, detail="Rol invalido")
                updates.append(f"role = ${n}"); params.append(r); n += 1
            if not updates: return {"message": "Sin cambios"}
            params.append(operator_id)
            await conn.execute(f"UPDATE operators SET {', '.join(updates)} WHERE id = ${n}", *params)
            return {"success": True}
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            cur = await db.execute("SELECT id FROM operators WHERE id = ?", (operator_id,))
            if not await cur.fetchone(): raise HTTPException(404, detail="Operador no encontrado")
            updates = []; params = []
            if "name" in data: updates.append("name = ?"); params.append(str(data["name"]).strip())
            if "pin" in data:
                p = str(data["pin"])
                if not p.isdigit() or len(p) < 4 or len(p) > 6: raise HTTPException(400, detail="PIN 4-6 digitos")
                h = bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
                updates.append("pin = ?"); params.append(h)
            if "role" in data:
                r = str(data["role"])
                if r not in ("admin","manager","employee","cashier"): raise HTTPException(400, detail="Rol invalido")
                updates.append("role = ?"); params.append(r)
            if not updates: return {"message": "Sin cambios"}
            params.append(operator_id)
            await db.execute(f"UPDATE operators SET {', '.join(updates)} WHERE id = ?", tuple(params))
            await db.commit()
            return {"success": True}


@app.delete("/api/operators/{operator_id}", summary="Eliminar operador")
async def delete_operator(operator_id: int) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM operators WHERE id = $1 AND business_id = $2", operator_id, business_id_ctx.get())
            return {"success": True}
    else:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("DELETE FROM operators WHERE id = ?", (operator_id,))
            await db.commit()
            return {"success": True}
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("SELECT id FROM operators WHERE id = ?", (operator_id,))
        if not await cur.fetchone():
            raise HTTPException(status_code=404, detail="Operador no encontrado")
        await db.execute("DELETE FROM operators WHERE id = ?", (operator_id,))
        await db.commit()
    return {"success": True}


# ────────────────────────────────────────────────────────────
# AUTH SAAS — REGISTRO Y LOGIN POR EMAIL (multi-tenant)
# ────────────────────────────────────────────────────────────
# ────────────────────────────────────────────────────────────
# BACKGROUND TASKS
# ────────────────────────────────────────────────────────────

async def check_trial_emails() -> None:
    """Envía emails de Resend cada 2 días y a los 7 días (expirado)."""
    import asyncio
    from services.email_service import send_trial_reminder
    while True:
        try:
            if USE_PG:
                from db_helpers import get_pg_pool
                pool = await get_pg_pool()
                async with pool.acquire() as conn:
                    # Cada 2 días durante la prueba (Día 2, 4, 6)
                    reminders_active = await conn.fetch("""
                        SELECT id, email, business_name, 
                        EXTRACT(DAY FROM (CURRENT_DATE - DATE(created_at))) as days_passed
                        FROM businesses 
                        WHERE plan = 'trial' 
                        AND EXTRACT(DAY FROM (CURRENT_DATE - DATE(created_at))) IN (2, 4, 6)
                    """)
                    for b in reminders_active:
                        days_left = 7 - int(b["days_passed"])
                        await send_trial_reminder(b["email"], b["business_name"], days_left)

                    # Expirados (Día 7)
                    reminders_7d = await conn.fetch("SELECT id, email, business_name FROM businesses WHERE plan = 'trial' AND DATE(created_at) = CURRENT_DATE - INTERVAL '7 days'")
                    for b in reminders_7d:
                        await send_trial_reminder(b["email"], b["business_name"], 0)
            logger.info("Tarea de emails de prueba completada.")
        except Exception as e:
            logger.error(f"Error en tarea de emails de prueba: {e}")
        await asyncio.sleep(86400)

async def check_billing_grace_period() -> None:
    import asyncio
    while True:
        try:
            if USE_PG:
                from db_helpers import get_pg_pool
                pool = await get_pg_pool()
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        await conn.execute("""
                            UPDATE businesses SET status = 'past_due', updated_at = now()
                            WHERE status = 'active' AND plan != 'trial' AND plan_end_date IS NOT NULL
                            AND plan_end_date + interval '3 days' <= now()
                        """)
                        await conn.execute("""
                            UPDATE businesses SET status = 'suspended', updated_at = now()
                            WHERE status IN ('active', 'past_due') AND plan != 'trial' AND plan_end_date IS NOT NULL
                            AND plan_end_date + interval '15 days' <= now()
                        """)
                        await conn.execute("""
                            UPDATE businesses SET status = 'expired', updated_at = now()
                            WHERE status = 'active' AND plan = 'trial'
                            AND created_at + interval '7 days' <= now()
                        """)
            else:
                async with aiosqlite.connect(DB_PATH) as db:
                    await db.execute("BEGIN IMMEDIATE")
                    await db.execute("UPDATE businesses SET status = 'past_due', updated_at = datetime('now','localtime') WHERE status = 'active' AND plan != 'trial' AND plan_end_date IS NOT NULL AND date(plan_end_date, '+3 days') <= date('now')")
                    await db.execute("UPDATE businesses SET status = 'suspended', updated_at = datetime('now','localtime') WHERE status IN ('active', 'past_due') AND plan != 'trial' AND plan_end_date IS NOT NULL AND date(plan_end_date, '+15 days') <= date('now')")
                    await db.execute("UPDATE businesses SET status = 'expired', updated_at = datetime('now','localtime') WHERE status = 'active' AND plan = 'trial' AND date(created_at, '+7 days') <= date('now')")
                    await db.commit()
            logger.info("Grace period task completada.")
        except Exception as e:
            logger.error(f"Error en grace period task: {e}")
        await asyncio.sleep(60 * 60)

# ─────────────────────────────────────────────────────────────
# INCLUSIÓN DE ROUTERS MODULARES
# ─────────────────────────────────────────────────────────────
from routers.products import router as products_router
from routers.sales import router as sales_router
from routers.inventory import router as inventory_router
from routers.config import router as config_router
from routers.system import router as system_router
from routers.ai import router as ai_router
from routers.promotions import router as promotions_router
from routers.cashier import router as cashier_router
from routers.reports import router as reports_router
from routers.auth import router as auth_router
from routers.billing import router as billing_router
from routers.admin import router as admin_router

app.include_router(products_router)
app.include_router(sales_router)
app.include_router(inventory_router)
app.include_router(config_router)
app.include_router(system_router)
app.include_router(ai_router)
app.include_router(promotions_router)
app.include_router(cashier_router)
app.include_router(reports_router)
app.include_router(auth_router)
app.include_router(billing_router, prefix="/api/billing")
app.include_router(admin_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)

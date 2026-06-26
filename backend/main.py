"""
MiNegocio Backend — FastAPI + PostgreSQL (cloud) / SQLite (local offline)
Modo híbrido: PG cuando DATABASE_URL está configurado, SQLite en modo local.
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
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import aiosqlite
from jose import JWTError, jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

# ── ContextVar del tenant — importado por todos los routers ──
from core.context import business_id_ctx

# ── Monkey-patch aiosqlite para routing multitenant en modo SQLite ──
_original_aiosqlite_connect = aiosqlite.connect

def _tenant_aware_connect(database, *args, **kwargs):
    b_id = business_id_ctx.get()
    if b_id and database == DB_PATH:
        tenant_db = os.path.join(DATA_DIR, f"minegocio_{b_id}.db")
        return _original_aiosqlite_connect(tenant_db, *args, **kwargs)
    return _original_aiosqlite_connect(database, *args, **kwargs)

aiosqlite.connect = _tenant_aware_connect

# ── Entorno ───────────────────────────────────────────────────
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH  = os.getenv("DB_PATH") or os.path.join(DATA_DIR, "minegocio.db")
LOG_FILE = os.path.join(BASE_DIR, "minegocio.log")

# JWT: única fuente de verdad en core/config.py (todos los módulos la comparten)
from core.config import (
    JWT_SECRET, JWT_ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS,
)

DATABASE_URL = os.getenv("DATABASE_URL", "")
SAAS_MODE    = os.getenv("SAAS_MODE", "false").lower() == "true"
APP_ENV      = os.getenv("APP_ENV", "development")
USE_PG       = bool(DATABASE_URL)

MP_COLLECTOR_ID = os.getenv("MP_COLLECTOR_ID", "")

db_write_lock = asyncio.Lock()

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("NovaStock")


# ── Helpers de DB (re-exportados para compatibilidad con routers legacy) ──
def row_to_dict(row, description):
    return {description[i][0]: row[i] for i in range(len(description))}

async def get_product_or_404(db, product_id: int) -> dict:
    async with db.execute("SELECT * FROM products WHERE id = ? AND is_active = 1", (product_id,)) as cur:
        row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Producto no encontrado o inactivo")
        return row_to_dict(row, cur.description)


# ── Validación de entorno ─────────────────────────────────────
def validate_env():
    jwt_secret = os.getenv("JWT_SECRET", "")
    # Placeholders genéricos de desarrollo que NUNCA deben usarse en producción.
    # No incluir acá secretos reales: la lista vive en el source y es pública.
    weak_secrets = {
        "",
        "dev-insecure-change-me",
        "novastock-dev-secret-CAMBIAR-EN-PRODUCCION-2026",
        "super-secret-key-change-me-in-production",
    }
    if jwt_secret in weak_secrets or len(jwt_secret) < 32:
        if APP_ENV == "production":
            logger.critical("🚨 JWT_SECRET ausente o inseguro en producción. Definí un JWT_SECRET fuerte (>=32 chars) en .env.")
            sys.exit(1)
        else:
            logger.warning("⚠️  JWT_SECRET inseguro/por defecto. Cambialo antes de ir a producción.")
    db_url = os.getenv("DATABASE_URL", "")
    if db_url and not db_url.startswith("postgresql"):
        logger.warning("⚠️  DATABASE_URL should start with 'postgresql://'")


# ── SQLite backup task (solo modo local) ──────────────────────
async def backup_task() -> None:
    """Backup automático cada 10 minutos con GZIP y rotación. Solo en modo SQLite."""
    backup_dir = os.path.join(BASE_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)

    while True:
        try:
            total, used, free = shutil.disk_usage(BASE_DIR)
            if free < 100_000_000:
                logger.error("Disco casi lleno. Backups pausados por seguridad.")
                await asyncio.sleep(600)
                continue

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path_tmp = os.path.join(backup_dir, "novastock_backup_tmp.db")
            backup_path_gz  = os.path.join(backup_dir, f"backup_{timestamp}.db.gz")

            async with aiosqlite.connect(DB_PATH) as src, aiosqlite.connect(backup_path_tmp) as dst:
                await src.backup(dst)

            with open(backup_path_tmp, "rb") as f_in:
                with gzip.open(backup_path_gz, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)

            is_valid = False
            with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
                with gzip.open(backup_path_gz, "rb") as gz:
                    tmp.write(gz.read())
                tmp_path = tmp.name

            try:
                test_conn = sqlite3.connect(tmp_path)
                result = test_conn.cursor().execute("PRAGMA integrity_check").fetchone()
                test_conn.close()
                is_valid = result[0] == "ok"
                if not is_valid:
                    logger.error(f"Backup corrupto detectado ({result[0]}). Eliminando.")
            except Exception as e:
                logger.error(f"Error al verificar integridad del backup: {e}")
            finally:
                os.remove(tmp_path)

            if not is_valid:
                os.remove(backup_path_gz)
            else:
                backups = sorted(glob.glob(os.path.join(backup_dir, "*.db.gz")))
                for old in backups[:-10]:
                    os.remove(old)
                logger.info(f"Backup válido creado: {backup_path_gz}")
        except Exception as e:
            logger.error(f"No se pudo crear el backup: {e}")

        await asyncio.sleep(600)


# ── Lifespan ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_env()
    logger.info("Iniciando motor de base de datos...")
    from core.database import init_db
    from core.background_tasks import check_billing_grace_period, check_trial_emails

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

    grace_task = asyncio.create_task(check_billing_grace_period())
    email_task = asyncio.create_task(check_trial_emails())
    sqlite_backup_task = None
    if not USE_PG:
        sqlite_backup_task = asyncio.create_task(backup_task())

    logger.info("MiNegocio corriendo en http://localhost:8000")
    yield

    grace_task.cancel()
    email_task.cancel()
    if sqlite_backup_task:
        sqlite_backup_task.cancel()

    try:
        from db import close_pool
        await close_pool()
    except Exception:
        pass


# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="MiNegocio API",
    description="Backend POS para kioscos argentinos. Modo híbrido SQLite/PostgreSQL.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── CORS controlado por entorno ───────────────────────────────
_CORS_ORIGINS = (
    ["https://mi-negocio.app", "https://www.mi-negocio.app"]
    if APP_ENV == "production"
    else ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:5173"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    allow_credentials=False,
    max_age=600,
)


# ── Tenant middleware ─────────────────────────────────────────
class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        auth_header = request.headers.get("Authorization")
        b_id = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                if payload.get("type") == "access":
                    b_id = payload.get("sub")
                    business_id_ctx.set(b_id)
            except Exception:
                pass

        public_prefixes = (
            "/api/auth", "/api/admin/auth", "/api/login", "/api/health",
            "/api/billing/webhook", "/api/plans", "/api/metrics",
            "/api/testimonials", "/api/send-contact", "/api/catalogo", "/docs", "/openapi",
        )
        path = request.url.path
        if SAAS_MODE and not b_id and path.startswith("/api/"):
            if not any(path.startswith(p) for p in public_prefixes):
                if request.method == "OPTIONS":
                    return await call_next(request)
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Token JWT requerido en modo SaaS. Acceso denegado."},
                )
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


# ── Rate limiter ──────────────────────────────────────────────
# Limiter único en core.ratelimit (clave por IP real detrás del proxy nginx).
# Los routers aplican @limiter.limit por endpoint; sin SlowAPIMiddleware no hay
# límite global que pueda throttlear todos los kioscos juntos.
from core.ratelimit import limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── SSE — autenticado en modo SaaS ───────────────────────────
from event_stream import events

@app.get("/api/events", summary="SSE: Recibir eventos en tiempo real")
async def sse_event_stream(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    biz_id = None
    if SAAS_MODE:
        raw = token or (
            authorization.split(" ")[1]
            if authorization and authorization.startswith("Bearer ")
            else None
        )
        if not raw:
            raise HTTPException(status_code=401, detail="Token requerido para SSE")
        try:
            payload = jwt.decode(raw, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Token SSE inválido (tipo)")
            biz_id = payload.get("sub")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Token SSE inválido o expirado")

    # Suscripción acotada al tenant: solo recibe eventos de su propio negocio
    queue = events.register(biz_id)

    async def event_generator():
        try:
            while True:
                payload = await queue.get()
                yield payload
        except asyncio.CancelledError:
            pass
        finally:
            events.unregister(queue, biz_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Schemas ───────────────────────────────────────────────────
from schemas.models import *

# ── Re-exports para compatibilidad con routers legacy ────────
# Los routers hacen `from main import X` — estos alias permiten
# migrar los imports gradualmente sin romper nada.
from core.jwt_helpers import (
    get_current_business,
    create_access_token,
    create_refresh_token,
)
from core.plan_limits import (
    PLAN_LIMITS,
    ROLE_HIERARCHY,
    check_plan_limits,
    check_product_limit,
    require_role,
)

# ── Routers ───────────────────────────────────────────────────
from routers.operators import router as operators_router
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

app.include_router(operators_router)
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
    uvicorn.run(app, host="0.0.0.0", port=8000)

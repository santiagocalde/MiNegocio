"""
NovaStock Backend - FastAPI + SQLite
Corre 100% offline en la PC del kiosco.
Puerto: 8000 → http://localhost:8000
Docs: http://localhost:8000/docs
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
import hashlib
import hmac
import base64
from datetime import datetime, timedelta, date
from typing import Optional
from contextlib import asynccontextmanager

import aiosqlite
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────
# CONFIG & GLOBALS
# ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "novastock.db")
LOG_FILE = os.path.join(BASE_DIR, "novastock.log")

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


# ─────────────────────────────────────────────────────────────
# DB INIT
# ─────────────────────────────────────────────────────────────
async def init_db():
    # timeout=10.0 y PRAGMAS previenen locks en multicaja
    async with aiosqlite.connect(DB_PATH, timeout=10.0) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA synchronous=NORMAL;")
        await db.execute("PRAGMA busy_timeout=5000;")
        
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS products (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                code        TEXT    UNIQUE NOT NULL,
                name        TEXT    NOT NULL,
                price       REAL    NOT NULL DEFAULT 0,
                cost_price  REAL    NOT NULL DEFAULT 0,
                stock       INTEGER NOT NULL DEFAULT 0,
                min_stock   INTEGER NOT NULL DEFAULT 5,
                iva         TEXT    NOT NULL DEFAULT '21%',
                created_at  TEXT    DEFAULT (datetime('now','localtime')),
                updated_at  TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS categories (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stock_movements (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id      INTEGER NOT NULL,
                movement_type   TEXT    NOT NULL,
                quantity        INTEGER NOT NULL DEFAULT 0,
                old_value       REAL,
                new_value       REAL,
                reason          TEXT,
                operator        TEXT    DEFAULT 'Sistema',
                timestamp       TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS turns (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                operator    TEXT    NOT NULL,
                opened_at   TEXT    DEFAULT (datetime('now','localtime')),
                closed_at   TEXT,
                sales_total REAL    DEFAULT 0,
                counted_cash REAL,
                difference  REAL,
                notes       TEXT
            );

            CREATE TABLE IF NOT EXISTS sales (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                turn_id     INTEGER,
                total       REAL    NOT NULL,
                payment     REAL    NOT NULL,
                change_given REAL   NOT NULL DEFAULT 0,
                operator    TEXT,
                is_fiado    INTEGER NOT NULL DEFAULT 0,
                fiado_name  TEXT,
                cobrado     INTEGER NOT NULL DEFAULT 0,
                timestamp       TEXT    DEFAULT (datetime('now','localtime')),
                idempotency_key TEXT,
                reverted        INTEGER DEFAULT 0,
                payment_method  TEXT    DEFAULT 'efectivo',
                client_cuit     TEXT    DEFAULT '',
                sucursal_id     INTEGER DEFAULT 1,
                FOREIGN KEY (turn_id) REFERENCES turns(id)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(idempotency_key);
            CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
            CREATE INDEX IF NOT EXISTS idx_sales_turn_id ON sales(turn_id);
            CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

            CREATE TABLE IF NOT EXISTS sale_items (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id     INTEGER NOT NULL,
                product_id  INTEGER NOT NULL,
                product_name TEXT   NOT NULL,
                quantity    INTEGER NOT NULL,
                unit_price  REAL    NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES sales(id)
            );
            CREATE TABLE IF NOT EXISTS business_config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS egresos_caja (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                turn_id     INTEGER,
                monto       REAL    NOT NULL,
                motivo      TEXT    NOT NULL,
                operator    TEXT    DEFAULT 'Sistema',
                timestamp   TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS suppliers (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                contact     TEXT,
                cuit        TEXT,
                created_at  TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS purchases (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_id    INTEGER,
                invoice_number TEXT,
                total_cost     REAL    NOT NULL,
                operator       TEXT    DEFAULT 'Sistema',
                timestamp      TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
            );

            CREATE TABLE IF NOT EXISTS purchase_items (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_id    INTEGER NOT NULL,
                product_id     INTEGER NOT NULL,
                product_name   TEXT    NOT NULL,
                quantity       INTEGER NOT NULL,
                unit_cost      REAL    NOT NULL,
                FOREIGN KEY (purchase_id) REFERENCES purchases(id)
            );

            CREATE TABLE IF NOT EXISTS sucursales (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                address     TEXT    DEFAULT '',
                phone       TEXT    DEFAULT '',
                created_at  TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS operators (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                pin         TEXT    NOT NULL,
                role        TEXT    NOT NULL DEFAULT 'employee',
                created_at  TEXT    DEFAULT (datetime('now','localtime'))
            );
        """)
        try:
            await db.execute("ALTER TABLE sales ADD COLUMN idempotency_key TEXT")
        except:
            pass # Si ya existe la columna, ignora el error
            
        try:
            await db.execute("ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)")
        except:
            pass

        try:
            await db.execute("ALTER TABLE products ADD COLUMN is_virtual INTEGER DEFAULT 0")
            await db.execute("ALTER TABLE products ADD COLUMN parent_id INTEGER REFERENCES products(id)")
            await db.execute("ALTER TABLE products ADD COLUMN pack_size INTEGER DEFAULT 1")
            await db.execute("ALTER TABLE products ADD COLUMN last_purchase_date TEXT")
        except:
            pass

        try:
            await db.execute("ALTER TABLE sales ADD COLUMN reverted INTEGER DEFAULT 0")
        except:
            pass

        try:
            await db.execute("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'efectivo'")
        except:
            pass

        try:
            await db.execute("ALTER TABLE sales ADD COLUMN client_cuit TEXT DEFAULT ''")
        except:
            pass

        try:
            await db.execute("ALTER TABLE sale_items ADD COLUMN item_discount REAL DEFAULT 0")
        except:
            pass

        try:
            await db.execute("ALTER TABLE products ADD COLUMN sucursal_id INTEGER DEFAULT 1 REFERENCES sucursales(id)")
        except: pass
        try:
            await db.execute("ALTER TABLE sales ADD COLUMN sucursal_id INTEGER DEFAULT 1 REFERENCES sucursales(id)")
        except: pass
        try:
            await db.execute("ALTER TABLE turns ADD COLUMN sucursal_id INTEGER DEFAULT 1 REFERENCES sucursales(id)")
        except: pass
        try:
            await db.execute("ALTER TABLE egresos_caja ADD COLUMN sucursal_id INTEGER DEFAULT 1 REFERENCES sucursales(id)")
        except: pass
        try:
            await db.execute("ALTER TABLE purchases ADD COLUMN sucursal_id INTEGER DEFAULT 1 REFERENCES sucursales(id)")
        except: pass
        try:
            await db.execute("ALTER TABLE products ADD COLUMN expiry_date TEXT DEFAULT ''")
        except: pass
            
        await db.commit()

        # Seed categorías base
        count = await db.execute("SELECT COUNT(*) FROM categories")
        if (await count.fetchone())[0] == 0:
            await db.executemany("INSERT INTO categories (name) VALUES (?)",
                [('Golosinas',), ('Bebidas',), ('Almacén',), ('Cigarrillos',), ('Limpieza',), ('Lácteos',)]
            )
        await db.commit()

        # Seed config por defecto
        count = await db.execute("SELECT COUNT(*) FROM business_config")
        if (await count.fetchone())[0] == 0:
            await db.executemany("INSERT OR IGNORE INTO business_config (key, value) VALUES (?,?)",
                [("nombre", "Kiosco El Barrio"),
                 ("subtitulo", "Atención 7 días"),
                 ("direccion", ""),
                 ("telefono", ""),
                 ("cuit", ""),
                 ("condicion_iva", "Monotributista"),
                 ("numero_caja", "CAJA 1"),
                 ("mensaje_ticket", "¡Gracias por su compra!"),
                 ("iva_rate", "21")]
            )
        await db.commit()

        # Seed operadores por defecto
        count = await db.execute("SELECT COUNT(*) FROM operators")
        if (await count.fetchone())[0] == 0:
            await db.executemany("INSERT INTO operators (name, pin, role) VALUES (?,?,?)",
                [("Dueño", "1234", "admin"),
                 ("Juan (Turno Tarde)", "4321", "employee"),
                 ("María (Turno Mañana)", "9999", "employee")]
            )
        await db.commit()

        # Seed sucursal por defecto
        count = await db.execute("SELECT COUNT(*) FROM sucursales")
        row = await count.fetchone()
        if row[0] == 0:
            await db.execute("INSERT INTO sucursales (name, address) VALUES (?, ?)",
                             ("Sucursal Principal", "Av. Corrientes 1234 - CABA"))
            await db.commit()


# ─────────────────────────────────────────────────────────────
# APP LIFECYCLE & BACKGROUND TASKS
# ─────────────────────────────────────────────────────────────
async def backup_task():
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando motor de base de datos...")
    await init_db()
    task = asyncio.create_task(backup_task())
    logger.info("NovaStock corriendo en http://localhost:8000")
    logger.info(f"Base de datos en: {DB_PATH}")
    logger.info("🛡️ WAL Mode activo. Backup automático cada 10 minutos iniciado.")
    yield
    task.cancel()


app = FastAPI(
    title="NovaStock API",
    description="Backend local para kioscos argentinos. 100% offline.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173", "http://localhost:1234", "http://127.0.0.1:1234"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────
class ProductCreate(BaseModel):
    code: str
    name: str
    price: float = 0
    cost_price: float = 0
    stock: int = 0
    min_stock: int = 5
    iva: str = "21%"
    category_id: Optional[int] = None
    is_virtual: bool = False
    parent_id: Optional[int] = None
    pack_size: int = 1
    expiry_date: str = ""

class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    stock: Optional[int] = None
    min_stock: Optional[int] = None
    category_id: Optional[int] = None
    is_virtual: Optional[bool] = None
    parent_id: Optional[int] = None
    pack_size: Optional[int] = None
    expiry_date: Optional[str] = None

class PriceUpdate(BaseModel):
    price: float = Field(gt=0, description="Nuevo precio de venta")
    operator: str = "Sistema"

class StockUpdate(BaseModel):
    stock: int = Field(ge=0, description="Nueva cantidad de stock")
    reason: Optional[str] = None
    operator: str = "Sistema"

class TurnOpen(BaseModel):
    operator: str

class TurnClose(BaseModel):
    sales_total: float
    counted_cash: float
    notes: Optional[str] = None

class SaleItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int = Field(gt=0)
    unit_price: float = Field(gt=0)
    item_discount: float = 0

class SaleCreate(BaseModel):
    turn_id: Optional[int] = None
    total: float
    payment: float
    change_given: float = 0
    operator: str = "Sistema"
    is_fiado: bool = False
    fiado_name: Optional[str] = None
    payment_method: str = "efectivo"
    client_cuit: Optional[str] = None
    items: list[SaleItem] = []


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def row_to_dict(row, description):
    return {description[i][0]: row[i] for i in range(len(description))}

async def get_product_or_404(db, product_id: int):
    async with db.execute("SELECT * FROM products WHERE id = ?", (product_id,)) as cur:
        row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return row_to_dict(row, cur.description)


# ─────────────────────────────────────────────────────────────
# HEALTH & LOGS ENDPOINTS
# ─────────────────────────────────────────────────────────────
@app.get("/api/health", summary="Chequeo rápido del estado del sistema")
async def health_check():
    # Verificar backups disponibles
    backup_dir = os.path.join(BASE_DIR, "backups")
    last_backup = None
    if os.path.exists(backup_dir):
        backups = sorted([f for f in os.listdir(backup_dir) if f.endswith('.db.gz')])
        if backups:
            last_backup_time = os.path.getmtime(os.path.join(backup_dir, backups[-1]))
            last_backup = datetime.fromtimestamp(last_backup_time).strftime('%Y-%m-%d %H:%M:%S')

    return {
        "status": "ok", 
        "wal_mode": True, 
        "last_backup": last_backup,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/backup", summary="Forzar backup manual")
async def trigger_backup():
    import shutil, gzip, tempfile, sqlite3, glob
    from datetime import datetime
    import aiosqlite
    import os

    backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups")
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path_tmp = os.path.join(backup_dir, f"novastock_backup_tmp.db")
    backup_path_gz = os.path.join(backup_dir, f"backup_{timestamp}.db.gz")

    async with aiosqlite.connect(DB_PATH) as src, aiosqlite.connect(backup_path_tmp) as dst:
        await src.backup(dst)

    with open(backup_path_tmp, 'rb') as f_in:
        with gzip.open(backup_path_gz, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)

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
        if result and result[0] == "ok":
            is_valid = True
        else:
            logger.warning(f"Integrity check failed for backup: {result}")
    except Exception as e:
        logger.error(f"Error checking backup integrity: {e}")
    finally:
        os.remove(tmp_path)

    if not is_valid:
        os.remove(backup_path_gz)
        return {"success": False, "message": "Backup corrupto"}

    os.remove(backup_path_tmp)

    backups = sorted(glob.glob(os.path.join(backup_dir, "*.db.gz")))
    if len(backups) > 10:
        for old in backups[:-10]:
            os.remove(old)

    return {"success": True, "backup_file": os.path.basename(backup_path_gz)}

@app.get("/api/backup/list", summary="Listar backups disponibles")
async def list_backups():
    backup_dir = os.path.join(BASE_DIR, "backups")
    if not os.path.exists(backup_dir):
        return []
    backups = sorted(glob.glob(os.path.join(backup_dir, "*.db.gz")), reverse=True)
    result = []
    for b in backups:
        size_kb = round(os.path.getsize(b) / 1024, 1)
        mtime = datetime.fromtimestamp(os.path.getmtime(b)).strftime('%Y-%m-%d %H:%M:%S')
        result.append({"filename": os.path.basename(b), "size_kb": size_kb, "modified": mtime})
    return result

@app.post("/api/backup/restore", summary="Restaurar backup (¡SOLO USAR EN CASO DE EMERGENCIA!)")
async def restore_backup(filename: str = Body(..., embed=True)):
    backup_dir = os.path.join(BASE_DIR, "backups")
    backup_path = os.path.join(backup_dir, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(404, detail="Backup no encontrado")
    
    # Validar integridad
    is_valid = False
    with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
        with gzip.open(backup_path, 'rb') as gz:
            tmp.write(gz.read())
        tmp_path = tmp.name
    try:
        test_conn = sqlite3.connect(tmp_path)
        cursor = test_conn.cursor()
        cursor.execute("PRAGMA integrity_check")
        result = cursor.fetchone()
        test_conn.close()
        if result and result[0] == "ok":
            is_valid = True
    except Exception as e:
        os.remove(tmp_path)
        raise HTTPException(500, detail=f"Error validando backup: {e}")
    
    if not is_valid:
        os.remove(tmp_path)
        raise HTTPException(400, detail="El backup está corrupto. No se puede restaurar.")
    
    # Hacer backup automático del estado actual antes de restaurar
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    pre_restore_path = os.path.join(backup_dir, f"pre_restore_{timestamp}.db.gz")
    try:
        async with aiosqlite.connect(DB_PATH) as src, aiosqlite.connect(tmp_path.replace('.db', '_dest.db')) as dst:
            await src.backup(dst)
        with open(tmp_path.replace('.db', '_dest.db'), 'rb') as f_in:
            with gzip.open(pre_restore_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        os.remove(tmp_path.replace('.db', '_dest.db'))
    except Exception as e:
        logger.warning(f"No se pudo crear backup pre-restore: {e}")
    
    # Restaurar: copiar el backup sobre la DB actual
    try:
        shutil.copy2(tmp_path, DB_PATH)
        os.remove(tmp_path)
        logger.warning(f"⚠️ BASE DE DATOS RESTAURADA desde {filename}. Se reinicia el servidor automáticamente.")
    except Exception as e:
        os.remove(tmp_path)
        raise HTTPException(500, detail=f"Error al restaurar: {e}")
    
    return {"success": True, "message": f"Base de datos restaurada desde {filename}. Se recomienda reiniciar el sistema."}

@app.post("/api/mercadopago/create-payment", summary="Crear pago de Mercado Pago")
async def mercadopago_create_payment(data: dict = Body(...)):
    import requests
    monto = data.get("total", 0)
    descripcion = data.get("description", "Venta en kiosco")
    
    # Obtener access_token desde config
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT value FROM business_config WHERE key='mp_access_token'") as cur:
            row = await cur.fetchone()
            access_token = row[0] if row else ""
    
    if not access_token:
        raise HTTPException(400, detail="Mercado Pago no configurado. Configurá tu access token en Ajustes > Mercado Pago.")
    
    # Intentar con API de Mercado Pago
    try:
        payment_data = {
            "transaction_amount": float(monto),
            "description": descripcion,
            "payment_method_id": "pix",  # fallback
            "payer": {"email": "comprador@kiosco.com"},
        }
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": str(uuid.uuid4()),
        }
        # Primero intentar crear un QR de pago (Point)
        qr_resp = requests.post(
            "https://api.mercadopago.com/instore/orders/qr/seller/collectors/undefined/pos/kiosco01/qrs",
            json={
                "external_reference": f"nova_{int(datetime.now().timestamp())}",
                "title": descripcion,
                "description": descripcion,
                "total_amount": float(monto),
                "items": [{"title": descripcion, "unit_price": float(monto), "quantity": 1, "unit_measure": "unit"}],
                "sponsor": {"id": None},
            },
            headers=headers,
            timeout=10
        )
        if qr_resp.status_code in (200, 201):
            data_resp = qr_resp.json()
            return {
                "success": True,
                "qr_data": data_resp.get("qr_data", ""),
                "payment_id": data_resp.get("id", ""),
                "payment_url": "",
            }
    except:
        pass
    
    # Fallback: crear preferencia de pago (link para pagar)
    try:
        pref_resp = requests.post(
            "https://api.mercadopago.com/checkout/preferences",
            json={
                "items": [{"title": descripcion, "quantity": 1, "unit_price": float(monto)}],
                "back_urls": {"success": "http://localhost:1234", "failure": "http://localhost:1234", "pending": "http://localhost:1234"},
                "auto_return": "approved",
                "external_reference": f"nova_{int(datetime.now().timestamp())}",
            },
            headers=headers,
            timeout=10
        )
        if pref_resp.status_code in (200, 201):
            data_resp = pref_resp.json()
            return {
                "success": True,
                "qr_data": "",
                "payment_id": data_resp.get("id", ""),
                "payment_url": data_resp.get("init_point", ""),
            }
    except:
        pass
    
    raise HTTPException(500, detail="No se pudo conectar con Mercado Pago. Verificá tu access token y conexión a internet.")

@app.get("/api/sales/weekly", summary="Resumen semanal de ventas")
async def weekly_sales(sucursal_id: Optional[int] = Query(None)):
    async with aiosqlite.connect(DB_PATH) as db:
        where = " AND (sucursal_id IS NULL OR sucursal_id = ?)" if sucursal_id else ""
        params = (sucursal_id,) if sucursal_id else ()
        async with db.execute(f"""
            SELECT date(timestamp) as dia,
                   COUNT(*) as tickets,
                   COALESCE(SUM(total), 0) as total,
                   COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END), 0) as fiado
            FROM sales
            WHERE timestamp >= datetime('now', '-7 days', 'localtime')
            {where}
            GROUP BY date(timestamp)
            ORDER BY dia DESC
        """, params) as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

@app.get("/api/sales/monthly", summary="Resumen mensual de ventas")
async def monthly_sales(sucursal_id: Optional[int] = Query(None)):
    async with aiosqlite.connect(DB_PATH) as db:
        where = " AND (sucursal_id IS NULL OR sucursal_id = ?)" if sucursal_id else ""
        params = (sucursal_id,) if sucursal_id else ()
        async with db.execute(f"""
            SELECT date(timestamp) as dia,
                   COUNT(*) as tickets,
                   COALESCE(SUM(total), 0) as total,
                   COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END), 0) as fiado
            FROM sales
            WHERE timestamp >= datetime('now', '-30 days', 'localtime')
            {where}
            GROUP BY date(timestamp)
            ORDER BY dia DESC
        """, params) as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

@app.get("/api/expiry-alerts", summary="Productos próximos a vencer")
async def expiry_alerts(days: int = Query(7, description="Anticipación en días")):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT id, code, name, stock, price, expiry_date,
                   CASE 
                       WHEN expiry_date = '' OR expiry_date IS NULL THEN 'no_expiry'
                       WHEN date(expiry_date) <= date('now','localtime') THEN 'expired'
                       WHEN date(expiry_date) <= date('now', '+' || ? || ' days', 'localtime') THEN 'expiring_soon'
                       ELSE 'ok'
                   END as expiry_status
            FROM products
            WHERE expiry_date != '' AND expiry_date IS NOT NULL
              AND date(expiry_date) <= date('now', '+' || ? || ' days', 'localtime')
            ORDER BY expiry_date ASC
        """, (days, days)) as cur:
            rows = await cur.fetchall()
            alerts = [row_to_dict(r, cur.description) for r in rows]
    return {
        "total": len(alerts),
        "expired": [a for a in alerts if a["expiry_status"] == "expired"],
        "expiring_soon": [a for a in alerts if a["expiry_status"] == "expiring_soon"],
    }

@app.get("/api/logs", summary="Obtener logs del sistema (para UI)")
async def get_system_logs():
    if not os.path.exists(LOG_FILE):
        return []
    try:
        with open(LOG_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            return lines[-50:] # Últimas 50 líneas
    except Exception as e:
        return [f"Error leyendo logs: {e}"]

# ─────────────────────────────────────────────────────────────
# AUTH & OPERATORS ENDPOINTS
# ─────────────────────────────────────────────────────────────
@app.post("/api/login", summary="Validar PIN y obtener operador")
async def login(data: dict):
    pin = str(data.get("pin", ""))
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, name, role FROM operators WHERE pin=?", (pin,)) as cur:
            row = await cur.fetchone()
            if row:
                return row_to_dict(row, cur.description)
            raise HTTPException(status_code=401, detail="PIN incorrecto")

@app.get("/api/operators", summary="Listar operadores")
async def list_operators():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, name, pin, role FROM operators") as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

@app.put("/api/operators", summary="Reemplazar todos los operadores")
async def update_operators(data: list[dict]):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM operators")
        for op in data:
            await db.execute(
                "INSERT INTO operators (name, pin, role) VALUES (?,?,?)",
                (op.get("name", ""), str(op.get("pin", "")), op.get("role", "employee"))
            )
        await db.commit()
    return {"success": True}

# ─────────────────────────────────────────────────────────────
# PRODUCTS & CATEGORIES ENDPOINTS
# ─────────────────────────────────────────────────────────────
@app.get("/api/categories", summary="Listar categorías")
async def list_categories():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, name FROM categories ORDER BY name") as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

@app.get("/api/products", summary="Listar/buscar productos")
async def list_products(q: Optional[str] = Query(None, description="Buscar por nombre o código"), sucursal_id: Optional[int] = Query(None, description="Filtrar por sucursal")):
    async with aiosqlite.connect(DB_PATH) as db:
        base_query = """
            SELECT p.id, p.code, p.name, p.price, p.cost_price, p.min_stock, p.iva, p.created_at, p.updated_at, p.category_id, p.is_virtual, p.parent_id, p.pack_size, p.expiry_date, c.name as category_name,
                   COALESCE(parent.name, '') as parent_name,
                   CASE WHEN p.is_virtual = 1 THEN IFNULL(parent.stock / MAX(1, p.pack_size), 0) ELSE p.stock END as stock
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN products parent ON p.parent_id = parent.id
        """
        if sucursal_id:
            if q:
                term = f"%{q}%"
                async with db.execute(f"{base_query} WHERE (p.name LIKE ? OR p.code LIKE ?) AND (p.sucursal_id IS NULL OR p.sucursal_id = ?) ORDER BY p.name", (term, term, sucursal_id)) as cur:
                    rows = await cur.fetchall()
                    return [row_to_dict(r, cur.description) for r in rows]
            else:
                async with db.execute(f"{base_query} WHERE p.sucursal_id IS NULL OR p.sucursal_id = ? ORDER BY p.name", (sucursal_id,)) as cur:
                    rows = await cur.fetchall()
                    return [row_to_dict(r, cur.description) for r in rows]
        else:
            if q:
                term = f"%{q}%"
                async with db.execute(f"{base_query} WHERE p.name LIKE ? OR p.code LIKE ? ORDER BY p.name", (term, term)) as cur:
                    rows = await cur.fetchall()
                    return [row_to_dict(r, cur.description) for r in rows]
            else:
                async with db.execute(f"{base_query} ORDER BY p.name") as cur:
                    rows = await cur.fetchall()
                    return [row_to_dict(r, cur.description) for r in rows]


@app.get("/api/products/export", summary="Exportar productos a CSV")
async def export_products_csv():
    import csv, io
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT p.code, p.name, p.price, p.cost_price, p.stock, p.min_stock, p.iva,
                   COALESCE(c.name, '') as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.name
        """) as cur:
            rows = await cur.fetchall()
            cols = [desc[0] for desc in cur.description]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(cols)
    for row in rows:
        writer.writerow(row)

    from fastapi.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=productos.csv"}
    )

@app.post("/api/products/import", summary="Importar productos desde CSV")
async def import_products_csv(csv_text: str = Body(..., media_type="text/plain")):
    import csv, io
    reader = csv.DictReader(io.StringIO(csv_text))
    imported = 0
    errors = []

    async with aiosqlite.connect(DB_PATH) as db:
        for row in reader:
            try:
                code = row.get('code', '').strip()
                name = row.get('name', '').strip()
                if not code or not name:
                    errors.append(f"Fila {imported + 2}: code y name son requeridos")
                    continue

                price = float(row.get('price', 0))
                cost_price = float(row.get('cost_price', 0))
                stock = int(row.get('stock', 0))
                min_stock = int(row.get('min_stock', 5))
                iva = row.get('iva', '21%')

                cur = await db.execute("SELECT id FROM products WHERE code = ?", (code,))
                existing = await cur.fetchone()

                if existing:
                    await db.execute("""
                        UPDATE products SET name=?, price=?, cost_price=?, stock=?, min_stock=?, iva=?, updated_at=datetime('now','localtime')
                        WHERE code=?
                    """, (name, price, cost_price, stock, min_stock, iva, code))
                else:
                    await db.execute("""
                        INSERT INTO products (code, name, price, cost_price, stock, min_stock, iva)
                        VALUES (?,?,?,?,?,?,?)
                    """, (code, name, price, cost_price, stock, min_stock, iva))

                imported += 1
            except Exception as e:
                errors.append(f"Fila {imported + 2}: {str(e)}")

        await db.commit()

    return {"imported": imported, "errors": errors}

@app.post("/api/products", status_code=201, summary="Crear producto")
async def create_product(product: ProductCreate):
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            cur = await db.execute(
                "INSERT INTO products (code,name,price,cost_price,stock,min_stock,iva,category_id,is_virtual,parent_id,pack_size,expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (product.code, product.name, product.price, product.cost_price,
                 product.stock, product.min_stock, product.iva, product.category_id,
                 1 if product.is_virtual else 0, product.parent_id, product.pack_size,
                 product.expiry_date or '')
            )
            product_id = cur.lastrowid
            if product.stock > 0:
                await db.execute(
                    "INSERT INTO stock_movements (product_id, movement_type, quantity, old_value, new_value, reason, operator) VALUES (?,?,?,?,?,?,?)",
                    (product_id, "entrada_inicial", product.stock, 0, product.stock, "Stock inicial", "Sistema")
                )
            await db.commit()
            return {"id": product_id, **product.model_dump()}
        except Exception as e:
            await db.rollback()
            if "UNIQUE constraint" in str(e):
                raise HTTPException(status_code=400, detail=f"Ya existe un producto con el código '{product.code}'")
            raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/products/{product_id}/price", summary="Actualizar precio (con auditoría)")
async def update_price(product_id: int, body: PriceUpdate):
    async with aiosqlite.connect(DB_PATH) as db:
        product = await get_product_or_404(db, product_id)
        old_price = product["price"]

        await db.execute(
            "UPDATE products SET price=?, updated_at=datetime('now','localtime') WHERE id=?",
            (body.price, product_id)
        )
        await db.execute(
            "INSERT INTO stock_movements (product_id, movement_type, quantity, old_value, new_value, reason, operator) VALUES (?,?,?,?,?,?,?)",
            (product_id, "price_change", 0, old_price, body.price,
             f"Precio cambiado de ${old_price:.0f} a ${body.price:.0f}", body.operator)
        )
        await db.commit()
    return {"success": True, "old_price": old_price, "new_price": body.price}


@app.patch("/api/products/{product_id}/stock", summary="Actualizar stock (con auditoría)")
async def update_stock(product_id: int, body: StockUpdate):
    async with db_write_lock:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            try:
                product = await get_product_or_404(db, product_id)
                old_stock = product["stock"]
                diff = body.stock - old_stock
                mov_type = "entrada" if diff > 0 else ("salida" if diff < 0 else "ajuste")

                await db.execute(
                    "UPDATE products SET stock=?, updated_at=datetime('now','localtime') WHERE id=?",
                    (body.stock, product_id)
                )
                await db.execute(
                    "INSERT INTO stock_movements (product_id, movement_type, quantity, old_value, new_value, reason, operator) VALUES (?,?,?,?,?,?,?)",
                    (product_id, mov_type, abs(diff), old_stock, body.stock,
                     body.reason or f"Stock: {old_stock} → {body.stock}", body.operator)
                )
                await db.commit()
                return {"success": True, "old_stock": old_stock, "new_stock": body.stock}
            except HTTPException:
                await db.rollback()
                raise
            except Exception as e:
                await db.rollback()
                raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/products/{product_id}/unpack", summary="Abrir un bulto (pasa a unidades sueltas)")
async def unpack_product(product_id: int, operator: str = Query("Sistema")):
    async with db_write_lock:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            try:
                product = await get_product_or_404(db, product_id)
                if product.get("is_virtual") != 1 or not product.get("parent_id"):
                    raise HTTPException(status_code=400, detail="Este producto no es un bulto.")
                
                if product["stock"] <= 0:
                    raise HTTPException(status_code=400, detail="No hay bultos en stock para abrir.")
                
                pack_size = product.get("pack_size") or 1
                parent_id = product.get("parent_id")
                
                # Descontar 1 bulto
                await db.execute("UPDATE products SET stock = stock - 1 WHERE id = ?", (product_id,))
                await db.execute("INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                    (product_id, "salida", 1, "Desarmar Bulto", operator))
                
                # Sumar unidades al padre
                await db.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (pack_size, parent_id))
                await db.execute("INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                    (parent_id, "entrada", pack_size, f"Apertura de Bulto ({product['name']})", operator))
                
                await db.commit()
                return {"success": True}
            except Exception as e:
                await db.rollback()
                raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/products/{product_id}", summary="Actualizar producto completo")
async def update_product(product_id: int, body: ProductUpdate):
    async with aiosqlite.connect(DB_PATH) as db:
        await get_product_or_404(db, product_id)
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        if not fields:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")
        sets = ", ".join(f"{k}=?" for k in fields)
        await db.execute(
            f"UPDATE products SET {sets}, updated_at=datetime('now','localtime') WHERE id=?",
            (*fields.values(), product_id)
        )
        await db.commit()
    return {"success": True}


@app.delete("/api/products/{product_id}", summary="Eliminar producto")
async def delete_product(product_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await get_product_or_404(db, product_id)
        await db.execute("DELETE FROM products WHERE id=?", (product_id,))
        await db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────
# ACTUALIZACIÓN MASIVA DE PRECIOS
# ─────────────────────────────────────────────────────────────
class BatchIncrease(BaseModel):
    percentage: float = Field(ne=0, description="Positivo = aumento, negativo = descuento")
    operator: str = "Sistema"
    category_id: Optional[int] = None

@app.post("/api/products/batch-increase", summary="Aumento masivo de precios")
async def batch_increase(body: BatchIncrease):
    multiplier = 1.0 + (body.percentage / 100.0)
    async with aiosqlite.connect(DB_PATH) as db:
        where_clause = "WHERE category_id = ?" if body.category_id else ""
        params = (body.category_id,) if body.category_id else ()

        await db.execute(f"""
            INSERT INTO stock_movements (product_id, movement_type, old_value, new_value, reason, operator)
            SELECT id, 'ajuste_precio', price, ROUND(price * ?, 2), 'Aumento Masivo ' || ? || '%', ?
            FROM products {where_clause}
        """, (multiplier, body.percentage, body.operator, *params))
        
        await db.execute(f"""
            UPDATE products 
            SET price = ROUND(price * ?, 2), updated_at = datetime('now','localtime')
            {where_clause}
        """, (multiplier, *params))
        
        await db.commit()
    return {"success": True, "message": f"Precios aumentados {body.percentage}%"}

# ─────────────────────────────────────────────────────────────
# AUDITORÍA ENDPOINTS
# ─────────────────────────────────────────────────────────────
@app.get("/api/audit", summary="Obtener historial de auditoría de movimientos")
async def get_audit_logs(limit: int = 100):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT s.id, p.name as product_name, p.code, s.movement_type, s.old_value, s.new_value, s.reason, s.operator, s.timestamp
            FROM stock_movements s
            JOIN products p ON s.product_id = p.id
            ORDER BY s.timestamp DESC
            LIMIT ?
        """, (limit,)) as cur:
            rows = await cur.fetchall()
            return [row_to_dict(row, cur.description) for row in rows]

# ─────────────────────────────────────────────────────────────
# TURNS ENDPOINTS
# ─────────────────────────────────────────────────────────────
@app.post("/api/turns", status_code=201, summary="Abrir turno")
async def open_turn(body: TurnOpen):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO turns (operator) VALUES (?)", (body.operator,)
        )
        await db.commit()
    return {"id": cur.lastrowid, "operator": body.operator}


@app.patch("/api/turns/{turn_id}/close", summary="Cerrar turno con balance")
async def close_turn(turn_id: int, body: TurnClose):
    difference = body.counted_cash - body.sales_total
    async with db_write_lock:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            try:
                cur = await db.execute("SELECT closed_at FROM turns WHERE id=?", (turn_id,))
                turn = await cur.fetchone()
                if not turn:
                    raise HTTPException(404, detail="Turno no encontrado")
                if turn[0] is not None:
                    raise HTTPException(400, detail="Este turno ya está cerrado")
                
                await db.execute(
                    "UPDATE turns SET closed_at=datetime('now','localtime'), sales_total=?, counted_cash=?, difference=?, notes=? WHERE id=?",
                    (body.sales_total, body.counted_cash, difference, body.notes, turn_id)
                )
                await db.commit()
            except Exception as e:
                await db.rollback()
                if isinstance(e, HTTPException): raise
                raise HTTPException(status_code=500, detail="Error al cerrar turno")
    return {
        "success": True,
        "difference": difference,
        "status": "perfecto" if difference == 0 else ("sobrante" if difference > 0 else "faltante")
    }


@app.get("/api/turns", summary="Historial de turnos")
async def list_turns(limit: int = 30):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT * FROM turns ORDER BY opened_at DESC LIMIT ?", (limit,)
        ) as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


# ─────────────────────────────────────────────────────────────
# SALES ENDPOINTS
# ─────────────────────────────────────────────────────────────
@app.post("/api/sales", status_code=201, summary="Registrar venta con transacciones e idempotency key")
async def create_sale(body: SaleCreate, idempotency_key: Optional[str] = Query(None)):
    # Auto-generar idempotency_key si no viene del frontend (previene NULL duplicados)
    effective_key = idempotency_key or str(uuid.uuid4())
    async with db_write_lock:
        async with aiosqlite.connect(DB_PATH) as db:
            # Iniciar Transacción Explícita ANTES del check de idempotencia
            # (previene race condition: dos requests con misma key pasan el SELECT)
            await db.execute("BEGIN IMMEDIATE")
            try:
                # 1. Verificar Idempotency Key (dentro de la transacción)
                cur = await db.execute("SELECT id FROM sales WHERE idempotency_key = ?", (effective_key,))
                existing = await cur.fetchone()
                if existing:
                    await db.commit()
                    return {"id": existing[0], "success": True, "reprocessed": True}

                # 2. Insertar Venta
                cur = await db.execute(
                    "INSERT INTO sales (turn_id,total,payment,change_given,operator,is_fiado,fiado_name,payment_method,client_cuit) VALUES (?,?,?,?,?,?,?,?,?)",
                    (body.turn_id, body.total, body.payment, body.change_given,
                     body.operator, 1 if body.is_fiado else 0, body.fiado_name,
                     body.payment_method, body.client_cuit)
                )
                sale_id = cur.lastrowid
                
                # Guardar la clave de idempotencia
                await db.execute("UPDATE sales SET idempotency_key = ? WHERE id = ?", (effective_key, sale_id))

                for item in body.items:
                    # Verificar stock antes de vender
                    cur_stock = await db.execute("SELECT stock FROM products WHERE id=?", (item.product_id,))
                    row = await cur_stock.fetchone()
                    if not row:
                        raise HTTPException(404, detail="Producto no encontrado")
                    if row[0] < item.quantity:
                        raise HTTPException(400, detail=f"No hay suficiente stock de '{item.product_name}'. Quedan {row[0]} y querés vender {item.quantity}")
                    
                    await db.execute(
                        "INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,item_discount) VALUES (?,?,?,?,?,?)",
                        (sale_id, item.product_id, item.product_name, item.quantity, item.unit_price, item.item_discount)
                    )
                    # Descontar stock
                    await db.execute(
                        "UPDATE products SET stock = stock - ? WHERE id=?",
                        (item.quantity, item.product_id)
                    )
                    await db.execute(
                        "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                        (item.product_id, "salida", item.quantity, f"Venta #{sale_id}", body.operator)
                    )

                await db.commit()
                return {"id": sale_id, "success": True}
            except Exception as e:
                await db.rollback()
                if isinstance(e, HTTPException): raise
                logger.error(f"Error procesando venta: {e}")
                raise HTTPException(status_code=500, detail="Error de concurrencia al procesar la venta.")


@app.get("/api/sales/today", summary="Resumen de ventas del día")
async def today_sales(sucursal_id: Optional[int] = Query(None, description="Filtrar por sucursal")):
    async with aiosqlite.connect(DB_PATH) as db:
        if sucursal_id:
            async with db.execute("""
                SELECT
                    COUNT(*) as total_tickets,
                    COALESCE(SUM(total), 0) as total_vendido,
                    COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END), 0) as total_fiado
                FROM sales
                WHERE date(timestamp) = date('now','localtime')
                AND (sucursal_id IS NULL OR sucursal_id = ?)
            """, (sucursal_id,)) as cur:
                row = await cur.fetchone()
                return row_to_dict(row, cur.description)
        else:
            async with db.execute("""
                SELECT
                    COUNT(*) as total_tickets,
                    COALESCE(SUM(total), 0) as total_vendido,
                    COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END), 0) as total_fiado
                FROM sales
                WHERE date(timestamp) = date('now','localtime')
            """) as cur:
                row = await cur.fetchone()
                return row_to_dict(row, cur.description)


@app.get("/api/sales", summary="Listar ventas")
async def list_sales(limit: int = Query(50)):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT s.*, COALESCE(s.reverted, 0) as reverted,
                   COALESCE(s.cobrado, 0) as cobrado,
                   COALESCE(SUM(si.item_discount), 0) as total_discount
            FROM sales s
            LEFT JOIN sale_items si ON s.id = si.sale_id
            GROUP BY s.id
            ORDER BY s.timestamp DESC
            LIMIT ?
        """, (limit,)) as cur:
            rows = await cur.fetchall()
            sales = [row_to_dict(r, cur.description) for r in rows]

        for sale in sales:
            async with db.execute("SELECT * FROM sale_items WHERE sale_id=?", (sale["id"],)) as cur:
                sale["items"] = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

        return sales


# ─────────────────────────────────────────────────────────────
# MOVEMENTS ENDPOINT (auditoría)
# ─────────────────────────────────────────────────────────────
@app.get("/api/movements", summary="Historial de movimientos de stock")
async def list_movements(limit: int = 50):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT m.*, p.name as product_name
            FROM stock_movements m
            JOIN products p ON m.product_id = p.id
            ORDER BY m.timestamp DESC
            LIMIT ?
        """, (limit,)) as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@app.get("/api/sales/fiado", summary="Listar fiados pendientes")
async def list_fiados():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT id, fiado_name, total, timestamp,
                   CASE WHEN cobrado IS NULL THEN 0 ELSE cobrado END as cobrado,
                   COALESCE(reverted, 0) as reverted
            FROM sales WHERE is_fiado=1 AND (reverted IS NULL OR reverted = 0)
            ORDER BY timestamp DESC
        """) as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@app.patch("/api/sales/{sale_id}/cobrar-fiado", summary="Marcar fiado como cobrado")
async def cobrar_fiado(sale_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE sales SET cobrado=1 WHERE id=?", (sale_id,)
        )
        await db.commit()
    return {"success": True}


@app.patch("/api/sales/{sale_id}/revert", summary="Anular venta y revertir stock")
async def revert_sale(sale_id: int):
    async with db_write_lock:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            try:
                cur = await db.execute("SELECT id, reverted FROM sales WHERE id=?", (sale_id,))
                sale = await cur.fetchone()
                if not sale:
                    raise HTTPException(status_code=404, detail="Venta no encontrada")
                if sale[1] == 1:
                    raise HTTPException(status_code=400, detail="La venta ya fue anulada")

                async with db.execute("SELECT product_id, quantity FROM sale_items WHERE sale_id=?", (sale_id,)) as cur:
                    items = await cur.fetchall()

                for item in items:
                    product_id, quantity = item
                    await db.execute(
                        "UPDATE products SET stock = stock + ? WHERE id=?",
                        (quantity, product_id)
                    )
                    await db.execute(
                        "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                        (product_id, "entrada", quantity, f"Reversión Venta #{sale_id}", "Sistema")
                    )

                await db.execute("UPDATE sales SET reverted=1 WHERE id=?", (sale_id,))
                await db.commit()
                return {"success": True}
            except HTTPException:
                await db.rollback()
                raise
            except Exception as e:
                await db.rollback()
                raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# BUSINESS CONFIG
# ─────────────────────────────────────────────────────────────
@app.get("/api/config", summary="Obtener configuración del negocio")
async def get_config():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT key, value FROM business_config") as cur:
            rows = await cur.fetchall()
            return {r[0]: r[1] for r in rows}

@app.put("/api/config", summary="Actualizar configuración del negocio")
async def update_config(data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        for key, value in data.items():
            await db.execute(
                "INSERT INTO business_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, str(value))
            )
        await db.commit()
    return {"success": True}

# ─────────────────────────────────────────────────────────────
# SUCURSALES ENDPOINTS
# ─────────────────────────────────────────────────────────────
@app.get("/api/sucursales", summary="Listar sucursales")
async def list_sucursales():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT * FROM sucursales ORDER BY name") as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

@app.post("/api/sucursales", status_code=201, summary="Crear sucursal")
async def create_sucursal(name: str = Query(...), address: str = Query(""), phone: str = Query("")):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO sucursales (name, address, phone) VALUES (?,?,?)",
            (name, address, phone)
        )
        await db.commit()
        return {"id": cur.lastrowid, "name": name}

@app.patch("/api/sucursales/{sucursal_id}", summary="Actualizar sucursal")
async def update_sucursal(sucursal_id: int, name: str = Query(None), address: str = Query(None), phone: str = Query(None)):
    async with aiosqlite.connect(DB_PATH) as db:
        fields = {}
        if name: fields['name'] = name
        if address is not None: fields['address'] = address
        if phone is not None: fields['phone'] = phone
        if not fields:
            raise HTTPException(400, "Sin campos para actualizar")
        sets = ", ".join(f"{k}=?" for k in fields)
        await db.execute(f"UPDATE sucursales SET {sets} WHERE id=?", (*fields.values(), sucursal_id))
        await db.commit()
    return {"success": True}

@app.delete("/api/sucursales/{sucursal_id}", summary="Eliminar sucursal")
async def delete_sucursal(sucursal_id: int):
    if sucursal_id == 1:
        raise HTTPException(400, "No se puede eliminar la sucursal principal")
    async with aiosqlite.connect(DB_PATH) as db:
        for table, label in [("products", "productos"), ("sales", "ventas"), ("turns", "turnos"), ("egresos_caja", "egresos"), ("purchases", "compras")]:
            cur = await db.execute(f"SELECT COUNT(*) FROM {table} WHERE sucursal_id=?", (sucursal_id,))
            count = (await cur.fetchone())[0]
            if count > 0:
                raise HTTPException(400, f"No se puede eliminar la sucursal: tiene {count} {label} asociados")
        await db.execute("DELETE FROM sucursales WHERE id=?", (sucursal_id,))
        await db.commit()
    return {"success": True}

# ─────────────────────────────────────────────────────────────
# TURN DETAIL (items vendidos por turno)
# ─────────────────────────────────────────────────────────────
@app.get("/api/turns/{turn_id}/detail", summary="Detalle completo de un turno")
async def turn_detail(turn_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT * FROM turns WHERE id=?", (turn_id,)) as cur:
            row = await cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Turno no encontrado")
            turn = row_to_dict(row, cur.description)

        async with db.execute("""
            SELECT s.id, s.total, s.payment, s.change_given, s.is_fiado,
                   s.fiado_name, s.timestamp, s.operator
            FROM sales s WHERE s.turn_id=? ORDER BY s.timestamp
        """, (turn_id,)) as cur:
            sales = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

        # items de cada venta
        for sale in sales:
            async with db.execute(
                "SELECT * FROM sale_items WHERE sale_id=?", (sale["id"],)
            ) as cur:
                sale["items"] = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

        # Estadísticas por producto
        async with db.execute("""
            SELECT si.product_name, SUM(si.quantity) as qty, SUM(si.quantity*si.unit_price) as subtotal
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.turn_id=?
            GROUP BY si.product_name
            ORDER BY qty DESC
        """, (turn_id,)) as cur:
            top_products = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

    return {
        "turn": turn,
        "sales": sales,
        "top_products": top_products,
        "total_tickets": len(sales),
        "total_efectivo": sum(s["total"] for s in sales if not s["is_fiado"]),
        "total_fiado": sum(s["total"] for s in sales if s["is_fiado"]),
    }


# ─────────────────────────────────────────────────────────────
# EGRESOS DE CAJA
# ─────────────────────────────────────────────────────────────
class EgresoCreate(BaseModel):
    turn_id: Optional[int] = None
    monto: float = Field(gt=0)
    motivo: str
    operator: str = "Sistema"

@app.post("/api/egresos", status_code=201, summary="Registrar egreso de caja")
async def create_egreso(body: EgresoCreate):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO egresos_caja (turn_id, monto, motivo, operator) VALUES (?,?,?,?)",
            (body.turn_id, body.monto, body.motivo, body.operator)
        )
        await db.commit()
    return {"id": cur.lastrowid, "success": True}

@app.get("/api/egresos", summary="Listar egresos del turno activo o del día")
async def list_egresos(turn_id: Optional[int] = Query(None)):
    async with aiosqlite.connect(DB_PATH) as db:
        if turn_id:
            async with db.execute(
                "SELECT * FROM egresos_caja WHERE turn_id=? ORDER BY timestamp DESC", (turn_id,)
            ) as cur:
                rows = await cur.fetchall()
        else:
            async with db.execute(
                "SELECT * FROM egresos_caja WHERE date(timestamp)=date('now','localtime') ORDER BY timestamp DESC"
            ) as cur:
                rows = await cur.fetchall()
        return [row_to_dict(r, cur.description) for r in rows]

# ─────────────────────────────────────────────────────────────
# ALERTAS DE STOCK (para mostrar al iniciar turno)
# ─────────────────────────────────────────────────────────────
@app.get("/api/stock-alerts", summary="Productos sin stock o con stock bajo")
async def stock_alerts():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT id, code, name, stock, min_stock,
                   CASE WHEN stock = 0 THEN 'empty' ELSE 'low' END as alert_type
            FROM products
            WHERE stock < min_stock OR (stock = 0 AND min_stock = 0)
            ORDER BY stock ASC
        """) as cur:
            rows = await cur.fetchall()
            alerts = [row_to_dict(r, cur.description) for r in rows]
    return {
        "total": len(alerts),
        "empty": [a for a in alerts if a["alert_type"] == "empty"],
        "low": [a for a in alerts if a["alert_type"] == "low"]
    }

# ─────────────────────────────────────────────────────────────
# SUPPLIERS & PURCHASES ENDPOINTS
# ─────────────────────────────────────────────────────────────
class SupplierCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    cuit: Optional[str] = None

class PurchaseItemCreate(BaseModel):
    product_id: int
    product_name: str
    quantity: int = Field(gt=0)
    unit_cost: float = Field(ge=0)

class PurchaseCreate(BaseModel):
    supplier_id: Optional[int] = None
    invoice_number: Optional[str] = None
    total_cost: float = Field(ge=0)
    operator: str = "Sistema"
    items: list[PurchaseItemCreate] = []

@app.get("/api/suppliers", summary="Listar proveedores")
async def list_suppliers():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT * FROM suppliers ORDER BY name") as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

@app.post("/api/suppliers", status_code=201, summary="Crear proveedor")
async def create_supplier(body: SupplierCreate):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("INSERT INTO suppliers (name, contact, cuit) VALUES (?,?,?)", (body.name, body.contact, body.cuit))
        await db.commit()
        return {"id": cur.lastrowid, **body.model_dump()}

@app.post("/api/purchases", status_code=201, summary="Registrar compra/remito")
async def create_purchase(body: PurchaseCreate):
    async with db_write_lock:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("BEGIN IMMEDIATE")
            try:
                cur = await db.execute(
                    "INSERT INTO purchases (supplier_id, invoice_number, total_cost, operator) VALUES (?,?,?,?)",
                    (body.supplier_id, body.invoice_number, body.total_cost, body.operator)
                )
                purchase_id = cur.lastrowid

                for item in body.items:
                    await db.execute(
                        "INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_cost) VALUES (?,?,?,?,?)",
                        (purchase_id, item.product_id, item.product_name, item.quantity, item.unit_cost)
                    )
                    
                    cur_prod = await db.execute("SELECT is_virtual, parent_id, pack_size FROM products WHERE id=?", (item.product_id,))
                    prod_info = await cur_prod.fetchone()
                    
                    if prod_info and prod_info[0] == 1:
                        parent_id = prod_info[1]
                        pack_size = prod_info[2] or 1
                        real_qty = item.quantity * pack_size
                        target_id = parent_id
                        real_unit_cost = item.unit_cost / pack_size
                        item_name = f"Bulto: {item.product_name}"
                    else:
                        target_id = item.product_id
                        real_qty = item.quantity
                        real_unit_cost = item.unit_cost
                        item_name = item.product_name
                    
                    await db.execute(
                        "UPDATE products SET stock = stock + ?, cost_price = ?, last_purchase_date = datetime('now','localtime') WHERE id = ?",
                        (real_qty, real_unit_cost, target_id)
                    )
                    
                    await db.execute(
                        "INSERT INTO stock_movements (product_id, movement_type, quantity, reason, operator) VALUES (?,?,?,?,?)",
                        (target_id, "entrada_compra", real_qty, f"Compra #{purchase_id} ({item_name})", body.operator)
                    )

                await db.commit()
                return {"id": purchase_id, "success": True}
            except Exception as e:
                await db.rollback()
                raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/purchases", summary="Historial de compras")
async def list_purchases(limit: int = 50):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT p.*, s.name as supplier_name 
            FROM purchases p 
            LEFT JOIN suppliers s ON p.supplier_id = s.id 
            ORDER BY p.timestamp DESC LIMIT ?
        """, (limit,)) as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

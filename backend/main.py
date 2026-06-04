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
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import aiosqlite
from fastapi import FastAPI, HTTPException, Query
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
                timestamp   TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (turn_id) REFERENCES turns(id)
            );

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
        """)
        try:
            await db.execute("ALTER TABLE sales ADD COLUMN idempotency_key TEXT UNIQUE")
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
            
        await db.commit()

        # Seed categorías base
        count = await db.execute("SELECT COUNT(*) FROM categories")
        if (await count.fetchone())[0] == 0:
            await db.executemany("INSERT INTO categories (name) VALUES (?)",
                [('Golosinas',), ('Bebidas',), ('Almacén',), ('Cigarrillos',), ('Limpieza',), ('Lácteos',)]
            )
            await db.commit()
            
        await db.commit()

        # Seed config por defecto
        count = await db.execute("SELECT COUNT(*) FROM business_config")
        row = await count.fetchone()
        if row[0] == 0:
            defaults = [
                ('nombre', 'Kiosco El Barrio'),
                ('subtitulo', 'Atenci\u00f3n 7 d\u00edas de la semana'),
                ('direccion', 'Av. Corrientes 1234 - CABA'),
                ('telefono', '011-4855-0000'),
                ('cuit', '20-12345678-9'),
                ('condicion_iva', 'Monotributista'),
                ('mensaje_ticket', '\u00a1Gracias por su compra!'),
                ('numero_caja', 'CAJA 1'),
                ('ancho_ticket', '80'),
            ]
            await db.executemany(
                "INSERT OR IGNORE INTO business_config (key, value) VALUES (?, ?)", defaults
            )
            await db.commit()

        # Seed inicial si no hay productos
        count = await db.execute("SELECT COUNT(*) FROM products")
        row = await count.fetchone()
        if row[0] == 0:
            await db.executemany(
                "INSERT INTO products (code, name, price, cost_price, stock, min_stock) VALUES (?,?,?,?,?,?)",
                [
                    ("7790895000997", "Coca Cola 500ml",       1200, 850,  45, 10),
                    ("7790580402804", "Alfajor Guaymallen",     400, 250, 120, 20),
                    ("7791234567890", "Papas Lays 90g",        1500, 1000,  32, 15),
                    ("7799876543210", "Chocolate Milka",        2100, 1400,  15,  5),
                    ("7798765000012", "Cerveza Quilmes 473ml",  1800, 1200,  24, 12),
                    ("7797654000098", "Cerveza Heineken 473ml", 2200, 1500,   0,  8),
                    ("7796543000076", "Leche La Serenísima 1L",  900,  600,   2,  5),
                    ("001",           "Gomitas Sueltas 100g",    800,  500, 999, 50),
                ]
            )
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
            
            # 5. Rota (mantener máximo 20 backups válidos para no ahogar disco probando)
            backups = sorted(glob.glob(os.path.join(backup_dir, "*.db.gz")))
            if len(backups) > 20:
                for old in backups[:-20]:
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
    allow_origins=["*"],
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

class SaleCreate(BaseModel):
    turn_id: Optional[int] = None
    total: float
    payment: float
    change_given: float = 0
    operator: str = "Sistema"
    is_fiado: bool = False
    fiado_name: Optional[str] = None
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
# PRODUCTS & CATEGORIES ENDPOINTS
# ─────────────────────────────────────────────────────────────
@app.get("/api/categories", summary="Listar categorías")
async def list_categories():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, name FROM categories ORDER BY name") as cur:
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]

@app.get("/api/products", summary="Listar/buscar productos")
async def list_products(q: Optional[str] = Query(None, description="Buscar por nombre o código")):
    async with aiosqlite.connect(DB_PATH) as db:
        base_query = """
            SELECT p.id, p.code, p.name, p.price, p.cost_price, p.min_stock, p.iva, p.created_at, p.updated_at, p.category_id, p.is_virtual, p.parent_id, p.pack_size, c.name as category_name,
                   COALESCE(parent.name, '') as parent_name,
                   CASE WHEN p.is_virtual = 1 THEN IFNULL(parent.stock / MAX(1, p.pack_size), 0) ELSE p.stock END as stock
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN products parent ON p.parent_id = parent.id
        """
        if q:
            term = f"%{q}%"
            async with db.execute(f"{base_query} WHERE p.name LIKE ? OR p.code LIKE ? ORDER BY p.name", (term, term)) as cur:
                rows = await cur.fetchall()
                return [row_to_dict(r, cur.description) for r in rows]
        else:
            async with db.execute(f"{base_query} ORDER BY p.name") as cur:
                rows = await cur.fetchall()
                return [row_to_dict(r, cur.description) for r in rows]


@app.post("/api/products", status_code=201, summary="Crear producto")
async def create_product(product: ProductCreate):
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            cur = await db.execute(
                "INSERT INTO products (code,name,price,cost_price,stock,min_stock,iva,category_id,is_virtual,parent_id,pack_size) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (product.code, product.name, product.price, product.cost_price,
                 product.stock, product.min_stock, product.iva, product.category_id,
                 1 if product.is_virtual else 0, product.parent_id, product.pack_size)
            )
            await db.commit()
            return {"id": cur.lastrowid, **product.model_dump()}
        except Exception as e:
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
    async with aiosqlite.connect(DB_PATH) as db:
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
    percentage: float = Field(gt=0)
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
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE turns SET closed_at=datetime('now','localtime'), sales_total=?, counted_cash=?, difference=?, notes=? WHERE id=?",
            (body.sales_total, body.counted_cash, difference, body.notes, turn_id)
        )
        await db.commit()
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
    async with db_write_lock:
        async with aiosqlite.connect(DB_PATH) as db:
            # 1. Verificar Idempotency Key (Previene cobros duplicados por red fallida)
            if idempotency_key:
                cur = await db.execute("SELECT id FROM sales WHERE idempotency_key = ?", (idempotency_key,))
                existing = await cur.fetchone()
                if existing:
                    return {"id": existing[0], "success": True, "reprocessed": True}

            # 2. Iniciar Transacción Explícita (Previene Race Conditions)
            await db.execute("BEGIN IMMEDIATE")
            try:
                # Insertar Venta
                cur = await db.execute(
                    "INSERT INTO sales (turn_id,total,payment,change_given,operator,is_fiado,fiado_name) VALUES (?,?,?,?,?,?,?)",
                    (body.turn_id, body.total, body.payment, body.change_given,
                     body.operator, 1 if body.is_fiado else 0, body.fiado_name)
                )
                sale_id = cur.lastrowid
                
                # Actualizar Clave si existe
                if idempotency_key:
                    await db.execute("UPDATE sales SET idempotency_key = ? WHERE id = ?", (idempotency_key, sale_id))

                for item in body.items:
                    await db.execute(
                        "INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price) VALUES (?,?,?,?,?)",
                        (sale_id, item.product_id, item.product_name, item.quantity, item.unit_price)
                    )
                    # Descontar stock directamente al producto vendido (sea bulto o suelto)
                    await db.execute(
                        "UPDATE products SET stock = MAX(0, stock - ?) WHERE id=?",
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
                logger.error(f"Error procesando venta: {e}")
                raise HTTPException(status_code=500, detail="Error de concurrencia al procesar la venta.")


@app.get("/api/sales/today", summary="Resumen de ventas del día")
async def today_sales():
    async with aiosqlite.connect(DB_PATH) as db:
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
                   CASE WHEN cobrado IS NULL THEN 0 ELSE cobrado END as cobrado
            FROM sales WHERE is_fiado=1
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
            WHERE stock < min_stock
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

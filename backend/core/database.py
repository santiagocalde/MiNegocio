import aiosqlite
import bcrypt

async def add_column_if_not_exists(db, table, column, coltype="TEXT", fk="", default="") -> None:
    """Helper: ALTER TABLE ADD COLUMN solo si no existe."""
    try:
        cur = await db.execute(f"PRAGMA table_info({table})")
        cols = {row[1] for row in await cur.fetchall()}
        if column not in cols:
            stmt = f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"
            if default: stmt += f" DEFAULT {default}"
            if fk: stmt += f" REFERENCES {fk}"
            await db.execute(stmt)
            print(f"  [migracion] columna {table}.{column} agregada")
    except Exception as e:
        print(f"  [migracion] error en {table}.{column}: {e}")

async def init_db(DB_PATH: str, logger) -> None:
    """Inicializa la base de datos, crea tablas, migraciones y seeds."""
    # timeout=10.0 y PRAGMAS previenen locks en multicaja
    async with aiosqlite.connect(DB_PATH, timeout=10.0) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA synchronous=NORMAL;")
        await db.execute("PRAGMA busy_timeout=5000;")
        await db.execute("PRAGMA foreign_keys=ON;")
        
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS products (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
                code        TEXT    NOT NULL,
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
                business_id TEXT DEFAULT 'kiosco_default', 
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stock_movements (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
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
                business_id TEXT DEFAULT 'kiosco_default', 
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
                business_id TEXT DEFAULT 'kiosco_default', 
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

            CREATE TABLE IF NOT EXISTS sale_items (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
                sale_id     INTEGER NOT NULL,
                product_id  INTEGER,
                product_name TEXT   NOT NULL,
                quantity    REAL NOT NULL,
                unit_price  REAL    NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES sales(id)
            );
            CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
            
            CREATE TABLE IF NOT EXISTS business_config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS egresos_caja (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
                turn_id     INTEGER,
                type        TEXT    DEFAULT 'gasto',
                monto       REAL    NOT NULL,
                motivo      TEXT    NOT NULL,
                operator    TEXT    DEFAULT 'Sistema',
                timestamp   TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS customers (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                phone       TEXT,
                balance     REAL    DEFAULT 0,
                created_at  TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS customer_transactions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                type        TEXT    NOT NULL, -- 'sale', 'payment'
                amount      REAL    NOT NULL,
                description TEXT,
                turn_id     INTEGER,
                operator    TEXT    DEFAULT 'Sistema',
                timestamp   TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            );

            CREATE TABLE IF NOT EXISTS suppliers (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
                name        TEXT    NOT NULL,
                contact     TEXT,
                cuit        TEXT,
                phone       TEXT,
                created_at  TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS purchases (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
                supplier_id    INTEGER,
                invoice_number TEXT,
                total_cost     REAL    NOT NULL,
                operator       TEXT    DEFAULT 'Sistema',
                timestamp      TEXT    DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
            );

            CREATE TABLE IF NOT EXISTS purchase_items (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
                purchase_id    INTEGER NOT NULL,
                product_id     INTEGER NOT NULL,
                product_name   TEXT    NOT NULL,
                quantity       INTEGER NOT NULL,
                unit_cost      REAL    NOT NULL,
                FOREIGN KEY (purchase_id) REFERENCES purchases(id)
            );

            CREATE TABLE IF NOT EXISTS sucursales (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
                name        TEXT    NOT NULL,
                address     TEXT    DEFAULT '',
                phone       TEXT    DEFAULT '',
                created_at  TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS operators (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id TEXT DEFAULT 'kiosco_default', 
                name        TEXT    NOT NULL,
                pin         TEXT    NOT NULL,
                role        TEXT    NOT NULL DEFAULT 'employee',
                created_at  TEXT    DEFAULT (datetime('now','localtime'))
            );

            -- ─── TABLAS SAAS (multi-tenant, auth, billing) ────────────────

            CREATE TABLE IF NOT EXISTS businesses (
                id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                email           TEXT UNIQUE NOT NULL,
                password_hash   TEXT NOT NULL,
                business_name   TEXT NOT NULL DEFAULT 'Mi Kiosco',
                plan            TEXT NOT NULL DEFAULT 'trial',
                plan_end_date   TEXT,
                plan_pending    TEXT,
                mp_subscription_id TEXT,
                status          TEXT NOT NULL DEFAULT 'active',
                created_at      TEXT DEFAULT (datetime('now','localtime')),
                updated_at      TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS auth_tokens (
                id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                business_id     TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
                token           TEXT UNIQUE NOT NULL,
                token_type      TEXT DEFAULT 'access',
                expires_at      TEXT NOT NULL,
                created_at      TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS payment_events (
                id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                mp_subscription_id TEXT,
                amount          REAL,
                status          TEXT,
                event_type      TEXT,
                idempotency_key TEXT UNIQUE,
                processed_at    TEXT,
                created_at      TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS sync_events (
                id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                business_id     TEXT,
                records_sent    INTEGER DEFAULT 0,
                status          TEXT DEFAULT 'success',
                error_message   TEXT,
                synced_at       TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                action          TEXT    NOT NULL,
                operator        TEXT    NOT NULL DEFAULT 'Sistema',
                details         TEXT,
                created_at      TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS payment_intents (
                id              TEXT PRIMARY KEY,
                business_id     TEXT DEFAULT 'kiosco_default',
                total           REAL    NOT NULL,
                description     TEXT,
                status          TEXT    NOT NULL DEFAULT 'pending',
                mp_payment_id   TEXT,
                mp_mode         TEXT,
                external_ref    TEXT,
                created_at      TEXT    DEFAULT (datetime('now','localtime')),
                updated_at      TEXT    DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS promotions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id     TEXT DEFAULT 'kiosco_default',
                name            TEXT NOT NULL,
                description     TEXT DEFAULT '',
                type            TEXT NOT NULL DEFAULT 'combo',
                discount_percent REAL DEFAULT 0,
                combo_price     REAL DEFAULT 0,
                is_active       INTEGER DEFAULT 1,
                created_at      TEXT DEFAULT (datetime('now','localtime')),
                updated_at      TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS promotion_conditions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                promotion_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
                product_id      INTEGER NOT NULL REFERENCES products(id),
                min_qty         INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS sale_payments (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id         INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                method          TEXT NOT NULL,
                amount          REAL NOT NULL
            );
        """)
        await add_column_if_not_exists(db, "sales", "idempotency_key", "TEXT")
        await add_column_if_not_exists(db, "products", "category_id", "INTEGER", "categories(id)")
        await add_column_if_not_exists(db, "products", "is_active", "INTEGER", default="1")
        await add_column_if_not_exists(db, "products", "is_virtual", "INTEGER", default="0")
        await add_column_if_not_exists(db, "products", "parent_id", "INTEGER", "products(id)")
        await add_column_if_not_exists(db, "products", "pack_size", "INTEGER", default="1")
        await add_column_if_not_exists(db, "products", "last_purchase_date", "TEXT")
        await add_column_if_not_exists(db, "sales", "reverted", "INTEGER", default="0")
        await add_column_if_not_exists(db, "sales", "payment_method", "TEXT", default="'efectivo'")
        await add_column_if_not_exists(db, "sales", "cae", "TEXT")
        await add_column_if_not_exists(db, "sales", "cae_vto", "TEXT")
        await add_column_if_not_exists(db, "sales", "client_cuit", "TEXT", default="''")
        await add_column_if_not_exists(db, "sale_items", "item_discount", "REAL", default="0")
        await add_column_if_not_exists(db, "products", "sucursal_id", "INTEGER", "sucursales(id)", "1")
        await add_column_if_not_exists(db, "sales", "sucursal_id", "INTEGER", "sucursales(id)", "1")
        # suppliers.phone: el frontend y el INSERT usan 'phone', pero el esquema SQLite
        # solo tenía 'cuit' -> crear proveedor en modo local fallaba con 500.
        await add_column_if_not_exists(db, "suppliers", "phone", "TEXT")
        await add_column_if_not_exists(db, "turns", "sucursal_id", "INTEGER", "sucursales(id)", "1")
        await add_column_if_not_exists(db, "egresos_caja", "sucursal_id", "INTEGER", "sucursales(id)", "1")
        await add_column_if_not_exists(db, "purchases", "sucursal_id", "INTEGER", "sucursales(id)", "1")
        await add_column_if_not_exists(db, "products", "expiry_date", "TEXT", default="''")
        await add_column_if_not_exists(db, "stock_movements", "business_id", "TEXT", default="'kiosco_default'")
        await add_column_if_not_exists(db, "products", "units_per_package", "INTEGER", default="1")
        await add_column_if_not_exists(db, "sales", "mp_payment_id", "TEXT", default="''")
        await add_column_if_not_exists(db, "products", "currency", "TEXT", default="'ARS'")
        await add_column_if_not_exists(db, "products", "exchange_rate", "REAL", default="1.0")
        await add_column_if_not_exists(db, "sales", "tipo_factura", "TEXT", default="'C'")
        await add_column_if_not_exists(db, "sales", "fiado_name", "TEXT", default="''")
        await add_column_if_not_exists(db, "businesses", "max_users", "INTEGER", default="2")
        await add_column_if_not_exists(db, "turns", "initial_cash", "REAL", default="0")
            
        await db.commit()

        # Punto 55: Creación de índices para performance
        await db.execute("CREATE INDEX IF NOT EXISTS idx_products_code ON products(code)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_products_sucursal ON products(sucursal_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_turn_id ON sales(turn_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer_id ON customer_transactions(customer_id)")
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

        # Seed operadores NO se crean automáticamente.
        # El primer admin se crea vía /api/setup/init (SetupWizard).
        await db.commit()

        # ── Migración: hashear PINs en texto plano existentes ──────────────
        async with db.execute("SELECT id, pin FROM operators") as cur:
            all_ops = await cur.fetchall()
        for op_id, op_pin in all_ops:
            if op_pin and not op_pin.startswith('$2b$'):
                hashed = bcrypt.hashpw(op_pin.encode(), bcrypt.gensalt()).decode()
                await db.execute("UPDATE operators SET pin = ? WHERE id = ?", (hashed, op_id))
                logger.info(f"PIN del operador #{op_id} migrado a bcrypt.")
        await db.commit()

        # Seed sucursal por defecto
        count = await db.execute("SELECT COUNT(*) FROM sucursales")
        row = await count.fetchone()
        if row[0] == 0:
            await db.execute("INSERT INTO sucursales (name, address) VALUES (?, ?)",
                             ("Sucursal Principal", "Av. Corrientes 1234 - CABA"))
            await db.commit()

        # ── Migración: planes antiguos (essential→simple, elite→ia) ────────
        await db.execute("UPDATE businesses SET plan = 'simple' WHERE plan = 'essential'")
        await db.execute("UPDATE businesses SET plan = 'ia' WHERE plan = 'elite'")
        await db.commit()

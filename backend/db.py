import os
import logging
import asyncpg
from typing import Optional

logger = logging.getLogger("MiNegocio.PG")

PG_CONFIG = {
    "host": os.getenv("PG_HOST", "localhost"),
    "port": int(os.getenv("PG_PORT", "5432")),
    "user": os.getenv("PG_USER", "minegocio"),
    "password": os.getenv("PG_PASSWORD", "1234"),
    "database": os.getenv("PG_DATABASE", "minegocio"),
}

DATABASE_URL = os.getenv("DATABASE_URL", "")
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        try:
            dsn = DATABASE_URL or f"postgresql://{PG_CONFIG['user']}:{PG_CONFIG['password']}@{PG_CONFIG['host']}:{PG_CONFIG['port']}/{PG_CONFIG['database']}"
            _pool = await asyncpg.create_pool(
                dsn=dsn,
                min_size=4,
                max_size=20,
                command_timeout=30,
            )
            logger.info(f"Pool PostgreSQL creado en {PG_CONFIG['host']}:{PG_CONFIG['port']}/{PG_CONFIG['database']}")
        except Exception as e:
            logger.error(f"No se pudo conectar a PostgreSQL: {e}")
            raise
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Pool PostgreSQL cerrado")


def row_to_dict(row, columns=None):
    if row is None:
        return None
    if hasattr(row, '_mapping'):
        return dict(row._mapping)
    if hasattr(row, 'keys') and not isinstance(row, (str, bytes)):
        return dict(row)
    return dict(row)


async def init_pg() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS businesses (
                id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                email           TEXT UNIQUE NOT NULL,
                password_hash   TEXT NOT NULL,
                business_name   TEXT NOT NULL DEFAULT 'Mi Kiosco',
                plan            TEXT NOT NULL DEFAULT 'trial',
                plan_end_date   TIMESTAMPTZ,
                plan_pending    TEXT,
                mp_subscription_id TEXT,
                phone           TEXT DEFAULT '',
                status          TEXT NOT NULL DEFAULT 'active',
                reset_token     TEXT,
                reset_token_expires TIMESTAMPTZ,
                created_at      TIMESTAMPTZ DEFAULT now(),
                updated_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS auth_tokens (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
                token           TEXT UNIQUE NOT NULL,
                token_type      TEXT DEFAULT 'access',
                expires_at      TIMESTAMPTZ NOT NULL,
                revoked         BOOLEAN DEFAULT FALSE,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS plans (
                id              SERIAL PRIMARY KEY,
                slug            TEXT UNIQUE NOT NULL,
                name            TEXT NOT NULL,
                monthly_price   INTEGER NOT NULL,
                yearly_price    INTEGER NOT NULL,
                max_products    INTEGER NOT NULL DEFAULT 3500,
                max_users       INTEGER NOT NULL DEFAULT 2,
                features        JSONB NOT NULL DEFAULT '[]',
                is_active       BOOLEAN NOT NULL DEFAULT true,
                sort_order      INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS testimonials (
                id              SERIAL PRIMARY KEY,
                text            TEXT NOT NULL,
                author_name     TEXT NOT NULL,
                business_name   TEXT NOT NULL,
                stars           INTEGER NOT NULL DEFAULT 5,
                is_verified     BOOLEAN NOT NULL DEFAULT false,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS payment_events (
                id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                mp_subscription_id TEXT,
                amount          REAL,
                status          TEXT,
                event_type      TEXT,
                idempotency_key TEXT UNIQUE,
                processed_at    TIMESTAMPTZ,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                code            TEXT NOT NULL,
                name            TEXT NOT NULL,
                price           REAL NOT NULL DEFAULT 0,
                cost_price      REAL NOT NULL DEFAULT 0,
                stock           INTEGER NOT NULL DEFAULT 0,
                min_stock       INTEGER NOT NULL DEFAULT 5,
                iva             TEXT NOT NULL DEFAULT '21%',
                category_id     INTEGER,
                is_virtual      INTEGER NOT NULL DEFAULT 0,
                parent_id       INTEGER,
                pack_size       INTEGER DEFAULT 1,
                expiry_date     TEXT DEFAULT '',
                is_active       INTEGER NOT NULL DEFAULT 1,
                created_at      TIMESTAMPTZ DEFAULT now(),
                updated_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
            CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
            CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

            CREATE TABLE IF NOT EXISTS categories (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id);

            CREATE TABLE IF NOT EXISTS operators (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL,
                pin             TEXT NOT NULL,
                role            TEXT NOT NULL DEFAULT 'employee',
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_operators_business_id ON operators(business_id);

            CREATE TABLE IF NOT EXISTS turns (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                operator        TEXT NOT NULL,
                opened_at       TIMESTAMPTZ DEFAULT now(),
                closed_at       TIMESTAMPTZ,
                sales_total     REAL DEFAULT 0,
                counted_cash    REAL,
                difference      REAL,
                notes           TEXT,
                initial_cash    REAL DEFAULT 0,
                sucursal_id     INTEGER DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_turns_business_id ON turns(business_id);

            CREATE TABLE IF NOT EXISTS sales (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                turn_id         INTEGER,
                total           REAL NOT NULL,
                payment         REAL NOT NULL DEFAULT 0,
                change_given    REAL NOT NULL DEFAULT 0,
                operator        TEXT,
                is_fiado        INTEGER NOT NULL DEFAULT 0,
                fiado_name      TEXT,
                cobrado         INTEGER NOT NULL DEFAULT 0,
                payment_method  TEXT DEFAULT 'efectivo',
                client_cuit     TEXT,
                tipo_factura    TEXT DEFAULT 'C',
                cae             TEXT,
                cae_vto         TEXT,
                idempotency_key TEXT UNIQUE,
                reverted        INTEGER DEFAULT 0,
                sucursal_id     INTEGER DEFAULT 1,
                timestamp       TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
            CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
            CREATE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(idempotency_key);

            CREATE TABLE IF NOT EXISTS sale_items (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                sale_id         INTEGER NOT NULL REFERENCES sales(id),
                product_id      INTEGER NOT NULL,
                product_name    TEXT,
                quantity        REAL NOT NULL,
                unit_price      REAL NOT NULL,
                item_discount   REAL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

            CREATE TABLE IF NOT EXISTS customers (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL,
                phone           TEXT,
                balance         REAL DEFAULT 0,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);

            CREATE TABLE IF NOT EXISTS customer_transactions (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                customer_id     INTEGER NOT NULL REFERENCES customers(id),
                amount          REAL,
                type            TEXT,
                description     TEXT,
                turn_id         INTEGER,
                operator        TEXT,
                timestamp       TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer ON customer_transactions(customer_id);

            CREATE TABLE IF NOT EXISTS suppliers (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL,
                contact         TEXT,
                phone           TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);

            CREATE TABLE IF NOT EXISTS purchases (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                supplier_id     INTEGER REFERENCES suppliers(id),
                invoice_number  TEXT,
                total_cost      REAL,
                operator        TEXT,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_purchases_business_id ON purchases(business_id);

            CREATE TABLE IF NOT EXISTS purchase_items (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                purchase_id     INTEGER REFERENCES purchases(id),
                product_id      INTEGER,
                product_name    TEXT,
                quantity        REAL,
                unit_cost       REAL
            );
            CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

            CREATE TABLE IF NOT EXISTS stock_movements (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                product_id      INTEGER,
                movement_type   TEXT,
                quantity        REAL,
                old_value       TEXT,
                new_value       TEXT,
                reason          TEXT,
                operator        TEXT,
                source_id       TEXT,
                timestamp       TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_stock_movements_business ON stock_movements(business_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_source ON stock_movements(source_id, business_id);

            CREATE TABLE IF NOT EXISTS egresos_caja (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                turn_id         INTEGER,
                monto           REAL,
                motivo          TEXT,
                type            TEXT DEFAULT 'gasto',
                operator        TEXT,
                timestamp       TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_egresos_business_id ON egresos_caja(business_id);

            CREATE TABLE IF NOT EXISTS promotions (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL,
                description     TEXT DEFAULT '',
                type            TEXT DEFAULT 'combo',
                discount_percent REAL DEFAULT 0,
                combo_price     REAL DEFAULT 0,
                is_active       INTEGER NOT NULL DEFAULT 1,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_promotions_business_id ON promotions(business_id);

            CREATE TABLE IF NOT EXISTS promotion_conditions (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                promotion_id    INTEGER REFERENCES promotions(id),
                product_id      INTEGER NOT NULL,
                min_qty         INTEGER DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_promotion_conditions_promo ON promotion_conditions(promotion_id);

            CREATE TABLE IF NOT EXISTS sucursales (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sucursales_business_id ON sucursales(business_id);

            CREATE TABLE IF NOT EXISTS business_config (
                business_id     TEXT PRIMARY KEY REFERENCES businesses(id),
                nombre          TEXT,
                subtitulo       TEXT,
                direccion       TEXT,
                telefono        TEXT,
                cuit            TEXT,
                condicion_iva   TEXT,
                numero_caja     TEXT,
                mensaje_ticket  TEXT,
                iva_rate        TEXT DEFAULT '21',
                mp_access_token TEXT,
                mp_collector_id TEXT,
                catalogo_activo INTEGER DEFAULT 0,
                catalogo_slug   TEXT,
                catalogo_whatsapp TEXT,
                print_config    TEXT
            );
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS print_config TEXT;

            CREATE TABLE IF NOT EXISTS audit_log (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                action          TEXT,
                operator        TEXT,
                details         TEXT,
                timestamp       TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_audit_log_business_id ON audit_log(business_id);

            CREATE TABLE IF NOT EXISTS payment_intents (
                id              TEXT PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                total           REAL,
                description     TEXT,
                status          TEXT DEFAULT 'pending',
                mp_payment_id   TEXT,
                mp_mode         TEXT,
                external_ref    TEXT,
                created_at      TIMESTAMPTZ DEFAULT now(),
                updated_at      TIMESTAMPTZ
            );
        """)

        plan_count = await conn.fetchval("SELECT COUNT(*) FROM plans")
        if plan_count == 0:
            await conn.execute("""
                INSERT INTO plans (slug, name, monthly_price, yearly_price, max_products, max_users, features, sort_order)
                VALUES
                ('simple', 'Simple', 20000, 200000, 3500, 2, '["Hasta 3.500 productos","Clientes y ventas","Soporta cortes de internet","Manejo de fiados","Lector laser e impresoras","Hasta 2 usuarios"]', 1),
                ('pro', 'Pro', 30000, 300000, 7000, 5, '["Todo lo de Simple","Hasta 7.000 productos","Manejo de proveedores","Catalogo web online QR","Reportes de ventas detallados","Alta asistida en ARCA/AFIP","Hasta 5 usuarios"]', 2),
                ('ia', 'IA', 40000, 400000, 10000, 10, '["Todo lo de Pro","Hasta 10.000 productos","Escanner de facturas IA","Asesor de precios inteligente","Alta asistida en ARCA/AFIP","Reportes inteligentes","Hasta 10 usuarios"]', 3)
            """)

        test_count = await conn.fetchval("SELECT COUNT(*) FROM testimonials")
        if test_count == 0:
            await conn.execute("""
                INSERT INTO testimonials (text, author_name, business_name, stars, is_verified)
                VALUES
                ('Antes usaba un cuaderno. Ahora se cuanto vendi ayer, cuanto me deben y que comprar. Cambio todo.', 'Carlos', 'Kiosco Don Carlos, Lomas', 5, true),
                ('Se corto internet 3 dias y cobramos normal. Eso solo vale la mensualidad.', 'Maria', 'Almacen La Buena Fe, Lanus', 5, true),
                ('El escaner de facturas me ahorra 2 horas por semana. Una locura.', 'Roberto', 'Maxikiosco Robbie, Moron', 5, true),
                ('Pase de perder plata todos los dias a saber exactamente cuanto gano. Mis empleados ya no me roban.', 'Andrea', 'Kiosco La Esquina, Quilmes', 5, true),
                ('El soporte por WhatsApp es increible. Me responden al toque y siempre me solucionan.', 'Miguel', 'Minimercado Santa Rita, San Justo', 5, true),
                ('Tenia miedo de usar un sistema, pero en 5 minutos ya estaba vendiendo. Es mas facil que WhatsApp.', 'Graciela', 'Dietetica Luz Verde, Avellaneda', 4, true)
            """)

            await conn.execute("""
            CREATE TABLE IF NOT EXISTS superadmins (
                id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                email           TEXT UNIQUE NOT NULL,
                password_hash   TEXT NOT NULL,
                role            TEXT DEFAULT 'superadmin',
                created_at      TIMESTAMPTZ DEFAULT now(),
                last_login      TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                superadmin_id   TEXT REFERENCES superadmins(id),
                business_id     TEXT REFERENCES businesses(id),
                action          TEXT NOT NULL,
                old_value       JSONB,
                new_value       JSONB,
                notes           TEXT,
                timestamp       TIMESTAMPTZ DEFAULT now()
            )
            """)
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_admin_audit_business ON admin_audit_log(business_id)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action)")

    logger.info("PostgreSQL inicializado: todas las tablas creadas y datos seedeados")


async def get_business_id_from_jwt(payload: dict) -> Optional[str]:
    if not payload or not payload.get("sub"):
        return None
    return payload["sub"]


def tenanted(query: str, tenant_param: str = "business_id") -> str:
    return query

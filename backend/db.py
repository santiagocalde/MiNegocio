import os
import glob
import logging
import asyncpg
from typing import Optional

logger = logging.getLogger("MiNegocio.PG")

_pg_password = os.getenv("PG_PASSWORD")
PII_ENCRYPTION_KEY = os.getenv("PII_ENCRYPTION_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL and not _pg_password:
    raise RuntimeError("PG_PASSWORD no configurado en el entorno. Definir PG_PASSWORD en .env o variables de entorno.")
if DATABASE_URL and not PII_ENCRYPTION_KEY:
    raise RuntimeError("PII_ENCRYPTION_KEY no configurado en el entorno. Definir PII_ENCRYPTION_KEY en .env o variables de entorno.")

PG_CONFIG = {
    "host": os.getenv("PG_HOST", "localhost"),
    "port": int(os.getenv("PG_PORT", "5432")),
    "user": os.getenv("PG_USER", "minegocio"),
    "password": _pg_password or "",
    "database": os.getenv("PG_DATABASE", "minegocio"),
}

_pool: Optional[asyncpg.Pool] = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Inicializa cada conexión del pool.

    Codec NUMERIC -> float: las columnas de dinero se migraron de REAL a
    NUMERIC(12,2) para guardar montos con 2 decimales exactos (sin la deriva
    de los float). Pero asyncpg, por defecto, devuelve NUMERIC como Decimal,
    y Decimal NO es serializable a JSON con json.dumps -> rompería los
    endpoints. Este codec hace que NUMERIC se lea/escriba como float, así el
    resto del código (modelos Pydantic con float, serialización, etc.) sigue
    funcionando EXACTAMENTE igual que con REAL. La precisión vive en la base.
    """
    await conn.set_type_codec(
        "numeric",
        schema="pg_catalog",
        encoder=str,
        decoder=float,
        format="text",
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        try:
            dsn = DATABASE_URL or f"postgresql://{PG_CONFIG['user']}:{PG_CONFIG['password']}@{PG_CONFIG['host']}:{PG_CONFIG['port']}/{PG_CONFIG['database']}"
            _pool = await asyncpg.create_pool(
                dsn=dsn,
                min_size=8,
                max_size=50,  # headroom para 100+ kioscos (PG max_connections=100, 1 worker)
                command_timeout=30,
                max_inactive_connection_lifetime=300,  # recicla conexiones idle (5 min)
                init=_init_connection,
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


MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")


async def run_migrations_pg() -> None:
    """Runner de migraciones liviano para PostgreSQL.

    Aplica una sola vez, en orden, los archivos backend/migrations/*.pg.sql que
    todavía no estén registrados en schema_migrations. Cada migración corre en su
    propia transacción: si falla, no queda a medias ni se marca como aplicada.

    El schema base se sigue creando en init_pg() (idempotente). Este runner es
    para los CAMBIOS posteriores (ALTER TABLE, nuevas tablas, índices), así
    quedan versionados y trazables en vez de ALTERs sueltos.

    Usa su propia conexión del pool para no depender del estado de la sesión
    de init_pg. Convención de nombre: 0001_descripcion.pg.sql (prefijo = orden).
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                id          TEXT PRIMARY KEY,
                applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )"""
        )
        rows = await conn.fetch("SELECT id FROM schema_migrations")
        applied = {r["id"] for r in rows}

        if not os.path.isdir(MIGRATIONS_DIR):
            return
        paths = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.pg.sql")))
        pending = 0
        for path in paths:
            mig_id = os.path.basename(path)[:-len(".pg.sql")]
            if mig_id in applied:
                continue
            with open(path, encoding="utf-8") as f:
                sql = f.read().strip()
            if not sql:
                # Migración vacía: igual la registramos para no reintentarla siempre.
                await conn.execute("INSERT INTO schema_migrations (id) VALUES ($1)", mig_id)
                continue
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute("INSERT INTO schema_migrations (id) VALUES ($1)", mig_id)
            pending += 1
            logger.info(f"Migración aplicada: {mig_id}")
        logger.info(f"Migraciones al día (schema_migrations): {len(applied) + pending} aplicadas")


async def init_pg() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:

        await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

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
                source          TEXT DEFAULT '',
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
                price           NUMERIC(12,2) NOT NULL DEFAULT 0,
                cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
                stock           INTEGER NOT NULL DEFAULT 0,
                min_stock       INTEGER NOT NULL DEFAULT 5,
                iva             TEXT NOT NULL DEFAULT '21%',
                category_id     INTEGER,
                is_virtual      INTEGER NOT NULL DEFAULT 0,
                parent_id       INTEGER,
                pack_size       INTEGER DEFAULT 1,
                expiry_date     TEXT DEFAULT '',
                is_active       INTEGER NOT NULL DEFAULT 1,
                image_url       TEXT DEFAULT '',
                created_at      TIMESTAMPTZ DEFAULT now(),
                updated_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
            CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
            CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

            CREATE TABLE IF NOT EXISTS product_barcodes (
                id          SERIAL PRIMARY KEY,
                business_id TEXT NOT NULL REFERENCES businesses(id),
                product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                code        TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_product_barcodes_code ON product_barcodes(code);
            CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON product_barcodes(product_id);

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
                sales_total     NUMERIC(12,2) DEFAULT 0,
                counted_cash    NUMERIC(12,2),
                difference      NUMERIC(12,2),
                notes           TEXT,
                initial_cash    NUMERIC(12,2) DEFAULT 0,
                sucursal_id     INTEGER DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_turns_business_id ON turns(business_id);

            CREATE TABLE IF NOT EXISTS sales (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                turn_id         INTEGER,
                total           NUMERIC(12,2) NOT NULL,
                payment         NUMERIC(12,2) NOT NULL DEFAULT 0,
                change_given    NUMERIC(12,2) NOT NULL DEFAULT 0,
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
            -- NOTA: idx_sales_business_id (business_id) se eliminó por redundante:
            -- el compuesto idx_sales_business_timestamp ya cubre los filtros por
            -- business_id. Menos índices = menos amplificación de escritura por venta.
            CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
            CREATE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(idempotency_key);
            -- Compuesto: acelera /sales/today y reportes por rango (filtro tenant + fecha)
            CREATE INDEX IF NOT EXISTS idx_sales_business_timestamp ON sales(business_id, timestamp);
            -- Autovacuum más agresivo: 'sales' sufre churn (rollbacks/idempotencia) y
            -- los índices se hinchan si el vacuum no corre seguido.
            ALTER TABLE sales SET (autovacuum_vacuum_scale_factor=0.05, autovacuum_analyze_scale_factor=0.02);

            -- Detalle de pagos mixtos (efectivo + tarjeta/transferencia) para que el
            -- arqueo del cierre de caja pueda sumar la porción en efectivo.
            CREATE TABLE IF NOT EXISTS sale_payments (
                id          SERIAL PRIMARY KEY,
                business_id TEXT NOT NULL REFERENCES businesses(id),
                sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                method      TEXT NOT NULL,
                amount      NUMERIC(12,2) NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);

            CREATE TABLE IF NOT EXISTS sale_items (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                sale_id         INTEGER NOT NULL REFERENCES sales(id),
                product_id      INTEGER,
                product_name    TEXT,
                quantity        REAL NOT NULL,
                unit_price      NUMERIC(12,2) NOT NULL,
                item_discount   NUMERIC(12,2) DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
            CREATE INDEX IF NOT EXISTS idx_sale_items_business ON sale_items(business_id);

            CREATE TABLE IF NOT EXISTS customers (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL,
                phone           TEXT,
                balance         NUMERIC(12,2) DEFAULT 0,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);

            CREATE TABLE IF NOT EXISTS customer_transactions (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                customer_id     INTEGER NOT NULL REFERENCES customers(id),
                amount          NUMERIC(12,2),
                type            TEXT,
                description     TEXT,
                turn_id         INTEGER,
                operator        TEXT,
                timestamp       TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer ON customer_transactions(customer_id);
            CREATE INDEX IF NOT EXISTS idx_customer_tx_business ON customer_transactions(business_id);

            CREATE TABLE IF NOT EXISTS suppliers (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL,
                contact         TEXT,
                phone           TEXT,
                debt            NUMERIC(12,2) DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON suppliers(business_id);

            CREATE TABLE IF NOT EXISTS purchases (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                supplier_id     INTEGER REFERENCES suppliers(id),
                invoice_number  TEXT,
                total_cost      NUMERIC(12,2),
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
                unit_cost       NUMERIC(12,2)
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
            -- Autovacuum agresivo: una fila por ítem por venta, la tabla que más crece.
            ALTER TABLE stock_movements SET (autovacuum_vacuum_scale_factor=0.05, autovacuum_analyze_scale_factor=0.02);

            CREATE TABLE IF NOT EXISTS egresos_caja (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                turn_id         INTEGER,
                monto           NUMERIC(12,2),
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
                combo_price     NUMERIC(12,2) DEFAULT 0,
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

            CREATE TABLE IF NOT EXISTS quotes (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                customer_id     INTEGER REFERENCES customers(id),
                status          TEXT DEFAULT 'draft',
                list_type       TEXT DEFAULT 'a',
                note            TEXT,
                valid_days      INTEGER DEFAULT 15,
                created_at      TIMESTAMPTZ DEFAULT now(),
                expires_at      TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS idx_quotes_business_id ON quotes(business_id);

            CREATE TABLE IF NOT EXISTS quote_items (
                id              SERIAL PRIMARY KEY,
                quote_id        INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
                product_id      INTEGER NOT NULL,
                quantity        NUMERIC(12,3) NOT NULL DEFAULT 1,
                unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

            CREATE TABLE IF NOT EXISTS remitos (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                quote_id        INTEGER REFERENCES quotes(id),
                customer_id     INTEGER REFERENCES customers(id),
                address         TEXT,
                driver          TEXT,
                scheduled_date  DATE,
                status          TEXT DEFAULT 'pending',
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_remitos_business_id ON remitos(business_id);

            CREATE TABLE IF NOT EXISTS remito_items (
                id              SERIAL PRIMARY KEY,
                remito_id       INTEGER NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
                product_id      INTEGER NOT NULL,
                quantity        NUMERIC(12,3) NOT NULL DEFAULT 1,
                unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_remito_items_remito_id ON remito_items(remito_id);

            CREATE TABLE IF NOT EXISTS obras (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                name            TEXT NOT NULL,
                customer_id     INTEGER REFERENCES customers(id),
                address         TEXT,
                status          TEXT DEFAULT 'activa',
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_obras_business_id ON obras(business_id);

            -- Corralón V2: Acopios (material pagado no retirado)
            CREATE TABLE IF NOT EXISTS acopios (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                customer_id     INTEGER REFERENCES customers(id),
                obra_id         INTEGER REFERENCES obras(id),
                status          TEXT DEFAULT 'active',
                created_at      TIMESTAMPTZ DEFAULT now(),
                completed_at    TIMESTAMPTZ
            );
            CREATE INDEX IF NOT EXISTS idx_acopios_business_id ON acopios(business_id);

            CREATE TABLE IF NOT EXISTS acopio_items (
                id              SERIAL PRIMARY KEY,
                acopio_id       INTEGER NOT NULL REFERENCES acopios(id) ON DELETE CASCADE,
                product_id      INTEGER NOT NULL,
                quantity_total  NUMERIC(12,3) NOT NULL DEFAULT 0,
                quantity_retirada NUMERIC(12,3) NOT NULL DEFAULT 0,
                unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS acopio_withdrawals (
                id              SERIAL PRIMARY KEY,
                acopio_id       INTEGER NOT NULL REFERENCES acopios(id),
                driver          TEXT,
                notes           TEXT,
                created_at      TIMESTAMPTZ DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS acopio_withdrawal_items (
                id              SERIAL PRIMARY KEY,
                withdrawal_id   INTEGER NOT NULL REFERENCES acopio_withdrawals(id) ON DELETE CASCADE,
                acopio_item_id  INTEGER NOT NULL REFERENCES acopio_items(id),
                quantity        NUMERIC(12,3) NOT NULL DEFAULT 0
            );

            -- Corralón V2: Devoluciones con nota de crédito
            CREATE TABLE IF NOT EXISTS credit_notes (
                id              SERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL REFERENCES businesses(id),
                customer_id     INTEGER REFERENCES customers(id),
                total           NUMERIC(12,2) NOT NULL DEFAULT 0,
                reason          TEXT,
                operator        TEXT,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_credit_notes_business_id ON credit_notes(business_id);

            CREATE TABLE IF NOT EXISTS credit_note_items (
                id              SERIAL PRIMARY KEY,
                credit_note_id  INTEGER NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
                product_id      INTEGER,
                product_name    TEXT,
                quantity        NUMERIC(12,3) NOT NULL DEFAULT 0,
                unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0
            );

            -- Corralón V2: Hojas de Ruta (columnas en remitos)
            ALTER TABLE remitos ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
            ALTER TABLE remitos ADD COLUMN IF NOT EXISTS sort_order INTEGER;

            -- Logo del negocio
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS logo_url TEXT;

            -- Clientes mejorados: direccion, email, DNI/CUIT para facturacion
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS dni_cuit TEXT;

            -- Etapa 2: múltiples direcciones por cliente
            CREATE TABLE IF NOT EXISTS customer_addresses (
                id          SERIAL PRIMARY KEY,
                business_id TEXT NOT NULL REFERENCES businesses(id),
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                label       TEXT NOT NULL DEFAULT 'Dirección',
                address     TEXT NOT NULL,
                is_default  BOOLEAN NOT NULL DEFAULT false,
                created_at  TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);

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
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_name TEXT DEFAULT '';
            -- PII (phone/owner_name) migró a pgp_sym_encrypt (commit ae67fd6). Las columnas
            -- siguen siendo TEXT: los datos nuevos se guardan como bytea casteado a text
            -- ("\\x..."), los viejos como texto plano. Esta función tolera los 3 estados
            -- (vacío/NULL, encriptado, plano) sin romper la query cuando algún registro
            -- no está encriptado. Se llama con el mismo key que pgp_sym_encrypt.
            CREATE OR REPLACE FUNCTION safe_pii_decrypt(val TEXT, key TEXT) RETURNS TEXT AS $safe_pii$
            BEGIN
                IF val IS NULL OR val = '' THEN RETURN ''; END IF;
                -- bytea castado a text (modo hex) empieza con "\\x". LIKE trata "\\" como
                -- escape del patrón, por eso comparamos bytes literales con left().
                IF left(val, 2) = E'\\\\x' THEN
                    BEGIN
                        RETURN pgp_sym_decrypt(decode(substring(val from 3), 'hex'), key);
                    EXCEPTION WHEN OTHERS THEN RETURN '';
                    END;
                END IF;
                RETURN val;
            END;
            $safe_pii$ LANGUAGE plpgsql IMMUTABLE;
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT '';
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS prior_pos TEXT DEFAULT '';
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS needs_arca TEXT DEFAULT '';
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT '';
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '';
            -- El enlace del catálogo web debe ser único entre todos los negocios.
            -- el índice parcial ignora NULL/vacío (negocios sin catálogo) y evita
            -- que dos comercios activen el mismo enlace (backend ya devuelve 409).
            CREATE UNIQUE INDEX IF NOT EXISTS uq_business_config_catalogo_slug
                ON business_config(catalogo_slug)
                WHERE catalogo_slug IS NOT NULL AND catalogo_slug <> '';
            -- Día de trial (2/4/6/7) del último recordatorio enviado, para no
            -- reenviar el mismo email en cada reinicio del backend.
            ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_email_sent_day INT;
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS print_config TEXT;
            -- Personalización del catálogo web: tema de color (5 fijos) para el
            -- render público. El eslogan y la dirección ya viven en subtitulo/direccion.
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS catalogo_tema TEXT DEFAULT 'ocean';
            -- Visibilidad por producto en el catálogo público (elegir qué mostrar).
            ALTER TABLE products ADD COLUMN IF NOT EXISTS en_catalogo INTEGER DEFAULT 1;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
            ALTER TABLE sale_items ALTER COLUMN product_id DROP NOT NULL;
            ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS debt NUMERIC(12,2) DEFAULT 0;

            -- Rubro Corralón: precio mayorista/contratista (Lista B) y unidad de medida
            ALTER TABLE products ADD COLUMN IF NOT EXISTS price_b NUMERIC(12,2);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_label VARCHAR(20) DEFAULT 'unidad';

            -- 5 listas de precio (C, D, E) — A = price (minorista), B = price_b (mayorista)
            ALTER TABLE products ADD COLUMN IF NOT EXISTS price_c NUMERIC(12,2);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS price_d NUMERIC(12,2);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS price_e NUMERIC(12,2);

            -- Nombres configurables para cada lista de precios
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS price_list_a_name TEXT DEFAULT 'Lista A - Minorista';
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS price_list_b_name TEXT DEFAULT 'Lista B - Mayorista';
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS price_list_c_name TEXT DEFAULT 'Lista C';
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS price_list_d_name TEXT DEFAULT 'Lista D';
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS price_list_e_name TEXT DEFAULT 'Lista E';

            -- Presupuestos v2: descuento global y forma de pago
            ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE quotes ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(50) DEFAULT 'Contado';

            -- Config v2: redes sociales y datos fiscales adicionales
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS instagram TEXT DEFAULT '';
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS propietario TEXT DEFAULT '';
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS ing_brutos TEXT DEFAULT '';
            ALTER TABLE business_config ADD COLUMN IF NOT EXISTS inicio_actividades TEXT DEFAULT '';

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

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_logs (
                id              BIGSERIAL PRIMARY KEY,
                business_id     TEXT NOT NULL,
                function_name   TEXT NOT NULL,
                input_hash      TEXT NOT NULL,
                input_data      JSONB,
                output_text     TEXT,
                model           TEXT,
                tokens_in       INTEGER DEFAULT 0,
                tokens_out      INTEGER DEFAULT 0,
                created_at      TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_ai_logs_lookup
                ON ai_logs(business_id, function_name, input_hash, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_ai_logs_training
                ON ai_logs(function_name, created_at DESC);
        """)

        plan_count = await conn.fetchval("SELECT COUNT(*) FROM plans")
        if plan_count == 0:
            await conn.execute("""
                INSERT INTO plans (slug, name, monthly_price, yearly_price, max_products, max_users, features, sort_order)
                VALUES
                ('simple', 'Simple', 19999, 180000, 3500, 2, '["Hasta 3.500 productos","Clientes y ventas","Soporta cortes de internet","Manejo de fiados","Lector laser e impresoras","Hasta 2 usuarios"]', 1),
                ('pro', 'Pro', 29999, 270000, 7000, 5, '["Todo lo de Simple","Catalogo web con QR (tu tienda online)","Reportes de ventas y ganancias","Analisis de rentabilidad por producto","Manejo de proveedores","Hasta 7.000 productos","Hasta 5 usuarios"]', 2),
                ('ia', 'IA', 39999, 360000, 10000, 10, '["Todo lo de Pro","Escaner de facturas con IA","Resumen diario del negocio con IA","Asesor de precios y reposicion con IA","Cobranza de fiados por WhatsApp con IA","Hasta 10.000 productos"]', 3)
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

    # Migraciones incrementales versionadas. Se corren en su PROPIA conexión
    # (no la del init de arriba) para aislarlas del estado de esa sesión.
    await run_migrations_pg()


async def get_business_id_from_jwt(payload: dict) -> Optional[str]:
    if not payload or not payload.get("sub"):
        return None
    return payload["sub"]


def tenanted(query: str, tenant_param: str = "business_id") -> str:
    return query

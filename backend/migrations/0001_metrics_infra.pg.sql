-- Infraestructura de métricas del panel de admin.
-- Todo aditivo e idempotente: no toca ventas, inventario ni datos existentes.

-- Ciclo de facturación real del negocio (mensual/anual). Antes se inferia por
-- la distancia de plan_end_date; ahora queda explícito para el ratio anual:mensual.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT '';

-- Registro de bajas (churn cualitativo, al estilo de lo que mide Cobrando:
-- "el churn es sano, ajeno al precio"). Se llena automáticamente cuando un negocio
-- deja de pagar (webhook MP) o cuando el admin lo suspende/expira.
CREATE TABLE IF NOT EXISTS cancellations (
    id            SERIAL PRIMARY KEY,
    business_id   TEXT REFERENCES businesses(id) ON DELETE SET NULL,
    business_name TEXT DEFAULT '',
    plan          TEXT DEFAULT '',
    billing_period TEXT DEFAULT '',
    reason        TEXT NOT NULL DEFAULT '',   -- mp_cancelled | admin_suspended | admin_expired | otro
    detail        TEXT DEFAULT '',
    mrr_lost      INTEGER NOT NULL DEFAULT 0, -- MRR normalizado que se pierde con la baja
    days_active   INTEGER,                    -- días que estuvo pagando (lifetime aprox)
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Eventos del funnel público (visita a landing, inicio de registro).
-- Permite calcular la conversión landing → registro, el KPI que Thiago
-- movió del 6% al 10% cambiando la escalera de precios.
CREATE TABLE IF NOT EXISTS funnel_events (
    id            SERIAL PRIMARY KEY,
    event         TEXT NOT NULL,              -- landing_view | register_start | register_done | checkout_start
    utm_source    TEXT DEFAULT '',
    utm_medium    TEXT DEFAULT '',
    utm_campaign  TEXT DEFAULT '',
    path          TEXT DEFAULT '',
    session_id    TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_created ON funnel_events (created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event   ON funnel_events (event);
CREATE INDEX IF NOT EXISTS idx_cancellations_created ON cancellations (created_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events (created_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_biz     ON payment_events (business_id);

-- F5: Cobro de acopios
ALTER TABLE acopios ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE acopios ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE acopios ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE acopios ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;

-- F6: Pedido a proveedor como compra pendiente
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';

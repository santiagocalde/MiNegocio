-- Migración 0005: Proveedor asociado al producto
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);

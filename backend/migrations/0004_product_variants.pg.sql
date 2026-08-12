-- Variantes de producto: permite agrupar presentaciones de un mismo producto
-- (ej: Cemento 25kg, Cemento 50kg) bajo un producto padre sin duplicar productos.
-- parent_product_id = NULL → producto normal o producto padre
-- parent_product_id = ID   → es una variante del producto padre
-- variant_label = etiqueta visible de la variante (ej: "25 kg", "Rojo", "Grande")
ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_product_id INTEGER REFERENCES products(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_label TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_product_id);

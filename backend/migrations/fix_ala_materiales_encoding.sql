-- Fix encoding roto en Ala Materiales (business_id: fd2a7e2d-0ec9-47ef-ba22-872286f8065b)
-- Los nombres de listas de precio tienen el em dash (U+2014) corrupto
-- Ejecutar UNA sola vez despues del deploy

UPDATE business_config
SET
  price_list_a_name = 'Lista A - Minorista',
  price_list_b_name = 'Lista B - Mayorista'
WHERE business_id = 'fd2a7e2d-0ec9-47ef-ba22-872286f8065b'
  AND (
    price_list_a_name IS NULL
    OR price_list_a_name NOT LIKE 'Lista A - Minorista'
    OR price_list_b_name IS NULL
    OR price_list_b_name NOT LIKE 'Lista B - Mayorista'
  );

-- Verificacion
SELECT business_id, price_list_a_name, price_list_b_name
FROM business_config
WHERE business_id = 'fd2a7e2d-0ec9-47ef-ba22-872286f8065b';

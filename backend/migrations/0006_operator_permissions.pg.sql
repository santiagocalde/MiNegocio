-- Migración 0006: Permisos por módulo para operadores
ALTER TABLE operators ADD COLUMN IF NOT EXISTS permissions TEXT;

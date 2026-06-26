# Migraciones de schema

Runner liviano y versionado para cambios de esquema posteriores al baseline.
El schema base lo sigue creando `db.init_pg()` (idempotente, `CREATE TABLE IF NOT EXISTS`).
Acá van solo los **cambios incrementales** (nuevas tablas, `ALTER TABLE`, índices),
para que queden trazados en vez de ALTERs sueltos perdidos en el código.

## Cómo funciona

- Al arrancar, `run_migrations_pg()` crea la tabla `schema_migrations` y aplica,
  en orden, los archivos `*.pg.sql` que todavía no estén registrados.
- Cada migración corre en su **propia transacción**: si falla, no queda a medias
  ni se marca como aplicada (se reintenta en el próximo arranque).
- Es idempotente a nivel runner: una migración ya aplicada nunca se vuelve a correr.

## Convención de nombres

```
0001_descripcion_corta.pg.sql
0002_otra_cosa.pg.sql
```

- Prefijo numérico de 4 dígitos = orden de aplicación (no reutilizar números).
- Sufijo `.pg.sql` = motor PostgreSQL (producción).
- El contenido es SQL crudo. Conviene que sea idempotente igual
  (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) por las dudas.

## Ejemplo

`0001_add_telefono_a_customers.pg.sql`:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telefono TEXT;
```

## Importante (producción)

- NO editar una migración ya aplicada en prod: crear una nueva.
- Hacer backup de la DB antes de desplegar una migración que altere datos.

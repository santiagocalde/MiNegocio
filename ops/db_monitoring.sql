-- ============================================================================
-- Monitoreo de salud de la base (P3 del plan de escalado)
-- ============================================================================
-- Uso:
--   docker exec minegocio-db-1 psql -U minegocio -d minegocio -f /ruta/db_monitoring.sql
--   (o copiar/pegar las queries de a una)
--
-- Qué detecta: bloat de índices, tablas con mucha "basura" (dead tuples) y
-- churn anómalo (insert/delete masivos) como el stress test que ensució prod.
-- ============================================================================

-- 1) Tamaño total de la base
SELECT pg_size_pretty(pg_database_size(current_database())) AS base_total;

-- 2) Tablas por tamaño + dead tuples + ratio de hinchazón.
--    Señal de alarma: n_dead_tup alto frente a n_live_tup, o índices >> heap.
SELECT
    relname                                         AS tabla,
    n_live_tup                                      AS filas_vivas,
    n_dead_tup                                      AS filas_muertas,
    pg_size_pretty(pg_relation_size(relid))         AS heap,
    pg_size_pretty(pg_indexes_size(relid))          AS indices,
    pg_size_pretty(pg_total_relation_size(relid))   AS total,
    last_autovacuum,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- 3) Churn histórico: si n_tup_ins/n_tup_del son ENORMES y n_live_tup chico,
--    algo insertó+borró en masa (típico de tests corridos contra producción).
SELECT
    relname        AS tabla,
    n_tup_ins      AS insertados,
    n_tup_del      AS borrados,
    n_tup_upd      AS actualizados,
    n_live_tup     AS vivos_ahora
FROM pg_stat_user_tables
WHERE n_tup_ins + n_tup_del > 10000
ORDER BY (n_tup_ins + n_tup_del) DESC;

-- 4) Tamaño de cada índice de 'sales' (la tabla que más se hincha con churn).
--    Si alguno crece muy por encima del heap -> REINDEX TABLE CONCURRENTLY sales;
SELECT
    indexrelname                                AS indice,
    pg_size_pretty(pg_relation_size(indexrelid)) AS tamano,
    idx_scan                                    AS veces_usado
FROM pg_stat_user_indexes
WHERE relname = 'sales'
ORDER BY pg_relation_size(indexrelid) DESC;

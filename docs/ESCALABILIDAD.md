# Escalabilidad — Estado y Roadmap

Última actualización: 2026-06-20

Documento de referencia sobre la capacidad del sistema para soportar múltiples
kioscos remotos en simultáneo, qué ya está resuelto y qué queda para crecer.

---

## ✅ Resuelto — el server aguanta 100+ kioscos

Estos fixes ya están en producción y testeados (E2E + `EXPLAIN ANALYZE`).

### 1. Query `/sales/today` sargable + índice compuesto
- **Antes:** `WHERE business_id=$1 AND timestamp::date=current_date` — la función
  `timestamp::date` impedía usar índices; escaneaba TODO el historial del kiosco
  en cada llamada. Y se llama cada 15s (health check) + en cada reconexión SSE.
- **Ahora:** `timestamp >= current_date AND timestamp < current_date + interval '1 day'`
  + índice `idx_sales_business_timestamp (business_id, timestamp)`.
- **Verificado:** con 100k ventas en 20 kioscos, el planner usa el índice compuesto;
  va directo a las filas del día (0.2ms vs 3.5ms escaneando todo).
- Archivos: `backend/routers/sales.py` (today_sales), `backend/db.py` (índice).

### 2. SSE particionado por tenant
- **Antes:** `EventManager` tenía un único `set` global. Cada venta de cualquier
  kiosco se empujaba a TODAS las conexiones → O(N²) de tráfico + fuga de aislamiento
  (la pestaña del kiosco A recibía eventos del kiosco B).
- **Ahora:** las colas se agrupan por `business_id`; `emit()` solo notifica al tenant
  correspondiente. El endpoint SSE extrae `business_id` del JWT al suscribir.
- **Verificado:** el kiosco A no recibe eventos del kiosco B.
- Archivos: `backend/event_stream.py`, `backend/main.py` (endpoint SSE), `backend/routers/sales.py` (emit).

### 3. Export a Excel acotado
- **Antes:** sin rango de fecha exportaba TODO el historial a memoria (pico de RAM).
- **Ahora:** rango por defecto de 90 días, comparaciones sargables y tope duro de
  50.000 filas. Maneja fechas inválidas sin crashear.
- Archivo: `backend/routers/reports.py`.

### 4. Pool de PostgreSQL
- `min_size 4→8`, `max_size 20→50`, `max_inactive_connection_lifetime=300`.
- Confirmado: `db_helpers.get_pg_pool` ya delegaba al pool canónico de `db.py`
  (un solo pool, no duplicado). PG `max_connections=100`, 1 worker de uvicorn.
- Archivo: `backend/db.py`.

### Índices agregados de paso
- `idx_sales_business_timestamp (business_id, timestamp)`
- `idx_sale_items_business (business_id)` — acelera borrado por tenant y reportes
- `idx_customer_tx_business (business_id)` — íd.

---

## 📋 Roadmap — para crecer MÁS ALLÁ de 100 kioscos

No son bugs: son techos arquitectónicos que se tocan al escalar. Implementar antes
de tiempo es complejidad innecesaria. Orden por prioridad.

### Tier 2 — al pasar ~200 kioscos

**A. SSE con Redis pub/sub**
- Hoy el `EventManager` es en memoria y corre **1 solo worker de uvicorn**.
- Para correr varios workers (aprovechar más CPU del VPS) los eventos tienen que
  compartirse entre procesos → Redis pub/sub.
- Sin esto no se puede escalar horizontalmente: cada worker tendría su propio
  `EventManager` y un cliente conectado al worker B no recibiría eventos emitidos
  en el worker A.
- Implementación: reemplazar el `set`/`dict` en memoria por publish a un canal
  Redis por tenant (`events:{business_id}`) y que cada worker se suscriba.

**B. Archivado de tablas que crecen sin fin**
- `stock_movements` (una fila por ítem por venta — la que más crece) y `audit_log`.
- A +1 año los reportes y mantenimiento se vuelven pesados.
- Opciones: particionado por mes (PG declarative partitioning) o job que mueve
  registros > N meses a una tabla histórica / cold storage.

### Tier 3 — higiene de datos a largo plazo

**C. VACUUM periódico del SQLite de cada tenant offline**
- En modo offline cada kiosco tiene su archivo `.db`; se infla con los meses y no
  se compacta solo. Job de mantenimiento que corra `VACUUM`.

**D. Paginación server-side de productos**
- Hoy el POS hace `GET /api/products?limit=5000` y carga todo el catálogo en memoria.
- Fino hasta unos cientos de productos; el plan IA permite 10.000.
- Migrar a búsqueda server-side (query por nombre/código con LIMIT) en vez de cargar
  todo y filtrar en el cliente.

---

## Notas de capacidad actual

- **1 worker uvicorn** (`CMD uvicorn main:app` sin `--workers`). Para 100 kioscos con
  queries indexadas alcanza; las conexiones SSE son baratas (await idle). El salto a
  multi-worker requiere el Tier 2.A (Redis) primero.
- **PG `max_connections=100`**, pool de la app `max_size=50` → headroom cómodo con 1 worker.
- Las verificaciones se hicieron con tests E2E efímeros (cuenta de prueba creada y
  borrada) y `EXPLAIN ANALYZE` con datos sintéticos. No tocan datos de producción.

---

## 🔎 Hallazgos 2026-06-24 — riesgos reales medidos en producción

Análisis sobre la base real (negocio "Kiosco de la Tía", `kiosco1@gmail.com`).
**Conclusión de fondo: los datos de ventas NO son el problema; el riesgo está en el
mantenimiento de índices y en dos decisiones de esquema.**

### Lo que mostró la medición
- Ventas reales del kiosco: **112 ventas en 7 días (~16/día)**. Datos crudos: ~21 KB.
  Heap real de la tabla `sales`: **32 KB**. Minúsculo.
- Pero la tabla `sales` ocupa **18 MB**, **todo en índices hinchados** (no en datos):
  `idx_sales_idempotency` 7.8 MB · `idx_sales_business_timestamp` 4.4 MB ·
  `idx_sales_timestamp` 2.8 MB · `sales_pkey` 2.3 MB.
- **Causa:** la secuencia de IDs llegó a **105.342** con solo 114 filas vivas →
  se insertaron y borraron **~105.000 ventas fantasma**. Patrón típico de un
  **test de estrés corrido contra la base de PRODUCCIÓN** (encaja con `test_stress.py`).
  ⚠️ Esto contradice la nota de arriba ("los tests no tocan producción"): al menos
  una corrida sí lo hizo.
- VACUUM recuperó el heap, pero **los índices no se achican con VACUUM** → quedan
  hinchados hasta un `REINDEX`.

### Proyección a 100 negocios/día
- Datos legítimos: ~9 KB/día por negocio → **~1 a 1.5 GB/año** con 100 negocios.
  En el disco de 40 GB sobra para años. El volumen de ventas no preocupa.
- El verdadero costo a escala es **tamaño y amplificación de escritura de los índices**
  + el bloat si hay churn (rollbacks, reintentos del outbox, tests).

### Plan de remediación — estado al 2026-06-24

Ejecutado sobre producción con backup previo (`pg_dump`) y verificando que el
conteo de filas de cada tabla quedó intacto. **Sin pérdida de datos.**

**P0 — ✅ HECHO**
1. ✅ **Stress tests blindados.** `conftest.py` ya forzaba SQLite (limpia
   `DATABASE_URL` antes de importar `main`). Se agregó un guard extra en
   `test_stress.py` que aborta si detecta una `DATABASE_URL` de Postgres (protege el
   caso de correrlo directo, sin pytest). Causa raíz del churn de 105k filas: se
   corrieron tests dentro del contenedor de prod **antes** de que existiera `conftest.py`.
2. ✅ **REINDEX.** `REINDEX TABLE CONCURRENTLY sales` (online, sin bloquear ventas).
   `sales`: **18 MB → 136 kB**. Base: **27 MB → 10 MB**.
3. ✅ **Autovacuum afinado** en `sales` y `stock_movements`
   (`autovacuum_vacuum_scale_factor=0.05`). Aplicado en vivo y agregado al esquema
   en `db.py` para deploys nuevos.

**P1 — parcial**
5/6. ✅ **Índice redundante eliminado.** Se dropeó `idx_sales_business_id` (lo cubre el
   compuesto `(business_id, timestamp)`) → un índice menos por escritura. **Corrección
   al plan original:** `idx_sales_timestamp` se MANTIENE (lo usan queries globales por
   fecha; en prod tiene 2945 usos). El índice de idempotencia NO es UNIQUE en la base
   real (la dedup es a nivel app) → no se tocó su semántica; el REINDEX ya le quitó el bloat.
4. ⏸️ **DIFERIDO — dinero en `float`.** Es un bug de correctitud real, PERO no es un
   cambio drop-in: pasar a `numeric` devuelve `Decimal` y rompería la serialización JSON
   actual (los modelos usan `float`), y en modo SQLite (offline) `NUMERIC` igual guarda
   float. Requiere refactor coordinado (centavos enteros end-to-end o manejo de Decimal)
   + tests. **No se hace en caliente.** Planificar en rama con suite de tests de plata.

**P2 — ⏸️ DIFERIDO (recomendado NO hacer ahora)**
7. `business_id` text → `uuid`. Tras el REINDEX los índices ya pesan 16 kB; el ahorro
   del tipo `uuid` es **insignificante con 3 negocios**, mientras que la migración es
   enorme (toca todas las tablas, FKs y TODO el código: JWT, contextvar, cada query).
   Riesgo alto, beneficio actual nulo. Reevaluar a varios miles de negocios, como
   migración planificada y testeada.

**P3 — ✅ HECHO**
8. ✅ Script de monitoreo en `ops/db_monitoring.sql` (tamaños, dead tuples, detección de
   churn anómalo, tamaño de índices de `sales`). Correr periódicamente. Pendiente de
   infra: alerta de disco vía cron (específica del VPS).

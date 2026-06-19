# Contexto del Proyecto: MiNegocio (POS & SaaS)

## 1. Visión General
**MiNegocio** (anteriormente NovaStock) es un sistema dual de Punto de Venta (POS) diseñado específicamente para kioscos y pequeños comercios en Argentina. 
Opera bajo un modelo híbrido:
1. **Modo Local (Offline):** Kioscos individuales corriendo el sistema en una PC local usando SQLite.
2. **Modo SaaS (Cloud):** Plataforma web multitenant donde los dueños pagan una suscripción para acceder desde cualquier lado, usando PostgreSQL.

El diseño prioriza la velocidad (atajos de teclado, sin recargas de página), la estética moderna ("Ocean Dark Palette" con colores azul marino y turquesa) y la resiliencia (sincronización en tiempo real).

---

## 2. Arquitectura Técnica

### Backend (Python / FastAPI)
- **Framework:** FastAPI.
- **Base de Datos:**
  - `aiosqlite` para el modo local offline.
  - `asyncpg` (PostgreSQL) para el entorno de producción en el VPS (SaaS).
- **Multi-tenant:** Implementado en la capa de datos. Todas las tablas principales (`products`, `sales`, `turns`, `operators`) tienen una columna `business_id`. Un middleware (`TenantMiddleware` en `main.py`) extrae el `business_id` del token JWT e inyecta el contexto en cada request usando `contextvars`.
- **Tiempo Real:** Se utiliza Server-Sent Events (SSE) vía `/api/events` para empujar notificaciones al frontend (ej. nuevas ventas, actualizaciones de stock).

### Frontend (React / Vite)
- **Framework:** React 18, empaquetado con Vite.
- **Estilos:** CSS puro (`index.css`) utilizando variables CSS nativas para el "Ocean Dark Theme". No se usa Tailwind.
- **Gestión de Estado y API:** Manejado casi íntegramente por un hook custom gigante (`useBackend.js`), el cual maneja:
  - Autenticación y refresh tokens.
  - Polling de salud (Health Check cada 5s).
  - Conexión SSE.
  - Almacenamiento en caché de catálogos y resumen de ventas del día (`resumenData`).

### Despliegue (Infraestructura)
- El entorno de producción actual se levanta con **Docker Compose** en un **VPS de Hetzner** (Ubuntu).
- Contenedores: `minegocio-frontend`, `minegocio-backend`, `minegocio-db` (Postgres).

---

## 3. Módulos Principales (Funcionalidad)

1. **Caja (POS / `CajaModule.jsx`):** 
   - Pantalla principal. Soporta escaneo rápido de códigos de barra y búsqueda manual.
   - **Cobro (`ChargeModal.jsx`):** Permite métodos de pago: Efectivo, Tarjeta (Débito/Crédito) y Transferencia. Muestra automáticamente el alias de transferencia configurado en los ajustes del negocio.
   - **Fiado:** Sistema robusto para anotar deudas a clientes de confianza.
   - **Turnos:** Sistema de cajas. Exige abrir turno (con saldo inicial) antes de vender y permite cerrar caja contando las diferencias.

2. **Inventario (`InventoryModule.jsx`):**
   - Alta/Baja/Modificación de productos.
   - Manejo de stock mínimo, alertas de "Stock Crítico".
   - Soporte para productos "Padre/Hijo" (ej. un pack de 6 cervezas que descuenta 6 unidades individuales).

3. **Compras (`PurchasesModule.jsx`):**
   - Gestión de facturas de proveedores y carga de mercadería.
   - Funcionalidad de IA (Lectura de facturas) bloqueada mediante paywall (requiere Plan IA).

4. **Reportes (`ReportsModule.jsx`):**
   - Resumen y gráficas de ventas, desglose por métodos de pago.
   - Ticket promedio, producto más vendido.
   - Modal de Resumen Diario en la UI principal.

5. **Configuración y Planes (SaaS):**
   - Soporta niveles de suscripción: Trial (7 días), Simple, Pro, IA.
   - Restricciones (Gates) en el backend (`check_plan_limits`) que limitan sucursales, auditoría o cantidades de productos según el plan.

---

## 4. Trabajo Reciente y Estado Actual

- **Pagos y UX:** Se deprecó un flujo inestable de código QR de Mercado Pago, reemplazándolo por una modalidad más robusta manual de "Tarjeta" y "Transferencia" (mostrando el alias).
- **Estabilidad de Base de Datos:** Se arreglaron errores de sintaxis exclusivos de PostgreSQL en el servidor de producción (como el uso de `date(timestamp)` que fallaba en Postgres pero andaba en SQLite, siendo reemplazado por `timestamp::date`).
- **Problemas de `GROUP BY`:** Se modificaron endpoints de reportes (`list_sales` en `sales.py`) usando subconsultas correlacionadas para evitar errores estrictos de agrupamiento (`GROUP BY`) en Postgres.
- **Sincronización:** Se arregló el hook `useBackend.js` para que el `resumenData` (el estado que nutre el popup de Resumen del Día) se actualice de forma correcta tanto en el polling de salud como por eventos SSE de ventas nuevas.

## 5. Reglas de Desarrollo Críticas

1. **Mantener la Compatibilidad SQL:** Todo nuevo endpoint debe funcionar **tanto en SQLite (para offline) como en PostgreSQL (para la nube)**. Se usan los bloques `if USE_PG: ... else: ...` en las rutas de FastAPI.
2. **Estética y Diseño:** El usuario (fundador) prioriza interfaces "Premium", oscuras, modernas, con bordes redondeados, desenfoques (backdrop-filter) y transiciones suaves. No usar estilos genéricos o de prototipo barato.
3. **Manejo de Errores:** Siempre mostrar mensajes claros en la UI si el backend falla. No tragar los errores con `.catch(() => {})`.
4. **Autenticación (JWT):** Toda ruta en el backend debe funcionar asumiendo el contexto multitenant (`business_id = _biz_id()`), excepto que sea la ruta pública de registro/login.

---

## 6. Respuestas Rápidas sobre el Estado Actual (Para Claude)

**Estado de los Blockers Anteriores:**
- **Autenticación y JWT:** ✅ **COMPLETADA.** Totalmente funcional usando `contextvars` para el `business_id`. El middleware `TenantMiddleware` lo gestiona, y el frontend (`apiClient.js`) hace el refresco de tokens en background sin molestar al usuario.
- **Webhooks de Mercado Pago:** ✅ **COMPLETADA.** Integrados en `backend/routers/billing.py`. Se reciben las notificaciones de pago (suscripciones), y actualizan el status en la BD de forma automática.
- **Plan gating (Restricciones):** ✅ **COMPLETADA.** La función `check_plan_limits()` en `main.py` dicta qué puede hacer cada negocio (límites de productos, sucursales, módulo de IA) y devuelve un `402 Payment Required` si no cumple.
- **Billing automation:** ✅ **COMPLETADA.** Funciona de fondo. Tareas asíncronas (`check_billing_grace_period` y `check_trial_emails`) suspenden cuentas vencidas luego del periodo de gracia y mandan alertas.

**Preguntas Puntuales para Acelerar:**
- **Siguiente blocker crítico:** Armar un **Panel Global de SuperAdmin** para poder gestionar los negocios suscritos al SaaS (ver quién se registró, editar sus planes manualmente a "Pro" de forma gratuita, métricas globales) sin tener que tocar la BD por consola. También la configuración del certificado SSL (HTTPS) en el servidor de producción (`mi-negocio.app`).
- **Necesidad de rutas/bugs/refactor:** Necesitamos construir la API y la UI de ese "Panel SuperAdmin", y asegurarnos de que la transición entre el Onboarding (Landing) y el inicio de sesión del POS sea lo más fluida y sin fricciones posible.
- **Estado del Frontend:** El core del POS (Caja, Reportes, Compras) está muy maduro, testeado y estable. Las features visuales pendientes están orientadas a laLanding Page de venta, el Panel de SuperAdmin, y el Onboarding final de los usuarios.

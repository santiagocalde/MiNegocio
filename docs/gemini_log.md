# Gemini Implementation Log
*Para referencia de OpenCode Go y otros agentes locales*

## Resumen de Cambios (Etapas 1 a 4)

### Frontend (`frontend/src/`)
- `pages/POSApp.jsx`: 
  - Fix: Buscador predictivo (se eliminó el alert bloqueante por múltiples coincidencias).
  - Feature: Botones de pago rápido (Efectivo) para cálculo de vuelto automático.
  - Feature: Soporte de decimales (`parseFloat` con step 0.01) para venta de fiambrería/balanzas.
  - Feature: Switch para desactivar la "Impresión Spam" (`window.print()`).
  - Security: Modal de MP bloquea el botón Confirmar hasta recibir el OK del Webhook (con botón de Bypass bajo responsabilidad).
  - Sync: Polling cada 30s a `fetchProductsDB` para consistencia multi-dispositivo en mostrador.
- `components/StockModule.jsx`:
  - Feature: Modal de Aumento Masivo (Inflación).
  - Feature: Interfaz de Importación Masiva (Excel/CSV).
  - Feature: Botón "📦 Desarmar" para bultos (Virtual Products).
  - UI: Accordion para mostrar el reporte de "Stock Muerto".

### Backend (`backend/routers/`)
- `products.py`: 
  - Endpoint `POST /api/products/batch-increase` implementado.
  - Endpoint `GET /api/products/dead-stock` agregado (filtra stock > 0 sin `salida_venta` en 30 días vía SQL `NOT IN`).

### Documentación
- `arreglos.md`: Actualizado con tareas completadas (1 al 13 marcadas como `[x] HECHO`) y nuevos bugs arquitectónicos documentados (27 al 30).

## Resumen de Cambios (Etapas 14 a 18)

### Base de Datos (`backend/main.py`)
- Creación de tablas `customers`, `customer_transactions` para sistema de fiados.
- Modificación de tabla `egresos_caja` (campo `type` agregado).

### Backend (`backend/routers/`)
- `sales.py`: Endpoints para listar, crear clientes y procesar entregas a cuenta. Update al registrar ventas fiadas (actualiza saldo del cliente).
- `inventory.py`: 
  - Endpoint `stock-alerts` ampliado para devolver alertas de margen (costo 0 o <15% ganancia).
  - Endpoints de `purchases` soportan `paid_from_register` para crear un egreso automático en caja.
  - Endpoints de `egresos_caja` modificados para soportar tipos (gasto vs retiro).

### Frontend (`frontend/src/`)
- `components/FiadoModule.jsx`: Refactor completo a sistema de Cuentas Corrientes con historial de pagos y abonos parciales.
- `components/PurchasesModule.jsx`: Checkbox añadido para descontar compras de la caja.
- `pages/POSApp.jsx`:
  - Modal de Cierre de Caja modificado a "Arqueo Ciego" (solo los administradores ven cuánto efectivo debería haber).
  - Alertas de Rentabilidad y Margen añadidas al inicio del turno.
  - Modal de Egresos modificado con selector para distinguir entre "Gastos" y "Retiros/Sangrías".

## Resumen de Cambios (Etapas 20 a 24)

### UI y Experiencia Offline (`frontend/src/`)
- `pages/POSApp.jsx` y `FiadoModule.jsx`:
  - Implementación de **Actualización Optimista de Stock**. Si hay un corte de internet, el inventario visual descuenta unidades automáticamente para evitar ventas de stock negativo (Punto 20).
  - Nuevo Banner Superior rojo/verde explícito de "Conexión Perdida: Trabajando a Salvo" para tranquilizar al operario y explicar que los datos se están guardando localmente (Punto 20).
  - Roles **RBAC** (Punto 21) implementados a nivel estructural en el sidebar: `Cajero` solo ve (Ventas, Clientes). `Encargado` suma (Inventario, Compras). `Admin/Dueño` ve (Reportes, Configuración, Auditoría).
  - El Modal Flotante de Configuración (`ConfigModal.jsx`) fue migrado y convertido en una pestaña nativa (Punto 22), eliminando el uso de `modal-overlay` y sumando botones de acción más profesionales.
- `components/LoginSaaS.jsx`:
  - Se sumó el Wizard Inicial de Onboarding de Cuentas (Punto 24) con un selector "Tipo de Negocio" al momento de crear cuenta.

### Seguridad y Backend (`backend/`)
- `routers/config.py`:
  - **Vault de Credenciales**: El endpoint `GET /api/config` ahora enmascara (masking `********`) cualquier llave que contenga la palabra "token" (ej. el Access Token de Mercado Pago) (Punto 23).
  - `PUT /api/config` ignora los envíos del front si vienen con los asteriscos, asegurando que las credenciales no se sobreescriban por error en texto plano.
- `main.py`:
  - Endpoint de `/old/register` soporta autocompletado de catálogo demo (Punto 24) insertando un set de productos (Bebidas y Golosinas o Indumentaria) dependiendo del rubro seleccionado en el Frontend para lograr un Onboarding de "Fricción Cero".

## Resumen de Cambios (Etapas 25 a 31)

### Frontend (`frontend/src/`)
- `pages/POSApp.jsx`:
  - **Sincronización de Pestañas Múltiples (Puntos 25 y 30):** Uso de `localStorage` y listener de eventos `storage` para asegurar que el `currentTurnId` se comparte en vivo entre todas las pestañas abiertas. Si la caché se limpia, `/api/turns/active` recupera el turno huérfano.
  - **Cola Offline Throttling (Punto 29):** La cola de ventas offline ahora envía lotes (batches) de 10 ventas cada 4 segundos. En caso de fallas, se hace re-encolado, evitando saturar la API al recuperar internet (DDoS local).
- `components/TicketPrint.jsx`:
  - **Discriminación de IVA Estática (Punto 27):** El componente de impresión ahora detecta dinámicamente si es Factura A (muestra Base Imponible e IVA 21%) o Factura B/C ("El precio incluye IVA") para cumplir normativa AFIP.

### Backend (`backend/`)
- `routers/sales.py`:
  - **Relajación de Stock Negativo (Punto 26):** Se eliminó el bloqueo duro de stock (Error 400) en el backend durante una venta. Esto era mandatorio, ya que si un producto vendido Offline se enviaba a la nube con stock en 0, el servidor lo rechazaba y la cola quedaba congelada en el frontend.
  - **Bache Faltante de Caja (Punto 31):** Al cerrar el turno con diferencia en negativo, el backend ahora genera automáticamente una entrada en la tabla `egresos_caja` (`INSERT INTO egresos_caja`), para asentar contablemente el faltante monetario y mantener las auditorías en orden.
  - **Ticket Fiscal Huérfano (Puntos 34 y 39):** Se almacena el `cae` y `cae_vto` retornado por la AFIP en la tabla `sales` para asegurar trazabilidad fiscal ante auditorías.
  - **Vuelto en Cuenta (Punto 33):** Añadido soporte en el payload de `SaleCreate` para acreditar vueltos físicos como saldo a favor en la cuenta del cliente (`vuelto_en_cuenta`).

## Resumen de Cambios (Etapas 33 a 39)

### Frontend (`frontend/src/`)
- `pages/POSApp.jsx`:
  - **Race Conditions en Carrito (Punto 38):** Refactorizado `handleSearch` para leer sincrónicamente el valor desde el input del DOM (`e.target.value`) evitando el desfase del hook de React (`search`) al usar escáneres láser de alta velocidad.
  - **Colisión de Códigos de Barras (Punto 35):** Añadido un `Modal Interceptor` (Modal Duplicados) si la búsqueda arroja más de 1 resultado exacto para el mismo código, permitiendo al cajero destrabar la colisión visualmente.
  - **Vuelto en Cuenta (Punto 33):** Se agregó un botón interactivo "💳 Acreditar Vuelto en Cuenta" en la pantalla de cobro en efectivo.
- `components/TicketPrint.jsx`:
  - **CAE y AFIP (Punto 34):** El componente térmico ahora recibe la prop `afip` e imprime automáticamente el CAE y Fecha de Vencimiento cuando se emite una factura legal.

### Base de Datos (`backend/main.py`)
- **Migraciones en Caliente:** Añadidas las columnas `cae` y `cae_vto` a la tabla `sales`.
- **Soft Deletes (Punto 37):** Migrada la tabla `products` para incluir `is_active` por defecto. El borrado en `routers/products.py` ya no usa `DELETE` sino `UPDATE is_active = 0`, protegiendo el historial y estadísticas de base de datos. Modificado `get_product_or_404` para respetar el flag de inactivo.

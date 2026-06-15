# 🏪 M i N e g o c i o   P O S   —   Viaje a Producción

## Documento maestro de implementación por etapas
### Proyecto: MiNegocio POS (ex-MiNegocio)
### Objetivo: Deploy a producción con sistema funcional, seguro, estético y conectado

---

## ÍNDICE

| Etapa | Nombre | Archivos | Prioridad |
|-------|--------|----------|-----------|
| 0 | Preparación | apiClient, Icons.jsx, constants.js | Crítico |
| 1 | Bugs Bloqueantes | 12 bugs que rompen funcionalidad | Crítico |
| 2 | Seguridad | 13 medidas de seguridad | Alto |
| 3 | APIs Desconectadas | 9 conexiones backend faltantes + 6 correcciones HTTP | Alto |
| 4 | Botones Muertos | 15 elementos (7 implementar, 6 sacar, 2 mejorar) | Medio |
| 5 | Estética | 16 pantallas rediseñadas con Ocean Dark | Medio |
| 6 | Consistencia | Nomenclatura, WhatsApp, precios, paleta unificada | Alto |
| 7 | Documentación | produccion.md + cambiosprodu.md | Alto |
| 8 | QA Final | Tests de humo en todos los flujos | Crítico |

---

# ETAPA 0 — Preparación

---

## 0.1 Agregar `apiPatch` al apiClient
**Archivo:** `frontend/src/services/apiClient.js`

Actualmente solo tiene: apiGet, apiPost, apiPut, apiDelete.
Agregar:
```js
export function apiPatch(path, body) {
  return request('PATCH', path, body);
}
```

## 0.2 Agregar todos los iconos SVG faltantes a Icons.jsx
**Archivo:** `frontend/src/components/ui/Icons.jsx`

Agregar los siguientes íconos (actualmente NO existen):
- CashIcon (billete para método de pago efectivo)
- CardIcon (tarjeta de crédito)
- BankIcon (banco/transferencia)
- QRIcon (código QR para MercadoPago)
- Store (tienda/sucursal)
- Chart (gráfico — para Aumento Masivo)
- Download (descarga — para Importar CSV)
- Wifi (conexión — para banner offline)
- Package (paquete/bulto — para Desarmar)
- File (documento — para sidebar fallback)
- HelpCircle (ayuda — para Soporte)
- MessageCircle (WhatsApp)
- Gift (regalo — para trial banner)
- Sun / Moon (tema claro/oscuro)
- Printer (impresora — para ticket)
- Activity (gráfico actividad)

## 0.3 Unificar constantes
**Archivo:** `frontend/src/utils/constants.js`

```js
export const WHATSAPP_NUMBER = '1144276384';
export const WHATSAPP_NUMBER_DISPLAY = '11 4427-6384';
export const WHATSAPP_LINK = (text) => `https://wa.me/5491144276384?text=${encodeURIComponent(text)}`;
export const BUSINESS_NAME = 'MiNegocio';
export const BUSINESS_EMAIL = 'upcodednow@gmail.com';
```

---

# ETAPA 1 — Bugs Bloqueantes (12 bugs)

---

## 1.1 Cierre de caja IMPOSIBLE
**Archivos:** `useAuth.js:24`, `CloseTurnModal.jsx:9`
**Problema:** `currentOperator` se construye sin campo `pin`. CloseTurnModal compara contra `undefined` → siempre "PIN incorrecto".
**Solución Frontend:**
- `useAuth.handlePin()`: guardar `{ id: data.operator_id, name: data.name, role: data.role }`
- `CloseTurnModal`: eliminar validación client-side. Enviar `{ turn_id, counted_cash, pin, operator_id }` al backend.
**Solución Backend:**
- `POST /api/login` (main.py): devolver `operator_id` en la respuesta.
- `PATCH /api/turns/{id}/close` (sales.py): recibir `operator_id` + `pin`, hacer bcrypt.compare contra `operators.pin`.

## 1.2 localStorage keys inconsistentes
**Archivos:** useAuth.js, PanelLayout.jsx, Onboarding.jsx, PreviewPage.jsx, LandingPage.jsx, useBackend.js, useSales.js
**Problema:** Se escriben `minegocio_*` pero se limpian `minegocio_*` (llaves que nadie escribe).
**Solución:** Reemplazo global en 7 archivos:
- `minegocio_current_operator` → `minegocio_current_operator`
- `minegocio_current_turn_id` → `minegocio_current_turn_id`
- `minegocio_pending_sales` → `minegocio_pending_sales`
- `minegocio_inventario_cache` → `minegocio_inventario_cache`
- `minegocio_cart` → ELIMINAR (nunca usado, solo se remueve)

## 1.3 Aumento Masivo roto — path incorrecto
**Archivos:** `StockModule.jsx:155`, `RecomendacionesModule.jsx:30`
**Problema:** Frontend llama `POST /api/products/bulk-increase`. Backend tiene `POST /api/products/batch-increase`.
**Solución:** Cambiar `bulk-increase` → `batch-increase` en ambos archivos.

## 1.4 Editar precio roto — método HTTP incorrecto
**Archivo:** `StockModule.jsx:424`
**Problema:** `apiPost('/products/{id}/price', ...)`. Backend espera `PATCH`.
**Solución:** `apiPost` → `apiPatch` (de la Etapa 0.1).

## 1.5 Desarmar bulto roto — endpoint no existe
**Archivos:** `StockModule.jsx:138`, `useBackend.js:57`
**Problema:** `POST /api/products/{id}/unpack` no existe en el backend.
**Solución:** Crear endpoint en `products.py`:
```python
@router.post("/api/products/{product_id}/unpack")
async def unpack_product(product_id: int, operator: str = Query("Sistema")) -> dict:
    # Lógica: si el producto es virtual, sumar stock al padre y restar del virtual
```

## 1.6 IDs negativos en Compras
**Archivo:** `PurchasesModule.jsx:154-158`
**Problema:** `quickAddCounter` empieza en 0, va a negativo. Items quick-add se envían como `product_id: 0`.
**Solución:** Usar `Date.now()` para IDs únicos positivos. `let quickAddCounter = Date.now();` y en vez de restar, sumar: `quickAddCounter += 1`.

## 1.7 Reversiones de venta rotas — método HTTP incorrecto
**Archivo:** `useBackend.js:67,86`
**Problema:** `apiPost` para revert y revert-item. Backend espera `PATCH`.
**Solución:** `apiPost` → `apiPatch` en ambos casos.

## 1.8 Contraseña del onboarding NUNCA persiste
**Archivo:** `PanelLayout.jsx:44-53`
**Problema:** `handlePasswordSubmit` muestra éxito pero no envía al backend.
**Solución:** Llamar `PUT /api/operators` actualizando el PIN (bcrypt) del operador admin. Usar `apiPut` con el array de operadores actualizado.

## 1.9 Monto inicial de caja NUNCA persiste
**Archivo:** `PanelLayout.jsx:40-43`
**Problema:** `handleCajaSubmit` descarta el monto.
**Solución:** Llamar `POST /api/turns` con `{ initial_cash: parseFloat(initialCajaMonto), operator_id: auth.currentOperator.id }`.

## 1.10 4 iconos undefined en StockModule — crashea la UI
**Archivo:** `StockModule.jsx` (objeto Icons local, líneas 18-39 aproximadamente)
**Problema:** `Icons.Chart`, `Icons.Download`, `Icons.Wifi`, `Icons.Package` no existen en el objeto local.
**Solución:** Agregar definiciones SVG para cada uno. O importar del Icons.jsx compartido y usar `<Icons.Chart />` etc.

## 1.11 Catálogo Web — WhatsApp sin número
**Archivo:** `PublicCatalog.jsx:68`
**Problema:** `https://wa.me/?text=...` sin número.
**Solución:** Usar `WHATSAPP_LINK(orderText)` de constants.js.

## 1.12 IDs fake en carrito — Date.now() como product_id
**Archivo:** `useCart.js:31`
**Problema:** Producto no encontrado en DB → se crea con `id: Date.now()`. Ese ID se envía al backend.
**Solución:** Si no existe en DB, mostrar toast "Producto no encontrado" y NO agregar al carrito.

## 1.13 Auditoría siempre tira error
**Archivo:** `AuditModule.jsx:56-58`
**Problema:** Mensaje genérico "Error al cargar auditoría. Verificar conexión". No muestra causa real.
**Posible causa:** Backend no corriendo en el puerto esperado, o error en `/api/movements`.
**Solución:** 
- Agregar `console.error` del error real
- Implementar `EmptyState` component cuando no hay datos
- Si hay error: mostrar mensaje específico + botón "Reintentar"

---

# ETAPA 2 — Seguridad (13 medidas)

---

## 2.1 Validar PIN server-side en cierre de caja
**Backend** (`sales.py`): `PATCH /api/turns/{id}/close` ya recibe PIN. Agregar bcrypt.compare del PIN contra el operador asociado.
**Frontend** (`CloseTurnModal.jsx`): Eliminar `closeCajaPin !== currentOperator.pin?.toString()`. Solo enviar al backend.

## 2.2 Guardar `operator_id` en currentOperator
**Backend** (`main.py`): `POST /api/login` debe devolver `operator_id` en la respuesta JSON.
**Frontend** (`useAuth.js`): Guardar `{ id: data.operator_id, name: data.name, role: data.role }`.

## 2.3 Unificar localStorage keys a `minegocio_*`
Ver detalle en 1.2. Reemplazo global en 7 archivos.

## 2.4 Resend API key → variable de entorno
**Archivo:** `system.py:627`
- Hardcodeado: `resend_api_key = "re_WBmBW8uW_GL1Vh6LKfhQqzzbeoMzvHBz7"`
- Cambiar a: `resend_api_key = os.getenv("RESEND_API_KEY", "")`
- Si no hay key, loggear warning y devolver error informativo
- Agregar `RESEND_API_KEY=` a `.env.example`

## 2.5 Rate limiting extendido
**Archivo:** `auth.py`
Agregar `@auth_limiter.limit` a:
- `POST /api/auth/register` → 3/minuto
- `POST /api/auth/reset-password` → 3/15minutos
- `POST /api/auth/forgot-password` → ya tiene 3/15min ✓
- `POST /api/auth/login` → ya tiene 5/min ✓
**Archivo:** `main.py`
- `POST /api/login` (PIN) → 5/minuto (bajar de 10)
- `POST /api/setup/init` → 1/minuto
- `PUT /api/operators` → 10/minuto

## 2.6 Validar formato de PIN en backend
**Archivos:** `main.py` (POST /login), `system.py` (POST /setup/init)
- Validar que el PIN tenga entre 4 y 6 dígitos numéricos
- Si no cumple → HTTP 400 "El PIN debe tener entre 4 y 6 dígitos numéricos"

## 2.7 Reemplazar `alert()` por `addToast()` en useAuth
**Archivo:** `useAuth.js:33,37`
- `alert('PIN incorrecto')` → `addToast('PIN incorrecto', 'error')`
- `alert('Error de conexión con el servidor')` → `addToast('Error de conexión', 'error')`
- Pasar `addToast` como parámetro al hook useAuth

## 2.8 Security headers en FastAPI
**Archivo:** `main.py`
Agregar middleware:
```python
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if os.getenv("APP_ENV") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

## 2.9 Enmascarar MP access token en ConfigPage
**Archivo:** `ConfigPage.jsx`
- Campo `mp_access_token`: cambiar `type="text"` → `type="password"` con botón toggle mostrar/ocultar

## 2.10 Validar refresh token contra DB
**Archivo:** `auth.py:217` (`POST /api/auth/refresh`)
- Actualmente solo decodifica JWT, no verifica existencia en DB
- Agregar: `SELECT FROM auth_tokens WHERE token = $1 AND expires_at > now()`
- Si no existe → HTTP 401 "Token revocado o expirado"

## 2.11 Token blacklist en logout
**Archivo:** `auth.py` (nuevo endpoint)
- Crear `POST /api/auth/logout`
- Marcar refresh token como `revoked = TRUE` en `auth_tokens`
- Frontend: llamar a este endpoint al hacer logout

## 2.12 No almacenar plan en JWT claims
**Archivos:** `auth.py`, `main.py`
- El claim `plan` en el JWT puede divergir de la DB si el usuario hace upgrade
- `get_current_business()` debe re-leer el plan de la DB (PG), no del JWT
- Quitar `"plan": biz_plan` del payload del JWT

## 2.13 CORS restrictivo para producción
**Archivo:** `main.py:262-265`
- Actualmente solo permite `localhost:5175`, `localhost:3000` y `http://localhost:8005`
- Agregar variable de entorno `ALLOWED_ORIGINS` para producción
- En desarrollo: localhost. En producción: dominio configurado.

---

# ETAPA 3 — APIs Desconectadas

---

## 3.1 Onboarding modals → Backend

### Modal "Abrir mi caja"
**Archivo:** `PanelLayout.jsx:40-43`
- Llamar `POST /api/turns` con `{ initial_cash: parseFloat(initialCajaMonto), operator_id: auth.currentOperator?.id }`
- Si falla → mostrar error, permitir reintentar

### Modal "Crear Contraseña"
**Archivo:** `PanelLayout.jsx:44-53`
- Llamar `PUT /api/operators` con el array de operadores, actualizando el PIN del admin con bcrypt
- Si falla → mostrar error

## 3.2 AI Scanner → `POST /api/ai/scan-invoice`
**Archivo:** `PurchasesModule.jsx:AIScannerModal`
**Backend YA existe:** `ai.py:POST /api/ai/scan-invoice`
**Cambios:**
- Reemplazar `simulateScan()` por `<input type="file" accept="image/*" capture="environment">` real
- Enviar con `FormData` al endpoint
- Mostrar loading spinner mientras procesa
- Mostrar resultados reales del backend (productos detectados, cantidades, costos)

## 3.3 PublicCatalog → `GET /api/catalogo`
**Archivo:** `PublicCatalog.jsx:22-33`
**Backend YA existe:** `products.py:368 GET /api/catalogo`
**Cambios:**
- Reemplazar 6 productos fake con `setTimeout` por fetch real al endpoint
- Pasar `slug` del URL como parámetro
- Mantener fallback a datos mock si el endpoint falla

## 3.4 PlanPage → `GET /api/plans`
**Archivo:** `PlanPage.jsx:6-37`
**Backend YA existe:** `system.py:GET /api/plans`
**Cambios:**
- Eliminar array hardcodeado `PLANS`
- Fetch al montar con `useEffect`
- Fallback a datos mock si falla
- **Precios unificados** con landing: Simple $20K, Pro $30K, IA $40K
- **Eliminar plan "Básico"** ($0) — no existe en landing ni backend. Solo estaba en PlanPage.

## 3.5 Recomendaciones → APIs reales
**Archivo:** `RecomendacionesModule.jsx`
**Backend YA existen:**
- `GET /api/products/price-suggestions?threshold_pct=15` (products.py)
- `GET /api/products/dead-stock?days=30` (products.py)
**Cambios:**
- Reemplazar panel fake derecho ("Ola de frío", "Chicles Beldent", "45 unidades estancadas") con datos reales
- `handleApplyPrices`: enviar los precios sugeridos reales del backend, no `{ percentage: 0 }`

## 3.6 CierresAnterioresModal → `GET /api/turns`
**Archivo:** `CierresAnterioresModal.jsx`
**Backend YA existe:** `sales.py:108 GET /api/turns`
**Cambios:**
- Conectar a endpoint real con paginación (`?limit=30`)
- Agregar export CSV de cierres

## 3.7 ResumenModal — corregir cálculo "Efectivo en Caja"
**Archivos:** `ResumenModal.jsx:14`, `sales.py:260`
**Problema:** `total_vendido - total_fiado` asume que todo no-fiado es efectivo. Pero hay tarjeta, MP, transferencia.
**Solución Backend:** `GET /api/sales/today` debe devolver desglose por método de pago (`total_efectivo`, `total_tarjeta`, `total_mp`, `total_transferencia`).
**Solución Frontend:** Usar `resumenData.total_efectivo` para el campo "Efectivo en Caja".

## 3.8 Endpoints no usados que deben conectarse
| Endpoint | Conectar en | Qué implementar |
|----------|-------------|-----------------|
| `POST /api/customers` | FiadoModule | Botón "+ Nuevo Cliente" → modal con nombre, teléfono |
| `DELETE /api/products/{id}` | StockModule | Botón "Eliminar" con soft-delete + ConfirmModal |
| `GET /api/turns/active` | PanelContext | Al cargar, si no hay turn_id activo, preguntar al backend si hay turno huérfano |
| `POST /api/auth/refresh` | apiClient.js | Interceptor 401 → intentar refresh → reintentar request original |
| `GET /api/catalogo` | CatalogoModule | Panel derecho: analytics, visitas, productos más vistos |
| `GET /api/stock-alerts` | StockModule | Migrar alertas de client-side a server-side |

## 3.9 Correcciones de método HTTP y paths (6 endpoints)
| Frontend llama | Backend espera | Corrección |
|----------------|----------------|------------|
| `apiPost('/products/bulk-increase')` | `POST /api/products/batch-increase` | Cambiar path |
| `apiPost('/products/{id}/price')` | `PATCH /api/products/{id}/price` | `apiPost` → `apiPatch` |
| `apiPost('/products/{id}/unpack')` | NO EXISTE | Crear endpoint (ver 1.5) |
| `apiPost('/sales/{id}/revert-item')` | `PATCH /api/sales/{id}/revert-item` | `apiPost` → `apiPatch` |
| `apiPost('/sales/{id}/revert')` | `PATCH /api/sales/{id}/revert` | `apiPost` → `apiPatch` |
| `apiGet('/sales?date_from=&date_to=&sucursal_id=')` | Solo acepta `limit` | Agregar filtros al backend (sales.py) |

---

# ETAPA 4 — Botones Muertos (15 elementos)

---

## 4.1 StockModule "Filtros" → IMPLEMENTAR
**Archivo:** `StockModule.jsx:355`
**Actualmente:** `alert('Próximamente: Panel de Filtros Avanzados')`
**Implementar:** Dropdown con opciones:
- Filtrar por categoría (select de categorías del backend)
- Filtrar por rango de precio (min/max)
- Stock > 0 / Stock = 0 / Stock bajo mínimo
- Filtrar por proveedor

## 4.2 StockModule Trash (near-expiry accordion) → IMPLEMENTAR
**Archivo:** `StockModule.jsx:294`
**Actualmente:** Sin onClick, decorativo
**Implementar:** `onClick={() => handleDeleteProduct(p.id)}` con ConfirmModal "¿Eliminar este producto?" → soft-delete vía `DELETE /api/products/{id}`

## 4.3 Compras "... Acciones" toolbar → SACAR
**Archivo:** `PurchasesModule.jsx:248`
**Actualmente:** Sin onClick
**Acción:** Eliminar el botón del JSX.

## 4.4 Compras "Ver Detalle" por fila → IMPLEMENTAR
**Archivo:** `PurchasesModule.jsx:291`
**Actualmente:** Sin onClick, icono Search incorrecto
**Implementar:** Modal con detalle de compra:
- Fecha, proveedor, número de factura
- Tabla de items: producto, cantidad, costo unitario, subtotal
- Total de la compra

## 4.5 Proveedores "Historial" → IMPLEMENTAR
**Archivo:** `ProveedoresModule.jsx:93`
**Actualmente:** Toast placeholder
**Implementar:** Llamar `GET /api/purchases?supplier_id=X` (agregar filtro al backend). Mostrar en modal/tabla.

## 4.6 Proveedores "Abonar" → IMPLEMENTAR
**Archivo:** `ProveedoresModule.jsx:94`
**Actualmente:** Toast placeholder
**Implementar:** Modal de egreso con tipo "pago_proveedor". Monto, motivo, fecha. Llama `POST /api/egresos`.

## 4.7 Reportes "Filtros" → IMPLEMENTAR
**Archivo:** `ReportsModule.jsx:109`
**Actualmente:** Sin onClick
**Implementar:** Filtro por:
- Fecha desde / hasta (date inputs)
- Sucursal (si multi-sucursal activo)
- Método de pago (efectivo, tarjeta, MP, transferencia)

## 4.8 Reportes "···" tres puntitos (header) → SACAR
**Archivo:** `ReportsModule.jsx:123`
**Actualmente:** Sin onClick
**Acción:** Eliminar el botón del JSX.

## 4.9 Reportes "... Acciones" toolbar → SACAR
**Archivo:** `ReportsModule.jsx:200`
**Actualmente:** Sin onClick
**Acción:** Eliminar el botón del JSX.

## 4.10 Reportes checkboxes (header + filas) → SACAR
**Archivo:** `ReportsModule.jsx:214,230`
**Actualmente:** Sin onChange, decorativos
**Acción:** Eliminar todos los checkboxes del JSX.

## 4.11 Reportes "..." columna acciones → SACAR
**Archivo:** `ReportsModule.jsx:250`
**Actualmente:** Texto "..." decorativo
**Acción:** Eliminar la columna entera de la tabla.

## 4.12 Recomendaciones "Armar Promo 2x1 (IA)" → IMPLEMENTAR
**Archivo:** `RecomendacionesModule.jsx:150`
**Actualmente:** Sin onClick
**Implementar:** Al hacer click, sugerir crear una promoción automática para productos sin rotación. Llamar `POST /api/promotions` con los productos seleccionados y un descuento sugerido por IA.

## 4.13 TopBar "Tutorial" → IMPLEMENTAR
**Archivo:** `TopBar.jsx:20`
**Actualmente:** Toast placeholder
**Implementar:** Modal simple con 3 pasos numerados:
1. 🔍 Buscá un producto por nombre o escaneá el código de barras
2. 💵 Seleccioná el método de pago y cobrá
3. 🔒 Al final del día, cerrá la caja desde el panel lateral
Cada paso con una breve descripción y un ícono.

## 4.14 TopBar "Ayuda" → IMPLEMENTAR
**Archivo:** `TopBar.jsx:26`
**Actualmente:** Toast placeholder
**Implementar:** Abrir `HelpModal` existente (o crearlo si no existe). Con atajos de teclado, FAQ rápido, y link a WhatsApp de soporte.

## 4.15 TopBar "Tema" → MEJORAR
**Archivo:** `TopBar.jsx:23`
**Actualmente:** Toggle clase CSS sin persistencia
**Implementar:** Guardar preferencia en `localStorage`. Al cargar, leer preferencia. Usar `<Icons.Sun />` / `<Icons.Moon />`.

---

# ETAPA 5 — Estética Ocean Dark (16 pantallas)

---

Principio rector: **Cero emojis. Todo SVG de Icons.jsx. Paleta Ocean Dark unificada. Botones compactos (max-width 220px, height 40px). El sidebar izquierdo NO se toca.**

Paleta:
```
--bg-main: #0B132B
--bg-card: #121E36
--border: rgba(255,255,255,0.06)
--accent: #14BBA6 (primary), #0F8A7D (secondary), #00E5FF (highlight)
--success: #10b981, --danger: #ef4444, --warning: #f59e0b
--text: #ffffff, --text-muted: rgba(230,255,251,0.7)
--font-display: Outfit, --font-body: Inter, --font-mono: JetBrains Mono
```

---

## 5.1 FiadoModule (Clientes) — Rediseño completo
- Header: título "Clientes" (Outfit 800), botón "+ Nuevo Cliente" (compacto, 40px alto, max-width 200px)
- Loading: `SkeletonCard` con 3 cards
- Empty: `EmptyState` con ícono Users, "No hay clientes con cuentas corrientes"
- Cards `lp-glass` por cliente: nombre + balance. Click expande → transacciones
- Botón "Recibir Pago" (ícono CashIcon + texto)
- Modal pago: "Saldar Todo" + "Confirmar Pago"
- Modal nuevo cliente: nombre, teléfono

## 5.2 ProveedoresModule — Compactación
- Botón "Nuevo Proveedor": max-width 200px, padding reducido
- Loading: `SkeletonCard`
- Empty: `EmptyState` "Sin proveedores registrados"
- Cards `lp-glass` con nombre, contacto, teléfono
- Acciones funcionales: "Historial" y "Abonar"

## 5.3 PurchasesModule (Compras) — Limpieza
- **Vista historial:** Tabla con columnas útiles. Sin botones muertos.
- **Vista carga:** Formulario compacto. Buscar + agregar items + total.
- **AI Scanner:** Input file real. Zona drag & drop con ícono Camera. Loading spinner + "Analizando factura..."
- Sin "... Acciones". Sin "Ver Detalle" sin funcionalidad.

## 5.4 Promociones — Compactación
- Cards `lp-glass` por promoción con toggle activar/desactivar
- Botón "Nueva Promoción" compacto (max-width 200px)
- Modal crear/editar con todos los campos necesarios
- ConfirmModal antes de eliminar
- addToast en todas las operaciones

## 5.5 Reportes — Limpieza de elementos muertos
- Header: título, date pickers, botón export
- Tabla limpia: sin checkboxes, sin columna acciones falsa
- Corregir typo "Talo Transferencia" → "Transferencia"
- Datos reales del backend (no hardcodeados)

## 5.6 Recomendaciones — Datos reales
- Panel izquierdo: tabla de sugerencias de precio reales
- Panel derecho: productos sin rotación con valor real de capital inmovilizado
- Botón "Aplicar Precios Sugeridos" funcional
- Botón "Armar Promo 2x1 (IA)" funcional
- Loading: `SkeletonTable` + `SkeletonCard`

## 5.7 Auditoría — Fix del error
- `EmptyState` cuando no hay datos
- Mensaje de error específico + botón "Reintentar"
- Filtro por tipo funcional
- Filtro por fecha
- Buscador funcional

## 5.8 Catálogo Web — Completar
- Loading: `SkeletonCard`
- Panel derecho: QR del catálogo, link copiable, compartir WhatsApp
- Toggle con feedback visual inmediato

## 5.9 Soporte (panel) — Quitar emojis
- ❓ → `<Icons.HelpCircle />`
- 💬 → `<Icons.MessageCircle />`
- ⭐ → `<Icons.Star />`
- 📅 → `<Icons.Calendar />`
- 🔒 → `<Icons.Lock />`
- WhatsApp button → gradiente primario (no verde #25D366)
- FAQ: fetch desde backend o constants (no hardcodeado en JSX)

## 5.10 ChargeModal — Iconos en vez de emojis
- 💵 → `<Icons.CashIcon />`
- 💳 → `<Icons.CardIcon />`
- 🏦 → `<Icons.BankIcon />`
- 🧉 → `<Icons.QRIcon />`
- ✕ (cerrar) → `<Icons.X />`
- 🖨️ → `<Icons.Printer />`

## 5.11 ResumenModal + CierresAnterioresModal
- 📊 → `<Icons.Activity />`
- 🖨️ → `<Icons.Printer />`
- 📋 → `<Icons.Clipboard />`
- ✅ → `<Icons.CheckCircle />`
- ❌ → `<Icons.XCircle />`
- Export CSV de cierres
- Paginación en cierres anteriores

## 5.12 ConfigPage — Simplificar operadores
- Sección "Datos del Negocio" → mantener igual
- Sección "Operadores":
  - Mostrar lista con nombre + rol
  - Botón "+ Operador" (modal: nombre, PIN 4 dígitos, rol)
  - Botón eliminar con confirmación
  - PIN `type="password"`
- Sección "Mercado Pago": token `type="password"` con toggle

## 5.13 TopBar
- 🏪 sucursal → `<Icons.Store />`
- "Tutorial" → modal 3 pasos
- "Ayuda" → HelpModal
- Tema → toggle con persistencia localStorage

## 5.14 Sidebar — Mínimos ajustes
- 📄 fallback → `<Icons.File />`
- Badge "Pendientes" → mantener, diseño Ocean Dark
- "Mi Caja" → verificar turno real

## 5.15 PlanPage — Unificar con landing
- Mismos 3 planes (Simple, Pro, IA)
- Mismos precios ($20K, $30K, $40K)
- Mismas features
- Mismo diseño `lp-glass`
- Sin emoji 🎁 → `<Icons.Gift />`

## 5.16 Botones "anchos" — Normalizar
**Regla general para TODOS los botones de acción en headers:**
- `max-width: 200px`
- `height: 40px`
- `font-size: 0.9rem`
- `font-weight: 700`
- `border-radius: 8px`
- Alineados a la derecha en el header

---

# ETAPA 6 — Consistencia Global

---

## 6.1 Nomenclatura: cero `minegocio`, todo `minegocio`
Reemplazo global en TODOS los archivos del proyecto:
- `minegocio_current_operator` → `minegocio_current_operator`
- `minegocio_current_turn_id` → `minegocio_current_turn_id`
- `minegocio_pending_sales` → `minegocio_pending_sales`
- `minegocio_inventario_cache` → `minegocio_inventario_cache`
- `MiNegocio` → `MiNegocio` en logs, comentarios, títulos, README
- `minegocio.db` → `minegocio.db`
- `minegocio_*.db` → `minegocio_*.db`
- `saas_token`, `saas_business`, `saas_mode` → mantener (son SaaS layer, no kiosco)

## 6.2 WhatsApp unificado
Todo el código usa las constantes de `constants.js`:
```js
WHATSAPP_NUMBER = '1144276384'
WHATSAPP_NUMBER_DISPLAY = '11 4427-6384'
WHATSAPP_LINK = (text) => `https://wa.me/5491144276384?text=${encodeURIComponent(text)}`
```
Cero números hardcodeados en JSX.

## 6.3 Precios de planes unificados
Fuente canónica: tabla `plans` en PostgreSQL.
Consumidos vía `GET /api/plans` tanto por LandingPricing como por PlanPage.

| Plan | Mensual | Anual | Productos | Usuarios |
|------|---------|-------|-----------|----------|
| Simple | $20.000 | $200.000 | 3.500 | 2 |
| Pro | $30.000 | $300.000 | 7.000 | 5 |
| IA | $40.000 | $400.000 | 10.000 | 10 |

## 6.4 Paleta de colores unificada
Usar variables CSS en TODO el código. No usar colores hardcodeados (#25D366, #10b981, etc.).

## 6.5 Iconos unificados
Todo desde `components/ui/Icons.jsx`. Cero emojis en producción.

## 6.6 Errores unificados
- Errores de validación: `addToast('mensaje', 'error')`
- Errores de red: `addToast('Error de conexión. Verificá tu internet.', 'error')`
- Éxito: `addToast('mensaje', 'success')`
- Info: `addToast('mensaje', 'info')`
- NUNCA usar `alert()` en producción.

---

# ETAPA 7 — Documentación

---

## 7.1 Crear `produccion.md`
Documento con:
- Arquitectura multi-tenant (database-per-tenant)
- Flujo de registro y trial de 7 días
- Límites por plan y su enforcement
- Backup y disaster recovery
- Monitoreo y alertas
- Estrategia de escalamiento VPS
- Seguridad en producción
- Manejo de datos de clientes (PG → businesses, SQLite → tenant data)

## 7.2 Actualizar `cambiosprodu.md`
Agregar al final las APIs pendientes que requieren keys externas:
- Mercado Pago (MP_ACCESS_TOKEN, MP_COLLECTOR_ID)
- Resend (RESEND_API_KEY para emails)
- Google AI / Gemini (GOOGLE_AI_API_KEY para escáner)
- AFIP/ARCA (certificados .crt/.key)
- Dominio y SSL
- Métricas y testimonios (endpoints creados, datos se pueblan solos)
- Vault de certificados

---

# ETAPA 8 — QA Final

---

## 8.1 Tests de humo por flujo

### Flujo A: Nuevo usuario completo
1. Landing → click "Probar Gratis" → Onboarding 9 pasos → `POST /api/auth/register` → token guardado
2. Redirect a `/panel` → PIN login → `POST /api/login` → turno abierto
3. Onboarding modals: "Abrir mi caja" → `POST /api/turns` con initial_cash
4. "Crear Contraseña" → `PUT /api/operators` con PIN hasheado
5. Panel carga: productos, config, operadores, sucursales
6. Primera venta: buscar producto → agregar → cobrar → `POST /api/sales` → ticket
7. Cierre de caja: contar efectivo → ingresar PIN → `PATCH /api/turns/{id}/close` → reporte

### Flujo B: Usuario existente
1. Landing → "Iniciar Sesión" → email + password → `POST /api/auth/login`
2. Redirect panel → PIN → turno abierto (o recuperado vía `/turns/active`)
3. Ventas del día con múltiples métodos de pago
4. Cierre de caja normal

### Flujo C: Offline → Online
1. Iniciar venta con internet
2. Cortar internet (desconectar WiFi)
3. Completar venta → sale se guarda en localStorage como pendiente
4. Reconectar → auto-sync procesa pendientes → SSE reconecta

### Flujo D: Trial expiry
1. Crear cuenta trial, avanzar fecha +8 días
2. Login → banner rojo "Trial expirado"
3. Intentar crear producto #51 → HTTP 402 bloqueado
4. Ir a PlanPage → elegir plan → (mientras tanto, link a WhatsApp)

### Flujo E: Multi-caja
1. Dos navegadores, mismo negocio, distintos operadores
2. Ambos venden → stock se actualiza vía SSE
3. Cierre de caja independiente por operador (verificar que todaySalesTotal no mezcla cajas)

## 8.2 Verificaciones de seguridad
- [ ] JWT expirado → 401 → no se puede acceder al panel
- [ ] PIN incorrecto 5 veces → rate limit activado
- [ ] Forgot password 3 veces en 15min → rate limit
- [ ] Token de refresh revocado → no renueva
- [ ] Intentar acceder a tenant ajeno → 403/404
- [ ] Producto #51 en trial → 402 bloqueado

## 8.3 Verificaciones de UI
- [ ] Cero emojis en todo el sistema
- [ ] Todos los botones funcionales (ninguno muerto)
- [ ] Todos los iconos renderizan correctamente (sin undefined)
- [ ] Paleta de colores consistente en todas las pantallas
- [ ] Loading states con Skeleton en todas las pantallas
- [ ] Empty states con EmptyState component
- [ ] Errores con toast, no con alert()
- [ ] Botones compactos (max-width 200px en headers)

---

## RESUMEN DE ARCHIVOS

| # | Archivo | Etapas |
|---|---------|--------|
| 1 | `apiClient.js` | 0.1, 3.8 |
| 2 | `Icons.jsx` | 0.2, 5.10, 6.5 |
| 3 | `constants.js` | 0.3, 6.2 |
| 4 | `useAuth.js` | 1.1, 1.2, 2.2, 2.7, 6.1 |
| 5 | `CloseTurnModal.jsx` | 1.1, 2.1, 6.1 |
| 6 | `PanelLayout.jsx` | 1.2, 1.8, 1.9, 3.1, 6.1 |
| 7 | `PanelContext.jsx` | 1.2, 3.8, 6.1 |
| 8 | `Onboarding.jsx` | 1.2, 6.1 |
| 9 | `PreviewPage.jsx` | 1.2, 6.1 |
| 10 | `LandingPage.jsx` | 1.2, 6.1 |
| 11 | `useBackend.js` | 1.2, 1.5, 1.7, 6.1 |
| 12 | `useSales.js` | 1.2, 6.1 |
| 13 | `useCart.js` | 1.12 |
| 14 | `StockModule.jsx` | 1.3, 1.4, 1.5, 1.10, 3.8, 4.1, 4.2 |
| 15 | `RecomendacionesModule.jsx` | 1.3, 3.5, 4.12, 5.6 |
| 16 | `PurchasesModule.jsx` | 1.6, 3.2, 4.3, 4.4, 5.3 |
| 17 | `PublicCatalog.jsx` | 1.11, 3.3 |
| 18 | `AuditModule.jsx` | 1.13, 5.7 |
| 19 | `PlanPage.jsx` | 3.4, 5.15, 6.3 |
| 20 | `LandingPricing.jsx` | 6.3 |
| 21 | `CierresAnterioresModal.jsx` | 3.6, 5.11 |
| 22 | `ResumenModal.jsx` | 3.7, 5.11 |
| 23 | `FiadoModule.jsx` | 3.8, 5.1 |
| 24 | `CatalogoModule.jsx` | 3.8, 5.8 |
| 25 | `ProveedoresModule.jsx` | 4.5, 4.6, 5.2 |
| 26 | `ReportsModule.jsx` | 4.7-4.11, 5.5 |
| 27 | `PromotionModule.jsx` | 5.4 |
| 28 | `SoportePage.jsx` | 5.9 |
| 29 | `ChargeModal.jsx` | 5.10 |
| 30 | `TopBar.jsx` | 4.13-4.15, 5.13 |
| 31 | `Sidebar.jsx` | 5.14 |
| 32 | `ConfigPage.jsx` | 2.9, 5.12 |
| 33 | `auth.py` | 1.1, 2.5, 2.6, 2.10, 2.11, 2.12 |
| 34 | `sales.py` | 1.1, 2.1, 3.7, 3.9 |
| 35 | `products.py` | 1.5, 3.8, 3.9 |
| 36 | `inventory.py` | 1.7, 3.9 |
| 37 | `main.py` | 2.2, 2.5, 2.6, 2.8, 2.12, 2.13 |
| 38 | `system.py` | 2.4, 2.6 |
| 39 | `.env.example` | 2.4 |
| 40 | `cambiosprodu.md` | 7.2 |
| 41 | `produccion.md` | 7.1 (NUEVO) |
| 42 | `viajeproduccion.md` | ESTE DOCUMENTO |

---

*Documento generado el 13/06/2026 — Plan maestro completo para deploy a producción de MiNegocio POS v2.0*

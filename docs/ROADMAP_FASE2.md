# 🚀 Roadmap Fase 2: Escalamiento y Operaciones Complejas (NovaStock)

Este documento define la hoja de ruta estratégica para evolucionar NovaStock desde un POS de misión crítica (Fase 1 completada) hacia un sistema completo de gestión de inventario, compras y telemetría en la nube para kioscos y minimercados.

## 📊 Matriz de Prioridad y Ejecución

| Módulo | Prioridad | Complejidad | Dependencias | Impacto |
| :--- | :---: | :---: | :--- | :--- |
| **Categorías** | ⚡ Alta | 🟢 Fácil | Ninguna | Foundation para Aumento Inteligente |
| **Aumento Inteligente** | ⚡ Alta | 🟢 Fácil | Categorías | Operación diaria simplificada |
| **Bultos vs Unidades** | ⚡ Alta | 🟡 Medio | Categorías | Resuelve dolor real #1 |
| **Compras/Proveedores** | 🟡 Media | 🔴 Pesada | Bultos vs Unidades | Operación diaria eficiente |
| **Sincronización Nube** | 🟡 Media | 🔴 Pesada | Ninguna (parallelizable) | Don Julio en el café |
| **Carga de Facturas (IA)**| ⚡ Alta | 🔴 Pesada | Compras/Proveedores | Automatización extrema |
| **Sugerencias Precio (IA)**| 🟡 Media | 🟡 Medio | Sincronización Nube | Maximización de margen |
| **Facturación AFIP** | 🟡 Media | 🔴 Pesada | Bultos vs Unidades | Estandarización legal |

---

## 💼 Modelo de Negocio Híbrido (SaaS Premium)

Para competir con sistemas modernos y escalar comercialmente, NovaStock implementará un modelo de monetización híbrido:
1. **Core Offline (Gratis/Licencia Única):** Punto de venta veloz, inventario local, carrito ghost, resistente a cortes de internet. El kiosco no para nunca.
2. **NovaStock PRO (Suscripción Mensual/Anual):** Cancelable en cualquier momento. Requiere internet. Desbloquea:
   - Carga de facturas por IA (Foto a Stock).
   - Sugerencias de precios basadas en mercado.
   - Facturación electrónica AFIP.
   - Dashboard 100% Nube para gestión remota (Ventas por hora, analíticas).
   *(Nota de resiliencia: Si se corta el internet, las funciones PRO se deshabilitan temporalmente con "Degradación Elegante", sin bloquear el sistema de caja local).*

---

## 🎯 ORDEN DE EJECUCIÓN 

1. **Bloque 1 (Fundacional):** Categorías + Aumento Inteligente
2. **Bloque 2 (Core):** Bultos vs Unidades
3. **Bloque 3 (Operativo):** Compras / Proveedores
4. **Bloque 4 (Valor Agregado):** Sincronización Nube

---

## 🚀 CHECKLIST DE IMPLEMENTACIÓN

### [x] Bloque 1: Categorías y Aumentos
- [x] `ALTER TABLE products` + `CREATE TABLE categories`
- [x] Seedear categorías base (Golosinas, Bebidas, Almacén, Cigarrillos, etc.)
- [x] Endpoints GET/POST/PUT/DELETE para categorías
- [x] UI: Nueva pestaña/vista de gestión de categorías
- [x] UI: Dropdown de categoría al crear/editar un producto
- [x] Refactorizar modal de "Aumento Masivo" con 3 opciones (todo, por categoría, por rango de precio)
- [x] Endpoint `POST /bulk-price-increase` que soporte filtrado por `category_id`
- [x] Auditoría de aumentos masivos en `stock_movements`
- [x] Testing: Validar migración de datos y cálculos de margen.

### [x] Bloque 2: Bultos vs Unidades
- [x] `ALTER TABLE products` (`parent_id`, `pack_size`, `is_virtual`)
- [x] Lógica transaccional en Venta: si se vende un virtual (Bulto), descontar atómicamente `pack_size` del maestro (Unidad).
- [x] Endpoints `POST /create-virtual` y `GET /stock-breakdown`
- [x] UI: Indentación o diseño anidado de productos virtuales bajo su maestro en la grilla de Stock.
- [x] UI: Modal específico para "Crear Bulto a partir de este producto"
- [x] Testing: Vender un bulto y validar descuento en el maestro.

### [x] Bloque 3: Compras y Proveedores
- [x] `CREATE TABLE suppliers`, `purchases`, `purchase_items`
- [x] Alterar `products` (`cost_price`, `last_purchase_date`)
- [x] Endpoints CRUD `suppliers`
- [x] Endpoints POST `create-purchase`, `add-item`, `confirm`
- [x] Lógica transaccional: Al confirmar compra, actualizar stock, actualizar `cost_price` y registrar en auditoría.
- [x] UI: Pestaña Proveedores y Pestaña Compras (Historial)
- [x] UI: Carrito de ingreso de mercadería (optimizado para carga rápida de facturas)
- [x] UI: Modal para revisar precios sugeridos (si el costo aumentó drásticamente, sugerir aumento de venta).
- [x] Testing: Ciclo de vida completo de compra y validación de impacto en caja y stock.

### [ ] Bloque 4: Dashboard 100% Nube (SaaS PRO)
- [ ] Setup Supabase o Postgres en AWS
- [ ] Crear esquema en base de datos centralizada
- [ ] Cron job asíncrono en FastAPI para *background sync*
- [ ] Endpoint `POST /api/telemetry/sync` en Vercel
- [ ] Dashboard Web en React (Login, Ventas por hora, Gráficos de ingresos vs egresos)
- [ ] Testing: Simular caída de internet y reconexión silenciosa (Degradación elegante).

### [ ] Bloque 5: Inteligencia Artificial y Facturación (SaaS PRO)
- [ ] Integración con API de AFIP (ARCA) para emisión de Facturas A, B y C automáticas con CAE.
- [ ] Endpoint `/api/vision/invoice` con integración a OpenAI Vision / Gemini para leer facturas/remitos y extraer productos, cantidades y costos.
- [ ] UI: Modal para "Subir foto de Factura" en el módulo de compras, pre-llenando automáticamente el carrito de ingreso.
- [ ] Scraper/Crawler centralizado para analizar precios de mercado y enviar "Alertas de Rentabilidad" en pantalla (Ej: "Producto X un 15% debajo del mercado").

---
*Documento vivo: Marcar con `[x]` a medida que se completen las tareas.*

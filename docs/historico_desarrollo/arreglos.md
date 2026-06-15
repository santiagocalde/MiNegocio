# 🚨 Auditoría "Hater" Pre-Mortem a 30 Días (MiNegocio SaaS)
*Documento de la Verdad: Por qué nuestro MVP fallaría en el mundo real si lo lanzamos tal cual está hoy.*

---

## 🌟 Análisis Comparativo (Cobrando.app vs MiNegocio)

**1. Onboarding y Creación de Cuenta (Falta)**
* **Cobrando.app:** Tiene un asistente (Wizard) que pregunta si es Kiosco, Almacén o Indumentaria para pre-configurar el sistema.
* **MiNegocio:** Tenemos la pantalla de login/registro, pero nos falta el Asistente Inicial. Cuando el usuario entra por primera vez, el sistema está vacío. Deberíamos tener un paso que le cree las categorías básicas ("Bebidas", "Golosinas") automáticamente según su rubro.

**2. Cargar Productos (Incompleto - Cuello de botella)**
* **El problema del Día 30:** Un kiosco promedio tiene 2.500 productos. Actualmente en StockModule.jsx, la única forma de cargar stock es uno por uno a mano.
* **Lo que falta:** Nos falta urgente un botón de "Importar desde Excel/CSV". Si le vendes este sistema a un almacén que se quiere cambiar de otro software, no lo va a hacer si tiene que tipear 2.500 productos de nuevo.

**3. Registro de Ventas y Medios de Pago (UI Desconectada)**
* **Cobrando.app:** Te deja elegir si cobras en efectivo, MercadoPago o tarjeta.
* **MiNegocio:** En el backend, ya programamos el campo payment_method en la base de datos y la conexión a Mercado Pago. El Bug: En la interfaz del Cajero (POSApp.jsx), cuando aprietas F2 para cobrar, el modal solo te muestra un campo para poner el Efectivo. No le hemos puesto los botones grandes para elegir "Cobrar con MercadoPago" o "Tarjeta". Está programado atrás, pero oculto adelante.

**4. Gestión de Stock (Falta Inteligencia)**
* **El problema del Día 30:** Después de un mes, Don Julio quiere saber qué cosas compró al pedo y no se venden.
* **Lo que falta:** Cobrando.app tiene una función de "Mercadería sin movimiento en 30 días". Nosotros tenemos alertas de stock bajo y vencimiento, pero nos falta el Reporte de Stock Muerto (productos que ocupan lugar y no rotan).

**5. Fiados y Cuentas Corrientes (🚨 BUG CRÍTICO DE LÓGICA)**
* **Cobrando.app:** Tiene un historial completo del cliente. Si Juan debe $10.000, puede venir y decir "Te pago $3.000 hoy y el resto mañana".
* **MiNegocio (El Desastre):** Nuestro FiadoModule.jsx es extremadamente básico. En la base de datos, solo guardamos que la venta X se le fió a "Juan". El Bug: No programamos los pagos parciales. Si Juan debe $10.000, en nuestro sistema actual o te paga los 10.000 juntos, o no le puedes descontar la deuda. Necesitamos crear una tabla real de cuentas_corrientes en el backend para manejar entregas de plata parciales.

**6. Reportes y Cierre de Caja (Incompleto)**
* **El problema del Día 30:** El contador del negocio le pide un Excel a Don Julio para presentar los impuestos.
* **Lo que falta:** En ReportsModule.jsx tenemos gráficos muy lindos, pero no hay un botón de "Exportar a Excel". Es una línea de código fácil (librería xlsx), pero si no la ponemos, el sistema no sirve para la contabilidad formal.

**7. Facturación ARCA/AFIP (Totalmente Desconectado)**
* **Cobrando.app:** Tiene una sección /facturacion para subir el CUIT y automatizar.
* **MiNegocio:** Yo te creé el archivo afip_service.py en el backend (el motor), pero en el frontend no hay ninguna pantalla donde Don Julio pueda subir su certificado .crt de AFIP, ni configurar su CUIT. Está el motor de la Ferrari, pero no le pusimos el volante.

---

## 🗂️ 1. FLUJO DE VENTAS Y CAJA (UX/UI y Lógica)

**1. [x] HECHO: El Buscador Inútil (Múltiples Coincidencias)**
* **Problema:** Si escribes "Coca", el sistema detecta 5 variantes y en lugar de desplegar una lista visual para elegir, lanza un error bloqueante que dice "Elija de la lista abajo" (pero no hay ninguna lista).
* **Solución:** Implementar un Dropdown (Menú desplegable) predictivo que muestre resultados instantáneos mientras se escribe.

**2. [x] HECHO: Venta de Productos Pesables / Fraccionados**
* **Problema:** Los inputs de cantidad (+ / -) asumen números enteros. Si el kiosco vende pan o fiambre y el cliente lleva 0.250 Kg, el sistema entra en pánico. Tampoco lee los códigos de barras de balanzas (los que empiezan con "20" y traen el precio embebido).
* **Solución:** Pydantic quantity cambiado a float (Item 49). Parser de códigos de barras EAN-13 de balanza implementado en SearchBar. Al escanear un código que empieza con "20", extrae el código de producto (dígitos 3-7) y el precio embebido (dígitos 8-12), busca el producto y lo agrega con el precio de balanza.

**3. [x] HECHO: Calculadora de Vuelto Lenta**
* **Problema:** Al cobrar con Efectivo (F2), el cajero debe tipear manualmente el billete que le dan (Ej: "5000"). Esto ralentiza la cola.
* **Solución:** Autogenerar botones inteligentes: `[Pago Justo]` `[Con $2.000]` `[Con $5.000]`.

**4. [x] HECHO: Botones de Pago Digitales Faltantes**
* **Problema:** El backend soporta Mercado Pago, Tarjeta y Efectivo, pero el UI de Cobro (`POSApp.jsx`) solo tiene un input para Efectivo.
* **Solución:** Agregar botones gigantes para elegir el medio de pago antes de confirmar.

**5. [x] HECHO: La Estafa de Mercado Pago**
* **Problema:** Si cobras con MP, el sistema se marca como "Pagado" cuando el cajero presiona "Confirmar", sin validar si la plata realmente entró. Un cliente con una app falsa de MP puede robar mercadería.
* **Solución:** El modal debe bloquearse leyendo el Webhook de MP hasta recibir el OK oficial del servidor.

**6. [x] HECHO: El Robo del Cajero (Cancelación Fantasma)**
* **Problema:** El cajero puede escanear 5 productos ($5.000), cobrarle en mano al cliente, y luego presionar `F12` (Cancelar Venta). El cajero se guarda los $5.000 y el dueño nunca se entera.
* **Solución:** Toda venta anulada o cancelada después de escanear más de 3 ítems debe quedar guardada en un `AuditLog` rojo para revisión del dueño.

**7. [x] HECHO: Devoluciones Inflexibles**
* **Problema:** Solo podemos anular un ticket entero. Si un cliente compró 20 cosas y devuelve 1 leche vencida, hay que anular todo y volver a cobrar 19 cosas.
* **Solución:** Lógica de devolución parcial por ítem.

**8. [x] HECHO: Impresión de Ticket Spam**
* **Problema:** La app fuerza `window.print()` en cada venta. En Argentina, casi nadie pide ticket en kioscos. Esto traba la pantalla del cajero cada 30 segundos.
* **Solución:** Botón switch (On/Off) de "Autoprint", o presionar `F9` solo si el cliente lo pide.

---

## 📦 2. INVENTARIO Y CATÁLOGO

**9. [x] HECHO: Carga de Stock Manual Insostenible**
* **Problema:** Solo se pueden subir productos uno a uno. Para un supermercado con 3.000 artículos, la adopción del SaaS será del 0% por la pereza de carga.
* **Solución:** Botón urgente de "Importación Masiva por Excel/CSV".

**10. [x] HECHO: Aumento Masivo de Precios (Inflación)**
* **Problema:** Ante una inflación del 10%, el usuario tiene que editar 3.000 precios a mano, producto por producto.
* **Solución:** Herramienta para Aumento Masivo por Porcentaje (%), filtrado por Proveedor o Categoría.

**11. [x] HECHO: El Misterio de los Bultos (Unpack)**
* **Problema:** Hay una función mágica `handleUnpack`. Si llega 1 Pack de Coca y lo desarmas, el sistema no sabe cuántas unidades trae. Va a romper el stock.
* **Solución:** Añadir campo `units_per_package` en la base de datos de productos.

**12. [x] HECHO: Reporte de "Stock Muerto" Ausente**
* **Problema:** El dueño no sabe qué mercadería tiene ocupando espacio y no se vendió en los últimos 30 días.
* **Solución:** Reporte analítico de "Productos sin rotación".

**13. [x] HECHO: Inconsistencia Multi-Dispositivo (SSE)**
* **Problema:** Si el repositor carga mercadería atrás con el celular, la PC del mostrador no ve la actualización hasta que recarga la página.
* **Solución:** Implementado endpoint SSE `/api/events` en FastAPI. Cada POST a sales/products emite eventos `sale-created` y `product-changed`. El frontend escucha vía `EventSource` y actualiza el catálogo en tiempo real sin recargar.

---

## 💰 3. FINANZAS Y CONTABILIDAD

**14. [x] HECHO: Fiados: Deudas Acumulables y Pagos Parciales**
* **Problema:** Si "Juan" debe $10.000 y quiere dejar $5.000 a cuenta, el sistema no lo permite. Tampoco existe un registro unificado de la deuda de Juan (hay que escribir el nombre a mano, susceptible a errores de tipeo).
* **Solución:** Crear entidad "Clientes/Cuentas Corrientes" en BD. Permitir Entregas a Cuenta.

**15. [x] HECHO: Compras a Proveedores vs. Caja (Descuadre)**
* **Problema:** El kiosquero carga que le compró $50.000 a Arcor. El sistema no descuenta esa plata de la caja registradora. Al final del día, faltan $50.000 físicos y el empleado es acusado de robo.
* **Solución:** Vincular el Módulo de Compras con un "Egreso Automático de Caja".

**16. [x] HECHO: Rentabilidad Falsa (Costos no actualizados)**
* **Problema:** Si el costo está en $0, la ganancia figura en 100%. Si un proveedor aumenta el costo, el precio de venta no te avisa que tu margen se desplomó.
* **Solución:** Enforcer carga de `cost_price` y crear alertas de "Margen de Ganancia Peligroso".

**17. [x] HECHO: Retiros de Efectivo (Sangrías) vs. Gastos**
* **Problema:** Cuando el dueño saca $100.000 de la caja para guardarlos en la oficina por seguridad, el sistema lo cuenta como un "Egreso/Gasto", bajando la rentabilidad mensual de forma mentirosa.
* **Solución:** Diferenciar "Retiro de Dinero" (Sangría) de "Gasto Operativo".

**18. [x] HECHO: Cierre de Caja Ciego**
* **Problema:** El sistema le dice al cajero: "Deberías tener $100.000". El cajero cuenta $95.000, roba $5.000 adicionales, y reporta que faltan $10.000. 
* **Solución:** El Arqueo debe ser Ciego. El cajero ingresa cuánta plata física cuenta, sin saber cuánto espera el sistema. La diferencia solo la ve el Administrador.

---

## ☁️ 4. ESTRUCTURA SAAS, SEGURIDAD Y ESTÉTICA

**19. Modo Offline con Stock Optimista**
* **Problema:** Si se corta internet, el carrito guarda las ventas, pero el stock no baja visualmente de `productsDB`. Esto permite ver "Stock 10" eternamente mientras escaneamos.
* **Solución:** En `useCart`, descontar optimistamente el stock local de la variable global de productos.

**20. [x] HECHO: Mentira del Modo Offline (Pánico Visual)**
* **Problema:** Si se corta internet, el stock deja de actualizarse. El carrito guarda las ventas y muestra un contador, pero el stock no baja visualmente, permitiendo ventas negativas irreales. Y no hay garantías de que no se pierdan si se borra caché.
* **Solución:** El carrito descuenta visualmente el stock de manera optimista en memoria local y muestra un Dashboard verde que dice "Conexión Perdida: Trabajando a Salvo".

**21. [x] HECHO: Empleados Chusmas (Falta de Roles RBAC)**
* **Problema:** Cualquiera con un PIN de acceso entra al Panel y ve la plata que ganó el negocio en el mes, o puede borrar el inventario entero.
* **Solución:** Roles estrictos aplicados a la navegación. "Cajero" (Solo Vende), "Encargado" (Stock, Compras), "Dueño" (Ve Reportes, Auditoría, Configuración).

**22. Vault de Tokens y Certificados AFIP**
* **Problema:** Guardar los tokens o certificados fiscales (.crt/.key) en el frontend es imposible. Y en backend está como un placeholder en `afip_service.py`.
* **Solución:** Crear endpoints `/api/vault/certificates` para subir de forma segura los archivos y listarlos en el Configuración AFIP del frontend.

**23. [x] HECHO: Seguridad de Credenciales (Tokens AFIP/MP)**
* **Problema:** Guardar los tokens de acceso bancario en un texto plano en el frontend es inviable.
* **Solución:** Crear una Bóveda (Vault) en el Backend donde los certificados `.crt` y tokens se suban y nunca más se muestren completos en la UI.

**24. Sincronización Multi-Pestaña**
* **Problema:** Si abro MiNegocio en dos pestañas, el backend no lo frena, pero el frontend puede desincronizar el `turn_id` si una pestaña quedó vieja.
* **Solución:** Usar `BroadcastChannel('minegocio-session')` para avisar entre pestañas que el turno cambió.

---

## 🛑 INCONSISTENCIAS DETECTADAS (Cola de Trabajo)

**25. [x] HECHO: Conflicto de Pestañas Múltiples (Turno Perdido)**
* **Problema:** Si el cajero abre el POS en dos pestañas distintas del navegador, el `currentTurnId` (ID del Turno) solo vive en la memoria de la primera pestaña. Si cobra desde la segunda pestaña, la venta va a fallar en el backend porque se manda sin ID de turno.
* **Solución:** Sincronizar el estado del `currentTurnId` y `currentOperator` usando `localStorage` para que todas las pestañas activas del navegador compartan la misma sesión física.

**26. [x] HECHO: Cierre de Caja con "Ventas Offline Pendientes" (Corrupción de Datos)**
* **Problema:** Si se corta internet, quedan 10 ventas pendientes en el carrito fantasma. El cajero cierra la caja (turn_id = 5) y se va. Al otro día entra otro cajero (turn_id = 6), vuelve el internet, ¡y las 10 ventas viejas se sincronizan bajo el turno nuevo! Esto descuadra las dos cajas.
* **Solución:** Cada venta pendiente guardada en `localStorage` empaqueta de forma inmutable el `turn_id` original al momento en que ocurrió la venta y relajamos el chequeo de stock en la API para prevenir bloqueos por stock negativo.

**27. [x] HECHO: Factura A vs B (Discriminación de IVA estática)**
* **Problema:** Si Don Julio activa IVA 21%, el sistema suma el IVA al total. Pero si viene un cliente "Responsable Inscripto" y pide Factura A, el sistema no sabe cómo discriminar el IVA base del IVA agregado en el ticket. Trata todo como Factura B/C (Consumidor Final).
* **Solución:** Lógica dinámica de Facturación A/B/C dependiendo de la condición frente al IVA seleccionada en el modal de cobro, imprimiendo el IVA discriminado solo si es Tipo A.

**28. [x] HECHO: Cajón de Dinero trabado (Integración QZ Tray + Agente Python)**
* **Problema:** Los kioscos necesitan que el "Cajón de dinero" se abra solo (pop) cuando se cobra en efectivo. El cajón se abre mandando un comando ESC/POS a la tiquetera térmica. El actual `window.print()` de Chrome **no puede mandar comandos ESC/POS**, ergo, el cajón nunca se va a abrir automáticamente.
* **Solución:** Implementadas dos vías complementarias:
  1. **QZ Tray** (`qz-tray` v2.2.6): Servicio nativo de impresión silenciosa. El frontend conecta vía WebSocket (`wss://localhost:8181`) y envía comandos ESC/POS para abrir cajón (`0x1B 0x70 0x00 0x19 0xFA`) e imprimir tickets. Implementado en `frontend/src/services/qzTray.js`.
  2. **Agente Python local** (`backend/agent.py`): Mini servidor HTTP en `http://127.0.0.1:8199` que envía comandos raw a la impresora vía `win32print`. Fallback automático cuando QZ Tray no está disponible.
  Backend: `routers/cashier.py` con endpoints `/api/config/printing`, `/api/cash-drawer/open`, `/api/print/ticket`, `/api/agent/ping`. El cajón se abre automáticamente al cobrar en efectivo (configurable).

**29. [x] HECHO: Auto-Ataque DDoS por Sincronización (Cuello de Botella)**
* **Problema:** Si el kiosco se queda sin internet por 4 horas, puede acumular 300 ventas pendientes. Cuando el internet vuelve, el Frontend actual intenta enviar los 300 `fetch` al mismo tiempo. Esto va a hacer colapsar tu propio backend de FastAPI (o Cloudflare te va a banear por Rate Limiting).
* **Solución:** Implementamos "Batching" y "Throttling" en la cola de sincronización Offline (mandando paquetes de 10 ventas cada 4 segundos).

**30. [x] HECHO: Turnos Huérfanos por limpieza de Caché**
* **Problema:** Si Don Julio le pasa el CCleaner a la compu o borra el historial de Chrome en mitad del día, se borra el `currentTurnId` del `localStorage`. Cuando vuelve a entrar a MiNegocio, el sistema le obliga a abrir un "Turno Nuevo", rompiendo la caja del día en dos turnos separados que no cuadran.
* **Solución:** El backend guarda el `active_shift_id`. Al hacer login o reiniciar la página sin caché, el Frontend pregunta a `/api/turns/active` y retoma el turno huérfano automáticamente sin crear uno nuevo.

**31. [x] HECHO: El "Bache" del Faltante de Caja (Arrastre de Deuda)**
* **Problema:** El sistema ya tiene "Arqueo Ciego" (Genial). Pero si al cajero A le faltan $5.000 físicos, el sistema lo marca en rojo. ¿Qué pasa al día siguiente? La "Caja General" del negocio nunca descontó esos $5.000 porque nadie los reportó como gasto. La caja teórica sigue esperando que esos $5.000 existan en el ecosistema.
* **Solución:** Al confirmarse un faltante de caja en el cierre (`difference < 0`), el backend ahora inserta automáticamente un "Egreso por Faltante de Caja" para cuadrar la caja fuerte real con el sistema.

**32. [x] HECHO: Promociones Auto-aplicadas (Fraude en Puerta)**
* **Problema:** Don Julio hace una oferta: "Llevando 2 Cocas + 1 Fernet = $15.000". Actualmente, el cajero tiene que usar el botón "Ajustar Total" a mano, borrando el precio real y tipeando $15.000. Esto destruye las estadísticas y le permite al cajero descontar cosas arbitrariamente (robos disfrazados de descuentos).
* **Solución:** Motor de Promociones evaluado dinámicamente en el backend/frontend para calcular el subtotal correctamente de manera automática.

**33. [x] HECHO: Vuelto en Cuenta (El problema de la falta de monedas)**
* **Problema:** El total es $1.950, el cliente paga con $2.000. El kiosquero no tiene $50 pesos físicos. Tradicionalmente le da un caramelo. Pero un sistema premium como MiNegocio SaaS debería retener el cliente.
* **Solución:** Botón en el vuelto que diga "Acreditar vuelto a la cuenta del cliente". Esos $50 van al balance del cliente y se descuentan de su próxima compra solos. Fidelización pura.

**34. [x] HECHO: Ilegalidad del Ticket Fiscal (Falta de CAE y QR)**
* **Problema:** En el POSApp agregamos un checkbox "Emitir Factura Electrónica". Si esto se integra con la AFIP (ARCA), la AFIP devuelve un comprobante con un código CAE y una fecha de vencimiento. Nuestro actual componente `TicketPrint.jsx` no incluye soporte para imprimir la data fiscal (CAE + QR obligatorio en Argentina). Si imprimimos eso, el ticket no tiene validez legal.
* **Solución:** Rediseñado el `TicketPrint.jsx` para que imprima el CAE y el Vto del CAE devueltos por la AFIP en el comprobante.

**35. [x] HECHO: Códigos de Barra Duplicados (Colisión Silenciosa)**
* **Problema:** Distintos proveedores en el interior del país a veces reciclan códigos EAN genéricos para productos sueltos. Si hay dos productos con el código `0001234`, el escáner del frontend siempre va a cargar el primero que aparezca en el array (usamos `.find()`), haciendo imposible vender el segundo.
* **Solución:** Implementado "Modal Interceptor" en `handleSearch` (`POSApp.jsx`). Si `.filter()` trae más de un producto, frena la carga y le da a elegir visualmente al cajero.

**36. Dolarización de Costos y Dependencia Cambiaria**
* **Problema:** Muchos kioscos/almacenes tienen productos (como encendedores importados o pilas) que los proveedores cotizan en dólares. Si el dólar sube, actualizar esos costos a mano es imposible. 
* **Solución:** Agregar opción en `products` para definir la "Moneda de Costo". Si es USD, el sistema auto-actualiza el precio de venta en ARS todos los días basado en una API del Dólar Blue / Oficial.

**37. [x] HECHO: Borrado Lógico vs Físico (Pérdida de Historial)**
* **Problema:** Al "eliminar" un producto en el inventario, se hacía un `DELETE` en la base de datos. Si elimino el producto "Papas Lays", todas las ventas viejas apuntan a un ID huérfano o rompen el join de estadísticas.
* **Solución:** Implementamos *Soft Deletes* agregando `is_active = 1` y usando `UPDATE is_active = 0` al borrar.

**38. [x] HECHO: Race Condition en el Carrito de Ventas**
* **Problema:** Si el cajero escanea 5 productos en menos de 1 segundo (con un escáner láser de gatillo rápido), el `setCart(prev => ...)` de React puede "pisarse" y perder algunos ítems por culpa del state de `search` en el DOM virtual.
* **Solución:** Refactorizado `handleSearch` para leer sincrónicamente `e.target.value` sin esperar al event loop de React.

**39. [x] HECHO: Ticket Fiscal Huérfano (Falta de Relación AFIP/Venta)**
* **Problema:** En `sales.py`, devolvemos un `afip_data` con un CAE. Pero ese CAE nunca se guardaba en SQLite. Si la AFIP pide reimprimir el ticket 5, no teníamos su CAE.
* **Solución:** Agregadas las columnas `cae` y `cae_vto` a SQLite, y `sales.py` las guarda post-llamada a AFIP.

**40. [x] HECHO: Descuadre de Pagos Mixtos**
* **Problema:** Un cliente compra por $1.500 y paga $1.000 físicos y $500 con MP. Hoy el sistema fuerza a elegir UNO de los dos, ensuciando el "Arqueo de Caja" al final del día.
* **Solución:** Modal de Cobro rediseñado con botón "🔀 Pago Mixto". Soporta N métodos con montos individuales. Backend registra cada pago en `sale_payments` y el método primario es `split`.

**41. [x] HECHO: Abandono de Turno (Cierres Fantasmas)**
* **Problema:** Si el cajero termina su horario, cierra la pestaña y se va a su casa sin hacer "Cierre de Caja", el turno queda abierto eternamente. Al día siguiente, el nuevo cajero entra y, si no mira, sigue facturando sobre la caja de ayer, mezclando dos días de contabilidad.
* **Solución:** Se implementó cierre automático de caja en `open_turn` y `get_active_turn`. Si un turno tiene más de 14 horas de inactividad, el backend lo cierra forzosamente con una nota de "Abandono de caja".

**42. [x] HECHO: Pérdida de Datos en Sync Offline (Queue Pop Race Condition)**
* **Problema:** La sincronización de ventas en `POSApp.jsx` lee la cola, la vacía y luego hace el `fetch`. Si el navegador se cierra o el WiFi se corta justo durante el `fetch`, esa venta se borró del disco local pero nunca llegó a la nube. Pérdida definitiva.
* **Solución:** Cola transaccional implementada con Outbox Pattern. Las ventas se guardan en `localStorage` con `idempotency_key` ANTES del POST. El auto-sync procesa de a 10, solo remueve las que reciben HTTP 200. Si el navegador crashea, al reconectar se reenvían y el backend las detecta como duplicadas por la key.

**43. [x] HECHO: Fraude Contable: Ventas Post-Cierre (Turnos Zombies)**
* **Problema:** El endpoint `POST /api/sales` recibe un `turn_id`, pero nunca verifica si ese turno en la tabla `turns` ya fue cerrado (`closed_at IS NOT NULL`). Esto permite que alguien inyecte (vía Postman o con la app sin refrescar) ventas en una caja que ya fue arqueada y rendida al dueño, rompiendo la inmutabilidad contable.
* **Solución:** Añadir validación en `create_sale` (`sales.py`) para bloquear cualquier venta si el turno asociado ya está cerrado.

**44. [x] HECHO: Bloqueo de Modal de Duplicados (Restricción UNIQUE)**
* **Problema:** En el Punto 35 hicimos que el Frontend soporte múltiples productos con el mismo código de barras. Pero en SQLite (`main.py`), la columna `code` de la tabla `products` tiene `UNIQUE NOT NULL`. Esto significa que es IMPOSIBLE crear un segundo producto con el mismo código (el backend tira HTTP 400). Todo el trabajo del frontend es inútil hasta que la DB permita la colisión de EANs genéricos.
* **Solución:** Migrar la tabla `products` para eliminar la restricción `UNIQUE` en `code` y asegurarse de que el backend pueda devolver Arrays de productos al buscar por código.

**45. Desconexión de Cuentas Corrientes y Fiados Anidados**
* **Problema:** En `sales.py` implementamos `customers` y su `balance` para manejar Cuentas Corrientes y Vuelto en Cuenta. Sin embargo, el endpoint `GET /api/sales/fiado` (en `inventory.py`) y el frontend siguen listando los fiados agrupando por `sales` individuales (`is_fiado=1`). Al "Cobrar Fiado" individualmente, se hace `UPDATE sales SET cobrado=1`, pero **NO** se descuenta el pago del `balance` global del cliente. El cliente paga, pero su deuda global sigue intacta.
* **Solución:** Refactorizar el sistema de Fiados del frontend y el endpoint `cobrar_fiado` para que lean y actúen siempre sobre la tabla `customers` (Cuentas Corrientes Globales), permitiendo pagos parciales y deprecando el flag booleano de `cobrado=1` por venta.

**46. [x] HECHO: Desarme de Bultos Contradictorio (Productos Virtuales)**
* **Problema:** La función `unpack_product` (`inventory.py` o `products.py`) asume que un producto virtual tiene `stock` propio en disco, pero en realidad el stock virtual se calcula dinámicamente como `parent.stock / pack_size`. Al intentar "desarmar" un bulto, el servidor actualiza campos estáticos en el producto virtual, rompiendo la arquitectura de herencia y causando stock negativo irreversible.
* **Solución:** Reescribir `unpack_product` para restar del producto maestro real o directamente eliminar esta función si el sistema pasa a calcular dinámicamente las equivalencias al vender un Bulto.

**47. [x] HECHO: Ruptura de Inventario en Ventas Virtuales y Reversiones**
* **Problema:** En `create_sale` y `revert_sale`, el sistema hace un `UPDATE products SET stock = stock - quantity` usando el ID del producto escaneado. Si se vende o devuelve un "Pack de 6" (Producto Virtual), el sistema le suma o resta stock a ese Pack Virtual en lugar de multiplicar por 6 y descontárselo al Producto Original (Unidad Suelta). El inventario maestro jamás se entera de la venta, generando desfasajes físicos brutales.
* **Solución:** Interceptar `is_virtual` en el motor de ventas y reversiones. Si es virtual, multiplicar la cantidad por `pack_size` y aplicar el movimiento de inventario sobre el `parent_id`.

**48. [x] HECHO: Deuda Inmortal (Reversión de Fiados Rota)**
* **Problema:** Si un cajero hace una venta "Fiada" por error a "Don Julio" por $50.000, el saldo de Don Julio sube $50.000. Si el cajero se da cuenta y presiona "Anular Venta" en el historial, el endpoint `revert_sale` (`inventory.py`) devuelve los productos al stock, pero **jamás revierte la deuda** en la tabla `customers`. Don Julio sigue debiendo $50.000 por una venta que ya fue anulada.
* **Solución:** En `revert_sale`, verificar si la venta original era `is_fiado = 1`. De ser así, insertar un movimiento compensatorio en `customer_transactions` y restarle el total de la venta al `balance` del cliente para saldar la deuda fantasma.

---

## 🛑 HALLAZGOS DEL REFACTOR (Puntos A - E)

**49. [x] HECHO: A — `schemas/models.py` quantity es `int` pero DB soporta REAL**
* **Problema:** `SaleItem.quantity` usa `int` pero `sale_items.quantity` en DB es `INTEGER` o debería ser `REAL`. Si el frontend envía `qty: 0.250`, Pydantic rechaza con error de validación.
* **Solución:** Cambiado a `float` en Pydantic y DB migrada a `REAL`.

**50. [x] HECHO: B — `closeCajaPin` y `countedCash` están en POSApp.jsx**
* **Problema:** Estado sobrante en el orquestador principal en vez de estar abstraído.
* **Solución:** Movido al nuevo hook `useCloseTurn`.

**51. [x] HECHO: C — 0 tests de frontend**
* **Problema:** Cualquier refactor futuro puede romper la UI de manera silenciosa.
* **Solución:** Implementado Vitest/React Testing Library con 11 tests críticos.

**52. [x] HECHO: D — `reports.py` no existe (Falta Exportar a Excel)**
* **Problema:** El Punto 6 menciona exportar a Excel, pero no hay endpoint en el backend.
* **Solución:** Creado `reports.py` en FastAPI usando `openpyxl` para exportación de ventas y productos.

**53. [x] HECHO: E — Encoding corrupto**
* **Problema:** UTF-8 malformado.
* **Solución:** Archivo completamente reconstruido y guardado con UTF-8 íntegro.

---

## ⚡ 5. OPTIMIZACIÓN Y PERFORMANCE (Detectado en Auditoría Profunda)

**54. [x] HECHO: N+1 Queries en Motor de Promociones (Cache)**
* **Problema:** Cada vez que el carrito cambia, `evaluate_promotions` iteraba sobre cada promoción activa y hacía una nueva consulta SQL `SELECT` a `promotion_conditions`. Con 50 promos activas, un escaneo generaba 51 queries a SQLite en milisegundos.
* **Solución:** Se implementó una Caché en Memoria (TTL 30s) en `promotions.py`. Ahora se lee 1 vez de disco y se sirve en RAM. Se invalida instantáneamente al crear/editar promos.

**55. [x] HECHO: Ausencia Total de Índices DB (Indexes)**
* **Problema:** SQLite leía las tablas secuencialmente (Full Table Scan). Al exportar reportes de `sales` uniendo con `sale_items` (cientos de miles de registros), la base iba a colapsar al 3er mes.
* **Solución:** Creados 13 índices críticos en `database.py` (ej: `idx_sales_timestamp`, `idx_sale_items_sale_id`, `idx_products_code`, `idx_products_category`, `idx_products_sucursal`, `idx_products_is_active`, `idx_customer_transactions_customer_id`).

**56. [x] HECHO: Payloads Gigantes no Comprimidos (Payloads)**
* **Problema:** El endpoint `/api/products` descarga 3.000 productos. En JSON puro esto puede pesar 3MB, lo que bloquea el hilo de red al iniciar la app.
* **Solución:** Se agregó `GZipMiddleware` en `main.py`. Ahora el JSON de productos viaja comprimido, reduciendo el payload de red hasta en un 90% (de 3MB a 300KB).

**57. [x] HECHO: Renderizado Ineficiente en Catálogo (Rendering)**
* **Problema:** Al buscar o escribir en el buscador del POS, es posible que listas enteras de miles de elementos se estén re-renderizando innecesariamente en React si no se usa Virtualización o memoización (`useMemo`, `React.memo`).
* **Solución:** Se implementó `react-virtuoso` (`TableVirtuoso`) en el inventario (`StockModule.jsx`), renderizando dinámicamente solo las filas visibles, reduciendo de miles a apenas ~20 nodos HTML en el DOM, resolviendo cualquier latencia de búsqueda.

---

## 🏗️ 6. REFACTOR DE ARQUITECTURA (Backend)

**58. [x] HECHO: main.py Monolítico**
* **Problema:** El archivo `main.py` tenía casi 1.000 líneas (957). Contenía código zombie de la autenticación (`/old/login`) y toda la lógica cruda de inicialización de la base de datos (más de 380 líneas de `CREATE TABLE`).
* **Solución:** 
  - Se eliminaron 142 líneas de endpoints zombies de autenticación que ya habían sido extraídos a `routers/auth.py`.
  - Se extrajo toda la capa de creación y migración de base de datos (`init_db`) a un nuevo archivo **`backend/database.py`**.
  - `main.py` se redujo a unas magras ~430 líneas actuando puramente como Orquestador (CORS, Middlewares de GZip, inyección de dependencias, Background Tasks).

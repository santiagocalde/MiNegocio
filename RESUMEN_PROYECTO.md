# 🏪 NovaStock - Resumen Ejecutivo del Proyecto

## 📖 Visión General
NovaStock es un sistema de Punto de Venta (POS) y gestión de inventario diseñado específicamente para kioscos, despensas y minimercados en Argentina. La premisa fundamental del proyecto es ser **"a prueba de balas"**: rápido, intuitivo para personas mayores o empleados sin experiencia técnica, resistente a cortes de internet (offline-first) y con controles estrictos para evitar robos ("robo hormiga").

---

## 🛠️ Stack Tecnológico y Arquitectura
- **Frontend:** React 19 + Vite (UI ágil, renderizado instantáneo en el navegador).
- **Backend:** Python + FastAPI (Ligero, rápido de levantar, excelente manejo de concurrencia).
- **Base de Datos:** SQLite (`aiosqlite`) configurada en **modo WAL**. Evita bloqueos en modo lectura/escritura concurrente, permitiendo que múltiples cajas apunten a la PC principal de manera fluida.
- **Despliegue Profesional:** Instalador INNO Setup (`.exe`) que empaqueta todo, configura el servicio de arranque automático con Windows, y evita el uso frágil de scripts `.bat`.

**¿Por qué esta arquitectura?**
Los kioscos reales en Argentina suelen usar computadoras viejas (Windows 7/10) y tienen conexiones a internet inestables. Un sistema basado 100% en la nube (como Firebase o Vercel) fallaría en el peor momento. Mantener un backend local con SQLite asegura que el kiosquero pueda seguir cobrando aunque se corte Fibertel.

---

## ✅ Funcionalidades Implementadas

### 1. Punto de Venta (Caja) Súper Ágil
- **Input Unificado:** Un solo campo de texto que escucha lectores de código de barras automáticamente (actúan como teclados súper rápidos) o permite búsqueda manual por nombre.
- **Botones de Atajo (Quick Items):** Botones en pantalla para Carga SUBE, Carga Virtual y Agua Caliente. Se saltan el código de barras y suman directo al carrito.
- **Teclas Rápidas Clásicas:** `F1` (Cobrar), `F2` (Buscar), `F4` (Fiado), `F10` (Ayuda), `F12` (Anular todo).
- **Confirmación Visual y Sonora:** Un "Beep" al escanear, la barra titila en verde, y un cartel gigante de "¡VENTA OK!" al cobrar, dando paz mental al operador mayor.
- **Combos Automáticos:** El sistema detecta patrones en el carrito (ej: Alfajor + Gaseosa) y aplica descuentos automáticos. También detecta descuentos por cantidad (ej: 3 cervezas).

### 2. Control de Inventario y Precios
- **Gestión In-Place:** Desde la pestaña Stock, podés clickear el precio o el stock de un producto, escribir el nuevo valor y apretar Enter. Sin modales complejos.
- **Aumento Masivo por Inflación:** Un botón "📈 Aumento Masivo" que permite subir todos los precios de la base de datos en un X% con un solo clic. Vital para la economía argentina.
- **Alertas de Stock Tempranas:** Al iniciar el turno, si hay productos en `0` o bajo el mínimo, aparece un cartel bloqueante alertando qué falta comprar.
- **Alta Rápida de Producto:** Botón "➕ Nuevo" para ingresar mercadería nueva en 10 segundos sin salir de la pantalla de caja.

### 3. Seguridad, Resiliencia y Auditoría
- **Sistema de PINs (Dueño vs Empleados):** Se ingresa con un PIN de 4 dígitos. Los empleados (`rol: employee`) solo pueden cobrar. Los botones de "Stock", "Configuración" y "Auditoría" desaparecen para ellos.
- **Auditoría Visual (Módulo UI):** Pestaña exclusiva para buscar "Quién cambió qué". Trae los registros de la DB y permite filtrar instantáneamente.
- **Backups Automáticos Inteligentes:** Cada 10 minutos, el backend comprime (`gzip`) la base de datos a un archivo de 2MB. Revisa el espacio en disco antes de hacerlo y retiene como máximo los últimos 144 backups (24 horas).
- **Carrito Ghost (Outbox Pattern):** Si el servidor se apaga justo cuando el empleado aprieta "Cobrar", el sistema no explota. Guarda la venta en el `localStorage` de React, lanza un cartel rojo de error, y reintenta enviarla silenciosamente cada 15 segundos hasta que el backend reviva.
- **Egresos de Caja (Retiros):** Botón para registrar salida de dinero (pago a proveedores, sueldos). Evita faltantes a la noche.
- **Cierre de Turno Ciego:** Al terminar, el empleado debe contar los billetes e ingresar el monto antes de saber cuánto dice el sistema que debería haber. El reporte marca sobrantes/faltantes exactos.

### 4. Gestión de Clientes (El famoso "Cuaderno de Fiados")
- Módulo "Fiado (Libreta)" integrado en la DB.
- Permite cobrar una venta mandándola a la cuenta corriente de "Doña Rosa".
- Se ven los totales adeudados por persona y se pueden marcar como "Cobrados" cuando traen la plata, reflejándose en los ingresos del día.

### 5. Impresión y Tickets Térmicos
- **Formato Retail 80mm:** Diseñado específicamente en CSS para ticketeras térmicas estándar sin necesidad de configurar márgenes.
- **Transparencia Fiscal:** Cumple con la normativa 2025 de desglosar el IVA en la base del ticket.
- **Personalización:** Un modal de "Configuración del Negocio" permite al dueño cambiar el nombre del Kiosco, CUIT, Dirección y saludo final sin tocar el código.

---

## 🔮 Lo que falta (Próximos Pasos / Roadmap)

El sistema ya es funcional para instalar en un kiosco real mañana mismo. Sin embargo, para competir con software de gama alta, sugiero avanzar en las siguientes áreas (Tier 2):

### 1. Sincronización a la Nube (Modo Híbrido)
- **El problema:** Don Julio tiene 3 kioscos en diferentes barrios. Quiere ver la caja del Kiosco 1 desde su celular en su casa. Actualmente la BD está aislada en la PC local.
- **Solución:** Crear un servicio en segundo plano que, cuando haya internet, replique las ventas de SQLite local a un servidor central (Supabase / Postgres). El local es la "fuente de verdad" operativa, la nube es solo "read-only" para reportes.

### 2. Estructura de "Bultos" vs "Unidades"
- **El problema:** Comprás una "Gruesa de Marlboro" (1 bulto) pero vendés "Atados" (10 unidades). Hoy hay que cargar las unidades a mano.
- **Solución:** Permitir asociar productos padre-hijo. Al entrar 1 Gruesa, el sistema sabe que son +10 atados al stock de venta.

### 3. Categorías Reales de Productos
- **El problema:** Hoy los productos están sueltos.
- **Solución:** Agregar el campo `category_id`. Permitirá filtrar en el inventario y, sobre todo, hacer **aumentos masivos por categoría** (Ej: "Aumentar 10% solo a Golosinas").

### 5. Módulo de Proveedores / Compras
- **El problema:** Cargar una factura de 50 ítems de Arcor sumando stock a mano uno por uno es lento.
- **Solución:** Pantalla de "Ingreso de Mercadería". Escaneás el remito, pones las cantidades, y si los precios de costo subieron, te sugiere aumentar el precio de venta en el acto para mantener el margen.

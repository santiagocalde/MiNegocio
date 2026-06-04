# 🏪 NovaStock - Kiosco POS System

NovaStock es un sistema de Punto de Venta (POS) y gestión de inventario, diseñado para ser "a prueba de balas" en kioscos, despensas y minimercados argentinos. Construido para correr offline, en computadoras de bajos recursos, con un enfoque maníaco en la velocidad de cobro, la concurrencia segura y la prevención de pérdida de datos.

## 🚀 Características Principales (Hardened para Producción)
- **Offline-First Real:** Sin dependencias de la nube. Los datos viven en la PC del kiosco (SQLite WAL Mode), permitiendo facturar aunque no haya internet.
- **Multicaja Seguro (Async Locks):** FastAPI gestiona de manera centralizada la base de datos local. Las peticiones concurrentes se manejan atómicamente (`BEGIN IMMEDIATE` + `asyncio.Lock`), evitando _race conditions_ entre cajas.
- **Outbox Pattern & Idempotency Keys:** Si la red local (LAN) falla temporalmente, las ventas no se pierden. El frontend las guarda en `localStorage` con un UUID y las reintenta en segundo plano sin duplicar cobros.
- **Backups Blindados (Integrity Checked):** Cada 10 minutos, el sistema genera un backup `.db.gz` comprimido. **Crucial:** Cada backup es descomprimido y validado al vuelo con `PRAGMA integrity_check` antes de guardarse. Si el disco está casi lleno, se suspenden inteligentemente.
- **Aumentos Masivos:** Ideal para contextos inflacionarios. Botón de aumento porcentual que aplica a toda la base de datos de manera atómica con un solo clic.

## 🛠️ Stack Tecnológico
- **Frontend:** React 19 + Vite (UI reactiva e instantánea, despliegue estático).
- **Backend:** Python 3.10+ + FastAPI (Manejo asíncrono, súper ligero).
- **Base de Datos:** SQLite (`aiosqlite`) en modo WAL.
- **Empaquetado:** Inno Setup (`.exe` instalador) para Windows 7/10.

## 📁 Documentación Disponible
- `RESUMEN_PROYECTO.md`: Detalles técnicos, funcionales y arquitectónicos del sistema.
- `GUIA_USUARIO_NOVASTOCK.md`: Manual operativo no-técnico para imprimir y dejarle al dueño (Don Julio).
- `STRESS_TEST_PROTOCOL.md`: Protocolo de QA exhaustivo para someter el sistema a estrés extremo (ráfagas paralelas sin delay) antes de certificar la instalación.

## ⚡ Instalación y Uso Rápido
1. Ejecuta el archivo `Instalar_NovaStock.exe` (Generado vía Inno Setup).
2. El sistema se instalará en `C:\NovaStock` y creará los accesos directos.
3. El servidor backend arrancará automáticamente.
4. Abre el navegador web y accede a `http://localhost:8000`.

---
*Desarrollado para la realidad operativa del comercio minorista argentino.
*Prueba de cambio - OpenCode*

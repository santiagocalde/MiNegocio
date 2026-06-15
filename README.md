# 🏪 MiNegocio App - Sistema SaaS B2B

MiNegocio App es un sistema de Punto de Venta (POS) y gestión de inventario, diseñado específicamente para ser intuitivo, a prueba de balas y operar de forma híbrida (Offline-first) para kioscos, despensas y comercios en Latinoamérica.

## 🚀 Arquitectura Técnica

El sistema está construido con una arquitectura moderna diseñada para alta concurrencia y despliegue rápido:

### Frontend (React + Vite)
- **Offline-First:** Uso de `localStorage` mediante patrón *Outbox* para guardar ventas de forma local si se corta internet. Sincronización automática cuando vuelve el Wi-Fi.
- **Módulos Independientes:** Arquitectura basada en Features (POS, Catálogo, Historial, Fiados, Configuración).
- **Diseño Moderno:** Tema "Ocean Dark" con animaciones y UX optimizado para lectores de códigos de barra (Zero-click checkout).

### Backend (FastAPI + Python)
- **Multi-Tenant:** Base de datos PostgreSQL para manejar cientos de kioscos, separando los datos lógicamente.
- **Pagos Automáticos:** Integración oficial con MercadoPago (Suscripciones / Preapproval) y Webhooks para dar de alta cuentas de forma automatizada.
- **Emails Automatizados:** Cron-jobs (`asyncio`) para mandar emails recordatorios usando la API de Resend (Día 2, 4, 6 y 7 de la prueba gratis).

### Despliegue (Docker)
Todo el sistema está dockerizado (`docker-compose.yml`) e incluye:
- `db`: PostgreSQL 15.
- `backend`: Uvicorn + FastAPI.
- `frontend`: React SPA servido vía Nginx.

## 🔧 Configuración para Desarrollo

1. Clona el repositorio:
```bash
git clone https://github.com/santiagocalde/MiNegocio.git
cd MiNegocio
```

2. Crea el archivo `.env` en la raíz (usa las credenciales de Producción de MP y Resend).

3. Levanta el entorno con Docker:
```bash
docker-compose up --build -d
```

4. Accede a `http://localhost:8000` para el Backend y `http://localhost` para la App.

## 💰 Modelo de Suscripción (SaaS)
El sistema incluye Planes Gated (Simple, Pro, IA). El código incluye la restricción de features basado en la suscripción del negocio en la base de datos PostgreSQL.

---
*Desarrollado con ❤️ para empoderar a los comercios locales.*

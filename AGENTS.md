# AGENTS.md — Contexto para OpenCode

Este archivo da contexto a los agentes de OpenCode sobre el proyecto MiNegocio POS.
Para reglas de arquitectura detalladas, ver también `CLAUDE.md` (aplica igual).

## Qué es el proyecto

MiNegocio POS — SaaS para kioscos y negocios argentinos. Backend FastAPI + Frontend React (Vite).

- **Backend dual**: SQLite (offline, un archivo por negocio) o PostgreSQL (cloud) según `DATABASE_URL`. Toda query SQL debe funcionar en ambos motores (`if USE_PG: ... else: ...`).
- **Multi-tenancy**: `TenantMiddleware` en `main.py` saca `business_id` del JWT. Todo endpoint usa `_biz_id()`, nunca hardcodea el business.
- **Planes**: Trial → Simple → Pro → IA. `check_plan_limits()` en `main.py` corta con 402.
- **Real-time**: SSE en `/api/events` para ventas y stock.
- **Diseño**: Ocean Dark, sin Tailwind, variables CSS propias. Ver `DESIGN_SYSTEM.md`.

## Estructura

- `backend/main.py` — entrypoint monolítico (app factory, middleware, JWT, plan gating, tasks).
- `backend/routers/` — auth, products, sales, inventory, cashier, reports, billing, config, admin, promotions, ai, system.
- `frontend/src/hooks/useBackend.js` — estado central (catálogo, SSE, health polling, offline outbox).
- `frontend/src/services/apiClient.js` — fetch wrapper con JWT + refresh silencioso.
- `frontend/src/features/` — un archivo por módulo (CajaModule, InventoryModule, PurchasesModule, etc.).

## Comandos

### Frontend (`/frontend`)
- `npm run dev` — dev server puerto 5175
- `npm run build` — build producción
- `npm run lint` — ESLint
- `npm test` — tests (Vitest)

### Backend (`/backend`)
- `uvicorn main:app --reload --port 8000` — dev server
- `pytest` — tests (asyncio_mode = auto)
- `ruff check .` — lint

## Infraestructura y Deploy

### Servidor de producción (Hetzner)
- **IP Tailscale**: `100.85.235.24` (usar siempre esta — el puerto 22 público está bloqueado por ISP)
- **IP pública**: `204.168.171.16`
- **Usuario**: `root`
- **Repo en servidor**: `/root/MiNegocio` — branch `main`
- **Stack**: docker-compose con `minegocio-frontend`, `minegocio-backend`, `minegocio-db` (Postgres)

### Flujo de deploy
1. Cambios → `git commit` + `git push` a GitHub (`https://github.com/santiagocalde/MiNegocio.git`)
2. En el servidor: `cd /root/MiNegocio && git pull && docker-compose up --build -d`
3. Verificar: `docker ps` (los 3 contenedores deben estar `healthy`)

### CI
- `.github/workflows/ci.yml` corre en push a `main`: ruff + pytest (backend), lint + build (frontend).

## Reglas de trabajo

- **Nunca romper producción**: antes de deployar, correr tests. Si algo falla en prod, revertir con git.
- Toda query SQL debe funcionar en SQLite y PostgreSQL.
- Todo endpoint scopeado por tenant con `_biz_id()`.
- No agregar Tailwind ni estilos default — usar el sistema Ocean Dark.

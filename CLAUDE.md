# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (`/frontend`)
```bash
npm run dev        # Dev server on port 5175
npm run build      # Production build
npm run lint       # ESLint
npm test           # Run tests once (Vitest)
npm run test:watch # Watch mode
```

### Backend (`/backend`)
```bash
uvicorn main:app --reload --port 8000   # Dev server
pytest                                   # Run all tests (asyncio_mode = auto)
python create_admin.py                   # Seed a superadmin account
```

### Docker (full stack)
```bash
docker-compose up --build -d   # Build and start all services
docker-compose logs -f backend # Stream backend logs
```

### Environment
Copy `.env` to the project root (`MiNegocio/.env`). Key variables: `DATABASE_URL`, `JWT_SECRET`, `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID`, `RESEND_API_KEY`, `APP_ENV`, `SAAS_MODE`.

---

## Architecture

### Dual-Database Pattern (Critical)
The backend runs in two modes determined by `USE_PG = bool(DATABASE_URL)`:
- **SQLite** (`aiosqlite`): local/offline mode for individual kiosks.
- **PostgreSQL** (`asyncpg`): cloud SaaS mode via Docker/Hetzner VPS.

**Every SQL query must be written to work on both engines.** Use the `if USE_PG: ... else: ...` guard throughout routers. Known pitfalls already fixed:
- `timestamp::date` (PG) vs `date(timestamp)` (SQLite)
- Strict `GROUP BY` rules in PG require subquery workarounds

### Multi-Tenancy
All requests go through `TenantMiddleware` in `main.py`, which extracts `business_id` from the JWT and stores it in a `contextvars.ContextVar` (`business_id_ctx`). All DB queries implicitly scope to the current tenant via a helper `_biz_id()`. In SQLite mode, the middleware also routes `aiosqlite.connect()` to the tenant's own database file (`data/minegocio_{business_id}.db`).

Every router endpoint must call `_biz_id()` (not hardcode a business ID), except public auth routes (`/auth/login`, `/auth/register`).

### Backend Structure (`/backend`)
- `main.py` — monolithic entry point: app factory, middleware, JWT helpers, plan gating (`check_plan_limits`), background tasks (billing, trial emails via `asyncio`), and most route logic still lives here alongside the routers.
- `routers/` — domain routers: `auth`, `products`, `sales`, `inventory`, `cashier`, `reports`, `billing`, `config`, `admin`, `promotions`, `ai`, `system`.
- `db.py` / `db_helpers.py` — PostgreSQL pool management; `db_helpers.py` is being phased out.
- `core/dependencies.py` — **deprecated**, scheduled for removal; auth logic lives in `main.py`.
- `event_stream.py` — Server-Sent Events (SSE) implementation for `/api/events`.
- `services/` — AI invoice reading (`ai_service.py`), AFIP integration (`afip_service.py`), Resend email (`email_service.py`).

### Frontend Structure (`/frontend/src`)
- `hooks/useBackend.js` — central state manager: product catalog cache, SSE connection, health polling (every 5s), offline outbox sync, daily sales summary (`resumenData`). Most app state flows through here.
- `services/apiClient.js` — fetch wrapper with 15s timeout, JWT bearer injection, silent token refresh (single in-flight refresh promise to avoid race conditions), and `clearSession()` on 401.
- `features/` — one file per module: `CajaModule.jsx` (POS), `InventoryModule.jsx`, `PurchasesModule.jsx`, `ReportsModule.jsx`, `FiadoModule.jsx`, `StockModule.jsx`, `AuditModule.jsx`, etc.
- `components/` — shared UI: `ConfigModal.jsx`, `SetupWizard.jsx`, `TicketPrint.jsx`, plus `pos/` and `ui/` subdirs.
- `context/` — React context providers.
- `pages/` — top-level route pages.

### Subscription / Plan Gating
Plans: Trial (7 days), Simple, Pro, IA. `check_plan_limits()` in `main.py` enforces feature gates and returns `402 Payment Required` when limits are exceeded. The IA plan unlocks AI invoice reading in `PurchasesModule`. MercadoPago Preapproval webhooks (in `routers/billing.py`) automatically activate and update subscriptions.

### Real-Time
SSE via `/api/events` pushes new-sale and stock-update events. `useBackend.js` listens and updates `resumenData` and stock alerts without polling.

### Design System (Ocean Dark)
CSS custom properties only — no Tailwind. Key values: background `#0B132B`, primary accent `#14BBA6`, highlight `#00E5FF`. Cards use glassmorphism (`backdrop-filter: blur(10px)`, `rgba(255,255,255,0.015)`). All UI must be polished, dark, and premium — avoid default browser styles or generic placeholder aesthetics. See `DESIGN_SYSTEM.md` for the full palette and button classes.

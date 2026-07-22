# CLAUDE.md — MiNegocio (Guía Definitiva)

## 🧠 Cómo usar este archivo
Cada vez que inicies una sesión de Claude Code en este proyecto, este archivo
se carga automáticamente y define cómo debés trabajar. No necesitás archivos
externos ni URLs — toda la verdad está acá.

---

## 🚦 Sistema de Trabajo (3 Modos)

Antes de tocar código, definí en qué modo estás y creá la rama correspondiente:

### Modo 1: FEATURE (`feature/nombre`)
Nueva funcionalidad. Branchear de `main`.
```bash
git checkout main && git pull origin main
git checkout -b feature/descripcion-breve
```
Reglas: tests pasan, no rompe compatibilidad SQLite, no mezcla 2 features distintas.

### Modo 2: FIX (`fix/nombre`)
Bug o problema urgente. Branchear de `main`.
```bash
git checkout main && git pull origin main
git checkout -b fix/descripcion-del-bug
```
Reglas: mínimo cambio posible, una sola preocupación, test que reproduce el bug.

### Modo 3: MAIN (`main`)
⚠️ **PROHIBIDO trabajar directo en main.** Solo merges desde feature/fix.
Si alguien te pide tocar main, recordale que las ramas existen por algo.

---

## 🔒 Reglas de Seguridad (NO NEGOCIABLES)

### Secretos y credenciales
- **NUNCA hardcodear** secretos, tokens, contraseñas, API keys.
- Todo secreto vive en variables de entorno (`.env`) y se lee con `os.getenv()`.
- La fuente única de JWT es `backend/core/config.py`. Ningún otro archivo
  debe definir `JWT_SECRET` ni `JWT_ALGORITHM`.
- Si encontrás credenciales hardcodeadas, las movés a `.env` y referenciás
  desde `config.py`. Esto ya pasó antes (create_admin.py, billing.py, admin.py
  tenían credenciales sueltas). No repetir el error.

### Rate Limiting
- Nuevos endpoints de auth, admin, AI, billing y productos DEBEN usar el
  rate limiter centralizado en `backend/core/ratelimit.py`.
- Mirá los commits `dcbfce1` y `5900595` como referencia del patrón.

### Configuración frontend
- URLs de API se definen en `frontend/src/config.js`.
- No hardcodear `localhost:8000` ni `204.168.171.16` en ningún componente.

---

## 🗄️ Regla de Oro: Compatibilidad SQL Dual

El backend funciona en **dos motores** y todo query nuevo debe andar en ambos:

| Contexto | Motor | Archivo |
|---|---|---|
| Modo Local (kiosco offline) | SQLite (`aiosqlite`) | `data/minegocio_{id}.db` |
| Modo SaaS (producción) | PostgreSQL (`asyncpg`) | Docker `db` container |

### Checklist obligatorio para cada endpoint nuevo:
```
☐ ¿Usa `if USE_PG: ... else: ...` para queries diferentes?
☐ ¿GROUP BY incluye todas las columnas no agregadas? (PG es estricto)
☐ ¿Usa `timestamp::date` en PG y `date(timestamp)` en SQLite?
☐ ¿Probaste el endpoint con USE_PG=True y USE_PG=False?
```

### Errores que YA PASARON (no repetir):
1. `date(timestamp)` funciona en SQLite pero rompe en PostgreSQL → usar `timestamp::date` en PG
2. `GROUP BY` con columnas sueltas anda en SQLite pero PG exige todas → subconsultas correlacionadas
3. Schema `business_config` clave-valor en SQLite vs. columnas anchas en PG → ya alineado en commit `d76da6e`

---

## 🐳 Infraestructura

### Servidor
- **Host:** Ubuntu 26.04 en Hetzner VPS (204.168.171.16)
- **Docker Compose** en `/root/MiNegocio/docker-compose.yml`
- **Contenedores:** `minegocio-backend-1`, `minegocio-frontend-1`, `minegocio-db-1`
- **PostgreSQL:** puerto 5432 solo en localhost (no expuesto)
- **Backend:** puerto 8000 solo en localhost (nginx es el proxy)
- **Frontend:** puertos 80/443 (nginx con SSL self-signed)

### Firewall y Seguridad
- **UFW:** activo, solo permite 22/tcp (SSH), 80/tcp, 443/tcp
- **fail2ban:** SSH jail activa (3 intentos = baneo 24h)
- **Swap:** 2GB permanente

### Comandos útiles
```bash
# Deploy (después de pushear cambios a la rama)
cd /root/MiNegocio && git pull && docker compose up -d --build

# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Health check
curl -sk https://localhost/api/health

# Backup manual
/root/backups/pg_backup.sh

# Verificar fail2ban
fail2ban-client status sshd
```

---

## ✅ Checklist Pre-Commit

Antes de commitear, ejecutá esto **siempre**:

```bash
# 1. Buscar secretos hardcodeados (no debe devolver nada tuyo)
grep -rn "sk-\|api_key\|secret\|password\|token" backend/ frontend/src/ \
  --include="*.py" --include="*.js" --include="*.jsx" \
  | grep -v "os.getenv\|config.py\|\.env\|JWT_SECRET\|import\|#"

# 2. Verificar compatibilidad SQL
grep -rn "USE_PG" backend/routers/ backend/main.py | wc -l
# Debe ser > 0 si tocaste queries nuevos

# 3. Tests (si tocaste backend)
cd backend && python -m pytest -x -q 2>&1 | tail -5

# 4. Lint frontend (si tocaste frontend)
cd frontend && npm run lint 2>&1 | tail -5

# 5. Verificar que no tocaste main sin rama
git branch --show-current
# Si dice "main" → CANCELAR, crear rama feature/ o fix/
```

---

## 📂 Estructura del Proyecto

```
/root/MiNegocio/
├── CLAUDE.md              ← este archivo (fuente de verdad)
├── CONTEXT_PARA_CLAUDE.md ← contexto de negocio y arquitectura
├── DESIGN_SYSTEM.md       ← paleta de colores y diseño Ocean Dark
├── README.md              ← documentación pública
├── docker-compose.yml     ← infraestructura
├── .env                   ← variables de entorno (¡NUNCA commitear!)
├── backend/
│   ├── main.py            ← app factory, middleware, rutas legacy
│   ├── core/
│   │   ├── config.py      ← JWT, settings (fuente única)
│   │   ├── database.py    ← SQLite init + migraciones
│   │   ├── db.py          ← PostgreSQL pool
│   │   ├── ratelimit.py   ← rate limiter centralizado
│   │   └── plan_limits.py ← gating de planes
│   ├── routers/           ← endpoints por dominio
│   ├── services/          ← AI, AFIP, Email
│   └── tests/             ← pytest (asyncio_mode=auto)
├── frontend/
│   └── src/
│       ├── config.js      ← URLs de API centralizadas
│       ├── hooks/useBackend.js  ← estado global + SSE + polling
│       ├── services/apiClient.js ← fetch wrapper + JWT
│       └── features/      ← módulos (Caja, Inventario, Reportes, etc.)
└── docs/
    └── ESCALABILIDAD.md   ← performance y mejoras aplicadas
```

---

## 🎯 Reglas de Diseño

- **Ocean Dark Theme** — CSS custom properties, NO Tailwind.
- Colores: fondo `#0B132B`, acento `#14BBA6`, highlight `#00E5FF`.
- Cards con glassmorphism: `backdrop-filter: blur(10px)`.
- Touch targets ≥ 44px en POS.
- Plata en pesos enteros, no mezclar decimales.
- Ver `DESIGN_SYSTEM.md` para paleta completa.

---

## 📋 Resumen Rápido (para cuando no querés leer todo)

1. **Nunca main directo** → feature/ o fix/
2. **Nunca hardcodear secretos** → .env + config.py
3. **Siempre SQL dual** → if USE_PG: ... else: ...
4. **Siempre rate limit** en endpoints nuevos de auth/admin/AI
5. **Pre-commit checklist** antes de cada commit
6. **CLAUDE.md es la verdad** → si algo cambia, actualizalo acá

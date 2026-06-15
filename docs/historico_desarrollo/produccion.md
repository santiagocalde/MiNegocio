# MiNegocio POS — Documento de Produccion

## Arquitectura y estrategia de despliegue para PyMEs Argentinas

---

## 1. MODELO DE DATOS MULTI-TENANT

### Database-per-tenant con aislamiento fisico

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI (unico proceso)                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         PostgreSQL — Capa SaaS (nube)                  │  │
│  │  Tablas:  businesses, auth_tokens, plans,               │  │
│  │           testimonials, payment_events                  │  │
│  │  Funcion:  Auth, registro, billing, metadata publica    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         SQLite per-tenant (local/disco)                │  │
│  │  Archivos:  novastock_{uuid}.db                        │  │
│  │  Tablas:  products, sales, stock, turns, operators,     │  │
│  │           config, customers, suppliers, purchases,      │  │
│  │           promotions, sucursales, egresos               │  │
│  │  Funcion:  Datos operativos del kiosco                  │  │
│  │  Aislamiento: un archivo .db por business_id (UUID)     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Ventaja:** Imposible leak entre tenants. Cada negocio tiene su propio archivo SQLite. Si un negocio crece a 10.000 productos, solo afecta su propio archivo.

---

## 2. FLUJO DE REGISTRO Y TRIAL

### Registro
1. Landing → `POST /api/auth/register` (email, password, business_name)
2. Backend crea fila en `businesses` (PostgreSQL) + crea `novastock_{uuid}.db` (SQLite)
3. Plan por defecto: `trial`
4. JWT emitido con `sub = business_id` (sin `plan` en claims)
5. Frontend guarda token en localStorage

### Trial de 7 dias
- **Dia 1-7:** Acceso completo con limites: 50 productos, 2 operadores, sin compras/multi-sucursal
- **Enforcement:** `check_plan_limits()` en cada endpoint de escritura
- **Dia 8+:** Frontend muestra banner rojo bloqueante. Intentos de crear productos/ventas reciben HTTP 402
- **Grace period:** 3 dias extra con banner de advertencia, luego bloqueo total

### Upgrade de plan
1. Usuario va a `/panel/plan` → ve planes (Simple $20K, Pro $30K, IA $40K)
2. Selecciona plan → checkout con Mercado Pago (pendiente API key MP)
3. Webhook de MP actualiza `businesses.plan` y `businesses.status`
4. Renovacion: background task `check_billing_grace_period()` cada 6 horas

---

## 3. LIMITES POR PLAN

| Caracteristica | trial | simple | pro | ia |
|---------------|-------|--------|-----|-----|
| max_products | 50 | 3.500 | 7.000 | 10.000 |
| max_operators | 2 | 2 | 5 | 10 |
| multi_sucursal | No | No | Si | Si |
| purchases | No | Si | Si | Si |
| export_excel | No | No | Si | Si |
| ai_scanner | No | No | No | Si |
| ia_suggestions | No | No | No | Si |
| facturacion ARCA | No | Opcional | Opcional | Opcional |

### Enforcement server-side
- `check_product_limit(business)` en `POST /api/products` y `POST /api/products/import`
- `check_plan_limits(feature, business)` en compras, sucursales, export
- Si se excede: HTTP 402 con mensaje "Alcanzaste el limite de tu plan {plan}. Actualiza a {next_plan}."

---

## 4. ESTRATEGIA DE VPS Y COSTOS

### Opcion A — Gratis (estudiante / portfolio / demo)

| Componente | Donde | Costo |
|------------|-------|-------|
| Frontend (React) | Vercel | $0 (gratis ilimitado) |
| PostgreSQL | Supabase free tier | $0 (500 MB) |
| Backend (FastAPI) | Render free tier | $0 (duerme tras 15min inactivo) |
| Dominio | Namecheap | $12/año (ya pagado) |
| SSL | Automatico (Vercel/Render) | $0 |
| Emails | Resend free tier | $0 (100/dia) |
| **TOTAL** | | **$1/mes (solo dominio)** |

**Limitacion:** Render free duerme el backend. Primer request tarda ~30s en despertar. Para un portfolio o demo universitaria alcanza perfecto.

### Opcion B — Siempre online, costo minimo

| Componente | Donde | Costo |
|------------|-------|-------|
| Todo junto | Oracle Cloud Free Tier | $0 |
| 4 ARM cores, 24 GB RAM, 200 GB disco | | Gratis de por vida |
| Corre Docker Compose (backend + postgres + nginx) | | Sin limite de tiempo |

**Lo unico que necesitas:** una tarjeta de debito/credito para verificar tu identidad (no te cobran nada, es solo anti-fraude).

### Opcion C — Produccion real con clientes

| Componente | Donde | Costo |
|------------|-------|-------|
| VPS | Hetzner CX22 | $6 USD/mes |
| Dominio | Namecheap | $12/año |
| SSL | Let's Encrypt | $0 |
| **TOTAL** | | **~$7 USD/mes** |

---

## 5. BACKUP Y DISASTER RECOVERY

### SQLite tenants
- Backup automatico cada 10 minutos (ya implementado)
- Compresion GZIP con validacion de integridad (`PRAGMA integrity_check`)
- Rotacion: maximo 10 backups por tenant
- Verificacion de espacio en disco (>100MB libre)

### PostgreSQL
- `pg_dump` diario via cron en el VPS
- Rotacion de 30 dias
- Restauracion: `POST /api/backup/restore` (requiere auth admin)

### Plan de recuperacion
1. VPS cae → nuevo VPS con mismo Docker Compose
2. Restaurar PostgreSQL desde dump mas reciente
3. Restaurar SQLite tenants desde backups `.db.gz`
4. Tiempo estimado de recuperacion: <30 minutos

---

## 6. SEGURIDAD EN PRODUCCION

### Checklist obligatorio antes de lanzar
- [x] JWT_SECRET generado aleatoriamente (no el default)
- [x] PG_PASSWORD fuerte (no "1234")
- [x] RESEND_API_KEY en .env (no hardcodeado)
- [x] MP_ACCESS_TOKEN en .env
- [x] Rate limiting en todos los endpoints de auth
- [x] Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- [x] PIN validado server-side con bcrypt
- [x] Refresh token rotation + blacklist
- [x] Plan NO almacenado en JWT (leido de DB en cada request)
- [ ] HTTPS con Let's Encrypt (al deployar en VPS)
- [ ] nginx reverse proxy con security headers
- [ ] Firewall: solo puertos 80/443/22 abiertos
- [ ] `.env` en `.gitignore` (NUNCA commitear)

### Tokens y sesiones
- Access token: 60 minutos. Refresh token: 7 dias con rotacion.
- Logout: revoca el refresh token de la DB
- Sin sesiones persistentes en el navegador

---

## 7. MONITOREO Y ALERTAS

### Health checks
- `GET /api/health` → estado PostgreSQL + espacio en disco
- Frontend verifica `GET /products?limit=1` cada 5s
- SSE `GET /api/events` para cambios en tiempo real

### Logs
- Archivo: `backend/novastock.log` con rotacion
- Niveles: INFO (normal), WARNING (errores recuperables), ERROR (fallos)
- En produccion: enviar a archivo + stdout para Docker logs

### Alertas recomendadas
- Espacio en disco < 100MB → pausar backups, alertar
- PostgreSQL caido → intentar reconexion, alertar
- Mas de 5 tenants suspended → revisar billing
- Tasa de error > 5% en ultimos 100 requests

---

## 8. MANEJO DE DATOS DE CLIENTES

### Que datos guardamos
- **Personales:** email, telefono, nombre del dueño (via onboarding)
- **Negocio:** nombre del kiosco, tipo, direccion (via config)
- **Operativos:** productos, ventas, stock, clientes con fiados

### Donde se guardan
- **PostgreSQL:** email, password_hash, business_name, plan, status
- **SQLite tenant:** productos, ventas, operadores, config, clientes

### Estrategia de IDs
- Cada business tiene un UUID generado por PostgreSQL (`gen_random_uuid()`)
- El UUID es el `business_id` que identifica al tenant en todo el sistema
- Las DBs SQLite se nombran `novastock_{uuid}.db`
- El JWT contiene `sub = uuid` para identificar al tenant en cada request

### Privacidad
- Datos personales solo en PostgreSQL (encriptado en reposo via VPS)
- Datos operativos en SQLite local del VPS
- No compartimos datos entre tenants
- No vendemos datos a terceros

---

## 9. PENDIENTE PARA PRODUCCION (API Keys)

Ver `cambiosprodu.md` para el checklist completo.

### Critico
- [ ] Dominio configurado con DNS → VPS
- [ ] SSL via Certbot/Let's Encrypt
- [ ] nginx reverse proxy configurado
- [ ] `.env` con valores de produccion

### Integraciones
- [ ] Mercado Pago: credenciales productivas para checkout
- [ ] Resend: API key para emails transaccionales
- [ ] Gemini Vision: API key para escaner IA de facturas (plan IA)

### Opcional futuro
- [ ] ARCA/AFIP: certificados digitales para facturacion electronica
- [ ] Google Analytics o Plausible para metricas de landing
- [ ] PostHog para analitica de producto
- [ ] PWA: service worker para modo offline

---

## 10. FLUJO COMPLETO DE UN CLIENTE NUEVO

```
1. Landing (minegocio.com)
   ↓ click "Probar Gratis 7 Dias"
2. Onboarding (9 pasos)
   - Telefono, email, nombre, negocio, tipo, experiencia, ARCA, objetivo
   ↓ POST /api/auth/register
3. Cuenta creada (PostgreSQL + SQLite tenant)
   - Plan: trial, 7 dias, 50 productos max
   ↓ redirect /panel
4. PIN Login
   - PIN 4-6 digitos → POST /api/login → turno abierto
   ↓
5. Modales iniciales
   - "Abrir mi caja" → monto inicial → POST /api/turns
   - "Crear contraseña" → PIN admin → PUT /api/operators
   ↓
6. Panel POS
   - Cargar productos (manual, CSV, o escaner IA)
   - Empezar a vender
   - Cerrar caja al final del dia
   ↓
7. Dia 7: banner "Tu prueba esta por vencer"
   ↓
8. Dia 8+: bloqueo de funcionalidad
   - No puede crear mas productos ni ventas nuevas
   - Puede ver datos historicos y exportar
   - Banner rojo con link a /panel/plan
   ↓
9. Elige plan → checkout Mercado Pago → plan activado
   ↓
10. Uso continuo con facturacion mensual/anual
```

---

*Documento generado el 13/06/2026 — MiNegocio POS v2.0 listo para produccion*

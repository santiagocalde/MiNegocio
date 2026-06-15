# Cambios Pendientes para Produccion

## Landing Page
- [x] **Mockup del Producto en el Hero:** Agregar una captura de pantalla estilizada, render 3D o "glass effect" de la interfaz del punto de venta en la seccion principal superior.

## APIs Implementadas (Backend OK)

### Auth
- [x] **POST /api/auth/forgot-password** — Recibe `{ email }`, genera token JWT de un solo uso (expira en 1 hora) y lo guarda en PostgreSQL. **Pendiente: envio de email con link de reset.** Requiere configurar RESEND_API_KEY en `.env` para que el endpoint envie el correo real. Sin la key, el endpoint responde 200 con el token en logs (modo desarrollo).
- [x] **POST /api/auth/reset-password** — Recibe `{ token, new_password }`, valida el token JWT y actualiza la contrasena en PostgreSQL.

### Contacto
- [x] **POST /api/send-contact-email** — Recibe `{ nombre, contacto, mensaje }`, envia un email a upcodednow@gmail.com via Resend. Ya conectado desde `LandingPage.jsx` y `ContactoPage.jsx`.

### Planes
- [x] **GET /api/plans** — Devuelve array de planes con precios mensuales/anuales, features y limites. Datos servidos desde tabla `plans` en PostgreSQL.

### Metricas (Dashboard / Landing)
- [x] **GET /api/metrics** — Devuelve `{ kioscos_activos, ventas_procesadas, disponibilidad, puntuacion }`. Conectado a `LandingSocialProof.jsx`.

### Testimonios
- [x] **GET /api/testimonials** — Devuelve array de `{ id, text, name, business, stars, is_verified }`. Conectado a `LandingTestimonials.jsx`. Servido desde tabla `testimonials` en PostgreSQL.

### Onboarding / Registro
- [x] **Onboarding → POST /api/auth/register** — El formulario de 9 pasos ahora registra al usuario en el backend al finalizar. Campos: `telefono`, `email`, `nombre`, `negocio`, `tipo`, `posPrevio`, `arca`, `objetivo`.

### Preview
- [x] **Ruta /preview** — Creada (`PreviewPage.jsx` → `/panel?preview=true`). El PanelLayout ya detecta `preview-token` y activa `demo-mode` (solo lectura + banner azul).

## APIs Pendientes (Requieren API Keys)

### Pagos / Planes
- [ ] **POST /api/checkout/create-preference** — Recibe `{ plan_id, is_yearly, users_limit, nombre, apellido, telefono, user_id }`, crea preferencia de Mercado Pago y devuelve `init_point`. **Requiere `MP_ACCESS_TOKEN` y `MP_COLLECTOR_ID` en variables de entorno del backend.** El frontend `CheckoutView.jsx` ya esta preparado para recibir el `init_point` y redirigir a Mercado Pago.
- [x] **POST /api/webhooks/mercadopago** — Webhook de Mercado Pago YA EXISTE en `backend/routers/system.py:525`. Maneja `subscription_preapproval`, `subscription_authorized_payment`, `payment` events. Actualiza `businesses.status` y `businesses.plan` automaticamente.

### Emails
- [ ] **Envio de email en forgot-password** — El endpoint `POST /api/auth/forgot-password` ya genera y almacena el token. Falta integrar Resend para enviar el correo con el link de reset. **Requiere `RESEND_API_KEY` en `.env`.** Linea a descomentar en `auth.py` cuando la key este disponible.

## Seguridad - Medidas Recomendadas

### Frontend (implementado)
- [x] **Sanitizacion de inputs:** React escapado automatico de JSX previene XSS basico.
- [x] **Validacion de formularios:** Email requiere `@`, telefono solo digitos en Onboarding, campos requeridos validados antes de submit.
- [x] **Tokens demo aislados:** `preview-token` y `demo_token_7days` se limpian automaticamente al visitar la landing.
- [x] **Cierre de sesion:** Limpia `localStorage` completo y recarga la pagina.
- [x] **Validacion de contrasenas:** Minimo 8 caracteres, al menos 1 numero y 1 mayuscula (frontend + backend).

### Backend (implementado)
- [x] **Rate limiting:** Implementado en endpoints de auth (`/api/auth/login` 5/min, `/api/auth/forgot-password` 3/15min).
- [x] **Base de datos PostgreSQL:** Migrado de SQLite a PostgreSQL para capa SaaS (auth, businesses, planes, testimonials). Las DBs por tenant siguen en SQLite local.

### Backend (pendiente)
- [ ] **CSRF protection:** Si se migra de token en localStorage a cookies, implementar tokens CSRF (SameSite=Strict).
- [ ] **httpOnly cookies:** Evaluar migrar `saas_token` de localStorage a cookie httpOnly+Secure+SameSite para prevenir robo por XSS.
- [ ] **CORS:** Restringir origenes permitidos en el backend a solo el dominio de produccion.
- [ ] **Expiration de tokens:** JWT con expiracion corta (15 min) + refresh token rotativo.
- [ ] **Sanitizacion de archivos:** Si se permite upload de imagenes (facturas, logos), validar tipo MIME y tamano maximo.
- [ ] **API key de Mercado Pago:** Almacenar en variables de entorno, NUNCA en el codigo fuente ni en el frontend. Ya configurado el soporte de lectura desde `.env`.

### Infraestructura
- [ ] **HTTPS:** Forzar redireccion de HTTP a HTTPS en el servidor.
- [ ] **nginx security headers:** Agregar en `nginx.conf`: `add_header X-Frame-Options "DENY"; add_header X-Content-Type-Options "nosniff"; add_header Referrer-Policy "strict-origin-when-cross-origin";`
- [x] **PostgreSQL en Docker:** Agregado servicio `postgres` en `docker-compose.yml` con volumen persistente.

## Mejoras Futuras
- [ ] Agregar `react-helmet-async` para titulos y meta tags dinamicos por pagina.
- [x] Pagina de "Terminos y Condiciones" y "Politica de Privacidad" (ya existen rutas `/terminos` y `/privacidad`).
- [ ] Analiticas (Google Analytics, Facebook Pixel, Hotjar).
- [ ] Convertir `mascota_oficial.jpg` (1.9 MB) a WebP.
- [x] Agregar tests unitarios con Vitest + React Testing Library (ya existen en `frontend/src/tests/`).
- [ ] PWA: service worker para modo offline y cache de assets.

---

# APIs que Requieren API Keys Externas (Resumen Final)

## Mercado Pago (Pagos y Suscripciones)
- [ ] Configurar `MP_ACCESS_TOKEN` y `MP_COLLECTOR_ID` en `.env`
- [ ] Activar `POST /api/checkout/create-preference` para suscripciones SaaS
- [ ] Conectar `CheckoutView.jsx` al `init_point` de MP (redirigir al usuario al checkout)
- [x] Webhook `POST /api/webhooks/mercadopago` YA EXISTE en `system.py:525`

## Resend (Emails Transaccionales)
- [ ] Configurar `RESEND_API_KEY` en `.env`
- [ ] Descomentar bloque de envio de email en `auth.py:forgot-password` (lineas con TODO)
- [ ] Verificar dominio en Resend (minegocio.com)
- [x] API key hardcodeada removida de `system.py` — ahora lee de `os.getenv`

## Google AI / Gemini Vision (Escaner IA de Facturas)
- [ ] Obtener API key de Google AI Studio (https://aistudio.google.com)
- [ ] Configurar `GOOGLE_AI_API_KEY` en `.env`
- [ ] Implementar `ai.py:scan-invoice` con llamada real a Gemini Vision
- [x] Frontend `PurchasesModule.jsx` ya tiene input file real con `FormData` → `POST /api/ai/scan-invoice`

## AFIP / ARCA (Facturacion Electronica)
- [ ] Cada comercio (CUIT) necesita obtener su certificado .crt/.key de ARCA
- [ ] Crear vault endpoint `POST /api/vault/certificates` para que el comercio suba sus certificados
- [ ] Implementar emision de Factura A/B/C con CAE via `pyafipws` en `sales.py`
- [ ] Frontend: seccion "Facturacion ARCA" en ConfigPage

## Dominio, SSL e Infraestructura
- [ ] Contratar VPS (Hetzner CX22 ~$6/mes)
- [ ] Configurar DNS del dominio (Namecheap) → IP del VPS
- [ ] Certificado SSL via Certbot + Let's Encrypt
- [ ] nginx reverse proxy con HTTPS forzado y security headers
- [ ] Firewall: solo puertos 80, 443, 22
- [ ] `.env` de produccion con todas las variables (JWT_SECRET, PG_PASSWORD, etc.)

## Metricas, Testimonios y Datos
- [x] Endpoints creados: `GET /api/metrics`, `GET /api/testimonials`, `GET /api/plans`
- [x] Conectados al frontend con fallback a datos mock
- [ ] Los datos reales se poblaran automaticamente cuando haya businesses reales en PostgreSQL
- [ ] Testimonios verificados se pueden cargar via seed SQL en PostgreSQL

---

# Premortems — Documentacion para Futuro (No Bloqueantes Ahora)

## Mercado Pago — Manejo de Rate Limiting (Premortem #5, #18)
- [ ] Agregar manejo de HTTP 429 en `POST /api/mercadopago/create-payment` con retry after 5s
- [ ] Agregar timeout de 60s para QR de MP: si el cliente no paga en 60s, el modal no se cancela automaticamente
- [ ] Cuando llega webhook con pago aprobado y la venta NO existe en la DB, crearla automaticamente (Premortem #18)
- [ ] Requiere: `MP_ACCESS_TOKEN` y `MP_COLLECTOR_ID` en `.env`

## AFIP/ARCA — Facturacion Asincrona (Premortem #12)
- [ ] La emision de factura electronica debe ser async: guardar la venta localmente, poner el ticket en cola de emision
- [ ] Si ARCA esta caido, el POS no se bloquea — la factura se emite cuando el servicio vuelve
- [ ] Webhook o polling para verificar estado de facturas pendientes
- [ ] Requiere: certificados .crt/.key por cada CUIT de comercio

## Turnos — Cierre Automatico Madrugada (Premortem #11)
- [ ] Cron job en backend que cierre turnos abiertos a las 04:00 AM con nota "Cierre automatico por horario"
- [ ] Usar `_ensure_open_turn` o nueva funcion `auto_close_all_turns`
- [ ] Implementar como background task en main.py

## Database Lock — Webhooks vs SQLite (Premortem #19)
- [ ] Evaluar migracion de SQLite → PostgreSQL para la nube (solo capa operativa)
- [ ] Mientras tanto: usar cola de webhooks (Redis o tabla SQLite) para desacoplar escrituras
- [ ] El webhook de MP escribe en una tabla temporal, un worker procesa despues

## Pagos con QR — Timeout del Modal (Premortem #18)
- [ ] Agregar contador regresivo en el modal de QR (60s)
- [ ] Al expirar, mostrar mensaje "El QR expiro. Genera uno nuevo o paga en efectivo"
- [ ] No cancelar automaticamente la venta, solo ocultar el QR

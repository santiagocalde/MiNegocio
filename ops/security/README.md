# Endurecimiento de seguridad — MiNegocio (server de producción)

Preparado tras el incidente del **2026-08-17** (CPU al 200% por un flood de bots de
`cms.city` que, vía Cloudflare, resolvían a la IP del origin y recibían la app entera,
crawleando todos los assets → el `access.log` se infló a 176 MB → fail2ban **y** CrowdSec
se clavaron leyéndolo).

> **Objetivo #1: que ese flood no vuelva a pegarnos en el CPU.**
> **Objetivo #2: reducir la superficie de ataque en general (defensa en profundidad).**

Todo esto se aplica en el **host** (no en los contenedores). El nginx es un proceso del
sistema (systemd), no está en el `docker-compose`. Esta carpeta versiona la config y los
runbooks — antes vivían solo en el server, sin respaldo.

---

## Qué frena EXACTALMENTE lo que pasó hoy (origen-side) — PRIORIDAD REAL

El flood de `cms.city` **entra por Cloudflare** (los bots le pegan a `docs.cms.city`,
`app.cms.city`, etc., que apuntan a nuestra IP). Por eso:

- ❌ El firewall "solo Cloudflare" **NO lo frena** (viene *de* Cloudflare).
- ❌ Las reglas de nuestro Cloudflare **NO lo frenan** (cms.city está en OTRA cuenta CF).
- ✅ **Solo se frena en el ORIGIN.** Y ya está medio hecho (el corte por Host de hoy).

### Medida 1 — `access_log off` para hosts que no son mi-negocio.app  ⭐ LA CLAVE
Hoy los bots de cms.city reciben `444` (bien), **pero se siguen logueando**. Ese log es lo
que floodea a fail2ban/CrowdSec. Si NO los logueamos, el flood se vuelve **gratis**: 444 +
sin log → los IPS nunca ven nada → el CPU nunca sube, manden lo que manden.

- **Riesgo:** muy bajo. No afecta el servicio; solo deja de loguear tráfico basura.
- **Cómo:** ver `nginx-hardening.md` (un `map` + `access_log ... if=$loggable`).
- **Recomendación: aplicar YA** (es la que evita la recurrencia y es segura).

### Medida 2 — Tope de tamaño al log (rotación por tamaño)
Backstop: aunque algo se loguee, que **ningún log llegue a 176 MB**. Rotar por tamaño
(p.ej. 50 MB) además del diario. Así, si un IPS se despierta, nunca tiene un archivo gigante.

- **Riesgo:** nulo. Ver `nginx-hardening.md`.

### Medida 3 — Guardarraíl en fail2ban/CrowdSec
Que un pico de log no los deje leyendo horas. Opcional; con Medida 1 casi no hace falta.
Ver `nginx-hardening.md` (nota final).

---

## Hardening general (defensa en profundidad) — reduce superficie, no frena cms.city

### Medida 4 — Firewall: 80/443 solo desde Cloudflare
Hoy ufw permite 80/443 desde *cualquier lado*. Restringir a los rangos de Cloudflare hace
que los **escaneos directos a la IP** (CVEs, backdoors — los que CrowdSec viene baneando) se
descarten en el kernel, sin tocar nginx.

- **Script:** `ufw-cloudflare-lock.sh` (idempotente, refresca la lista de IPs de CF).
- ⚠️ **FOOTGUN:** si la lista de CF queda incompleta, tráfico legítimo de CF se DESCARTA en
  el firewall (silencioso, difícil de diagnosticar — le pasó a opencode a nivel nginx). Por
  eso: **aplicar juntos, mirando, con rollback listo.** NO ponerlo en cron hasta validar.
- Deja SSH intacto (va por Tailscale, otra regla).

### Medida 5 — Reglas en el borde de Cloudflare (panel, lo aplica Santiago)
Protegen el tráfico de **mi-negocio.app** (no cms.city). Ver `cloudflare-edge-rules.md`:
Bot Fight Mode + rate-limit en login/api. Es gratis en el plan de CF.

### Medida 6 — Versionar la config del origin
Ya lo hace esta carpeta. Falta: un script que copie `/etc/nginx/sites-enabled/minegocio` y
`/etc/nginx/conf.d/*.conf` al repo cuando cambian (o al menos al backup off-site de Drive).

---

## Orden de implementación sugerido

| # | Medida | Riesgo | Cuándo |
|---|--------|--------|--------|
| 1 | `access_log off` hosts ajenos | Muy bajo | **Ya** (evita recurrencia) |
| 2 | Rotación por tamaño del log | Nulo | Ya |
| 4 | Firewall solo-Cloudflare | Medio (footgun) | Juntos, mirando |
| 5 | Reglas borde Cloudflare | Bajo | Santiago en el panel |
| 6 | Versionar config nginx | Nulo | Continuo |

**Backup del estado actual (pre-cambios):** `/root/minegocio.nginx.bak.20260817_202746` en el server.

## Rollback general
Cada archivo tiene su rollback. Regla de oro: **siempre `nginx -t` antes de `reload`**, y
`reload` (no `restart`) para no cortar las conexiones SSE de los que están vendiendo.

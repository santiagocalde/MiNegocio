# Nginx / logs — medidas origin-side

Archivo objetivo: `/etc/nginx/sites-enabled/minegocio`
Regla de oro: **`nginx -t` antes de `systemctl reload nginx`** (reload = graceful, no corta SSE).

---

## Ya aplicado (2026-08-17) — corte por Host

En los 2 server blocks, después del `if ($from_cf = 0) { return 403; }`:

```nginx
if ($host !~* ^mi-negocio\.app$) { return 444; }
```

Los hosts ajenos (cms.city, escaneos con Host raro) reciben `444` (conexión cerrada, no se
sirve nada). **Falta que además NO se logueen** → Medida 1.

---

## Medida 1 ⭐ — No loguear el tráfico de hosts ajenos

Hace que el flood sea **gratis**: 444 + sin log → fail2ban/CrowdSec nunca ven el flood → el
CPU no sube aunque manden millones de requests.

**1a.** Al inicio del archivo (contexto http, al lado del `geo $realip_remote_addr $from_cf`):

```nginx
# Loguear solo el tráfico de nuestro dominio; el resto (bots con Host ajeno) no ensucia el log.
map $host $loggable {
    ~*^mi-negocio\.app$  1;
    default              0;
}
```

**1b.** Dentro de CADA server block (el de `:80` y el de `:443`), agregar una línea:

```nginx
access_log /var/log/nginx/access.log main if=$loggable;
```

Esto pisa, solo para estos server, el `access_log` global de `nginx.conf`. El
`access_log off;` que ya existe en una location puntual se mantiene (location gana).

**Verificación tras aplicar:**
```bash
nginx -t && systemctl reload nginx
# Real (debe SEGUIR logueando): generar un hit a mi-negocio.app y ver que aparece.
# Bot (NO debe loguear): 
curl -s -o /dev/null -k https://127.0.0.1/ -H 'Host: docs.cms.city'
tail -5 /var/log/nginx/access.log   # no debería aparecer la línea de docs.cms.city
```

**Riesgo:** muy bajo. Si el `map` fallara y diera 0 para tráfico real, se **pierde logging**
(no el servicio). El regex `~*^mi-negocio\.app$` matchea `mi-negocio.app`. 

**Rollback:** quitar las 2 líneas `access_log ... if=$loggable` y el `map`; `nginx -t` + reload.

---

## Medida 2 — Tope de tamaño al log (backstop)

Que ningún log llegue a 176 MB de nuevo. Editar `/etc/logrotate.d/nginx`, agregar dentro del
bloque `{ ... }`:

```
    maxsize 100M
```

Y para que se controle seguido (no solo 1 vez al día), crear
`/etc/cron.hourly/nginx-logrotate-size`:

```bash
#!/bin/bash
/usr/sbin/logrotate /etc/logrotate.d/nginx
```
```bash
chmod +x /etc/cron.hourly/nginx-logrotate-size
```

Con `maxsize 100M`, logrotate rota apenas el log pasa 100 MB (en la corrida horaria), aunque
no sea de madrugada. **Riesgo: nulo.**

**Rollback:** quitar la línea `maxsize` y borrar el cron.

---

## Medida 3 — Guardarraíl si un IPS se recalienta (nota operativa)

fail2ban **y** CrowdSec re-leen `access.log`; un log gigante los clava a los dos (fue el
incidente). Con Medidas 1+2 el log no crece → casi no pasa. Si igual pasara, la limpieza es:

```bash
logrotate -f /etc/logrotate.d/nginx       # rota el log grande
systemctl restart fail2ban crowdsec       # que arranquen sobre el log chico (conservan bans)
```

Opcional: agregar a `/opt/defense/monitor.sh` un chequeo de CPU de crowdsec/fail2ban que
dispare ese restart automático si superan X% por N minutos. (No implementado; evaluar.)

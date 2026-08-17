#!/usr/bin/env bash
#
# Restringe 80/443 en ufw para que SOLO Cloudflare pueda llegar al origin.
# Los escaneos directos a la IP del server (CVEs, backdoors) se descartan en el kernel.
# SSH NO se toca (va por Tailscale, es otra regla).
#
# ⚠️ FOOTGUN: si la lista de IPs de CF quedara incompleta, tráfico legítimo de Cloudflare
#    se DESCARTA en el firewall (silencioso). Por eso el script:
#      - aborta si no puede bajar las listas (no deja el server sin reglas),
#      - incluye el rango 104.28.0.0/15 que en el incidente NO estaba en la lista pública,
#      - NO borra las reglas 'Anywhere' hasta después de agregar las de CF.
#    APLICAR MIRANDO, con el sitio abierto para probar, y con rollback listo (abajo).
#
# Uso:   sudo bash ufw-cloudflare-lock.sh
# Rollback:  sudo bash ufw-cloudflare-lock.sh --rollback
set -euo pipefail

if [[ "${1:-}" == "--rollback" ]]; then
  echo "== ROLLBACK: reabrir 80/443 a Anywhere =="
  ufw allow 80/tcp
  ufw allow 443/tcp
  # borrar las reglas 'Cloudflare-lock' por número (de mayor a menor para no correr índices)
  for n in $(ufw status numbered | grep 'Cloudflare-lock' | grep -oP '^\[\s*\K[0-9]+' | sort -rn); do
    yes | ufw delete "$n" >/dev/null || true
  done
  ufw reload
  echo "OK: 80/443 vuelven a estar abiertos a todos."
  exit 0
fi

echo "== Bajando rangos actuales de Cloudflare =="
CF4="$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v4 || true)"
CF6="$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v6 || true)"
EXTRA4="104.28.0.0/15"   # visto en el incidente, no siempre está en la lista pública

# Guarda: no seguir si las listas vinieron vacías (no dejar el server sin reglas)
if [[ -z "$CF4" || -z "$CF6" ]]; then
  echo "ERROR: no pude bajar las IPs de Cloudflare. Abortando, no toco ufw."
  exit 1
fi

echo "== Agregando ALLOW 80/443 solo desde Cloudflare =="
for ip in $CF4 $EXTRA4 $CF6; do
  ufw allow proto tcp from "$ip" to any port 80,443 comment 'Cloudflare-lock' >/dev/null
done

echo "== Quitando las reglas viejas 'Anywhere' de 80/443 =="
# (recién ahora, con las de CF ya puestas, para no quedar sin ninguna en el medio)
ufw --force delete allow 80/tcp   2>/dev/null || true
ufw --force delete allow 443/tcp  2>/dev/null || true
# v6 'Anywhere' si existieran
ufw --force delete allow 80/tcp   2>/dev/null || true
ufw --force delete allow 443/tcp  2>/dev/null || true

ufw reload
echo
echo "== LISTO. Rangos permitidos: $(echo "$CF4 $EXTRA4 $CF6" | wc -w) =="
echo "AHORA VERIFICÁ (desde afuera / tu compu, NO desde el server):"
echo "  - https://mi-negocio.app  debe dar 200"
echo "  - los negocios deben seguir vendiendo"
echo "Si algo falla:  sudo bash ufw-cloudflare-lock.sh --rollback"

#!/bin/sh
set -e

SSL_DIR="/etc/nginx/ssl"
CERT="$SSL_DIR/nginx.crt"
KEY="$SSL_DIR/nginx.key"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    echo "Generando certificado SSL autofirmado..."
    mkdir -p "$SSL_DIR"
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$KEY" \
        -out "$CERT" \
        -subj "/CN=mi-negocio.app"
    echo "Certificado generado."
fi

exec nginx -g "daemon off;"

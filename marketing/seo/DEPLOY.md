# SEO site (mi-negocio.app) - deploy

Paginas SEO estaticas servidas por nginx desde `/var/www/seo/`, SEPARADAS del SPA.
Fuente en git: este directorio (`marketing/seo/`). Deploy = copiar a `/var/www/seo/`.

## Deploy

```bash
rsync -a --delete marketing/seo/ /var/www/seo/
# imagenes de landing reutilizadas por las cards (se copian del frontend):
cp frontend/src/assets/landing/*.webp            /var/www/seo/assets/
cp frontend/src/assets/images/mercadopago_logo.png /var/www/seo/assets/
cp frontend/public/MiNegocio_transparente_real.png /var/www/seo/assets/logo.png
systemctl reload nginx
```

## Requisitos nginx (server block de mi-negocio.app)

IMPORTANTE: los assets del SEO se sirven bajo `/seo-assets/`, NO bajo `/assets/`.
`/assets/` es el namespace del bundle Vite del SPA; mezclarlos rompe la landing
(las imagenes/js del SPA caian en 404). Aprendido a la mala - no volver a poner
un `location /assets/` apuntando a /var/www/seo.

```nginx
# Assets del SEO (imagenes, logo) - prefijo propio, no colisiona con el SPA
location /seo-assets/ {
    alias /var/www/seo/assets/;
    expires 30d;
    add_header Cache-Control "public, immutable" always;
}
location = /og-image.png { root /var/www/seo; try_files $uri =404; }

# Paginas SEO con SSI (para _header.html / _footer.html compartidos)
location /funcionalidades/ { root /var/www/seo; ssi on; rewrite ^/funcionalidades/$ /funcionalidades.html break; }
location = /funcionalidades { return 301 /funcionalidades/; }
location /precios/ { root /var/www/seo; ssi on; rewrite ^/precios/$ /precios.html break; }
location = /precios { return 301 /precios/; }
location /blog/ { root /var/www/seo; ssi on; rewrite ^/blog/$ /blog.html break; }
location = /blog { return 301 /blog/; }
location ~ ^/blog/([a-z0-9-]+)/$ { root /var/www/seo/blog; ssi on; rewrite ^/blog/([a-z0-9-]+)/$ /$1/index.html break; }
location = /robots.txt { root /var/www/seo; }
location = /sitemap.xml { root /var/www/seo; }

# Includes SSI: accesibles solo por subrequest interna, no por HTTP directo
location ~ ^/_(header|footer)\.html$ { root /var/www/seo; internal; }
```

`_header.html` / `_footer.html` son includes SSI compartidos por las 8 paginas:
tocar el nav = editar 1 archivo. Los blog posts referencian su imagen destacada
en `/blog/<slug>/featured.webp`.

# Reglas en el borde de Cloudflare (panel — lo aplica Santiago)

Estas reglas se configuran en el **panel de Cloudflare** de la cuenta de `mi-negocio.app`.
Protegen el tráfico de **nuestro dominio** (frenan floods/ataques antes de que lleguen al
server). Son gratis en el plan actual.

> ⚠️ Aclaración importante: esto **NO frena el flood de `cms.city`**, porque cms.city está
> en OTRA cuenta de Cloudflare (no la nuestra) y su tráfico llega directo a nuestra IP. A
> ese lo frena el origin (Medida 1 de `nginx-hardening.md`). Estas reglas son para todo lo
> demás: ataques dirigidos a mi-negocio.app.

---

## 1. Bot Fight Mode  (el más fácil y de más impacto)
Panel → **Security → Bots** → activar **Bot Fight Mode** (o "Super Bot Fight Mode" si está
disponible). Cloudflare desafía/bloquea bots automáticos en el borde, sin tocar el server.

## 2. Rate limiting en login / API
Panel → **Security → WAF → Rate limiting rules** → crear:

- **Login:** si `URI Path` contiene `/api/login` o `/api/operators/verify-pin` →
  más de **10 requests / 1 min** por IP → **Block** (o Managed Challenge) por 10 min.
- **API general:** `URI Path` empieza con `/api/` → más de **300 req / 1 min** por IP →
  Managed Challenge.

(Ajustar los números si algún negocio muy activo los toca; empezar holgado.)

## 3. (Opcional) Managed Ruleset / WAF
Panel → **Security → WAF → Managed rules** → activar el **Cloudflare Managed Ruleset**
(cubre CVEs conocidos, inyecciones, etc.) en modo *Block*. Es lo mismo que CrowdSec ya hace
en el origin, pero en el borde.

## 4. (Opcional, defensivo) "Under Attack Mode"
Si volviera a haber un flood fuerte y directo a mi-negocio.app: Panel → **Overview** →
**Under Attack Mode: On**. Mete un challenge JS a todos por unos minutos. Usar solo durante
un ataque activo (molesta un poco a los usuarios reales).

---

## Verificación
Tras activar, entrar a mi-negocio.app desde un navegador normal → debe cargar sin fricción.
Los negocios deben seguir vendiendo. Si algún negocio queda trabado por el rate-limit,
subir los umbrales.

"""
Rate limiting central — limiter único compartido por main y routers.

CLAVE POR IP REAL
─────────────────
El backend corre detrás del proxy nginx, así que request.client.host es
SIEMPRE la IP del contenedor frontend. Si limitáramos por esa IP,
throttlearíamos a TODOS los kioscos juntos (catastrófico en prod).

nginx nos pasa la IP real del cliente en X-Real-IP (ver nginx.conf), así que
la usamos como clave. Caemos a X-Forwarded-For y luego a client.host.

No importar nada de la app acá (solo stdlib + slowapi) para evitar circulares.
"""
from slowapi import Limiter
from starlette.requests import Request


def real_client_ip(request: Request) -> str:
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # El primero de la lista es el cliente original.
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Sin default_limits: aplicamos límites explícitos por endpoint con @limiter.limit.
limiter = Limiter(key_func=real_client_ip)

"""
Configuración del servicio de Facturación Electrónica ARCA (ex AFIP).

MODELO: Delegación multi-cliente (Relaciones de Representación de ARCA).
────────────────────────────────────────────────────────────────────────
Un ÚNICO certificado (el del REPRESENTANTE — la SRL/RI de MiNegocio) firma
todas las llamadas. En cada factura se indica el CUIT del COMERCIO representado.
El comercio autoriza nuestro CUIT una sola vez desde su portal ARCA; nunca
sube certificados ni claves. Así, agregar un comercio nuevo NO agrega
infraestructura: reusamos el mismo certificado y el mismo Ticket de Acceso.

Todos los secretos vienen de variables de entorno. NUNCA hardcodear (ver
CLAUDE.md). El certificado/clave se aceptan como ruta a archivo o como PEM
inline (útil para Docker secrets).
"""
import os

# CUIT del representante: la persona jurídica (SRL) o RI que ARCA reconoce como
# emisor técnico y dueño del certificado. Solo dígitos, sin guiones.
ARCA_CUIT = "".join(ch for ch in os.getenv("ARCA_CUIT", "") if ch.isdigit())

# Certificado (.crt) y clave privada (.key) del representante, en formato PEM.
# Se puede dar la ruta al archivo O el contenido inline.
ARCA_CERT_PATH = os.getenv("ARCA_CERT_PATH", "")
ARCA_KEY_PATH = os.getenv("ARCA_KEY_PATH", "")
ARCA_CERT_PEM = os.getenv("ARCA_CERT_PEM", "")
ARCA_KEY_PEM = os.getenv("ARCA_KEY_PEM", "")

# 'testing' (homologación) o 'production'. En homologación se usa el ambiente de
# pruebas de ARCA: NO emite comprobantes fiscales reales. Arrancar SIEMPRE acá.
ARCA_ENV = (os.getenv("ARCA_ENV", "testing") or "testing").strip().lower()

# Servicio de ARCA al que pedimos acceso (facturación electrónica v1).
WSFE_SERVICE = "wsfe"

# Margen para refrescar el Ticket de Acceso antes de que expire (segundos).
# ARCA emite el TA con 12h de vigencia; lo renovamos 10 min antes por las dudas.
TA_REFRESH_MARGIN = 600

# Timeout de red para las llamadas SOAP (segundos).
HTTP_TIMEOUT = 30

_ENDPOINTS = {
    "testing": {
        "wsaa": "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
        "wsfe": "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
    },
    "production": {
        "wsaa": "https://wsaa.afip.gov.ar/ws/services/LoginCms",
        "wsfe": "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
    },
}


def endpoints() -> dict:
    """URLs de WSAA y WSFEv1 según el ambiente configurado."""
    return _ENDPOINTS["production"] if ARCA_ENV == "production" else _ENDPOINTS["testing"]


def is_production() -> bool:
    return ARCA_ENV == "production"


def is_configured() -> bool:
    """True si hay CUIT + certificado + clave disponibles para operar."""
    has_cert = bool(ARCA_CERT_PEM) or bool(ARCA_CERT_PATH and os.path.isfile(ARCA_CERT_PATH))
    has_key = bool(ARCA_KEY_PEM) or bool(ARCA_KEY_PATH and os.path.isfile(ARCA_KEY_PATH))
    return bool(ARCA_CUIT) and has_cert and has_key


def load_cert_and_key() -> tuple[bytes, bytes]:
    """Devuelve (cert_pem, key_pem) como bytes. Lanza si falta algo."""
    from .errors import ArcaNotConfigured

    cert = ARCA_CERT_PEM.encode() if ARCA_CERT_PEM else _read(ARCA_CERT_PATH)
    key = ARCA_KEY_PEM.encode() if ARCA_KEY_PEM else _read(ARCA_KEY_PATH)
    if not ARCA_CUIT:
        raise ArcaNotConfigured("Falta ARCA_CUIT (CUIT del representante).")
    if not cert or not key:
        raise ArcaNotConfigured(
            "Falta el certificado o la clave privada del representante "
            "(revisá ARCA_CERT_PATH/ARCA_CERT_PEM y ARCA_KEY_PATH/ARCA_KEY_PEM)."
        )
    return cert, key


def _read(path: str) -> bytes:
    if path and os.path.isfile(path):
        with open(path, "rb") as f:
            return f.read()
    return b""

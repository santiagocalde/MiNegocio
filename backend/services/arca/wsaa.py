"""
Cliente WSAA — autenticación ante ARCA.

Flujo:
  1. Armamos un "LoginTicketRequest" (XML) pidiendo acceso al servicio wsfe.
  2. Lo firmamos como CMS/PKCS#7 (attached, DER, base64) con el certificado del
     representante.
  3. Lo mandamos al método SOAP `loginCms` de WSAA.
  4. ARCA devuelve un "Ticket de Acceso" (TA) con token + sign, válido 12h.

CACHE OBLIGATORIO
─────────────────
ARCA RECHAZA pedir un TA nuevo si ya existe uno válido para (CUIT, servicio):
devuelve "El CEE ya posee un TA valido...". Si perdemos el TA (reinicio) y
volvemos a pedirlo antes de que expire, quedamos BLOQUEADOS hasta 12h. Por eso
el TA se persiste (DbTokenStore) y se reusa hasta ~10 min antes de expirar.

Como el modelo es de delegación multi-cliente, UN SOLO TA sirve para TODOS los
comercios: en la factura cambia el CUIT representado, no el TA.
"""
import base64
import datetime
import logging
import xml.etree.ElementTree as ET

import httpx

from . import config
from .errors import ArcaAuthError

logger = logging.getLogger("arca.wsaa")

_AR_TZ = datetime.timezone(datetime.timedelta(hours=-3))
_WSAA_NS = "http://wsaa.view.sua.dvadac.desein.afip.gov"


# ── Funciones puras (testeables sin red) ────────────────────────────────────

def build_login_ticket(service: str, now: datetime.datetime | None = None) -> bytes:
    """Arma el XML del LoginTicketRequest. generationTime unos minutos en el
    pasado y expirationTime ~12h adelante, con offset -03:00 (Argentina)."""
    now = now or datetime.datetime.now(_AR_TZ)
    gen = now - datetime.timedelta(minutes=10)
    exp = now + datetime.timedelta(hours=12)
    unique_id = int(now.timestamp())
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<loginTicketRequest version="1.0">'
        "<header>"
        f"<uniqueId>{unique_id}</uniqueId>"
        f"<generationTime>{gen.isoformat()}</generationTime>"
        f"<expirationTime>{exp.isoformat()}</expirationTime>"
        "</header>"
        f"<service>{service}</service>"
        "</loginTicketRequest>"
    )
    return xml.encode("utf-8")


def sign_cms(login_ticket_xml: bytes, cert_pem: bytes, key_pem: bytes) -> str:
    """Firma el LoginTicketRequest como CMS/PKCS#7 attached (equivale a
    `openssl cms -sign -nodetach -outform DER`) y devuelve el base64.

    Usa `cryptography` (ya presente vía python-jose[cryptography])."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.serialization import Encoding, load_pem_private_key
    from cryptography.hazmat.primitives.serialization import pkcs7

    cert = x509.load_pem_x509_certificate(cert_pem)
    key = load_pem_private_key(key_pem, password=None)
    builder = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(login_ticket_xml)
        .add_signer(cert, key, hashes.SHA256())
    )
    # Sin DetachedSignature → el contenido va incluido (attached / -nodetach).
    # Binary evita canonicalización de saltos de línea del contenido firmado.
    der = builder.sign(Encoding.DER, [pkcs7.PKCS7Options.Binary])
    return base64.b64encode(der).decode()


def parse_login_response(xml_text: str) -> dict:
    """Extrae token, sign y expiration_time del loginTicketResponse que devuelve
    ARCA (viene embebido/escapado dentro del sobre SOAP)."""
    # El loginCmsReturn trae el loginTicketResponse como texto XML.
    inner = _extract_login_cms_return(xml_text)
    root = ET.fromstring(inner)
    token = root.findtext(".//credentials/token")
    sign = root.findtext(".//credentials/sign")
    exp = root.findtext(".//header/expirationTime")
    if not token or not sign:
        raise ArcaAuthError("Respuesta de WSAA sin token/sign.")
    return {"token": token, "sign": sign, "expiration_time": exp}


def _extract_login_cms_return(xml_text: str) -> str:
    """Devuelve el contenido de <loginCmsReturn> (el XML del TA)."""
    # Parseamos el sobre SOAP y buscamos el primer elemento cuyo tag termine en
    # 'loginCmsReturn'. Su .text es el loginTicketResponse (ya des-escapado por ET).
    root = ET.fromstring(xml_text)
    for el in root.iter():
        if el.tag.endswith("loginCmsReturn") and el.text:
            return el.text
    # Fault SOAP
    for el in root.iter():
        if el.tag.endswith("faultstring") and el.text:
            raise ArcaAuthError(f"WSAA fault: {el.text.strip()}")
    raise ArcaAuthError("Respuesta de WSAA inesperada (sin loginCmsReturn).")


def _build_soap_envelope(cms_b64: str) -> str:
    return (
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
        f'xmlns:wsaa="{_WSAA_NS}">'
        "<soapenv:Header/><soapenv:Body>"
        f"<wsaa:loginCms><wsaa:in0>{cms_b64}</wsaa:in0></wsaa:loginCms>"
        "</soapenv:Body></soapenv:Envelope>"
    )


def _is_expired(expiration_time: str | None, margin: int = config.TA_REFRESH_MARGIN) -> bool:
    """True si el TA venció o vence dentro del margen. Sin fecha, se asume vencido."""
    if not expiration_time:
        return True
    try:
        exp = datetime.datetime.fromisoformat(expiration_time)
    except ValueError:
        return True
    now = datetime.datetime.now(exp.tzinfo) if exp.tzinfo else datetime.datetime.now()
    return now >= (exp - datetime.timedelta(seconds=margin))


# ── Orquestación async ──────────────────────────────────────────────────────

async def _login(service: str) -> dict:
    """Ejecuta el login contra WSAA y devuelve el TA nuevo."""
    cert_pem, key_pem = config.load_cert_and_key()
    ticket = build_login_ticket(service)
    cms = sign_cms(ticket, cert_pem, key_pem)
    envelope = _build_soap_envelope(cms)
    url = config.endpoints()["wsaa"]
    headers = {"Content-Type": "text/xml; charset=utf-8", "SOAPAction": ""}
    try:
        async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT) as client:
            resp = await client.post(url, content=envelope.encode("utf-8"), headers=headers)
    except httpx.HTTPError as e:
        raise ArcaAuthError(f"No se pudo contactar WSAA: {e}") from e
    if resp.status_code != 200:
        raise ArcaAuthError(f"WSAA respondió HTTP {resp.status_code}: {resp.text[:300]}")
    ta = parse_login_response(resp.text)
    logger.info("WSAA: TA nuevo para %s, expira %s", service, ta.get("expiration_time"))
    return ta


async def get_ticket_acceso(service: str = config.WSFE_SERVICE) -> dict:
    """Devuelve un TA válido {token, sign, expiration_time}, reusando el cacheado
    mientras no esté por vencer. Refresca bajo lock para no pedir dos TA a la vez.

    Este TA sirve para TODOS los comercios (modelo de delegación): el CUIT
    representado se define recién en la llamada a WSFEv1, no acá.
    """
    from . import token_store

    env = config.ARCA_ENV
    ta = await token_store.load_ta(service, env)
    if ta and not _is_expired(ta.get("expiration_time")):
        return ta

    async with token_store.refresh_lock():
        # Doble chequeo: otro request pudo haberlo refrescado mientras esperábamos.
        ta = await token_store.load_ta(service, env)
        if ta and not _is_expired(ta.get("expiration_time")):
            return ta
        ta = await _login(service)
        await token_store.save_ta(service, env, ta)
        return ta

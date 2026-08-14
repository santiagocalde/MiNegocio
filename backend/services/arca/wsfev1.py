"""
Cliente WSFEv1 — facturación electrónica ARCA.

Operaciones que exponemos:
  - dummy(): health check del servicio.
  - ultimo_autorizado(): último número de comprobante autorizado (SIEMPRE se
    consulta antes de emitir; nunca llevamos contador propio).
  - consultar(): datos de un comprobante ya emitido (para recuperar el CAE).
  - solicitar_cae(): emite una factura y devuelve el CAE.

SEGURIDAD ANTI DOBLE-EMISIÓN
────────────────────────────
Bug conocido de ARCA: ante un timeout o SOAP fault, la factura PUEDE haberse
emitido igual. Si reintentáramos a ciegas, emitiríamos dos veces (problema
contable serio). Por eso, ante un error transitorio, primero volvemos a
consultar el último autorizado: si el número avanzó, la factura salió y
recuperamos su CAE con consultar(); si no avanzó, es seguro reintentar luego.

Campos OBLIGATORIOS desde 2025 (RG 5616), incluidos en cada emisión:
  - CondicionIVAReceptorId (sin esto → error 10242, rechazo)
  - CanMisMonExt (para operaciones en moneda extranjera)
"""
import datetime
import logging
import xml.etree.ElementTree as ET

import httpx

from . import config, mapping
from .errors import ArcaRejected, ArcaTransientError

logger = logging.getLogger("arca.wsfev1")

_NS = "http://ar.gov.afip.dif.FEV1/"


# ── Helpers de parseo (por nombre local, ignorando namespaces) ──────────────

def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find(root, name: str):
    for el in root.iter():
        if _local(el.tag) == name:
            return el
    return None


def _findtext(root, name: str, default: str = "") -> str:
    el = _find(root, name)
    return el.text if (el is not None and el.text is not None) else default


def _collect(root, container: str, item: str) -> list[dict]:
    """Junta {Code, Msg} de un contenedor tipo Errors/Err u Observaciones/Obs."""
    out = []
    cont = _find(root, container)
    if cont is None:
        return out
    for el in cont.iter():
        if _local(el.tag) == item:
            out.append({
                "Code": _findtext(el, "Code"),
                "Msg": _findtext(el, "Msg"),
            })
    return out


# ── Construcción de XML (pura, testeable) ───────────────────────────────────

def _auth_xml(ta: dict, cuit_representado: str) -> str:
    """Bloque Auth: token+sign del representante, Cuit = comercio representado.
    Esta es la clave del modelo de delegación: firmamos con nuestro TA pero
    facturamos en nombre del CUIT del comercio."""
    return (
        "<ar:Auth>"
        f"<ar:Token>{ta['token']}</ar:Token>"
        f"<ar:Sign>{ta['sign']}</ar:Sign>"
        f"<ar:Cuit>{cuit_representado}</ar:Cuit>"
        "</ar:Auth>"
    )


def build_cae_request(
    *,
    ta: dict,
    cuit_representado: str,
    punto_venta: int,
    tipo_cbte: int,
    numero: int,
    concepto: int,
    doc_tipo: int,
    doc_nro: str,
    cond_iva_receptor: int,
    imp: dict,
    fecha: str,
) -> str:
    """Arma el sobre SOAP de FECAESolicitar para un comprobante."""
    iva_block = ""
    if imp["iva_array"]:
        alics = "".join(
            "<ar:AlicIva>"
            f"<ar:Id>{a['Id']}</ar:Id>"
            f"<ar:BaseImp>{a['BaseImp']:.2f}</ar:BaseImp>"
            f"<ar:Importe>{a['Importe']:.2f}</ar:Importe>"
            "</ar:AlicIva>"
            for a in imp["iva_array"]
        )
        iva_block = f"<ar:Iva>{alics}</ar:Iva>"

    det = (
        "<ar:FECAEDetRequest>"
        f"<ar:Concepto>{concepto}</ar:Concepto>"
        f"<ar:DocTipo>{doc_tipo}</ar:DocTipo>"
        f"<ar:DocNro>{doc_nro or 0}</ar:DocNro>"
        f"<ar:CbteDesde>{numero}</ar:CbteDesde>"
        f"<ar:CbteHasta>{numero}</ar:CbteHasta>"
        f"<ar:CbteFch>{fecha}</ar:CbteFch>"
        f"<ar:ImpTotal>{imp['imp_total']:.2f}</ar:ImpTotal>"
        f"<ar:ImpTotConc>{imp['imp_tot_conc']:.2f}</ar:ImpTotConc>"
        f"<ar:ImpNeto>{imp['imp_neto']:.2f}</ar:ImpNeto>"
        f"<ar:ImpOpEx>{imp['imp_op_ex']:.2f}</ar:ImpOpEx>"
        f"<ar:ImpIVA>{imp['imp_iva']:.2f}</ar:ImpIVA>"
        f"<ar:ImpTrib>{imp['imp_trib']:.2f}</ar:ImpTrib>"
        f"<ar:CondicionIVAReceptorId>{cond_iva_receptor}</ar:CondicionIVAReceptorId>"
        "<ar:MonId>PES</ar:MonId>"
        "<ar:MonCotiz>1</ar:MonCotiz>"
        "<ar:CanMisMonExt>N</ar:CanMisMonExt>"
        f"{iva_block}"
        "</ar:FECAEDetRequest>"
    )
    return (
        f'<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="{_NS}">'
        "<soapenv:Header/><soapenv:Body>"
        "<ar:FECAESolicitar>"
        f"{_auth_xml(ta, cuit_representado)}"
        "<ar:FeCAEReq>"
        f"<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>{punto_venta}</ar:PtoVta>"
        f"<ar:CbteTipo>{tipo_cbte}</ar:CbteTipo></ar:FeCabReq>"
        f"<ar:FeDetReq>{det}</ar:FeDetReq>"
        "</ar:FeCAEReq>"
        "</ar:FECAESolicitar>"
        "</soapenv:Body></soapenv:Envelope>"
    )


def _simple_envelope(inner: str) -> str:
    return (
        f'<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="{_NS}">'
        f"<soapenv:Header/><soapenv:Body>{inner}</soapenv:Body></soapenv:Envelope>"
    )


# ── Parseo de respuestas (puro, testeable) ──────────────────────────────────

def parse_cae_response(xml_text: str, numero: int, punto_venta: int, tipo_cbte: int) -> dict:
    """Interpreta la respuesta de FECAESolicitar. Lanza ArcaRejected si
    Resultado='R'. Devuelve el CAE si 'A'."""
    root = ET.fromstring(xml_text)
    errores = _collect(root, "Errors", "Err")
    resultado = _findtext(root, "Resultado")
    observaciones = _collect(root, "Observaciones", "Obs")
    cae = _findtext(root, "CAE")
    cae_vto = _findtext(root, "CAEFchVto")

    if resultado != "A" or not cae:
        raise ArcaRejected(
            f"ARCA rechazó el comprobante (Resultado={resultado or '?'}).",
            observaciones=observaciones,
            errores=errores,
        )
    return {
        "cae": cae,
        "cae_vto": cae_vto,
        "numero": numero,
        "punto_venta": punto_venta,
        "tipo_cbte": tipo_cbte,
        "resultado": resultado,
        "observaciones": observaciones,
    }


def parse_ultimo_autorizado(xml_text: str) -> int:
    root = ET.fromstring(xml_text)
    errores = _collect(root, "Errors", "Err")
    nro = _findtext(root, "CbteNro")
    if not nro:
        raise ArcaTransientError(
            "FECompUltimoAutorizado sin CbteNro"
            + (f": {errores}" if errores else "")
        )
    return int(nro)


# ── Llamadas SOAP async ─────────────────────────────────────────────────────

async def _soap_call(action: str, envelope: str) -> str:
    """POST del sobre SOAP a WSFEv1. Devuelve el texto XML de la respuesta.
    Traduce fallos de red/5xx/fault a ArcaTransientError (reintentable con
    verificación previa)."""
    url = config.endpoints()["wsfe"]
    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": f"{_NS}{action}",
    }
    try:
        async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT) as client:
            resp = await client.post(url, content=envelope.encode("utf-8"), headers=headers)
    except httpx.HTTPError as e:
        raise ArcaTransientError(f"Fallo de red hacia WSFEv1 ({action}): {e}") from e
    if resp.status_code >= 500:
        raise ArcaTransientError(f"WSFEv1 {action} devolvió HTTP {resp.status_code}")
    if resp.status_code != 200:
        raise ArcaTransientError(f"WSFEv1 {action} HTTP {resp.status_code}: {resp.text[:300]}")
    if "faultstring" in resp.text:
        root = ET.fromstring(resp.text)
        fault = _findtext(root, "faultstring") or "SOAP fault"
        raise ArcaTransientError(f"WSFEv1 {action} fault: {fault}")
    return resp.text


async def dummy() -> dict:
    """Health check (FEDummy). No requiere autenticación."""
    xml = await _soap_call("FEDummy", _simple_envelope("<ar:FEDummy/>"))
    root = ET.fromstring(xml)
    return {
        "AppServer": _findtext(root, "AppServer"),
        "DbServer": _findtext(root, "DbServer"),
        "AuthServer": _findtext(root, "AuthServer"),
    }


async def ultimo_autorizado(ta: dict, cuit_representado: str, punto_venta: int, tipo_cbte: int) -> int:
    inner = (
        "<ar:FECompUltimoAutorizado>"
        f"{_auth_xml(ta, cuit_representado)}"
        f"<ar:PtoVta>{punto_venta}</ar:PtoVta>"
        f"<ar:CbteTipo>{tipo_cbte}</ar:CbteTipo>"
        "</ar:FECompUltimoAutorizado>"
    )
    xml = await _soap_call("FECompUltimoAutorizado", _simple_envelope(inner))
    return parse_ultimo_autorizado(xml)


async def consultar(ta: dict, cuit_representado: str, punto_venta: int, tipo_cbte: int, numero: int) -> dict:
    """Consulta un comprobante ya emitido (FECompConsultar) para recuperar su CAE."""
    inner = (
        "<ar:FECompConsultar>"
        f"{_auth_xml(ta, cuit_representado)}"
        "<ar:FeCompConsReq>"
        f"<ar:CbteTipo>{tipo_cbte}</ar:CbteTipo>"
        f"<ar:PtoVta>{punto_venta}</ar:PtoVta>"
        f"<ar:CbteNro>{numero}</ar:CbteNro>"
        "</ar:FeCompConsReq></ar:FECompConsultar>"
    )
    xml = await _soap_call("FECompConsultar", _simple_envelope(inner))
    root = ET.fromstring(xml)
    return {
        "cae": _findtext(root, "CodAutorizacion") or _findtext(root, "CAE"),
        "cae_vto": _findtext(root, "FchVto") or _findtext(root, "CAEFchVto"),
        "numero": numero,
        "punto_venta": punto_venta,
        "tipo_cbte": tipo_cbte,
        "resultado": _findtext(root, "Resultado") or "A",
        "observaciones": [],
    }


async def solicitar_cae(
    *,
    cuit_representado: str,
    emisor_condicion: str,
    punto_venta: int,
    total: float,
    receptor_condicion: str = "consumidor_final",
    receptor_doc: str = "",
    iva_rate: str = "21",
    concepto: int = 1,
    fecha: str | None = None,
) -> dict:
    """Emite una factura electrónica y devuelve {cae, cae_vto, numero, ...}.

    Maneja el bug anti doble-emisión de ARCA. Lanza ArcaRejected (datos mal) o
    ArcaTransientError (reintentar luego, ya verificado que NO se emitió)."""
    from . import wsaa

    tipo_cbte = mapping.tipo_comprobante(emisor_condicion, receptor_condicion)
    doc_tipo, doc_nro = mapping.documento(tipo_cbte, receptor_doc, receptor_condicion)
    cond_iva = mapping.condicion_iva_receptor_id(receptor_condicion)
    imp = mapping.importes(total, tipo_cbte, iva_rate)
    fecha = fecha or datetime.datetime.now().strftime("%Y%m%d")

    ta = await wsaa.get_ticket_acceso()
    ultimo = await ultimo_autorizado(ta, cuit_representado, punto_venta, tipo_cbte)
    numero = ultimo + 1

    envelope = build_cae_request(
        ta=ta, cuit_representado=cuit_representado, punto_venta=punto_venta,
        tipo_cbte=tipo_cbte, numero=numero, concepto=concepto,
        doc_tipo=doc_tipo, doc_nro=doc_nro, cond_iva_receptor=cond_iva,
        imp=imp, fecha=fecha,
    )
    try:
        xml = await _soap_call("FECAESolicitar", envelope)
    except ArcaTransientError:
        # Puede haberse emitido igual: verificamos antes de dejar reintentar.
        ultimo_ahora = await ultimo_autorizado(ta, cuit_representado, punto_venta, tipo_cbte)
        if ultimo_ahora >= numero:
            logger.warning(
                "ARCA: error transitorio pero el comprobante %s-%s se emitió; recupero CAE.",
                punto_venta, numero,
            )
            return await consultar(ta, cuit_representado, punto_venta, tipo_cbte, numero)
        raise
    return parse_cae_response(xml, numero, punto_venta, tipo_cbte)

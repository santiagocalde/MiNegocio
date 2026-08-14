"""
Tests de la lógica pura del servicio ARCA (sin red ni BD).

Cubre lo que suele romperse: tipo de comprobante A/B/C, el CondicionIVAReceptorId
obligatorio 2025, la descomposición de importes (y que la Factura C no discrimine
IVA), el parseo de respuestas WSAA/WSFEv1 y el manejo de rechazos.
"""
import pytest

from services.arca import mapping, wsaa, wsfev1
from services.arca.errors import ArcaRejected


# ── mapping: tipo de comprobante ────────────────────────────────────────────

def test_tipo_comprobante_ri_a_ri_es_factura_a():
    assert mapping.tipo_comprobante("Responsable Inscripto", "Responsable Inscripto") == mapping.CBTE_FACTURA_A


def test_tipo_comprobante_ri_a_consumidor_es_factura_b():
    assert mapping.tipo_comprobante("Responsable Inscripto", "Consumidor Final") == mapping.CBTE_FACTURA_B


def test_tipo_comprobante_monotributo_siempre_c():
    assert mapping.tipo_comprobante("Monotributista", "Responsable Inscripto") == mapping.CBTE_FACTURA_C
    assert mapping.tipo_comprobante("Monotributista", "Consumidor Final") == mapping.CBTE_FACTURA_C


def test_normalizar_condicion_tolera_variantes():
    assert mapping.normalizar_condicion("RI") == "responsable_inscripto"
    assert mapping.normalizar_condicion("responsable inscripto") == "responsable_inscripto"
    assert mapping.normalizar_condicion("Monotributo") == "monotributo"
    assert mapping.normalizar_condicion("Exento") == "exento"
    assert mapping.normalizar_condicion("") == "consumidor_final"


# ── mapping: condición IVA receptor (obligatorio 2025) ──────────────────────

def test_condicion_iva_receptor_id():
    assert mapping.condicion_iva_receptor_id("Responsable Inscripto") == 1
    assert mapping.condicion_iva_receptor_id("Consumidor Final") == 5
    assert mapping.condicion_iva_receptor_id("Monotributo") == 6
    # Default seguro: consumidor final.
    assert mapping.condicion_iva_receptor_id("cualquier cosa") == 5


# ── mapping: documento del receptor ─────────────────────────────────────────

def test_documento_factura_a_exige_cuit():
    tipo, nro = mapping.documento(mapping.CBTE_FACTURA_A, "20-11111111-2")
    assert tipo == mapping.DOC_CUIT
    assert nro == "20111111112"


def test_documento_sin_doc_es_consumidor_final():
    tipo, nro = mapping.documento(mapping.CBTE_FACTURA_B, "")
    assert tipo == mapping.DOC_CONSUMIDOR_FINAL
    assert nro == "0"


def test_documento_dni_vs_cuit_por_longitud():
    assert mapping.documento(mapping.CBTE_FACTURA_B, "30456789")[0] == mapping.DOC_DNI
    assert mapping.documento(mapping.CBTE_FACTURA_B, "20304567891")[0] == mapping.DOC_CUIT


# ── mapping: importes ───────────────────────────────────────────────────────

def test_importes_factura_c_no_discrimina_iva():
    imp = mapping.importes(1000, mapping.CBTE_FACTURA_C)
    assert imp["imp_iva"] == 0.0
    assert imp["imp_neto"] == 1000.0
    assert imp["iva_array"] == []


def test_importes_factura_b_discrimina_y_cuadra():
    imp = mapping.importes(121, mapping.CBTE_FACTURA_B, "21")
    assert imp["imp_neto"] == 100.0
    assert imp["imp_iva"] == 21.0
    # neto + iva debe dar exactamente el total (el IVA absorbe el redondeo).
    assert round(imp["imp_neto"] + imp["imp_iva"], 2) == imp["imp_total"]
    assert len(imp["iva_array"]) == 1
    assert imp["iva_array"][0]["Id"] == 5  # 21%


def test_importes_redondeo_cuadra_en_monto_feo():
    imp = mapping.importes(100, mapping.CBTE_FACTURA_B, "21")
    assert round(imp["imp_neto"] + imp["imp_iva"], 2) == 100.0


# ── wsaa: login ticket y parseo ─────────────────────────────────────────────

def test_build_login_ticket_incluye_servicio():
    xml = wsaa.build_login_ticket("wsfe").decode()
    assert "<service>wsfe</service>" in xml
    assert "<uniqueId>" in xml
    assert "generationTime" in xml and "expirationTime" in xml


def test_parse_login_response_extrae_token_sign():
    inner = (
        '<loginTicketResponse><header>'
        '<expirationTime>2030-01-01T00:00:00-03:00</expirationTime></header>'
        '<credentials><token>TOKEN_ABC</token><sign>SIGN_XYZ</sign></credentials>'
        '</loginTicketResponse>'
    )
    escaped = inner.replace("<", "&lt;").replace(">", "&gt;")
    soap = (
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>'
        '<loginCmsResponse xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov">'
        f"<loginCmsReturn>{escaped}</loginCmsReturn>"
        "</loginCmsResponse></soap:Body></soap:Envelope>"
    )
    ta = wsaa.parse_login_response(soap)
    assert ta["token"] == "TOKEN_ABC"
    assert ta["sign"] == "SIGN_XYZ"
    assert ta["expiration_time"].startswith("2030")


def test_is_expired():
    assert wsaa._is_expired(None) is True
    assert wsaa._is_expired("2000-01-01T00:00:00-03:00") is True
    assert wsaa._is_expired("2100-01-01T00:00:00-03:00") is False


# ── wsfev1: parseo de respuestas ────────────────────────────────────────────

_SOAP_HEAD = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>'
_SOAP_TAIL = "</soap:Body></soap:Envelope>"


def test_parse_cae_aprobado():
    xml = (
        _SOAP_HEAD
        + '<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult>'
        + "<FeCabResp><Resultado>A</Resultado></FeCabResp>"
        + "<FeDetResp><FECAEDetResponse><Resultado>A</Resultado>"
        + "<CAE>71234567890123</CAE><CAEFchVto>20260830</CAEFchVto>"
        + "</FECAEDetResponse></FeDetResp>"
        + "</FECAESolicitarResult></FECAESolicitarResponse>"
        + _SOAP_TAIL
    )
    res = wsfev1.parse_cae_response(xml, numero=43, punto_venta=1, tipo_cbte=11)
    assert res["cae"] == "71234567890123"
    assert res["cae_vto"] == "20260830"
    assert res["numero"] == 43


def test_parse_cae_rechazado_levanta_con_observaciones():
    xml = (
        _SOAP_HEAD
        + '<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult>'
        + "<FeCabResp><Resultado>R</Resultado></FeCabResp>"
        + "<FeDetResp><FECAEDetResponse><Resultado>R</Resultado>"
        + "<Observaciones><Obs><Code>10242</Code><Msg>Falta CondicionIVAReceptorId</Msg></Obs></Observaciones>"
        + "</FECAEDetResponse></FeDetResp>"
        + "</FECAESolicitarResult></FECAESolicitarResponse>"
        + _SOAP_TAIL
    )
    with pytest.raises(ArcaRejected) as exc:
        wsfev1.parse_cae_response(xml, numero=43, punto_venta=1, tipo_cbte=11)
    assert any(o["Code"] == "10242" for o in exc.value.observaciones)


def test_parse_ultimo_autorizado():
    xml = (
        _SOAP_HEAD
        + '<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/">'
        + "<FECompUltimoAutorizadoResult><PtoVta>1</PtoVta><CbteTipo>11</CbteTipo>"
        + "<CbteNro>42</CbteNro></FECompUltimoAutorizadoResult>"
        + "</FECompUltimoAutorizadoResponse>"
        + _SOAP_TAIL
    )
    assert wsfev1.parse_ultimo_autorizado(xml) == 42


# ── wsfev1: construcción del request ────────────────────────────────────────

def test_build_cae_request_incluye_campos_obligatorios_2025():
    ta = {"token": "T", "sign": "S"}
    imp = mapping.importes(1000, mapping.CBTE_FACTURA_C)
    xml = wsfev1.build_cae_request(
        ta=ta, cuit_representado="20111111112", punto_venta=1,
        tipo_cbte=mapping.CBTE_FACTURA_C, numero=43, concepto=1,
        doc_tipo=99, doc_nro="0", cond_iva_receptor=5, imp=imp, fecha="20260813",
    )
    # Campos obligatorios desde 2025:
    assert "<ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>" in xml
    assert "<ar:CanMisMonExt>N</ar:CanMisMonExt>" in xml
    # Delegación: el Cuit del Auth es el del comercio representado.
    assert "<ar:Cuit>20111111112</ar:Cuit>" in xml
    # Factura C NO lleva bloque de IVA.
    assert "<ar:Iva>" not in xml


def test_build_cae_request_factura_b_lleva_iva():
    ta = {"token": "T", "sign": "S"}
    imp = mapping.importes(121, mapping.CBTE_FACTURA_B, "21")
    xml = wsfev1.build_cae_request(
        ta=ta, cuit_representado="20111111112", punto_venta=1,
        tipo_cbte=mapping.CBTE_FACTURA_B, numero=10, concepto=1,
        doc_tipo=99, doc_nro="0", cond_iva_receptor=5, imp=imp, fecha="20260813",
    )
    assert "<ar:Iva>" in xml
    assert "<ar:AlicIva>" in xml

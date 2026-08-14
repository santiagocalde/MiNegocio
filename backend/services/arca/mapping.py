"""
Mapeo fiscal: reglas de negocio para armar un comprobante ARCA.

Todo lo de este módulo es lógica PURA (sin red ni BD) y está cubierto por tests
en tests/test_arca.py. Acá viven las reglas que suelen equivocarse:
  - qué tipo de comprobante corresponde (A / B / C)
  - el CondicionIVAReceptorId (OBLIGATORIO desde 2025 — sin esto ARCA rechaza)
  - cómo se descompone el total en neto + IVA (y que la Factura C no discrimina)
"""

# ── Tipos de comprobante (FEParamGetTiposCbte) ──────────────────────────────
CBTE_FACTURA_A = 1
CBTE_FACTURA_B = 6
CBTE_FACTURA_C = 11

# ── Tipos de documento del receptor (FEParamGetTiposDoc) ────────────────────
DOC_CUIT = 80
DOC_DNI = 96
DOC_CONSUMIDOR_FINAL = 99

# ── Condición IVA del receptor (FEParamGetCondicionIvaReceptor) ─────────────
# OBLIGATORIO desde 2025 (RG 5616). Sin este campo ARCA devuelve error 10242.
COND_IVA_RECEPTOR = {
    "responsable_inscripto": 1,
    "exento": 4,
    "consumidor_final": 5,
    "monotributo": 6,
    "no_categorizado": 7,
    "monotributo_social": 13,
    "no_alcanzado": 15,
}

# ── Alícuotas de IVA (FEParamGetTiposIva) ───────────────────────────────────
IVA_ID = {
    "0": 3,
    "10.5": 4,
    "21": 5,
    "27": 6,
    "5": 8,
    "2.5": 9,
}


def normalizar_condicion(texto: str) -> str:
    """Convierte el texto libre de condición IVA (como lo guarda el negocio) a una
    clave canónica. Tolerante a mayúsculas, acentos y abreviaturas."""
    t = (texto or "").strip().lower()
    if not t:
        return "consumidor_final"
    if "insc" in t or t in ("ri", "responsable inscripto"):
        return "responsable_inscripto"
    if "social" in t:
        return "monotributo_social"
    if "mono" in t:
        return "monotributo"
    if "exent" in t:
        return "exento"
    if "no alc" in t or "no-alc" in t:
        return "no_alcanzado"
    if "no cat" in t:
        return "no_categorizado"
    return "consumidor_final"


def tipo_comprobante(emisor_cond: str, receptor_cond: str) -> int:
    """Determina A/B/C según la condición del EMISOR (el comercio representado)
    y del RECEPTOR (el cliente del comercio).

    - Emisor Responsable Inscripto → A si el receptor también es RI, si no B.
    - Emisor Monotributo o Exento → siempre C.
    """
    e = normalizar_condicion(emisor_cond)
    r = normalizar_condicion(receptor_cond)
    if e == "responsable_inscripto":
        return CBTE_FACTURA_A if r == "responsable_inscripto" else CBTE_FACTURA_B
    return CBTE_FACTURA_C


def condicion_iva_receptor_id(receptor_cond: str) -> int:
    """Código ARCA de la condición IVA del receptor. Default: Consumidor Final."""
    return COND_IVA_RECEPTOR.get(normalizar_condicion(receptor_cond), 5)


def documento(tipo_cbte: int, receptor_doc: str, receptor_cond: str = "") -> tuple[int, str]:
    """Devuelve (DocTipo, DocNro) del receptor.

    - Factura A: SIEMPRE requiere CUIT del receptor (11 dígitos).
    - Factura B/C sin documento: Consumidor Final (99 / 0).
    - Con documento: CUIT si tiene 11 dígitos, si no DNI.
    """
    doc = "".join(ch for ch in (receptor_doc or "") if ch.isdigit())
    if tipo_cbte == CBTE_FACTURA_A:
        return DOC_CUIT, doc
    if not doc:
        return DOC_CONSUMIDOR_FINAL, "0"
    return (DOC_CUIT, doc) if len(doc) == 11 else (DOC_DNI, doc)


def importes(total: float, tipo_cbte: int, iva_rate: str = "21") -> dict:
    """Descompone el total en neto + IVA según el tipo de comprobante.

    - Factura C (Monotributo): NO discrimina IVA. neto = total, iva = 0, sin
      array de alícuotas (si se manda, ARCA rechaza la C).
    - Factura A/B (RI): discrimina. neto = total / (1 + tasa); iva = total - neto.

    Todos los importes se redondean a 2 decimales. La suma neto + iva == total
    exactamente (el IVA absorbe el redondeo).
    """
    total = round(float(total), 2)
    if tipo_cbte == CBTE_FACTURA_C:
        return {
            "imp_total": total,
            "imp_tot_conc": 0.0,
            "imp_neto": total,
            "imp_op_ex": 0.0,
            "imp_iva": 0.0,
            "imp_trib": 0.0,
            "iva_array": [],
        }
    tasa = float(iva_rate or "21")
    neto = round(total / (1 + tasa / 100), 2)
    iva = round(total - neto, 2)
    return {
        "imp_total": total,
        "imp_tot_conc": 0.0,
        "imp_neto": neto,
        "imp_op_ex": 0.0,
        "imp_iva": iva,
        "imp_trib": 0.0,
        "iva_array": [{"Id": IVA_ID.get(str(iva_rate), 5), "BaseImp": neto, "Importe": iva}],
    }

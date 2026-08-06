"""
Servicio de Factura Electrónica AFIP/ARCA.
Soporta modo simulado (default) y modo real con PyAfipWs.

Para activar modo real por negocio:
1. El negocio debe tener archivos .crt y .key en /data/certs/{business_id}/
2. Configurar business_config.arca_modo = 'real'
"""

import os
import uuid
import datetime
import logging

logger = logging.getLogger("afip_service")

CERTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "certs")


def _get_cert_paths(business_id: str):
    """Devuelve las rutas a los certificados del negocio."""
    base = os.path.join(CERTS_DIR, business_id)
    return os.path.join(base, "cert.crt"), os.path.join(base, "private.key")


def _has_real_certs(business_id: str) -> bool:
    crt, key = _get_cert_paths(business_id)
    return os.path.isfile(crt) and os.path.isfile(key)


async def emitir_factura_electronica(
    cuit_emisor: str,
    total: float,
    items: list,
    tipo_comprobante: str = "C",
    cliente_doc: str = "0",
    business_id: str = None,
    punto_venta: int = 1,
) -> dict:
    """
    Emite factura electrónica. Si el negocio tiene certificados reales,
    usa PyAfipWs. Si no, genera CAE simulado.

    Parámetros:
    - tipo_comprobante: 'A', 'B', o 'C'
    - cliente_doc: CUIT del cliente (obligatorio para A/B, 0 para C)
    """
    if business_id and _has_real_certs(business_id):
        return await _real_afip(cuit_emisor, total, items, tipo_comprobante, cliente_doc, business_id, punto_venta)
    return _simulado()


def _simulado() -> dict:
    """Modo desarrollo: CAE falso para pruebas."""
    cae = str(uuid.uuid4().int)[:14]
    vto = (datetime.datetime.now() + datetime.timedelta(days=10)).strftime("%Y-%m-%d")
    return {
        "aprobado": True,
        "cae": cae,
        "cae_vto": vto,
        "factura_nro": f"0001-{str(uuid.uuid4().int)[:8]}",
        "link_pdf": f"https://afip.gob.ar/fe/comprobante?cae={cae}",
        "modo": "simulado",
    }


async def _real_afip(cuit: str, total: float, items: list, tipo: str, doc_cliente: str, biz_id: str, pv: int) -> dict:
    """
    Usa PyAfipWs para comunicarse con AFIP.
    Requiere certificados válidos en /data/certs/{business_id}/
    """
    try:
        from pyafipws.wsaa import WSAA
        from pyafipws.wsfev1 import WSFEv1

        crt, key = _get_cert_paths(biz_id)

        # Autenticación
        wsaa = WSAA()
        ta = wsaa.Autenticar("wsfe", crt, key, cache=os.path.join(CERTS_DIR, biz_id, "ta.xml"))

        # Facturación
        wsfe = WSFEv1()
        wsfe.SetTicketAcceso(ta["token"])
        wsfe.SetSign(ta["sign"])
        wsfe.Cuit = cuit

        # Obtener último número de comprobante
        wsfe.PuntoVenta = pv
        wsfe.CbteTipo = _tipo_comprobante(tipo)
        ultimo = wsfe.CompUltimoAutorizado(wsfe.CbteTipo, pv)
        nro = int(ultimo) + 1

        # Armar comprobante
        wsfe.CrearFactura(
            concepto=1,  # Productos
            tipo_doc=80 if doc_cliente == "0" or not doc_cliente else 80,  # CUIT
            nro_doc=doc_cliente or "0",
            tipo_cbte=wsfe.CbteTipo,
            punto_vta=pv,
            cbt_desde=nro,
            cbt_hasta=nro,
            imp_total=str(round(total, 2)),
            imp_neto=str(round(total / 1.21, 2)),
            imp_iva=str(round(total - total / 1.21, 2)),
            fecha_cbte=datetime.datetime.now().strftime("%Y%m%d"),
        )

        for i, item in enumerate(items):
            wsfe.AgregarItem(
                u_mrz=item.get("cantidad", 1),
                precio=str(round(item.get("precio", 0), 2)),
                ds=item.get("nombre", "")[:60],
                iva_id=5,  # 21%
            )

        # Solicitar CAE
        wsfe.CAESolicitar()
        cae = wsfe.Resultado.get("CAE", "")
        vto = wsfe.Resultado.get("CAEFchVto", "")

        logger.info(f"AFIP real: factura {tipo} N° {nro} emitida para {cuit} — CAE {cae}")
        return {
            "aprobado": True,
            "cae": cae,
            "cae_vto": vto,
            "factura_nro": f"{str(pv).zfill(4)}-{str(nro).zfill(8)}",
            "link_pdf": f"https://afip.gob.ar/fe/comprobante?cae={cae}",
            "modo": "real",
        }

    except ImportError:
        logger.warning("PyAfipWs no instalado. Usando modo simulado.")
        return _simulado()
    except Exception as e:
        logger.error(f"Error AFIP real para {biz_id}: {e}")
        return {"aprobado": False, "error": str(e), "cae": "", "factura_nro": "", "modo": "real"}


def _tipo_comprobante(tipo: str) -> int:
    """Convierte 'A'/'B'/'C' a código AFIP."""
    return {"A": 1, "B": 6, "C": 11}.get(tipo.upper(), 11)

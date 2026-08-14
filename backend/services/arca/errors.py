"""
Errores del servicio de Facturación Electrónica ARCA.

La distinción clave es entre errores TRANSITORIOS (se puede reintentar, pero
SIEMPRE verificando antes el último comprobante para no emitir dos veces) y
RECHAZOS (ARCA dijo que no; reintentar sin corregir es inútil).
"""


class ArcaError(Exception):
    """Error genérico del servicio ARCA."""


class ArcaNotConfigured(ArcaError):
    """Falta el CUIT o el certificado del representante (revisar variables .env)."""


class ArcaAuthError(ArcaError):
    """Falló la autenticación WSAA (certificado inválido, expirado, o delegación
    no otorgada por el comercio representado)."""


class ArcaTransientError(ArcaError):
    """Error transitorio: timeout, corte de red, 5xx de ARCA, o SOAP fault.

    PELIGRO: ante este error la factura PUEDE haberse emitido igual (bug conocido
    de ARCA). Nunca reintentar a ciegas: primero consultar el último comprobante
    autorizado. Ver services/arca/wsfev1.solicitar_cae.
    """


class ArcaRejected(ArcaError):
    """ARCA rechazó el comprobante (Resultado='R').

    `observaciones` y `errores` traen el detalle (código + mensaje) para mostrar
    al usuario. No reintentar sin corregir los datos.
    """

    def __init__(self, message: str, observaciones=None, errores=None):
        super().__init__(message)
        self.observaciones = observaciones or []
        self.errores = errores or []

    def detalle(self) -> str:
        partes = []
        for o in self.observaciones:
            partes.append(f"Obs {o.get('Code')}: {o.get('Msg')}")
        for e in self.errores:
            partes.append(f"Error {e.get('Code')}: {e.get('Msg')}")
        return " | ".join(partes) or str(self)

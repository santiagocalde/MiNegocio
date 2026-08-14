"""
Servicio de Facturación Electrónica ARCA (ex AFIP) — modelo de delegación
multi-cliente. Ver README.md para arquitectura y onboarding.

API pública:
    from services import arca
    await arca.emitir(cuit_representado=..., emisor_condicion=..., punto_venta=..., total=...)
    await arca.health()
    arca.esta_configurado()
"""
from . import config, mapping
from .errors import (
    ArcaAuthError,
    ArcaError,
    ArcaNotConfigured,
    ArcaRejected,
    ArcaTransientError,
)

__all__ = [
    "emitir",
    "health",
    "esta_configurado",
    "ArcaError",
    "ArcaNotConfigured",
    "ArcaAuthError",
    "ArcaTransientError",
    "ArcaRejected",
    "config",
    "mapping",
]


def esta_configurado() -> bool:
    """True si hay CUIT + certificado del representante disponibles."""
    return config.is_configured()


async def emitir(**kwargs) -> dict:
    """Emite una factura electrónica. Ver wsfev1.solicitar_cae para los kwargs.

    Devuelve {cae, cae_vto, numero, punto_venta, tipo_cbte, resultado, observaciones}.
    Lanza ArcaRejected (datos a corregir) o ArcaTransientError (reintentar luego)."""
    from . import wsfev1

    return await wsfev1.solicitar_cae(**kwargs)


async def health() -> dict:
    """Estado del servicio WSFEv1 de ARCA (FEDummy)."""
    from . import wsfev1

    return await wsfev1.dummy()

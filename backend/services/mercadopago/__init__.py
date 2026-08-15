"""
Cobro con QR de Mercado Pago en el mostrador (auto-confirmación).

Modelo: cada comercio usa SU token de MP (cobra a su cuenta). Se crea una
preferencia por venta con external_reference = id del intent; la notebook hace
poll y verificamos el pago real contra MP. Gateado por `mp_auto_confirm`.

Ver routers/mp_pos.py para los endpoints.
"""
from . import client, repo

__all__ = ["client", "repo"]

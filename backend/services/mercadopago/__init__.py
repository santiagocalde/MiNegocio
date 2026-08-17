"""
Cobro con QR Presencial (caja fija) de Mercado Pago en el mostrador.

Modelo: cada comercio usa SU token de MP (cobra a su cuenta). Se crea UNA vez una
sucursal + caja con QR fijo imprimible; por cada venta se "arma" una orden con el
monto (external_reference = id del intent) sobre esa caja. El cliente escanea el
QR fijo del mostrador, la notebook hace poll y verificamos el pago real contra MP
(monto incluido). Gateado por `mp_auto_confirm` + caja configurada.

Ver routers/mp_pos.py para los endpoints.
"""
from . import client, repo

__all__ = ["client", "repo"]

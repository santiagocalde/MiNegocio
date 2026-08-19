"""
Precios centralizados de planes MiNegocio.
Modificar este archivo actualiza billing.py, system.py y PlanPage.jsx.
"""

PLANS_CONFIG = {
    "simple": {"name": "Plan Simple", "monthly": 19999, "yearly": 180000, "desc": "Hasta 3.500 productos", "popular": False,
               "features": ['Punto de venta con lector de c??digo de barras', 'Vuelto autom??tico en efectivo, transferencia, tarjeta y QR', 'Cobro dividido (pago mixto) en un solo ticket', 'Fondo de cambio y aviso de retiro mayor al caj??n', 'Control de stock con alertas de reposici??n', 'Cuentas corrientes (fiados) con historial de pagos', 'Compras a proveedores con control de deuda', 'Promociones y descuentos por producto', 'M??dulo Cajas: arqueo, cierre de turno y caja inicial', 'Reportes y resumen del d??a (ventas, pagos y operador)', 'Impresi??n de tickets y comprobantes', 'Funciona sin internet (modo offline)', 'Facturaci??n ARCA (+adicional)']},
    "pro":    {"name": "Plan Pro",    "monthly": 29999, "yearly": 270000, "desc": "El m??s elegido", "popular": True,
               "features": ['Todo lo del plan Simple', 'QR fijo imprimible para tu mostrador (auto-confirmaci??n)', 'Reportes de ventas, ganancias y rentabilidad', 'Exportaci??n de tus datos a Excel', 'An??lisis de qu?? productos te convienen (ventas por categor??a)', 'Dashboard ejecutivo: deudores, proveedores y top productos', 'Cat??logo web con QR (tu tienda online)', 'Devoluciones y notas de cr??dito', 'Etiquetas de precio imprimibles', 'Historial completo y auditor??a de operaciones', 'Facturaci??n ARCA (+adicional)']},
    "ia":     {"name": "Plan IA",     "monthly": 39999, "yearly": 360000, "desc": "Tu negocio con inteligencia artificial", "popular": False,
               "features": ['Todo lo del plan Pro', 'Esc??ner de facturas con IA', 'Resumen diario del negocio con IA', 'Asesor de precios y reposici??n con IA', 'Sugerencias de compra y reposici??n inteligentes', 'Advertencia de stock pr??ximo a agotarse con IA', 'Cobranza de fiados por WhatsApp con IA', 'Pedidos por adelantado con entregas parciales', 'Facturaci??n ARCA (+adicional)']},
}

ARCA_TIERS = [
    {"id": "arca_150",  "label": "150 fact/mes",  "limit": 150,  "monthly": 4500,  "yearly": 40500},
    {"id": "arca_400",  "label": "400 fact/mes",  "limit": 400,  "monthly": 8000,  "yearly": 72000},
    {"id": "arca_800",  "label": "800 fact/mes",  "limit": 800,  "monthly": 14000, "yearly": 126000},
    {"id": "arca_inf",  "label": "Sin límite",    "limit": None, "monthly": 20000, "yearly": 180000},
]

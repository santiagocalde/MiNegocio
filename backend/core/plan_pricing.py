"""
Precios centralizados de planes MiNegocio.
Modificar este archivo actualiza billing.py, system.py y PlanPage.jsx.
"""

PLANS_CONFIG = {
    "simple": {"name": "Plan Simple", "monthly": 19999, "yearly": 180000, "desc": "Hasta 3.500 productos", "popular": False,
               "features": ["Hasta 3.500 productos", "Clientes y ventas", "Soporta cortes de internet", "Manejo de fiados", "Manejo de proveedores", "Lector laser e impresoras", "Hasta 2 usuarios"]},
    "pro":    {"name": "Plan Pro",    "monthly": 29999, "yearly": 270000, "desc": "El más elegido", "popular": True,
               "features": ["Todo lo de Simple", "Catalogo web con QR (tu tienda online)", "Reportes de ventas y ganancias", "Analisis de rentabilidad por producto", "Hasta 7.000 productos", "Hasta 5 usuarios"]},
    "ia":     {"name": "Plan IA",     "monthly": 39999, "yearly": 360000, "desc": "Tu negocio con inteligencia artificial", "popular": False,
               "features": ["Todo lo de Pro", "Escaner de facturas con IA", "Resumen diario del negocio con IA", "Asesor de precios y reposicion con IA", "Cobranza de fiados por WhatsApp con IA", "Hasta 10.000 productos"]},
}

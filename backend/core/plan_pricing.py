"""
Precios centralizados de planes MiNegocio.
Modificar este archivo actualiza billing.py, system.py y PlanPage.jsx.
"""

PLANS_CONFIG = {
    "simple": {"name": "Plan Simple", "monthly": 20000, "yearly": 200000, "desc": "Hasta 3.500 productos", "popular": False,
               "features": ["Hasta 3.500 productos", "Clientes y ventas", "Soporta cortes de internet", "Manejo de fiados", "Manejo de proveedores", "Lector laser e impresoras", "Hasta 2 usuarios"]},
    "pro":    {"name": "Plan Pro",    "monthly": 30000, "yearly": 300000, "desc": "El más elegido", "popular": True,
               "features": ["Todo lo de Simple", "Catalogo web con QR (tu tienda online)", "Reportes de ventas y ganancias", "Analisis de rentabilidad por producto", "Hasta 7.000 productos", "Hasta 5 usuarios"]},
    "ia":     {"name": "Plan IA",     "monthly": 40000, "yearly": 400000, "desc": "Tu negocio con inteligencia artificial", "popular": False,
               "features": ["Todo lo de Pro", "Escaner de facturas con IA", "Resumen diario del negocio con IA", "Asesor de precios y reposicion con IA", "Cobranza de fiados por WhatsApp con IA", "Hasta 10.000 productos"]},
}

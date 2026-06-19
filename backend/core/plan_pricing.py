"""
Precios centralizados de planes MiNegocio.
Modificar este archivo actualiza billing.py, system.py y PlanPage.jsx.
"""

PLANS_CONFIG = {
    "simple": {"name": "Plan Simple", "monthly": 20000, "yearly": 200000, "desc": "Hasta 3.500 productos", "popular": False,
               "features": ["Hasta 3.500 productos", "Clientes y ventas", "Soporta cortes de internet", "Manejo de fiados", "Manejo de proveedores", "Lector laser e impresoras", "Hasta 2 usuarios"]},
    "pro":    {"name": "Plan Pro",    "monthly": 30000, "yearly": 300000, "desc": "Hasta 7.000 productos", "popular": True,
               "features": ["Todo lo de Simple", "Hasta 7.000 productos", "Catalogo web online QR", "Reportes de ventas detallados", "Hasta 5 usuarios"]},
    "ia":     {"name": "Plan IA",     "monthly": 40000, "yearly": 400000, "desc": "Hasta 10.000 productos", "popular": False,
               "features": ["Todo lo de Pro", "Hasta 10.000 productos", "Escanner de facturas IA", "Asesor de precios inteligente", "Reportes de rentabilidad", "Hasta 10 usuarios"]},
}

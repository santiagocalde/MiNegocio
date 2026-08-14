"""
Precios centralizados de planes MiNegocio.
Modificar este archivo actualiza billing.py, system.py y PlanPage.jsx.
"""

PLANS_CONFIG = {
    "simple": {"name": "Plan Simple", "monthly": 19999, "yearly": 180000, "desc": "Hasta 3.500 productos", "popular": False,
               "features": ["Hasta 3.500 productos", "Clientes y ventas", "Soporta cortes de internet", "Manejo de fiados", "Manejo de proveedores", "Lector laser e impresoras", "Hasta 2 usuarios", "Facturación ARCA (+adicional)"]},
    "pro":    {"name": "Plan Pro",    "monthly": 29999, "yearly": 270000, "desc": "El más elegido", "popular": True,
               "features": ["Todo lo de Simple", "Catalogo web con QR (tu tienda online)", "Reportes de ventas y ganancias", "Analisis de rentabilidad por producto", "Hasta 7.000 productos", "Hasta 5 usuarios", "Facturación ARCA (+adicional)"]},
    "ia":     {"name": "Plan IA",     "monthly": 39999, "yearly": 360000, "desc": "Tu negocio con inteligencia artificial", "popular": False,
               "features": ["Todo lo de Pro", "Escaner de facturas con IA", "Resumen diario del negocio con IA", "Asesor de precios y reposicion con IA", "Cobranza de fiados por WhatsApp con IA", "Hasta 10.000 productos", "Facturación ARCA (+adicional)"]},
}

# Add-on Facturación Electrónica ARCA
# Se contrata independientemente del plan base.
# limit=None significa sin límite de facturas.
ARCA_TIERS = [
    {"id": "arca_150",  "label": "150 fact/mes",  "limit": 150,  "monthly": 4500,  "yearly": 40500},
    {"id": "arca_400",  "label": "400 fact/mes",  "limit": 400,  "monthly": 8000,  "yearly": 72000},
    {"id": "arca_800",  "label": "800 fact/mes",  "limit": 800,  "monthly": 14000, "yearly": 126000},
    {"id": "arca_inf",  "label": "Sin límite",    "limit": None, "monthly": 20000, "yearly": 180000},
]

import os
import re

def refactor():
    with open('backend/main.py', 'r', encoding='utf-8') as f:
        text = f.read()

    # Define router mappings
    routers_map = {
        "products": [
            "PRODUCTS & CATEGORIES ENDPOINTS",
            "ACTUALIZACIÓN MASIVA DE PRECIOS",
            "SUGERENCIAS DE PRECIOS POR INFLACIÓN",
            "CATÁLOGO PÚBLICO — Menú QR para clientes"
        ],
        "sales": [
            "TURNS ENDPOINTS",
            "SALES ENDPOINTS",
            "TURN DETAIL (items vendidos por turno)"
        ],
        "inventory": [
            "MOVEMENTS ENDPOINT (auditoría)",
            "EGRESOS DE CAJA",
            "ALERTAS DE STOCK (para mostrar al iniciar turno)",
            "SUPPLIERS & PURCHASES ENDPOINTS"
        ],
        "config": [
            "BUSINESS CONFIG",
            "SUCURSALES ENDPOINTS"
        ],
        "system": [
            "HEALTH & LOGS ENDPOINTS",
            "SYNC ENDPOINT — Offline-first Cloud Sync",
            "WEBHOOK — Mercado Pago Suscripciones"
        ]
    }

    # Common router header
    router_header = """from fastapi import APIRouter, HTTPException, Depends, Query, Body, Header, Request, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import aiosqlite
import logging
import uuid
from decimal import Decimal

# Importamos directamente del módulo principal para no romper la app en esta transición
# (en una Hexagonal pura, se inyectarían dependencias)
from main import (
    DB_PATH, db_write_lock, row_to_dict, get_product_or_404,
    check_plan_limits, require_role, check_product_limit,
    get_current_business, logger
)

router = APIRouter()

"""

    os.makedirs('backend/routers', exist_ok=True)

    # Split text by section delimiters
    sections_raw = re.split(r'# ─+\n# (.*?)\n# ─+\n', text)
    
    # sections_raw[0] is everything before the first delimiter
    # sections_raw[1] is the name of the first delimiter
    # sections_raw[2] is the content of the first delimiter
    # ...
    
    main_new_parts = [sections_raw[0]]
    router_contents = {name: router_header for name in routers_map.keys()}
    
    for i in range(1, len(sections_raw), 2):
        section_name = sections_raw[i].strip()
        section_content = sections_raw[i+1]
        
        # Check if this section belongs to a router
        assigned_router = None
        for r_name, r_sections in routers_map.items():
            if section_name in r_sections:
                assigned_router = r_name
                break
                
        if assigned_router:
            # Replace @app. with @router.
            modified_content = section_content.replace("@app.", "@router.")
            
            # Since schemas are defined in main.py, we don't need to move them unless they are INSIDE the section.
            # Most endpoints use Pydantic models. We will let them use the ones already in main.py or if they are inside, they get moved.
            
            router_contents[assigned_router] += f"\n# {'─'*60}\n# {section_name}\n# {'─'*60}\n" + modified_content
        else:
            # Keep in main.py
            main_new_parts.append(f"\n# {'─'*60}\n# {section_name}\n# {'─'*60}\n" + section_content)

    # Write routers
    for r_name, content in router_contents.items():
        with open(f'backend/routers/{r_name}.py', 'w', encoding='utf-8') as f:
            f.write(content)

    # Rewrite main.py with router includes
    main_new = "".join(main_new_parts)
    main_new += """
# ─────────────────────────────────────────────────────────────
# INCLUSIÓN DE ROUTERS MODULARES
# ─────────────────────────────────────────────────────────────
from routers.products import router as products_router
from routers.sales import router as sales_router
from routers.inventory import router as inventory_router
from routers.config import router as config_router
from routers.system import router as system_router

app.include_router(products_router)
app.include_router(sales_router)
app.include_router(inventory_router)
app.include_router(config_router)
app.include_router(system_router)
"""

    # We must ensure that circular imports aren't an issue.
    # The routers import from `main`. `main` imports from `routers`.
    # In Python, this works if `app.include_router` happens at the BOTTOM of `main.py`.
    
    with open('backend/main.py', 'w', encoding='utf-8') as f:
        f.write(main_new)

    print("Main.py refactored into modular routers!")

if __name__ == "__main__":
    refactor()

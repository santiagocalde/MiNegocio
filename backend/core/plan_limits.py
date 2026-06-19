"""
Plan gating y límites de suscripción.
Importar desde aquí en todos los routers que necesiten check_plan_limits.
"""
import aiosqlite
from typing import Optional
from fastapi import HTTPException

PLAN_LIMITS = {
    "trial":  {"max_products": 50,    "max_operators": 2,  "multi_sucursal": False, "purchases": False, "audit_cloud": False},
    "simple": {"max_products": 3500,  "max_operators": 2,  "multi_sucursal": False, "purchases": True,  "audit_cloud": False},
    "pro":    {"max_products": 7000,  "max_operators": 5,  "multi_sucursal": True,  "purchases": True,  "audit_cloud": True},
    "ia":     {"max_products": 10000, "max_operators": 10, "multi_sucursal": True,  "purchases": True,  "audit_cloud": True},
}

ROLE_HIERARCHY = {"admin": 3, "manager": 2, "employee": 1, "cashier": 0}


async def check_plan_limits(feature: str, business: Optional[dict] = None) -> dict:
    """
    Valida si el plan del comercio tiene acceso a una feature.
    Si business es None (modo local), permite todo (kiosco físico sin restricciones).
    Lanza HTTP 402 si el límite fue superado.
    """
    if business is None:
        return PLAN_LIMITS["ia"]

    plan = business.get("plan", "trial")
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])

    if feature == "multi_sucursal" and not limits["multi_sucursal"]:
        raise HTTPException(
            status_code=402,
            detail=f"Multi-sucursal requiere Plan Pro o superior. Tu plan actual es '{plan}'.",
        )
    if feature == "purchases" and not limits["purchases"]:
        raise HTTPException(status_code=402, detail="El módulo de Compras requiere Plan Simple o superior.")
    if feature == "audit_cloud" and not limits["audit_cloud"]:
        raise HTTPException(status_code=402, detail="Auditoría en la nube requiere Plan Pro o superior.")
    return limits


async def check_product_limit(business: Optional[dict] = None, extra_count: int = 0) -> Optional[dict]:
    """Verifica que el comercio no superó el límite de productos de su plan."""
    if business is None:
        return None

    import os
    USE_PG = bool(os.getenv("DATABASE_URL", ""))

    plan = business.get("plan", "trial")
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])["max_products"]
    if limit is None:
        return None

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM products WHERE business_id = $1 AND is_virtual = 0",
                business.get("sub"),
            )
    else:
        DB_PATH = os.getenv("DB_PATH") or os.path.join(os.path.dirname(__file__), "..", "data", "minegocio.db")
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT COUNT(*) FROM products WHERE is_virtual = 0") as cur:
                count = (await cur.fetchone())[0]

    if count + extra_count > limit:
        raise HTTPException(
            status_code=402,
            detail=f"Limite de {limit} productos alcanzado (plan {plan}). Tienes {count}, intentas agregar {extra_count}. Actualiza tu plan.",
        )
    return {"count": count, "limit": limit}


async def require_role(operator_name: str, min_role: str = "admin") -> None:
    """Valida que el operador tiene al menos el rol mínimo requerido."""
    import os
    DB_PATH = os.getenv("DB_PATH") or os.path.join(os.path.dirname(__file__), "..", "data", "minegocio.db")

    if not operator_name or operator_name == "Sistema":
        raise HTTPException(
            status_code=403,
            detail="Operador inválido. Se requiere un operador real para esta acción.",
        )

    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT role FROM operators WHERE name = ?", (operator_name,)) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(status_code=403, detail="Operador desconocido.")

    if ROLE_HIERARCHY.get(row[0], 0) < ROLE_HIERARCHY.get(min_role, 3):
        raise HTTPException(
            status_code=403,
            detail=f"Acción denegada. Se requiere rol '{min_role}' o superior.",
        )

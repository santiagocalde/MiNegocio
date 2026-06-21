"""
SuperAdmin Panel — Gestión de negocios SaaS, planes, métricas y auditoría.
Todas las rutas requieren JWT con role='superadmin'.
"""
import os, bcrypt, logging, csv, io
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Query, Depends, Request, Header, Body
from typing import Optional
from jose import jwt
import main

router = APIRouter()
logger = logging.getLogger("NovaStock.Admin")

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-insecure-change-me")
JWT_ALGORITHM = "HS256"

from slowapi import Limiter
from slowapi.util import get_remote_address
admin_limiter = Limiter(key_func=get_remote_address)

# ────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────

def verify_superadmin(authorization: Optional[str] = Header(None)) -> dict:
    """Valida JWT y extrae payload. Solo permite role='superadmin'."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="Token requerido")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "superadmin":
            raise HTTPException(403, detail="Acceso denegado: solo superadmins")
        if payload.get("type") != "access":
            raise HTTPException(401, detail="Token inválido")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, detail="Token expirado")
    except jwt.JWTError:
        raise HTTPException(401, detail="Token inválido")


async def _get_pool():
    from db_helpers import get_pg_pool
    return await get_pg_pool()


def _now():
    return datetime.now(timezone.utc)


# ────────────────────────────────────────────────────────────
# AUTH
# ────────────────────────────────────────────────────────────

@router.post("/api/admin/auth", summary="Login SuperAdmin")
@admin_limiter.limit("3/minute")
async def admin_auth(request: Request, body: dict) -> dict:
    email = (body.get("email") or "").lower().strip()
    password = body.get("password") or ""
    if not email or not password:
        raise HTTPException(400, detail="Email y contraseña requeridos")
    
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, password_hash, role FROM superadmins WHERE email = $1", email
        )
        # Protección anti-timing: siempre verificar hash aunque el email no exista
        valid = row is not None
        stored_hash = row["password_hash"].encode() if valid else bcrypt.hashpw(b"dummy", bcrypt.gensalt()).decode()
        if not valid or not bcrypt.checkpw(password.encode(), stored_hash if isinstance(stored_hash, bytes) else stored_hash.encode()):
            import asyncio
            await asyncio.sleep(1)  # Delay artificial para frenar fuerza bruta
            raise HTTPException(401, detail="Credenciales inválidas")
        
        await conn.execute(
            "UPDATE superadmins SET last_login = $1 WHERE id = $2",
            _now(), row["id"]
        )
    
    access_token = jwt.encode(
        {"sub": row["id"], "email": row["email"], "role": row["role"],
         "type": "access", "exp": _now() + timedelta(hours=12)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )
    return {"access_token": access_token, "token_type": "bearer", "role": row["role"]}


# ────────────────────────────────────────────────────────────
# BUSINESSES LIST
# ────────────────────────────────────────────────────────────

@router.get("/api/admin/businesses", summary="Listar negocios")
async def admin_businesses(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    admin: dict = Depends(verify_superadmin),
) -> dict:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        params = []
        clauses = ["1=1"]
        n = 1
        
        if search:
            clauses.append(f"(b.business_name ILIKE ${n} OR b.email ILIKE ${n})")
            params.append(f"%{search}%"); n += 1
        if status:
            clauses.append(f"b.status = ${n}")
            params.append(status); n += 1
        if plan:
            clauses.append(f"b.plan = ${n}")
            params.append(plan); n += 1
        
        where = " AND ".join(clauses)
        
        # Total count
        total = await conn.fetchval(f"SELECT COUNT(*) FROM businesses b WHERE {where}", *params)
        
        # Paginated data with extra metrics
        offset = (page - 1) * limit
        params.extend([limit, offset])
        rows = await conn.fetch(f"""
            SELECT b.id, b.email, b.business_name, b.plan, b.status, b.phone,
                   b.owner_name, b.business_type, b.created_at, b.updated_at,
                   (SELECT COUNT(*) FROM operators WHERE business_id = b.id) as operators_count,
                   (SELECT MAX(timestamp) FROM sales WHERE business_id = b.id) as last_sale
            FROM businesses b WHERE {where}
            ORDER BY b.created_at DESC
            LIMIT ${n} OFFSET ${n + 1}
        """, *params)
        
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "data": [dict(r) for r in rows],
        }


# ────────────────────────────────────────────────────────────
# CHANGE PLAN
# ────────────────────────────────────────────────────────────

@router.put("/api/admin/businesses/{business_id}/plan", summary="Cambiar plan de negocio")
async def admin_change_plan(
    business_id: str,
    body: dict,
    admin: dict = Depends(verify_superadmin),
) -> dict:
    new_plan = body.get("new_plan", "").lower()
    notes = body.get("notes", "")
    if new_plan not in ("trial", "simple", "pro", "ia"):
        raise HTTPException(400, detail="Plan inválido. Usar: trial, simple, pro, ia")
    
    pool = await _get_pool()
    async with pool.acquire() as conn:
        old = await conn.fetchrow("SELECT plan, status, email, business_name FROM businesses WHERE id = $1", business_id)
        if not old:
            raise HTTPException(404, detail="Negocio no encontrado")
        
        if new_plan != "ia":
            prod_count = await conn.fetchval("SELECT COUNT(*) FROM products WHERE business_id = $1", business_id)
            op_count = await conn.fetchval("SELECT COUNT(*) FROM operators WHERE business_id = $1", business_id)
            from main import PLAN_LIMITS
            limit = PLAN_LIMITS.get(new_plan, {})
            if limit.get("max_products") and prod_count > limit["max_products"]:
                logger.warning(f"Downgrade {business_id}: {prod_count} productos exceden limite {new_plan} ({limit['max_products']})")
            if limit.get("max_operators") and op_count > limit["max_operators"]:
                logger.warning(f"Downgrade {business_id}: {op_count} operadores exceden limite {new_plan} ({limit['max_operators']})")
        
        async with conn.transaction():
            new_plan_end = _now() + timedelta(days=30) if new_plan in ("simple","pro","ia") else None
            await conn.execute(
                "UPDATE businesses SET plan = $1, plan_end_date = COALESCE($2, plan_end_date), plan_pending = NULL, updated_at = $3 WHERE id = $4",
                new_plan, new_plan_end, _now(), business_id
            )
            audit_id = await conn.fetchval(
                """INSERT INTO admin_audit_log (superadmin_id, business_id, action, old_value, new_value, notes)
                   VALUES ($1, $2, 'plan_change', $3::jsonb, $4::jsonb, $5) RETURNING id""",
                admin["sub"], business_id,
                f'{{"plan": "{old["plan"]}"}}',
                f'{{"plan": "{new_plan}"}}',
                notes or ""
            )
    
    logger.info(f"SuperAdmin {admin['email']} cambió plan de {business_id}: {old['plan']} → {new_plan}")

    # Email de bienvenida al plan (solo al activar un plan pago, no en downgrade a trial)
    email_sent = False
    if new_plan in ("simple", "pro", "ia") and new_plan != old["plan"]:
        try:
            from services.email_service import send_plan_activated
            await send_plan_activated(old["email"], old["business_name"] or "tu negocio", new_plan)
            email_sent = True
        except Exception as e:
            logger.error(f"No se pudo enviar email de plan activado a {old['email']}: {e}")

    return {
        "success": True,
        "message": "Plan actualizado",
        "old_plan": old["plan"],
        "new_plan": new_plan,
        "email_sent": email_sent,
        "audit_id": str(audit_id),
    }


# ────────────────────────────────────────────────────────────
# CHANGE STATUS
# ────────────────────────────────────────────────────────────

@router.put("/api/admin/businesses/{business_id}/status", summary="Cambiar estado de negocio")
async def admin_change_status(
    business_id: str,
    body: dict,
    admin: dict = Depends(verify_superadmin),
) -> dict:
    new_status = body.get("status", "").lower()
    reason = body.get("reason", "")
    if new_status not in ("active", "suspended", "expired", "past_due"):
        raise HTTPException(400, detail="Estado inválido. Usar: active, suspended, expired, past_due")
    
    pool = await _get_pool()
    async with pool.acquire() as conn:
        old = await conn.fetchrow("SELECT status FROM businesses WHERE id = $1", business_id)
        if not old:
            raise HTTPException(404, detail="Negocio no encontrado")
        
        async with conn.transaction():
            await conn.execute(
                "UPDATE businesses SET status = $1, updated_at = $2 WHERE id = $3",
                new_status, _now(), business_id
            )
            await conn.fetchval(
                """INSERT INTO admin_audit_log (superadmin_id, business_id, action, old_value, new_value, notes)
                   VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6) RETURNING id""",
                admin["sub"], business_id, f"status_{new_status}",
                f'{{"status": "{old["status"]}"}}',
                f'{{"status": "{new_status}"}}',
                reason or ""
            )
    
    logger.info(f"SuperAdmin {admin['email']} cambió status de {business_id}: {old['status']} → {new_status}")
    return {"success": True, "new_status": new_status, "old_status": old["status"]}


# ────────────────────────────────────────────────────────────
# EXTEND TRIAL / PLAN (retención comercial)
# ────────────────────────────────────────────────────────────

@router.post("/api/admin/businesses/{business_id}/extend", summary="Extender prueba o plan N días")
async def admin_extend_plan(
    business_id: str,
    body: dict = Body(...),
    admin: dict = Depends(verify_superadmin),
) -> dict:
    try:
        days = int(body.get("days", 7))
    except (TypeError, ValueError):
        raise HTTPException(400, detail="Días inválidos")
    if days < 1 or days > 365:
        raise HTTPException(400, detail="Los días deben estar entre 1 y 365")
    notes = body.get("notes", "")

    pool = await _get_pool()
    async with pool.acquire() as conn:
        biz = await conn.fetchrow("SELECT plan, status, plan_end_date, created_at FROM businesses WHERE id = $1", business_id)
        if not biz:
            raise HTTPException(404, detail="Negocio no encontrado")

        # Base: la fecha de fin actual si está vigente, si no, desde hoy
        base = biz["plan_end_date"]
        if not base or base < _now():
            base = _now()
        new_end = base + timedelta(days=days)

        async with conn.transaction():
            # Si estaba suspendido/expirado por falta de pago, reactivar
            new_status = "active" if biz["status"] in ("suspended", "expired", "past_due") else biz["status"]
            await conn.execute(
                "UPDATE businesses SET plan_end_date = $1, status = $2, updated_at = $3 WHERE id = $4",
                new_end, new_status, _now(), business_id
            )
            await conn.fetchval(
                """INSERT INTO admin_audit_log (superadmin_id, business_id, action, old_value, new_value, notes)
                   VALUES ($1, $2, 'extend_plan', $3::jsonb, $4::jsonb, $5) RETURNING id""",
                admin["sub"], business_id,
                f'{{"plan_end_date": "{biz["plan_end_date"]}"}}',
                f'{{"plan_end_date": "{new_end.isoformat()}", "days_added": {days}}}',
                notes or ""
            )

    logger.info(f"SuperAdmin {admin['email']} extendió {days} días a {business_id} (nuevo fin: {new_end.date()})")
    return {"success": True, "days_added": days, "new_end_date": new_end.isoformat()}


# ────────────────────────────────────────────────────────────
# DELETE BUSINESS
# ────────────────────────────────────────────────────────────

@router.delete("/api/admin/businesses/{business_id}", summary="Eliminar negocio permanentemente")
async def admin_delete_business(
    business_id: str,
    admin: dict = Depends(verify_superadmin),
) -> dict:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        biz = await conn.fetchrow("SELECT email, business_name, plan FROM businesses WHERE id = $1", business_id)
        if not biz:
            raise HTTPException(404, detail="Negocio no encontrado")
        
        async with conn.transaction():
            await conn.execute("DELETE FROM admin_audit_log WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM sale_items WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM stock_movements WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM customer_transactions WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM customers WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM sales WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE business_id = $1)", business_id)
            await conn.execute("DELETE FROM purchases WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM egresos_caja WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM promotion_conditions WHERE promotion_id IN (SELECT id FROM promotions WHERE business_id = $1)", business_id)
            await conn.execute("DELETE FROM promotions WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM suppliers WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM products WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM operators WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM turns WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM business_config WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM auth_tokens WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM businesses WHERE id = $1", business_id)
    
    logger.warning(f"SuperAdmin {admin['email']} ELIMINÓ negocio {biz['email']} ({biz['business_name']}, plan={biz['plan']})")
    return {"success": True, "message": f"Negocio {biz['business_name']} eliminado permanentemente"}


# ────────────────────────────────────────────────────────────
# METRICS
# ────────────────────────────────────────────────────────────

@router.get("/api/admin/metrics", summary="Métricas globales")
async def admin_metrics(admin: dict = Depends(verify_superadmin)) -> dict:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM businesses")
        active = await conn.fetchval("SELECT COUNT(*) FROM businesses WHERE status = 'active'")
        suspended = await conn.fetchval("SELECT COUNT(*) FROM businesses WHERE status = 'suspended'")
        
        # MRR: sum of plan prices (aproximado con precios fijos)
        plan_prices = {"simple": 20000, "pro": 30000, "ia": 40000}
        mrr = 0
        plan_rows = await conn.fetch("SELECT plan, COUNT(*) as cnt FROM businesses WHERE status = 'active' GROUP BY plan")
        breakdown = {}
        for r in plan_rows:
            p = r["plan"]
            cnt = r["cnt"]
            breakdown[p] = cnt
            mrr += cnt * plan_prices.get(p, 0)
        
        # Churn este mes (negocios suspendidos/expired en últimos 30 días)
        month_ago = _now() - timedelta(days=30)
        churn = await conn.fetchval(
            "SELECT COUNT(*) FROM businesses WHERE status IN ('suspended','expired') AND updated_at >= $1",
            month_ago
        )
        
        # Trial conversions (% de trial que pasaron a pago)
        total_trial_ever = await conn.fetchval("SELECT COUNT(*) FROM businesses") or 1
        converted = await conn.fetchval("SELECT COUNT(*) FROM businesses WHERE plan IN ('simple','pro','ia')") or 0
        
        # Top features (aproximado por uso de endpoints)
        sales_count = await conn.fetchval("SELECT COUNT(*) FROM sales") or 0
        suppliers_count = await conn.fetchval("SELECT COUNT(*) FROM suppliers") or 0
        promotions_count = await conn.fetchval("SELECT COUNT(*) FROM promotions") or 0
        total_products = await conn.fetchval("SELECT COUNT(*) FROM products") or 0

        # Negocios que requieren atención: trial/plan venciendo en <=3 días
        expiring_soon = await conn.fetchval(
            "SELECT COUNT(*) FROM businesses WHERE status = 'active' AND plan_end_date IS NOT NULL AND plan_end_date BETWEEN $1 AND $2",
            _now(), _now() + timedelta(days=3)
        ) or 0

        return {
            "total_businesses": total,
            "active_subscriptions": active,
            "suspended": suspended,
            "mrr": mrr,
            "churn_this_month": churn,
            "trial_conversions": round(converted / max(total_trial_ever, 1) * 100, 1),
            "breakdown_by_plan": breakdown,
            "total_products": total_products,
            "expiring_soon": expiring_soon,
            "top_features_used": [
                {"feature": "POS / Ventas", "count": sales_count},
                {"feature": "Proveedores", "count": suppliers_count},
                {"feature": "Promociones", "count": promotions_count},
            ],
        }


# ────────────────────────────────────────────────────────────
# NEGOCIOS EN RIESGO (atención comercial)
# ────────────────────────────────────────────────────────────

@router.get("/api/admin/insights", summary="Insights del onboarding")
async def admin_insights(admin: dict = Depends(verify_superadmin)) -> dict:
    """Distribución de lo que completan los negocios en el onboarding:
    qué rubros, qué buscan resolver, si necesitan facturar y su experiencia previa."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        async def distrib(col: str):
            rows = await conn.fetch(
                f"""SELECT COALESCE(NULLIF(TRIM({col}), ''), 'Sin completar') AS label,
                           COUNT(*) AS count
                    FROM businesses
                    GROUP BY label
                    ORDER BY count DESC, label ASC"""
            )
            return [{"label": r["label"], "count": r["count"]} for r in rows]

        return {
            "by_type": await distrib("business_type"),
            "by_objective": await distrib("objective"),
            "by_arca": await distrib("needs_arca"),
            "by_prior_pos": await distrib("prior_pos"),
        }


@router.get("/api/admin/at-risk", summary="Negocios que requieren atención")
async def admin_at_risk(admin: dict = Depends(verify_superadmin)) -> dict:
    """Devuelve negocios en riesgo: prueba/plan por vencer, o inactivos (sin ventas recientes)."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        # Vencen en los próximos 3 días
        expiring = await conn.fetch("""
            SELECT id, business_name, email, plan, plan_end_date,
                   EXTRACT(DAY FROM (plan_end_date - now()))::int as days_left
            FROM businesses
            WHERE status = 'active' AND plan_end_date IS NOT NULL
              AND plan_end_date BETWEEN now() AND now() + INTERVAL '3 days'
            ORDER BY plan_end_date ASC LIMIT 50
        """)
        # Activos sin ninguna venta en los últimos 14 días (pero con cuenta de >3 días)
        inactive = await conn.fetch("""
            SELECT b.id, b.business_name, b.email, b.plan,
                   (SELECT MAX(timestamp) FROM sales WHERE business_id = b.id) as last_sale
            FROM businesses b
            WHERE b.status = 'active' AND b.created_at < now() - INTERVAL '3 days'
              AND NOT EXISTS (
                  SELECT 1 FROM sales s WHERE s.business_id = b.id AND s.timestamp > now() - INTERVAL '14 days'
              )
            ORDER BY b.created_at DESC LIMIT 50
        """)
        return {
            "expiring": [dict(r) for r in expiring],
            "inactive": [dict(r) for r in inactive],
        }


# ────────────────────────────────────────────────────────────
# AUDIT LOG
# ────────────────────────────────────────────────────────────

@router.get("/api/admin/audit-log", summary="Log de auditoría admin")
async def admin_audit_log(
    business_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    admin: dict = Depends(verify_superadmin),
) -> list:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        params = []
        clauses = ["1=1"]
        n = 1
        
        if business_id:
            clauses.append(f"a.business_id = ${n}")
            params.append(business_id); n += 1
        if action:
            clauses.append(f"a.action = ${n}")
            params.append(action); n += 1
        
        clauses.append(f"a.timestamp >= ${n}")
        params.append(_now() - timedelta(days=days)); n += 1
        
        where = " AND ".join(clauses)
        rows = await conn.fetch(f"""
            SELECT a.*, s.email as superadmin_email, b.business_name
            FROM admin_audit_log a
            LEFT JOIN superadmins s ON a.superadmin_id = s.id
            LEFT JOIN businesses b ON a.business_id = b.id
            WHERE {where}
            ORDER BY a.timestamp DESC LIMIT 200
        """, *params)
        
        return [dict(r) for r in rows]


# ────────────────────────────────────────────────────────────
# BUSINESS DETAIL
# ────────────────────────────────────────────────────────────

@router.get("/api/admin/businesses/{business_id}", summary="Detalle de negocio")
async def admin_business_detail(
    business_id: str,
    admin: dict = Depends(verify_superadmin),
) -> dict:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        biz = await conn.fetchrow("""
            SELECT b.*,
                   (SELECT COUNT(*) FROM operators WHERE business_id = b.id) as operators_count,
                   (SELECT COUNT(*) FROM products WHERE business_id = b.id) as products_count,
                   (SELECT COUNT(*) FROM sales WHERE business_id = b.id) as sales_count,
                   (SELECT COALESCE(SUM(total), 0) FROM sales WHERE business_id = b.id) as total_revenue,
                   (SELECT MAX(timestamp) FROM sales WHERE business_id = b.id) as last_sale
            FROM businesses b WHERE b.id = $1
        """, business_id)
        
        if not biz:
            raise HTTPException(404, detail="Negocio no encontrado")
        
        return dict(biz)


# ────────────────────────────────────────────────────────────
# ANALYTICS ENDPOINTS
# ────────────────────────────────────────────────────────────


# ────────────────────────────────────────────────────────────
# PRODUCT MANAGEMENT (SuperAdmin carga productos a negocios)
# ────────────────────────────────────────────────────────────

@router.get("/api/admin/businesses/{business_id}/products", summary="Listar productos de un negocio")
async def admin_list_products(
    business_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    admin: dict = Depends(verify_superadmin),
) -> dict:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM products WHERE business_id = $1", business_id
        )
        offset = (page - 1) * limit
        rows = await conn.fetch(
            "SELECT id, code, name, price, cost_price, stock, min_stock, iva, category_id FROM products WHERE business_id = $1 ORDER BY name LIMIT $2 OFFSET $3",
            business_id, limit, offset
        )
        return {"total": total, "page": page, "limit": limit, "data": [dict(r) for r in rows]}


@router.post("/api/admin/businesses/{business_id}/products", summary="Cargar productos via CSV (admin)")
async def admin_import_products(
    business_id: str,
    body: dict = Body(...),
    admin: dict = Depends(verify_superadmin),
) -> dict:
    csv_text = body.get("csv_text", "")
    clear_existing = body.get("clear_existing", False)
    if not csv_text.strip():
        raise HTTPException(400, detail="CSV vacio")
    
    delimiter = ',' if ',' in csv_text.split('\n')[0] else ';'
    reader = csv.DictReader(io.StringIO(csv_text), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        raise HTTPException(400, detail="Archivo CSV vacio o invalido")
    
    pool = await _get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            if clear_existing:
                await conn.execute("DELETE FROM products WHERE business_id = $1", business_id)
            
            imported = 0
            errors = []
            for i, row in enumerate(rows):
                try:
                    code = (row.get('code') or row.get('codigo') or '').strip()
                    name = (row.get('name') or row.get('nombre') or row.get('producto') or '').strip()
                    if not code or not name:
                        errors.append(f"Fila {i+2}: falta code o nombre")
                        continue
                    price = float(row.get('price') or row.get('precio') or 0)
                    cost_price = float(row.get('cost_price') or row.get('costo') or 0)
                    stock = int(float(row.get('stock') or row.get('inventario') or 0))
                    min_stock = int(float(row.get('min_stock') or row.get('stock_minimo') or 5))
                    iva = str(row.get('iva') or '21%')
                    category_id = row.get('category_id') or row.get('categoria_id') or None
                    
                    await conn.execute(
                        """INSERT INTO products (business_id, code, name, price, cost_price, stock, min_stock, iva, category_id)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
                        business_id, code, name, price, cost_price, stock, min_stock, iva, category_id
                    )
                    imported += 1
                except Exception as e:
                    errors.append(f"Fila {i+2}: {str(e)}")
        
        logger.info(f"Admin {admin['email']} importo {imported} productos para {business_id}")
        return {"imported": imported, "errors": errors, "total_rows": len(rows), "cleared": clear_existing}


@router.delete("/api/admin/businesses/{business_id}/products", summary="Eliminar todos los productos de un negocio")
async def admin_clear_products(
    business_id: str,
    admin: dict = Depends(verify_superadmin),
) -> dict:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM products WHERE business_id = $1", business_id)
        async with conn.transaction():
            await conn.execute("DELETE FROM stock_movements WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM sale_items WHERE business_id = $1", business_id)
            await conn.execute("DELETE FROM promotion_conditions WHERE product_id IN (SELECT id FROM products WHERE business_id = $1)", business_id)
            await conn.execute("DELETE FROM products WHERE business_id = $1", business_id)
        logger.warning(f"Admin {admin['email']} elimino {count} productos de {business_id}")
        return {"success": True, "deleted_count": count}


@router.get("/api/admin/businesses/{business_id}/products/export", summary="Exportar productos a CSV")
async def admin_export_products(
    business_id: str,
    admin: dict = Depends(verify_superadmin),
):
    from fastapi.responses import StreamingResponse
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT code, name, price, cost_price, stock, min_stock, iva FROM products WHERE business_id = $1 ORDER BY name",
            business_id
        )
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["code", "name", "price", "cost_price", "stock", "min_stock", "iva"])
    for r in rows:
        writer.writerow([r["code"], r["name"], r["price"], r["cost_price"], r["stock"], r["min_stock"], r["iva"]])
    out.seek(0)
    fname = f"productos_{business_id[:8]}_{_now().date()}.csv"
    return StreamingResponse(
        iter(['﻿' + out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


# ────────────────────────────────────────────────────────────
# ANALYTICS ENDPOINTS
# ────────────────────────────────────────────────────────────

@router.get("/api/admin/analytics/revenue", summary="MRR trend por mes")
async def admin_revenue_trend(admin: dict = Depends(verify_superadmin)) -> list:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        plan_prices = {"simple": 20000, "pro": 30000, "ia": 40000}
        rows = await conn.fetch("""
            SELECT to_char(date_trunc('month', s.timestamp), 'YYYY-MM') as month,
                   COUNT(*) as total_sales
            FROM sales s
            WHERE s.timestamp >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY 1 ORDER BY 1
        """)
        biz_rows = await conn.fetch("""
            SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
                   COUNT(*) as new_businesses
            FROM businesses
            WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY 1 ORDER BY 1
        """)
        months = []
        sales_data = {}
        signup_data = {}
        for r in rows:
            sales_data[r["month"]] = r["total_sales"]
        for r in biz_rows:
            signup_data[r["month"]] = r["new_businesses"]
        
        all_months = sorted(set(list(sales_data.keys()) + list(signup_data.keys())))
        for m in all_months:
            months.append({
                "month": m,
                "sales": sales_data.get(m, 0),
                "signups": signup_data.get(m, 0),
            })
        return months


@router.get("/api/admin/analytics/signups", summary="Signups ultimos 30 dias")
async def admin_signups_trend(admin: dict = Depends(verify_superadmin)) -> list:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT to_char(d.d, 'YYYY-MM-DD') as day, COALESCE(b.cnt, 0) as count
            FROM generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, '1 day') d(d)
            LEFT JOIN (
                SELECT DATE(created_at) as dt, COUNT(*) as cnt
                FROM businesses WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY 1
            ) b ON b.dt = d.d::date
            ORDER BY d.d
        """)
        return [{"day": r["day"], "count": r["count"]} for r in rows]


@router.get("/api/admin/analytics/activity", summary="Actividad reciente")
async def admin_recent_activity(admin: dict = Depends(verify_superadmin)) -> list:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        sales = await conn.fetch("""
            SELECT 'sale' as type, s.id, s.timestamp, b.business_name, COALESCE(s.total, 0) as total
            FROM sales s JOIN businesses b ON s.business_id = b.id
            ORDER BY s.timestamp DESC LIMIT 30
        """)
        logins = await conn.fetch("""
            SELECT 'login' as type, a.id, a.timestamp, s.email as business_name, '' as detail
            FROM admin_audit_log a LEFT JOIN superadmins s ON a.superadmin_id = s.id
            WHERE a.action = 'plan_change'
            ORDER BY a.timestamp DESC LIMIT 20
        """)
        registered = await conn.fetch("""
            SELECT 'signup' as type, id, created_at as timestamp, email as business_name, plan as detail
            FROM businesses ORDER BY created_at DESC LIMIT 20
        """)
        
        events = []
        for r in sales:
            events.append({"type": "sale", "time": str(r["timestamp"]), "msg": f"{r['business_name']} vendio ${int(r['total'])}"})
        for r in logins:
            events.append({"type": "admin", "time": str(r["timestamp"]), "msg": f"Admin {r['business_name']} cambio plan"})
        for r in registered:
            events.append({"type": "signup", "time": str(r["timestamp"]), "msg": f"{r['business_name']} se registro (plan {r['detail']})"})
        
        events.sort(key=lambda e: e["time"], reverse=True)
        return events[:50]


# ────────────────────────────────────────────────────────────
# SEED DEFAULT SUPERADMIN
# ────────────────────────────────────────────────────────────

async def seed_superadmin():
    """Crea el superadmin inicial solo si se definen credenciales por env.

    Evita credenciales hardcodeadas: requiere SUPERADMIN_EMAIL y
    SUPERADMIN_PASSWORD en el entorno. Si no están, no crea nada
    (el superadmin se gestiona con create_admin.py).
    """
    try:
        seed_email = (os.environ.get("SUPERADMIN_EMAIL") or "").lower().strip()
        seed_pw = os.environ.get("SUPERADMIN_PASSWORD") or ""
        if not seed_email or not seed_pw:
            return
        if len(seed_pw) < 10:
            logger.warning("SUPERADMIN_PASSWORD demasiado corta (<10), no se crea el superadmin seed")
            return
        pool = await _get_pool()
        async with pool.acquire() as conn:
            exists = await conn.fetchval("SELECT COUNT(*) FROM superadmins WHERE email = $1", seed_email)
            if not exists:
                pw_hash = bcrypt.hashpw(seed_pw.encode(), bcrypt.gensalt()).decode()
                await conn.execute(
                    "INSERT INTO superadmins (email, password_hash, role) VALUES ($1, $2, 'superadmin')",
                    seed_email, pw_hash
                )
                logger.info(f"SuperAdmin seed creado: {seed_email}")
    except Exception as e:
        logger.warning(f"No se pudo crear superadmin seed: {e}")

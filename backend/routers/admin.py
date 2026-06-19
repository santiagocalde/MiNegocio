"""
SuperAdmin Panel — Gestión de negocios SaaS, planes, métricas y auditoría.
Todas las rutas requieren JWT con role='superadmin'.
"""
import os, bcrypt, logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Query, Depends, Request, Header
from typing import Optional
from jose import jwt
import main

router = APIRouter()
logger = logging.getLogger("NovaStock.Admin")

JWT_SECRET = os.environ.get("JWT_SECRET", "ta1P4pMAryFH5_lDGf-8GmbTSBrMWg5uYheoWg93s1o")
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
                   b.created_at, b.updated_at,
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
        old = await conn.fetchrow("SELECT plan, status FROM businesses WHERE id = $1", business_id)
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
    return {
        "success": True,
        "message": "Plan actualizado",
        "old_plan": old["plan"],
        "new_plan": new_plan,
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
        
        return {
            "total_businesses": total,
            "active_subscriptions": active,
            "suspended": suspended,
            "mrr": mrr,
            "churn_this_month": churn,
            "trial_conversions": round(converted / max(total_trial_ever, 1) * 100, 1),
            "breakdown_by_plan": breakdown,
            "top_features_used": [
                {"feature": "POS / Ventas", "count": sales_count},
                {"feature": "Proveedores", "count": suppliers_count},
                {"feature": "Promociones", "count": promotions_count},
            ],
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
        
        clauses.append(f"a.timestamp >= ${{{n}}}")
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
    """Crea el superadmin por defecto si no existe."""
    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            exists = await conn.fetchval("SELECT COUNT(*) FROM superadmins")
            if not exists:
                pw_hash = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
                await conn.execute(
                    "INSERT INTO superadmins (email, password_hash, role) VALUES ($1, $2, 'superadmin')",
                    "admin@minegocio.app", pw_hash
                )
                logger.info("SuperAdmin default creado: admin@minegocio.app / admin123")
    except Exception as e:
        logger.warning(f"No se pudo crear superadmin default: {e}")

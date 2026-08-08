"""
Dashboard administrativo — estadísticas clave para el operador admin.
Endpoint único que devuelve todo en una sola llamada para minimizar latencia.
"""

from fastapi import APIRouter, Request
from core.ratelimit import limiter

router = APIRouter()


def _biz_id():
    import main
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


@router.get("/api/dashboard/summary", summary="Resumen ejecutivo del negocio")
@limiter.limit("30/minute")
async def get_dashboard_summary(request: Request) -> dict:
    from main import USE_PG
    import main
    b_id = _biz_id()

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            # 1. Ventas del mes en curso
            ventas_row = await conn.fetchrow("""
                SELECT
                    COALESCE(SUM(total), 0)   AS ventas_mes,
                    COUNT(*)                  AS tickets_mes
                FROM sales
                WHERE business_id = $1
                  AND date_trunc('month', created_at) = date_trunc('month', NOW())
            """, b_id)

            # 2. Clientes con saldo pendiente más de 20 días
            deudores = await conn.fetch("""
                SELECT c.id, c.name, c.balance, c.phone,
                       MAX(ct.timestamp) AS ultimo_movimiento
                FROM customers c
                LEFT JOIN customer_transactions ct ON ct.customer_id = c.id AND ct.business_id = $1
                WHERE c.business_id = $1 AND c.balance > 0
                GROUP BY c.id, c.name, c.balance, c.phone
                HAVING MAX(ct.timestamp) < NOW() - INTERVAL '20 days'
                    OR MAX(ct.timestamp) IS NULL
                ORDER BY c.balance DESC
                LIMIT 10
            """, b_id)

            # 3. Proveedores con deuda sin actividad en 15+ días
            # PG purchases usa created_at (no timestamp)
            proveedores = await conn.fetch("""
                SELECT s.id, s.name, s.debt, s.phone,
                       MAX(p.created_at) AS ultima_compra
                FROM suppliers s
                LEFT JOIN purchases p ON p.supplier_id = s.id AND p.business_id = $1
                WHERE s.business_id = $1 AND s.debt > 0
                GROUP BY s.id, s.name, s.debt, s.phone
                HAVING MAX(p.created_at) < NOW() - INTERVAL '15 days'
                    OR MAX(p.created_at) IS NULL
                ORDER BY s.debt DESC
                LIMIT 8
            """, b_id)

            # 4. Productos más vendidos este mes
            top_products = await conn.fetch("""
                SELECT p.name, SUM(si.quantity) AS qty_vendida, SUM(si.quantity * si.unit_price) AS total_vendido
                FROM sale_items si
                JOIN products p ON p.id = si.product_id
                JOIN sales s ON s.id = si.sale_id
                WHERE s.business_id = $1
                  AND date_trunc('month', s.created_at) = date_trunc('month', NOW())
                GROUP BY p.id, p.name
                ORDER BY qty_vendida DESC
                LIMIT 6
            """, b_id)

            # 5. Productos bajos en stock
            low_stock = await conn.fetch("""
                SELECT name, stock, min_stock
                FROM products
                WHERE business_id = $1
                  AND active = TRUE
                  AND (stock <= min_stock OR stock = 0)
                ORDER BY stock ASC
                LIMIT 8
            """, b_id)

            return {
                "ventas_mes": float(ventas_row["ventas_mes"]),
                "tickets_mes": int(ventas_row["tickets_mes"]),
                "deudores_vencidos": [dict(r) for r in deudores],
                "proveedores_deuda": [dict(r) for r in proveedores],
                "top_products": [dict(r) for r in top_products],
                "low_stock": [dict(r) for r in low_stock],
            }

    else:
        import aiosqlite
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        mes_inicio = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        hace_20 = (now - timedelta(days=20)).isoformat()
        hace_15 = (now - timedelta(days=15)).isoformat()

        async with aiosqlite.connect(main.DB_PATH) as db:
            db.row_factory = aiosqlite.Row

            # 1. Ventas del mes
            cur = await db.execute("""
                SELECT COALESCE(SUM(total), 0) AS ventas_mes, COUNT(*) AS tickets_mes
                FROM sales
                WHERE datetime(created_at) >= datetime(?)
            """, (mes_inicio,))
            ventas_row = await cur.fetchone()

            # 2. Clientes con saldo y último movimiento > 20 días
            cur = await db.execute("""
                SELECT c.id, c.name, c.balance, c.phone,
                       MAX(ct.timestamp) AS ultimo_movimiento
                FROM customers c
                LEFT JOIN customer_transactions ct ON ct.customer_id = c.id
                WHERE c.balance > 0
                GROUP BY c.id, c.name, c.balance, c.phone
                HAVING MAX(ct.timestamp) < ? OR MAX(ct.timestamp) IS NULL
                ORDER BY c.balance DESC
                LIMIT 10
            """, (hace_20,))
            deudores = [dict(r) for r in await cur.fetchall()]

            # 3. Proveedores con deuda y última compra > 15 días
            cur = await db.execute("""
                SELECT s.id, s.name, s.debt, s.phone,
                       MAX(p.timestamp) AS ultima_compra
                FROM suppliers s
                LEFT JOIN purchases p ON p.supplier_id = s.id
                WHERE s.debt > 0
                GROUP BY s.id, s.name, s.debt, s.phone
                HAVING MAX(p.timestamp) < ? OR MAX(p.timestamp) IS NULL
                ORDER BY s.debt DESC
                LIMIT 8
            """, (hace_15,))
            proveedores = [dict(r) for r in await cur.fetchall()]

            # 4. Productos más vendidos este mes
            cur = await db.execute("""
                SELECT p.name,
                       SUM(si.quantity) AS qty_vendida,
                       SUM(si.quantity * si.unit_price) AS total_vendido
                FROM sale_items si
                JOIN products p ON p.id = si.product_id
                JOIN sales s ON s.id = si.sale_id
                WHERE datetime(s.created_at) >= datetime(?)
                GROUP BY p.id, p.name
                ORDER BY qty_vendida DESC
                LIMIT 6
            """, (mes_inicio,))
            top_products = [dict(r) for r in await cur.fetchall()]

            # 5. Bajos en stock
            cur = await db.execute("""
                SELECT name, stock, min_stock
                FROM products
                WHERE active = 1 AND (stock <= min_stock OR stock = 0)
                ORDER BY stock ASC
                LIMIT 8
            """)
            low_stock = [dict(r) for r in await cur.fetchall()]

            return {
                "ventas_mes": float(ventas_row["ventas_mes"] or 0),
                "tickets_mes": int(ventas_row["tickets_mes"] or 0),
                "deudores_vencidos": deudores,
                "proveedores_deuda": proveedores,
                "top_products": top_products,
                "low_stock": low_stock,
            }

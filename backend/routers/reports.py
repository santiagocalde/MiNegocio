from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import date, timedelta
import io
import main
from main import USE_PG, row_to_dict

router = APIRouter()

# Tope duro de filas por export — evita picos de memoria con historiales largos
_EXPORT_ROW_CAP = 50000
# Si no se especifica rango, exportar solo los ultimos N dias por defecto
_DEFAULT_EXPORT_DAYS = 90

try:
    from openpyxl import Workbook
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False


def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


@router.get("/api/reports/sales", summary="Exportar ventas a Excel")
async def export_sales_excel(desde: Optional[str] = None, hasta: Optional[str] = None, sucursal_id: Optional[int] = None):
    if not HAS_OPENPYXL:
        raise HTTPException(501, detail="openpyxl no instalado")

    b_id = _biz_id()

    def _to_date(s, default=None):
        if not s:
            return default
        try:
            return date.fromisoformat(str(s)[:10])
        except ValueError:
            return default

    # Sin rango explícito → últimos 90 días (evita exportar todo el historial)
    desde_d = _to_date(desde, date.today() - timedelta(days=_DEFAULT_EXPORT_DAYS))
    hasta_d = _to_date(hasta, None)
    desde = desde_d.isoformat()  # para el branch SQLite (comparación textual)

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            # Comparaciones sargables (usan idx_sales_business_timestamp); params como date()
            clauses = ["s.business_id = $1", "s.timestamp >= $2"]; params = [b_id, desde_d]; n = 3
            if hasta_d: clauses.append(f"s.timestamp < (${n}::date + interval '1 day')"); params.append(hasta_d); n += 1
            if sucursal_id: clauses.append(f"s.sucursal_id = ${n}"); params.append(sucursal_id); n += 1
            where = " AND ".join(clauses)
            rows = await conn.fetch(
                f"SELECT s.*, t.operator as turn_operator FROM sales s LEFT JOIN turns t ON s.turn_id = t.id WHERE {where} ORDER BY s.timestamp DESC LIMIT {_EXPORT_ROW_CAP}",
                *params
            )
            sales_data = [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            clauses = ["s.timestamp >= ?"]; params = [desde]
            if hasta: clauses.append("s.timestamp < date(?, '+1 day')"); params.append(hasta)
            where = " AND ".join(clauses)
            cur = await db.execute(
                f"SELECT s.*, t.operator as turn_operator FROM sales s LEFT JOIN turns t ON s.turn_id = t.id WHERE {where} ORDER BY s.timestamp DESC LIMIT {_EXPORT_ROW_CAP}",
                tuple(params)
            )
            sales_data = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

    wb = Workbook(); ws = wb.active; ws.title = "Ventas"
    ws.append(["ID", "Fecha", "Total", "Pago", "Vuelto", "Operador", "Metodo", "Fiado", "Cliente Fiado", "CUIT"])
    for s in sales_data:
        ws.append([s.get("id"), str(s.get("timestamp")), s.get("total"), s.get("payment"), s.get("change_given"),
                   s.get("operator"), s.get("payment_method"), "Si" if s.get("is_fiado") else "No",
                   s.get("fiado_name"), s.get("client_cuit")])
    output = io.BytesIO(); wb.save(output); output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=ventas.xlsx"})


@router.get("/api/reports/ganancias", summary="Ganancia mensual: ingresos - costo - gastos")
async def ganancias_report(desde: Optional[str] = None, hasta: Optional[str] = None):
    """Ganancia neta por mes: ingresos (ventas) - costo de mercaderia - gastos.

    - Ingresos: total de ventas del mes.
    - Costo: suma de unit_cost * quantity de sale_items (costo al momento de vender).
      Las ventas anteriores a que se guardara unit_cost usan el cost_price actual
      del producto como aproximacion.
    - Gastos: egresos_caja con type='gasto' (no cuentan retiros/sangrias del dueno).
    - Retiros: egresos_caja con type='retiro' (informativos, no afectan ganancia).
    - Ganancia neta: ingresos - costo - gastos.
    """
    b_id = _biz_id()

    def _to_date(s, default=None):
        if not s:
            return default
        try:
            return date.fromisoformat(str(s)[:10])
        except ValueError:
            return default

    desde_d = _to_date(desde)
    hasta_d = _to_date(hasta)

    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            params = [b_id]
            sale_clauses = ["s.business_id = $1", "s.reverted = 0"]
            egreso_clauses = ["e.business_id = $1"]
            n = 2
            if desde_d:
                sale_clauses.append(f"s.timestamp >= ${n}::date")
                egreso_clauses.append(f"e.timestamp >= ${n}::date")
                params.append(desde_d); n += 1
            if hasta_d:
                sale_clauses.append(f"s.timestamp < (${n}::date + interval '1 day')")
                egreso_clauses.append(f"e.timestamp < (${n}::date + interval '1 day')")
                params.append(hasta_d); n += 1
            sale_where = " AND ".join(sale_clauses)
            egreso_where = " AND ".join(egreso_clauses)

            rows = await conn.fetch(f"""
                SELECT mes, COALESCE(SUM(ingresos), 0) as ingresos, COALESCE(SUM(costo), 0) as costo
                FROM (
                    SELECT date_trunc('month', s.timestamp)::date as mes,
                           s.total as ingresos,
                           COALESCE(SUM(COALESCE(si.unit_cost, 0) * si.quantity), 0) as costo
                    FROM sales s
                    LEFT JOIN sale_items si ON si.sale_id = s.id
                    WHERE {sale_where}
                    GROUP BY s.id
                ) sq
                GROUP BY 1
            """, *params)

            egr = await conn.fetch(f"""
                SELECT date_trunc('month', e.timestamp)::date as mes,
                       COALESCE(SUM(CASE WHEN e.type = 'gasto' THEN e.monto ELSE 0 END), 0) as gastos,
                       COALESCE(SUM(CASE WHEN e.type = 'retiro' THEN e.monto ELSE 0 END), 0) as retiros
                FROM egresos_caja e
                WHERE {egreso_where}
                GROUP BY 1
            """, *params)

            # Backfill: ventas sin unit_cost (anteriores al cambio) → cost_price actual del producto
            backfill = await conn.fetch(f"""
                SELECT date_trunc('month', s.timestamp)::date as mes,
                       COALESCE(SUM(COALESCE(p.cost_price, 0) * si.quantity), 0) as costo_fallback
                FROM sales s
                JOIN sale_items si ON si.sale_id = s.id
                LEFT JOIN products p ON p.id = si.product_id
                WHERE {sale_where} AND (si.unit_cost IS NULL OR si.unit_cost = 0)
                GROUP BY 1
            """, *params)
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            clauses = ["reverted = 0"]
            params = []
            egr_clauses = []
            egr_params = []
            if desde_d:
                clauses.append("s.timestamp >= date(?, 'start of month')"); params.append(desde_d.isoformat())
                egr_clauses.append("e.timestamp >= date(?, 'start of month')"); egr_params.append(desde_d.isoformat())
            if hasta_d:
                clauses.append("s.timestamp < date(?, '+1 day')"); params.append(hasta_d.isoformat())
                egr_clauses.append("e.timestamp < date(?, '+1 day')"); egr_params.append(hasta_d.isoformat())
            sale_where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
            egr_where = (" WHERE " + " AND ".join(egr_clauses)) if egr_clauses else ""

            cur = await db.execute(f"""
                SELECT mes, COALESCE(SUM(ingresos), 0) as ingresos, COALESCE(SUM(costo), 0) as costo
                FROM (
                    SELECT strftime('%Y-%m', s.timestamp) as mes,
                           s.total as ingresos,
                           COALESCE(SUM(COALESCE(si.unit_cost, 0) * si.quantity), 0) as costo
                    FROM sales s
                    LEFT JOIN sale_items si ON si.sale_id = s.id
                    {sale_where}
                    GROUP BY s.id
                ) sq
                GROUP BY 1
            """, tuple(params))
            rows = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

            cur = await db.execute(f"""
                SELECT strftime('%Y-%m', e.timestamp) as mes,
                       COALESCE(SUM(CASE WHEN e.type = 'gasto' THEN e.monto ELSE 0 END), 0) as gastos,
                       COALESCE(SUM(CASE WHEN e.type = 'retiro' THEN e.monto ELSE 0 END), 0) as retiros
                FROM egresos_caja e
                {egr_where}
                GROUP BY 1
            """, tuple(egr_params))
            egr = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

            cur = await db.execute(f"""
                SELECT strftime('%Y-%m', s.timestamp) as mes,
                       COALESCE(SUM(COALESCE(p.cost_price, 0) * si.quantity), 0) as costo_fallback
                FROM sales s
                JOIN sale_items si ON si.sale_id = s.id
                LEFT JOIN products p ON p.id = si.product_id
                WHERE ({" AND ".join(clauses) if clauses else "1=1"})
                  AND (si.unit_cost IS NULL OR si.unit_cost = 0)
                GROUP BY 1
            """, tuple(params))
            backfill = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

    fallback_map = {r["mes"]: float(r["costo_fallback"] or 0) for r in backfill}

    meses = {}
    for r in rows:
        mes = r["mes"]
        meses[mes] = {
            "mes": mes, "ingresos": float(r["ingresos"] or 0),
            "costo": float(r["costo"] or 0),
            "gastos": 0.0, "retiros": 0.0,
        }
    for r in egr:
        mes = r["mes"]
        m = meses.setdefault(mes, {"mes": mes, "ingresos": 0.0, "costo": 0.0, "gastos": 0.0, "retiros": 0.0})
        m["gastos"] += float(r["gastos"] or 0)
        m["retiros"] += float(r["retiros"] or 0)

    result = []
    for mes in sorted(meses.keys(), reverse=True):
        m = meses[mes]
        # unit_cost guardado al vender (nuevo) + fallback cost_price actual para
        # las ventas que no guardaban costo (historial pre-cambio).
        costo = round(m["costo"] + (fallback_map.get(mes, 0) or 0), 2)
        bruto = round(m["ingresos"] - costo, 2)
        gastos = round(m["gastos"], 2)
        result.append({
            "mes": mes,
            "ingresos": round(m["ingresos"], 2),
            "costo": round(costo, 2),
            "bruto": bruto,
            "gastos": gastos,
            "retiros": round(m["retiros"], 2),
            "ganancia": round(bruto - gastos, 2),
        })

    return {
        "mensual": result,
        "totales": {
            "ingresos": round(sum(x["ingresos"] for x in result), 2),
            "costo": round(sum(x["costo"] for x in result), 2),
            "bruto": round(sum(x["bruto"] for x in result), 2),
            "gastos": round(sum(x["gastos"] for x in result), 2),
            "retiros": round(sum(x["retiros"] for x in result), 2),
            "ganancia": round(sum(x["ganancia"] for x in result), 2),
        },
    }


@router.get("/api/reports/estimada", summary="Ganancia estimada por margen configurable en un rango de fechas")
async def ganancia_estimada(desde: Optional[str] = None, hasta: Optional[str] = None):
    """Total facturado del rango x margen% configurado por el negocio (default 35).
    Pensado para el dueño: elegir semana/mes y ver cuánto le queda de margen."""
    b_id = _biz_id()

    def _to_date(s, default=None):
        if not s:
            return default
        try:
            return date.fromisoformat(str(s)[:10])
        except ValueError:
            return default

    desde_d = _to_date(desde)
    hasta_d = _to_date(hasta)

    margen_pct = 35.0
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            cfg = await conn.fetchval(
                "SELECT margen_estimado FROM business_config WHERE business_id = $1", b_id)
            try:
                m = float(cfg or 35)
                if 0 <= m <= 100:
                    margen_pct = m
            except (TypeError, ValueError):
                pass
            clauses = ["s.business_id = $1"]
            params = [b_id]
            n = 2
            if desde_d:
                clauses.append(f"s.timestamp >= ${n}::date"); params.append(desde_d); n += 1
            if hasta_d:
                clauses.append(f"s.timestamp < (${n}::date + interval '1 day')"); params.append(hasta_d); n += 1
            where = " AND ".join(clauses)
            row = await conn.fetchrow(
                f"SELECT COALESCE(SUM(total),0) as ventas, COUNT(*) as tickets FROM sales s "
                f"WHERE {where} AND s.reverted = 0", *params)
            ventas = float(row["ventas"] or 0)
            tickets = int(row["tickets"] or 0)
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT value FROM business_config WHERE key = 'margen_estimado'")
            r = await cur.fetchone()
            try:
                m = float(r[0]) if r and r[0] not in (None, '') else 35
                if 0 <= m <= 100:
                    margen_pct = m
            except (TypeError, ValueError):
                pass
            clauses = ["reverted = 0"]
            params = []
            if desde_d:
                clauses.append("date(timestamp) >= date(?)"); params.append(desde_d.isoformat())
            if hasta_d:
                clauses.append("date(timestamp) <= date(?)"); params.append(hasta_d.isoformat())
            cur = await db.execute(
                f"SELECT COALESCE(SUM(total),0), COUNT(*) FROM sales WHERE {' AND '.join(clauses)}",
                tuple(params))
            row = await cur.fetchone()
            ventas = float(row[0] or 0)
            tickets = int(row[1] or 0)

    ganancia = round(ventas * margen_pct / 100.0, 2)
    return {
        "ventas": round(ventas, 2),
        "tickets": tickets,
        "margen_pct": margen_pct,
        "ganancia_estimada": ganancia,
    }


@router.get("/api/reports/margins", summary="Margen de ganancia por producto")
async def margins_report():
    """Margen por producto activo, usando price y cost_price ya cargados.

    Solo lectura. Marca dos problemas de rentabilidad:
      - `sin_costo`: cost_price 0/NULL → no se puede saber si se gana.
      - `costo_mayor`: cost_price >= price → se vende a pérdida o sin margen.
    """
    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, code, name, price, cost_price, stock FROM products "
                "WHERE business_id = $1 AND is_active = 1 ORDER BY name",
                b_id
            )
            products = [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "SELECT id, code, name, price, cost_price, stock FROM products WHERE is_active = 1 ORDER BY name"
            )
            products = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

    items = []
    sin_costo = costo_mayor = 0
    for p in products:
        price = float(p.get("price") or 0)
        cost = float(p.get("cost_price") or 0)
        margen = round(price - cost, 2)
        margen_pct = round((margen / price) * 100, 1) if price > 0 else None
        flag = None
        if cost <= 0:
            flag = "sin_costo"; sin_costo += 1
        elif cost >= price:
            flag = "costo_mayor"; costo_mayor += 1
        items.append({
            "id": p.get("id"), "code": p.get("code"), "name": p.get("name"),
            "price": price, "cost_price": cost, "stock": p.get("stock"),
            "margen": margen, "margen_pct": margen_pct, "flag": flag,
        })
    # Peores márgenes primero (los None — sin precio — al final)
    items.sort(key=lambda x: (x["margen_pct"] is None, x["margen_pct"] if x["margen_pct"] is not None else 0))
    return {
        "items": items,
        "resumen": {"total": len(items), "sin_costo": sin_costo, "costo_mayor_o_igual": costo_mayor},
    }


@router.get("/api/reports/products", summary="Exportar productos a Excel")
async def export_products_excel():
    if not HAS_OPENPYXL:
        raise HTTPException(501, detail="openpyxl no instalado")

    b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM products WHERE business_id = $1 AND is_active = 1", b_id)
            products = [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM products WHERE is_active = 1")
            products = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

    wb = Workbook(); ws = wb.active; ws.title = "Productos"
    ws.append(["Codigo", "Nombre", "Precio", "Costo", "Stock", "Stock Min", "IVA", "Categoria"])
    for p in products:
        ws.append([p.get("code"), p.get("name"), p.get("price"), p.get("cost_price"), p.get("stock"),
                   p.get("min_stock"), p.get("iva"), p.get("category_id")])
    output = io.BytesIO(); wb.save(output); output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=productos.xlsx"})

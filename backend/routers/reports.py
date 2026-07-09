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

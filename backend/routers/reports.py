from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import io
import main
from main import USE_PG, row_to_dict

router = APIRouter()

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
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            clauses = ["s.business_id = $1"]; params = [b_id]; n = 2
            if desde: clauses.append(f"date(s.timestamp) >= ${n}"); params.append(desde); n += 1
            if hasta: clauses.append(f"date(s.timestamp) <= ${n}"); params.append(hasta); n += 1
            if sucursal_id: clauses.append(f"s.sucursal_id = ${n}"); params.append(sucursal_id); n += 1
            where = " AND ".join(clauses)
            rows = await conn.fetch(f"SELECT s.*, t.operator as turn_operator FROM sales s LEFT JOIN turns t ON s.turn_id = t.id WHERE {where} ORDER BY s.timestamp DESC", *params)
            sales_data = [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT s.*, t.operator as turn_operator FROM sales s LEFT JOIN turns t ON s.turn_id = t.id ORDER BY s.timestamp DESC")
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

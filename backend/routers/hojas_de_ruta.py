"""Hojas de Ruta — extiende remitos con zona y orden (Corralón V2)."""
from fastapi import APIRouter, HTTPException, Query, Body, Request
from typing import Optional
from core.ratelimit import limiter

router = APIRouter()

def _biz_id():
    import main
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None

@router.post("/api/remitos/reorder", summary="Reordenar remitos por zona")
@limiter.limit("30/minute")
async def reorder_remitos(request: Request, body: list = Body(...)) -> dict:
    """Recibe [{id, zone, sort_order}] y aplica en lote."""
    from main import USE_PG; import main; b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            for item in body:
                await conn.execute(
                    "UPDATE remitos SET zone = COALESCE($1, zone), sort_order = COALESCE($2, sort_order) WHERE id = $3 AND business_id = $4",
                    item.get("zone"), item.get("sort_order"), item["id"], b_id
                )
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            for item in body:
                await db.execute("UPDATE remitos SET zone = COALESCE(?, zone), sort_order = COALESCE(?, sort_order) WHERE id = ?", (item.get("zone"), item.get("sort_order"), item["id"]))
            await db.commit()
            return {"success": True}

@router.get("/api/hojas-de-ruta", summary="Hoja de ruta del día agrupada por zona")
@limiter.limit("30/minute")
async def hoja_de_ruta(request: Request, fecha: str = Query(None), driver: str = Query(None)) -> dict:
    from main import USE_PG, row_to_dict; import main; b_id = _biz_id()
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            w = ["r.business_id = $1"]; p = [b_id]; n = 2
            if fecha: w.append(f"r.scheduled_date::date = ${n}::date"); p.append(fecha); n += 1
            if driver: w.append(f"r.driver = ${n}"); p.append(driver); n += 1
            whe = " AND ".join(w)
            rows = await conn.fetch(f"SELECT r.*, c.name as customer_name FROM remitos r LEFT JOIN customers c ON c.id = r.customer_id WHERE {whe} ORDER BY COALESCE(r.zone, 'ZZZ'), COALESCE(r.sort_order, 999), r.id", *p)
            remitos_list = [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            clauses = []; params = []
            if fecha: clauses.append("date(r.scheduled_date) = ?"); params.append(fecha)
            if driver: clauses.append("r.driver = ?"); params.append(driver)
            w = (" AND ".join(clauses)) if clauses else "1=1"
            cur = await db.execute(f"SELECT r.*, c.name as customer_name FROM remitos r LEFT JOIN customers c ON c.id = r.customer_id WHERE {w} ORDER BY COALESCE(r.zone,'ZZZ'), COALESCE(r.sort_order, 999), r.id", tuple(params))
            remitos_list = [row_to_dict(r, cur.description) for r in await cur.fetchall()]

    # Agrupar por zona
    zones = {}
    for r in remitos_list:
        z = r.get("zone") or "Sin zona"
        if z not in zones: zones[z] = {"zone": z, "remitos": [], "stops": 0}
        zones[z]["remitos"].append(r)
        zones[z]["stops"] += 1

    return {
        "fecha": fecha, "driver": driver,
        "total_stops": len(remitos_list),
        "zones": list(zones.values()),
    }

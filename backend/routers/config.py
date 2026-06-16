from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional
import main
from main import USE_PG, row_to_dict

router = APIRouter()

def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


@router.get("/api/config", summary="Obtener configuracion del negocio")
async def get_config() -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = _biz_id()
            row = await conn.fetchrow("SELECT * FROM business_config WHERE business_id = $1", b_id)
            return dict(row) if row else {}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM business_config LIMIT 1")
            row = await cur.fetchone()
            return row_to_dict(row, cur.description) if row else {}


@router.put("/api/config", summary="Actualizar configuracion del negocio")
async def update_config(data: dict) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            b_id = _biz_id()
            async with conn.transaction():
                await conn.execute("DELETE FROM business_config WHERE business_id = $1", b_id)
                await conn.execute("""
                    INSERT INTO business_config (business_id, nombre, subtitulo, direccion, telefono, cuit, condicion_iva, numero_caja, mensaje_ticket, iva_rate, mp_access_token, mp_collector_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    ON CONFLICT (business_id) DO UPDATE SET
                        nombre=$2, subtitulo=$3, direccion=$4, telefono=$5, cuit=$6, condicion_iva=$7, numero_caja=$8, mensaje_ticket=$9, iva_rate=$10, mp_access_token=$11, mp_collector_id=$12
                """,
                    b_id, data.get("nombre"), data.get("subtitulo"), data.get("direccion"), data.get("telefono"),
                    data.get("cuit"), data.get("condicion_iva"), data.get("numero_caja"), data.get("mensaje_ticket"),
                    data.get("iva_rate"), data.get("mp_access_token"), data.get("mp_collector_id")
                )
        return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("DELETE FROM business_config")
            await db.execute(
                "INSERT INTO business_config (nombre, subtitulo, direccion, telefono, cuit, condicion_iva, numero_caja, mensaje_ticket, iva_rate, mp_access_token, mp_collector_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (data.get("nombre"), data.get("subtitulo"), data.get("direccion"), data.get("telefono"),
                 data.get("cuit"), data.get("condicion_iva"), data.get("numero_caja"), data.get("mensaje_ticket"),
                 data.get("iva_rate"), data.get("mp_access_token"), data.get("mp_collector_id"))
            )
            await db.commit()
        return {"success": True}


@router.get("/api/sucursales", summary="Listar sucursales")
async def list_sucursales() -> list:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM sucursales WHERE business_id = $1", _biz_id())
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM sucursales")
            rows = await cur.fetchall()
            return [row_to_dict(r, cur.description) for r in rows]


@router.post("/api/sucursales", summary="Crear sucursal")
async def create_sucursal(name: str = Query(...), address: str = Query(""), phone: str = Query("")) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("INSERT INTO sucursales (business_id, name) VALUES ($1,$2) RETURNING id", _biz_id(), name)
            return {"id": row["id"], "name": name}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("INSERT INTO sucursales (name) VALUES (?)", (name,))
            await db.commit()
            return {"id": cur.lastrowid, "name": name}


@router.patch("/api/sucursales/{sucursal_id}", summary="Actualizar sucursal")
async def update_sucursal(sucursal_id: int, name: str = Query(None), address: str = Query(None), phone: str = Query(None)) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute("UPDATE sucursales SET name = $1 WHERE id = $2 AND business_id = $3", name, sucursal_id, _biz_id())
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("UPDATE sucursales SET name = ? WHERE id = ?", (name, sucursal_id))
            await db.commit()
            return {"success": True}


@router.delete("/api/sucursales/{sucursal_id}", summary="Eliminar sucursal")
async def delete_sucursal(sucursal_id: int) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM sucursales WHERE id = $1 AND business_id = $2", sucursal_id, _biz_id())
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("DELETE FROM sucursales WHERE id = ?", (sucursal_id,))
            await db.commit()
            return {"success": True}

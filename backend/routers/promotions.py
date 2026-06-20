from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List
import main
from main import USE_PG, row_to_dict

router = APIRouter()

def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


@router.post("/api/promotions/evaluate", summary="Evaluar promociones activas para un carrito")
async def evaluate_promotions(body: dict) -> list:
    cart_items = body.get("items", [])
    if not cart_items:
        return []
    product_ids = [i.get("product_id") for i in cart_items if i.get("product_id")]
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            promos = await conn.fetch("SELECT * FROM promotions WHERE business_id = $1 AND is_active = 1", _biz_id())
            results = []
            for p in promos:
                promo = dict(p)
                conditions = await conn.fetch("SELECT * FROM promotion_conditions WHERE promotion_id = $1", promo["id"])
                promo["conditions"] = [dict(c) for c in conditions]
                savings = _calculate_savings(promo, cart_items)
                if savings > 0:
                    results.append({"id": promo["id"], "name": promo["name"], "savings": round(savings, 2)})
            return results
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute("SELECT * FROM promotions WHERE is_active = 1")
            promos = [row_to_dict(r, cur.description) for r in await cur.fetchall()]
            results = []
            for promo in promos:
                cur2 = await db.execute("SELECT * FROM promotion_conditions WHERE promotion_id = ?", (promo["id"],))
                promo["conditions"] = [row_to_dict(r, cur2.description) for r in await cur2.fetchall()]
                savings = _calculate_savings(promo, cart_items)
                if savings > 0:
                    results.append({"id": promo["id"], "name": promo["name"], "savings": round(savings, 2)})
            return results


def _item_price(i):
    return i.get("price", 0) or i.get("unit_price", 0)


def _calculate_savings(promo, cart_items):
    if promo["type"] == "combo" and promo.get("combo_price", 0) > 0:
        cond_product_ids = {c["product_id"] for c in promo.get("conditions", [])}
        affected = [i for i in cart_items if i.get("product_id") in cond_product_ids]
        if len(affected) >= len(cond_product_ids):
            original = sum(_item_price(i) * i.get("quantity", 1) for i in cart_items if i.get("product_id") in cond_product_ids)
            return max(0, original - promo["combo_price"])
    if promo["type"] == "discount" and promo.get("discount_percent", 0) > 0:
        cond_map = {c["product_id"]: (c.get("min_qty") or 1) for c in promo.get("conditions", [])}
        affected_total = 0
        for i in cart_items:
            pid = i.get("product_id")
            if pid in cond_map and i.get("quantity", 1) >= cond_map[pid]:
                affected_total += _item_price(i) * i.get("quantity", 1)
        return round(affected_total * promo["discount_percent"] / 100, 2)
    return 0


@router.get("/api/promotions", summary="Listar promociones activas")
async def list_promotions(activas: bool = Query(True)) -> list:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            where = "is_active = 1" if activas else "1=1"
            rows = await conn.fetch(f"SELECT * FROM promotions WHERE business_id = $1 AND {where} ORDER BY created_at DESC", _biz_id())
            return [dict(r) for r in rows]
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            where = "is_active = 1" if activas else "1=1"
            cur = await db.execute(f"SELECT * FROM promotions WHERE {where} ORDER BY created_at DESC")
            return [row_to_dict(r, cur.description) for r in await cur.fetchall()]


@router.get("/api/promotions/all", summary="Listar todas las promociones")
async def list_all_promotions_legacy() -> list:
    return await list_promotions(activas=False)


@router.post("/api/promotions", summary="Crear promocion")
async def create_promotion(body: dict) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    "INSERT INTO promotions (business_id, name, description, type, discount_percent, combo_price) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
                    _biz_id(), body.get("name"), body.get("description", ""), body.get("type", "combo"),
                    body.get("discount_percent", 0), body.get("combo_price", 0)
                )
                promo_id = row["id"]
                for cond in body.get("conditions", []):
                    await conn.execute(
                        "INSERT INTO promotion_conditions (business_id, promotion_id, product_id, min_qty) VALUES ($1,$2,$3,$4)",
                        _biz_id(), promo_id, cond.get("product_id"), cond.get("min_qty", 1)
                    )
                return {"id": promo_id, "success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "INSERT INTO promotions (name, description, type, discount_percent, combo_price) VALUES (?,?,?,?,?)",
                (body.get("name"), body.get("description", ""), body.get("type", "combo"),
                 body.get("discount_percent", 0), body.get("combo_price", 0))
            )
            promo_id = cur.lastrowid
            for cond in body.get("conditions", []):
                await db.execute("INSERT INTO promotion_conditions (promotion_id, product_id, min_qty) VALUES (?,?,?)",
                                 (promo_id, cond.get("product_id"), cond.get("min_qty", 1)))
            await db.commit()
            return {"id": promo_id, "success": True}


@router.put("/api/promotions/{promotion_id}", summary="Actualizar promocion")
async def update_promotion(promotion_id: int, body: dict) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            updates = []; params = []; n = 1
            for k in ("name", "description", "type", "discount_percent", "combo_price", "is_active"):
                if k in body:
                    updates.append(f"{k} = ${n}"); params.append(body[k]); n += 1
            if updates:
                params.append(promotion_id)
                await conn.execute(f"UPDATE promotions SET {', '.join(updates)} WHERE id = ${n}", *params)
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            updates = []; params = []
            for k in ("name", "description", "type", "discount_percent", "combo_price", "is_active"):
                if k in body:
                    updates.append(f"{k} = ?"); params.append(body[k])
            if updates:
                params.append(promotion_id)
                await db.execute(f"UPDATE promotions SET {', '.join(updates)} WHERE id = ?", tuple(params))
                await db.commit()
            return {"success": True}


@router.delete("/api/promotions/{promotion_id}", summary="Eliminar promocion")
async def delete_promotion(promotion_id: int) -> dict:
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM promotions WHERE id = $1", promotion_id)
            return {"success": True}
    else:
        import aiosqlite
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute("DELETE FROM promotions WHERE id = ?", (promotion_id,))
            await db.commit()
            return {"success": True}

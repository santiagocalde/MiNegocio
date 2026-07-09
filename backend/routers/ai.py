from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import aiosqlite
import main
from main import USE_PG, get_current_business
from services.ai_service import (
    procesar_factura_ocr,
    resumen_natural,
    asesor_precios,
    prediccion_reposicion,
    mensaje_cobranza,
    AINotConfigured,
)
from core.ratelimit import limiter

router = APIRouter(prefix="/api/ai", tags=["AI Integration"])


def _biz_id():
    return main.business_id_ctx.get() if hasattr(main, 'business_id_ctx') else None


async def _require_ia(request: Request) -> dict:
    """Valida token + plan IA. Devuelve el negocio. Lanza 401/402 si corresponde."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
    biz = await get_current_business(auth)
    if not biz:
        raise HTTPException(status_code=401, detail="Token invalido")
    plan = biz.get("plan", "trial")
    if plan != "ia":
        raise HTTPException(
            status_code=402,
            detail="Esta función con IA requiere el Plan IA. Tu plan actual es '{}'.".format(plan),
        )
    return biz


def _ai_error(e: Exception) -> HTTPException:
    """Traduce errores del servicio de IA a HTTPException con código apropiado."""
    if isinstance(e, AINotConfigured):
        return HTTPException(status_code=503, detail=str(e))
    if isinstance(e, HTTPException):
        return e
    return HTTPException(status_code=502, detail=f"No se pudo generar la respuesta de IA: {str(e)}")


@router.post("/scan-invoice", summary="Escanear Factura de Proveedor con IA (OCR)")
@limiter.limit("20/minute")
async def scan_invoice(request: Request, file: UploadFile = File(...)):
    await _require_ia(request)
    if file.content_type is None or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen valida.")
    try:
        content = await file.read()
        return await procesar_factura_ocr(content, file.content_type)
    except Exception as e:
        raise _ai_error(e)


# ---------------------------------------------------------------------------
# Recolección de datos (compatible PG y SQLite, scoped por negocio)
# ---------------------------------------------------------------------------

async def _gather_resumen(b_id) -> dict:
    """Métricas de hoy vs ayer + top productos + fiados + stock por agotarse."""
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            hoy = await conn.fetchrow("""
                SELECT COUNT(*) AS tickets, COALESCE(SUM(total),0) AS vendido,
                       COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) AS fiado
                FROM sales WHERE business_id=$1 AND timestamp >= current_date
                  AND timestamp < current_date + interval '1 day' AND COALESCE(reverted,0)=0
            """, b_id)
            ayer = await conn.fetchval("""
                SELECT COALESCE(SUM(total),0) FROM sales
                WHERE business_id=$1 AND timestamp >= current_date - interval '1 day'
                  AND timestamp < current_date AND COALESCE(reverted,0)=0
            """, b_id)
            top = await conn.fetch("""
                SELECT si.product_name AS name, SUM(si.quantity) AS qty
                FROM sale_items si JOIN sales s ON s.id = si.sale_id
                WHERE si.business_id=$1 AND s.timestamp >= current_date AND COALESCE(s.reverted,0)=0
                GROUP BY si.product_name ORDER BY qty DESC LIMIT 3
            """, b_id)
            fiados = await conn.fetchrow("""
                SELECT COUNT(*) AS n, COALESCE(SUM(balance),0) AS total
                FROM customers WHERE business_id=$1 AND balance > 0
            """, b_id)
            bajo = await conn.fetch("""
                SELECT name, stock FROM products
                WHERE business_id=$1 AND is_active=1 AND stock <= COALESCE(min_stock,5)
                ORDER BY stock ASC LIMIT 5
            """, b_id)
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            hoy = await (await db.execute("""
                SELECT COUNT(*) AS tickets, COALESCE(SUM(total),0) AS vendido,
                       COALESCE(SUM(CASE WHEN is_fiado=1 THEN total ELSE 0 END),0) AS fiado
                FROM sales WHERE date(timestamp)=date('now','localtime') AND COALESCE(reverted,0)=0
            """)).fetchone()
            ayer = (await (await db.execute("""
                SELECT COALESCE(SUM(total),0) FROM sales
                WHERE date(timestamp)=date('now','-1 day','localtime') AND COALESCE(reverted,0)=0
            """)).fetchone())[0]
            top = await (await db.execute("""
                SELECT si.product_name AS name, SUM(si.quantity) AS qty
                FROM sale_items si JOIN sales s ON s.id = si.sale_id
                WHERE date(s.timestamp)=date('now','localtime') AND COALESCE(s.reverted,0)=0
                GROUP BY si.product_name ORDER BY qty DESC LIMIT 3
            """)).fetchall()
            fiados = await (await db.execute(
                "SELECT COUNT(*) AS n, COALESCE(SUM(balance),0) AS total FROM customers WHERE balance > 0"
            )).fetchone()
            bajo = await (await db.execute("""
                SELECT name, stock FROM products
                WHERE is_active=1 AND stock <= COALESCE(min_stock,5) ORDER BY stock ASC LIMIT 5
            """)).fetchall()

    vendido = float(hoy["vendido"] or 0)
    ayer_v = float(ayer or 0)
    if ayer_v > 0:
        var = round((vendido - ayer_v) / ayer_v * 100)
        comparativa = f"{'+' if var >= 0 else ''}{var}% vs ayer (${ayer_v:,.0f})".replace(",", ".")
    else:
        comparativa = "ayer no hubo ventas registradas"
    d = {
        "Ventas de hoy": f"${vendido:,.0f}".replace(",", "."),
        "Cantidad de ventas": int(hoy["tickets"] or 0),
        "Comparativa": comparativa,
        "Fiado de hoy": f"${float(hoy['fiado'] or 0):,.0f}".replace(",", "."),
        "Más vendido hoy": ", ".join(f"{r['name']} ({int(r['qty'])})" for r in top) or "sin ventas aún",
        "Fiados por cobrar": f"{int(fiados['n'] or 0)} clientes deben ${float(fiados['total'] or 0):,.0f}".replace(",", "."),
        "Por agotarse": ", ".join(f"{r['name']} ({int(r['stock'])} u.)" for r in bajo) or "nada urgente",
    }
    return d


async def _gather_precios(b_id) -> list:
    """Productos con costo>0: margen actual + unidades vendidas en 30 días."""
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT p.id, p.name, p.price, p.cost_price,
                       ROUND(CAST((p.price - p.cost_price) / NULLIF(p.cost_price,0) * 100 AS numeric),1) AS margen,
                       COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id=si.sale_id
                                 WHERE si.product_id=p.id AND s.timestamp > now() - interval '30 day'
                                   AND COALESCE(s.reverted,0)=0),0) AS vendidos
                FROM products p
                WHERE p.business_id=$1 AND p.is_active=1 AND p.cost_price > 0
                ORDER BY vendidos DESC LIMIT 40
            """, b_id)
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            rows = await (await db.execute("""
                SELECT p.id, p.name, p.price, p.cost_price,
                       ROUND((p.price - p.cost_price) / NULLIF(p.cost_price,0) * 100, 1) AS margen,
                       COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id=si.sale_id
                                 WHERE si.product_id=p.id AND s.timestamp > datetime('now','-30 day')
                                   AND COALESCE(s.reverted,0)=0),0) AS vendidos
                FROM products p
                WHERE p.is_active=1 AND p.cost_price > 0
                ORDER BY vendidos DESC LIMIT 40
            """)).fetchall()
    return [{
        "id": r["id"],
        "name": r["name"],
        "price": round(float(r["price"] or 0)),
        "cost": round(float(r["cost_price"] or 0)),
        "margen_pct": float(r["margen"] or 0),
        "vendidos": round(float(r["vendidos"] or 0), 1),
    } for r in rows]


def _compute_price_recs(productos: list) -> list:
    """Calcula recomendaciones de precio CONCRETAS (antes→después), sin IA.

    Para que NO sean recomendaciones locas:
    - Apunta a ~30% de margen, pero SUBE como mucho +20% por vez (un ajuste
      digerible para el cliente; si hace falta más, se reajusta otro día).
    - Excepción: si se vende POR DEBAJO del costo, sí o sí hay que llegar al
      menos a cubrir el costo — eso no es negociable, estás perdiendo plata.
    - Redondea a $50. Solo sugiere SUBIR.
    """
    import math
    TARGET = 0.30          # margen objetivo (ideal)
    MAX_SUBA = 0.20        # tope de aumento por sugerencia (+20%)
    recs = []
    for p in productos:
        cost = float(p["cost"] or 0)
        price = float(p["price"] or 0)
        if cost <= 0 or price <= 0:
            continue
        margen = (price - cost) / cost * 100
        vendidos = float(p["vendidos"] or 0)

        objetivo = round((cost * (1 + TARGET)) / 50) * 50      # precio ideal (30% margen)
        tope     = round((price * (1 + MAX_SUBA)) / 50) * 50   # +20% redondeado a $50
        piso     = math.ceil(cost / 50) * 50                   # break-even (cubrir el costo)
        # Sugerido: el ideal pero acotado al tope de +20%; nunca por debajo del costo.
        sugerido = min(objetivo, max(tope, piso))

        if sugerido <= price:
            continue  # ya está bien → no tocar
        delta_pct = round((sugerido - price) / price * 100)
        if delta_pct < 3:
            continue  # ajuste insignificante, no vale la pena molestar

        if margen < 0:
            prioridad, motivo = "urgente", "Estabas vendiendo a pérdida"
        elif margen < 15:
            prioridad, motivo = "alta", "Margen muy bajo" + (", y rota bien" if vendidos >= 5 else "")
        else:
            prioridad, motivo = "media", "Margen flojo" + (", igual rota" if vendidos >= 5 else "")
        # Si quedó topeado (no llegó al ideal), avisamos que es un ajuste gradual.
        if sugerido < objetivo:
            motivo += " · ajuste suave, revisalo de nuevo en unos días"

        recs.append({
            "product_id": p["id"],
            "name": p["name"],
            "price_actual": round(price),
            "price_sugerido": int(sugerido),
            "delta_pct": delta_pct,
            "margen_actual": round(margen),
            "margen_nuevo": round((sugerido - cost) / cost * 100),
            "vendidos": round(vendidos, 1),
            "prioridad": prioridad,
            "motivo": motivo,
        })
    orden = {"urgente": 0, "alta": 1, "media": 2}
    recs.sort(key=lambda r: (orden[r["prioridad"]], -r["vendidos"]))
    return recs[:8]


async def _gather_reposicion(b_id) -> list:
    """Productos con stock>0 y venta diaria promedio (14 días) → días de stock restantes."""
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT p.name, p.stock,
                       COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id=si.sale_id
                                 WHERE si.product_id=p.id AND s.timestamp > now() - interval '14 day'
                                   AND COALESCE(s.reverted,0)=0),0) AS vendidos_14
                FROM products p
                WHERE p.business_id=$1 AND p.is_active=1 AND p.stock > 0
            """, b_id)
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            rows = await (await db.execute("""
                SELECT p.name, p.stock,
                       COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id=si.sale_id
                                 WHERE si.product_id=p.id AND s.timestamp > datetime('now','-14 day')
                                   AND COALESCE(s.reverted,0)=0),0) AS vendidos_14
                FROM products p
                WHERE p.is_active=1 AND p.stock > 0
            """)).fetchall()
    out = []
    for r in rows:
        vendidos = float(r["vendidos_14"] or 0)
        if vendidos <= 0:
            continue  # sin rotación: no es reposición urgente
        por_dia = round(vendidos / 14, 1)
        stock = float(r["stock"] or 0)
        dias = round(stock / por_dia, 1) if por_dia > 0 else 999
        out.append({"name": r["name"], "stock": round(stock, 1), "por_dia": por_dia, "dias": dias})
    # Más urgente primero (menos días de stock); solo lo que alcanza para <= 10 días
    out = [x for x in out if x["dias"] <= 10]
    out.sort(key=lambda x: x["dias"])
    return out


async def _gather_cliente(b_id, customer_id: int) -> dict:
    """Datos de un cliente deudor + sus últimos productos fiados."""
    if USE_PG:
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            c = await conn.fetchrow(
                "SELECT name, phone, balance FROM customers WHERE id=$1 AND business_id=$2",
                customer_id, b_id)
            items = await conn.fetch("""
                SELECT description FROM customer_transactions
                WHERE customer_id=$1 AND business_id=$2 AND type='sale'
                ORDER BY timestamp DESC LIMIT 3
            """, customer_id, b_id)
    else:
        async with aiosqlite.connect(main.DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            c = await (await db.execute(
                "SELECT name, phone, balance FROM customers WHERE id=?", (customer_id,))).fetchone()
            items = await (await db.execute("""
                SELECT description FROM customer_transactions
                WHERE customer_id=? AND type='sale' ORDER BY timestamp DESC LIMIT 3
            """, (customer_id,))).fetchall()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    detalle = "; ".join(i["description"] for i in items if i["description"])
    return {
        "name": c["name"],
        "phone": c["phone"],
        "balance": f"{float(c['balance'] or 0):,.0f}".replace(",", "."),
        "detalle": detalle,
    }


# ---------------------------------------------------------------------------
# Endpoints IA (todos gateados a Plan IA)
# ---------------------------------------------------------------------------

@router.get("/resumen", summary="Resumen del día en lenguaje natural")
@limiter.limit("30/minute")
async def resumen_endpoint(request: Request):
    await _require_ia(request)
    try:
        bid = _biz_id()
        datos = await _gather_resumen(bid)
        texto = await resumen_natural(datos, biz_id=bid)
        return {"texto": texto, "datos": datos, "cached": False}
    except Exception as e:
        raise _ai_error(e)


@router.get("/precios", summary="Asesor de precios con IA")
@limiter.limit("30/minute")
async def precios_endpoint(request: Request):
    await _require_ia(request)
    try:
        bid = _biz_id()
        productos = await _gather_precios(bid)
        recs = _compute_price_recs(productos)
        texto = await asesor_precios(recs, biz_id=bid)
        return {"texto": texto, "sugerencias": recs, "analizados": len(productos)}
    except Exception as e:
        raise _ai_error(e)


@router.get("/reposicion", summary="Predicción de reposición con IA")
@limiter.limit("30/minute")
async def reposicion_endpoint(request: Request):
    await _require_ia(request)
    try:
        bid = _biz_id()
        productos = await _gather_reposicion(bid)
        texto = await prediccion_reposicion(productos, biz_id=bid)
        return {"texto": texto, "urgentes": len(productos)}
    except Exception as e:
        raise _ai_error(e)


@router.get("/cobranza/{customer_id}", summary="Mensaje de cobranza de fiado con IA")
@limiter.limit("30/minute")
async def cobranza_endpoint(customer_id: int, request: Request):
    await _require_ia(request)
    try:
        bid = _biz_id()
        cliente = await _gather_cliente(bid, customer_id)
        texto = await mensaje_cobranza(cliente, biz_id=bid)
        return {"texto": texto, "telefono": cliente.get("phone"), "nombre": cliente.get("name")}
    except Exception as e:
        raise _ai_error(e)

"""
Servicios de IA para MiNegocio.

- procesar_factura_ocr: lee imagen de factura con visión (Kimi K2.7)
- resumen_natural / asesor_precios / prediccion_reposicion / mensaje_cobranza:
  generan texto en criollo a partir de datos estructurados del kiosco.

Caché + logging automático
──────────────────────────
Cada llamada de texto (no visión) pasa por ai_cached_texto():
  1. Calcula un hash del prompt normalizado.
  2. Si existe un registro reciente en ai_logs (TTL por función), devuelve
     el output cacheado sin gastar tokens.
  3. Si no hay caché, llama al modelo, guarda el resultado en ai_logs y devuelve.

TTL por función:
  resumen   → 1 día  (los datos del día no cambian a lo largo del día)
  precios   → 6 h    (los costos/márgenes cambian lento)
  reposicion→ 4 h
  cobranza  → 0 h    (cada mensaje es único, nunca se cachea)

A futuro: los registros en ai_logs son el dataset de fine-tuning.
Con ~1.000 registros por función alcanza para afinar un modelo pequeño
que entienda economía de kiosco sin gastar tokens externos.
"""
import os
import json
import base64
import hashlib
import logging
import asyncio
import httpx

logger = logging.getLogger("NovaStock.AI")

AI_API_KEY  = (os.environ.get("AI_INVOICE_API_KEY")   or "").strip()
AI_BASE_URL = (os.environ.get("AI_INVOICE_BASE_URL")   or "https://openrouter.ai/api/v1").rstrip("/")
AI_MODEL    = (os.environ.get("AI_INVOICE_MODEL")      or "openai/gpt-4o-mini").strip()

_PROMPT = (
    "Sos un asistente que lee facturas y remitos de proveedores de un kiosco en Argentina. "
    "Mirá la imagen y devolvé SOLO un JSON válido (sin texto extra ni markdown) con esta forma exacta:\n"
    '{"proveedor": "", "fecha": "YYYY-MM-DD", "factura_nro": "", '
    '"items": [{"name": "", "qty": 0, "cost": 0}]}\n'
    "Reglas: 'cost' es el costo UNITARIO (precio por unidad, NO el subtotal de la línea). "
    "'qty' es la cantidad. Si un dato no aparece, usá \"\" o 0. "
    "Incluí solo productos que realmente veas en la factura. "
    "Los números van sin símbolo de moneda ni separador de miles (usá punto para decimales)."
)

_SYS = ("Sos el asistente de un kiosco/almacén argentino. Hablás claro, en criollo, directo y "
        "breve, tuteando al dueño. Te basás SOLO en los datos que te paso, nunca inventes números.")

# TTL en horas por función (0 = sin caché)
_CACHE_TTL = {"resumen": 24, "precios": 6, "reposicion": 4, "cobranza": 0}


class AINotConfigured(Exception):
    pass


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

async def _post_chat(messages: list, timeout: float = 60) -> str:
    if not AI_API_KEY:
        raise AINotConfigured(
            "La IA no está configurada en el servidor. Definí AI_INVOICE_API_KEY."
        )
    payload = {"model": AI_MODEL, "messages": messages}
    headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(f"{AI_BASE_URL}/chat/completions", json=payload, headers=headers)
    except httpx.RequestError as e:
        logger.error(f"IA: no se pudo conectar: {e}")
        raise RuntimeError("No se pudo conectar con el servicio de IA.")
    if resp.status_code != 200:
        logger.error(f"IA error {resp.status_code}: {resp.text[:300]}")
        raise RuntimeError(f"El servicio de IA respondió {resp.status_code}.")
    try:
        return resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError):
        raise RuntimeError("Respuesta inesperada del servicio de IA.")


# ---------------------------------------------------------------------------
# Caché + logging
# ---------------------------------------------------------------------------

def _hash_prompt(user_prompt: str) -> str:
    return hashlib.sha256(user_prompt.encode()).hexdigest()[:16]


async def _check_cache(biz_id: str, fn: str, h: str, ttl_h: int) -> str | None:
    """Devuelve el output cacheado si existe y está dentro del TTL, o None."""
    if ttl_h <= 0 or not biz_id:
        return None
    try:
        from db import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT output_text FROM ai_logs
                   WHERE business_id=$1 AND function_name=$2 AND input_hash=$3
                     AND created_at > now() - make_interval(hours => $4)
                   ORDER BY created_at DESC LIMIT 1""",
                biz_id, fn, h, ttl_h
            )
        if row:
            logger.info(f"AI cache HIT: {fn} biz={biz_id[:8]}")
            return row["output_text"]
    except Exception as e:
        logger.debug(f"AI cache check failed (ignorado): {e}")
    return None


def _log_async(biz_id: str, fn: str, h: str, input_data: dict, output: str):
    """Guarda el log en background, nunca bloquea ni propaga errores."""
    async def _save():
        try:
            from db import get_pool
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO ai_logs
                       (business_id, function_name, input_hash, input_data, output_text, model,
                        tokens_in, tokens_out)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
                    biz_id or "", fn, h,
                    json.dumps(input_data, ensure_ascii=False),
                    output, AI_MODEL,
                    round(len(json.dumps(input_data)) / 4),
                    round(len(output) / 4),
                )
        except Exception as e:
            logger.debug(f"AI log save failed (ignorado): {e}")
    asyncio.create_task(_save())


async def _texto(user_prompt: str, fn: str = "", biz_id: str = "",
                 input_data: dict | None = None) -> str:
    """Texto con caché transparente. fn y biz_id habilitan caché + logging."""
    h = _hash_prompt(user_prompt)
    ttl = _CACHE_TTL.get(fn, 0)

    cached = await _check_cache(biz_id, fn, h, ttl)
    if cached:
        return cached

    out = await _post_chat([{"role": "system", "content": _SYS},
                             {"role": "user",   "content": user_prompt}])
    result = (out or "").strip()

    if fn and biz_id:
        _log_async(biz_id, fn, h, input_data or {}, result)

    return result


# ---------------------------------------------------------------------------
# Funciones de texto
# ---------------------------------------------------------------------------

async def resumen_natural(d: dict, biz_id: str = "") -> str:
    lineas = "\n".join(f"- {k}: {v}" for k, v in d.items() if v not in (None, "", []))
    user = (
        "Estos son los datos de HOY del kiosco:\n" + lineas +
        "\n\nEscribí un resumen de 2 a 4 frases para el dueño. Mencioná cuánto vendió, si subió o "
        "bajó respecto de ayer (con el % si lo tenés), qué fue lo más vendido, los fiados por cobrar "
        "y, si la hay, una alerta de algún producto por agotarse. Tono positivo y útil, en criollo. "
        "Texto corrido, sin viñetas ni títulos. Los montos en pesos argentinos con punto de miles."
    )
    return await _texto(user, "resumen", biz_id, d)


async def asesor_precios(productos: list, biz_id: str = "") -> str:
    if not productos:
        return "Todavía no tengo costos y ventas suficientes para sugerirte precios."
    detalle = "\n".join(
        f"- {p['name']}: precio ${p['price']}, costo ${p['cost']}, margen {p['margen_pct']}%, "
        f"vendidos en 30 días: {p['vendidos']}" for p in productos[:40]
    )
    user = (
        "Tenés esta lista de productos con su margen y rotación:\n" + detalle +
        "\n\nDame entre 3 y 6 sugerencias concretas y cortas. Reglas:\n"
        "- Si rota bien pero tiene margen flaco, sugerí subirlo un % razonable.\n"
        "- Si está casi a pérdida o con margen muy bajo, avisá fuerte.\n"
        "- Priorizá lo que más impacta (lo que más rota). No listes todo, solo lo importante.\n"
        "Una sugerencia por línea, cada una empezando con '• '."
    )
    return await _texto(user, "precios", biz_id, {"n": len(productos)})


async def prediccion_reposicion(productos: list, biz_id: str = "") -> str:
    if not productos:
        return "Todavía no tengo suficiente historial de ventas para anticipar la reposición."
    detalle = "\n".join(
        f"- {p['name']}: quedan {p['stock']} u., vende {p['por_dia']}/día, alcanza ~{p['dias']} días"
        for p in productos[:40]
    )
    user = (
        "Productos con stock actual y venta diaria promedio (últimas 2 semanas):\n" + detalle +
        "\n\nDecime qué conviene reponer YA y sugerí una cantidad para aguantar ~2 semanas. "
        "Priorizá lo más urgente primero. "
        "Una línea por producto, cada una empezando con '• '. Frases cortas."
    )
    return await _texto(user, "reposicion", biz_id, {"nombres": [p["name"] for p in productos[:5]]})


async def mensaje_cobranza(cliente: dict, biz_id: str = "") -> str:
    detalle = f" Lo último que se llevó: {cliente['detalle']}." if cliente.get("detalle") else ""
    user = (
        "Escribí UN mensaje corto de WhatsApp para recordarle amablemente a un cliente del kiosco "
        f"que tiene una cuenta pendiente. Cliente: {cliente.get('name')}. Debe: "
        f"${cliente.get('balance')}.{detalle} "
        "Tono cordial, de barrio, nada agresivo. Tuteá al cliente. Devolvé SOLO el texto del "
        "mensaje, listo para mandar, sin comillas ni explicaciones."
    )
    return await _texto(user, "cobranza", biz_id, {"cliente": cliente.get("name")})


# ---------------------------------------------------------------------------
# OCR de facturas (visión, sin caché — cada imagen es única)
# ---------------------------------------------------------------------------

async def procesar_factura_ocr(image_bytes: bytes, content_type: str = "image/jpeg") -> dict:
    data_url = f"data:{content_type or 'image/jpeg'};base64,{base64.b64encode(image_bytes).decode()}"
    content = await _post_chat([{
        "role": "user",
        "content": [
            {"type": "text",      "text": _PROMPT},
            {"type": "image_url", "image_url": {"url": data_url}},
        ],
    }])
    parsed = _extract_json(content)
    items = []
    for it in parsed.get("items", []):
        try:
            name = str(it.get("name") or it.get("nombre") or "").strip()
            qty  = float(it.get("qty")  or it.get("cantidad") or 0)
            cost = float(it.get("cost") or it.get("costo")    or 0)
            if name:
                items.append({"name": name, "qty": qty, "cost": cost})
        except (TypeError, ValueError):
            continue
    return {
        "proveedor":      str(parsed.get("proveedor") or "").strip(),
        "fecha":          str(parsed.get("fecha")     or "").strip(),
        "factura_nro":    str(parsed.get("factura_nro") or parsed.get("factura") or "").strip(),
        "items_detectados": items,
        "total_detectado":  round(sum(i["qty"] * i["cost"] for i in items), 2),
    }


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) >= 2 else text
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        text = text[start:end + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise RuntimeError("La IA no devolvió un JSON válido. Probá con una foto más nítida y derecha.")

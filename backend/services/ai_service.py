"""
Lectura real de facturas/remitos de proveedores con IA (visión).

Agnóstico de proveedor: usa cualquier endpoint compatible con la API de OpenAI
(OpenRouter, OpenAI, DeepSeek, Together, etc.). Se configura por entorno:
  - AI_INVOICE_API_KEY   (obligatoria para activar la función)
  - AI_INVOICE_BASE_URL  (default: https://openrouter.ai/api/v1)
  - AI_INVOICE_MODEL     (default: openai/gpt-4o-mini)

IMPORTANTE: el modelo DEBE soportar imágenes (visión). Los modelos de solo texto
(p. ej. DeepSeek-V3/R1) no pueden leer la foto de una factura.
"""
import os
import json
import base64
import logging
import httpx

logger = logging.getLogger("NovaStock.AI")

# Se usa `or default` (no el default de .get) para que una variable definida pero
# vacía —como la deja docker-compose— igual caiga en el valor por defecto.
AI_API_KEY = (os.environ.get("AI_INVOICE_API_KEY") or "").strip()
AI_BASE_URL = (os.environ.get("AI_INVOICE_BASE_URL") or "https://openrouter.ai/api/v1").rstrip("/")
AI_MODEL = (os.environ.get("AI_INVOICE_MODEL") or "openai/gpt-4o-mini").strip()

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


class AINotConfigured(Exception):
    """Se lanza cuando falta la API key de IA (la función está apagada)."""


async def _post_chat(messages: list, timeout: float = 60) -> str:
    """Llama a /chat/completions (texto o visión) y devuelve el contenido del modelo."""
    if not AI_API_KEY:
        raise AINotConfigured(
            "La IA no está configurada en el servidor. Definí AI_INVOICE_API_KEY "
            "(y opcionalmente AI_INVOICE_BASE_URL y AI_INVOICE_MODEL)."
        )
    # Sin 'temperature': algunos modelos (Kimi/Moonshot) solo aceptan el default.
    payload = {"model": AI_MODEL, "messages": messages}
    headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(f"{AI_BASE_URL}/chat/completions", json=payload, headers=headers)
    except httpx.RequestError as e:
        logger.error(f"IA: no se pudo conectar al proveedor: {e}")
        raise RuntimeError("No se pudo conectar con el servicio de IA.")
    if resp.status_code != 200:
        logger.error(f"IA error {resp.status_code}: {resp.text[:300]}")
        raise RuntimeError(f"El servicio de IA respondió {resp.status_code}.")
    try:
        return resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError):
        raise RuntimeError("Respuesta inesperada del servicio de IA.")


_SYS = ("Sos el asistente de un kiosco/almacén argentino. Hablás claro, en criollo, directo y "
        "breve, tuteando al dueño. Te basás SOLO en los datos que te paso, nunca inventes números.")


async def _texto(user: str) -> str:
    """Pregunta de texto con el system del kiosco → respuesta de texto, lista para mostrar."""
    out = await _post_chat([{"role": "system", "content": _SYS}, {"role": "user", "content": user}])
    return (out or "").strip()


async def procesar_factura_ocr(image_bytes: bytes, content_type: str = "image/jpeg") -> dict:
    """Lee una imagen de factura y devuelve proveedor + items detectados (costo unitario)."""
    data_url = f"data:{content_type or 'image/jpeg'};base64,{base64.b64encode(image_bytes).decode()}"
    content = await _post_chat([{
        "role": "user",
        "content": [
            {"type": "text", "text": _PROMPT},
            {"type": "image_url", "image_url": {"url": data_url}},
        ],
    }])
    parsed = _extract_json(content)
    items = []
    for it in parsed.get("items", []):
        try:
            name = str(it.get("name") or it.get("nombre") or "").strip()
            qty = float(it.get("qty") or it.get("cantidad") or 0)
            cost = float(it.get("cost") or it.get("costo") or 0)
            if name:
                items.append({"name": name, "qty": qty, "cost": cost})
        except (TypeError, ValueError):
            continue

    return {
        "proveedor": str(parsed.get("proveedor") or "").strip(),
        "fecha": str(parsed.get("fecha") or "").strip(),
        "factura_nro": str(parsed.get("factura_nro") or parsed.get("factura") or "").strip(),
        "items_detectados": items,
        "total_detectado": round(sum(i["qty"] * i["cost"] for i in items), 2),
    }


async def resumen_natural(d: dict) -> str:
    """Convierte las métricas del día en un resumen corto y claro para el dueño."""
    lineas = "\n".join(f"- {k}: {v}" for k, v in d.items() if v not in (None, "", []))
    user = (
        "Estos son los datos de HOY del kiosco:\n" + lineas +
        "\n\nEscribí un resumen de 2 a 4 frases para el dueño. Mencioná cuánto vendió, si subió o "
        "bajó respecto de ayer (con el % si lo tenés), qué fue lo más vendido, los fiados por cobrar "
        "y, si la hay, una alerta de algún producto por agotarse. Tono positivo y útil, en criollo. "
        "Texto corrido, sin viñetas ni títulos. Los montos en pesos argentinos con punto de miles."
    )
    return await _texto(user)


async def asesor_precios(productos: list) -> str:
    """productos: [{name, price, cost, margen_pct, vendidos}] → sugerencias concretas de precio."""
    if not productos:
        return "Todavía no tengo costos y ventas suficientes para sugerirte precios."
    detalle = "\n".join(
        f"- {p['name']}: precio ${p['price']}, costo ${p['cost']}, margen {p['margen_pct']}%, "
        f"vendidos en 30 días: {p['vendidos']}"
        for p in productos[:40]
    )
    user = (
        "Tenés esta lista de productos con su margen y rotación:\n" + detalle +
        "\n\nDame entre 3 y 6 sugerencias concretas y cortas. Reglas:\n"
        "- Si rota bien pero tiene margen flaco, sugerí subirlo un % razonable "
        "(ej: 'Subí la yerba ~8%, igual rota').\n"
        "- Si está casi a pérdida o con margen muy bajo, avisá fuerte "
        "(ej: 'El alfajor X lo vendés casi a pérdida, revisalo').\n"
        "- Priorizá lo que más impacta (lo que más rota). No listes todo, solo lo importante.\n"
        "Una sugerencia por línea, cada una empezando con '• '."
    )
    return await _texto(user)


async def prediccion_reposicion(productos: list) -> str:
    """productos: [{name, stock, por_dia, dias}] → qué reponer y cuánto pedir."""
    if not productos:
        return "Todavía no tengo suficiente historial de ventas para anticipar la reposición."
    detalle = "\n".join(
        f"- {p['name']}: quedan {p['stock']} u., vende {p['por_dia']}/día, alcanza ~{p['dias']} días"
        for p in productos[:40]
    )
    user = (
        "Productos con stock actual y venta diaria promedio (últimas 2 semanas):\n" + detalle +
        "\n\nDecime qué conviene reponer YA porque está por quedarse sin (poco stock para lo que "
        "rota) y sugerí una cantidad para aguantar ~2 semanas "
        "(ej: 'Te quedan 2 días de Coca, pedí ~48'). Priorizá lo más urgente primero. "
        "Una línea por producto, cada una empezando con '• '. Frases cortas."
    )
    return await _texto(user)


async def mensaje_cobranza(cliente: dict) -> str:
    """cliente: {name, balance, detalle?} → mensaje de WhatsApp listo para enviar."""
    detalle = f" Lo último que se llevó: {cliente['detalle']}." if cliente.get("detalle") else ""
    user = (
        "Escribí UN mensaje corto de WhatsApp para recordarle amablemente a un cliente del kiosco "
        f"que tiene una cuenta pendiente. Cliente: {cliente.get('name')}. Debe: "
        f"${cliente.get('balance')}.{detalle} "
        "Tono cordial, de barrio, nada agresivo. Tuteá al cliente. Devolvé SOLO el texto del "
        "mensaje, listo para mandar, sin comillas ni explicaciones."
    )
    return await _texto(user)


def _extract_json(text: str) -> dict:
    """Extrae el objeto JSON de la respuesta del modelo (tolera markdown/fences/texto extra)."""
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

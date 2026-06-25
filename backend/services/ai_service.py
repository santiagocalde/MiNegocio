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


async def procesar_factura_ocr(image_bytes: bytes, content_type: str = "image/jpeg") -> dict:
    """Lee una imagen de factura y devuelve proveedor + items detectados (costo unitario)."""
    if not AI_API_KEY:
        raise AINotConfigured(
            "El escaneo de facturas con IA no está configurado en el servidor. "
            "Definí AI_INVOICE_API_KEY (y opcionalmente AI_INVOICE_BASE_URL y AI_INVOICE_MODEL)."
        )

    data_url = f"data:{content_type or 'image/jpeg'};base64,{base64.b64encode(image_bytes).decode()}"
    # Sin 'temperature': algunos modelos (Kimi/Moonshot) solo aceptan el default.
    payload = {
        "model": AI_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": _PROMPT},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }],
    }
    headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{AI_BASE_URL}/chat/completions", json=payload, headers=headers)
    except httpx.RequestError as e:
        logger.error(f"IA scan-invoice: no se pudo conectar al proveedor: {e}")
        raise RuntimeError("No se pudo conectar con el servicio de IA. Revisá la conexión o el AI_INVOICE_BASE_URL.")

    if resp.status_code != 200:
        logger.error(f"IA scan-invoice error {resp.status_code}: {resp.text[:300]}")
        raise RuntimeError(
            f"El servicio de IA respondió {resp.status_code}. "
            "Verificá la API key, el nombre del modelo y que el modelo soporte imágenes."
        )

    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError):
        raise RuntimeError("Respuesta inesperada del servicio de IA.")

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

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from services.ai_service import procesar_factura_ocr, AINotConfigured
from main import get_current_business, check_plan_limits

router = APIRouter(prefix="/api/ai", tags=["AI Integration"])

@router.post("/scan-invoice", summary="Escanear Factura de Proveedor con IA (OCR)")
async def scan_invoice(request: Request, file: UploadFile = File(...)):
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Autenticacion requerida")
    biz = await get_current_business(auth)
    if not biz:
        raise HTTPException(status_code=401, detail="Token invalido")
    plan = biz.get("plan", "trial")
    if plan != "ia":
        raise HTTPException(status_code=402, detail="El modulo de IA requiere Plan IA. Tu plan actual es '{}'.".format(plan))
    if file.content_type is None or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen valida.")
    try:
        content = await file.read()
        resultado = await procesar_factura_ocr(content, file.content_type)
        return resultado
    except AINotConfigured as e:
        # La función existe pero falta configurar la API key en el servidor.
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo analizar la factura: {str(e)}")

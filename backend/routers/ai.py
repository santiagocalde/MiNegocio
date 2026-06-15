from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from services.ai_service import procesar_factura_ocr

router = APIRouter(prefix="/api/ai", tags=["AI Integration"])

@router.post("/scan-invoice", summary="Escanear Factura de Proveedor con IA (OCR)")
async def scan_invoice(file: UploadFile = File(...)):
    # business: dict = Depends(get_current_business) # Require auth in real scenario
    if file.content_type is None or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen válida.")
        
    try:
        content = await file.read()
        resultado = procesar_factura_ocr(content)
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando la imagen: {str(e)}")

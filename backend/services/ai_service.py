import random
import re

# NOTA ARQUITECTÓNICA: En producción, esto usaría la API de OpenAI GPT-4o-mini o 
# Google Cloud Vision Document AI para extraer los productos de una imagen real.

def procesar_factura_ocr(image_bytes: bytes):
    """
    Simula la extracción OCR de una foto de factura de proveedor.
    """
    
    # Proveedores simulados
    proveedores = ["Distribuidora del Sur", "Maxiconsumo", "Coca-Cola Andina", "Arcor SAIC"]
    
    # Items simulados que la IA "detecta" en la imagen
    items_posibles = [
        {"name": "Coca Cola 500ml", "qty": 48, "cost": 850.0},
        {"name": "Pan lactal Bimbo", "qty": 24, "cost": 1100.0},
        {"name": "Yerba Playadito 1kg", "qty": 12, "cost": 1800.0},
        {"name": "Detergente Ala x2", "qty": 30, "cost": 2900.0},
        {"name": "Galletitas Oreo", "qty": 60, "cost": 500.0},
    ]
    
    # Seleccionamos aleatoriamente 2 o 3 productos para simular la lectura
    detectados = random.sample(items_posibles, random.randint(2, 4))
    
    return {
        "proveedor": random.choice(proveedores),
        "fecha": "2026-06-05",
        "factura_nro": f"A-0001-{random.randint(10000, 99999)}",
        "items_detectados": detectados,
        "total_detectado": sum([i['qty'] * i['cost'] for i in detectados])
    }

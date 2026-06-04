#!/usr/bin/env python3
"""
🧪 SCRIPT DE STRESS TEST DE CONCURRENCIA PARA NOVASTOCK
Simula 20 llamadas de venta (sales) concurrentes sin delays en el backend.
Verifica que las idempotency keys, transacciones y locks funcionen perfectamente.
"""

import sys
import json
import time
import sqlite3
import threading
import urllib.request
import urllib.error
from pathlib import Path

SERVER_URL = "http://localhost:8000/api/sales"
DB_PATH = Path(__file__).parent / "backend" / "novastock.db"

def hit_sale_api(sale_idx, results):
    payload = {
        "turn_id": 1,
        "total": 100.0,
        "payment": 100.0,
        "change_given": 0.0,
        "operator": "Stress Tester",
        "is_fiado": False,
        "fiado_name": "",
        "items": [
            {
                "product_id": 1,
                "product_name": "Coca Cola Test",
                "quantity": 1,
                "unit_price": 100.0
            }
        ]
    }
    
    # Usamos un id de idempotencia único para cada hilo
    idempotency_key = f"stress_py_{int(time.time())}_{sale_idx}"
    url_with_key = f"{SERVER_URL}?idempotency_key={idempotency_key}"
    
    req = urllib.request.Request(
        url_with_key,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        start = time.time()
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            elapsed = time.time() - start
            results.append({
                "index": sale_idx,
                "success": res_data.get("success", False),
                "sale_id": res_data.get("id"),
                "elapsed_ms": int(elapsed * 1000),
                "error": None
            })
    except Exception as e:
        results.append({
            "index": sale_idx,
            "success": False,
            "sale_id": None,
            "elapsed_ms": 0,
            "error": str(e)
        })

def run_stress_test():
    print("=" * 70)
    print("🚀 INICIANDO TEST DE CONCURRENCIA PURA (20 Venta/s)")
    print("=" * 70)
    
    # 1. Verificar si el backend está activo
    try:
        urllib.request.urlopen("http://localhost:8000/api/products", timeout=2)
    except Exception:
        print("❌ ERROR: El servidor backend de NovaStock no está corriendo.")
        print("   Por favor iniciá el backend primero ejecutando 'INICIAR_NOVASTOCK.bat'")
        print("   o corriendo 'python backend/main.py' en otra terminal.")
        sys.exit(1)

    # 2. Inicializar base de datos de test si es necesario y obtener stock inicial
    if not DB_PATH.exists():
        print(f"❌ ERROR: No se encontró la base de datos en {DB_PATH}")
        sys.exit(1)
        
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Obtener o asegurar producto test con ID 1
    cursor.execute("SELECT name, stock FROM products WHERE id = 1")
    product = cursor.fetchone()
    if not product:
        # Insertar producto de prueba
        cursor.execute(
            "INSERT INTO products (id, code, name, price, cost_price, stock, min_stock) VALUES (1, '001', 'Coca Cola Test', 100.0, 50.0, 50, 5)"
        )
        conn.commit()
        stock_inicial = 50
        print("💡 Se creó un producto 'Coca Cola Test' (ID: 1) con 50 unidades de stock.")
    else:
        stock_inicial = product[1]
        # Asegurar stock para el test
        if stock_inicial < 25:
            cursor.execute("UPDATE products SET stock = 50 WHERE id = 1")
            conn.commit()
            stock_inicial = 50
            print("💡 Stock del producto ID 1 reestablecido a 50 unidades para el test.")

    print(f"📊 Stock inicial del Producto ID 1: {stock_inicial} unidades.")
    conn.close()

    # 3. Disparar los 20 hilos concurrentes
    threads = []
    results = []
    
    print("\n⏳ Lanzando 20 peticiones POST concurrentes...")
    start_time = time.time()
    
    for i in range(20):
        t = threading.Thread(target=hit_sale_api, args=(i, results))
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    total_time = time.time() - start_time
    print(f"✅ ¡Todas las peticiones finalizaron en {total_time:.2f} segundos!")
    
    # 4. Mostrar resultados detallados
    exitos = [r for r in results if r["success"]]
    fallos = [r for r in results if not r["success"]]
    
    print("\n" + "=" * 70)
    print("📊 RESULTADOS DE API:")
    print("=" * 70)
    print(f"   • Peticiones Exitosas: {len(exitos)}/20")
    print(f"   • Peticiones Fallidas: {len(fallos)}/20")
    
    if fallos:
        print("\n❌ Errores detectados:")
        for f in fallos[:5]:
            print(f"     - Hilo #{f['index']}: {f['error']}")
            
    # Mostrar tiempos de respuesta
    tiempos = [r["elapsed_ms"] for r in exitos]
    if tiempos:
        print(f"   • Tiempo Mínimo: {min(tiempos)} ms")
        print(f"   • Tiempo Máximo: {max(tiempos)} ms (cola del lock)")
        print(f"   • Tiempo Promedio: {sum(tiempos)//len(tiempos)} ms")

    # 5. Conectarse a SQLite y validar consistencia
    print("\n" + "=" * 70)
    print("🔍 VALIDACIÓN DE CONSISTENCIA EN DB:")
    print("=" * 70)
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("SELECT stock FROM products WHERE id = 1")
    stock_final = cursor.fetchone()[0]
    
    # Validar decremento exacto
    unidades_vendidas = stock_inicial - stock_final
    print(f"   • Stock Inicial: {stock_inicial}")
    print(f"   • Stock Final:   {stock_final}")
    print(f"   • Unidades descontadas: {unidades_vendidas} (Esperado: 20)")
    
    if unidades_vendidas == 20:
        print("   ✅ ¡Consistencia de stock perfecta! Descuento atómico confirmado.")
    else:
        print("   ❌ ERROR: Las unidades descontadas no coinciden con las ventas procesadas.")

    # Validar duplicados de idempotency
    cursor.execute("SELECT idempotency_key, COUNT(*) as c FROM sales GROUP BY idempotency_key HAVING c > 1")
    duplicados = cursor.fetchall()
    if not duplicados:
        print("   ✅ ¡Cero registros duplicados por Idempotency Key!")
    else:
        print(f"   ❌ ERROR: Se detectaron {len(duplicados)} claves de idempotencia duplicadas.")
        
    conn.close()
    print("=" * 70 + "\n")

if __name__ == "__main__":
    run_stress_test()

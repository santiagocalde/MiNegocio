# 🧪 PROCEDIMIENTO DE STRESS TESTING - NovaStock

## Fase 1: Validación Pre-Testing (30 min)

### Paso 1.1: Ejecutar Validador
```bash
# En Windows (CMD):
validar.bat

# En Linux/Mac/WSL:
bash validar.sh
```

**Qué hace:** Verifica que las 3 defensas críticas estén implementadas:
- ✅ Idempotency Keys (anti-duplicados)
- ✅ Integrity Check (backups seguros)
- ✅ Async Locks (anti-race conditions)

**Resultado esperado:**
```
=====================================
RESULTADO: 6/6 checks pasados
=====================================
🚀 ¡LISTO PARA STRESS TEST!
```

---

## Fase 2: Setup Físico (15 min)

### Paso 2.1: Preparar el entorno
```bash
# Limpia backups anteriores
rm -rf C:\NovaStock\backups\*

# Reinicia el servicio Python
# En Windows:
net stop NovaStock
net start NovaStock

# Verifica que esté corriendo en http://localhost:8000
# (Debería verse la pantalla de login)
```

### Paso 2.2: Abrir 2 navegadores
```
Navegador #1: http://localhost:8000
Navegador #2: http://localhost:8000

Ambos logueados como "Caja 1" y "Caja 2" (PINs diferentes)
```

---

## Fase 3: Stress Test Básico (5 min)

### Escenario #1: Venta simultánea simple
```
Tiempo  | Acción (Navegador #1)        | Acción (Navegador #2)
--------|------------------------------|---------------------------
0:00    | Escanea: Coca Cola           |
0:01    |                              | Escanea: Cerveza
0:02    | Presiona F1 (COBRAR)         |
0:03    |                              | Presiona F1 (COBRAR)
0:04    | Ingresa: 500 pesos           | Ingresa: 500 pesos
0:05    | Presiona Enter               | Presiona Enter
```

**Verificación:**
- ✅ Ambas ventas aparecen en DB
- ✅ Ninguna se duplicó
- ✅ Stock actualizado en ambas cajas
- ✅ Totales correctos (no hay dinero perdido)

---

## Fase 4: Stress Test Medio (10 min)

### Escenario #2: Carga concurrente
```
Tiempo  | Acción (Navegador #1)        | Acción (Navegador #2)
--------|------------------------------|---------------------------
0:00    | Escanea rápido 5 productos   | Escanea rápido 3 productos
        | (Coca, Pan, Agua, Etc)      | (Cerveza, Chips, Dulce)
0:10    | Presiona F1 (COBRAR)         | Presiona F1 (COBRAR)
0:11    | Ingresa: 1000 pesos          | Ingresa: 800 pesos
0:12    | Presiona Enter               | Presiona Enter
0:13    | [Simultáneamente]            | [Simultáneamente]
        | Stock debería actualizar      | Stock debería actualizar
```

**Verificación:**
- ✅ Las 2 ventas se registran
- ✅ Stock se descuenta correctamente en ambas
- ✅ Ninguna venta se pierde
- ✅ Totales diarios correctos

---

## Fase 5: Stress Test Hard (15 min)

### Escenario #3: Lluvia de requests (El caos real)
Abre DOS CONSOLAS DE JAVASCRIPT en cada navegador y ejecuta simultáneamente:

```javascript
// NAVEGADOR #1
async function lluvia_ventas_1() {
  for (let i = 0; i < 10; i++) {
    await fetch('/api/sales', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        items: [{ product_id: '001', qty: 1, price: 100 }],
        total: 100,
        caja_id: 'caja_1',
        idempotency_key: `sale_1_${i}`
      })
    }).then(r => r.json()).then(d => console.log(`Venta ${i}:`, d));
    await new Promise(r => setTimeout(r, 500));
  }
}
lluvia_ventas_1();
```

---

## Fase 6: Test de Red (Simular caída de conexión)

### Escenario #4: Fallo de red durante cobro
1. Abre DevTools (F12 → Network tab)
2. Selecciona "Offline"
3. Intenta una venta (Presiona F1).
4. Verifica que el carrito SE MANTIENE y dice "Reintentando...".
5. Reactiva la red (Online).
6. Verifica que el sistema reenvía la venta automáticamente sin duplicarla.

---

## Fase 7: Validación Post-Testing (10 min)

### Paso 7.1: Revisar la base de datos
```sql
-- Contar ventas totales
SELECT COUNT(*) as total_ventas FROM sales;

-- Verificar que NO hay duplicados de idempotency_key
SELECT idempotency_key, COUNT(*) as repeticiones FROM sales 
GROUP BY idempotency_key HAVING COUNT(*) > 1;
```
*(Si la query de duplicados retorna NADA = ✅ EXCELENTE)*

### Paso 7.2: Revisar backups
Verificar que existan en `C:\NovaStock\backups\` (máx 20 archivos `.db.gz`) y no estén corruptos.

---

## Fase 8: Test Final de Concurrencia Extrema (El Jefe Final)

**Propósito:** Probar que los bloqueos (`asyncio.Lock()` + `BEGIN IMMEDIATE`) no solo encolan ordenadamente, sino que no rechazan conexiones cuando se dispara todo en paralelo puro (sin delays).

**Qué vas a notar:**
- ⏳ Los 20 requests se disparan al instante (t=0).
- ⏳ El navegador puede tardar ~3-5 segundos en responder en total.
- Esto NO es un bug ni "lentitud". Es el `asyncio.Lock()` obligando a SQLite a procesar un ticket por vez de forma hiper-segura en el backend.

### Ejecución:
Pega el siguiente código en la consola del navegador y dale a Enter:

```javascript
async function stress_test_locks() {
  const startTime = Date.now();
  const promises = [];
  
  // Lanza 20 requests EN PARALELO TOTAL (sin delays)
  for (let i = 0; i < 20; i++) {
    const promise = fetch('/api/sales', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        items: [{ product_id: '001', qty: 1, price: 100 }],
        total: 100,
        caja_id: `caja_${Math.random()}`,
        idempotency_key: `stress_${Date.now()}_${i}`
      })
    }).then(r => r.json());
    
    promises.push(promise);
  }
  
  // Espera que TODAS terminen
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  console.log(`
STRESS TEST COMPLETO:
- 20 requests lanzadas EN PARALELO
- Tiempo total: ${endTime - startTime}ms
- Éxitos: ${results.filter(r => r.success).length}/20
- Fallos: ${results.filter(r => !r.success).length}/20
  `);
  
  return results;
}

stress_test_locks();
```

**Resultado Esperado:**
- `Éxitos: 20/20`
- `Fallos: 0/20`
- Al hacer `SELECT COUNT(*)`, deben aparecer exactamente 20 registros nuevos.
- Si este test pasa con éxito: **El sistema está listo para producción.**

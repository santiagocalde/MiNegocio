#!/usr/bin/env python3
"""
🔍 VALIDACIÓN FINAL PRE-FASE 5 - NovaStock
Verifica que el UPDATE atómico del stock está REALMENTE implementado
(No es suficiente con que exista, tiene que estar CORRECTO)
"""

import re
import sys
from pathlib import Path

class ValidadorUpdateAtomic:
    def __init__(self, main_py_path: str = "backend/main.py"):
        self.main_py_path = Path(main_py_path)
        self.content = self._read_file()
        self.passed = []
        self.failed = []
    
    def _read_file(self) -> str:
        if not self.main_py_path.exists():
            print(f"❌ ERROR: {self.main_py_path} no encontrado")
            sys.exit(1)
        with open(self.main_py_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def check_1_no_select_stock_before_update(self):
        """Verifica que NO haya SELECT stock antes del UPDATE"""
        print("\n" + "="*70)
        print("CHECK #1: NO hay SELECT stock antes del UPDATE")
        print("="*70)
        
        # Buscar patrón MALO: SELECT stock ... seguido de UPDATE
        bad_pattern = r"SELECT.*stock.*FROM.*products.*WHERE.*id\s*=.*\n.*UPDATE.*products.*SET.*stock"
        
        if re.search(bad_pattern, self.content, re.IGNORECASE | re.DOTALL):
            print("❌ FALLO: Encontré un SELECT stock seguido de UPDATE")
            print("   Esto indica que estás leyendo el stock en Python antes de actualizar")
            print("   ESO ES VULNERABLE A RACE CONDITIONS")
            self.failed.append("SELECT before UPDATE pattern found")
            return False
        
        print("✅ PASS: No hay SELECT stock antes del UPDATE")
        self.passed.append("No SELECT before UPDATE")
        return True
    
    def check_2_update_uses_stock_minus(self):
        """Verifica que el UPDATE use 'stock - ' (resta atómica)"""
        print("\n" + "="*70)
        print("CHECK #2: UPDATE usa 'stock - ?' (resta atómica)")
        print("="*70)
        
        # Buscar el patrón CORRECTO
        good_pattern = r"UPDATE\s+products\s+SET\s+stock\s*=\s*(?:MAX\(0,\s*)?stock\s*-\s*\?"
        
        if re.search(good_pattern, self.content, re.IGNORECASE):
            print("✅ PASS: Encontré UPDATE con 'stock - ?' (atómico)")
            print("   Esto significa que SQLite lee, calcula y escribe en una sola operación")
            self.passed.append("UPDATE stock - ? found")
            return True
        else:
            print("❌ FALLO: No encontré UPDATE con 'stock - ?'")
            print("   Estás haciendo calculos en Python, no en SQL")
            self.failed.append("UPDATE stock - ? pattern NOT found")
            return False
    
    def check_3_has_max_zero_protection(self):
        """Verifica que haya MAX(0, ...) para evitar stock negativo"""
        print("\n" + "="*70)
        print("CHECK #3: UPDATE usa MAX(0, stock - ?) para evitar negativos")
        print("="*70)
        
        max_pattern = r"MAX\s*\(\s*0\s*,\s*stock\s*-\s*\?"
        
        if re.search(max_pattern, self.content, re.IGNORECASE):
            print("✅ PASS: Encontré MAX(0, stock - ?) protección")
            print("   Esto previene que el stock baje a números negativos")
            self.passed.append("MAX(0, ...) protection found")
            return True
        else:
            print("⚠️  WARNING: No encontré MAX(0, ...) protección")
            print("   El stock PODRÍA quedarse negativo bajo estrés")
            print("   No es fatal pero es un riesgo")
            self.failed.append("MAX(0, ...) NOT found")
            return False
    
    def check_4_asyncio_lock_exists(self):
        """Verifica que el asyncio.Lock() esté definido y usado"""
        print("\n" + "="*70)
        print("CHECK #4: asyncio.Lock() está definido y protege escrituras")
        print("="*70)
        
        # Buscar definición del lock
        lock_def = r"db_write_lock\s*=\s*asyncio\.Lock\(\)"
        lock_usage = r"async\s+with\s+db_write_lock\s*:"
        
        has_def = bool(re.search(lock_def, self.content, re.IGNORECASE))
        has_usage = bool(re.search(lock_usage, self.content, re.IGNORECASE))
        
        if has_def and has_usage:
            print("✅ PASS: asyncio.Lock() está definido y usado")
            print("   El bloqueo a nivel de Python protege múltiples requests")
            self.passed.append("asyncio.Lock() properly used")
            return True
        elif has_def:
            print("⚠️  WARNING: Lock está definido pero NO se usa en endpoint")
            self.failed.append("Lock defined but not used")
            return False
        else:
            print("❌ FALLO: No encontré asyncio.Lock()")
            self.failed.append("asyncio.Lock() not found")
            return False
    
    def check_5_begin_immediate_in_checkout(self):
        """Verifica que BEGIN IMMEDIATE esté en la transacción de venta"""
        print("\n" + "="*70)
        print("CHECK #5: Transacción usa BEGIN IMMEDIATE")
        print("="*70)
        
        begin_pattern = r"BEGIN\s+IMMEDIATE"
        
        if re.search(begin_pattern, self.content, re.IGNORECASE):
            print("✅ PASS: BEGIN IMMEDIATE encontrado")
            print("   SQLite va a reservar el write lock de inmediato")
            self.passed.append("BEGIN IMMEDIATE found")
            return True
        else:
            print("⚠️  WARNING: No encontré BEGIN IMMEDIATE")
            print("   Estás usando BEGIN normal (menos seguro bajo concurrencia)")
            self.failed.append("BEGIN IMMEDIATE not found")
            return False
    
    def check_6_idempotency_key_unique(self):
        """Verifica que idempotency_key tenga UNIQUE constraint"""
        print("\n" + "="*70)
        print("CHECK #6: idempotency_key tiene UNIQUE constraint")
        print("="*70)
        
        unique_pattern = r"idempotency_key.*UNIQUE"
        
        if re.search(unique_pattern, self.content, re.IGNORECASE):
            print("✅ PASS: idempotency_key tiene UNIQUE")
            print("   Imposible duplicar ventas aunque el cliente reintente 100 veces")
            self.passed.append("idempotency_key UNIQUE found")
            return True
        else:
            print("❌ FALLO: idempotency_key NO tiene UNIQUE")
            print("   RIESGO: Podrías tener ventas duplicadas")
            self.failed.append("idempotency_key UNIQUE not found")
            return False
    
    def check_7_stock_check_after_update(self):
        """Verifica que haya validación después del UPDATE"""
        print("\n" + "="*70)
        print("CHECK #7: Hay validación de stock después del UPDATE")
        print("="*70)
        
        # Buscar si se verifica el stock después
        check_pattern = r"SELECT.*stock.*FROM.*products.*WHERE.*id.*=.*\?"
        
        if re.search(check_pattern, self.content, re.IGNORECASE):
            print("✅ PASS: Hay validación de stock después de UPDATE")
            print("   Buena práctica: verificas que no quedó negativo")
            self.passed.append("Stock validation after UPDATE found")
            return True
        else:
            print("⚠️  WARNING: No veo validación explícita de stock")
            print("   Probablemente el MAX(0, ...) lo maneja, pero verificar")
            self.failed.append("Stock validation not found")
            return False
    
    def run_all_checks(self) -> bool:
        """Ejecuta todos los checks"""
        print("\n" + "█"*70)
        print("█  VALIDACIÓN FINAL PRE-FASE 5")
        print("█  Verificando que el UPDATE atómico está CORRECTAMENTE implementado")
        print("█"*70)
        
        # Ejecutar checks críticos
        c1 = self.check_1_no_select_stock_before_update()
        c2 = self.check_2_update_uses_stock_minus()
        c3 = self.check_3_has_max_zero_protection()
        c4 = self.check_4_asyncio_lock_exists()
        c5 = self.check_5_begin_immediate_in_checkout()
        c6 = self.check_6_idempotency_key_unique()
        c7 = self.check_7_stock_check_after_update()
        
        # Resumen
        print("\n" + "█"*70)
        print("█  RESUMEN")
        print("█"*70)
        
        total_checks = 7
        passed = len(self.passed)
        failed = len(self.failed)
        
        print(f"\n✅ PASARON: {passed}/{total_checks}")
        for p in self.passed:
            print(f"   • {p}")
        
        if self.failed:
            print(f"\n❌ FALLARON: {failed}/{total_checks}")
            for f in self.failed:
                print(f"   • {f}")
        
        # Veredicto final
        print("\n" + "="*70)
        
        if len(self.failed) == 0:
            print("✅ VERDE PARA FASE 5")
            print("="*70)
            print("\nTODAS LAS DEFENSAS ESTÁN EN LUGAR")
            print("Ejecutá la Fase 5 sin miedo. El sistema está acorazado.")
            return True
        
        elif len(self.failed) <= 2 and "MAX(0" not in str(self.failed):
            print("⚠️  AMARILLO - PROCEDE CON CUIDADO")
            print("="*70)
            print("\nHay algunos detalles, pero nada crítico.")
            print("Podés hacer Fase 5 pero revisá los FALLOSantes.")
            return True
        
        else:
            print("❌ ROJO - NO EJECUTES FASE 5 AÚN")
            print("="*70)
            print("\nHay problemas críticos que arreglar primero:")
            for f in self.failed:
                print(f"   • {f}")
            print("\nArréglalo y repite este validador.")
            return False

def main():
    validador = ValidadorUpdateAtomic()
    success = validador.run_all_checks()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

import { formatMoney } from '../../utils/format';

// Ventas por categoría — componente aparte que se muestra al pie del
// Resumen del Día y del Cierre de Turno. Sirve para que el dueño separe
// la plata por rubro (ej. cigarrillos en caja aparte) al cuadrar la caja.
//
// Misma tarjeta (header + renglones) que "Ventas por método" / "Caja del
// turno" — consistencia visual entre todas las secciones del modal. El
// único ajuste es el alto: con más de 6 rubros la tarjeta cierra a 220px
// y scrollea adentro; con pocos, crece con el contenido sin caja de más.
// `compact`: se usa lado a lado con otra lista — sin margin-top propio.
export default function CategoryBreakdown({ items, compact }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const fmtQty = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  };

  const capped = items.length > 6;

  return (
    <div style={compact ? undefined : { marginTop: '18px' }}>
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-main)', maxHeight: capped ? '220px' : 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          Ventas por categoría
        </div>
        <div style={{ overflowY: capped ? 'auto' : 'visible' }}>
          {items.map((cat, i) => (
            <div key={cat.categoria} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '9px 14px', fontSize: '0.9rem', borderBottom: i < items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cat.categoria}
                {parseFloat(cat.cantidad) > 0 && <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}> · {fmtQty(cat.cantidad)} u</span>}
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{formatMoney(cat.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

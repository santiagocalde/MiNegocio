import { formatMoney } from '../../utils/format';

// Ventas por categoría — componente aparte que se muestra al pie del
// Resumen del Día y del Cierre de Turno. Sirve para que el dueño separe
// la plata por rubro (ej. cigarrillos en caja aparte) al cuadrar la caja.
export default function CategoryBreakdown({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const fmtQty = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  };

  return (
    <div style={{ marginTop: '18px' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', paddingLeft: '2px' }}>
        Ventas por categoría
      </div>
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-main)' }}>
        {items.map((cat, i) => (
          <div key={cat.categoria} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.categoria}</span>
              {parseFloat(cat.cantidad) > 0 && (
                <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>{fmtQty(cat.cantidad)} u</span>
              )}
            </div>
            <span style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatMoney(cat.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { formatMoney } from '../../utils/format';

// Ventas por categoría — componente aparte que se muestra al pie del
// Resumen del Día y del Cierre de Turno. Sirve para que el dueño separe
// la plata por rubro (ej. cigarrillos en caja aparte) al cuadrar la caja.
//
// Estilo ledger (renglones sueltos + barra de proporción fina), no una
// lista genérica en caja: la caja con scroll solo aparece cuando hay más
// de 6 rubros y hace falta contener la altura — con pocos rubros los
// renglones van sueltos, sin encajonar contenido que ya entra bien.
// `compact`: se usa cuando va lado a lado con otra lista (ej. "Más vendidos")
// — sin margin-top propio, para que las dos queden alineadas en la grilla.
export default function CategoryBreakdown({ items, compact }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const fmtQty = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  };

  const total = items.reduce((s, c) => s + (parseFloat(c.total) || 0), 0) || 1;
  const capped = items.length > 6;

  const rows = items.map((cat) => {
    const pct = Math.max(2, Math.round(((parseFloat(cat.total) || 0) / total) * 100));
    return (
      <div key={cat.categoria} style={{ padding: '9px 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.categoria}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', flexShrink: 0 }}>{formatMoney(cat.total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border-color)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-primary)', opacity: 0.75, borderRadius: 2 }} />
          </div>
          {parseFloat(cat.cantidad) > 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtQty(cat.cantidad)} u</span>
          )}
        </div>
      </div>
    );
  });

  return (
    <div style={compact ? undefined : { marginTop: '18px' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px', paddingLeft: '2px' }}>
        Ventas por categoría
      </div>
      {capped ? (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '2px 12px', maxHeight: '220px', overflowY: 'auto' }}>
          {rows}
        </div>
      ) : (
        <div style={{ padding: '0 2px' }}>{rows}</div>
      )}
    </div>
  );
}

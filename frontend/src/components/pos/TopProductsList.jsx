// "Más vendidos" — componente compartido entre Resumen del Día y Cierre de
// Turno. Mismo lenguaje visual que CategoryBreakdown: renglones sueltos con
// barra de proporción, caja con scroll solo cuando hay más de 6 productos.
export default function TopProductsList({ items, compact }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const total = items.reduce((s, p) => s + (parseFloat(p.total) || 0), 0) || 1;
  const capped = items.length > 6;

  const rows = items.map((p, i) => {
    const pct = Math.max(2, Math.round(((parseFloat(p.total) || 0) / total) * 100));
    return (
      <div key={i} style={{ padding: '9px 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.producto}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', flexShrink: 0 }}>${(p.total || 0).toLocaleString('es-AR')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border-color)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-primary)', opacity: 0.75, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{p.cantidad} u</span>
        </div>
      </div>
    );
  });

  return (
    <div style={compact ? undefined : { marginTop: '18px' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px', paddingLeft: '2px' }}>
        Más vendidos
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

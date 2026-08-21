// "Más vendidos" — componente compartido entre Resumen del Día y Cierre de
// Turno. Misma tarjeta (header + renglones) que "Ventas por método" / "Caja
// del turno" / "Ventas por categoría" — consistencia visual entre todas las
// secciones. Con más de 6 productos la tarjeta cierra a 220px y scrollea
// adentro; con pocos, crece con el contenido sin caja de más.
export default function TopProductsList({ items, compact }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const capped = items.length > 6;

  return (
    <div style={compact ? { minWidth: 0 } : { marginTop: '18px' }}>
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-main)', maxHeight: capped ? '220px' : 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          Más vendidos
        </div>
        <div style={{ overflowY: capped ? 'auto' : 'visible' }}>
          {items.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '9px 14px', fontSize: '0.9rem', borderBottom: i < items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.producto}
                <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}> · {p.cantidad} u</span>
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>${(p.total || 0).toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

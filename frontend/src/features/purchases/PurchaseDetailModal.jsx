/**
 * Modal de detalle de una compra. Extraído de PurchasesModule (era una IIFE
 * inline) sin cambiar comportamiento. Se cierra con onClose.
 */
export default function PurchaseDetailModal({ purchase, onClose }) {
  const items = purchase.items || [];
  const total = items.reduce((acc, i) => acc + (i.unit_cost || 0) * (i.quantity || 0), 0);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '550px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 20px 0', color: 'var(--text-primary)' }}>Detalle de Compra</h2>
        <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Proveedor</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{purchase.supplier_name || 'N/A'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Fecha</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{purchase.created_at ? new Date(purchase.created_at).toLocaleString('es-AR', { dateStyle: 'medium' }) : '---'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Items</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{items.length}</div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Producto</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Cantidad</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Costo Unit.</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Subtotal</th>
          </tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{it.product_name}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{it.quantity}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>${(it.unit_cost || 0).toLocaleString('es-AR')}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${((it.unit_cost || 0) * (it.quantity || 0)).toLocaleString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Total</span>
          <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>${total.toLocaleString('es-AR')}</span>
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: 20, padding: '12px', borderRadius: 8, border: 'none', background: 'var(--gradient-primary)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
      </div>
    </div>
  );
}

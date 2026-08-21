import { useRef } from 'react';
import useModalExit, { overlayAnim, contentAnim } from '../../hooks/useModalExit';

/**
 * Modal de detalle de una compra. El padre lo monta SIEMPRE y le pasa
 * `purchase` (null = cerrado); así el hook puede reproducir la animación de
 * salida antes de desmontar. Guarda la última compra en un ref para seguir
 * mostrándola mientras se desvanece.
 */
export default function PurchaseDetailModal({ purchase, onClose }) {
  const { rendered, closing } = useModalExit(!!purchase);
  const lastRef = useRef(null);
  if (purchase) lastRef.current = purchase;
  const p = purchase || lastRef.current;
  if (!rendered || !p) return null;

  const items = p.items || [];
  const total = items.reduce((acc, i) => acc + (i.unit_cost || 0) * (i.quantity || 0), 0);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, ...overlayAnim(closing) }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ padding: '32px', width: '550px', maxWidth: '92vw', boxSizing: 'border-box', maxHeight: '80vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)', ...contentAnim(closing) }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 20px 0', color: 'var(--text-primary)' }}>Detalle de Compra</h2>
        <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Proveedor</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.supplier_name || 'N/A'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Fecha</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.created_at ? new Date(p.created_at).toLocaleString('es-AR', { dateStyle: 'medium' }) : '---'}</div>
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
        <button onClick={onClose} style={{ width: '100%', marginTop: 20, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-primary)', color: 'var(--sheet)', fontWeight: 800, cursor: 'pointer' }}>Cerrar</button>
      </div>
    </div>
  );
}

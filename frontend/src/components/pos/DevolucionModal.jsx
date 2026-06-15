import { useState } from 'react';
import ConfirmModal from '../ui/ConfirmModal';

export default function DevolucionModal({ showDevolucionItems, setShowDevolucionItems, lastSale, lastSaleId, devolucionQtys, setDevolucionQtys, handleDevolucionItem, handleDevolucion }) {
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  if (!showDevolucionItems || !lastSale?.cart) return null;
  return (
    <>
      <div className="modal-overlay" onClick={() => setShowDevolucionItems(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
          <h2 className="modal-title" style={{ color: 'var(--accent-warning)' }}>↩ Devolver Ítems</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '16px' }}>Última venta — Seleccioná qué productos devolver y la cantidad</p>
          <div style={{ marginBottom: '16px' }}>
            {lastSale.cart.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--border-color)', gap: '12px' }}>
                <div style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {item.name}<div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>x{item.qty} — ${item.price} c/u</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" min="0" max={item.qty} step="0.01" style={{ width: '60px', padding: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', textAlign: 'center', fontSize: '0.9rem' }}
                    value={devolucionQtys[item.id] || ''}
                    onChange={e => setDevolucionQtys(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder="0" />
                  <button onClick={() => { handleDevolucionItem(item.id, item.name, lastSaleId, devolucionQtys); setDevolucionQtys(prev => ({ ...prev, [item.id]: '' })); }}
                    disabled={!devolucionQtys[item.id] || parseFloat(devolucionQtys[item.id]) <= 0}
                    style={{ background: 'var(--accent-danger)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', opacity: (!devolucionQtys[item.id] || parseFloat(devolucionQtys[item.id]) <= 0) ? 0.5 : 1 }}>Devolver</button>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn btn-modal-cancel" onClick={() => setShowDevolucionItems(false)}>Cerrar (Esc)</button>
            <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-danger)' }} onClick={() => setShowVoidConfirm(true)}>Anular Venta Completa</button>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={showVoidConfirm}
        onClose={() => setShowVoidConfirm(false)}
        onConfirm={() => { handleDevolucion(lastSaleId); setShowDevolucionItems(false); setShowVoidConfirm(false); }}
        title="¿Anular venta completa?"
        message="Se revertirá toda la venta seleccionada y los productos volverán al inventario. Esta acción no se puede deshacer."
        confirmLabel="Sí, anular todo"
        variant="danger"
      />
    </>
  );
}

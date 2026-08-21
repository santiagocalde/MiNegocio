import { useState } from 'react';
import ConfirmModal from '../ui/ConfirmModal';
import SupervisorPinModal from './SupervisorPinModal';
import useModalExit from '../../hooks/useModalExit';

export default function DevolucionModal({ showDevolucionItems, setShowDevolucionItems, lastSale, lastSaleId, devolucionQtys, setDevolucionQtys, handleDevolucionItem, handleDevolucion, singleUser = false }) {
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  // Acción pendiente de autorización por PIN: { type: 'item', item } | { type: 'void' }
  const [pendingAction, setPendingAction] = useState(null);
  const { rendered, closing } = useModalExit(showDevolucionItems);
  if (!rendered || !lastSale?.cart) return null;

  // Ejecuta la devolución/anulación. El PIN puede ir vacío: el backend no lo
  // exige si el negocio tiene un solo usuario (no hay supervisor que autorizar).
  const runAction = async (action, pin) => {
    if (action.type === 'item') {
      const ok = await handleDevolucionItem(action.item.id, action.item.name, lastSaleId, devolucionQtys, pin);
      if (ok) setDevolucionQtys(prev => ({ ...prev, [action.item.id]: '' }));
      return ok;
    }
    const ok = await handleDevolucion(lastSaleId, pin);
    if (ok) setShowDevolucionItems(false);
    return ok;
  };

  // Con un solo usuario se ejecuta directo (sin pedir PIN). Con 2+ usuarios se
  // pide el PIN de un admin/encargado para autorizar.
  const requestAction = (action) => {
    if (singleUser) runAction(action, '');
    else setPendingAction(action);
  };

  const onPinConfirm = async (pin) => {
    if (!pendingAction) return false;
    const ok = await runAction(pendingAction, pin);
    if (ok) setPendingAction(null);
    return ok;
  };

  return (
    <>
      <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={() => setShowDevolucionItems(false)}>
        <div className={`modal-content${closing ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
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
                  <button onClick={() => requestAction({ type: 'item', item })}
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
        onConfirm={() => { setShowVoidConfirm(false); requestAction({ type: 'void' }); }}
        title="¿Anular venta completa?"
        message="Se revertirá toda la venta seleccionada y los productos volverán al inventario. Esta acción no se puede deshacer."
        confirmLabel="Sí, anular todo"
        variant="danger"
      />
      {pendingAction && (
        <SupervisorPinModal
          onClose={() => setPendingAction(null)}
          onConfirm={onPinConfirm}
          title={pendingAction.type === 'void' ? 'Anular venta — autorización' : 'Devolver ítem — autorización'}
        />
      )}
    </>
  );
}


import { apiPost } from '../../services/apiClient';
import useModalExit from '../../hooks/useModalExit';

export default function CancelConfirmModal({ isCancelConfirm, setIsCancelConfirm, clearCart, cart, adjustedTotal, total, currentOperator }) {
  const { rendered, closing } = useModalExit(isCancelConfirm);
  if (!rendered) return null;
  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={() => setIsCancelConfirm(false)}><div className={`modal-content${closing ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
      <h2 className="modal-title" style={{ color: 'var(--accent-danger)' }}>¿Anular Venta?</h2>
      <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '32px' }}>Se vaciará el carrito y se perderán los productos escaneados.</p>
      <div className="modal-actions">
        <button className="btn btn-modal-cancel" onClick={() => setIsCancelConfirm(false)}>NO (Esc)</button>
        <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-danger)' }} onClick={() => {
          if (cart.length >= 3) {
            apiPost('/audit', { action: `Venta anulada por ${currentOperator?.name || 'Cajero'}: $${(adjustedTotal ?? total).toLocaleString('es-AR')} (${cart.length} items)`, operator: currentOperator?.name || 'Sistema' }).catch(() => {});
          }
          clearCart();
          setIsCancelConfirm(false);
        }}>SÍ, ANULAR</button>
      </div>
    </div></div>
  );
}

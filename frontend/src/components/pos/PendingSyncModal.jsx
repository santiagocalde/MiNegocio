import { useState } from 'react';
import ConfirmModal from '../ui/ConfirmModal';

function PendingSyncModal({ showPendingModal, setShowPendingModal, getPendingData, handleManualSync, setPendingSync, addToast }) {
  const [showConfirm, setShowConfirm] = useState(false);
  if (!showPendingModal) return null;
  const data = getPendingData();
  return (
    <>
      <div className="modal-overlay" onClick={() => setShowPendingModal(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <h2 className="modal-title" style={{ fontSize: '1.5rem' }}>⏳ Ventas pendientes de enviar al servidor</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}><span> Cantidad</span><span style={{ fontWeight: 800, fontSize: '1.5rem' }}>{data.count}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}><span> Monto total</span>             <span style={{ fontWeight: 800, fontSize: '1.5rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>${(data.total || 0).toLocaleString('es-AR')}</span></div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-danger-small" onClick={() => setShowConfirm(true)} style={{ marginRight: '12px' }}>🗑️ Borrar pendientes</button>
            <button className="btn btn-modal-cancel" onClick={() => setShowPendingModal(false)}>Cerrar</button>
            <button className="btn btn-modal-confirm" onClick={handleManualSync} style={{ background: 'var(--accent-primary)' }}>Reintentar ahora</button>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => { localStorage.removeItem('minegocio_pending_sales'); setPendingSync(0); setShowPendingModal(false); setShowConfirm(false); addToast('Pendientes borrados.', 'info'); }}
        title="¿Borrar ventas pendientes?"
        message="Se eliminarán todos los registros de ventas offline no sincronizados. Esta acción no se puede deshacer."
        confirmLabel="Sí, borrar todo"
        variant="danger"
      />
    </>
  );
}

export default PendingSyncModal;

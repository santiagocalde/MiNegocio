import React from 'react';

function ExpiryAlertsModal({ showExpiryAlerts, setShowExpiryAlerts, expiryAlerts }) {
  if (!showExpiryAlerts || !expiryAlerts) return null;
  return (
    <div className="modal-overlay" onClick={() => setShowExpiryAlerts(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title" style={{ color: 'var(--accent-danger)' }}>📅 ¡Alerta de Vencimiento!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Productos próximos a vencer o ya vencidos:</p>
        <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(30,58,95,0.2)', padding: '12px', borderRadius: '8px' }}>
          {expiryAlerts.expired?.map(p => <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', color:'var(--accent-danger)' }}><span>{p.name}</span><strong>VENCIDO ({p.expiry_date})</strong></div>)}
          {expiryAlerts.expiring_soon?.map(p => <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', color:'var(--accent-warning)' }}><span>{p.name}</span><span>Vence: {p.expiry_date}</span></div>)}
        </div>
        <div className="modal-actions" style={{ marginTop: '20px' }}><button className="btn btn-modal-confirm" onClick={() => setShowExpiryAlerts(false)}>Entendido</button></div>
      </div>
    </div>
  );
}

export default ExpiryAlertsModal;

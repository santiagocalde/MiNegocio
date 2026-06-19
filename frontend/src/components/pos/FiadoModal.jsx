import React, { useState } from 'react';

export default function FiadoModal({ isFiadoOpen, setIsFiadoOpen, adjustedTotal, total, fiadoName, setFiadoName, fiadoRef, confirmFiado }) {
  const [fiadoAmount, setFiadoAmount] = useState('');
  const maxFiado = adjustedTotal ?? total;
  
  if (!isFiadoOpen) return null;
  
  const handleConfirm = () => {
    confirmFiado(fiadoAmount ? parseFloat(fiadoAmount) : maxFiado);
  };
  
  return (
    <div className="modal-overlay" onKeyDown={e => { if (e.key === 'Escape') { setIsFiadoOpen(false); setFiadoName(''); } if (e.key === 'Enter' && fiadoName) handleConfirm(); }}><div className="modal-content">
      <h2 className="modal-title">Vender Fiado</h2>
      <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>Total del carrito: <strong style={{ color: 'var(--accent-warning)', fontSize: '1.5rem' }}>${maxFiado.toLocaleString('es-AR')}</strong></p>
      <div className="input-group">
        <label>Monto a fiar (vacío = total)</label>
        <input type="number" min="0" step="1" placeholder={`$${maxFiado}`}
          value={fiadoAmount} onChange={e => setFiadoAmount(e.target.value)}
          style={{ fontSize: '1.5rem', fontFamily: 'var(--font-mono)', textAlign: 'center' }} />
      </div>
      <div className="input-group">
        <label>Nombre del cliente</label>
        <input ref={fiadoRef} type="text" list="fiado-names" placeholder="Ej: Doña María"
          value={fiadoName} onChange={e => setFiadoName(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && fiadoName) handleConfirm(); }}
          style={{ fontSize: '1.5rem', fontFamily: 'var(--font-main)', textAlign: 'left' }} />
        <datalist id="fiado-names" />
      </div>
      <div className="modal-actions">
        <button className="btn btn-modal-cancel" onClick={() => { setIsFiadoOpen(false); setFiadoName(''); setFiadoAmount(''); }}>Cancelar (Esc)</button>
        <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-warning)', color: 'black', opacity: !fiadoName ? 0.5 : 1 }} onClick={handleConfirm} disabled={!fiadoName}>Guardar en Libreta</button>
      </div>
    </div></div>
  );
}

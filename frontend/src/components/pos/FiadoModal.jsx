import React from 'react';

export default function FiadoModal({ isFiadoOpen, setIsFiadoOpen, adjustedTotal, total, fiadoName, setFiadoName, fiadoRef, confirmFiado }) {
  if (!isFiadoOpen) return null;
  return (
    <div className="modal-overlay"><div className="modal-content">
      <h2 className="modal-title">Vender Fiado</h2>
      <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>Monto a anotar: <strong style={{ color: 'var(--accent-warning)', fontSize: '1.5rem' }}>${(adjustedTotal ?? total).toLocaleString('es-AR')}</strong></p>
      <div className="input-group">
        <label>Nombre del cliente</label>
        <input ref={fiadoRef} type="text" list="fiado-names" placeholder="Ej: Doña María"
          value={fiadoName} onChange={e => setFiadoName(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') confirmFiado(); }}
          style={{ fontSize: '1.5rem', fontFamily: 'var(--font-main)', textAlign: 'left' }} />
        <datalist id="fiado-names" />
      </div>
      <div className="modal-actions">
        <button className="btn btn-modal-cancel" onClick={() => { setIsFiadoOpen(false); setFiadoName(''); }}>Cancelar (Esc)</button>
        <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-warning)', color: 'black', opacity: !fiadoName ? 0.5 : 1 }} onClick={confirmFiado} disabled={!fiadoName}>Guardar en Libreta (Enter)</button>
      </div>
    </div></div>
  );
}

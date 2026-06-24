import React, { useState } from 'react';

export default function FiadoModal({ isFiadoOpen, setIsFiadoOpen, adjustedTotal, total, fiadoName, setFiadoName, fiadoRef, confirmFiado, customers }) {
  const [fiadoAmount, setFiadoAmount] = useState('');
  const maxFiado = adjustedTotal ?? total;
  const manualMode = !maxFiado || maxFiado <= 0;

  if (!isFiadoOpen) return null;

  const handleConfirm = () => {
    confirmFiado(fiadoAmount ? parseFloat(fiadoAmount) : maxFiado);
  };

  return (
    <div className="modal-overlay" onKeyDown={e => { if (e.key === 'Escape') { setIsFiadoOpen(false); setFiadoName(''); } if (e.key === 'Enter' && fiadoName) handleConfirm(); }}><div className="modal-content">
      <h2 className="modal-title">{manualMode ? 'Anotar Deuda' : 'Vender Fiado'}</h2>
      {manualMode
        ? <p style={{ textAlign: 'center', fontSize: '1rem', marginBottom: '16px', color: 'var(--text-secondary)' }}>Sin productos en el carrito. Anotá cuánto te debe el cliente.</p>
        : <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>Total del carrito: <strong style={{ color: 'var(--accent-warning)', fontSize: '1.5rem' }}>${maxFiado.toLocaleString('es-AR')}</strong></p>
      }
      <div className="input-group">
        <label>{manualMode ? 'Monto que debe' : 'Monto a fiar (vacío = total)'}</label>
        <input type="number" min="0" step="1" placeholder={manualMode ? 'Ej: 5000' : `$${maxFiado}`}
          value={fiadoAmount} onChange={e => setFiadoAmount(e.target.value)}
          autoFocus={manualMode}
          style={{ fontSize: '1.5rem', fontFamily: 'var(--font-mono)', textAlign: 'center' }} />
      </div>
      <div className="input-group">
        <label>Nombre del cliente</label>
        <input ref={fiadoRef} type="text" list="fiado-names" placeholder="Ej: Doña María"
          value={fiadoName} onChange={e => setFiadoName(e.target.value)} autoFocus={!manualMode}
          onKeyDown={e => { if (e.key === 'Enter' && fiadoName) handleConfirm(); }}
          style={{ fontSize: '1.5rem', fontFamily: 'var(--font-main)', textAlign: 'left' }} />
        <datalist id="fiado-names">
          {customers?.map(c => <option key={c.id} value={c.name} />)}
        </datalist>
      </div>
      <div className="modal-actions">
        <button className="btn btn-modal-cancel" onClick={() => { setIsFiadoOpen(false); setFiadoName(''); setFiadoAmount(''); }}>Cancelar (Esc)</button>
        <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-warning)', color: 'black', opacity: !fiadoName ? 0.5 : 1 }} onClick={handleConfirm} disabled={!fiadoName}>Guardar en Libreta</button>
      </div>
    </div></div>
  );
}

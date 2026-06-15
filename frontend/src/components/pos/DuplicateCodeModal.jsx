import React from 'react';

function DuplicateCodeModal({ showDuplicateCodeModal, setShowDuplicateCodeModal, duplicateCodeMatches, setDuplicateCodeMatches, setCart, playBeep, searchRef }) {
  if (!showDuplicateCodeModal) return null;
  return (
    <div className="modal-overlay" onClick={() => setShowDuplicateCodeModal(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
        <h2 className="modal-title" style={{ color: 'var(--accent-warning)', fontSize: '1.4rem' }}>⚠️ Código de Barras Duplicado</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '16px' }}>¿Cuál querés agregar?</p>
        {duplicateCodeMatches.map((p, idx) => (
          <button key={p.id} autoFocus={idx === 0} onClick={() => {
            setCart(prev => { const ex = prev.find(item => item.id === p.id); if (ex) return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item); return [...prev, { ...p, qty: 1 }]; });
            playBeep(); setShowDuplicateCodeModal(false); setDuplicateCodeMatches([]); searchRef.current?.focus();
          }} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontWeight: 600, marginBottom: '8px' }}>
            <span>{p.name}</span><span style={{ color: 'var(--accent-success)', fontWeight: 800 }}>${p.price.toLocaleString('es-AR')}</span>
          </button>
        ))}
        <div className="modal-actions"><button className="btn btn-modal-cancel" onClick={() => { setShowDuplicateCodeModal(false); setDuplicateCodeMatches([]); searchRef.current?.focus(); }}>Cancelar</button></div>
      </div>
    </div>
  );
}

export default DuplicateCodeModal;

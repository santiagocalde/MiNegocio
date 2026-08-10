import React, { useState } from 'react';
import CameraBarcodeScanner from '../ui/CameraBarcodeScanner';

function PriceCheckModal({ showPriceCheck, setShowPriceCheck, priceCheckQuery, setPriceCheckQuery, priceCheckResults, setPriceCheckResults, productsDB, onAddToCart }) {
  const [showScanner, setShowScanner] = useState(false);

  React.useEffect(() => {
    if (!showPriceCheck || !priceCheckQuery.trim()) {
      setPriceCheckResults([]);
      return;
    }
    const qLower = priceCheckQuery.toLowerCase();
    const qWords = qLower.split(' ').filter(Boolean);
    const filtered = productsDB?.filter(p => {
      const n = p.name?.toLowerCase() || '';
      const c = p.code?.toLowerCase() || '';
      const cat = p.category_name?.toLowerCase() || '';
      return qWords.every(w => n.includes(w) || c.includes(w) || cat.includes(w));
    }) || [];
    setPriceCheckResults(filtered.slice(0, 30));
  }, [priceCheckQuery, showPriceCheck, productsDB, setPriceCheckResults]);

  const closeModal = () => { setShowPriceCheck(false); setPriceCheckQuery(''); setPriceCheckResults([]); };

  if (!showPriceCheck) return null;
  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem' }}>Consultar Precio</h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input type="text" value={priceCheckQuery} onChange={e => setPriceCheckQuery(e.target.value)}
            placeholder="Buscá por nombre o código..." autoFocus style={{ flex: 1, background: 'var(--bg-main)', border: '2px solid var(--border-focus)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', fontSize: '1.1rem', outline: 'none' }} />
          <button onClick={() => setShowScanner(true)} title="Escanear con cámara"
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.background = 'var(--wash-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
        </div>
        {showScanner && (
          <CameraBarcodeScanner
            onScan={(code) => { setPriceCheckQuery(code); setShowScanner(false); }}
            onClose={() => setShowScanner(false)}
          />
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {priceCheckResults.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px' }}>
              {priceCheckQuery ? 'Sin resultados' : 'Escribí un nombre o código'}
            </p>
          ) : (
            priceCheckResults.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px', marginBottom: '8px', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Código: {p.code}</div>
                  <div style={{ fontSize: '0.8rem', color: p.stock > 0 ? 'var(--text-secondary)' : 'var(--accent-danger)', marginTop: '2px' }}>Stock: {p.stock}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>${p.price?.toLocaleString('es-AR')}</div>
                  {onAddToCart && (
                    <button
                      onClick={() => { onAddToCart(p); closeModal(); }}
                      style={{ marginTop: '6px', background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      + Agregar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button className="btn btn-modal-confirm" onClick={closeModal}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default PriceCheckModal;

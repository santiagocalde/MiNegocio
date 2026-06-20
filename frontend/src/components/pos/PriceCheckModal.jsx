import React from 'react';

function PriceCheckModal({ showPriceCheck, setShowPriceCheck, priceCheckQuery, setPriceCheckQuery, priceCheckResults, setPriceCheckResults, productsDB, onAddToCart }) {
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
      return qWords.every(w => n.includes(w) || c.includes(w));
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
        </div>
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

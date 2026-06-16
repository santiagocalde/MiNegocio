import React from 'react';
import { apiGet } from '../../services/apiClient';

function PriceCheckModal({ showPriceCheck, setShowPriceCheck, priceCheckQuery, setPriceCheckQuery, priceCheckResults, setPriceCheckResults, productsDB }) {
  React.useEffect(() => {
    if (!showPriceCheck || !priceCheckQuery.trim()) {
      setPriceCheckResults([]);
      return;
    }
    const qLower = priceCheckQuery.toLowerCase();
    const filtered = productsDB?.filter(p => p.name?.toLowerCase().includes(qLower) || p.code?.toLowerCase().includes(qLower)) || [];
    setPriceCheckResults(filtered.slice(0, 30));
  }, [priceCheckQuery, showPriceCheck, productsDB, setPriceCheckResults]);

  if (!showPriceCheck) return null;
  return (
    <div className="modal-overlay" onClick={() => { setShowPriceCheck(false); setPriceCheckQuery(''); setPriceCheckResults([]); }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem' }}>🔍 Consultar Precio</h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input type="text" value={priceCheckQuery} onChange={e => setPriceCheckQuery(e.target.value)}
            placeholder="Buscá por nombre o código..." autoFocus style={{ flex: 1, background: 'var(--bg-main)', border: '2px solid var(--border-focus)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', fontSize: '1.1rem', outline: 'none' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {priceCheckResults.length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px' }}>{priceCheckQuery ? 'Sin resultados' : 'Escribí un nombre o código y presioná Enter'}</p> : (
            priceCheckResults.map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px', marginBottom: '8px' }}>
              <div><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Código: {p.code}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>${p.price?.toLocaleString('es-AR')}</div>
                <div style={{ fontSize: '0.85rem', color: p.stock > 0 ? 'var(--text-secondary)' : 'var(--accent-danger)' }}>Stock: {p.stock}</div></div>
            </div>)
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: '16px' }}><button className="btn btn-modal-confirm" onClick={() => { setShowPriceCheck(false); setPriceCheckQuery(''); setPriceCheckResults([]); }}>Cerrar</button></div>
      </div>
    </div>
  );
}

export default PriceCheckModal;

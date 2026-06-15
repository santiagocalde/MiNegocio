import React from 'react';

export default function StockAlertsModal({ stockAlerts, setStockAlerts }) {
  if (!stockAlerts || !((stockAlerts.stock?.total > 0 || stockAlerts.margin?.total > 0))) return null;
  return (
    <div className="modal-overlay" onClick={() => setStockAlerts(null)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <h2 className="modal-title" style={{ color: 'var(--accent-warning)' }}>⚠️ ¡Alertas Importantes del Negocio!</h2>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {stockAlerts.stock?.total > 0 && (<div style={{ marginBottom: '24px' }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.1rem' }}>📦 Stock Crítico</h3>
            <div style={{ background: 'rgba(30,58,95,0.2)', padding: '12px', borderRadius: '8px' }}>
              {stockAlerts.stock.empty?.map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--accent-danger)' }}><span>{p.name}</span><strong>SIN STOCK</strong></div>)}
              {stockAlerts.stock.low?.map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--accent-warning)' }}><span>{p.name}</span><span>Bajo Mínimo ({p.stock} de {p.min_stock})</span></div>)}
            </div>
          </div>)}
          {stockAlerts.margin?.total > 0 && (<div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.1rem' }}>💰 Alertas de Rentabilidad</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>Productos que estás vendiendo a pérdida.</p>
            <div style={{ background: 'rgba(30,58,95,0.2)', padding: '12px', borderRadius: '8px' }}>
              {stockAlerts.margin.no_cost?.map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--accent-danger)' }}><span>{p.name}</span><strong>COSTO $0</strong></div>)}
              {stockAlerts.margin.low_margin?.map(p => { const margin = ((p.price - p.cost_price) / p.cost_price * 100).toFixed(1); return <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--accent-warning)' }}><span>{p.name}</span><span>Margen muy bajo ({margin}%)</span></div>; })}
            </div>
          </div>)}
        </div>
        <div className="modal-actions" style={{ marginTop: '20px' }}><button className="btn btn-modal-confirm" onClick={() => setStockAlerts(null)}>Entendido</button></div>
      </div>
    </div>
  );
}

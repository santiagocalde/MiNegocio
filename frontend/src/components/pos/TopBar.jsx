import React from 'react';

export default function TopBar({ currentOperator, sucursales, currentSucursalId, setCurrentSucursalId, backendStatus, addToast, setShowHelp }) {
  const isCashier = currentOperator?.role === 'cashier' || currentOperator?.role === 'employee';

  return (
    <header className="topbar" style={{ padding: '16px 24px 0 24px', background: 'transparent', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="topbar-title">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Punto de Venta</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>Sistema POS - {currentOperator?.name || 'Dueño'}</span>
        </div>

        {sucursales.length > 1 && !isCashier && (
          <select value={currentSucursalId} onChange={e => setCurrentSucursalId(parseInt(e.target.value))}
            style={{ marginLeft: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            {sucursales.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
          </select>
        )}
      </div>
      <div className="status-indicators" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button onClick={() => setShowHelp?.(true)} style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.05)'} onMouseLeave={e=>e.target.style.background='transparent'}>
          Ayuda
        </button>

        {backendStatus?.status === 'ok' ? (
          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, marginLeft: '8px' }}>
            <span style={{ background: '#10B981', boxShadow: '0 0 10px #10B981', marginRight: '8px', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
            Conectado
          </span>
        ) : (
          <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, marginLeft: '8px' }}>
            <span style={{ background: '#EF4444', boxShadow: '0 0 10px #EF4444', marginRight: '8px', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
            Sin conexion
          </span>
        )}

        {(() => {
          const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true' || localStorage.getItem('saas_mode') === 'true';
          if (isPreview) {
            return (
              <button onClick={() => { localStorage.removeItem('saas_token'); localStorage.removeItem('saas_mode'); window.location.href = '/'; }} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Salir de Preview
              </button>
            );
          }
          return (
            <button onClick={() => { localStorage.removeItem('saas_token'); window.location.href = '/'; }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
               Cerrar Sesión
            </button>
          );
        })()}
      </div>
    </header>
  );
}

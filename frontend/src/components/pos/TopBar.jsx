import useIsMobile from '../../hooks/useIsMobile';

export default function TopBar({ currentOperator, sucursales, currentSucursalId, setCurrentSucursalId, backendStatus, setShowHelp }) {
  const isCashier = currentOperator?.role === 'cashier' || currentOperator?.role === 'employee';
  const isMobile = useIsMobile();

  return (
    <header className="topbar" style={{ padding: isMobile ? '10px 14px 0 14px' : '16px 24px 0 24px', background: 'transparent', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <div className="topbar-title">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: isMobile ? '1.15rem' : '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{isMobile ? 'Vender' : 'Punto de Venta'}</span>
          {/* Subtítulo redundante en mobile: el operador ya está en Mi Caja */}
          {!isMobile && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>Sistema POS - {currentOperator?.name || 'Dueño'}</span>
          )}
        </div>

        {sucursales.length > 1 && !isCashier && (
          <select value={currentSucursalId} onChange={e => setCurrentSucursalId(parseInt(e.target.value))}
            style={{ marginLeft: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            {sucursales.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
          </select>
        )}
      </div>
      <div className="status-indicators" style={{ display: 'flex', gap: isMobile ? '8px' : '12px', alignItems: 'center' }}>
        <button onClick={() => setShowHelp?.(true)} title="Ayuda" style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: isMobile ? '8px 12px' : '10px 16px', borderRadius: '8px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          {isMobile ? '?' : 'Ayuda'}
        </button>

        {/* En mobile, el estado de conexión es solo el puntito (verde/rojo) */}
        {backendStatus?.status === 'ok' ? (
          <span title="Conectado" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: isMobile ? '8px' : '6px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ background: 'var(--accent-success)', boxShadow: '0 0 10px var(--accent-success)', marginRight: isMobile ? 0 : '8px', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
            {!isMobile && 'Conectado'}
          </span>
        ) : (
          <span title="Sin conexión" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: isMobile ? '8px' : '6px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ background: 'var(--accent-danger)', boxShadow: '0 0 10px var(--accent-danger)', marginRight: isMobile ? 0 : '8px', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
            {!isMobile && 'Sin conexion'}
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
            <button onClick={() => { localStorage.removeItem('saas_token'); window.location.href = '/'; }} title="Cerrar Sesión" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-secondary)', padding: isMobile ? '8px 12px' : '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
               {isMobile ? 'Salir' : 'Cerrar Sesión'}
            </button>
          );
        })()}
      </div>
    </header>
  );
}

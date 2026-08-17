
import useIsMobile from '../../hooks/useIsMobile';

export default function TopBar({ currentOperator, sucursales, currentSucursalId, setCurrentSucursalId, canSwitchOperator = false, onSwitchOperator }) {
  const isCashier = currentOperator?.role === 'cashier' || currentOperator?.role === 'employee';
  const isMobile = useIsMobile();

  // En mobile la topbar ocupa mucho espacio vertical — la reducimos a una línea compacta.
  if (isMobile) {
    return (
      <header style={{ padding: '6px 10px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 8 }}>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Punto de Venta</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canSwitchOperator && (
            <button onClick={onSwitchOperator} title="Cambiar operador"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              👤 {currentOperator?.name || 'Operador'}
            </button>
          )}
          {sucursales.length > 1 && !isCashier && (
            <select value={currentSucursalId} onChange={e => setCurrentSucursalId(parseInt(e.target.value))}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
              {sucursales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="topbar" style={{ padding: '16px 24px 0 24px', background: 'transparent', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="topbar-title">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Punto de Venta</span>
          {canSwitchOperator ? (
            <button onClick={onSwitchOperator} title="Cambiar operador"
              style={{ background: 'none', border: 'none', padding: 0, marginTop: '2px', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textAlign: 'left' }}>
              👤 {currentOperator?.name || 'Dueño'} <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>· cambiar</span>
            </button>
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>Sistema POS - {currentOperator?.name || 'Dueño'}</span>
          )}
        </div>
        {sucursales.length > 1 && !isCashier && (
          <select value={currentSucursalId} onChange={e => setCurrentSucursalId(parseInt(e.target.value))}
            style={{ marginLeft: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
    </header>
  );
}

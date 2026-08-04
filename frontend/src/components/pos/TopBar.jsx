export default function TopBar({ currentOperator, sucursales, currentSucursalId, setCurrentSucursalId }) {
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
    </header>
  );
}

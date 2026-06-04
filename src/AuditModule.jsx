import React, { useState, useEffect } from 'react';

export default function AuditModule({ serverUrl, addToast, products }) {
  const [movements, setMovements] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [reverting, setReverting] = useState(null);

  useEffect(() => {
    fetchMovements();
    fetchSales();
  }, []);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const [movRes, egrRes] = await Promise.all([
        fetch(`${serverUrl}/movements?limit=100`),
        fetch(`${serverUrl}/egresos`)
      ]);
      const movData = await movRes.json();
      const egrData = await egrRes.json();

      const formattedEgresos = egrData.map(e => ({
        id: `egr-${e.id}`,
        movement_type: 'egreso',
        timestamp: e.timestamp,
        product_name: 'RETIRO EFECTIVO',
        quantity: e.monto,
        reason: e.motivo,
        operator: e.operator
      }));

      const combined = [...movData, ...formattedEgresos].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      setMovements(combined);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      const res = await fetch(`${serverUrl}/sales?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setSales(data);
      }
    } catch {}
  };

  const handleRevert = async (saleId) => {
    if (!confirm('¿Estás seguro de anular esta venta? El stock se revertirá.')) return;
    setReverting(saleId);
    try {
      const res = await fetch(`${serverUrl}/sales/${saleId}/revert`, { method: 'PATCH' });
      if (res.ok) {
        if (addToast) addToast('Venta anulada y stock revertido correctamente.', 'success');
        fetchSales();
      } else {
        const data = await res.json();
        if (addToast) addToast(data.detail || 'Error al anular la venta.', 'error');
      }
    } catch {
      if (addToast) addToast('No se pudo conectar con el servidor.', 'error');
    } finally {
      setReverting(null);
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'entrada':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)' };
      case 'salida':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'price_change':
        return { background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.2)' };
      case 'egreso':
        return { background: 'rgba(234, 179, 8, 0.15)', color: '#EAB308', border: '1px solid rgba(234, 179, 8, 0.2)' };
      default:
        return { background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.2)' };
    }
  };

  const translateType = (type) => {
    switch (type) {
      case 'entrada': return '📥 Entrada Stock';
      case 'salida': return '📤 Salida (Venta)';
      case 'price_change': return '📈 Cambio Precio';
      case 'egreso': return '💸 Egreso Caja';
      default: return '⚙️ Ajuste';
    }
  };

  const filtered = movements.filter(m => {
    const matchesFilter = filterType === 'all' || m.movement_type === filterType;
    const matchesSearch = m.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.reason && m.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.operator && m.operator.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="module-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div className="module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>🔍 Módulo de Auditoría</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Historial de movimientos de stock, cambios de precios y ajustes manuales.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchMovements} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
          🔄 Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-bar" style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            border: '2px solid var(--border-focus)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: '1.2rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <option value="all">🔍 Todos los tipos</option>
          <option value="entrada">📥 Entradas de Stock</option>
          <option value="salida">📤 Salidas (Ventas)</option>
          <option value="price_change">📈 Cambios de Precio</option>
          <option value="ajuste">⚙️ Ajustes Manuales</option>
          <option value="egreso">💸 Egresos de Caja</option>
        </select>
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por producto, motivo u operador..."
            className="search-input"
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '2px solid var(--border-focus)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '1.2rem'
            }}
          />
          {searchTerm.trim().length > 0 && products && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              {products.filter(p => p.code.startsWith(searchTerm) || p.name.toLowerCase().startsWith(searchTerm.toLowerCase())).slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSearchTerm(p.name)}
                  style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                  onFocus={e => e.target.style.background = 'var(--bg-hover)'}
                  onBlur={e => e.target.style.background = 'transparent'}
                  onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="table-wrapper" style={{ borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-focus)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
            Cargando historial de auditoría...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
            No se encontraron movimientos registrados con los filtros aplicados.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-focus)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 24px' }}>Tipo</th>
                <th style={{ padding: '16px 24px' }}>Fecha</th>
                <th style={{ padding: '16px 24px' }}>Producto</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Cant.</th>
                <th style={{ padding: '16px 24px' }}>Detalles / Motivo</th>
                <th style={{ padding: '16px 24px' }}>Operador</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-focus)', transition: 'background 0.2s' }} className="table-row">
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      ...getBadgeStyle(m.movement_type)
                    }}>
                      {translateType(m.movement_type)}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {m.timestamp}
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {m.product_name}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: m.movement_type === 'entrada' ? '#10B981' : (m.movement_type === 'salida' || m.movement_type === 'egreso' ? '#EF4444' : 'var(--text-secondary)') }}>
                    {m.movement_type === 'price_change' ? '-' : (m.movement_type === 'entrada' ? `+${m.quantity}` : (m.movement_type === 'egreso' ? `-$${m.quantity}` : `-${m.quantity}`))}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {m.reason || '-'}
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {m.operator || 'Sistema'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ventas recientes */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>🛒 Ventas Recientes</h3>
        <div className="table-wrapper" style={{ borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-focus)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-focus)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 24px' }}>ID</th>
                <th style={{ padding: '16px 24px' }}>Hora</th>
                <th style={{ padding: '16px 24px' }}>Cliente</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '16px 24px' }}>Estado</th>
                <th style={{ padding: '16px 24px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-focus)', opacity: s.reverted ? 0.5 : 1 }} className="table-row">
                  <td style={{ padding: '16px 24px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>#{s.id}</td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {new Date(s.timestamp).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: 600 }}>{s.fiado_name || (s.is_fiado ? 'Fiado' : 'Mostrador')}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    ${s.total.toLocaleString('es-AR')}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {s.reverted ? (
                      <span style={{ color: 'var(--accent-danger)', fontWeight: 600, fontSize: '0.85rem' }}>❌ Anulada</span>
                    ) : (
                      <span style={{ color: 'var(--accent-success)', fontWeight: 600, fontSize: '0.85rem' }}>✅ Activa</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {!s.reverted && (
                      <button
                        onClick={() => handleRevert(s.id)}
                        disabled={reverting === s.id}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: 'var(--accent-danger)', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: reverting === s.id ? 0.6 : 1 }}
                      >
                        {reverting === s.id ? '...' : '↩️ Anular'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay ventas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

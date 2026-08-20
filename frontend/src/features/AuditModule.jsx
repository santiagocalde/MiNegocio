import { useState, useEffect } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet } from '../services/apiClient';
import FeatureGate from '../components/ui/FeatureGate';

const PLAN_WEIGHT = { trial: 1, simple: 1, pro: 2, ia: 3 };

const Icons = {
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Refresh: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Filter: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
};

export default function AuditModule() {
  const { addToast, currentPlan, plan } = usePanelContext();
  // Esperar a que el plan esté cargado antes de bloquear (evita falso-positivo con caché vieja)
  const planLoaded = plan?.planLoaded ?? true;
  const isLocked = planLoaded && PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT['pro'];
  const [movements, setMovements] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchMovements = async () => {
    if (isLocked) {
      setMovements([
        { id: 'mock-1', movement_type: 'salida', timestamp: new Date().toISOString(), product_name: 'Coca Cola 2L', quantity: 2, operator: 'Admin' },
        { id: 'mock-2', movement_type: 'entrada', timestamp: new Date(Date.now() - 3600000).toISOString(), product_name: 'Alfajor Jorgito', quantity: 50, operator: 'Admin', reason: 'Compra a proveedor' },
        { id: 'mock-3', movement_type: 'egreso', timestamp: new Date(Date.now() - 7200000).toISOString(), product_name: 'RETIRO EFECTIVO CAJA', quantity: 1500, operator: 'Admin', reason: 'Pago al diariero' },
        { id: 'mock-4', movement_type: 'price_change', timestamp: new Date(Date.now() - 86400000).toISOString(), product_name: 'Yerba Playadito 1kg', quantity: 0, operator: 'Sistema', reason: 'Aumento 15%' },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch en paralelo: movimientos de stock + egresos de caja + actividad de negocio
      const [movRes, egrRes, actRes] = await Promise.allSettled([
        apiGet('/movements?limit=100'),
        apiGet('/egresos'),
        apiGet('/activity?limit=100'),
      ]);

      // Movimientos de stock
      let movList = [];
      if (movRes.status === 'fulfilled' && movRes.value.ok) {
        const movData = await movRes.value.json();
        movList = Array.isArray(movData) ? movData : (movData?.movements || []);
      }

      // Egresos de caja
      let formattedEgresos = [];
      if (egrRes.status === 'fulfilled' && egrRes.value.ok) {
        const rawEgr = await egrRes.value.json();
        const egrData = Array.isArray(rawEgr) ? rawEgr : (rawEgr?.egresos || []);
        formattedEgresos = egrData.map(e => ({
          id: `egr-${e.id}`,
          movement_type: 'egreso',
          timestamp: e.timestamp,
          product_name: 'RETIRO EFECTIVO CAJA',
          quantity: e.monto,
          reason: e.motivo,
          operator: e.operator,
        }));
      }

      // Actividad de negocio (remitos, presupuestos, acopios, ventas)
      // Excluimos sale_created porque las ventas ya aparecen como movimientos de stock
      let formattedActivity = [];
      if (actRes.status === 'fulfilled' && actRes.value.ok) {
        const actData = await actRes.value.json();
        formattedActivity = (Array.isArray(actData) ? actData : [])
          .filter(e => e.action !== 'sale_created') // evitar duplicado con /movements
          .map(e => ({
            id: `act-${e.id}`,
            movement_type: 'event',
            timestamp: e.timestamp,
            product_name: e.label,
            quantity: null,
            reason: e.details,
            operator: e.operator || 'Sistema',
            tone: e.tone,
          }));
      }

      const combined = [...movList, ...formattedEgresos, ...formattedActivity].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      setMovements(combined);
    } catch (e) {
      console.error('fetchMovements failed:', e);
      if (addToast) addToast('Sin internet. Verificá tu conexión e intentá de nuevo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getBadgeStyle = (type, tone) => {
    if (type === 'event') {
      if (tone === 'accent-success') return { background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.3)' };
      return { background: 'rgba(20,187,166,0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(20,187,166,0.3)' };
    }
    switch (type) {
      case 'entrada': return { background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.3)' };
      case 'salida': return { background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)' };
      case 'price_change': return { background: 'rgba(20,187,166, 0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(20,187,166, 0.3)' };
      case 'egreso': return { background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-warning)', border: '1px solid rgba(245, 158, 11, 0.3)' };
      default: return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' };
    }
  };

  const translateType = (type) => {
    switch (type) {
      case 'entrada': return 'Ingreso Stock';
      case 'salida': return 'Venta';
      case 'price_change': return 'Cambio Precio';
      case 'egreso': return 'Retiro Caja';
      case 'event': return 'Negocio';
      default: return 'Ajuste';
    }
  };

  const filtered = movements.filter(m => {
    const matchesFilter = filterType === 'all' || m.movement_type === filterType;
    const name = m.product_name || '';
    const reason = m.reason || '';
    const operator = m.operator || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operator.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <FeatureGate isLocked={isLocked} requiredPlan="Pro">
      <div style={{ padding: '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>

      {/* HEADER COMPARTIDO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexShrink: 0 }}>
        <div>
          <div className="ledger-label">Todo lo que pasó</div>
          <h1 className="ledger-title" style={{ fontSize: '1.6rem', marginTop: 4 }}>Historial</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={fetchMovements} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}>
            <Icons.Refresh /> Actualizar
          </button>
        </div>
      </div>

      {/* SEARCH BAR FULL WIDTH */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ width: '250px' }}>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">Todos los movimientos</option>
            <option value="event">Actividad del negocio</option>
            <option value="salida">Ventas (Salidas)</option>
            <option value="entrada">Ingresos de Stock</option>
            <option value="price_change">Cambios de Precio</option>
            <option value="egreso">Retiros de Caja</option>
            <option value="ajuste">Ajustes Manuales</option>
          </select>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
          <input 
            type="text" 
            placeholder="Buscar por producto, motivo u operador..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px 12px 48px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
          />
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="ledger-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Registro de Actividad</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Listado cronológico de acciones en el sistema</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(m => {
              const isExpanded = expandedId === m.id;
              const detail = m.reason || m.details || null;
              const clickable = !!detail;
              return (
              <div key={m.id} style={{ borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateX(4px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '16px 24px', cursor: clickable ? 'pointer' : 'default' }}
                  onClick={() => clickable && setExpandedId(isExpanded ? null : m.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                    <div style={{ width: '130px', flexShrink: 0 }}>
                      <span style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', ...getBadgeStyle(m.movement_type, m.tone) }}>
                        {translateType(m.movement_type)}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '2px' }}>
                        {m.product_name}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: detail ? '4px' : 0 }}>
                        {m.timestamp ? new Date(m.timestamp).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '---'}{m.operator && m.operator !== 'Sistema' ? ` • ${m.operator}` : ''}
                      </div>
                      {detail && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                          {detail}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <div style={{ width: '120px', textAlign: 'right' }}>
                      {m.movement_type !== 'event' && (
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: m.movement_type === 'entrada' ? 'var(--accent-success)' : (m.movement_type === 'salida' || m.movement_type === 'egreso' ? 'var(--accent-danger)' : 'var(--text-primary)') }}>
                          {m.movement_type === 'price_change' ? '—' : (m.movement_type === 'entrada' ? `+${m.quantity ?? 0}` : (m.movement_type === 'egreso' ? (m.quantity != null ? `-$${Math.abs(Number(m.quantity)).toLocaleString('es-AR')}` : '—') : `-${m.quantity ?? 0}`))}
                        </span>
                      )}
                    </div>
                    {clickable && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', transition: 'transform 0.15s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    )}
                  </div>
                </div>
                {/* Detalle expandido — cualquier tipo con datos */}
                {isExpanded && detail && (
                  <div style={{ background: m.movement_type === 'egreso' ? 'rgba(245,158,11,0.06)' : 'rgba(20,187,166,0.04)', borderTop: '1px solid var(--border-color)', padding: '14px 24px 14px 174px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                    {m.movement_type === 'egreso' && (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4 }}>Monto retirado</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>
                          {m.quantity != null ? `$${Number(m.quantity).toLocaleString('es-AR')}` : '—'}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {m.movement_type === 'egreso' ? 'Motivo' : 'Detalle'}
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 480, wordBreak: 'break-word' }}>{detail}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4 }}>Operador</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.operator || '—'}</div>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            {filtered.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>No hay movimientos registrados.</div>
            )}
            {loading && (
              <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>Cargando actividad...</div>
            )}
          </div>
        </div>
      </div>
      </div>
    </FeatureGate>
  );
}

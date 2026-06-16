import React, { useState, useEffect } from 'react';
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
  const { addToast, backend } = usePanelContext();
  const currentPlan = backend.businessConfig?.plan || 'trial';
  const isLocked = PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT['pro'];
  const [movements, setMovements] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovements();
  }, []);

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
      const movRes = await apiGet('/movements?limit=100');
      if (!movRes.ok) throw new Error('Error de movimientos');
      const movData = await movRes.json();
      
      let egrData = [];
      try {
        const egrRes = await apiGet('/egresos');
        if (egrRes.ok) {
          const rawEgr = await egrRes.json();
          egrData = Array.isArray(rawEgr) ? rawEgr : (rawEgr?.egresos || []);
        }
      } catch (e) {
        console.warn('Endpoint de egresos no disponible, ignorando...');
      }

      const formattedEgresos = egrData.map(e => ({
        id: `egr-${e.id}`,
        movement_type: 'egreso',
        timestamp: e.timestamp,
        product_name: 'RETIRO EFECTIVO CAJA',
        quantity: e.monto,
        reason: e.motivo,
        operator: e.operator
      }));

      const movList = Array.isArray(movData) ? movData : (movData?.movements || []);
      const combined = [...movList, ...formattedEgresos].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      setMovements(combined);
    } catch (e) {
      console.error('fetchMovements failed:', e);
      const msg = e.message === 'Error de movimientos'
        ? 'Error al cargar movimientos del servidor.'
        : 'Error de conexion. Verifica que el servidor este corriendo.';
      if (addToast) addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeStyle = (type) => {
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
      default: return 'Ajuste';
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
    <FeatureGate isLocked={isLocked} requiredPlan="Pro">
      <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* HEADER COMPARTIDO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Auditoría</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Historial de movimientos, cambios de precio y retiros de caja.</p>
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
            <option value="entrada">Ingresos de Stock</option>
            <option value="salida">Ventas (Salidas)</option>
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
      <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Registro de Actividad</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Listado cronológico de acciones en el sistema</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='translateX(4px)'} onMouseLeave={e => e.currentTarget.style.transform='none'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                  <div style={{ width: '120px' }}>
                    <span style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', ...getBadgeStyle(m.movement_type) }}>
                      {translateType(m.movement_type)}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '4px' }}>
                      {m.product_name}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(m.timestamp).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} • Operador: {m.operator || 'Sistema'}
                    </div>
                  </div>
                  <div style={{ flex: 1, color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '0 16px' }}>
                    {m.reason ? `Motivo: ${m.reason}` : ''}
                  </div>
                </div>
                <div style={{ width: '150px', textAlign: 'right' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: m.movement_type === 'entrada' ? 'var(--accent-success)' : (m.movement_type === 'salida' || m.movement_type === 'egreso' ? 'var(--accent-danger)' : 'var(--text-primary)') }}>
                    {m.movement_type === 'price_change' ? '-' : (m.movement_type === 'entrada' ? `+${m.quantity}` : (m.movement_type === 'egreso' ? `-$${m.quantity}` : `-${m.quantity}`))}
                  </span>
                </div>
              </div>
            ))}
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

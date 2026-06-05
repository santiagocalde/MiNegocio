import React, { useState, useEffect } from 'react';

const Icons = {
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  User: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  ChevronDown: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>,
  AlertCircle: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Check: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
};

export default function FiadoModule({ serverUrl, addToast }) {
  const [fiados, setFiados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cobrando, setCobrando] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFiados = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/sales/fiado`);
      if (res.ok) {
        const data = await res.json();
        setFiados(data);
      }
    } catch {
      setFiados([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiados(); }, []);

  const pendientes = fiados.filter(f => !f.cobrado);
  const now = new Date();
  const treintaDias = 30 * 24 * 60 * 60 * 1000;
  
  const grouped = pendientes.reduce((acc, f) => {
    if (!acc[f.fiado_name]) acc[f.fiado_name] = [];
    acc[f.fiado_name].push(f);
    return acc;
  }, {});

  const marcarCobrado = async (id, e) => {
    e.stopPropagation();
    setCobrando(id);
    try {
      const res = await fetch(`${serverUrl}/sales/${id}/cobrar-fiado`, { method: 'PATCH' });
      if (res.ok) {
        setFiados(prev => prev.map(f => f.id === id ? { ...f, cobrado: true } : f));
        addToast?.('Deuda marcada como cobrada exitosamente.', 'success');
      } else {
        addToast?.('Error al cobrar. Reintentá.', 'error');
      }
    } catch {
      addToast?.('Error de conexión.', 'error');
    }
    setCobrando(null);
  };

  const totalDeuda = pendientes.reduce((acc, f) => acc + f.total, 0);
  const clientesVencidos = Object.entries(grouped).filter(([_, sales]) => sales.some(s => now - new Date(s.timestamp) > treintaDias)).length;

  const filteredGroups = Object.entries(grouped).filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Clientes y Cuentas</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Gestión de libretas, fiados y cuentas corrientes.</p>
        </div>
      </div>

      {/* METRICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px', flexShrink: 0 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
           <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Deuda Total Pendiente</div>
           <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-warning)', fontFamily: 'var(--font-mono)' }}>${totalDeuda.toLocaleString('es-AR')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
           <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Clientes Activos</div>
           <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{Object.keys(grouped).length}</div>
        </div>
        <div style={{ background: clientesVencidos > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)', border: clientesVencidos > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
           <div style={{ color: clientesVencidos > 0 ? 'var(--accent-danger)' : 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {clientesVencidos > 0 && <Icons.AlertCircle />} Cuentas Vencidas (+30 días)
           </div>
           <div style={{ fontSize: '2.5rem', fontWeight: 800, color: clientesVencidos > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{clientesVencidos}</div>
        </div>
      </div>

      {/* BUSCADOR */}
      <div style={{ position: 'relative', marginBottom: '24px', flexShrink: 0 }}>
        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
        <input 
          type="text" 
          placeholder="Buscar cliente por nombre..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '12px', fontSize: '1rem', outline: 'none' }} 
        />
      </div>

      {/* LISTA DE CLIENTES */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px' }}>Cargando datos de clientes...</div>}
        
        {!loading && filteredGroups.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            No hay clientes con deuda activa o que coincidan con la búsqueda.
          </div>
        )}

        {!loading && filteredGroups.map(([name, sales]) => {
          const totalCliente = sales.reduce((acc, s) => acc + s.total, 0);
          const isExpanded = expandedClient === name;
          const tieneVencidos = sales.some(s => now - new Date(s.timestamp) > treintaDias);

          return (
            <div key={name} style={{ background: 'var(--bg-card)', border: tieneVencidos ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.2s' }}>
              <div 
                onClick={() => setExpandedClient(isExpanded ? null : name)}
                style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <Icons.User />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {name} {tieneVencidos && <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>MOROSO</span>}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{sales.length} comprobante{sales.length !== 1 ? 's' : ''} pendiente{sales.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '2px' }}>Saldo Deudor</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 800, color: tieneVencidos ? 'var(--accent-danger)' : 'var(--accent-warning)' }}>${totalCliente.toLocaleString('es-AR')}</div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '16px 24px' }}>Fecha</th>
                        <th style={{ padding: '16px 24px' }}>ID Ticket</th>
                        <th style={{ padding: '16px 24px' }}>Monto</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map(s => {
                        const isVencido = now - new Date(s.timestamp) > treintaDias;
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '16px 24px', color: isVencido ? 'var(--accent-danger)' : 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
                              {new Date(s.timestamp).toLocaleDateString('es-AR')}
                              {isVencido && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--accent-danger)' }}>(Vencido)</span>}
                            </td>
                            <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>#{s.id}</td>
                            <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>${s.total.toLocaleString('es-AR')}</td>
                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                              <button
                                onClick={(e) => marcarCobrado(s.id, e)}
                                disabled={cobrando === s.id}
                                style={{ background: 'var(--gradient-success)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: cobrando === s.id ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                {cobrando === s.id ? '...' : <><Icons.Check /> Saldar</>}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

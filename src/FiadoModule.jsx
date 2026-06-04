import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8000/api';

export default function FiadoModule() {
  const [fiados, setFiados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cobrando, setCobrando] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);

  const fetchFiados = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/sales/fiado`);
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
  const cobrados = fiados.filter(f => f.cobrado);

  const grouped = pendientes.reduce((acc, f) => {
    if (!acc[f.fiado_name]) acc[f.fiado_name] = [];
    acc[f.fiado_name].push(f);
    return acc;
  }, {});

  const cobradosGrouped = cobrados.reduce((acc, f) => {
    if (!acc[f.fiado_name]) acc[f.fiado_name] = [];
    acc[f.fiado_name].push(f);
    return acc;
  }, {});

  const marcarCobrado = async (id) => {
    setCobrando(id);
    try {
      await fetch(`${API}/sales/${id}/cobrar-fiado`, { method: 'PATCH' });
    } catch {}
    setFiados(prev => prev.map(f => f.id === id ? { ...f, cobrado: true } : f));
    setCobrando(null);
  };

  const totalDeuda = pendientes.reduce((acc, f) => acc + f.total, 0);

  const clientCardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    overflow: 'hidden',
  };

  const clientHeaderStyle = (isExpanded) => ({
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
    transition: 'background 0.2s',
  });

  const purchaseItemStyle = {
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-color)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>📒 Libreta de Fiado</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Agrupado por cliente</p>

        {totalDeuda > 0 && (
          <div style={{ marginTop: '16px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '10px', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--accent-warning)', fontWeight: 700, fontSize: '1rem' }}>⚠️ DEUDA TOTAL PENDIENTE</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>{Object.keys(grouped).length} cliente{Object.keys(grouped).length !== 1 ? 's' : ''} deben plata</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent-warning)' }}>
              ${totalDeuda.toLocaleString('es-AR')}
            </div>
          </div>
        )}
        {totalDeuda === 0 && !loading && (
          <div style={{ marginTop: '16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '16px 24px', color: 'var(--accent-success)', fontWeight: 700 }}>
            ✅ Nadie debe nada. La libreta está limpia.
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px' }}>Cargando libreta...</div>}

        {!loading && pendientes.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px', fontSize: '1.2rem' }}>
            📒 No hay fiados pendientes
          </div>
        )}

        {!loading && Object.entries(grouped).map(([name, sales]) => {
          const totalCliente = sales.reduce((acc, s) => acc + s.total, 0);
          const lastDate = new Date(Math.max(...sales.map(s => new Date(s.timestamp))));
          const isExpanded = expandedClient === name;

          return (
            <div key={name} style={clientCardStyle}>
              <div
                style={clientHeaderStyle(isExpanded)}
                onClick={() => setExpandedClient(isExpanded ? null : name)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{name}</div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.85rem' }}>
                    {sales.length} compra{sales.length !== 1 ? 's' : ''} · Última: {lastDate.toLocaleDateString('es-AR')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-warning)' }}>
                    ${totalCliente.toLocaleString('es-AR')}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </div>
              </div>

              {isExpanded && sales.map(s => (
                <div key={s.id} style={purchaseItemStyle}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {new Date(s.timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-warning)' }}>
                    ${s.total.toLocaleString('es-AR')}
                  </div>
                  <button
                    onClick={() => marcarCobrado(s.id)}
                    disabled={cobrando === s.id}
                    style={{
                      background: 'var(--accent-success)', border: 'none', borderRadius: '8px',
                      color: 'white', fontWeight: 700, fontSize: '0.9rem', padding: '10px 20px',
                      cursor: 'pointer', opacity: cobrando === s.id ? 0.6 : 1,
                    }}
                  >
                    {cobrando === s.id ? '...' : '✓ COBRADO'}
                  </button>
                </div>
              ))}
            </div>
          );
        })}

        {!loading && Object.keys(cobradosGrouped).length > 0 && (
          <>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              ✅ Ya cobrados
            </div>
            {Object.entries(cobradosGrouped).map(([name, sales]) => (
              <div key={name} style={{
                background: 'transparent', border: '1px solid var(--border-color)',
                borderRadius: '12px', padding: '16px 24px', opacity: 0.5,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)' }}>{name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                  ${sales.reduce((acc, s) => acc + s.total, 0).toLocaleString('es-AR')} ({sales.length} compra{sales.length !== 1 ? 's' : ''})
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

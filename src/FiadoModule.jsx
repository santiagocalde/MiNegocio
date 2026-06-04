import React, { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:8000/api';

export default function FiadoModule() {
  const [fiados, setFiados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cobrando, setCobrando] = useState(null); // sale_id siendo cobrado

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

  const totalDeuda = fiados.filter(f => !f.cobrado).reduce((acc, f) => acc + f.total, 0);

  const marcarCobrado = async (id) => {
    setCobrando(id);
    try {
      await fetch(`${API}/sales/${id}/cobrar-fiado`, { method: 'PATCH' });
    } catch { /* offline: update local */ }
    setFiados(prev => prev.map(f => f.id === id ? { ...f, cobrado: true } : f));
    setCobrando(null);
  };

  const pendientes = fiados.filter(f => !f.cobrado);
  const cobrados = fiados.filter(f => f.cobrado);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>📒 Libreta de Fiado</h2>
        <p style={{ color: 'var(--text-secondary)' }}>El cuaderno digital. Sin complicaciones.</p>

        {totalDeuda > 0 && (
          <div style={{ marginTop: '16px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '10px', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'var(--accent-warning)', fontWeight: 700, fontSize: '1rem' }}>⚠️ DEUDA TOTAL PENDIENTE</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>{pendientes.length} cliente{pendientes.length !== 1 ? 's' : ''} deben plata</div>
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

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px' }}>Cargando libreta...</div>}

        {!loading && pendientes.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px', fontSize: '1.2rem' }}>
            📒 No hay fiados pendientes
          </div>
        )}

        {pendientes.map(f => (
          <div key={f.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '12px', padding: '20px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{f.fiado_name}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
                {new Date(f.timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent-warning)' }}>
                ${f.total.toLocaleString('es-AR')}
              </div>
              <button
                onClick={() => marcarCobrado(f.id)}
                disabled={cobrando === f.id}
                style={{
                  background: 'var(--accent-success)', border: 'none', borderRadius: '10px',
                  color: 'white', fontWeight: 800, fontSize: '1.1rem', padding: '14px 24px',
                  cursor: 'pointer', opacity: cobrando === f.id ? 0.6 : 1,
                }}
              >
                {cobrando === f.id ? '...' : '✓ COBRADO'}
              </button>
            </div>
          </div>
        ))}

        {cobrados.length > 0 && (
          <>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              ✅ Cobrados hoy ({cobrados.length})
            </div>
            {cobrados.map(f => (
              <div key={f.id} style={{
                background: 'transparent', border: '1px solid var(--border-color)',
                borderRadius: '12px', padding: '16px 24px', opacity: 0.5,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)' }}>{f.fiado_name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>${f.total.toLocaleString('es-AR')}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

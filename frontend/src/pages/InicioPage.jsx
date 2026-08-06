import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelContext } from '../context/PanelContext';
import { Icons } from '../components/ui/Icons';
import { formatMoney } from '../utils/format';
import { apiGet } from '../services/apiClient';

function ResumenIA() {
  const [texto, setTexto] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const cargar = React.useCallback(() => {
    setLoading(true);
    setError('');
    apiGet('/ai/resumen')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setTexto(d.texto || ''))
      .catch(() => setError('No se pudo generar el resumen ahora. Probá de nuevo en un rato.'))
      .finally(() => setLoading(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={{ background: 'var(--wash-primary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '18px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-primary)', color: 'var(--bg-card)', padding: '3px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 800 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            IA
          </span>
          Tu resumen del día
        </div>
        <button onClick={cargar} disabled={loading} title="Actualizar" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--accent-primary)', borderRadius: 8, padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Pensando…' : '↻ Actualizar'}
        </button>
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Analizando las ventas de hoy…</div>
      ) : error ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{error}</div>
      ) : (
        <p style={{ color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>{texto}</p>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '18px 22px 20px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      {/* Hairline de acento — firma sobria, ecoa el renglón de la landing */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, opacity: 0.9 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ color, opacity: 0.85 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', marginTop: 10, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ color: 'var(--text-faint)', fontSize: '0.82rem', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function InicioPage() {
  const navigate = useNavigate();
  const { backend, auth, currentPlan } = usePanelContext();

  // Reloj liviano: refresca saludo y fecha cada minuto (cubre el paso día→tarde→noche)
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const r = backend.resumenData || {};
  const vendido = r.total_vendido ?? ((r.total_efectivo || 0) + (r.total_tarjeta || 0) + (r.total_transferencia || 0) + (r.total_mp || 0) + (r.total_fiado || 0));
  const tickets = r.total_tickets || 0;
  const efectivo = r.total_efectivo || 0;
  const fiado = r.total_fiado || 0;
  const promedio = tickets > 0 ? vendido / tickets : 0;

  const operador = auth.currentOperator?.name || 'Dueño';
  const negocio = backend.businessConfig?.nombre || 'tu negocio';
  const hora = now.getHours();
  const saludoHora = hora < 12 ? 'buen día' : hora < 20 ? 'buenas tardes' : 'buenas noches';
  const hoy = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const sa = backend.stockAlerts?.stock || {};
  const porAgotarse = [
    ...(sa.empty || []).map(p => ({ ...p, estado: 'SIN STOCK', danger: true })),
    ...(sa.low || []).map(p => ({ ...p, estado: `Quedan ${p.stock}`, danger: false })),
  ].slice(0, 6);

  return (
    <div style={{ padding: '24px 24px 32px', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Saludo */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Hola {operador}, {saludoHora}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '5px 0 0', textTransform: 'capitalize' }}>{hoy} · {negocio}</p>
      </div>

      {/* Resumen del día con IA (solo Plan IA) */}
      {currentPlan === 'ia' && <ResumenIA />}

      {/* Números del día */}
      <div data-tour="inicio-stats" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard label="Ventas de hoy" value={formatMoney(vendido)} sub={`${tickets} ${tickets === 1 ? 'venta' : 'ventas'}`} color="var(--accent-success)" icon={<Icons.Chart />} />
        <StatCard label="Efectivo en caja" value={formatMoney(efectivo)} sub="Lo que entró en mano" color="var(--accent-primary)" icon={<Icons.ShoppingCart />} />
        <StatCard label="Fiado de hoy" value={formatMoney(fiado)} sub="Anotado en cuentas" color="var(--accent-warning)" icon={<Icons.Book />} />
        <StatCard label="Ticket promedio" value={formatMoney(promedio)} sub="Por venta" color="var(--text-primary)" icon={<Icons.Tag />} />
      </div>

      {/* CTA + Por agotarse */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Ir a vender */}
        <div data-tour="inicio-vender" style={{ flex: '1 1 280px', background: 'var(--gradient-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>¿Arrancamos a vender?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '6px 0 0' }}>Escaneá un código o buscá un producto. El vuelto se calcula solo.</p>
          </div>
          <button onClick={() => navigate('/panel/ventas')} style={{ background: 'var(--gradient-primary)', color: '#fff', border: 'none', padding: '16px', borderRadius: 12, fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--shadow-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'transform 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <Icons.ShoppingCart /> Ir a vender
          </button>
        </div>

        {/* Productos por agotarse */}
        <div data-tour="inicio-stock" style={{ flex: '1 1 320px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Por agotarse</h2>
            <button
              onClick={() => navigate('/panel/inventario')}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >Ver inventario →</button>
          </div>
          {porAgotarse.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', padding: '20px 0', textAlign: 'center' }}>
              Todo en orden. No hay productos por agotarse. ✅
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {porAgotarse.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'var(--surface-veil)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{p.name}</span>
                  <span style={{ color: p.danger ? 'var(--accent-danger)' : 'var(--accent-warning)', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{p.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

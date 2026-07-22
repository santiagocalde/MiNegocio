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

  React.useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(20,187,166,0.06))', border: '1px solid rgba(165,180,252,0.25)', borderRadius: 16, padding: '18px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c4b5fd', fontWeight: 800, fontSize: '0.92rem' }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Tu resumen del día con IA
        </div>
        <button onClick={cargar} disabled={loading} title="Actualizar" style={{ background: 'transparent', border: '1px solid rgba(165,180,252,0.3)', color: '#c4b5fd', borderRadius: 8, padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
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
    <div style={{ flex: 1, minWidth: 200, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
        <div style={{ color, opacity: 0.85 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, fontFamily: 'var(--font-mono)', marginTop: 8, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>{sub}</div>}
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
    <div style={{ padding: '20px 24px', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Saludo */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
          Hola {operador}, {saludoHora}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 0', textTransform: 'capitalize' }}>{hoy} · {negocio}</p>
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
        <div data-tour="inicio-vender" style={{ flex: '1 1 280px', background: 'var(--gradient-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>¿Arrancamos a vender?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '6px 0 0' }}>Escaneá un código o buscá un producto. El vuelto se calcula solo.</p>
          </div>
          <button onClick={() => navigate('/panel/ventas')} style={{ background: 'var(--gradient-primary)', color: '#fff', border: 'none', padding: '16px', borderRadius: 12, fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(20,187,166,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icons.ShoppingCart /> Ir a vender
          </button>
        </div>

        {/* Productos por agotarse */}
        <div data-tour="inicio-stock" style={{ flex: '1 1 320px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Por agotarse</h2>
            <button onClick={() => navigate('/panel/inventario')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Ver inventario →</button>
          </div>
          {porAgotarse.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', padding: '20px 0', textAlign: 'center' }}>
              Todo en orden. No hay productos por agotarse. ✅
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {porAgotarse.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{p.name}</span>
                  <span style={{ color: p.danger ? 'var(--accent-danger)' : 'var(--accent-warning)', fontSize: '0.78rem', fontWeight: 700 }}>{p.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

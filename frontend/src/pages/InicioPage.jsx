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
    <div className="ledger-sheet" style={{ padding: '16px 20px', marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-primary)', color: 'var(--sheet)', padding: '2px 7px', borderRadius: 3, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.08em' }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            IA
          </span>
          <span className="ledger-label">Nota del día</span>
        </div>
        <button onClick={cargar} disabled={loading} title="Actualizar" style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.78rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Pensando…' : 'Actualizar'}
        </button>
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Analizando las ventas de hoy…</div>
      ) : error ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{error}</div>
      ) : (
        <p style={{ color: 'var(--text-primary)', fontSize: '1.02rem', lineHeight: 1.65, margin: 0, fontFamily: 'var(--font-display)', fontWeight: 500 }}>{texto}</p>
      )}
    </div>
  );
}

// Renglón del libro: etiqueta + descriptor a la izquierda, cifra mono a la derecha.
function LedgerLine({ label, hint, value, tone }) {
  return (
    <div className="ledger-row">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
        {hint && <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>{hint}</span>}
      </div>
      <span className="ledger-num" style={{ fontSize: '1.35rem', fontWeight: 700, color: tone || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

// ── Widget: Pendientes de cobro (solo corralón) ──────────────────
function PendientesCobro({ navigate }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const fmt = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      apiGet('/quotes?status=approved&limit=100').then(r => r.ok ? r.json() : []),
      apiGet('/remitos?status=delivered&limit=100').then(r => r.ok ? r.json() : []),
    ]).then(([quotes, remitos]) => {
      if (!alive) return;
      setData({ quotes, remitos });
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return null;
  if (!data) return null;

  const totalQuotes = data.quotes.reduce((s, q) => s + (q.total || 0), 0);
  const countQ = data.quotes.length;
  const countR = data.remitos.length;
  const total = countQ + countR;
  if (total === 0) return null; // nada pendiente, no ocupar espacio

  return (
    <div className="ledger-sheet" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid var(--rule-strong)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ledger-title" style={{ fontSize: '1rem', margin: 0 }}>Pendientes de cobro</h2>
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-warning)', background: 'var(--wash-warning)', padding: '3px 10px', borderRadius: 20 }}>
          {total} {total === 1 ? 'item' : 'items'}
        </span>
      </div>

      {countQ > 0 && (
        <div className="ledger-row" style={{ padding: '11px 18px', cursor: 'pointer' }}
          onClick={() => navigate('/panel/presupuestos')}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,187,166,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {countQ} presupuesto{countQ !== 1 ? 's' : ''} aprobado{countQ !== 1 ? 's' : ''}
            </div>
            <div className="ledger-label" style={{ fontSize: '0.74rem', marginTop: 2 }}>Esperan factura o nota de pedido</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            {totalQuotes > 0 && <span className="ledger-num" style={{ color: 'var(--accent-primary)', fontSize: '0.95rem', fontWeight: 800 }}>${fmt(totalQuotes)}</span>}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Ver →</span>
          </div>
        </div>
      )}

      {countR > 0 && (
        <div className="ledger-row" style={{ padding: '11px 18px', cursor: 'pointer' }}
          onClick={() => navigate('/panel/remitos')}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,187,166,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {countR} entrega{countR !== 1 ? 's' : ''} sin cobrar
            </div>
            <div className="ledger-label" style={{ fontSize: '0.74rem', marginTop: 2 }}>Notas entregadas, cobro pendiente</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Ver →</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Widget: Actividad reciente (historial de movimientos) ──────
function ActividadReciente() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const fmtTime = (s) => {
    if (!s) return '';
    const d = new Date(s);
    const hoy = new Date();
    const esHoy = d.toDateString() === hoy.toDateString();
    if (esHoy) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  React.useEffect(() => {
    let alive = true;
    apiGet('/activity?limit=20')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (alive) { setItems(Array.isArray(d) ? d : []); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <div className="ledger-sheet" style={{ marginBottom: 18 }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--rule-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1rem' }}>🕐</span>
          <h2 className="ledger-title" style={{ fontSize: '1rem', margin: 0 }}>Actividad reciente</h2>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Últimos movimientos</span>
      </div>
      {items.slice(0, 15).map((it, i) => (
        <div key={it.id || i} className="ledger-row" style={{ padding: '10px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {it.label}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.details}
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12 }}>
            {fmtTime(it.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function InicioPage() {
  const navigate = useNavigate();
  const { backend, auth, currentPlan, businessType } = usePanelContext();

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
  const saludoHora = hora < 12 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  const hoy = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const sa = backend.stockAlerts?.stock || {};
  const porAgotarse = [
    ...(sa.empty || []).map(p => ({ ...p, estado: 'Sin stock', danger: true })),
    ...(sa.low || []).map(p => ({ ...p, estado: `Quedan ${p.stock}`, danger: false })),
  ].slice(0, 7);

  return (
    <div style={{ padding: '26px 28px 36px', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box', maxWidth: 1120 }}>
      {/* Encabezado editorial */}
      <div style={{ marginBottom: 22 }}>
        <div className="ledger-label" style={{ textTransform: 'uppercase' }}>{hoy}</div>
        <h1 className="ledger-title" style={{ fontSize: '1.9rem', marginTop: 6 }}>
          {saludoHora}, {operador}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: '4px 0 0' }}>{negocio}</p>
      </div>

      {currentPlan === 'ia' && <ResumenIA />}
      {businessType === 'corralon' && <PendientesCobro navigate={navigate} />}
      <ActividadReciente />

      {/* Cuerpo: dos columnas — el libro del día + acciones/stock */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* Hoja: Movimiento de hoy */}
        <div className="ledger-sheet">
          {/* Cabecera con la cifra protagonista */}
          <div style={{ padding: '20px 22px 18px', borderBottom: '1px solid var(--rule-strong)' }}>
            <div className="ledger-label">Ventas de hoy</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.9rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{formatMoney(vendido)}</span>
              <span style={{ color: 'var(--text-faint)', fontSize: '0.88rem', fontWeight: 600 }}>
                {tickets} {tickets === 1 ? 'venta' : 'ventas'} · promedio <span className="ledger-num">{formatMoney(promedio)}</span>
              </span>
            </div>
          </div>
          {/* Renglones del día */}
          <LedgerLine label="Efectivo en caja" hint="Lo que entró en mano" value={formatMoney(efectivo)} tone="var(--accent-success)" />
          <LedgerLine label="Fiado de hoy" hint="Anotado en cuentas" value={formatMoney(fiado)} tone="var(--accent-warning)" />
          <LedgerLine label="Ticket promedio" hint="Por venta" value={formatMoney(promedio)} />
        </div>

        {/* Columna derecha: acción + por agotarse */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Acción principal — el único acento sólido */}
          <div className="ledger-sheet" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h2 className="ledger-title" style={{ fontSize: '1.1rem' }}>¿Arrancamos a vender?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: '5px 0 0' }}>Escaneá o buscá un producto. El vuelto se calcula solo.</p>
            </div>
            <button onClick={() => navigate('/panel/ventas')} style={{ background: 'var(--accent-primary)', color: 'var(--sheet)', border: 'none', padding: '15px', borderRadius: 'var(--radius-sm)', fontSize: '1.02rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'filter 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}>
              <Icons.ShoppingCart /> Ir a vender
            </button>
          </div>

          {/* Por agotarse — lista reglada */}
          <div className="ledger-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--rule-strong)' }}>
              <h2 className="ledger-title" style={{ fontSize: '1rem' }}>Por agotarse</h2>
              <button
                onClick={() => navigate('/panel/inventario')}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >Inventario →</button>
            </div>
            {porAgotarse.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', padding: '22px 18px', textAlign: 'center' }}>
                Todo en orden. Nada por agotarse.
              </div>
            ) : (
              porAgotarse.map(p => (
                <div key={p.id} className="ledger-row" style={{ padding: '11px 18px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '58%' }}>{p.name}</span>
                  <span className="ledger-label" style={{ color: p.danger ? 'var(--accent-danger)' : 'var(--accent-warning)', letterSpacing: '0.06em' }}>{p.estado}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

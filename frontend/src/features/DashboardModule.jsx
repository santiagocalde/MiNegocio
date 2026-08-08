/**
 * DashboardModule — Tablero de control para administradores.
 * Muestra: ventas del mes, deudores vencidos, proveedores con deuda,
 * productos más vendidos y productos bajos en stock.
 * Estética ledger-sheet (igual que ClientesModule / FiadoModule).
 */
import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../services/apiClient';

const fmt = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (s) => {
  if (!s) return 'Sin actividad';
  const d = new Date(s);
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return `Hace ${dias} días`;
};

function StatCard({ label, value, sub, tone }) {
  return (
    <div className="ledger-sheet" style={{
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: 'var(--shadow-sm)',
      minHeight: 96,
    }}>
      <span className="ledger-label">{label}</span>
      <span style={{
        fontFamily: 'var(--lp-font-display)',
        fontSize: '2.1rem',
        fontWeight: 800,
        color: tone || 'var(--text-primary)',
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}>{value}</span>
      {sub && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</span>}
    </div>
  );
}

export default function DashboardModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const now = new Date();
  const mesNombre = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/dashboard/summary');
      if (res.ok) {
        setData(await res.json());
      } else {
        setError('No se pudo cargar el dashboard.');
      }
    } catch {
      setError('Sin conexión con el servidor.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: '32px 28px', color: 'var(--lp-ink-faint)' }}>Cargando tablero...</div>
  );
  if (error) return (
    <div style={{ padding: '32px 28px', color: 'var(--lp-ink-faint)' }}>{error}</div>
  );

  const d = data || {};

  return (
    <div style={{ padding: '20px 24px 36px', maxWidth: 1100, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>

      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexShrink: 0 }}>
        <div>
          <div className="ledger-label" style={{ textTransform: 'uppercase' }}>Tablero de control</div>
          <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--lp-ink)', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            {mesNombre}
          </h2>
        </div>
        <button onClick={load} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.82rem', padding: '7px 16px' }}>
          Actualizar
        </button>
      </div>

      {/* ── Fila de stats — siempre 2 cols en panel, 4 en pantallas anchas ── */}
      <style>{`.dash-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:22px}@media(min-width:900px){.dash-stats{grid-template-columns:repeat(4,1fr)}}`}</style>
      <div className="dash-stats">
        <StatCard
          label={`Ventas ${mesNombre}`}
          value={`$${fmt(d.ventas_mes)}`}
          sub={`${d.tickets_mes} ${d.tickets_mes === 1 ? 'venta' : 'ventas'} este mes`}
          tone="var(--accent-success)"
        />
        <StatCard
          label="Deudores vencidos (+20 días)"
          value={d.deudores_vencidos?.length || 0}
          sub={d.deudores_vencidos?.length > 0
            ? `$${fmt(d.deudores_vencidos.reduce((s, c) => s + (c.balance || 0), 0))} en total`
            : 'Todo al día'}
          tone={d.deudores_vencidos?.length > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}
        />
        <StatCard
          label="Proveedores con deuda (+15 días)"
          value={d.proveedores_deuda?.length || 0}
          sub={d.proveedores_deuda?.length > 0
            ? `$${fmt(d.proveedores_deuda.reduce((s, p) => s + (p.debt || 0), 0))} en total`
            : 'Sin deuda vencida'}
          tone={d.proveedores_deuda?.length > 0 ? 'var(--accent-warning)' : 'var(--accent-success)'}
        />
        <StatCard
          label="Productos bajos en stock"
          value={d.low_stock?.length || 0}
          sub={d.low_stock?.length > 0 ? 'Requieren reposición' : 'Stock en orden'}
          tone={d.low_stock?.length > 0 ? 'var(--accent-warning)' : 'var(--accent-success)'}
        />
      </div>

      {/* ── Dos columnas inferiores ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}
        className="dash-bottom-grid">
        <style>{`.dash-bottom-grid>div>.ledger-sheet{box-shadow:var(--shadow-sm)}@media(max-width:700px){.dash-bottom-grid{grid-template-columns:1fr!important}}`}</style>

        {/* Columna izq */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Top productos */}
          <div className="ledger-sheet">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="ledger-title" style={{ fontSize: '0.95rem', margin: 0 }}>Más vendidos este mes</h3>
              <span className="ledger-label">unidades · total</span>
            </div>
            {(d.top_products || []).length === 0 ? (
              <div style={{ padding: '20px 18px', color: 'var(--lp-ink-faint)', fontSize: '0.85rem' }}>Sin ventas registradas este mes.</div>
            ) : (d.top_products || []).map((p, i) => (
              <div key={i} className="ledger-row" style={{ padding: '11px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: i === 0 ? 'var(--accent-primary)' : 'var(--lp-ink-faint)',
                    minWidth: 18,
                    textAlign: 'right',
                  }}>#{i + 1}</span>
                  <span style={{ fontWeight: 600, color: 'var(--lp-ink)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
                  <span className="ledger-num" style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)' }}>
                    {fmt(p.qty_vendida)} u.
                  </span>
                  <span className="ledger-num" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-success)' }}>
                    ${fmt(p.total_vendido)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bajos en stock */}
          <div className="ledger-sheet">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="ledger-title" style={{ fontSize: '0.95rem', margin: 0 }}>Bajos en stock</h3>
              <span className="ledger-label">stock · mínimo</span>
            </div>
            {(d.low_stock || []).length === 0 ? (
              <div style={{ padding: '20px 18px', color: 'var(--lp-ink-faint)', fontSize: '0.85rem' }}>Todo en orden.</div>
            ) : (d.low_stock || []).map((p, i) => (
              <div key={i} className="ledger-row" style={{ padding: '11px 18px' }}>
                <span style={{ fontWeight: 600, color: 'var(--lp-ink)', fontSize: '0.88rem', flex: 1 }}>{p.name}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                  <span className="ledger-num" style={{ fontWeight: 800, color: p.stock === 0 ? 'var(--accent-danger)' : 'var(--accent-warning)', fontSize: '0.9rem' }}>
                    {p.stock === 0 ? 'Sin stock' : `${p.stock} u.`}
                  </span>
                  {p.min_stock > 0 && (
                    <span className="ledger-label" style={{ color: 'var(--lp-ink-faint)' }}>
                      mín. {p.min_stock}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Columna der */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Deudores vencidos */}
          <div className="ledger-sheet">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="ledger-title" style={{ fontSize: '0.95rem', margin: 0 }}>Deudores +20 días</h3>
              <span className="ledger-label">último movimiento · saldo</span>
            </div>
            {(d.deudores_vencidos || []).length === 0 ? (
              <div style={{ padding: '20px 18px', color: 'var(--lp-ink-faint)', fontSize: '0.85rem' }}>Sin clientes vencidos.</div>
            ) : (d.deudores_vencidos || []).map((c, i) => (
              <div key={i} className="ledger-row" style={{ padding: '11px 18px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </div>
                  <div className="ledger-label" style={{ marginTop: 2 }}>
                    {fmtDate(c.ultimo_movimiento)}{c.phone ? ` · ${c.phone}` : ''}
                  </div>
                </div>
                <span className="ledger-num" style={{ fontWeight: 800, color: 'var(--accent-danger)', fontSize: '0.9rem', flexShrink: 0, marginLeft: 12 }}>
                  ${fmt(c.balance)}
                </span>
              </div>
            ))}
          </div>

          {/* Proveedores con deuda */}
          <div className="ledger-sheet">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="ledger-title" style={{ fontSize: '0.95rem', margin: 0 }}>Proveedores +15 días</h3>
              <span className="ledger-label">última compra · deuda</span>
            </div>
            {(d.proveedores_deuda || []).length === 0 ? (
              <div style={{ padding: '20px 18px', color: 'var(--lp-ink-faint)', fontSize: '0.85rem' }}>Sin deuda pendiente con proveedores.</div>
            ) : (d.proveedores_deuda || []).map((p, i) => (
              <div key={i} className="ledger-row" style={{ padding: '11px 18px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div className="ledger-label" style={{ marginTop: 2 }}>
                    {fmtDate(p.ultima_compra)}{p.phone ? ` · ${p.phone}` : ''}
                  </div>
                </div>
                <span className="ledger-num" style={{ fontWeight: 800, color: 'var(--accent-warning)', fontSize: '0.9rem', flexShrink: 0, marginLeft: 12 }}>
                  ${fmt(p.debt)}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

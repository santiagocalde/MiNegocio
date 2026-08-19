import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import useSortable from '../hooks/useSortable.jsx';
import { Icons } from '../components/ui/Icons';
import { formatMoney } from '../utils/format';
import CategoryBreakdown from '../components/pos/CategoryBreakdown';

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

export default function CajasModule() {
  const { businessConfig, addToast, auth } = usePanelContext();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [turns, setTurns] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Corrección de un cierre ya hecho — para cuando el operador se equivocó al
  // tipear el contado (ej. le faltó un cero). Solo admin, requiere su PIN.
  const [correcting, setCorrecting] = useState(false);
  const [correctMonto, setCorrectMonto] = useState('');
  const [correctReason, setCorrectReason] = useState('');
  const [correctPin, setCorrectPin] = useState('');
  const [correctSaving, setCorrectSaving] = useState(false);

  const fetchTurns = useCallback(async () => {
    try {
      let path = '/turns?limit=300';
      if (dateFrom) path += `&date_from=${dateFrom}`;
      if (dateTo) path += `&date_to=${dateTo}`;
      const res = await apiGet(path);
      if (!res.ok) throw new Error('Error al cargar cajas');
      const data = await res.json();
      setTurns(Array.isArray(data) ? data : []);
    } catch {
      if (addToast) addToast('No se pudieron cargar las cajas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTurns();
  }, [fetchTurns]);

  const openDetail = async (turnId) => {
    setDetailLoading(true);
    setDetail(null);
    setCorrecting(false); setCorrectMonto(''); setCorrectReason(''); setCorrectPin('');
    try {
      const res = await apiGet(`/turns/${turnId}/detail`);
      if (res.ok) {
        setDetail(await res.json());
      } else if (addToast) {
        addToast('No se pudo cargar el detalle de la caja.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin conexión. Reintentá.', 'error');
    }
    setDetailLoading(false);
  };

  const { sorted: sortedTurns, toggleSort, SortIcon } = useSortable(turns, 'closed_at');

  const totalVendido = turns.reduce((a, t) => a + (t.sales_total || 0), 0);
  const totalContado = turns.reduce((a, t) => a + (t.counted_cash || 0), 0);

  const statusOf = (t) => {
    if (!t.closed_at) return { label: 'Abierta', color: 'var(--accent-primary)' };
    if (t.difference === null || t.difference === undefined) return { label: 'Sin datos', color: 'var(--text-faint)' };
    const d = Number(t.difference) || 0;
    if (Math.abs(d) < 0.01) return { label: 'Perfecta', color: 'var(--accent-success)' };
    if (d > 0) return { label: 'Sobrante', color: 'var(--accent-warning)' };
    return { label: 'Faltante', color: 'var(--accent-danger)' };
  };

  const handlePrint = () => {
    if (!detail) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const r = detail.resumen_caja || {};
    const rows = [
      ['Caja #' + detail.id, ''],
      ['Operador', detail.operator || '—'],
      ['Apertura', fmtDate(detail.opened_at)],
      ['Cierre', fmtDate(detail.closed_at)],
      ['Caja inicial', formatMoney(r.initial_cash)],
      ['Ventas (efectivo)', formatMoney((r.efectivo || 0) + (r.split_efectivo || 0))],
      ['Egresos', formatMoney(r.egresos)],
      ['Contado', formatMoney(detail.counted_cash)],
      ['Diferencia', formatMoney(detail.difference)],
    ];
    const catRows = (detail.por_categoria || []).map(c => [c.categoria, formatMoney(c.total)]);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Caja ${detail.id}</title>
    <style>body{font-family:monospace;font-size:14px;padding:40px}h1,h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:10px 12px;border-bottom:1px solid #ddd}.val{text-align:right;font-weight:bold}.sep{color:#999;font-style:italic;border-bottom:2px solid #ccc}</style></head>
    <body><h1>${businessConfig?.nombre || 'MiNegocio'}</h1><h2>Caja #${detail.id} — ${fmtDate(detail.closed_at)}</h2>
    <table>${rows.map(([l, v]) => `<tr><td>${l}</td><td class="val">${v}</td></tr>`).join('')}</table>
    <h2>Ventas por categoría</h2>
    <table>${catRows.map(([l, v]) => `<tr><td>${l}</td><td class="val">${v}</td></tr>`).join('')}</table>
    <script>window.onload=()=>window.print()</script></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const handleCorrectSave = async () => {
    if (!detail || correctMonto === '' || !correctPin || correctPin.length < 4) return;
    setCorrectSaving(true);
    try {
      const res = await apiPost(`/turns/${detail.id}/correct-count`, {
        counted_cash: parseFloat(correctMonto) || 0,
        operator_id: auth?.currentOperator?.id,
        pin: correctPin,
        reason: correctReason,
      });
      if (res.ok) {
        const data = await res.json();
        setDetail(prev => prev ? { ...prev, counted_cash: parseFloat(correctMonto) || 0, difference: data.difference } : prev);
        setTurns(prev => prev.map(t => t.id === detail.id ? { ...t, counted_cash: parseFloat(correctMonto) || 0, difference: data.difference } : t));
        addToast('Cierre corregido correctamente.', 'success');
        setCorrecting(false); setCorrectMonto(''); setCorrectReason(''); setCorrectPin('');
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'No se pudo corregir el cierre.', 'error');
      }
    } catch {
      addToast('Sin conexión. Reintentá.', 'error');
    }
    setCorrectSaving(false);
  };

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Cajas</h2>
          <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Historial de aperturas y cierres de caja por día</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setLoading(true); }} style={{ padding: '8px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem' }} />
          <span style={{ color: 'var(--text-secondary)' }}>→</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setLoading(true); }} style={{ padding: '8px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem' }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setLoading(true); }} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem', cursor: 'pointer' }}>Limpiar</button>
          )}
        </div>
      </div>

      {/* Cards resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          ['Cierres', String(turns.length)],
          ['Vendido', formatMoney(totalVendido)],
          ['Contado', formatMoney(totalContado)],
        ].map(([label, val]) => (
          <div key={label} className="ledger-sheet" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{label}</span>
            <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Tabla de cajas */}
      <div className="ledger-sheet">
        {loading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : sortedTurns.length === 0 ? (
          <EmptyState message="No hay cajas en el período seleccionado." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => toggleSort('id')}>Caja<SortIcon columnKey="id" /></th>
                  <th style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => toggleSort('closed_at')}>Cierre<SortIcon columnKey="closed_at" /></th>
                  <th style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => toggleSort('operator')}>Operador<SortIcon columnKey="operator" /></th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>Caja inicial</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => toggleSort('sales_total')}>Ventas<SortIcon columnKey="sales_total" /></th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>Contado</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => toggleSort('difference')}>Diferencia<SortIcon columnKey="difference" /></th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedTurns.map(t => {
                  const st = statusOf(t);
                  return (
                    <tr key={t.id} onClick={() => openDetail(t.id)} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>#{t.id}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{fmtDate(t.closed_at || t.opened_at)}</td>
                      <td style={{ padding: '12px 16px' }}>{t.operator || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(t.initial_cash)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(t.sales_total)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.counted_cash != null ? formatMoney(t.counted_cash) : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: t.difference != null && Math.abs(t.difference) > 0.01 ? (t.difference > 0 ? 'var(--accent-warning)' : 'var(--accent-danger)') : 'var(--text-primary)' }}>
                        {t.difference != null ? (t.difference > 0 ? '+ ' : '') + formatMoney(t.difference) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: st.color, background: st.color + '18', padding: '3px 10px', borderRadius: 20 }}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalle de caja */}
      {detailLoading && (
        <div className="modal-overlay"><div className="modal-content" style={{ maxWidth: 560 }}>
          <h2 className="modal-title">Cargando caja...</h2>
        </div></div>
      )}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Caja #{detail.id} — {detail.operator || 'Sin operador'}</h2>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '4px 0 14px' }}>
              Apertura: {fmtDate(detail.opened_at)} · Cierre: {fmtDate(detail.closed_at)}
            </p>
            {detail.resumen_caja && (() => {
              const r = detail.resumen_caja;
              const st = statusOf(detail);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    ['Caja inicial', formatMoney(r.initial_cash), 'var(--text-secondary)'],
                    ['Ventas en efectivo', formatMoney((r.efectivo || 0) + (r.split_efectivo || 0)), 'var(--accent-primary)'],
                    ['Egresos / ingresos', formatMoney(r.egresos), 'var(--accent-warning)'],
                    ['Contado', formatMoney(detail.counted_cash), 'var(--text-primary)'],
                    ['Diferencia', (detail.difference != null ? (detail.difference > 0 ? '+ ' : '') + formatMoney(detail.difference) : '—'), st.color],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--bg-main)', borderRadius: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{label}</span>
                      <span style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-mono)', color }}>{val}</span>
                    </div>
                  ))}
                  {detail.notes && <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: '4px 2px' }}>Nota: {detail.notes}</p>}
                </div>
              );
            })()}
            <CategoryBreakdown items={detail.por_categoria} />

            {/* Corrección del contado — solo admin, para cuando el operador se
                equivocó al tipear (ej. le faltó un cero). */}
            {!correcting ? (
              <button onClick={() => { setCorrecting(true); setCorrectMonto(String(detail.counted_cash ?? '')); }}
                style={{ marginTop: 12, background: 'none', border: '1px dashed var(--border-color)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', width: '100%' }}>
                ✎ ¿Se equivocaron al tipear el contado? Corregir
              </button>
            ) : (
              <div style={{ marginTop: 12, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)', borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--accent-warning)', fontWeight: 700, margin: '0 0 10px' }}>
                  Corregir monto contado (solo admin)
                </p>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: '0.8rem' }}>Monto correcto ($)</label>
                  <input type="number" value={correctMonto} onChange={e => setCorrectMonto(e.target.value)} autoFocus />
                </div>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: '0.8rem' }}>Motivo (opcional)</label>
                  <input type="text" value={correctReason} onChange={e => setCorrectReason(e.target.value)} placeholder="Ej: se tipeó $17.000 en vez de $170.000" />
                </div>
                <div className="input-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.8rem' }}>Tu PIN de admin</label>
                  <input type="password" value={correctPin} onChange={e => setCorrectPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="****" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setCorrecting(false); setCorrectMonto(''); setCorrectReason(''); setCorrectPin(''); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleCorrectSave} disabled={correctSaving || correctMonto === '' || correctPin.length < 4}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--accent-warning)', color: '#1E3A5F', fontWeight: 700, cursor: 'pointer', opacity: (correctSaving || correctMonto === '' || correctPin.length < 4) ? 0.5 : 1 }}>
                    {correctSaving ? 'Guardando...' : 'Confirmar corrección'}
                  </button>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 18 }}>
              <button className="btn btn-modal-cancel" onClick={() => setDetail(null)}>Cerrar</button>
              <button className="btn btn-modal-confirm" onClick={handlePrint} style={{ background: 'var(--accent-primary)' }}>
                <Icons.Printer /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

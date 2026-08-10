import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import ClientePicker from '../components/corralon/ClientePicker';

// ── Comprobante imprimible ────────────────────────────────────
function imprimirComprobante({ acopio, items, withdrawalType, withdrawalAddress, businessConfig }) {
  const negocio = businessConfig?.nombre || 'MiNegocio';
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora  = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const tipo  = withdrawalType === 'entrega' ? 'entrega' : 'retiro';
  const selloColor = '#D97706'; // amarillo/ámbar — visible en B&W como trazo de borde
  const selloText  = tipo === 'entrega' ? 'ENTREGA A DOMICILIO' : 'RETIRA EN PLANTA';
  const fmt = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const lineas = (items || []).filter(it => it.quantity_retirada < it.quantity_total);
  const total = lineas.reduce((s, it) => s + (it.quantity_total - it.quantity_retirada) * it.unit_price, 0);
  const win = window.open('', '_blank', 'width=700,height=900');
  if (!win) return;
  const rows = lineas.map(it => {
    const qty = it.quantity_total - it.quantity_retirada;
    return '<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">' + it.product_name
      + '</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + qty
      + '</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">$' + fmt(it.unit_price)
      + '</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">$' + fmt(qty * it.unit_price) + '</td></tr>';
  }).join('');
  const addrRow = withdrawalAddress
    ? '<div style="grid-column:1/-1"><div class="lbl">Dirección</div><div style="font-weight:600">' + withdrawalAddress + '</div></div>'
    : '';
  win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Acopio #' + (acopio && acopio.id)
    + '</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;font-size:13px;color:#111;padding:32px}'
    + 'h1{font-size:1.4rem;font-weight:800}table{width:100%;border-collapse:collapse;margin-top:12px}'
    + 'th{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;padding:6px 8px;border-bottom:2px solid #111;text-align:left}'
    + 'th:last-child,td:last-child{text-align:right}.total-row td{padding:10px 8px;font-weight:800;font-size:1.05rem;border-top:2px solid #111}'
    + '.lbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:2px}'
    + '.sello-wrap{margin-top:28px;display:flex;justify-content:flex-end}'
    + '.sello{display:inline-block;border:2.5px solid ' + selloColor + ';border-radius:4px;padding:6px 18px;color:' + selloColor
    + ';font-size:.9rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;transform:rotate(-6deg);opacity:.85}'
    + '@media print{body{padding:16px}}</style></head><body>'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">'
    + '<div><div class="lbl" style="letter-spacing:.1em">Comprobante de acopio</div><h1>' + negocio + '</h1></div>'
    + '<div style="text-align:right;font-size:.8rem;color:#6b7280"><div>Acopio #' + (acopio && acopio.id) + '</div><div>' + fecha + ' ' + hora + '</div></div></div>'
    + '<div style="background:#f9fafb;border-radius:6px;padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    + '<div><div class="lbl">Cliente</div><div style="font-weight:700">' + ((acopio && acopio.customer_name) || '—') + '</div></div>'
    + '<div><div class="lbl">Modalidad</div><div style="font-weight:700">' + (tipo === 'entrega' ? 'Entrega a domicilio' : 'Retiro en planta') + '</div></div>'
    + addrRow + '</div>'
    + '<table><thead><tr><th>Producto</th><th style="text-align:right">Cantidad</th><th style="text-align:right">Precio unit.</th><th style="text-align:right">Subtotal</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '<tfoot><tr class="total-row"><td colspan="3">Total</td><td>$' + fmt(total) + '</td></tr></tfoot></table>'
    + '<div class="sello-wrap"><div class="sello">' + selloText + '</div></div>'
    + '<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:.75rem;color:#9ca3af;text-align:center">Documento generado por MiNegocio · ' + fecha + '</div>'
    + '<script>window.onload=function(){window.print();}<\/script></body></html>');
  win.document.close();
}

const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—';

export default function AcopiosModule() {
  const { addToast, backend } = usePanelContext();
  const businessConfig = backend?.businessConfig;
  const [acopios, setAcopios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [showWithdrawal, setShowWithdrawal] = useState(null);
  const [withdrawalItems, setWithdrawalItems] = useState({});
  const [withdrawalType, setWithdrawalType] = useState('retiro'); // 'retiro' | 'entrega'
  const [withdrawalAddress, setWithdrawalAddress] = useState('');
  const [lastWithdrawal, setLastWithdrawal] = useState(null); // para ofrecer imprimir
  const [activeTab, setActiveTab] = useState('acopios'); // 'acopios' | 'despachos'
  const [despachos, setDespachos] = useState([]);
  const [despachosFecha, setDespachosFecha] = useState(''); // '' = últimos 30 días; 'YYYY-MM-DD' = día exacto
  const [despachosLoading, setDespachosLoading] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(null); // { wid, customerName }
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // F5: cobrar acopio
  const [cobrarModal, setCobrarModal] = useState(null); // {id, customerName, total}
  const [cobrarMethod, setCobrarMethod] = useState('efectivo');
  const [cobrarAmount, setCobrarAmount] = useState('');
  const [cobrarSaving, setCobrarSaving] = useState(false);

  // Form
  const [formCustomer, setFormCustomer] = useState(null);
  const [formItems, setFormItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await apiGet('/acopios?status=active'); if (r.ok) setAcopios(await r.json()); } catch {}
    setLoading(false);
  }, []);

  const fetchDespachos = useCallback(async (fecha) => {
    setDespachosLoading(true);
    try {
      const r = await apiGet(`/acopios/despachos${fecha ? `?fecha=${fecha}` : ''}`);
      if (r.ok) setDespachos(await r.json());
    } catch {}
    setDespachosLoading(false);
  }, []);

  const handleReschedule = async () => {
    if (!rescheduleModal || !rescheduleDate) return;
    setRescheduling(true);
    try {
      const r = await apiPost(`/acopios/withdrawals/${rescheduleModal.wid}/reschedule`, { new_date: rescheduleDate });
      if (r.ok) {
        addToast?.('Entrega reprogramada.', 'success');
        setDespachos(prev => prev.map(d =>
          d.withdrawal_id === rescheduleModal.wid
            ? { ...d, status: 'rescheduled', rescheduled_date: rescheduleDate }
            : d
        ));
        setRescheduleModal(null);
        setRescheduleDate('');
      } else {
        addToast?.('Error al reprogramar.', 'error');
      }
    } catch { addToast?.('Error al reprogramar.', 'error'); }
    setRescheduling(false);
  };

  const handleCobrar = async () => {
    if (!cobrarModal) return;
    setCobrarSaving(true);
    try {
      const r = await apiPost(`/acopios/${cobrarModal.id}/cobrar`, {
        method: cobrarMethod,
        amount: parseFloat(cobrarAmount) || cobrarModal.total,
        operator: 'Sistema',
      });
      if (r.ok) {
        addToast?.('Cobro registrado.', 'success');
        setCobrarModal(null);
        setCobrarAmount('');
        setCobrarMethod('efectivo');
        fetch();
      } else {
        addToast?.('Error al registrar cobro.', 'error');
      }
    } catch { addToast?.('Error al registrar cobro.', 'error'); }
    setCobrarSaving(false);
  };

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => {
    if (activeTab === 'despachos') fetchDespachos(despachosFecha);
  }, [activeTab, despachosFecha, fetchDespachos]);

  const handleSearch = async (q) => {
    setProductSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const r = await apiGet(`/products?q=${encodeURIComponent(q)}&limit=8`);
    if (r.ok) setSearchResults(await r.json() || []);
  };

  const addFormItem = (p) => {
    setFormItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: p.price || 0 }]);
    setProductSearch(''); setSearchResults([]);
  };

  const handleCreate = async () => {
    if (!formCustomer) { addToast?.('Seleccioná un cliente.', 'error'); return; }
    if (formItems.length === 0) return;
    const r = await apiPost('/acopios', {
      customer_id: formCustomer.id,
      items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
    });
    if (r.ok) { addToast?.('Acopio creado.', 'success'); setShowForm(false); setFormCustomer(null); setFormItems([]); fetch(); }
    else addToast?.('Error.', 'error');
  };

  const showDetail = async (id) => {
    const r = await apiGet(`/acopios/${id}`);
    if (r.ok) setDetail(await r.json());
  };

  const handleWithdrawal = async () => {
    if (!showWithdrawal) return;
    const items = Object.entries(withdrawalItems)
      .map(([k, q]) => ({ acopio_item_id: parseInt(k), quantity: parseFloat(q) || 0 }))
      .filter(item => item.quantity > 0);
    if (items.length === 0) {
      addToast?.('Ingresá al menos una cantidad antes de confirmar.', 'error');
      return;
    }
    const body = {
      items,
      notes: withdrawalType === 'entrega'
        ? `Entrega a domicilio${withdrawalAddress ? ': ' + withdrawalAddress : ''}`
        : 'Retiro en planta',
    };
    const r = await apiPost(`/acopios/${showWithdrawal}/withdrawals`, body);
    if (r.ok) {
      addToast?.('Registrado correctamente.', 'success');
      setLastWithdrawal({ acopio: detail?.acopio, items: detail?.items || [], withdrawalType, withdrawalAddress });
      setShowWithdrawal(null);
      setWithdrawalItems({});
      setWithdrawalType('retiro');
      setWithdrawalAddress('');
      fetch();
      if (detail) showDetail(detail.acopio.id);
    } else { addToast?.('Error al registrar.', 'error'); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', padding: '12px 20px' }}>
      {/* Header con tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--lp-paper-sunken)', borderRadius: 8, padding: 3 }}>
          {[['acopios', '📦 Acopios'], ['despachos', '🚚 Despachos del día']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                background: activeTab === key ? 'var(--lp-paper-raised)' : 'transparent',
                color: activeTab === key ? 'var(--lp-ink)' : 'var(--lp-ink-faint)',
                boxShadow: activeTab === key ? 'var(--lp-shadow-sm)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>
        {activeTab === 'acopios' && (
          <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>Nuevo acopio</button>
        )}
        {activeTab === 'despachos' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={despachosFecha} onChange={e => setDespachosFecha(e.target.value)}
              style={{ padding: '7px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.82rem', outline: 'none' }} />
            {despachosFecha && (
              <button onClick={() => setDespachosFecha('')} title="Ver últimos 30 días"
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--lp-line-strong)', background: 'transparent', color: 'var(--lp-ink-faint)', fontSize: '0.75rem', cursor: 'pointer' }}>
                × todos
              </button>
            )}
            {!despachosFecha && (
              <button onClick={() => setDespachosFecha(new Date().toISOString().slice(0, 10))} title="Solo hoy"
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--lp-line-strong)', background: 'transparent', color: 'var(--lp-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                Hoy
              </button>
            )}
          </div>
        )}
      </div>

      {/* Banner imprimir tras retiro exitoso */}
      {lastWithdrawal && (
        <div style={{ flexShrink: 0, background: 'rgba(20,187,166,0.08)', border: '1px solid var(--accent-primary)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: '0.87rem', color: 'var(--lp-ink)', fontWeight: 600 }}>
            Retiro registrado — ¿Imprimís el comprobante?
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setLastWithdrawal(null)} className="lp-btn lp-btn--ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>No</button>
            <button className="lp-btn lp-btn--primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={() => { imprimirComprobante({ ...lastWithdrawal, businessConfig }); setLastWithdrawal(null); }}>
              Imprimir
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* === TAB ACOPIOS === */}
        {activeTab === 'acopios' && (
          loading ? (
            <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
          ) : acopios.length === 0 ? (
            <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>No hay acopios activos.</div>
          ) : (
            <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
              {acopios.map(a => {
                const ps = a.payment_status;
                const payBadge = ps === 'paid'
                  ? { label: '✓ Cobrado', color: 'var(--lp-green)', bg: 'rgba(16,185,129,0.12)' }
                  : ps === 'cc'
                  ? { label: 'En CC', color: 'var(--lp-primary)', bg: 'rgba(20,187,166,0.12)' }
                  : null;
                return (
                <div key={a.id} className="ledger-row ledger-row--hover" onClick={() => showDetail(a.id)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      {a.customer_name || 'Sin cliente'}
                    </div>
                    <div className="ledger-label" style={{ marginTop: 2 }}>
                      Acopio #{a.id} · {fmtDate(a.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {payBadge && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 20, color: payBadge.color, background: payBadge.bg }}>
                        {payBadge.label}
                      </span>
                    )}
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: 'var(--lp-amber)', background: 'rgba(245,158,11,0.12)' }}>
                      Activo
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
          )
        )}

        {/* === TAB DESPACHOS === */}
        {activeTab === 'despachos' && (() => {
          if (despachosLoading) return (
            <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando despachos...</div>
          );
          if (despachos.length === 0) return (
            <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40, fontSize: '0.9rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🚚</div>
              Sin despachos registrados{despachosFecha ? ' para esta fecha' : ' en los últimos 30 días'}.
            </div>
          );

          // Agrupar por fecha
          const groups = {};
          despachos.forEach(d => {
            const raw = d.created_at ? new Date(d.created_at) : null;
            const key = raw
              ? raw.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Sin fecha';
            if (!groups[key]) groups[key] = [];
            groups[key].push(d);
          });

          return (
            <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
              {Object.entries(groups).map(([dateLabel, rows]) => (
                <div key={dateLabel}>
                  {/* Separador de fecha */}
                  <div style={{
                    padding: '10px 20px 6px',
                    fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--lp-primary)',
                    background: 'var(--lp-paper-sunken)',
                    borderBottom: '1px solid var(--lp-line)',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>
                    {dateLabel}
                    <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.7 }}>
                      {rows.length} entrega{rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {rows.map(d => {
                    const isRescheduled = d.status === 'rescheduled';
                    const notesAddr = d.notes?.replace(/^Entrega a domicilio[:\s]*/i, '').trim() || '';
                    const displayAddr = notesAddr || d.customer_address || '—';
                    const hora = d.created_at
                      ? new Date(d.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                      : '—';

                    // Formato humano para la fecha de reprogramación
                    const fmtRescheduled = d.rescheduled_date
                      ? new Date(d.rescheduled_date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
                      : null;

                    return (
                      <div key={d.withdrawal_id} style={{
                        padding: '13px 20px',
                        borderBottom: '1px solid var(--lp-line)',
                        display: 'flex', gap: 14, alignItems: 'flex-start',
                        opacity: isRescheduled ? 0.45 : 1,
                        background: isRescheduled ? 'var(--lp-paper-sunken)' : 'transparent',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--lp-ink-faint)', fontWeight: 700, width: 38, flexShrink: 0, paddingTop: 3 }}>{hora}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.9rem' }}>
                              {d.customer_name || 'Sin cliente'}
                            </span>
                            {isRescheduled && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: 'rgba(107,114,128,0.15)', color: 'var(--lp-ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                Reprogramado{fmtRescheduled ? ` → ${fmtRescheduled}` : ''}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: isRescheduled ? 'var(--lp-ink-faint)' : 'var(--lp-primary)', fontWeight: 600, marginTop: 2 }}>
                            📍 {displayAddr}
                          </div>
                          {d.items_summary && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--lp-ink-faint)', marginTop: 3 }}>{d.items_summary}</div>
                          )}
                          {d.driver && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--lp-ink-faint)', marginTop: 2 }}>Chofer: {d.driver}</div>
                          )}
                        </div>
                        {!isRescheduled && (
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => showDetail(d.acopio_id)}
                              className="lp-btn lp-btn--ghost"
                              style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                              title="Ver acopio">
                              Ver
                            </button>
                            <button
                              onClick={() => { setRescheduleModal({ wid: d.withdrawal_id, customerName: d.customer_name }); setRescheduleDate(''); }}
                              className="lp-btn lp-btn--ghost"
                              style={{ fontSize: '0.75rem', padding: '5px 10px', color: 'var(--lp-amber)' }}
                              title="Reprogramar entrega">
                              ↻
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onMouseDown={e => { if (e.target === e.currentTarget) { setShowForm(false); setFormCustomer(null); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: '0 0 16px' }}>Nuevo acopio</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Cliente *</label>
              <ClientePicker selected={formCustomer} onSelect={setFormCustomer} />
            </div>
            <input value={productSearch} onChange={e => handleSearch(e.target.value)} placeholder="Buscar producto..." style={{ width: '100%', padding: '8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', marginBottom: 8, outline: 'none' }} />
            {searchResults.length > 0 && (
              <div style={{ marginBottom: 8, maxHeight: 120, overflow: 'auto', border: '1px solid var(--lp-line)', borderRadius: 6 }}>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => addFormItem(p)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid var(--lp-line)', color: 'var(--lp-ink)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{p.name} · ${formatPesos(p.price)}</div>
                ))}
              </div>
            )}
            {formItems.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', fontSize: '0.82rem', color: 'var(--lp-ink)' }}>
                <span style={{ flex: 1 }}>{it.product_name}</span>
                <input type="number" value={it.quantity} onChange={e => setFormItems(prev => prev.map((x, idx) => idx === i ? { ...x, quantity: Math.max(1, parseFloat(e.target.value) || 1) } : x))} style={{ width: 60, padding: '4px 8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 4, color: 'var(--lp-ink)', textAlign: 'center', outline: 'none' }} />
                <button onClick={() => setFormItems(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <button onClick={handleCreate} disabled={!formCustomer || formItems.length === 0} className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '12px', marginTop: 12, opacity: (!formCustomer || formItems.length === 0) ? 0.5 : 1 }}>
              Crear acopio (descuenta stock)
            </button>
            <button onClick={() => { setShowForm(false); setFormCustomer(null); }} className="lp-btn lp-btn--ghost" style={{ width: '100%', marginTop: 8 }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal: Reprogramar entrega */}
      {rescheduleModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(11,19,43,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setRescheduleModal(null); setRescheduleDate(''); } }}>
          <div onMouseDown={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 360, background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: '0 0 6px' }}>
              Reprogramar entrega
            </h3>
            <div style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', marginBottom: 16 }}>
              {rescheduleModal.customerName || 'Sin cliente'}
            </div>
            <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Nueva fecha de entrega
            </label>
            <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.88rem', outline: 'none', marginBottom: 16 }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--lp-amber)', marginBottom: 16, lineHeight: 1.4 }}>
              La entrega original quedará marcada como <strong>Reprogramada</strong> (gris). La nueva entrega se registrará cuando se confirme en el acopio.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setRescheduleModal(null); setRescheduleDate(''); }}
                className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button onClick={handleReschedule} disabled={!rescheduleDate || rescheduling}
                className="lp-btn lp-btn--primary" style={{ flex: 2, opacity: (!rescheduleDate || rescheduling) ? 0.5 : 1 }}>
                {rescheduling ? 'Guardando…' : 'Confirmar reprogramación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Acopio #{detail.acopio.id}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', marginBottom: 12 }}>
              {detail.acopio.customer_name && <div>Cliente: {detail.acopio.customer_name}</div>}
              <div>Estado: {detail.acopio.status === 'active' ? 'Activo' : 'Completado'}</div>
            </div>
            <div style={{ borderTop: '1px solid var(--lp-line)', paddingTop: 10, marginBottom: 12 }}>
              {detail.items.map(it => {
                const pct = it.quantity_retirada / Math.max(1, it.quantity_total) * 100;
                const remaining = it.quantity_total - it.quantity_retirada;
                return (
                  <div key={it.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--lp-line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--lp-ink)' }}>
                      <span>{it.product_name}</span>
                      <span>{it.quantity_retirada}/{it.quantity_total}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--lp-paper-sunken)', borderRadius: 2, marginTop: 4 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: remaining > 0 ? 'var(--lp-amber)' : 'var(--lp-green)', borderRadius: 2 }} />
                    </div>
                    {remaining > 0 && <div style={{ fontSize: '0.7rem', color: 'var(--lp-amber)', marginTop: 2 }}>{remaining} pendiente{remaining <= 5 && remaining > 0 ? ' ⚠️' : ''}</div>}
                  </div>
                );
              })}
            </div>
            {/* Cobro */}
            {(() => {
              const ps = detail.acopio.payment_status;
              const isPaid = ps === 'paid' || ps === 'cc';
              const total = (detail.items || []).reduce((s, it) => s + (it.unit_price || 0) * (it.quantity_total || 0), 0);
              return !isPaid && detail.acopio.status === 'active' ? (
                <button
                  onClick={e => { e.stopPropagation(); setCobrarModal({ id: detail.acopio.id, customerName: detail.acopio.customer_name, total }); setCobrarAmount(String(total)); setCobrarMethod('efectivo'); }}
                  className="lp-btn lp-btn--ghost"
                  style={{ width: '100%', marginBottom: 8, color: 'var(--lp-green)', borderColor: 'var(--lp-green)' }}>
                  💰 Cobrar acopio
                </button>
              ) : isPaid ? (
                <div style={{ fontSize: '0.8rem', color: ps === 'paid' ? 'var(--lp-green)' : 'var(--lp-primary)', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
                  {ps === 'paid' ? '✓ Cobrado' : '✓ Registrado en cuenta corriente'}
                  {detail.acopio.paid_amount > 0 && ` — $${formatPesos(detail.acopio.paid_amount)}`}
                </div>
              ) : null;
            })()}

            {showWithdrawal === detail.acopio.id ? (
              <div>
                {/* Selector retiro / entrega */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[['retiro', 'Retiro en planta'], ['entrega', 'Entrega a domicilio']].map(([val, lbl]) => (
                    <button key={val} onClick={() => {
                      setWithdrawalType(val);
                      // Auto-completar dirección del cliente al seleccionar entrega
                      if (val === 'entrega' && detail.acopio.customer_address && !withdrawalAddress) {
                        setWithdrawalAddress(detail.acopio.customer_address);
                      }
                    }}
                      style={{ flex: 1, padding: '8px 4px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                        border: withdrawalType === val ? '2px solid var(--lp-primary)' : '1.5px solid var(--lp-line-strong)',
                        background: withdrawalType === val ? 'rgba(20,187,166,0.12)' : 'transparent',
                        color: withdrawalType === val ? 'var(--lp-primary)' : 'var(--lp-ink-faint)',
                        transition: 'all 0.15s' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {withdrawalType === 'entrega' && (
                  <div style={{ marginBottom: 8 }}>
                    <input value={withdrawalAddress} onChange={e => setWithdrawalAddress(e.target.value)}
                      placeholder="Dirección de entrega"
                      style={{ width: '100%', padding: '7px 10px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.85rem', outline: 'none' }} />
                    {detail.acopio.customer_address && !withdrawalAddress && (
                      <button onClick={() => setWithdrawalAddress(detail.acopio.customer_address)}
                        style={{ marginTop: 4, fontSize: '0.73rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                        Usar: {detail.acopio.customer_address}
                      </button>
                    )}
                  </div>
                )}
                {/* Cantidades — pre-llenadas con el disponible */}
                {detail.items.filter(it => it.quantity_retirada < it.quantity_total).map(it => {
                  const disponible = it.quantity_total - it.quantity_retirada;
                  return (
                    <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: '0.83rem' }}>
                      <span style={{ flex: 1, color: 'var(--lp-ink)' }}>
                        {it.product_name}
                        <span style={{ color: 'var(--lp-ink-faint)', fontSize: '0.75rem' }}> (disp: {disponible})</span>
                      </span>
                      <input type="number"
                        value={withdrawalItems[it.id] !== undefined ? withdrawalItems[it.id] : disponible}
                        onChange={e => setWithdrawalItems(p => ({ ...p, [it.id]: e.target.value }))}
                        min={0} max={disponible} step={1}
                        style={{ width: 70, padding: '5px 8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 4, color: 'var(--lp-ink)', textAlign: 'center', outline: 'none', fontFamily: 'var(--lp-font-mono)' }} />
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => { setShowWithdrawal(null); setWithdrawalItems({}); setWithdrawalType('retiro'); setWithdrawalAddress(''); }} className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
                  <button onClick={handleWithdrawal} className="lp-btn lp-btn--primary" style={{ flex: 2 }}>
                    Confirmar {withdrawalType === 'entrega' ? 'entrega' : 'retiro'}
                  </button>
                </div>
              </div>
            ) : (
              detail.acopio.status === 'active' && (
                <button onClick={() => {
                  // Pre-llenar con disponible al abrir
                  const preloaded = {};
                  detail.items.filter(it => it.quantity_retirada < it.quantity_total).forEach(it => {
                    preloaded[it.id] = it.quantity_total - it.quantity_retirada;
                  });
                  setWithdrawalItems(preloaded);
                  setWithdrawalType('retiro');
                  setWithdrawalAddress('');
                  setShowWithdrawal(detail.acopio.id);
                }} className="lp-btn lp-btn--primary" style={{ width: '100%' }}>
                  Registrar retiro / entrega
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Modal: cobrar acopio (F5) */}
      {cobrarModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(11,19,43,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setCobrarModal(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>
                💰 Cobrar acopio
              </h3>
              <button onClick={() => setCobrarModal(null)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            {cobrarModal.customerName && (
              <div style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', marginBottom: 12 }}>
                Cliente: <strong style={{ color: 'var(--lp-ink)' }}>{cobrarModal.customerName}</strong>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--lp-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Forma de cobro
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[['efectivo','Efectivo'],['tarjeta','Tarjeta'],['transferencia','Transferencia'],['cc','Cuenta corriente']].map(([val, lbl]) => (
                  <button key={val} onClick={() => setCobrarMethod(val)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                      border: cobrarMethod === val ? '2px solid var(--lp-primary)' : '1.5px solid var(--lp-line-strong)',
                      background: cobrarMethod === val ? 'rgba(20,187,166,0.12)' : 'transparent',
                      color: cobrarMethod === val ? 'var(--lp-primary)' : 'var(--lp-ink-faint)' }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--lp-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Monto cobrado
              </label>
              <input type="number" value={cobrarAmount} onChange={e => setCobrarAmount(e.target.value)} min={0} step={1}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 8, color: 'var(--lp-ink)', fontSize: '1.1rem', fontFamily: 'var(--lp-font-mono)', outline: 'none', boxSizing: 'border-box' }} />
              {cobrarModal.total > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--lp-ink-faint)', marginTop: 4 }}>
                  Total del acopio: ${formatPesos(cobrarModal.total)}
                  {parseFloat(cobrarAmount) !== cobrarModal.total && (
                    <button onClick={() => setCobrarAmount(String(cobrarModal.total))}
                      style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--lp-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>
                      Usar total
                    </button>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCobrarModal(null)} className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={handleCobrar} disabled={cobrarSaving} className="lp-btn lp-btn--primary" style={{ flex: 2, background: 'var(--lp-green)', borderColor: 'var(--lp-green)' }}>
                {cobrarSaving ? 'Guardando...' : cobrarMethod === 'cc' ? 'Pasar a cuenta corriente' : 'Confirmar cobro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

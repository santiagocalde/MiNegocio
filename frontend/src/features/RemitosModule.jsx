import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';

const STATUS_MAP = {
  pending:   { label: 'Pendiente',  color: '#F59E0B', bg: 'rgba(245,158,11,0.09)'  },
  en_camino: { label: 'En camino',  color: '#3B82F6', bg: 'rgba(59,130,246,0.09)'  },
  delivered: { label: 'Entregado',  color: '#10B981', bg: 'rgba(16,185,129,0.09)'  },
  failed:    { label: 'Fallido',    color: '#EF4444', bg: 'rgba(239,68,68,0.09)'   },
  postponed: { label: 'Postergado', color: '#F97316', bg: 'rgba(249,115,22,0.09)'  },
  cancelled: { label: 'Cancelado',  color: '#6B7280', bg: 'rgba(107,114,128,0.09)' },
};

const STATUS_ORDER = { pending: 0, en_camino: 1, delivered: 2, postponed: 3, failed: 4, cancelled: 5 };

const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (s) => { if (!s) return '—'; return new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }); };

export default function RemitosModule() {
  const { addToast, auth } = usePanelContext();
  const location = useLocation();
  const isDespacho = new URLSearchParams(location.search).get('filter') === 'today';

  const [notas, setNotas]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [detail, setDetail]         = useState(null);
  const [showCobrar, setShowCobrar] = useState(false);
  const [cobrarMethod, setCobrarMethod] = useState('cash');
  const [cobrarLoading, setCobrarLoading] = useState(false);

  // Form
  const [formAddress, setFormAddress] = useState('');
  const [formDriver, setFormDriver]   = useState('');
  const [formDate, setFormDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [formItems, setFormItems]     = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/remitos?limit=200';
      if (isDespacho) url += '&fecha=' + new Date().toISOString().slice(0, 10);
      const res = await apiGet(url);
      if (res.ok) {
        const data = await res.json();
        data.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
        setNotas(data);
      }
    } catch { /* offline */ }
    setLoading(false);
  }, [isDespacho]);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);
  // Re-fetch al cambiar entre Notas de pedido y Despacho del día
  useEffect(() => { fetchNotas(); }, [location.search]); // eslint-disable-line

  const handleSearch = async (q) => {
    setProductSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const res = await apiGet(`/products?q=${encodeURIComponent(q)}&limit=8`);
    if (res.ok) setSearchResults(await res.json() || []);
  };

  const addItem = (p) => {
    setFormItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: p.price || 0 }]);
    setProductSearch(''); setSearchResults([]);
  };
  const removeItem = (i) => setFormItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItemQty = (i, qty) => setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, parseFloat(qty) || 1) } : it));
  const totalItems = formItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleCreate = async () => {
    if (formItems.length === 0) { addToast?.('Agregá productos.', 'error'); return; }
    const body = {
      address: formAddress, driver: formDriver,
      scheduled_date: formDate,
      items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
    };
    const res = await apiPost('/remitos', body);
    if (res.ok) {
      addToast?.('Nota de pedido creada.', 'success');
      setShowForm(false); setFormAddress(''); setFormDriver(''); setFormItems([]);
      fetchNotas();
    } else { addToast?.('Error al crear.', 'error'); }
  };

  const handleShareWhatsApp = (r) => {
    const bizName = JSON.parse(localStorage.getItem('saas_business') || '{}')?.business_name || 'Corralón';
    const msg = `*${bizName}* — Nota de Pedido N° ${r.id}\nDirección: ${r.address || '—'}\nChofer: ${r.driver || '—'}\nFecha: ${fmtDate(r.scheduled_date)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleStatus = async (id, status) => {
    const res = await apiPost(`/remitos/${id}/status`, { status });
    if (res.ok) {
      addToast?.(`${STATUS_MAP[status]?.label || status}.`, 'success');
      fetchNotas();
      // Refrescar detail si está abierto
      if (detail?.remito?.id === id) showDetail(id);
    } else { addToast?.('Error al cambiar estado.', 'error'); }
  };

  const showDetail = async (id) => {
    const res = await apiGet(`/remitos/${id}`);
    if (res.ok) setDetail(await res.json());
  };

  // ── Imprimir nota de pedido individual ────────────────────────
  const handlePrint = (nota) => {
    const cfg = JSON.parse(localStorage.getItem('minegocio_config') || '{}');
    const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
    const bizName  = biz.business_name || cfg.nombre || 'Corralón';
    const logoUrl  = cfg.logo_url || '';
    const address  = cfg.direccion || '';
    const phone    = cfg.telefono || '';
    const instagram= cfg.instagram || '';

    const logoImg = logoUrl
      ? `<img src="${logoUrl}" style="max-height:52px;max-width:150px;object-fit:contain;display:block;margin-bottom:6px;" />`
      : '';

    const total = nota.items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
    const itemRows = nota.items.map(it => {
      const qty = Number(it.quantity);
      const cantFmt = qty % 1 === 0 ? qty.toFixed(0) : qty.toLocaleString('es-AR', { maximumFractionDigits: 3 });
      return `<tr>
        <td style="padding:7px 10px;text-align:center;border-bottom:1px solid #eee;">${cantFmt}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;">${it.product_name}</td>
        <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #eee;font-family:monospace;">$${formatPesos(it.unit_price)}</td>
        <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #eee;font-family:monospace;">$${formatPesos(Number(it.unit_price)*qty)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Nota de Pedido N° ${nota.remito.id}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:800px;margin:auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:16px}
.biz-name{font-size:18px;font-weight:800;margin-bottom:2px}
.biz-sub{font-size:11px;color:#555;line-height:1.6}
.doc-title{font-size:20px;font-weight:900;text-align:right}
.doc-sub{font-size:11px;color:#555;text-align:right;line-height:1.6}
.meta{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px;padding:12px;background:#f7f7f7;border-radius:6px}
.meta-item label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#777;font-weight:700;margin-bottom:2px}
.meta-item span{font-size:13px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#111;color:#fff;padding:8px 10px;font-size:11px;text-align:left}
th:last-child,th:nth-last-child(2){text-align:right}
.total-row td{font-weight:800;font-size:14px;border-top:2px solid #111;padding:10px;background:#f0f0f0}
.footer{margin-top:28px;text-align:center;font-size:10px;color:#aaa}
@media print{body{padding:10px}.footer{margin-top:16px}}
</style></head><body>
<div class="header">
  <div>
    ${logoImg}
    <div class="biz-name">${bizName}</div>
    <div class="biz-sub">
      ${address ? address + '<br>' : ''}
      ${phone ? 'Tel: ' + phone + (instagram ? ' · ' : '<br>') : ''}
      ${instagram ? instagram + '<br>' : ''}
    </div>
  </div>
  <div>
    <div class="doc-title">NOTA DE PEDIDO</div>
    <div class="doc-title" style="font-size:28px;color:#111">N° ${nota.remito.id}</div>
    <div class="doc-sub">Fecha: ${fmtDate(nota.remito.scheduled_date || nota.remito.created_at)}</div>
    <div class="doc-sub">Estado: <strong>${STATUS_MAP[nota.remito.status]?.label || nota.remito.status}</strong></div>
  </div>
</div>
<div class="meta">
  ${nota.remito.address ? `<div class="meta-item"><label>Dirección de entrega</label><span>${nota.remito.address}</span></div>` : ''}
  ${nota.remito.customer_name ? `<div class="meta-item"><label>Cliente</label><span>${nota.remito.customer_name}</span></div>` : ''}
  ${nota.remito.driver ? `<div class="meta-item"><label>Chofer</label><span>${nota.remito.driver}</span></div>` : ''}
  <div class="meta-item"><label>Programado para</label><span>${fmtDate(nota.remito.scheduled_date)}</span></div>
</div>
<table>
  <thead><tr>
    <th style="width:60px;text-align:center">Cant.</th>
    <th>Producto / Descripción</th>
    <th style="width:110px">Precio unit.</th>
    <th style="width:110px">Total</th>
  </tr></thead>
  <tbody>
    ${itemRows}
    <tr class="total-row">
      <td colspan="3" style="text-align:right">TOTAL</td>
      <td style="text-align:right;font-family:monospace">$${formatPesos(total)}</td>
    </tr>
  </tbody>
</table>
<div class="footer">Emitido por MiNegocio · ${new Date().toLocaleDateString('es-AR', { day:'numeric',month:'long',year:'numeric' })}</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`;

    const w = window.open('', '_blank', 'width=860,height=680');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // ── Cobrar mini-modal ─────────────────────────────────────────
  const handleCobrar = async () => {
    if (!detail) return;
    setCobrarLoading(true);
    try {
      const total = detail.items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
      const body = {
        turn_id: auth?.currentTurnId,
        operator: auth?.currentOperator?.name || 'Sistema',
        payment_method: cobrarMethod,
        total,
        items: detail.items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_amount: 0,
        })),
      };
      const res = await apiPost('/sales', body);
      if (res.ok) {
        addToast?.('✅ Cobro registrado correctamente.', 'success');
        setShowCobrar(false);
        setDetail(null);
        fetchNotas();
      } else {
        addToast?.('Error al registrar cobro.', 'error');
      }
    } catch { addToast?.('Error de conexión.', 'error'); }
    setCobrarLoading(false);
  };

  // ── Estilos compartidos ───────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '8px 12px',
    background: 'var(--lp-paper-sunken)',
    border: '1px solid var(--lp-line-strong)',
    borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none',
  };

  const btnStatus = (color, label, onClick) => (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 4px', fontSize: '0.82rem', fontWeight: 700,
      border: `1.5px solid ${color}`, borderRadius: 8,
      background: color + '18', color, cursor: 'pointer',
      transition: 'background 0.15s',
      textAlign: 'center',
    }}
      onMouseEnter={e => e.currentTarget.style.background = color + '32'}
      onMouseLeave={e => e.currentTarget.style.background = color + '18'}
    >{label}</button>
  );

  const title = isDespacho ? 'Despacho del día' : 'Notas de pedido';
  const emptyMsg = isDespacho
    ? 'No hay pedidos programados para hoy.'
    : 'No hay notas de pedido. Creá una con "Nueva nota".';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', padding: '12px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0, letterSpacing: '-0.02em' }}>
          {title}
          {isDespacho && (
            <span style={{ marginLeft: 10, fontSize: '0.75rem', background: 'rgba(59,130,246,0.12)', color: '#3B82F6', padding: '2px 10px', borderRadius: 20, fontWeight: 700, verticalAlign: 'middle' }}>
              {new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          )}
        </h2>
        <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
          + Nueva nota
        </button>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {loading ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
        ) : notas.length === 0 ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>{emptyMsg}</div>
        ) : notas.map(r => {
          const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
          return (
            <div key={r.id}
              onClick={() => showDetail(r.id)}
              style={{
                padding: '11px 16px',
                background: st.bg,
                border: `1px solid ${st.color}30`,
                borderLeft: `4px solid ${st.color}`,
                borderRadius: 7,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', transition: 'filter 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.94)'}
              onMouseLeave={e => e.currentTarget.style.filter = 'none'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.9rem' }}>
                  N° {r.id} — {r.address || 'Sin dirección'}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--lp-ink-faint)' }}>
                  {fmtDate(r.scheduled_date)}{r.driver ? ` · ${r.driver}` : ''}{r.customer_name ? ` · ${r.customer_name}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 800, color: st.color,
                  background: st.color + '20', padding: '3px 9px', borderRadius: 20,
                  whiteSpace: 'nowrap',
                }}>
                  {st.label}
                </span>
                <button onClick={e => { e.stopPropagation(); handleShareWhatsApp(r); }}
                  style={{ background: 'rgba(37,211,102,0.09)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                  📱
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal: Nueva nota de pedido ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Nueva nota de pedido</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Dirección</label>
                <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Calle / Obra" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Chofer</label>
                <input value={formDriver} onChange={e => setFormDriver(e.target.value)} placeholder="Nombre" style={inputStyle} />
              </div>
              <div style={{ width: 130 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Fecha</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <input value={productSearch} onChange={e => handleSearch(e.target.value)} placeholder="Buscar producto..." style={{ ...inputStyle, marginBottom: 8 }} />
            {searchResults.length > 0 && (
              <div style={{ marginBottom: 8, maxHeight: 130, overflow: 'auto', border: '1px solid var(--lp-line)', borderRadius: 6 }}>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => addItem(p)} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: '0.83rem', borderBottom: '1px solid var(--lp-line)', color: 'var(--lp-ink)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {p.name} · <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(p.price)}</span>
                  </div>
                ))}
              </div>
            )}
            {formItems.length > 0 && (
              <div style={{ marginBottom: 12, borderTop: '1px solid var(--lp-line)', paddingTop: 10 }}>
                {formItems.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: '0.83rem', color: 'var(--lp-ink)' }}>
                    <span style={{ flex: 1 }}>{it.product_name}</span>
                    <input type="number" value={it.quantity} onChange={e => updateItemQty(i, e.target.value)}
                      style={{ width: 55, ...inputStyle, textAlign: 'center', padding: '5px 6px' }} min={0.01} step={0.01} />
                    <span style={{ fontFamily: 'var(--lp-font-mono)', width: 90, textAlign: 'right' }}>${formatPesos(it.quantity * it.unit_price)}</span>
                    <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--lp-line-strong)', marginTop: 6, paddingTop: 7, fontWeight: 700, color: 'var(--lp-ink)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total</span><span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(totalItems)}</span>
                </div>
              </div>
            )}
            <button onClick={handleCreate} disabled={formItems.length === 0} className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', opacity: formItems.length === 0 ? 0.5 : 1 }}>
              Crear nota de pedido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Detalle de nota ── */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setDetail(null); setShowCobrar(false); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 510, maxHeight: '92vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            {/* Título */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>
                  Nota de pedido N° {detail.remito.id}
                </h3>
              </div>
              <button onClick={() => { setDetail(null); setShowCobrar(false); }} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            {/* Badge de estado */}
            {(() => {
              const st = STATUS_MAP[detail.remito.status] || STATUS_MAP.pending;
              return (
                <div style={{ display: 'inline-block', background: st.bg, border: `1px solid ${st.color}40`, color: st.color, fontWeight: 800, fontSize: '0.8rem', padding: '4px 14px', borderRadius: 20, marginBottom: 12 }}>
                  {st.label}
                </div>
              );
            })()}

            {/* Info */}
            <div style={{ fontSize: '0.83rem', color: 'var(--lp-ink-faint)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {detail.remito.address && <div>📍 <strong style={{ color: 'var(--lp-ink)' }}>{detail.remito.address}</strong></div>}
              {detail.remito.customer_name && <div>👤 {detail.remito.customer_name}</div>}
              {detail.remito.driver && <div>🚛 Chofer: {detail.remito.driver}</div>}
              <div>📅 Programado: {fmtDate(detail.remito.scheduled_date)}</div>
            </div>

            {/* Items */}
            <div style={{ borderTop: '1px solid var(--lp-line)', paddingTop: 10, marginBottom: 14 }}>
              {detail.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.83rem', color: 'var(--lp-ink)' }}>
                  <span>{it.product_name} × {it.quantity}</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(it.unit_price * it.quantity)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--lp-line-strong)', marginTop: 7, paddingTop: 7, fontWeight: 800, color: 'var(--lp-ink)', display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                <span>Total</span>
                <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(detail.items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0))}</span>
              </div>
            </div>

            {/* Acciones de estado */}
            {!showCobrar && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {detail.remito.status === 'pending' && (<>
                  {btnStatus('#F59E0B', '🚛 En camino', () => handleStatus(detail.remito.id, 'en_camino'))}
                  {btnStatus('#F97316', '📅 Postergado', () => handleStatus(detail.remito.id, 'postponed'))}
                  {btnStatus('#6B7280', 'Cancelar', () => handleStatus(detail.remito.id, 'cancelled'))}
                </>)}
                {detail.remito.status === 'en_camino' && (<>
                  {btnStatus('#10B981', '✅ Entregado', () => handleStatus(detail.remito.id, 'delivered'))}
                  {btnStatus('#EF4444', '✕ Fallido', () => handleStatus(detail.remito.id, 'failed'))}
                  {btnStatus('#F97316', '📅 Postergado', () => handleStatus(detail.remito.id, 'postponed'))}
                </>)}
                {detail.remito.status === 'postponed' && (<>
                  {btnStatus('#F59E0B', '↩ Retomar', () => handleStatus(detail.remito.id, 'pending'))}
                  {btnStatus('#6B7280', 'Cancelar', () => handleStatus(detail.remito.id, 'cancelled'))}
                </>)}
                {detail.remito.status === 'delivered' && (
                  btnStatus('#10B981', '💵 Cobrar', () => setShowCobrar(true))
                )}
              </div>
            )}

            {/* Mini POS — cobrar */}
            {showCobrar && detail.remito.status === 'delivered' && (
              <div style={{ marginTop: 4, background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.95rem', marginBottom: 10 }}>Registrar cobro</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[
                    { val: 'cash', label: '💵 Efectivo' },
                    { val: 'transfer', label: '📲 Transferencia' },
                    { val: 'fiado', label: '📒 Fiado' },
                  ].map(m => (
                    <button key={m.val} onClick={() => setCobrarMethod(m.val)}
                      style={{ flex: 1, padding: '9px 4px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: cobrarMethod === m.val ? '2px solid var(--lp-primary)' : '1.5px solid var(--lp-line-strong)', background: cobrarMethod === m.val ? 'rgba(20,187,166,0.12)' : 'transparent', color: cobrarMethod === m.val ? 'var(--lp-primary)' : 'var(--lp-ink-faint)', transition: 'all 0.15s' }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowCobrar(false)} className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
                  <button onClick={handleCobrar} disabled={cobrarLoading} className="lp-btn lp-btn--primary"
                    style={{ flex: 2, opacity: cobrarLoading ? 0.6 : 1 }}>
                    {cobrarLoading ? 'Registrando...' : `Confirmar cobro`}
                  </button>
                </div>
              </div>
            )}

            {/* Pie: imprimir + WhatsApp */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
              <button onClick={() => handlePrint(detail)}
                style={{ background: 'rgba(107,114,128,0.1)', border: '1px solid var(--lp-line-strong)', color: 'var(--lp-ink-faint)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                🖨️ Imprimir
              </button>
              <button onClick={() => handleShareWhatsApp(detail.remito)}
                style={{ background: 'rgba(37,211,102,0.09)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                📱 WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

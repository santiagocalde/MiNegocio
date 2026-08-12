import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import ClientePicker from '../components/corralon/ClientePicker';

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

// ── Checkbox estilizado Ocean Dark ──────────────────────────────
function Checkbox({ checked, onChange }) {
  return (
    <div onClick={e => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
        border: checked ? '2px solid var(--lp-primary)' : '2px solid var(--lp-line-strong)',
        background: checked ? 'var(--lp-primary)' : 'var(--lp-paper-sunken)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
      {checked && (
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
          <path d="M1 4L4 7L10 1" stroke="#0B132B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

export default function RemitosModule() {
  const { addToast, auth } = usePanelContext();
  const location = useLocation();
  // Soporta ambos: tab interno Y URL legacy ?filter=today (para deep-links desde sidebar viejo)
  const urlIsDespacho = new URLSearchParams(location.search).get('filter') === 'today';
  const [activeTab, setActiveTab] = useState(() => urlIsDespacho ? 'despacho' : 'notas');
  const isDespacho = activeTab === 'despacho';

  const [notas, setNotas]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [detail, setDetail]         = useState(null);
  const [showCobrar, setShowCobrar] = useState(false);
  const [cobrarMethod, setCobrarMethod] = useState('cash');
  const [cobrarMonto, setCobrarMonto] = useState('');
  const [cobrarLoading, setCobrarLoading] = useState(false);

  // Multi-select (solo en Despacho del día)
  const [selected, setSelected]         = useState(new Set());
  const [loadingCarga, setLoadingCarga] = useState(false);

  // Postergado — mini modal de fecha
  const [postponeModal, setPostponeModal] = useState(null); // null | { remito_id, date }

  // Form
  const [formCustomer, setFormCustomer] = useState(null); // { id, name, phone, address } | null
  const [formAddress, setFormAddress] = useState('');
  const [formDriver, setFormDriver]   = useState('');
  const [formDate, setFormDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [formItems, setFormItems]     = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [variantProduct, setVariantProduct] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/remitos?limit=200';
      if (isDespacho) url += '&fecha=' + new Date().toISOString().slice(0, 10);
      const res = await apiGet(url);
      if (res.ok) {
        let data = await res.json();
        // Despacho del día: solo pendientes / en camino / postergados
        if (isDespacho) data = data.filter(r => ['pending','en_camino','postponed'].includes(r.status));
        data.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
        setNotas(data);
      }
    } catch { /* offline */ }
    setLoading(false);
  }, [isDespacho]);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);
  useEffect(() => { fetchNotas(); setSelected(new Set()); }, [location.search]); // eslint-disable-line

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const selectPendientes = () => {
    const activos = notas.filter(r => ['pending', 'en_camino'].includes(r.status)).map(r => r.id);
    setSelected(new Set(activos));
  };

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

  const addOrPickVariant = (p) => {
    if (p.has_variants) {
      setVariantProduct(p);
    } else {
      addItem(p);
    }
  };
  const removeItem = (i) => setFormItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItemQty = (i, qty) => setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, parseFloat(qty) || 1) } : it));
  const totalItems = formItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleCreate = async () => {
    if (!formCustomer) { addToast?.('Seleccioná un cliente primero.', 'error'); return; }
    if (formItems.length === 0) { addToast?.('Agregá al menos un producto.', 'error'); return; }
    const body = {
      customer_id: formCustomer.id,
      address: formAddress || formCustomer.address || '',
      driver: formDriver,
      scheduled_date: formDate,
      items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
    };
    const res = await apiPost('/remitos', body);
    if (res.ok) {
      addToast?.('Nota de pedido creada.', 'success');
      setShowForm(false); setFormCustomer(null); setFormAddress(''); setFormDriver(''); setFormItems([]);
      fetchNotas();
    } else { addToast?.('Error al crear.', 'error'); }
  };

  const handleShareWhatsApp = (r) => {
    const bizName = JSON.parse(localStorage.getItem('saas_business') || '{}')?.business_name || 'Corralón';
    const cliente = r.customer_name || r.address || '—';
    const msg = `*${bizName}* — Nota de Pedido N° ${r.id}\nCliente: ${cliente}${r.address ? '\nDirección: ' + r.address : ''}\nFecha: ${fmtDate(r.scheduled_date)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleStatus = async (id, status, extra = {}) => {
    const res = await apiPost(`/remitos/${id}/status`, { status, ...extra });
    if (res.ok) {
      addToast?.(`${STATUS_MAP[status]?.label || status}.`, 'success');
      fetchNotas();
      if (detail?.remito?.id === id) showDetail(id);
    } else { addToast?.('Error al cambiar estado.', 'error'); }
  };

  const showDetail = async (id) => {
    const res = await apiGet(`/remitos/${id}`);
    if (res.ok) setDetail(await res.json());
  };

  // ── Imprimir nota individual ──────────────────────────────────
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

  // ── ORDEN DE CARGA — impresión agregada de múltiples notas ────
  const handlePrintOrdenCarga = async () => {
    if (selected.size === 0) return;
    setLoadingCarga(true);
    try {
      const ids = [...selected];
      const details = await Promise.all(
        ids.map(id => apiGet(`/remitos/${id}`).then(r => r.ok ? r.json() : null))
      );
      const validos = details.filter(Boolean);
      if (validos.length === 0) { addToast?.('No se pudieron cargar los pedidos.', 'error'); setLoadingCarga(false); return; }

      const cfg = JSON.parse(localStorage.getItem('minegocio_config') || '{}');
      const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
      const bizName  = biz.business_name || cfg.nombre || 'Corralón';
      const logoUrl  = cfg.logo_url || '';
      const address  = cfg.direccion || '';
      const phone    = cfg.telefono || '';
      const fechaStr = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const logoImg = logoUrl
        ? `<img src="${logoUrl}" style="max-height:48px;max-width:130px;object-fit:contain;display:block;margin-bottom:4px;" />`
        : '';

      // Agregar items por nombre de producto (suma de cantidades)
      const agg = {}; // { product_name: { qty, unit } }
      validos.forEach(d => {
        d.items.forEach(it => {
          const key = it.product_name;
          if (!agg[key]) agg[key] = { qty: 0 };
          agg[key].qty += Number(it.quantity);
        });
      });
      const aggRows = Object.entries(agg)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, { qty }]) => {
          const cantFmt = qty % 1 === 0 ? qty.toFixed(0) : qty.toLocaleString('es-AR', { maximumFractionDigits: 3 });
          return `<tr>
            <td style="padding:9px 12px;border-bottom:1px solid #e0e0e0;font-weight:700;font-size:14px;">${cantFmt}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e0e0e0;font-size:14px;">${name}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e0e0e0;text-align:center;">☐</td>
          </tr>`;
        }).join('');

      // Detalle por nota
      const stopRows = validos.map((d, i) => {
        const r = d.remito;
        const subItems = d.items.map(it => {
          const qty = Number(it.quantity);
          const cantFmt = qty % 1 === 0 ? qty.toFixed(0) : qty.toLocaleString('es-AR', { maximumFractionDigits: 3 });
          return `<tr>
            <td style="padding:5px 10px;font-size:12px;border-bottom:1px solid #f0f0f0;">${cantFmt}</td>
            <td style="padding:5px 10px;font-size:12px;border-bottom:1px solid #f0f0f0;">${it.product_name}</td>
          </tr>`;
        }).join('');
        return `<div style="margin-bottom:18px;border:1px solid #ccc;border-radius:6px;overflow:hidden;page-break-inside:avoid;">
          <div style="background:#222;color:#fff;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:14px;">Parada ${i + 1} — N° ${r.id}</strong>
            <span style="font-size:12px;opacity:0.75;">${STATUS_MAP[r.status]?.label || r.status}</span>
          </div>
          <div style="padding:8px 14px;background:#f9f9f9;border-bottom:1px solid #eee;">
            ${r.address ? `<div style="font-size:13px;font-weight:700;">📍 ${r.address}</div>` : ''}
            ${r.customer_name ? `<div style="font-size:12px;color:#555;">👤 ${r.customer_name}</div>` : ''}
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="width:60px;background:#555;color:#fff;padding:6px 10px;font-size:11px;text-align:left;">Cant.</th>
              <th style="background:#555;color:#fff;padding:6px 10px;font-size:11px;text-align:left;">Producto</th>
            </tr></thead>
            <tbody>${subItems}</tbody>
          </table>
        </div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Orden de carga — ${fechaStr}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;max-width:860px;margin:auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:16px;margin-bottom:20px}
.biz-name{font-size:20px;font-weight:900;margin-bottom:2px}
.biz-sub{font-size:11px;color:#555;line-height:1.7}
.doc-title{font-size:28px;font-weight:900;text-align:right;letter-spacing:-0.5px}
.doc-sub{font-size:12px;color:#555;text-align:right;line-height:1.7;margin-top:3px}
.section-title{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#333;border-bottom:2px solid #111;padding-bottom:6px;margin:20px 0 12px}
table.agg{width:100%;border-collapse:collapse;margin-bottom:6px}
table.agg thead th{background:#111;color:#fff;padding:9px 12px;font-size:12px;text-align:left}
table.agg thead th:last-child{width:70px;text-align:center}
.firma{margin-top:30px;display:flex;gap:60px}
.firma-item{flex:1;border-top:1px solid #999;padding-top:6px;font-size:11px;color:#666;text-align:center}
.footer{margin-top:28px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
@media print{body{padding:10px}.footer{margin-top:14px}button{display:none}}
</style></head><body>
<div class="header">
  <div>
    ${logoImg}
    <div class="biz-name">${bizName}</div>
    <div class="biz-sub">
      ${address ? address + '<br>' : ''}
      ${phone ? 'Tel: ' + phone : ''}
    </div>
  </div>
  <div>
    <div class="doc-title">ORDEN DE CARGA</div>
    <div class="doc-sub">${fechaStr}</div>
    <div class="doc-sub">${validos.length} parada${validos.length !== 1 ? 's' : ''} · ${Object.keys(agg).length} producto${Object.keys(agg).length !== 1 ? 's' : ''}</div>
  </div>
</div>

<div class="section-title">📦 Resumen — qué cargar al camión</div>
<table class="agg">
  <thead><tr>
    <th style="width:70px;">Cant.</th>
    <th>Producto</th>
    <th style="width:70px;text-align:center;">✓</th>
  </tr></thead>
  <tbody>${aggRows}</tbody>
</table>

<div class="section-title">🗺️ Paradas del día</div>
${stopRows}

<div class="firma">
  <div class="firma-item">Chofer</div>
  <div class="firma-item">Recibí conforme</div>
</div>

<div class="footer">Generado por MiNegocio · ${new Date().toLocaleDateString('es-AR', { day:'numeric',month:'long',year:'numeric' })}</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`;

      const w = window.open('', '_blank', 'width=920,height=720');
      if (w) { w.document.write(html); w.document.close(); }
    } catch { addToast?.('Error al generar la orden.', 'error'); }
    setLoadingCarga(false);
  };

  // ── Cobrar mini-modal ─────────────────────────────────────────
  const handleCobrar = async () => {
    if (!detail) return;
    const montoNum = Number(String(cobrarMonto).replace(/\D/g, ''));
    if (!montoNum || montoNum <= 0) {
      addToast?.('Ingresá un monto mayor a $0.', 'error');
      return;
    }
    setCobrarLoading(true);
    try {
      // Distribuir el monto ingresado proporcionalmente entre los items,
      // o usar precio unitario si está disponible.
      const calcTotal = detail.items.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 1), 0);
      const items = detail.items.map(i => {
        const lineTotal = calcTotal > 0
          ? (Number(i.unit_price || 0) * Number(i.quantity || 1))
          : (montoNum / detail.items.length);
        return {
          product_id: i.product_id,
          product_name: i.product_name || '',
          quantity: i.quantity || 1,
          unit_price: calcTotal > 0 ? (i.unit_price || 0) : montoNum / detail.items.length,
          discount_amount: 0,
          _lineTotal: lineTotal,
        };
      });
      const body = {
        turn_id: auth?.currentTurnId,
        operator: auth?.currentOperator?.name || 'Sistema',
        payment_method: cobrarMethod === 'fiado' ? 'fiado' : cobrarMethod,
        is_fiado: cobrarMethod === 'fiado',
        fiado_name: cobrarMethod === 'fiado' ? (detail.remito.customer_name || '') : undefined,
        total: montoNum,
        payment: montoNum,
        items: items.map(({ _lineTotal: _, ...rest }) => rest),
        source_remito_id: detail.remito.id,
      };
      const res = await apiPost('/sales', body);
      if (res.ok) {
        addToast?.('Cobro registrado correctamente.', 'success');
        setShowCobrar(false);
        setCobrarMonto('');
        setDetail(null);
        fetchNotas();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast?.(err.detail || 'Error al registrar cobro.', 'error');
      }
    } catch { addToast?.('Error de conexión.', 'error'); }
    setCobrarLoading(false);
  };

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
      transition: 'background 0.15s', textAlign: 'center',
    }}
      onMouseEnter={e => e.currentTarget.style.background = color + '32'}
      onMouseLeave={e => e.currentTarget.style.background = color + '18'}
    >{label}</button>
  );

  const title = isDespacho ? 'Despacho del día' : 'Notas de pedido';
  const emptyMsg = isDespacho
    ? 'No hay pedidos programados para hoy.'
    : 'No hay notas de pedido. Creá una con "Nueva nota".';

  const selectedCount = selected.size;
  const isLogistica = auth?.currentOperator?.role === 'logistica';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', padding: '12px 20px' }}>

      {/* ── Header con tabs ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--lp-paper-sunken)', borderRadius: 8, padding: 3 }}>
          {[['notas', '📋 Notas de pedido'], ['despacho', '🚚 Despacho del día']].map(([key, label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setSelected(new Set()); }}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                background: activeTab === key ? 'var(--lp-paper-raised)' : 'transparent',
                color: activeTab === key ? 'var(--lp-ink)' : 'var(--lp-ink-faint)',
                boxShadow: activeTab === key ? 'var(--lp-shadow-sm)' : 'none' }}>
              {label}
              {key === 'despacho' && (
                <span style={{ marginLeft: 6, fontSize: '0.68rem', color: activeTab === key ? '#3B82F6' : 'var(--lp-ink-faint)', fontWeight: 800 }}>
                  {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isDespacho && notas.length > 0 && (
            <button onClick={selectPendientes}
              style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(20,187,166,0.08)', border: '1px solid rgba(20,187,166,0.3)', color: 'var(--lp-primary)', borderRadius: 8, cursor: 'pointer' }}>
              ☑ Seleccionar pendientes
            </button>
          )}
          {!isDespacho && !isLogistica && (
            <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
              + Nueva nota
            </button>
          )}
        </div>
      </div>

      {/* ── Lista ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {loading ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
        ) : notas.length === 0 ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>{emptyMsg}</div>
        ) : notas.map(r => {
          const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
          const isSel = selected.has(r.id);
          return (
            <div key={r.id}
              onClick={() => { if (!isDespacho) showDetail(r.id); }}
              style={{
                padding: '11px 16px',
                background: isSel ? 'rgba(20,187,166,0.11)' : st.bg,
                border: isSel ? '1.5px solid rgba(20,187,166,0.55)' : `1px solid ${st.color}30`,
                borderLeft: `4px solid ${isSel ? 'var(--lp-primary)' : st.color}`,
                borderRadius: 7,
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: isDespacho ? 'default' : 'pointer',
                transition: 'border 0.15s, background 0.15s, filter 0.12s',
              }}
              onMouseEnter={e => { if (!isDespacho) e.currentTarget.style.filter = 'brightness(0.94)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
            >
              {/* Checkbox solo en Despacho */}
              {isDespacho && (
                <Checkbox checked={isSel} onChange={() => toggleSelect(r.id)} />
              )}

              {/* Contenido clickeable para detalle (en despacho: click en el texto) */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minWidth: 0 }}
                onClick={() => showDetail(r.id)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    N° {r.id} — {r.customer_name || r.address || 'Sin cliente'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--lp-ink-faint)', marginTop: 2 }}>
                    {fmtDate(r.scheduled_date)}{r.driver ? ` · ${r.driver}` : ''}{r.address ? ` · ${r.address}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 800, color: st.color,
                    background: st.color + '20', padding: '3px 9px', borderRadius: 20,
                    whiteSpace: 'nowrap',
                  }}>
                    {st.label}
                  </span>
                  <button onClick={e => { e.stopPropagation(); handleShareWhatsApp(r); }}
                    style={{ background: 'rgba(37,211,102,0.09)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                    WA
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Barra de acción: Orden de carga ── */}
      {isDespacho && selectedCount > 0 && (
        <div style={{
          flexShrink: 0,
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(20,187,166,0.14) 0%, rgba(0,229,255,0.08) 100%)',
          border: '1.5px solid rgba(20,187,166,0.4)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 20, height: 20, display: 'inline-flex', color: 'var(--text-faint)' }}><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg></span>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--lp-primary)', fontSize: '0.9rem' }}>
                {selectedCount} nota{selectedCount !== 1 ? 's' : ''} seleccionada{selectedCount !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--lp-ink-faint)' }}>
                Generá la hoja de carga para el camión
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected(new Set())}
              style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, background: 'transparent', border: '1px solid var(--lp-line-strong)', color: 'var(--lp-ink-faint)', borderRadius: 8, cursor: 'pointer' }}>
              Limpiar
            </button>
            <button onClick={handlePrintOrdenCarga} disabled={loadingCarga}
              style={{ padding: '10px 20px', fontSize: '0.88rem', fontWeight: 800, background: 'var(--lp-primary)', border: 'none', color: '#0B132B', borderRadius: 8, cursor: loadingCarga ? 'wait' : 'pointer', opacity: loadingCarga ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {loadingCarga ? 'Generando...' : 'Imprimir Orden de carga'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva nota de pedido ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setShowForm(false); setFormCustomer(null); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Nueva nota de pedido</h3>
              <button onClick={() => { setShowForm(false); setFormCustomer(null); }} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            {/* ── 1. Cliente (obligatorio) ── */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Cliente *
              </label>
              <ClientePicker
                selected={formCustomer}
                onSelect={c => {
                  setFormCustomer(c);
                  if (c?.address) setFormAddress(c.address);
                }}
              />
            </div>

            {/* ── 2. Dirección + Chofer + Fecha ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Dirección de entrega</label>
                <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Calle / Obra (opcional si ya está en cliente)" style={inputStyle} />
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

            {/* ── 3. Productos ── */}
            <input value={productSearch} onChange={e => handleSearch(e.target.value)} placeholder="Buscar producto..." style={{ ...inputStyle, marginBottom: 8 }} />
            {searchResults.length > 0 && (
              <div style={{ marginBottom: 8, maxHeight: 130, overflow: 'auto', border: '1px solid var(--lp-line)', borderRadius: 6 }}>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => addOrPickVariant(p)} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: '0.83rem', borderBottom: '1px solid var(--lp-line)', color: 'var(--lp-ink)' }}
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
            <button onClick={handleCreate} disabled={!formCustomer || formItems.length === 0} className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', opacity: (!formCustomer || formItems.length === 0) ? 0.5 : 1 }}>
              Crear nota de pedido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Postergar (mini date picker) ── */}
      {variantProduct && (
        <VariantPicker
          product={variantProduct}
          onSelect={v => {
            addItem({ ...v, name: v.variant_label || v.name });
            setVariantProduct(null);
          }}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {postponeModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setPostponeModal(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 380, background: 'var(--lp-paper-raised)',
            border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24,
            boxShadow: 'var(--lp-shadow-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>
                Postergar entrega
              </h3>
              <button onClick={() => setPostponeModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', margin: '0 0 14px 0' }}>
              ¿Para qué día reprogramamos la nota N° {postponeModal.remito_id}?
            </p>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                Nueva fecha de entrega
              </label>
              <input type="date" value={postponeModal.date}
                onChange={e => setPostponeModal(prev => ({ ...prev, date: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--lp-paper-sunken)',
                  border: '1px solid var(--lp-line-strong)',
                  borderRadius: 6, color: 'var(--lp-ink)',
                  fontSize: '0.95rem', outline: 'none',
                }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPostponeModal(null)}
                className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button onClick={() => {
                handleStatus(postponeModal.remito_id, 'postponed', { scheduled_date: postponeModal.date });
                setPostponeModal(null);
              }}
                className="lp-btn lp-btn--primary" style={{ flex: 2 }}>
                Confirmar postergación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalle de nota ── */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setDetail(null); setShowCobrar(false); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 510, maxHeight: '92vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>
                Nota de pedido N° {detail.remito.id}
              </h3>
              <button onClick={() => { setDetail(null); setShowCobrar(false); setPostponeModal(null); }} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            {(() => {
              const st = STATUS_MAP[detail.remito.status] || STATUS_MAP.pending;
              return (
                <div style={{ display: 'inline-block', background: st.bg, border: `1px solid ${st.color}40`, color: st.color, fontWeight: 800, fontSize: '0.8rem', padding: '4px 14px', borderRadius: 20, marginBottom: 12 }}>
                  {st.label}
                </div>
              );
            })()}

            <div style={{ fontSize: '0.83rem', color: 'var(--lp-ink-faint)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {detail.remito.address && <div>Dirección: <strong style={{ color: 'var(--lp-ink)' }}>{detail.remito.address}</strong></div>}
              {detail.remito.customer_name && <div>{detail.remito.customer_name}</div>}
              {detail.remito.driver && <div>Chofer: {detail.remito.driver}</div>}
              <div>Programado: {fmtDate(detail.remito.scheduled_date)}</div>
            </div>

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

            {!showCobrar && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {/* Logística: solo puede confirmar entrega cuando está en camino */}
                {isLogistica ? (
                  detail.remito.status === 'en_camino'
                    ? btnStatus('#10B981', 'Confirmar entrega', () => handleStatus(detail.remito.id, 'delivered'))
                    : <p style={{ fontSize: '0.8rem', color: 'var(--lp-ink-faint)', margin: 0 }}>
                        {detail.remito.status === 'delivered' ? 'Ya entregado.' : 'Pendiente de despacho.'}
                      </p>
                ) : (<>
                  {detail.remito.status === 'pending' && (<>
                    {btnStatus('#F59E0B', 'En camino', () => handleStatus(detail.remito.id, 'en_camino'))}
                    {btnStatus('#F97316', '📅 Postergado', () => {
                      const tom = new Date(); tom.setDate(tom.getDate() + 1);
                      setPostponeModal({ remito_id: detail.remito.id, date: tom.toISOString().slice(0, 10) });
                    })}
                    {btnStatus('#6B7280', 'Cancelar', () => handleStatus(detail.remito.id, 'cancelled'))}
                  </>)}
                  {detail.remito.status === 'en_camino' && (<>
                    {btnStatus('#10B981', 'Entregado', () => handleStatus(detail.remito.id, 'delivered'))}
                    {btnStatus('#EF4444', '✕ Fallido', () => handleStatus(detail.remito.id, 'failed'))}
                    {btnStatus('#F97316', '📅 Postergado', () => {
                      const tom = new Date(); tom.setDate(tom.getDate() + 1);
                      setPostponeModal({ remito_id: detail.remito.id, date: tom.toISOString().slice(0, 10) });
                    })}
                  </>)}
                  {detail.remito.status === 'postponed' && (<>
                    {btnStatus('#F59E0B', '↩ Retomar', () => handleStatus(detail.remito.id, 'pending'))}
                    {btnStatus('#6B7280', 'Cancelar', () => handleStatus(detail.remito.id, 'cancelled'))}
                  </>)}
                  {detail.remito.status === 'delivered' && (
                    btnStatus('#10B981', 'Cobrar', () => {
                      const calc = detail.items.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 1), 0);
                      setCobrarMonto(calc > 0 ? String(calc) : '');
                      setShowCobrar(true);
                    })
                  )}
                </>)}
              </div>
            )}

            {showCobrar && detail.remito.status === 'delivered' && (
              <div style={{ marginTop: 4, background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.95rem', marginBottom: 10 }}>Registrar cobro</div>

                {/* Monto */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--lp-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Monto ($)</div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cobrarMonto}
                    onChange={e => setCobrarMonto(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    autoFocus
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--lp-line-strong)', background: 'var(--lp-paper-raised)', color: 'var(--lp-ink)', fontSize: '1.4rem', fontFamily: 'var(--font-mono)', fontWeight: 800, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Método */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[
                    { val: 'cash',     label: 'Efectivo' },
                    { val: 'transfer', label: 'Transferencia' },
                    { val: 'fiado',    label: 'Cuenta cte.' },
                  ].map(m => (
                    <button key={m.val} onClick={() => setCobrarMethod(m.val)}
                      style={{ flex: 1, padding: '9px 4px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: cobrarMethod === m.val ? '2px solid var(--lp-primary)' : '1.5px solid var(--lp-line-strong)', background: cobrarMethod === m.val ? 'rgba(20,187,166,0.12)' : 'transparent', color: cobrarMethod === m.val ? 'var(--lp-primary)' : 'var(--lp-ink-faint)', transition: 'all 0.15s' }}>
                      {m.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setShowCobrar(false); setCobrarMonto(''); }} className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
                  <button onClick={handleCobrar} disabled={cobrarLoading || !cobrarMonto || Number(cobrarMonto) <= 0} className="lp-btn lp-btn--primary"
                    style={{ flex: 2, opacity: (cobrarLoading || !cobrarMonto || Number(cobrarMonto) <= 0) ? 0.5 : 1 }}>
                    {cobrarLoading ? 'Registrando...' : 'Confirmar cobro'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
              <button onClick={() => handlePrint(detail)}
                style={{ background: 'rgba(107,114,128,0.1)', border: '1px solid var(--lp-line-strong)', color: 'var(--lp-ink-faint)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                Imprimir
              </button>
              <button onClick={() => handleShareWhatsApp(detail.remito)}
                style={{ background: 'rgba(37,211,102,0.09)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

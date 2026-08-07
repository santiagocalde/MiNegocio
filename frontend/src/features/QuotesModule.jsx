import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost, apiDelete } from '../services/apiClient';

const STATUS_MAP = {
  draft:     { label: 'Borrador',  color: 'var(--lp-ink-faint)' },
  sent:      { label: 'Enviado',   color: '#3B82F6' },
  approved:  { label: 'Aprobado',  color: 'var(--lp-primary)' },
  delivered: { label: 'Entregado', color: 'var(--lp-green)' },
  expired:   { label: 'Vencido',   color: 'var(--lp-red)' },
  rejected:  { label: 'Rechazado', color: 'var(--lp-red)' },
};

const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (s) => { if (!s) return '—'; return new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); };

// ── Monto en letras (formato argentino) ───────────────────────
function numToLetras(monto) {
  const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function grupo(n) {
    if (n === 0) return '';
    let s = '';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    if (c > 0) s += (c === 1 && resto === 0 ? 'CIEN' : CENTENAS[c]);
    if (resto > 0) {
      if (s) s += ' ';
      if (resto < 20) s += UNIDADES[resto];
      else { s += DECENAS[Math.floor(resto / 10)]; if (resto % 10 > 0) s += ' Y ' + UNIDADES[resto % 10]; }
    }
    return s;
  }
  function toLetras(n) {
    if (n === 0) return 'CERO';
    let s = '';
    const millones = Math.floor(n / 1000000);
    const miles = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;
    if (millones > 0) { s += (millones === 1 ? 'UN MILLÓN' : grupo(millones) + ' MILLONES'); }
    if (miles > 0) { if (s) s += ' '; s += (miles === 1 ? 'MIL' : grupo(miles) + ' MIL'); }
    if (resto > 0) { if (s) s += ' '; s += grupo(resto); }
    return s;
  }
  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);
  let res = 'PESOS ' + toLetras(entero);
  if (centavos > 0) res += ` CON ${String(centavos).padStart(2, '0')}/100`;
  return res;
}

export default function QuotesModule() {
  const { addToast } = usePanelContext();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);

  // Form state
  const [formCustomer, setFormCustomer] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formListType, setFormListType] = useState('a');
  const [formItems, setFormItems] = useState([]);
  const [formValidDays, setFormValidDays] = useState(15);
  const [formDiscount, setFormDiscount] = useState('');
  const [formFormaPago, setFormFormaPago] = useState('Contado');

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [productQty, setProductQty] = useState('1');
  const [productPrice, setProductPrice] = useState('');

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/quotes?limit=200');
      if (res.ok) setQuotes(await res.json());
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const handleSearch = async (q) => {
    setProductSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const res = await apiGet(`/products?q=${encodeURIComponent(q)}&limit=8`);
    if (res.ok) { const data = await res.json(); setSearchResults(data || []); }
  };

  const addItem = (p) => {
    const qty = parseFloat(productQty) || 1;
    const price = parseFloat(productPrice) || p.price_b || p.price || 0;
    setFormItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity: qty, unit_price: price }]);
    setProductSearch('');
    setSearchResults([]);
    setProductQty('1');
    setProductPrice('');
  };

  const removeItem = (i) => setFormItems(prev => prev.filter((_, idx) => idx !== i));

  const totalQuote = formItems.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);

  const handleCreate = async () => {
    if (formItems.length === 0) { addToast?.('Agregá al menos un producto.', 'error'); return; }
    const body = {
      customer_id: formCustomer ? parseInt(formCustomer) : null,
      note: formNote,
      list_type: formListType,
      valid_days: formValidDays,
      discount_pct: parseFloat(formDiscount) || 0,
      forma_pago: formFormaPago || 'Contado',
      items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
    };
    const res = await apiPost('/quotes', body);
    if (res.ok) {
      addToast?.('Presupuesto creado.', 'success');
      setShowForm(false);
      setFormCustomer(''); setFormNote(''); setFormItems([]); setFormListType('a'); setFormValidDays(15);
      setFormDiscount(''); setFormFormaPago('Contado');
      fetchQuotes();
    } else { addToast?.('Error al crear presupuesto.', 'error'); }
  };

const handleStatus = async (id, status) => {
    const res = await apiPost(`/quotes/${id}/status`, { status });
    if (res.ok) { addToast?.(`Estado: ${STATUS_MAP[status]?.label || status}.`, 'success'); fetch(); }
    else { addToast?.('Error al cambiar estado.', 'error'); }
  };

  const handleShareWhatsApp = () => {
    if (!detail) return;
    const d = detail;
    const bizName = JSON.parse(localStorage.getItem('saas_business') || '{}')?.business_name || 'Corralón';
    const total = d.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const lines = d.items.map(it => `${it.product_name} x${it.quantity}: $${formatPesos(it.unit_price * it.quantity)}`).join('\n');
    const msg = `*${bizName}* - Presupuesto N° ${d.quote.id}\n\n${lines}\n\n*TOTAL: $${formatPesos(total)}*\n${d.quote.list_type === 'b' ? '(Lista Contratista)' : '(Lista Público)'}\nVálido hasta: ${fmtDate(d.quote.expires_at)}\n${d.quote.note ? 'Obra: ' + d.quote.note : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handlePrint = () => {
    if (!detail) return;
    const d = detail;

    // ── Datos del negocio ─────────────────────────────────────
    const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
    const cfg = JSON.parse(localStorage.getItem('minegocio_config') || '{}');
    const bizName  = biz.business_name || cfg.nombre || 'Corralón';
    const logoUrl  = cfg.logo_url || '';
    const address  = cfg.direccion || '';
    const phone    = cfg.telefono || '';
    const cuit     = cfg.cuit || '';
    const condIva  = cfg.condicion_iva || '';

    // ── Cálculos ──────────────────────────────────────────────
    const subtotal    = d.items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
    const discPct     = Number(d.quote.discount_pct || 0);
    const discAmount  = subtotal * discPct / 100;
    const finalTotal  = subtotal - discAmount;
    const enLetras    = numToLetras(finalTotal);

    // ── Filas de items ────────────────────────────────────────
    const itemRows = d.items.map(it => {
      const cant = Number(it.quantity);
      const cantFmt = cant % 1 === 0 ? cant.toFixed(0) : cant.toLocaleString('es-AR', { maximumFractionDigits: 3 });
      const unit = it.unit_label || 'C/U';
      const cod  = it.product_code || '';
      return `<tr>
        <td class="tc">${cantFmt}</td>
        <td class="tc cod">${cod}</td>
        <td class="desc">${it.product_name}</td>
        <td class="tc">${unit}</td>
        <td class="num">$${formatPesos(it.unit_price)}</td>
        <td class="num">$${formatPesos(Number(it.unit_price) * cant)}</td>
      </tr>`;
    }).join('');

    // ── Header del documento ──────────────────────────────────
    // Logo: el CSS compacto pone logo e info en row; el holgado los apila
    const logoImg = logoUrl
      ? `<img src="${logoUrl}" style="max-height:52px;max-width:160px;object-fit:contain;display:block" alt="logo" />`
      : '';
    const bizInfoHtml = `
      <div class="biz-info">
        <div class="biz-name">${bizName}</div>
        ${address ? `<div class="biz-detail">${address}</div>` : ''}
        ${phone   ? `<div class="biz-detail">Tel: ${phone}</div>` : ''}
        ${cuit    ? `<div class="biz-detail">CUIT: ${cuit}</div>` : ''}
        ${condIva ? `<div class="iva-badge">${condIva}</div>` : ''}
      </div>`;

    const makeBlock = (copyLabel) => `
<div class="sheet">
  <!-- Encabezado -->
  <div class="doc-header">
    <div class="biz-left">
      ${logoImg}
      ${bizInfoHtml}
    </div>
    <div class="biz-right">
      <div class="doc-type">PRESUPUESTO</div>
      <div class="doc-num">N° <span class="mono">${String(d.quote.id).padStart(4, '0')}</span></div>
      <div class="doc-date">${fmtDate(d.quote.created_at || new Date())}</div>
    </div>
  </div>
  <div class="copy-label">${copyLabel}</div>

  <!-- Datos del cliente -->
  <div class="client-section">
    <table class="client-table">
      <tr>
        <td class="cl"><span class="cl-label">Cliente:</span> <strong>${d.quote.customer_name || 'CONSUMIDOR FINAL'}</strong></td>
        <td class="cr"><span class="cl-label">Vendedor:</span> —</td>
      </tr>
      <tr>
        <td class="cl"><span class="cl-label">Obra / Referencia:</span> ${d.quote.note || '—'}</td>
        <td class="cr"><span class="cl-label">Forma de pago:</span> ${d.quote.forma_pago || 'Contado'}</td>
      </tr>
      <tr>
        <td class="cl"><span class="cl-label">Lista:</span> ${d.quote.list_type === 'b' ? 'B (Contratista)' : 'A (Público)'}</td>
        <td class="cr"><span class="cl-label">Válido hasta:</span> ${fmtDate(d.quote.expires_at)}</td>
      </tr>
    </table>
  </div>

  <!-- Tabla de items -->
  <table class="items">
    <thead>
      <tr>
        <th class="tc">Cant.</th>
        <th class="tc">Código</th>
        <th class="desc">Descripción</th>
        <th class="tc">Unidad</th>
        <th class="num">Precio Unit.</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totales -->
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span class="mono">$${formatPesos(subtotal)}</span></div>
    ${discPct > 0 ? `<div class="total-row disc"><span>Descuento ${discPct}%</span><span class="mono">- $${formatPesos(discAmount)}</span></div>` : ''}
    <div class="total-row grand"><span>TOTAL</span><span class="mono">$${formatPesos(finalTotal)}</span></div>
  </div>

  <!-- Monto en letras -->
  <div class="letras">SON ${enLetras}</div>

  <!-- Firma -->
  <div class="firma-row">
    <div class="firma-box">Aclaración: ___________________________<br/>Firma: ___________________________</div>
    <div class="firma-box" style="text-align:right">Recibí conforme</div>
  </div>
</div>`;

    // ── CSS holgado (1 copia por página, 9+ items) ───────────
    const cssLoose = `
      @page { size: A4; margin: 10mm 12mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }
      .sheet { border: 1px solid #bbb; padding: 10mm 12mm; page-break-after: always; page-break-inside: avoid; }
      .sheet:last-child { page-break-after: avoid; }
      .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm; padding-bottom: 4mm; border-bottom: 2px solid #111; }
      .biz-left { display: flex; flex-direction: column; gap: 2px; }
      .biz-name { font-size: 14px; font-weight: 900; letter-spacing: -0.3px; margin-top: 2px; }
      .biz-detail { font-size: 10px; color: #444; }
      .biz-right { text-align: right; }
      .doc-type { font-size: 20px; font-weight: 900; letter-spacing: 1.5px; }
      .doc-num { font-size: 14px; font-weight: 700; margin: 1mm 0; }
      .doc-date { font-size: 11px; color: #444; }
      .iva-badge { display: inline-block; margin-top: 2mm; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; border: 1px solid #555; padding: 1px 5px; color: #333; }
      .copy-label { text-align: center; font-size: 12px; font-weight: 900; letter-spacing: 3px; padding: 2mm 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; margin-bottom: 5mm; color: #555; }
      .client-section { background: #f8f8f8; border: 1px solid #ddd; padding: 3mm 4mm; margin-bottom: 5mm; }
      .client-table { width: 100%; border-collapse: collapse; }
      .client-table td { padding: 2px 4px; font-size: 11px; }
      .cl { width: 60%; } .cr { width: 40%; }
      .cl-label { font-weight: 700; color: #555; }
      .items { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
      .items thead tr { border-bottom: 2px solid #111; }
      .items thead th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 3mm 3px; color: #333; }
      .items tbody tr { border-bottom: 1px solid #e5e5e5; }
      .items tbody tr:last-child { border-bottom: 1px solid #aaa; }
      .items td { padding: 3mm 3px; vertical-align: middle; }
      .tc { text-align: center; width: 52px; }
      .cod { font-family: monospace; font-size: 10px; color: #555; width: 60px; }
      .desc { text-align: left; }
      .num { text-align: right; font-family: monospace; width: 95px; font-variant-numeric: tabular-nums; }
      .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 1.5mm; margin-bottom: 4mm; }
      .total-row { display: flex; justify-content: flex-end; gap: 20mm; font-size: 11px; min-width: 120mm; }
      .total-row.disc { color: #666; }
      .total-row.grand { font-size: 15px; font-weight: 900; border-top: 2px solid #111; padding-top: 2mm; margin-top: 1mm; }
      .mono { font-family: monospace; font-variant-numeric: tabular-nums; }
      .letras { font-size: 10px; font-style: italic; color: #333; border-top: 1px dashed #aaa; padding-top: 2mm; margin-bottom: 8mm; }
      .firma-row { display: flex; justify-content: space-between; margin-top: 10mm; }
      .firma-box { font-size: 10px; color: #555; line-height: 2.4; }
      .cut-line { display: none; }
    `;

    // ── CSS compacto (2 copias por página, hasta 8 items) ────
    // A4 usable con margin 5mm: 297-10 = 287mm
    // Cada bloque objetivo ≤ 140mm para que 2+corte(7mm) = 287mm
    const cssCompact = `
      @page { size: A4; margin: 5mm 9mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; background: #fff; }
      .sheet { border: 1px solid #bbb; padding: 5mm 8mm; page-break-inside: avoid; }
      /* Header compacto: logo inline izquierda, datos negocio derecha */
      .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2.5mm; padding-bottom: 2.5mm; border-bottom: 1.5px solid #111; }
      .biz-left { display: flex; flex-direction: row; align-items: center; gap: 6px; }
      .biz-left img { max-height: 36px !important; max-width: 100px !important; }
      .biz-info { display: flex; flex-direction: column; gap: 1px; }
      .biz-name { font-size: 12px; font-weight: 900; letter-spacing: -0.2px; }
      .biz-detail { font-size: 8.5px; color: #444; line-height: 1.35; }
      .biz-right { text-align: right; }
      .doc-type { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
      .doc-num { font-size: 12px; font-weight: 700; margin: 0.5mm 0; }
      .doc-date { font-size: 9px; color: #444; }
      .iva-badge { display: inline-block; margin-top: 1mm; font-size: 7.5px; font-weight: 700; letter-spacing: 0.4px; border: 1px solid #555; padding: 0.5px 4px; color: #333; }
      .copy-label { text-align: center; font-size: 9.5px; font-weight: 900; letter-spacing: 3px; padding: 1mm 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; margin-bottom: 2.5mm; color: #555; }
      /* Cliente compacto */
      .client-section { background: #f8f8f8; border: 1px solid #ddd; padding: 1.5mm 3mm; margin-bottom: 2.5mm; }
      .client-table { width: 100%; border-collapse: collapse; }
      .client-table td { padding: 1px 3px; font-size: 9.5px; }
      .cl { width: 60%; } .cr { width: 40%; }
      .cl-label { font-weight: 700; color: #555; }
      /* Items compacto */
      .items { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
      .items thead tr { border-bottom: 1.5px solid #111; }
      .items thead th { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2px; padding: 1.5mm 2px; color: #333; }
      .items tbody tr { border-bottom: 1px solid #e8e8e8; }
      .items tbody tr:last-child { border-bottom: 1px solid #999; }
      .items td { padding: 1.5mm 2px; vertical-align: middle; font-size: 9.5px; }
      .tc { text-align: center; width: 40px; }
      .cod { font-family: monospace; font-size: 8.5px; color: #555; width: 50px; }
      .desc { text-align: left; }
      .num { text-align: right; font-family: monospace; width: 80px; font-variant-numeric: tabular-nums; }
      /* Totales compacto */
      .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5mm; margin-bottom: 1.5mm; }
      .total-row { display: flex; justify-content: flex-end; gap: 16mm; font-size: 9.5px; min-width: 100mm; }
      .total-row.disc { color: #666; }
      .total-row.grand { font-size: 12px; font-weight: 900; border-top: 1.5px solid #111; padding-top: 1.5mm; margin-top: 0.5mm; }
      .mono { font-family: monospace; font-variant-numeric: tabular-nums; }
      /* Monto en letras compacto */
      .letras { font-size: 8.5px; font-style: italic; color: #444; border-top: 1px dashed #ccc; padding-top: 1.5mm; margin-bottom: 2mm; }
      /* Firma compacto — 1 sola línea */
      .firma-row { display: flex; justify-content: space-between; margin-top: 3mm; gap: 16mm; }
      .firma-box { font-size: 8.5px; color: #555; flex: 1; border-top: 1px solid #888; padding-top: 1mm; }
      /* Línea de corte */
      .cut-line { text-align: center; color: #bbb; font-size: 8px; letter-spacing: 0.5px; margin: 2.5mm 0; border-top: 1px dashed #ccc; padding-top: 1.5mm; }
    `;

    // ── ¿Entran 2 copias en 1 A4 compacto? ──────────────────
    // Con cssCompact: bloque fijo ~68mm + cada item ~4.5mm + descuento 4.5mm
    // A4 usable (5mm margin): 287mm → 2 bloques + corte ≤ 287mm
    // → bloque máx = (287 - 7) / 2 = 140mm → items máx = (140-68)/4.5 ≈ 16
    // En la práctica ser conservador: hasta 8 items con holgura
    const COMPACT_FIXED = 68;
    const COMPACT_ROW = 4.5;
    const COMPACT_DISC = discPct > 0 ? 4.5 : 0;
    const compactBlock = COMPACT_FIXED + d.items.length * COMPACT_ROW + COMPACT_DISC;
    const fitsTwoPerPage = (compactBlock * 2 + 7) <= 287;

    const w = window.open('', '_blank', 'width=900,height=700');
    const docTitle = `Presupuesto N° ${String(d.quote.id).padStart(4, '0')} — ${bizName}`;
    if (fitsTwoPerPage) {
      // ── 2 copias en 1 A4 con CSS compacto ───────────────────
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${docTitle}</title>
        <style>${cssCompact}</style></head><body>
        ${makeBlock('ORIGINAL')}
        <div class="cut-line">✂ · · · · · · · · · · · · cortar aquí · · · · · · · · · · · · ✂</div>
        ${makeBlock('DUPLICADO')}
      </body></html>`);
    } else {
      // ── 1 copia por página con CSS holgado ───────────────────
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${docTitle}</title>
        <style>${cssLoose}</style></head><body>
        ${makeBlock('ORIGINAL')}
        ${makeBlock('DUPLICADO')}
      </body></html>`);
    }
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 350);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este presupuesto?')) return;
    const res = await apiDelete(`/quotes/${id}`);
    if (res.ok) { addToast?.('Presupuesto eliminado.', 'success'); fetchQuotes(); }
    else { addToast?.('Error al eliminar.', 'error'); }
  };

  const showDetail = async (id) => {
    const res = await apiGet(`/quotes/${id}`);
    if (res.ok) setDetail(await res.json());
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0, letterSpacing: '-0.02em' }}>Presupuestos</h2>
        <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Nuevo presupuesto</button>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
        ) : quotes.length === 0 ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>
            No hay presupuestos todavía.<br/>Creá el primero con el botón "Nuevo presupuesto".
          </div>
        ) : (
          quotes.map(q => (
            <div key={q.id} className="ledger-sheet" onClick={() => showDetail(q.id)} style={{
              padding: '14px 20px', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)',
              borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', transition: 'box-shadow 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--lp-shadow-sm)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.95rem' }}>#{q.id} — {q.note || 'Presupuesto'} {q.customer_name ? `· ${q.customer_name}` : ''}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)' }}>{fmtDate(q.created_at)} · {q.list_type === 'b' ? 'Lista B' : 'Lista A'} · Vence {fmtDate(q.expires_at)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: STATUS_MAP[q.status]?.color, background: STATUS_MAP[q.status]?.color + '15', padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--lp-font-mono)' }}>
                  {STATUS_MAP[q.status]?.label || q.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 28, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Nuevo presupuesto</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Cliente (opcional)</label>
                <input value={formCustomer} onChange={e => setFormCustomer(e.target.value)} placeholder="Nombre o ID del cliente"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Validez</label>
                <select value={formValidDays} onChange={e => setFormValidDays(Number(e.target.value))}
                  style={{ padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }}>
                  <option value={7}>7 días</option><option value={15}>15 días</option><option value={30}>30 días</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Lista</label>
                <select value={formListType} onChange={e => setFormListType(e.target.value)}
                  style={{ padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }}>
                  <option value="a">Lista A</option><option value="b">Lista B</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Obra / Referencia</label>
              <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Ej: Obra calle Corrientes 3400"
                style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Forma de pago</label>
                <select value={formFormaPago} onChange={e => setFormFormaPago(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }}>
                  <option value="Contado">Contado</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cuenta corriente">Cuenta corriente</option>
                  <option value="MercadoPago">MercadoPago</option>
                </select>
              </div>
              <div style={{ width: 120 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Descuento %</label>
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={formDiscount} onChange={e => setFormDiscount(e.target.value)}
                  placeholder="0"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none', fontFamily: 'var(--lp-font-mono)' }}
                />
              </div>
            </div>

            {/* Product search */}
            <div style={{ marginBottom: 12 }}>
              <input value={productSearch} onChange={e => handleSearch(e.target.value)} placeholder="Buscar producto... (escribí 2+ letras)"
                style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }} />
              {searchResults.length > 0 && (
                <div style={{ marginTop: 4, maxHeight: 150, overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)', borderRadius: 6 }}>
                  {searchResults.map(p => (
                    <div key={p.id} onClick={() => addItem(p)} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '6px 10px', cursor: 'pointer',
                      fontSize: '0.85rem', borderBottom: '1px solid var(--lp-line)',
                      color: 'var(--lp-ink)', transition: 'background 0.1s',
                    }} onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span>{p.name}</span>
                      <span style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-ink-faint)' }}>${formatPesos(p.price_b || p.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items added */}
            {formItems.length > 0 && (
              <div style={{ marginBottom: 16, borderTop: '1px solid var(--lp-line)', paddingTop: 12 }}>
                {formItems.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '0.85rem', color: 'var(--lp-ink)' }}>
                    <span>{it.product_name} × {it.quantity}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(it.unit_price * it.quantity)}</span>
                      <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                    </div>
                  </div>
                ))}
                {(() => {
                  const disc = parseFloat(formDiscount) || 0;
                  const discAmt = totalQuote * disc / 100;
                  const final = totalQuote - discAmt;
                  return (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--lp-line-strong)' }}>
                      {disc > 0 && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--lp-ink-faint)', marginBottom: 2 }}>
                            <span>Subtotal</span><span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(totalQuote)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--lp-ink-faint)', marginBottom: 4 }}>
                            <span>Descuento {disc}%</span><span style={{ fontFamily: 'var(--lp-font-mono)' }}>- ${formatPesos(discAmt)}</span>
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', color: 'var(--lp-ink)' }}>
                        <span>Total</span>
                        <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(final)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <button onClick={handleCreate} disabled={formItems.length === 0} className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', opacity: formItems.length === 0 ? 0.5 : 1 }}>
              Crear presupuesto
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 28, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Presupuesto #{detail.quote.id}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--lp-ink-faint)', marginBottom: 16 }}>
              <div>Estado: <span style={{ color: STATUS_MAP[detail.quote.status]?.color, fontWeight: 700 }}>{STATUS_MAP[detail.quote.status]?.label}</span></div>
              <div>Creado: {fmtDate(detail.quote.created_at)} · Vence: {fmtDate(detail.quote.expires_at)}</div>
              {detail.quote.note && <div>Obra: {detail.quote.note}</div>}
            </div>

            {/* Items */}
            <div style={{ borderTop: '1px solid var(--lp-line)', paddingTop: 12, marginBottom: 16 }}>
              {detail.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: 'var(--lp-ink)' }}>
                  <span>{it.product_name} × {it.quantity}</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(it.unit_price * it.quantity)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--lp-line-strong)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--lp-ink)' }}>
                <span>Total</span>
                <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(detail.items.reduce((s, i) => s + i.unit_price * i.quantity, 0))}</span>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.quote.status === 'draft' && (
                <>
                  <button onClick={() => handleStatus(detail.quote.id, 'sent')} className="lp-btn lp-btn--ghost" style={{ flex: 1, fontSize: '0.85rem' }}>Enviar</button>
                  <button onClick={() => handleStatus(detail.quote.id, 'approved')} className="lp-btn lp-btn--primary" style={{ flex: 1, fontSize: '0.85rem' }}>Aprobar</button>
                </>
              )}
              {detail.quote.status === 'sent' && (
                <button onClick={() => handleStatus(detail.quote.id, 'approved')} className="lp-btn lp-btn--primary" style={{ flex: 1, fontSize: '0.85rem' }}>Aprobar</button>
              )}
              {detail.quote.status === 'approved' && (
                <button onClick={() => handleStatus(detail.quote.id, 'delivered')} className="lp-btn lp-btn--primary" style={{ flex: 1, fontSize: '0.85rem' }}>Marcar entregado</button>
              )}
              {['draft', 'sent'].includes(detail.quote.status) && (
                <button onClick={() => handleStatus(detail.quote.id, 'rejected')} className="lp-btn lp-btn--ghost" style={{ flex: 1, fontSize: '0.85rem', color: 'var(--lp-red)' }}>Rechazar</button>
              )}
              <button onClick={handleShareWhatsApp} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem', color: '#25D366' }}>📱 WhatsApp</button>
              <button onClick={handlePrint} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem' }}>🖨️ Imprimir</button>
              <button onClick={() => { handleDelete(detail.quote.id); setDetail(null); }} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem', color: 'var(--lp-red)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

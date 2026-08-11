import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/apiClient';
import ClientePicker from '../components/corralon/ClientePicker';
import CatalogModal from '../components/pos/CatalogModal';

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
  const [activeTab, setActiveTab] = useState('all'); // all | draft | sent | approved | delivered | rejected
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = nuevo, número = editar
  const [detail, setDetail] = useState(null);

  // Form state
  const [formCustomer, setFormCustomer] = useState(null); // { id, name, phone, address } | null
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
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);

  const openCatalog = async () => {
    if (catalogProducts.length === 0) {
      const res = await apiGet('/products?limit=5000');
      if (res.ok) { const data = await res.json(); setCatalogProducts(data || []); }
    }
    setShowCatalog(true);
  };

  // Convertir presupuesto → Nota de pedido
  const [showToRemito, setShowToRemito]       = useState(false);
  const [toRemitoCustomer, setToRemitoCustomer] = useState(null);
  const [toRemitoAddress, setToRemitoAddress] = useState('');
  const [toRemitoDriver, setToRemitoDriver]   = useState('');
  const [toRemitoDate, setToRemitoDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [toRemitoLoading, setToRemitoLoading] = useState(false);
  const [creatingAcopio, setCreatingAcopio] = useState(false);

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

  // Precio según lista seleccionada; cae en Lista A (minorista) si la lista pedida no está cargada
  const getListPrice = (p, lt) => {
    const map = { a: p.price, b: p.price_b, c: p.price_c, d: p.price_d, e: p.price_e };
    return parseFloat(map[lt] ?? p.price) || parseFloat(p.price) || 0;
  };

  const addItem = (p) => {
    const qty = parseFloat(productQty) || 1;
    const price = parseFloat(productPrice) || getListPrice(p, formListType);
    setFormItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity: qty, unit_price: price }]);
    setProductSearch('');
    setSearchResults([]);
    setProductQty('1');
    setProductPrice('');
  };

  const removeItem = (i) => setFormItems(prev => prev.filter((_, idx) => idx !== i));

  const totalQuote = formItems.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);

  const resetForm = () => {
    setFormCustomer(null); setFormNote(''); setFormItems([]); setFormListType('a');
    setFormValidDays(15); setFormDiscount(''); setFormFormaPago('Contado');
    setProductSearch(''); setSearchResults([]); setProductQty('1'); setProductPrice('');
    setEditingId(null);
  };

  const openEditForm = async (q) => {
    const res = await apiGet(`/quotes/${q.id}`);
    if (!res.ok) { addToast?.('Error al cargar presupuesto.', 'error'); return; }
    const data = await res.json();
    const quote = data.quote;
    setEditingId(quote.id);
    setFormCustomer(quote.customer_id ? { id: quote.customer_id, name: quote.customer_name || '', phone: quote.customer_phone || '', address: quote.customer_address || '' } : null);
    setFormNote(quote.note || '');
    setFormListType(quote.list_type || 'a');
    setFormValidDays(quote.valid_days || 15);
    setFormDiscount(quote.discount_pct ? String(quote.discount_pct) : '');
    setFormFormaPago(quote.forma_pago || 'Contado');
    setFormItems(data.items.map(it => ({ product_id: it.product_id, product_name: it.product_name, quantity: it.quantity, unit_price: it.unit_price })));
    setDetail(null);
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (formItems.length === 0) { addToast?.('Agregá al menos un producto.', 'error'); return; }
    const body = {
      customer_id: formCustomer?.id ?? null,
      note: formNote,
      list_type: formListType,
      valid_days: formValidDays,
      discount_pct: parseFloat(formDiscount) || 0,
      forma_pago: formFormaPago || 'Contado',
      items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
    };
    const res = editingId
      ? await apiPut(`/quotes/${editingId}`, body)
      : await apiPost('/quotes', body);
    if (res.ok) {
      addToast?.(editingId ? 'Presupuesto actualizado.' : 'Presupuesto creado.', 'success');
      setShowForm(false);
      resetForm();
      fetchQuotes();
    } else { addToast?.(editingId ? 'Error al actualizar.' : 'Error al crear presupuesto.', 'error'); }
  };

const handleStatus = async (id, status) => {
    const res = await apiPost(`/quotes/${id}/status`, { status });
    if (res.ok) { addToast?.(`Estado: ${STATUS_MAP[status]?.label || status}.`, 'success'); fetchQuotes(); }
    else { addToast?.('Error al cambiar estado.', 'error'); }
  };

  // Crear acopio directo desde un presupuesto aprobado
  const handleCreateAcopio = async () => {
    if (!detail || creatingAcopio) return;
    if (!detail.quote.customer_id) {
      addToast?.('El presupuesto necesita un cliente para crear un acopio.', 'error'); return;
    }
    setCreatingAcopio(true);
    try {
      const res = await apiPost('/acopios', {
        customer_id: detail.quote.customer_id,
        quote_id: detail.quote.id,
        items: detail.items.map(it => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
      });
      if (res.ok) {
        addToast?.('✅ Acopio creado. Podés ver las entregas en Acopios.', 'success');
        // Marcar el presupuesto como entregado (en proceso)
        await apiPost(`/quotes/${detail.quote.id}/status`, { status: 'delivered' });
        fetchQuotes();
        setDetail(null);
      } else {
        addToast?.('Error al crear el acopio. Reintentá.', 'error');
      }
    } catch { addToast?.('Sin conexión.', 'error'); }
    setCreatingAcopio(false);
  };

  const handleShareWhatsApp = () => {
    if (!detail) return;
    const d = detail;
    const bizName = JSON.parse(localStorage.getItem('saas_business') || '{}')?.business_name || 'Corralón';
    const total = d.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const lines = d.items.map(it => `${it.product_name} x${it.quantity}: $${formatPesos(it.unit_price * it.quantity)}`).join('\n');
    // Orden: negocio → nro → cliente → obra → items → validez → TOTAL (al final)
    let msg = `*${bizName}* — Presupuesto N° ${d.quote.id}`;
    if (d.quote.customer_name) msg += `\nCliente: ${d.quote.customer_name}`;
    if (d.quote.note) msg += `\nObra: ${d.quote.note}`;
    msg += `\n\n${lines}`;
    msg += `\n\nVálido hasta: ${fmtDate(d.quote.expires_at)}`;
    msg += `\n*TOTAL: $${formatPesos(total)}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handlePrint = () => {
    if (!detail) return;
    const d = detail;

    // ── Datos del negocio ─────────────────────────────────────
    const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
    const cfg = JSON.parse(localStorage.getItem('minegocio_config') || '{}');
    const bizName    = biz.business_name || cfg.nombre || 'Corralón';
    const logoUrl    = cfg.logo_url || '';
    const address    = cfg.direccion || '';
    const phone      = cfg.telefono || '';
    const cuit       = cfg.cuit || '';
    const instagram  = cfg.instagram || '';
    const propietario= cfg.propietario || '';
    const ingBrutos  = cfg.ing_brutos || '';
    const inicioAct  = cfg.inicio_actividades || '';
    const condIva    = cfg.condicion_iva || '';

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

    // ── Header del documento (minimalista) ───────────────────
    const logoImg = logoUrl
      ? `<img src="${logoUrl}" style="max-height:44px;max-width:130px;object-fit:contain;display:block" alt="logo" />`
      : '';

    const makeBlock = (copyLabel) => `
<div class="sheet">
  <div class="doc-header">
    <div class="biz-left">
      ${logoImg}
      <div class="biz-info">
        <div class="biz-name">${bizName}</div>
        ${instagram  ? `<div class="biz-detail biz-social">&#128247; ${instagram}</div>` : ''}
        ${phone      ? `<div class="biz-detail biz-social">&#128222; ${phone}</div>` : ''}
        ${propietario? `<div class="biz-detail">De ${propietario}</div>` : ''}
        ${address    ? `<div class="biz-detail">${address}</div>` : ''}
      </div>
    </div>
    <div class="biz-right">
      <div class="doc-date">${fmtDate(d.quote.created_at || new Date())}</div>
      ${cuit    ? `<div class="biz-detail-r">C.U.I.T.: ${cuit}</div>` : ''}
      ${condIva ? `<div class="biz-detail-r">${condIva.toUpperCase()}</div>` : ''}
    </div>
  </div>

  <!-- Título centrado -->
  <div class="doc-title">
    PRESUPUESTO &nbsp; N° <span class="mono">${String(d.quote.id).padStart(4, '0')}</span>
  </div>

  <!-- Datos del cliente (compacto) -->
  <div class="client-section">
    <div class="cl-row"><span class="cl-label">Cliente:</span> <strong>${d.quote.customer_name || 'CONSUMIDOR FINAL'}</strong>&emsp;<span class="cl-label">Forma de pago:</span> ${d.quote.forma_pago || 'Contado'}</div>
    <div class="cl-row"><span class="cl-label">Obra / Ref.:</span> ${d.quote.note || '—'}&emsp;<span class="cl-label">Válido hasta:</span> ${fmtDate(d.quote.expires_at)}</div>
  </div>

  <!-- Items -->
  <table class="items">
    <thead>
      <tr>
        <th class="tc">Cant.</th>
        <th class="cod">Código</th>
        <th class="desc">Descripción</th>
        <th class="tc">Unidad</th>
        <th class="num">Precio Unit.</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Letras + totales + firma al pie -->
  <div class="letras">SON ${enLetras}</div>

  <div class="bottom-row">
    <div class="firma-box">
      Aclaración: ___________________________<br/>Firma: ___________________________
    </div>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span class="mono">$${formatPesos(subtotal)}</span></div>
      ${discPct > 0 ? `<div class="total-row disc"><span>Descuento ${discPct}%</span><span class="mono">- $${formatPesos(discAmount)}</span></div>` : ''}
      <div class="total-row grand"><span>TOTAL $</span><span class="mono">${formatPesos(finalTotal)}</span></div>
    </div>
  </div>

  <div class="copy-label">${copyLabel}</div>
</div>`;

    // ── CSS landscape: 2 copias lado a lado en A4 horizontal ─
    // A4 landscape usable: 210-2×6mm = 198mm alto; 297-2×8mm = 281mm ancho
    // Cada copia ~136mm; corte 9mm → 136+9+136 = 281 ✓
    const cssLandscape = `
      @page { size: A4 landscape; margin: 6mm 8mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; background: #fff; }

      /* Layout: 2 columnas + corte vertical */
      .page-wrap { display: flex; width: 100%; align-items: stretch; gap: 0; }
      .sheet { flex: 1; border: 1px solid #bbb; padding: 5mm 6mm; display: flex; flex-direction: column; }
      .cut-col { width: 9mm; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }
      .cut-col-line { flex: 1; border-left: 1px dashed #ccc; }
      .cut-scissors { font-size: 10px; color: #bbb; padding: 2mm 0; writing-mode: vertical-rl; letter-spacing: 1px; }

      /* Header */
      .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2mm; padding-bottom: 2mm; border-bottom: 1.5px solid #111; }
      .biz-left { display: flex; flex-direction: row; align-items: center; gap: 5px; }
      .biz-left img { max-height: 38px !important; max-width: 110px !important; object-fit: contain; }
      .biz-info { display: flex; flex-direction: column; gap: 1px; }
      .biz-name { font-size: 12px; font-weight: 900; letter-spacing: -0.2px; }
      .biz-detail { font-size: 8px; color: #444; line-height: 1.35; }
      .biz-social { font-size: 8.5px; color: #222; font-weight: 600; }
      .biz-right { text-align: right; font-size: 8px; color: #444; }
      .doc-date { font-size: 9px; font-weight: 700; color: #111; margin-bottom: 1px; }
      .biz-detail-r { font-size: 7.5px; color: #444; line-height: 1.4; }

      /* Título */
      .doc-title { text-align: center; font-size: 14px; font-weight: 900; letter-spacing: 0.5px; padding: 2mm 0 2.5mm; border-bottom: 1px solid #e0e0e0; margin-bottom: 2.5mm; }
      .mono { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }

      /* Cliente */
      .client-section { background: #f8f8f8; border: 1px solid #e0e0e0; padding: 2mm 3mm; margin-bottom: 2.5mm; }
      .cl-row { font-size: 9px; line-height: 1.7; }
      .cl-label { font-weight: 700; color: #555; }

      /* Items */
      .items { width: 100%; border-collapse: collapse; margin-bottom: 2mm; flex-shrink: 0; }
      .items thead tr { border-bottom: 1.5px solid #111; }
      .items thead th { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2px; padding: 1.5mm 2px; color: #333; text-align: left; }
      .items tbody tr { border-bottom: 1px solid #ebebeb; }
      .items tbody tr:last-child { border-bottom: 1px solid #aaa; }
      .items td { padding: 1.5mm 2px; font-size: 9px; vertical-align: middle; }
      .tc { text-align: center; width: 36px; }
      .cod { font-family: 'Courier New', monospace; font-size: 8px; color: #555; width: 44px; text-align: center; }
      .desc { text-align: left; }
      .num { text-align: right; font-family: 'Courier New', monospace; width: 76px; font-variant-numeric: tabular-nums; }
      th.num { font-family: Arial, sans-serif; }

      /* Letras */
      .letras { font-size: 7.5px; font-style: italic; color: #555; border-top: 1px dashed #ccc; padding-top: 1.5mm; margin-bottom: 2.5mm; }

      /* Fila inferior: firma izquierda | totales derecha */
      .bottom-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; gap: 8mm; }
      .firma-box { font-size: 8.5px; color: #555; border-top: 1px solid #999; padding-top: 2mm; flex: 1; line-height: 2; }
      .totals { display: flex; flex-direction: column; gap: 1mm; }
      .total-row { display: flex; justify-content: flex-end; gap: 8mm; font-size: 9px; min-width: 64mm; }
      .total-row.disc { color: #777; }
      .total-row.grand { font-size: 12px; font-weight: 900; border-top: 1.5px solid #111; padding-top: 1.5mm; margin-top: 1mm; }

      /* Etiqueta copia */
      .copy-label { text-align: center; font-size: 7.5px; font-weight: 700; letter-spacing: 3px; color: #aaa; padding-top: 2.5mm; margin-top: 2.5mm; border-top: 1px solid #eee; }
    `;

    // ── CSS portrait: 1 copia por página cuando no entra en landscape ─
    // A4 portrait usable: 297-2×8mm = 281mm alto; 210-2×10mm = 190mm ancho
    const cssPortrait = `
      @page { size: A4 portrait; margin: 8mm 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #111; background: #fff; }
      .sheet { border: 1px solid #bbb; padding: 7mm 9mm; page-break-after: always; page-break-inside: avoid; display: flex; flex-direction: column; min-height: 263mm; }
      .sheet:last-child { page-break-after: avoid; }
      .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3.5mm; padding-bottom: 3.5mm; border-bottom: 2px solid #111; }
      .biz-left { display: flex; flex-direction: row; align-items: center; gap: 7px; }
      .biz-left img { max-height: 48px !important; max-width: 140px !important; object-fit: contain; }
      .biz-info { display: flex; flex-direction: column; gap: 2px; }
      .biz-name { font-size: 14px; font-weight: 900; letter-spacing: -0.2px; }
      .biz-detail { font-size: 9px; color: #444; line-height: 1.4; }
      .biz-social { font-size: 9.5px; color: #222; font-weight: 600; }
      .biz-right { text-align: right; font-size: 9px; color: #444; }
      .doc-date { font-size: 11px; font-weight: 700; color: #111; margin-bottom: 2px; }
      .biz-detail-r { font-size: 8.5px; color: #444; line-height: 1.45; }
      .doc-title { text-align: center; font-size: 17px; font-weight: 900; letter-spacing: 0.5px; padding: 3mm 0; border-bottom: 1px solid #e0e0e0; margin-bottom: 4mm; }
      .mono { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
      .client-section { background: #f8f8f8; border: 1px solid #e0e0e0; padding: 3mm 4mm; margin-bottom: 4mm; }
      .cl-row { font-size: 10px; line-height: 1.85; }
      .cl-label { font-weight: 700; color: #555; }
      .items { width: 100%; border-collapse: collapse; margin-bottom: 3.5mm; }
      .items thead tr { border-bottom: 2px solid #111; }
      .items thead th { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 2.5mm 3px; color: #333; text-align: left; }
      .items tbody tr { border-bottom: 1px solid #ebebeb; }
      .items tbody tr:last-child { border-bottom: 1px solid #aaa; }
      .items td { padding: 2.5mm 3px; font-size: 10px; vertical-align: middle; }
      .tc { text-align: center; width: 42px; }
      .cod { font-family: 'Courier New', monospace; font-size: 9px; color: #555; width: 54px; text-align: center; }
      .desc { text-align: left; }
      .num { text-align: right; font-family: 'Courier New', monospace; width: 88px; font-variant-numeric: tabular-nums; }
      th.num { font-family: Arial, sans-serif; }
      .letras { font-size: 8.5px; font-style: italic; color: #555; border-top: 1px dashed #ccc; padding-top: 2mm; margin-bottom: 3.5mm; }
      .bottom-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; gap: 12mm; }
      .firma-box { font-size: 9.5px; color: #555; border-top: 1px solid #999; padding-top: 3mm; flex: 1; line-height: 2.2; }
      .totals { display: flex; flex-direction: column; gap: 1.5mm; }
      .total-row { display: flex; justify-content: flex-end; gap: 12mm; font-size: 10px; min-width: 82mm; }
      .total-row.disc { color: #777; }
      .total-row.grand { font-size: 14px; font-weight: 900; border-top: 2px solid #111; padding-top: 2mm; margin-top: 1.5mm; }
      .copy-label { text-align: center; font-size: 9px; font-weight: 700; letter-spacing: 3px; color: #aaa; padding-top: 3mm; margin-top: 3mm; border-top: 1px solid #eee; }
    `;

    // ── Threshold inteligente ─────────────────────────────────
    // Estimación: contenido fijo ~62mm + cada fila ~5.8mm + descuento ~4mm
    // Landscape usable alto: 193mm (198mm - 5mm buffer de seguridad)
    const LS_FIXED = 62, LS_ROW = 5.8, LS_DISC = discPct > 0 ? 4 : 0;
    const estimatedH = LS_FIXED + d.items.length * LS_ROW + LS_DISC;
    const useLandscape = estimatedH <= 193;

    const w = window.open('', '_blank', useLandscape ? 'width=1050,height=700' : 'width=820,height=900');
    const docTitle = `Presupuesto N° ${String(d.quote.id).padStart(4, '0')} — ${bizName}`;

    if (useLandscape) {
      // 2 copias lado a lado, 1 hoja A4 apaisada
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${docTitle}</title>
        <style>${cssLandscape}</style></head><body>
        <div class="page-wrap">
          ${makeBlock('ORIGINAL')}
          <div class="cut-col">
            <div class="cut-col-line"></div>
            <div class="cut-scissors">✂ cortar ✂</div>
            <div class="cut-col-line"></div>
          </div>
          ${makeBlock('DUPLICADO')}
        </div>
      </body></html>`);
    } else {
      // 1 copia por página, 2 páginas A4 vertical
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${docTitle}</title>
        <style>${cssPortrait}</style></head><body>
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

  const handleToRemito = async () => {
    if (!detail) return;
    if (!toRemitoCustomer) { addToast?.('Seleccioná un cliente.', 'error'); return; }
    setToRemitoLoading(true);
    const res = await apiPost(`/quotes/${detail.quote.id}/to-remito`, {
      customer_id: toRemitoCustomer.id,
      address: toRemitoAddress.trim(),
      driver: toRemitoDriver.trim(),
      scheduled_date: toRemitoDate,
    });
    if (res.ok) {
      const data = await res.json();
      addToast?.(`✅ Nota de pedido N° ${data.remito_id} creada.`, 'success');
      setShowToRemito(false);
      setDetail(null);
      fetchQuotes();
    } else {
      const err = await res.json().catch(() => ({}));
      addToast?.(err.detail || 'Error al convertir.', 'error');
    }
    setToRemitoLoading(false);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0, letterSpacing: '-0.02em' }}>Presupuestos</h2>
        <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Nuevo presupuesto</button>
      </div>

      {/* Tabs de estado */}
      {(() => {
        const TABS = [
          { key: 'all', label: 'Todos' },
          { key: 'draft', label: 'Borrador' },
          { key: 'sent', label: 'Enviado' },
          { key: 'approved', label: 'Aprobado' },
          { key: 'delivered', label: 'Entregado' },
          { key: 'rejected', label: 'Rechazado' },
        ];
        const counts = {};
        quotes.forEach(q => { counts[q.status] = (counts[q.status] || 0) + 1; });
        return (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, overflowX: 'auto', paddingBottom: 4 }}>
            {TABS.map(t => {
              const cnt = t.key === 'all' ? quotes.length : (counts[t.key] || 0);
              const active = activeTab === t.key;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none', flexShrink: 0,
                  background: active ? 'var(--lp-primary)' : 'var(--lp-paper-sunken)',
                  color: active ? 'white' : 'var(--lp-ink-faint)',
                }}>
                  {t.label}{cnt > 0 && !active ? ` (${cnt})` : ''}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Lista */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
        ) : quotes.filter(q => activeTab === 'all' || q.status === activeTab).length === 0 ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>
            {quotes.length === 0 ? <>No hay presupuestos todavía.<br/>Creá el primero con el botón "Nuevo presupuesto".</> : 'No hay presupuestos en este estado.'}
          </div>
        ) : (
          <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
            {quotes.filter(q => activeTab === 'all' || q.status === activeTab).map(q => {
              let listLabel = 'Lista A';
              try {
                const cfg = JSON.parse(localStorage.getItem('minegocio_config') || '{}');
                listLabel = { a: cfg.price_list_a_name || 'Lista A', b: cfg.price_list_b_name || 'Lista B', c: cfg.price_list_c_name || 'Lista C', d: cfg.price_list_d_name || 'Lista D', e: cfg.price_list_e_name || 'Lista E' }[q.list_type] || ('Lista ' + (q.list_type || 'a').toUpperCase());
              } catch {}
              return (
                <div key={q.id} className="ledger-row ledger-row--hover" onClick={() => showDetail(q.id)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {q.note || 'Sin referencia'}{q.customer_name ? ` · ${q.customer_name}` : ''}
                    </div>
                    <div className="ledger-label" style={{ marginTop: 2 }}>
                      #{q.id} · {fmtDate(q.created_at)} · {listLabel} · Vence {fmtDate(q.expires_at)}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color: STATUS_MAP[q.status]?.color, background: STATUS_MAP[q.status]?.color + '18', padding: '3px 10px', borderRadius: 20, flexShrink: 0, marginLeft: 12 }}>
                    {STATUS_MAP[q.status]?.label || q.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 28, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>
                {editingId ? `Editar presupuesto #${editingId}` : 'Nuevo presupuesto'}
              </h3>
              <button onClick={() => { setShowForm(false); resetForm(); }} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Cliente (opcional)</label>
                <ClientePicker selected={formCustomer} onSelect={setFormCustomer} placeholder="Buscar o crear cliente..." />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Validez</label>
                <select value={formValidDays} onChange={e => setFormValidDays(Number(e.target.value))}
                  style={{ padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }}>
                  <option value={7}>7 días</option><option value={15}>15 días</option><option value={30}>30 días</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Lista de precios</label>
                {(() => {
                  let cfg = {};
                  try { cfg = JSON.parse(localStorage.getItem('minegocio_config') || '{}'); } catch {}
                  const lists = [
                    { v: 'a', label: cfg.price_list_a_name || 'Lista A — Minorista' },
                    { v: 'b', label: cfg.price_list_b_name || 'Lista B — Mayorista' },
                    { v: 'c', label: cfg.price_list_c_name || 'Lista C' },
                    { v: 'd', label: cfg.price_list_d_name || 'Lista D' },
                    { v: 'e', label: cfg.price_list_e_name || 'Lista E' },
                  ];
                  return (
                    <select value={formListType} onChange={e => setFormListType(e.target.value)}
                      style={{ padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none', maxWidth: 180 }}>
                      {lists.map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
                    </select>
                  );
                })()}
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

            {/* Product search + qty/precio */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input value={productSearch} onChange={e => handleSearch(e.target.value)} placeholder="Buscar producto... (escribí 2+ letras)"
                  style={{ flex: 1, padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }} />
                <button onClick={openCatalog} title="Ver catálogo por categoría" style={{ padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  Catálogo
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.68rem', color: 'var(--lp-ink-faint)', fontWeight: 600, marginBottom: 2 }}>Cant.</label>
                  <input type="number" min="0.001" step="any" value={productQty} onChange={e => setProductQty(e.target.value)}
                    style={{ width: 70, padding: '8px 8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none', fontFamily: 'var(--lp-font-mono)', textAlign: 'right' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.68rem', color: 'var(--lp-ink-faint)', fontWeight: 600, marginBottom: 2 }}>Precio</label>
                  <input type="number" min="0" step="any" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="auto"
                    style={{ width: 90, padding: '8px 8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none', fontFamily: 'var(--lp-font-mono)', textAlign: 'right' }} />
                </div>
              </div>
              {searchResults.length > 0 && (
                <div style={{ marginTop: 4, maxHeight: 150, overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)', borderRadius: 6 }}>
                  {searchResults.map(p => {
                    const lp = getListPrice(p, formListType);
                    const base = parseFloat(p.price) || 0;
                    const isDiff = lp !== base;
                    return (
                      <div key={p.id} onClick={() => addItem(p)} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', cursor: 'pointer',
                        fontSize: '0.85rem', borderBottom: '1px solid var(--lp-line)',
                        color: 'var(--lp-ink)', transition: 'background 0.1s',
                      }} onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span>{p.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isDiff && (
                            <span style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-ink-faint)', fontSize: '0.75rem', textDecoration: 'line-through' }}>${formatPesos(base)}</span>
                          )}
                          <span style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-primary)', fontWeight: 700 }}>${formatPesos(lp)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Items added */}
            {formItems.length > 0 && (
              <div style={{ marginBottom: 16, borderTop: '1px solid var(--lp-line)', paddingTop: 12 }}>
                {/* header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px auto', gap: 6, padding: '0 0 4px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--lp-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Producto</span><span style={{ textAlign: 'right' }}>Cant.</span><span style={{ textAlign: 'right' }}>P. Unit.</span><span />
                </div>
                {formItems.map((it, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px auto', gap: 6, alignItems: 'center', padding: '3px 0', fontSize: '0.85rem', color: 'var(--lp-ink)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product_name}</span>
                    <input type="number" min="0.001" step="any" value={it.quantity}
                      onChange={e => setFormItems(prev => prev.map((x, idx) => idx === i ? { ...x, quantity: parseFloat(e.target.value) || 1 } : x))}
                      style={{ padding: '4px 6px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 4, color: 'var(--lp-ink)', fontSize: '0.85rem', fontFamily: 'var(--lp-font-mono)', textAlign: 'right', outline: 'none', width: '100%' }} />
                    <input type="number" min="0" step="any" value={it.unit_price}
                      onChange={e => setFormItems(prev => prev.map((x, idx) => idx === i ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))}
                      style={{ padding: '4px 6px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 4, color: 'var(--lp-ink)', fontSize: '0.85rem', fontFamily: 'var(--lp-font-mono)', textAlign: 'right', outline: 'none', width: '100%' }} />
                    <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px' }}>✕</button>
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
              {editingId ? 'Guardar cambios' : 'Crear presupuesto'}
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setDetail(null); setShowToRemito(false); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 28, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Presupuesto #{detail.quote.id}</h3>
              <button onClick={() => { setDetail(null); setShowToRemito(false); }} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--lp-ink-faint)', marginBottom: 16 }}>
              <div>Estado: <span style={{ color: STATUS_MAP[detail.quote.status]?.color, fontWeight: 700 }}>{STATUS_MAP[detail.quote.status]?.label}</span></div>
              <div>Creado: {fmtDate(detail.quote.created_at)} · Vence: {fmtDate(detail.quote.expires_at)}</div>
              {detail.quote.customer_name && <div>Cliente: <strong style={{ color: 'var(--lp-ink)' }}>{detail.quote.customer_name}</strong></div>}
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
              {detail.quote.status === 'approved' && !showToRemito && (
                <>
                  {/* Dos opciones principales: nota de pedido (entrega total) o acopio (entregas parciales) */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--lp-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Presupuesto aprobado — ¿Cómo continúa?
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => {
                        const custAddr = detail.quote.customer_address || '';
                        setToRemitoAddress(custAddr);
                        setToRemitoCustomer(detail.quote.customer_id ? { id: detail.quote.customer_id, name: detail.quote.customer_name || '', phone: detail.quote.customer_phone || '', address: custAddr } : null);
                        setToRemitoDriver('');
                        setToRemitoDate(new Date().toISOString().slice(0, 10));
                        setShowToRemito(true);
                      }} className="lp-btn lp-btn--primary" style={{ flex: 1, fontSize: '0.82rem', fontWeight: 800 }}>
                        📋 Nota de pedido
                        <div style={{ fontSize: '0.68rem', fontWeight: 400, opacity: 0.8 }}>Entrega total de una vez</div>
                      </button>
                      <button onClick={handleCreateAcopio} disabled={creatingAcopio || !detail.quote.customer_id} className="lp-btn lp-btn--primary"
                        style={{ flex: 1, fontSize: '0.82rem', fontWeight: 800, background: 'rgba(20,187,166,0.15)', color: 'var(--lp-primary)', border: '1.5px solid var(--lp-primary)', opacity: creatingAcopio ? 0.6 : 1 }}>
                        📦 Crear Acopio
                        <div style={{ fontSize: '0.68rem', fontWeight: 400, opacity: 0.8 }}>Entregas parciales</div>
                      </button>
                    </div>
                    <button onClick={() => handleStatus(detail.quote.id, 'delivered')} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.82rem' }}>Entregado sin remito</button>
                  </div>
                </>
              )}
              {detail.quote.status === 'approved' && showToRemito && (
                <div style={{ width: '100%', background: 'var(--lp-paper-sunken)', border: '1.5px solid rgba(20,187,166,0.35)', borderRadius: 10, padding: 16, marginTop: 4 }}>
                  <div style={{ fontWeight: 800, color: 'var(--lp-primary)', fontSize: '0.9rem', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Nueva Nota de pedido</span>
                    <button onClick={() => { setShowToRemito(false); setToRemitoCustomer(null); }} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 3 }}>Cliente *</label>
                    <ClientePicker
                      selected={toRemitoCustomer}
                      onSelect={c => {
                        setToRemitoCustomer(c);
                        if (c?.address) setToRemitoAddress(c.address);
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 3 }}>Dirección de entrega</label>
                    <input value={toRemitoAddress} onChange={e => setToRemitoAddress(e.target.value)} placeholder="Calle / Obra"
                      style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.88rem', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 3 }}>Chofer (opcional)</label>
                    <input value={toRemitoDriver} onChange={e => setToRemitoDriver(e.target.value)} placeholder="Nombre del chofer"
                      style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.88rem', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 3 }}>Fecha de despacho</label>
                    <input type="date" value={toRemitoDate} onChange={e => setToRemitoDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.88rem', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowToRemito(false); setToRemitoCustomer(null); }} className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
                    <button onClick={handleToRemito} disabled={toRemitoLoading || !toRemitoCustomer} className="lp-btn lp-btn--primary"
                      style={{ flex: 2, opacity: (toRemitoLoading || !toRemitoCustomer) ? 0.6 : 1, fontWeight: 800 }}>
                      {toRemitoLoading ? 'Creando...' : 'Confirmar y crear'}
                    </button>
                  </div>
                </div>
              )}
              {['draft', 'sent'].includes(detail.quote.status) && (
                <button onClick={() => handleStatus(detail.quote.id, 'rejected')} className="lp-btn lp-btn--ghost" style={{ flex: 1, fontSize: '0.85rem', color: 'var(--lp-red)' }}>Rechazar</button>
              )}
              <button onClick={() => openEditForm(detail.quote)} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem' }}>✏️ Editar</button>
              <button onClick={handleShareWhatsApp} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem', color: '#25D366' }}>WhatsApp</button>
              <button onClick={handlePrint} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem' }}>Imprimir</button>
              <button onClick={() => { handleDelete(detail.quote.id); setDetail(null); setShowToRemito(false); }} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem', color: 'var(--lp-red)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showCatalog && (
        <CatalogModal
          products={catalogProducts}
          onSelect={p => { addItem(p); }}
          onClose={() => setShowCatalog(false)}
          getPrice={p => getListPrice(p, formListType)}
          title="Catálogo — elegí un producto"
        />
      )}
    </div>
  );
}

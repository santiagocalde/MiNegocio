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
      items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
    };
    const res = await apiPost('/quotes', body);
    if (res.ok) {
      addToast?.('Presupuesto creado.', 'success');
      setShowForm(false);
      setFormCustomer(''); setFormNote(''); setFormItems([]); setFormListType('a'); setFormValidDays(15);
      fetchQuotes();
    } else { addToast?.('Error al crear presupuesto.', 'error'); }
  };

const handleStatus = async (id, status) => {
    const res = await apiPost(`/quotes/${id}/status`, { status });
    if (res.ok) { addToast?.(`Estado: ${STATUS_MAP[status]?.label || status}.`, 'success'); fetch(); }
    else { addToast?.('Error al cambiar estado.', 'error'); }
  };

  const handlePrint = () => {
    if (!detail) return;
    const d = detail;
    const items = d.items.map(it =>
      `<tr><td style="padding:4px 0">${it.product_name}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right;font-family:monospace">$${formatPesos(it.unit_price)}</td><td style="text-align:right;font-family:monospace">$${formatPesos(it.unit_price * it.quantity)}</td></tr>`
    ).join('');
    const total = d.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const block = (label) => `
      <div style="border:1px solid #ccc;padding:12mm;margin-bottom:5mm">
        <div style="text-align:center;font-weight:900;font-size:14px;margin-bottom:6mm;letter-spacing:2px">${label}</div>
        <div style="font-size:13px;margin-bottom:4mm"><strong>Presupuesto N° ${d.quote.id}</strong></div>
        <div style="font-size:12px;margin-bottom:2mm">Cliente: ${d.quote.customer_name || '—'}</div>
        <div style="font-size:12px;margin-bottom:2mm">Obra: ${d.quote.note || '—'}</div>
        <div style="font-size:12px;margin-bottom:2mm">Lista: ${d.quote.list_type === 'b' ? 'B (Contratista)' : 'A (Público)'}</div>
        <div style="font-size:12px;margin-bottom:2mm">Válido hasta: ${fmtDate(d.quote.expires_at)}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:6mm;font-size:12px">
          <tr style="border-bottom:2px solid #333"><th style="text-align:left;padding:4px 0">Producto</th><th style="text-align:center">Cant</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th></tr>
          ${items}
          <tr style="border-top:2px solid #333"><td colspan="3" style="text-align:right;font-weight:700;padding:6px 0">TOTAL</td><td style="text-align:right;font-weight:900;font-family:monospace;font-size:15px">$${formatPesos(total)}</td></tr>
        </table>
        <div style="margin-top:12mm;font-size:11px;text-align:center">Firma: ___________________________</div>
      </div>`;

    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Presupuesto N° ${d.quote.id}</title>
      <style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;color:#111;margin:0;padding:10mm}</style></head><body>
      ${block('ORIGINAL')}
      <div style="border-top:1px dashed #999;margin:8mm 0;text-align:center;color:#999;font-size:10px">- - - cortar aquí - - -</div>
      ${block('DUPLICADO')}
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
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
              <label style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nota / Obra</label>
              <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Ej: Obra calle Corrientes 3400"
                style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' }} />
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
                <div style={{ borderTop: '1px solid var(--lp-line-strong)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', color: 'var(--lp-ink)' }}>
                  <span>Total</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(totalQuote)}</span>
                </div>
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
              <button onClick={handlePrint} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem' }}>🖨️ Imprimir</button>
              <button onClick={() => { handleDelete(detail.quote.id); setDetail(null); }} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.85rem', color: 'var(--lp-red)' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

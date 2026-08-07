import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import ClientePicker from '../components/corralon/ClientePicker';

const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—';

export default function CreditNotesModule() {
  const { addToast } = usePanelContext();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);

  // Form
  const [formCustomer, setFormCustomer] = useState(null);
  const [formReason, setFormReason] = useState('');
  const [formItems, setFormItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [qtyManual, setQtyManual] = useState('1');
  const [priceManual, setPriceManual] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await apiGet('/credit-notes'); if (r.ok) setNotes(await r.json()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSearch = async (q) => {
    setProductSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const r = await apiGet(`/products?q=${encodeURIComponent(q)}&limit=8`);
    if (r.ok) setSearchResults(await r.json() || []);
  };

  const addItem = (p) => {
    setFormItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity: parseFloat(qtyManual) || 1, unit_price: parseFloat(priceManual) || p.price || 0 }]);
    setProductSearch(''); setSearchResults([]); setQtyManual('1'); setPriceManual('');
  };

  const handleCreate = async () => {
    if (formItems.length === 0) return;
    const r = await apiPost('/credit-notes', {
      customer_id: formCustomer?.id ?? null,
      reason: formReason,
      items: formItems.map(i => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
    });
    if (r.ok) { addToast?.('Nota de crédito creada.', 'success'); setShowForm(false); setFormItems([]); setFormCustomer(null); setFormReason(''); fetch(); }
    else addToast?.('Error.', 'error');
  };

  const showDetail = async (id) => {
    const r = await apiGet(`/credit-notes/${id}`);
    if (r.ok) setDetail(await r.json());
  };

  const totalFrom = (items) => items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0, letterSpacing: '-0.02em' }}>Notas de Crédito</h2>
        <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>Nueva devolución</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
        ) : notes.length === 0 ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>No hay notas de crédito.</div>
        ) : (
          <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
            {notes.map(n => (
              <div key={n.id} className="ledger-row ledger-row--hover" onClick={() => showDetail(n.id)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    {n.customer_name || 'Sin cliente'}
                  </div>
                  <div className="ledger-label" style={{ marginTop: 2 }}>
                    NC #{n.id} · {fmtDate(n.created_at)}{n.reason ? ` · ${n.reason}` : ''}
                  </div>
                </div>
                <div className="ledger-num" style={{ color: 'var(--accent-success)', fontSize: '1rem', fontWeight: 700, flexShrink: 0 }}>
                  ${formatPesos(n.total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onMouseDown={e => { if (e.target === e.currentTarget) { setShowForm(false); setFormCustomer(null); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: '0 0 12px' }}>Nueva devolución</h3>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Cliente (opcional)</label>
              <ClientePicker selected={formCustomer} onSelect={setFormCustomer} placeholder="Buscar cliente…" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Motivo</label>
              <input value={formReason} onChange={e => setFormReason(e.target.value)} placeholder="Ej: material sobrante de obra" style={{ width: '100%', padding: '8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', outline: 'none' }} />
            </div>
            <input value={productSearch} onChange={e => handleSearch(e.target.value)} placeholder="Buscar producto..." style={{ width: '100%', padding: '8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', marginBottom: 8, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input value={qtyManual} onChange={e => setQtyManual(e.target.value)} placeholder="Cant" style={{ width: 60, padding: '8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', textAlign: 'center', outline: 'none' }} />
              <input value={priceManual} onChange={e => setPriceManual(e.target.value)} placeholder="Precio" style={{ width: 80, padding: '8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', textAlign: 'center', outline: 'none' }} />
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginBottom: 8, maxHeight: 120, overflow: 'auto', border: '1px solid var(--lp-line)', borderRadius: 6 }}>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => addItem(p)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid var(--lp-line)', color: 'var(--lp-ink)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{p.name} · ${formatPesos(p.price)}</div>
                ))}
              </div>
            )}
            {formItems.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', fontSize: '0.82rem', color: 'var(--lp-ink)' }}>
                <span style={{ flex: 1 }}>{it.product_name} × {it.quantity}</span>
                <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(it.unit_price * it.quantity)}</span>
                <button onClick={() => setFormItems(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            {formItems.length > 0 && <div style={{ borderTop: '1px solid var(--lp-line-strong)', marginTop: 6, paddingTop: 6, fontWeight: 700, color: 'var(--lp-ink)' }}>Total: ${formatPesos(totalFrom(formItems))}</div>}
            <button onClick={handleCreate} disabled={formItems.length === 0} className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '12px', marginTop: 12, opacity: formItems.length === 0 ? 0.5 : 1 }}>Crear nota de crédito</button>
            <button onClick={() => { setShowForm(false); setFormCustomer(null); }} className="lp-btn lp-btn--ghost" style={{ width: '100%', marginTop: 8 }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Detail */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 450, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>NC #{detail.credit_note.id}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', marginBottom: 12 }}>
              {detail.credit_note.customer_name && <div>Cliente: {detail.credit_note.customer_name}</div>}
              {detail.credit_note.reason && <div>Motivo: {detail.credit_note.reason}</div>}
              <div>Total acreditado: <strong style={{ color: 'var(--lp-green)' }}>${formatPesos(detail.credit_note.total)}</strong></div>
            </div>
            <div style={{ borderTop: '1px solid var(--lp-line)', paddingTop: 10 }}>
              {detail.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: 'var(--lp-ink)' }}>
                  <span>{it.product_name} × {it.quantity}</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(it.unit_price * it.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

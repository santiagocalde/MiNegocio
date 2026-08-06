import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';

const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—';

export default function AcopiosModule() {
  const { addToast } = usePanelContext();
  const [acopios, setAcopios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [showWithdrawal, setShowWithdrawal] = useState(null);
  const [withdrawalItems, setWithdrawalItems] = useState({});

  // Form
  const [formItems, setFormItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const r = await apiGet('/acopios?status=active'); if (r.ok) setAcopios(await r.json()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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
    if (formItems.length === 0) return;
    const r = await apiPost('/acopios', { items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })) });
    if (r.ok) { addToast?.('Acopio creado.', 'success'); setShowForm(false); setFormItems([]); fetch(); }
    else addToast?.('Error.', 'error');
  };

  const showDetail = async (id) => {
    const r = await apiGet(`/acopios/${id}`);
    if (r.ok) setDetail(await r.json());
  };

  const handleWithdrawal = async () => {
    if (!showWithdrawal) return;
    const items = Object.entries(withdrawalItems).filter(([, q]) => parseFloat(q) > 0).map(([k, q]) => ({ acopio_item_id: parseInt(k), quantity: parseFloat(q) }));
    if (items.length === 0) return;
    const r = await apiPost(`/acopios/${showWithdrawal}/withdrawals`, { items });
    if (r.ok) { addToast?.('Retiro registrado.', 'success'); setShowWithdrawal(null); setWithdrawalItems({}); fetch(); if (detail) showDetail(detail.acopio.id); }
    else addToast?.('Error.', 'error');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0, letterSpacing: '-0.02em' }}>Acopios</h2>
        <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>Nuevo acopio</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading ? <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div> :
         acopios.length === 0 ? <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>No hay acopios activos.</div> :
         acopios.map(a => (
          <div key={a.id} className="ledger-sheet" onClick={() => showDetail(a.id)} style={{ padding: '12px 18px', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.9rem' }}>Acopio #{a.id}{a.customer_name ? ` · ${a.customer_name}` : ''}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)' }}>{fmtDate(a.created_at)}</div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, color: 'var(--lp-amber)', background: 'rgba(245,158,11,0.12)' }}>Pendiente</span>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: '0 0 12px' }}>Nuevo acopio</h3>
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
            <button onClick={handleCreate} disabled={formItems.length === 0} className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '12px', marginTop: 12, opacity: formItems.length === 0 ? 0.5 : 1 }}>
              Crear acopio (descuenta stock)
            </button>
            <button onClick={() => setShowForm(false)} className="lp-btn lp-btn--ghost" style={{ width: '100%', marginTop: 8 }}>Cancelar</button>
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
            {showWithdrawal === detail.acopio.id ? (
              <div>
                {detail.items.filter(it => it.quantity_retirada < it.quantity_total).map(it => (
                  <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: '0.82rem' }}>
                    <span style={{ flex: 1 }}>{it.product_name} (disp: {it.quantity_total - it.quantity_retirada})</span>
                    <input type="number" value={withdrawalItems[it.id] || ''} onChange={e => setWithdrawalItems(p => ({ ...p, [it.id]: e.target.value }))} placeholder="0" style={{ width: 60, padding: '4px 8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 4, color: 'var(--lp-ink)', textAlign: 'center', outline: 'none' }} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setShowWithdrawal(null); setWithdrawalItems({}); }} className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
                  <button onClick={handleWithdrawal} className="lp-btn lp-btn--primary" style={{ flex: 1 }}>Registrar retiro</button>
                </div>
              </div>
            ) : (
              detail.acopio.status === 'active' && (
                <button onClick={() => setShowWithdrawal(detail.acopio.id)} className="lp-btn lp-btn--primary" style={{ width: '100%' }}>Registrar retiro</button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

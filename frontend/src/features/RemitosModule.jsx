import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';

const STATUS_MAP = {
  pending:    { label: 'Pendiente',  color: 'var(--lp-amber)' },
  en_camino:  { label: 'En camino', color: '#3B82F6' },
  delivered:  { label: 'Entregado', color: 'var(--lp-green)' },
  failed:     { label: 'Fallido',   color: 'var(--lp-red)' },
};

const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (s) => { if (!s) return '—'; return new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }); };

export default function RemitosModule() {
  const { addToast } = usePanelContext();
  const [remitos, setRemitos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState(''); // '' = todos, 'today' = despacho del día

  // Form
  const [formAddress, setFormAddress] = useState('');
  const [formDriver, setFormDriver] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formItems, setFormItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const fetchRemitos = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/remitos?limit=200';
      if (filter === 'today') url += '&fecha=' + new Date().toISOString().slice(0, 10);
      const res = await apiGet(url);
      if (res.ok) setRemitos(await res.json());
    } catch { /* offline */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchRemitos(); }, [fetchRemitos]);

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
      addToast?.('Remito creado.', 'success');
      setShowForm(false); setFormAddress(''); setFormDriver(''); setFormItems([]);
      fetchRemitos();
    } else { addToast?.('Error.', 'error'); }
  };

  const handleStatus = async (id, status) => {
    const res = await apiPost(`/remitos/${id}/status`, { status });
    if (res.ok) { addToast?.(`Remito ${STATUS_MAP[status]?.label}.`, 'success'); fetchRemitos(); }
    else { addToast?.('Error.', 'error'); }
  };

  const showDetail = async (id) => {
    const res = await apiGet(`/remitos/${id}`);
    if (res.ok) setDetail(await res.json());
  };

  const inputStyle = { width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', padding: '12px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0, letterSpacing: '-0.02em' }}>Remitos y despacho</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ padding: '7px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.85rem', outline: 'none' }}>
            <option value="">Todos</option>
            <option value="today">Despacho de hoy</option>
          </select>
          <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>Nuevo remito</button>
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
        ) : remitos.length === 0 ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>
            {filter === 'today' ? 'No hay remitos para hoy.' : 'No hay remitos. Creá uno con "Nuevo remito".'}
          </div>
        ) : (
          remitos.map(r => (
            <div key={r.id} className="ledger-sheet" onClick={() => showDetail(r.id)} style={{
              padding: '12px 18px', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)',
              borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', transition: 'box-shadow 0.15s',
            }} onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--lp-shadow-sm)'} onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.9rem' }}>Remito #{r.id} — {r.address || 'Sin dirección'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)' }}>
                  {fmtDate(r.scheduled_date)}{r.driver ? ` · ${r.driver}` : ''}{r.customer_name ? ` · ${r.customer_name}` : ''}
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: STATUS_MAP[r.status]?.color, background: (STATUS_MAP[r.status]?.color || '#666') + '15', padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--lp-font-mono)' }}>
                {STATUS_MAP[r.status]?.label || r.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Nuevo remito</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Dirección</label>
                <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Obra / Calle"
                  style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Chofer</label>
                <input value={formDriver} onChange={e => setFormDriver(e.target.value)} placeholder="Nombre"
                  style={inputStyle} />
              </div>
              <div style={{ width: 120 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Fecha</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <input value={productSearch} onChange={e => handleSearch(e.target.value)} placeholder="Buscar producto..."
              style={{ ...inputStyle, marginBottom: 8 }} />
            {searchResults.length > 0 && (
              <div style={{ marginBottom: 8, maxHeight: 120, overflow: 'auto', border: '1px solid var(--lp-line)', borderRadius: 6 }}>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => addItem(p)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid var(--lp-line)', color: 'var(--lp-ink)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {p.name} · ${formatPesos(p.price)}
                  </div>
                ))}
              </div>
            )}

            {formItems.length > 0 && (
              <div style={{ marginBottom: 12, borderTop: '1px solid var(--lp-line)', paddingTop: 10 }}>
                {formItems.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', fontSize: '0.82rem', color: 'var(--lp-ink)' }}>
                    <span style={{ flex: 1 }}>{it.product_name}</span>
                    <input type="number" value={it.quantity} onChange={e => updateItemQty(i, e.target.value)}
                      style={{ width: 50, ...inputStyle, textAlign: 'center' }} min={1} />
                    <span style={{ fontFamily: 'var(--lp-font-mono)', width: 80, textAlign: 'right' }}>${formatPesos(it.quantity * it.unit_price)}</span>
                    <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--lp-line-strong)', marginTop: 6, paddingTop: 6, fontWeight: 700, color: 'var(--lp-ink)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total</span><span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(totalItems)}</span>
                </div>
              </div>
            )}

            <button onClick={handleCreate} disabled={formItems.length === 0} className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', opacity: formItems.length === 0 ? 0.5 : 1 }}>
              Crear remito
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Remito #{detail.remito.id}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', marginBottom: 12 }}>
              <div>Estado: <span style={{ color: STATUS_MAP[detail.remito.status]?.color, fontWeight: 700 }}>{STATUS_MAP[detail.remito.status]?.label}</span></div>
              {detail.remito.address && <div>Dirección: {detail.remito.address}</div>}
              {detail.remito.driver && <div>Chofer: {detail.remito.driver}</div>}
              <div>Programado: {fmtDate(detail.remito.scheduled_date)}</div>
            </div>
            {/* Items */}
            <div style={{ borderTop: '1px solid var(--lp-line)', paddingTop: 10, marginBottom: 14 }}>
              {detail.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: 'var(--lp-ink)' }}>
                  <span>{it.product_name} × {it.quantity}</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(it.unit_price * it.quantity)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--lp-line-strong)', marginTop: 6, paddingTop: 6, fontWeight: 700, color: 'var(--lp-ink)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Total</span><span style={{ fontFamily: 'var(--lp-font-mono)' }}>${formatPesos(detail.items.reduce((s, i) => s + i.unit_price * i.quantity, 0))}</span>
              </div>
            </div>
            {/* Acciones */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.remito.status === 'pending' && (
                <button onClick={() => handleStatus(detail.remito.id, 'en_camino')} className="lp-btn lp-btn--primary" style={{ flex: 1, fontSize: '0.85rem' }}>En camino</button>
              )}
              {['pending', 'en_camino'].includes(detail.remito.status) && (
                <button onClick={() => handleStatus(detail.remito.id, 'delivered')} className="lp-btn lp-btn--primary" style={{ flex: 1, fontSize: '0.85rem' }}>Entregado</button>
              )}
              {['pending', 'en_camino'].includes(detail.remito.status) && (
                <button onClick={() => handleStatus(detail.remito.id, 'failed')} className="lp-btn lp-btn--ghost" style={{ flex: 1, fontSize: '0.85rem', color: 'var(--lp-red)' }}>Fallido</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PedidoProveedorTab — permite hacer pedidos a proveedores por WhatsApp
 * y guardarlos como compra pendiente, sin exponer deudas ni CC.
 *
 * Diseñado para que cualquier empleado pueda usar esta pantalla.
 * La información de deuda queda exclusivamente en ProveedoresModule.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../services/apiClient';
import { SkeletonTable } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const formatPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '54' + digits.slice(1);
  if (digits.startsWith('54')) return digits;
  return '54' + digits;
};

// ── Sub-modal: armar pedido para un proveedor ─────────────────
function PedidoModal({ proveedor, onClose, addToast }) {
  const [items, setItems]           = useState([]);
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState([]);
  const [note, setNote]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [guardado, setGuardado]     = useState(false);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    const r = await apiGet(`/products?q=${encodeURIComponent(q)}&limit=8`);
    if (r.ok) setResults(await r.json() || []);
  };

  const addItem = (p) => {
    setItems(prev =>
      prev.find(it => it.product_id === p.id)
        ? prev.map(it => it.product_id === p.id ? { ...it, quantity: it.quantity + 1 } : it)
        : [...prev, { product_id: p.id, product_name: p.name, quantity: 1 }]
    );
    setSearch(''); setResults([]);
  };

  const updateQty = (pid, qty) =>
    setItems(prev => prev.map(it => it.product_id === pid ? { ...it, quantity: Math.max(1, parseFloat(qty) || 1) } : it));

  const removeItem = (pid) => setItems(prev => prev.filter(it => it.product_id !== pid));

  const handleSendWA = () => {
    if (items.length === 0) return;
    const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
    const bizName = biz.business_name || 'Corralón';
    const today = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    let msg = `*${bizName}* — Pedido a ${proveedor.name}\nFecha: ${today}\n\n*Ítems:*\n`;
    items.forEach(it => { msg += `- ${it.product_name} × ${it.quantity}\n`; });
    if (note.trim()) msg += `\n*Notas:* ${note.trim()}`;
    const phone = formatPhone(proveedor.phone);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleGuardar = async () => {
    if (items.length === 0 || saving) return;
    setSaving(true);
    try {
      const r = await apiPost('/purchases', {
        supplier_id: proveedor.id,
        status: 'pending',
        invoice_number: '',
        operator: 'Sistema',
        items: items.map(it => ({ product_id: it.product_id, product_name: it.product_name, quantity: it.quantity, unit_cost: 0 })),
      });
      if (r.ok) {
        addToast?.('Pedido guardado como pendiente. Confirmalo en Compras cuando llegue la mercadería.', 'success');
        setGuardado(true);
      } else {
        addToast?.('No se pudo guardar el pedido.', 'error');
      }
    } catch { addToast?.('Error de conexión.', 'error'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(11,19,43,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div onMouseDown={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto',
          background: 'var(--sheet)', border: '1px solid var(--border-color)',
          borderRadius: 12, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Pedido a proveedor
            </div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{proveedor.name}</h3>
            {proveedor.phone && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>📞 {proveedor.phone}</div>
            )}
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.3rem', padding: 4 }}>✕</button>
        </div>

        {/* Buscador de productos */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar producto a pedir..."
            style={{ width: '100%', padding: '9px 12px', background: 'var(--surface-veil)',
              border: '1px solid var(--border-color)', borderRadius: 8,
              color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }} />
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'var(--sheet)', border: '1px solid var(--border-color)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', overflow: 'hidden', marginTop: 4 }}>
              {results.map(p => (
                <div key={p.id} onClick={() => addItem(p)}
                  style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem',
                    color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-veil)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {p.name}
                  {p.stock !== undefined && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginLeft: 8 }}>
                      stock: {p.stock}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lista de ítems */}
        {items.length > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 8 }}>
              Ítems del pedido
            </div>
            {items.map(it => (
              <div key={it.product_id}
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0',
                  borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {it.product_name}
                </span>
                <input type="number" value={it.quantity} min={1}
                  onChange={e => updateQty(it.product_id, e.target.value)}
                  style={{ width: 60, padding: '5px 8px', background: 'var(--surface-veil)',
                    border: '1px solid var(--border-color)', borderRadius: 6,
                    color: 'var(--text-primary)', textAlign: 'center', outline: 'none', fontSize: '0.85rem' }} />
                <button onClick={() => removeItem(it.product_id)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-danger, #ef4444)',
                    cursor: 'pointer', fontSize: '1rem', padding: '4px 6px', lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-faint)' }}>
            Buscá productos para agregarlos al pedido
          </div>
        )}

        {/* Nota */}
        {items.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Notas (opcional)
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Ej: urgente, llamar antes de despachar..."
              rows={2}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-veil)',
                border: '1px solid var(--border-color)', borderRadius: 6,
                color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
                resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={handleSendWA} disabled={items.length === 0}
            style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 8,
              background: items.length === 0 ? 'rgba(37,211,102,0.15)' : '#25D366',
              color: items.length === 0 ? 'rgba(37,211,102,0.5)' : '#fff',
              fontSize: '0.95rem', fontWeight: 800, cursor: items.length === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Enviar por WhatsApp
          </button>

          {guardado ? (
            <div style={{ padding: '10px 16px', background: 'rgba(20,187,166,0.1)',
                border: '1px solid var(--accent-primary)', borderRadius: 8,
                fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: 700, textAlign: 'center' }}>
              ✓ Guardado — confirmalo en Compras cuando llegue la mercadería
            </div>
          ) : (
            <button onClick={handleGuardar} disabled={items.length === 0 || saving}
              style={{ width: '100%', padding: '10px 16px', background: 'transparent',
                border: '1.5px dashed var(--border-color)', borderRadius: 8,
                color: items.length === 0 ? 'var(--text-faint)' : 'var(--text-primary)',
                fontSize: '0.88rem', fontWeight: 700,
                cursor: items.length === 0 ? 'default' : 'pointer',
                opacity: items.length === 0 ? 0.5 : 1 }}>
              {saving ? 'Guardando...' : '💾 Guardar como pedido pendiente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab principal ─────────────────────────────────────────────
export default function PedidoProveedorTab({ addToast }) {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState(null); // proveedor para el modal

  const fetchProveedores = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet('/suppliers');
      if (r.ok) setProveedores(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchProveedores(); }, [fetchProveedores]);

  const filtered = search.trim()
    ? proveedores.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : proveedores;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Buscador */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar proveedor..."
          style={{ padding: '10px 16px', background: 'var(--surface-veil)',
            border: '1px solid var(--border-color)', borderRadius: 8,
            color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
            width: '260px', boxSizing: 'border-box' }} />
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <SkeletonTable rows={4} cols={2} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="Truck"
            title={search ? 'Sin resultados' : 'Sin proveedores'}
            description={search ? 'No hay proveedores que coincidan.' : 'Agregá proveedores desde el módulo Proveedores.'} />
        ) : (
          <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
            {filtered.map(p => (
              <div key={p.id} className="ledger-row" style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{p.name}</div>
                  {p.phone && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginTop: 2 }}>
                      📞 {p.phone}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelected(p)}
                  style={{ padding: '8px 18px', background: 'rgba(37,211,102,0.08)',
                    color: '#25D366', border: '1px solid rgba(37,211,102,0.3)',
                    borderRadius: 8, fontWeight: 700, cursor: 'pointer',
                    fontSize: '0.85rem', transition: 'border-color 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#25D366'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(37,211,102,0.3)'}>
                  📋 Hacer pedido
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de pedido */}
      {selected && (
        <PedidoModal
          proveedor={selected}
          onClose={() => setSelected(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}

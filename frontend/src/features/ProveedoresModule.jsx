import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import FeatureGate from '../components/ui/FeatureGate';
import useIsMobile from '../hooks/useIsMobile';

const Icons = {
  Truck: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14V6h8v8m-8 0a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-8-8h8m0 0l3 3v5h-3m-8-8H4v8h4" /></svg>,
  Plus: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
};

const formatPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '54' + digits.slice(1);
  if (digits.startsWith('54')) return digits;
  return '54' + digits;
};

export default function ProveedoresModule() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { addToast, currentPlan } = usePanelContext();
  const PLAN_WEIGHT = { trial: 1, simple: 1, pro: 2, ia: 3 };
  const isLocked = PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT['simple'];
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAbonar, setShowAbonar] = useState(null);
  const [abonarMonto, setAbonarMonto] = useState('');
  const [abonarMotivo, setAbonarMotivo] = useState('');
  const [newProv, setNewProv] = useState({ name: '', contact: '', phone: '' });

  // Pedido a proveedor
  const [showPedido, setShowPedido] = useState(null); // supplier object
  const [pedidoItems, setPedidoItems] = useState([]);
  const [pedidoNote, setPedidoNote] = useState('');
  const [pedidoSearch, setPedidoSearch] = useState('');
  const [pedidoSearchResults, setPedidoSearchResults] = useState([]);
  const [savingPedidoPendiente, setSavingPedidoPendiente] = useState(false);
  const [pedidoGuardado, setPedidoGuardado] = useState(false); // true tras guardar con éxito

  const fetchProveedores = () => {
    setLoading(true);
    setError(false);
    const isPreviewMode = new URLSearchParams(window.location.search).get('preview') === 'true' || localStorage.getItem('saas_mode') === 'true';
    if (isPreviewMode) {
      setTimeout(() => {
        setProveedores([
          { id: 1, name: 'Distribuidora Arcor', contact: 'Juan Perez', phone: '1123456789', debt: 150000 },
          { id: 2, name: 'Coca Cola Femsa', contact: 'Camión Martes', phone: '0800-COCA', debt: 0 },
          { id: 3, name: 'Lácteos Serenísima', contact: 'Carlos', phone: '1198765432', debt: 45000 }
        ]);
        setLoading(false);
      }, 400);
      return;
    }
    apiGet('/suppliers')
      .then(res => { 
        if (!res.ok) return []; 
        return res.json(); 
      })
      .then(data => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => { setProveedores([]); setError(true); })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchProveedores(); }, []);

  const handlePedidoSearch = async (q) => {
    setPedidoSearch(q);
    if (q.length < 2) { setPedidoSearchResults([]); return; }
    const r = await apiGet(`/products?q=${encodeURIComponent(q)}&limit=8`);
    if (r.ok) setPedidoSearchResults(await r.json() || []);
  };

  const addPedidoItem = (p) => {
    setPedidoItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity: 1 }]);
    setPedidoSearch(''); setPedidoSearchResults([]);
  };

  const removePedidoItem = (i) => setPedidoItems(prev => prev.filter((_, idx) => idx !== i));
  const updatePedidoQty = (i, qty) => setPedidoItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, parseFloat(qty) || 1) } : it));

  const handleGuardarPedidoPendiente = async () => {
    if (!showPedido || pedidoItems.length === 0) return;
    setSavingPedidoPendiente(true);
    try {
      const r = await apiPost('/purchases', {
        supplier_id: showPedido.id,
        status: 'pending',
        invoice_number: '',
        operator: 'Sistema',
        items: pedidoItems.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_cost: 0,
        })),
      });
      if (r.ok) {
        addToast?.('Pedido guardado como pendiente. Confirmalo en Compras cuando llegue la mercadería.', 'success');
        setPedidoGuardado(true);
      } else {
        addToast?.('No se pudo guardar el pedido.', 'error');
      }
    } catch { addToast?.('Error de conexión.', 'error'); }
    setSavingPedidoPendiente(false);
  };

  const handleSendPedidoWhatsApp = () => {
    if (!showPedido || pedidoItems.length === 0) return;
    const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
    const bizName = biz.business_name || 'Corralón';
    const today = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    let msg = `*${bizName}* — Pedido a ${showPedido.name}\n`;
    msg += `Fecha: ${today}\n\n`;
    msg += `*Ítems:*\n`;
    pedidoItems.forEach(it => { msg += `- ${it.product_name} × ${it.quantity}\n`; });
    if (pedidoNote.trim()) msg += `\n*Notas:* ${pedidoNote.trim()}`;
    
    const phone = formatPhone(showPedido.phone);
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleCreate = async () => {
    if (!newProv.name.trim()) {
      if (addToast) addToast('El nombre del proveedor es obligatorio.', 'error');
      return;
    }
    try {
      const res = await apiPost('/suppliers', { name: newProv.name.trim(), contact: newProv.contact.trim(), phone: newProv.phone.trim() });
      if (res.ok) {
        if (addToast) addToast('Proveedor creado exitosamente.', 'success');
        setShowModal(false);
        setNewProv({ name: '', contact: '', phone: '' });
        fetchProveedores();
      } else {
        const data = await res.json().catch(() => ({}));
        if (addToast) addToast(data.detail || 'No se pudo crear el proveedor. Reintentá o revisá tu conexión.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin internet. Revisá tu conexión.', 'error');
    }
  };

  return (
    <FeatureGate isLocked={isLocked} requiredPlan="Simple">
    <div style={{ padding: '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '10px', marginBottom: '16px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div>
          <div className="ledger-label">Libro de proveedores</div>
          <h1 className="ledger-title" style={{ fontSize: '1.6rem', marginTop: 4 }}>A quién le comprás</h1>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: 'var(--accent-primary)', border: 'none', color: 'var(--sheet)', padding: '11px 20px', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'filter 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}>
           <Icons.Plus /> Nuevo proveedor
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <SkeletonTable rows={4} cols={3} />
        ) : proveedores.length === 0 ? (
          <EmptyState icon="Truck" title={error ? 'Error al cargar' : 'Sin proveedores'}
            description={error ? 'No se pudieron cargar los proveedores. Verificá la conexión.' : 'Agregá tu primer proveedor para empezar a registrar compras.'}
            actionLabel={error ? 'Reintentar' : undefined} actionOnClick={error ? fetchProveedores : undefined} />
        ) : (
          <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
             {proveedores.map(p => (
               <div key={p.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '12px' : 0, justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '14px 20px', borderBottom: '1px solid var(--rule)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px', flex: 1, flexWrap: 'wrap' }}>
                     <div style={{ width: '44px', height: '44px', background: 'var(--wash-primary)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                       <Icons.Truck />
                     </div>
                     <div style={{ flex: 1 }}>
                       <h3 style={{ margin: '0 0 3px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</h3>
                       <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-faint)' }}>Contacto: {p.contact} · {p.phone}</p>
                     </div>
                     <div style={{ width: isMobile ? '100%' : '200px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="ledger-label">Deuda</span>
                        <span className="ledger-num" style={{ fontSize: '1.2rem', fontWeight: 800, color: (p.debt ?? 0) > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>${(p.debt ?? 0).toLocaleString('es-AR')}</span>
                     </div>
                  </div>
                   <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : undefined }}>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/panel/compras?supplier_id=${p.id}`); }} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer', transition: 'border-color 0.15s', flex: isMobile ? 1 : undefined }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>Historial</button>
                      <button onClick={(e) => { e.stopPropagation(); setShowPedido(p); setPedidoItems([]); setPedidoNote(''); setPedidoSearch(''); setPedidoSearchResults([]); setPedidoGuardado(false); }} style={{ padding: '8px 16px', background: 'rgba(37,211,102,0.08)', color: '#25D366', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer', transition: 'border-color 0.15s', flex: isMobile ? 1 : undefined }} onMouseEnter={e => e.currentTarget.style.borderColor = '#25D366'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(37,211,102,0.25)'}>Hacer pedido</button>
                      {p.debt > 0 && <button onClick={(e) => { e.stopPropagation(); setShowAbonar(p); setAbonarMonto(''); setAbonarMotivo(''); }} style={{ padding: '8px 16px', background: 'var(--wash-danger)', color: 'var(--accent-danger)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer', flex: isMobile ? 1 : undefined }}>Abonar</button>}
                   </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="ledger-sheet" style={{ padding: isMobile ? '24px' : '32px', width: '400px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 24px 0', color: 'var(--text-primary)' }}>Nuevo Proveedor</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Nombre</label>
              <input type="text" value={newProv.name} onChange={e => setNewProv({ ...newProv, name: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Contacto</label>
              <input type="text" value={newProv.contact} onChange={e => setNewProv({ ...newProv, contact: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Tel&eacute;fono</label>
              <input type="text" value={newProv.phone} onChange={e => setNewProv({ ...newProv, phone: e.target.value })} placeholder="+54 9 11 1234-5678"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setNewProv({ name: '', contact: '', phone: '' }); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleCreate} style={{ background: 'var(--accent-primary)', border: 'none', color: 'var(--sheet)', padding: '10px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'filter 0.15s', fontWeight: 800 }}>
                Crear proveedor
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbonar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="ledger-sheet" style={{ padding: isMobile ? '24px' : '32px', width: '400px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Abonar a {showAbonar.name}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>Deuda actual: ${(showAbonar.debt ?? 0).toLocaleString('es-AR')}</p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Monto ($)</label>
              <input type="number" value={abonarMonto} onChange={e => setAbonarMonto(e.target.value)} autoFocus
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '1.1rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Motivo</label>
              <input type="text" value={abonarMotivo} onChange={e => setAbonarMotivo(e.target.value)} placeholder="Ej: Pago factura 001"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAbonar(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={async () => {
                if (!abonarMonto || parseFloat(abonarMonto) <= 0) return;
                if (parseFloat(abonarMonto) > (showAbonar.debt || 0)) {
                  addToast('El monto no puede superar la deuda.', 'error');
                  return;
                }
                try {
                  const res = await apiPost(`/suppliers/${showAbonar.id}/pay`, {
                    amount: parseFloat(abonarMonto),
                    motivo: abonarMotivo || `Pago a ${showAbonar.name}`,
                    operator: 'Dueño'
                  });
                  if (res.ok) {
                    addToast('Pago registrado correctamente.', 'success');
                    setShowAbonar(null);
                    fetchProveedores();
                  } else {
                    const data = await res.json().catch(() => ({}));
                    addToast(data.detail || 'No se pudo registrar el pago.', 'error');
                  }
                } catch { addToast('Sin internet. Revisá tu conexión.', 'error'); }
              }} style={{ background: 'var(--accent-primary)', border: 'none', color: 'var(--sheet)', padding: '10px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 800 }}
                disabled={!abonarMonto || parseFloat(abonarMonto) <= 0}>
                Pagar
              </button>
            </div>
          </div>
        </div>
      )}
      {showPedido && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowPedido(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>
                Pedido a {showPedido.name}
              </h3>
              <button onClick={() => setShowPedido(null)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            {showPedido.contact && (
              <div style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', marginBottom: 14 }}>
                Contacto: {showPedido.contact}{showPedido.phone ? ` · ${showPedido.phone}` : ''}
              </div>
            )}

            <input value={pedidoSearch} onChange={e => handlePedidoSearch(e.target.value)}
              placeholder="Buscar producto..."
              style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.9rem', outline: 'none', marginBottom: 8 }} />

            {pedidoSearchResults.length > 0 && (
              <div style={{ marginBottom: 10, maxHeight: 140, overflow: 'auto', border: '1px solid var(--lp-line)', borderRadius: 6 }}>
                {pedidoSearchResults.map(p => (
                  <div key={p.id} onClick={() => addPedidoItem(p)}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--lp-line)', color: 'var(--lp-ink)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {p.name}
                  </div>
                ))}
              </div>
            )}

            {pedidoItems.length > 0 && (
              <div style={{ borderTop: '1px solid var(--lp-line)', paddingTop: 10, marginBottom: 12 }}>
                {pedidoItems.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: '0.85rem', color: 'var(--lp-ink)' }}>
                    <span style={{ flex: 1 }}>{it.product_name}</span>
                    <input type="number" value={it.quantity} onChange={e => updatePedidoQty(i, e.target.value)}
                      min={1} style={{ width: 55, padding: '5px 8px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 4, color: 'var(--lp-ink)', textAlign: 'center', outline: 'none' }} />
                    <button onClick={() => removePedidoItem(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notas (opcional)</label>
              <textarea value={pedidoNote} onChange={e => setPedidoNote(e.target.value)}
                placeholder="Ej: urgente, llamar antes de despachar..."
                rows={2}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            <button onClick={handleSendPedidoWhatsApp} disabled={pedidoItems.length === 0}
              style={{ width: '100%', padding: '12px', background: pedidoItems.length === 0 ? 'rgba(37,211,102,0.15)' : '#25D366', border: 'none', borderRadius: 8, color: pedidoItems.length === 0 ? 'rgba(37,211,102,0.5)' : '#fff', fontSize: '0.95rem', fontWeight: 800, cursor: pedidoItems.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'filter 0.15s' }}
              onMouseEnter={e => { if (pedidoItems.length > 0) e.currentTarget.style.filter = 'brightness(1.08)'; }}
              onMouseLeave={e => { if (pedidoItems.length > 0) e.currentTarget.style.filter = 'brightness(1)'; }}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Enviar pedido por WhatsApp
            </button>

            {/* Guardar como pedido pendiente (F6) */}
            {pedidoGuardado ? (
              <div style={{ marginTop: 10, padding: '10px 16px', background: 'rgba(20,187,166,0.1)', border: '1px solid var(--lp-primary)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--lp-primary)', fontWeight: 700, textAlign: 'center' }}>
                ✓ Guardado como pedido pendiente — confirmalo en Compras cuando llegue la mercadería
              </div>
            ) : (
              <button onClick={handleGuardarPedidoPendiente} disabled={pedidoItems.length === 0 || savingPedidoPendiente}
                style={{ marginTop: 8, width: '100%', padding: '10px 16px', background: 'transparent', border: '1.5px dashed var(--lp-line-strong)', borderRadius: 8, color: pedidoItems.length === 0 ? 'var(--lp-ink-faint)' : 'var(--lp-ink)', fontSize: '0.88rem', fontWeight: 700, cursor: pedidoItems.length === 0 ? 'default' : 'pointer', opacity: pedidoItems.length === 0 ? 0.5 : 1 }}>
                {savingPedidoPendiente ? 'Guardando...' : '💾 Guardar como pedido pendiente'}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
    </FeatureGate>
  );
}

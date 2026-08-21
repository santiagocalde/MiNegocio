import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import useModalExit, { overlayAnim, contentAnim } from '../hooks/useModalExit';
import FeatureGate from '../components/ui/FeatureGate';
import useIsMobile from '../hooks/useIsMobile';

const Icons = {
  Truck: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14V6h8v8m-8 0a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-8-8h8m0 0l3 3v5h-3m-8-8H4v8h4" /></svg>,
  Plus: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
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
  const [showAumento, setShowAumento] = useState(null); // proveedor
  const [aumentoPct, setAumentoPct] = useState('');
  const [aumentoCount, setAumentoCount] = useState(null); // productos afectados (preview)
  const [aumentoBusy, setAumentoBusy] = useState(false);
  const [newProv, setNewProv] = useState({ name: '', contact: '', phone: '' });

  // Pedido a proveedor — movido a Compras → tab "📋 Hacer pedido"

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

  const openAumento = async (p) => {
    setShowAumento(p);
    setAumentoPct('');
    setAumentoCount(null);
    try {
      const res = await apiGet(`/suppliers/${p.id}/products-count`);
      if (res.ok) {
        const d = await res.json();
        setAumentoCount(d.count ?? 0);
      }
    } catch { /* el preview es opcional */ }
  };

  const handleAumento = async () => {
    const pct = parseFloat(aumentoPct);
    if (isNaN(pct) || pct === 0) {
      addToast?.('Ingresá un porcentaje distinto de cero.', 'error');
      return;
    }
    setAumentoBusy(true);
    try {
      const res = await apiPost(`/suppliers/${showAumento.id}/price-update`, { percent: pct });
      if (res.ok) {
        const d = await res.json();
        addToast?.(`Listo: ${d.updated} producto${d.updated === 1 ? '' : 's'} actualizado${d.updated === 1 ? '' : 's'} (${pct > 0 ? '+' : ''}${pct}%).`, 'success');
        setShowAumento(null);
      } else {
        const d = await res.json().catch(() => ({}));
        addToast?.(d.detail || 'No se pudo actualizar los precios.', 'error');
      }
    } catch {
      addToast?.('Sin internet. Revisá tu conexión.', 'error');
    } finally {
      setAumentoBusy(false);
    }
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

  const modalExit = useModalExit(showModal);
  const abonarExit = useModalExit(!!showAbonar);
  const abonarDataRef = useRef(null);
  if (showAbonar) abonarDataRef.current = showAbonar;
  const abonarData = showAbonar || abonarDataRef.current;
  const aumentoExit = useModalExit(!!showAumento);
  const aumentoDataRef = useRef(null);
  if (showAumento) aumentoDataRef.current = showAumento;
  const aumentoData = showAumento || aumentoDataRef.current;

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
                      <button onClick={(e) => { e.stopPropagation(); openAumento(p); }} title="Aumentar o bajar los precios de venta de todos los productos de este proveedor" style={{ padding: '8px 16px', background: 'var(--wash-primary)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer', transition: 'border-color 0.15s', flex: isMobile ? 1 : undefined }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>% Precios</button>
                      {/* "Hacer pedido" movido a Compras → tab "📋 Hacer pedido" */}
                      {p.debt > 0 && <button onClick={(e) => { e.stopPropagation(); setShowAbonar(p); setAbonarMonto(''); setAbonarMotivo(''); }} style={{ padding: '8px 16px', background: 'var(--wash-danger)', color: 'var(--accent-danger)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer', flex: isMobile ? 1 : undefined }}>Abonar</button>}
                   </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {modalExit.rendered && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, ...overlayAnim(modalExit.closing) }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ padding: isMobile ? '24px' : '32px', width: '400px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: 'var(--shadow-lg)', ...contentAnim(modalExit.closing) }}>
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

      {abonarExit.rendered && abonarData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, ...overlayAnim(abonarExit.closing) }} onClick={() => setShowAbonar(null)}>
          <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ padding: isMobile ? '24px' : '32px', width: '400px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: 'var(--shadow-lg)', ...contentAnim(abonarExit.closing) }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Abonar a {abonarData.name}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>Deuda actual: ${(abonarData.debt ?? 0).toLocaleString('es-AR')}</p>
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
                if (parseFloat(abonarMonto) > (abonarData.debt || 0)) {
                  addToast('El monto no puede superar la deuda.', 'error');
                  return;
                }
                try {
                  const res = await apiPost(`/suppliers/${abonarData.id}/pay`, {
                    amount: parseFloat(abonarMonto),
                    motivo: abonarMotivo || `Pago a ${abonarData.name}`,
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

      {aumentoExit.rendered && aumentoData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', ...overlayAnim(aumentoExit.closing) }} onClick={() => setShowAumento(null)}>
          <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ padding: isMobile ? '24px' : '32px', width: '420px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: 'var(--shadow-lg)', ...contentAnim(aumentoExit.closing) }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>Actualizar precios</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
              Proveedor: <strong>{aumentoData.name}</strong>
              {aumentoCount !== null && (
                <><br/>Afecta a <strong>{aumentoCount}</strong> producto{aumentoCount === 1 ? '' : 's'} de este proveedor.</>
              )}
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Porcentaje de aumento (%)</label>
              <input type="number" inputMode="decimal" value={aumentoPct} onChange={e => setAumentoPct(e.target.value)} autoFocus placeholder="Ej: 5"
                onKeyDown={e => { if (e.key === 'Enter' && aumentoPct && !aumentoBusy) handleAumento(); }}
                style={{ width: '100%', padding: '14px', background: 'var(--bg-main)', border: '2px solid var(--accent-primary)', color: 'var(--text-primary)', borderRadius: '12px', outline: 'none', fontSize: '1.5rem', fontFamily: 'var(--font-mono)', textAlign: 'center', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[5, 10, 15].map(v => (
                <button key={v} onClick={() => setAumentoPct(String(v))} style={{ flex: 1, minWidth: 64, padding: '9px', background: 'var(--surface-veil)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 700 }}>+{v}%</button>
              ))}
            </div>

            <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', margin: '0 0 20px' }}>
              Se aplican sobre los precios de <strong>venta</strong> (todas las listas). El costo no cambia. Podés usar un número negativo para bajar. Los importes se redondean a peso entero.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAumento(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleAumento} disabled={!aumentoPct || aumentoBusy || (aumentoCount === 0)} style={{ background: 'var(--accent-primary)', border: 'none', color: 'var(--sheet)', padding: '10px 24px', borderRadius: 'var(--radius-sm)', cursor: (aumentoPct && !aumentoBusy && aumentoCount !== 0) ? 'pointer' : 'not-allowed', fontWeight: 800, opacity: (aumentoPct && !aumentoBusy && aumentoCount !== 0) ? 1 : 0.5 }}>
                {aumentoBusy ? 'Aplicando…' : 'Aplicar aumento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}

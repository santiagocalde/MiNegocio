import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import FeatureGate from '../components/ui/FeatureGate';

const Icons = {
  Truck: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14V6h8v8m-8 0a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-8-8h8m0 0l3 3v5h-3m-8-8H4v8h4" /></svg>,
  Plus: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
};

export default function ProveedoresModule() {
  const navigate = useNavigate();
  const { addToast, backend } = usePanelContext();
  const currentPlan = backend.businessConfig?.plan || 'trial';
  const PLAN_WEIGHT = { trial: 0, simple: 1, pro: 2, ia: 3 };
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true' || localStorage.getItem('saas_mode') === 'true';
  const isLocked = !isPreview && PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT['simple'];
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAbonar, setShowAbonar] = useState(null);
  const [abonarMonto, setAbonarMonto] = useState('');
  const [abonarMotivo, setAbonarMotivo] = useState('');
  const [newProv, setNewProv] = useState({ name: '', contact: '', phone: '' });

  const fetchProveedores = () => {
    setLoading(true);
    setError(false);
    apiGet('/suppliers')
      .then(res => { 
        if (!res.ok) return []; 
        return res.json(); 
      })
      .then(data => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => { setProveedores([]); setError(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProveedores(); }, []);

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
        if (addToast) addToast(data.detail || 'Error al crear proveedor.', 'error');
      }
    } catch {
      if (addToast) addToast('Error de conexión.', 'error');
    }
  };

  return (
    <FeatureGate isLocked={isLocked} requiredPlan="Simple">
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gestión de Proveedores</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Directorio de mayoristas, preventistas y cuentas corrientes.</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.15s' }}>
           <Icons.Plus /> Nuevo Proveedor
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
             {proveedores.map(p => (
               <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', transition: 'all 0.15s, transform 0.2s', cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.transform='translateX(4px)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                     <div style={{ width: '48px', height: '48px', background: 'rgba(20,187,166, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                       <Icons.Truck />
                     </div>
                     <div style={{ flex: 1 }}>
                       <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</h3>
                       <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Contacto: {p.contact} • {p.phone}</p>
                     </div>
                     <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Deuda:</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: (p.debt ?? 0) > 0 ? 'var(--accent-danger)' : 'var(--accent-success)', fontFamily: 'var(--font-mono)' }}>${(p.debt ?? 0).toLocaleString('es-AR')}</span>
                     </div>
                  </div>
                   <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/panel/compras?supplier_id=${p.id}`); }} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>Historial</button>
                       {p.debt > 0 && <button onClick={(e) => { e.stopPropagation(); setShowAbonar(p); setAbonarMonto(''); setAbonarMotivo(''); }} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>Abonar</button>}
                   </div>
               </div>
             ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '400px', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 24px 0', color: 'var(--text-primary)' }}>Nuevo Proveedor</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Nombre</label>
              <input type="text" value={newProv.name} onChange={e => setNewProv({ ...newProv, name: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Contacto</label>
              <input type="text" value={newProv.contact} onChange={e => setNewProv({ ...newProv, contact: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Tel&eacute;fono</label>
              <input type="text" value={newProv.phone} onChange={e => setNewProv({ ...newProv, phone: e.target.value })} placeholder="+54 9 11 1234-5678"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setNewProv({ name: '', contact: '', phone: '' }); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleCreate} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 700 }}>
                Crear Proveedor
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbonar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '400px', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Abonar a {showAbonar.name}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>Deuda actual: ${(showAbonar.debt ?? 0).toLocaleString('es-AR')}</p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Monto ($)</label>
              <input type="number" value={abonarMonto} onChange={e => setAbonarMonto(e.target.value)} autoFocus
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '1.1rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Motivo</label>
              <input type="text" value={abonarMotivo} onChange={e => setAbonarMotivo(e.target.value)} placeholder="Ej: Pago factura 001"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAbonar(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={async () => {
                if (!abonarMonto || parseFloat(abonarMonto) <= 0) return;
                try {
                  const res = await apiPost('/egresos', {
                    monto: parseFloat(abonarMonto),
                    motivo: abonarMotivo || `Pago a ${showAbonar.name}`,
                    type: 'pago_proveedor',
                    operator: 'Dueño'
                  });
                  if (res.ok) {
                    addToast('Pago registrado correctamente.', 'success');
                    setShowAbonar(null);
                    fetchProveedores();
                  }
                } catch { addToast('Error de conexion.', 'error'); }
              }} style={{ background: 'var(--accent-danger)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                disabled={!abonarMonto || parseFloat(abonarMonto) <= 0}>
                Pagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}

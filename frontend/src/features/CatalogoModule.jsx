import React, { useState, useEffect } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPut } from '../services/apiClient';
import { SkeletonCard } from '../components/ui/Skeleton';

const Icons = {
  Check: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>,
  Globe: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>,
  Share: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>,
  Store: () => <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
};

export default function CatalogoModule() {
  const { addToast } = usePanelContext();
  const [isActive, setIsActive] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    apiGet('/config').then(r => r.ok && r.json()).then(data => {
      if (data) {
        setStoreName(data.name || data.business_name || 'Mi Kiosco');
        setWhatsapp(data.whatsapp || data.phone || '');
        setIsActive(!!data.catalogo_activo);
        setSlug(data.slug || data.business_name?.replace(/\s+/g, '').toLowerCase() || 'mikiosco');
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      const res = await apiPut('/config', {
        name: storeName,
        whatsapp: whatsapp,
        catalogo_activo: isActive,
      });
      if (res.ok) {
        if (addToast) addToast('Configuraci&oacute;n guardada correctamente.', 'success');
      } else {
        if (addToast) addToast('Error al guardar configuraci&oacute;n.', 'error');
      }
    } catch {
      if (addToast) addToast('Error de conexi&oacute;n.', 'error');
    }
  };

  const toggleCatalogo = async () => {
    const newVal = !isActive;
    setIsActive(newVal);
    try {
      const res = await apiPut('/config', {
        name: storeName,
        whatsapp: whatsapp,
        catalogo_activo: newVal,
      });
      if (res.ok) {
        if (addToast) addToast(newVal ? 'Catálogo activado.' : 'Catálogo desactivado.', 'success');
      } else {
        setIsActive(!newVal);
        if (addToast) addToast('Error al cambiar estado.', 'error');
      }
    } catch {
      setIsActive(!newVal);
      if (addToast) addToast('Error de conexi&oacute;n.', 'error');
    }
  };

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Catálogo Online</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Tu tienda virtual sincronizada en tiempo real con tu stock.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '32px', flex: 1 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: `1px solid ${isActive ? 'var(--accent-success)' : 'var(--border-color)'}` }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ color: isActive ? 'var(--accent-success)' : 'var(--text-secondary)' }}><Icons.Globe /></div>
               <div>
                 <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700 }}>Estado del Catálogo</h3>
                 <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{isActive ? 'Tu catálogo está público y aceptando pedidos.' : 'El catálogo está desactivado.'}</p>
               </div>
             </div>
              <button onClick={toggleCatalogo} style={{ background: isActive ? 'var(--accent-danger)' : 'var(--accent-success)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 4px 12px rgba(30,58,95,0.2)' }}>
                {isActive ? 'Desactivar Catálogo' : 'Activar Catálogo'}
              </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Configuraci&oacute;n de la Tienda</h3>
             
             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Nombre de la Tienda</label>
               <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', fontSize: '1rem', outline: 'none' }} />
             </div>

             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>WhatsApp para recibir pedidos</label>
               <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+54 9 11 1234-5678" style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', fontSize: '1rem', outline: 'none' }} />
             </div>
             
             <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button onClick={handleSave} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '16px', borderRadius: '8px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.15s', flex: 1 }}>Guardar Cambios</button>
             </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div style={{ background: 'var(--bg-main)', borderRadius: '16px', padding: '24px', border: '1px solid var(--accent-primary)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--gradient-primary)' }}></div>
              <div style={{ color: 'var(--accent-primary)', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Icons.Store /></div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Tu Enlace &Uacute;nico</h3>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Compart&iacute; este link en Instagram, WhatsApp o Facebook.</p>
              
               <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-primary)', marginBottom: '16px', border: '1px dashed rgba(20,187,166, 0.3)' }}>
                  {window.location.origin}/t/{slug || 'mikiosco'}
               </div>
               
               <div style={{ display: 'flex', gap: '12px' }}>
                 <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/t/${slug || 'mikiosco'}`); if (addToast) addToast('Enlace copiado al portapapeles.', 'success'); }} style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <Icons.Share /> Copiar
                 </button>
                 <button onClick={() => window.open(`/t/${slug || 'mikiosco'}`, '_blank')} style={{ flex: 1, background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    Visitar Tienda
                 </button>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPut } from '../services/apiClient';
import FeatureGate from '../components/ui/FeatureGate';

const Icons = {
  Check: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>,
  Globe: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>,
  Share: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>,
  Store: () => <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
};

const slugify = (s = '') => (s || '').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

const makeUniqueSlug = (name = '') => {
  const base = slugify(name) || 'kiosco';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
};

const readErrorDetail = async (res) => {
  try {
    const body = await res.json();
    return typeof body?.detail === 'string' ? body.detail : null;
  } catch { return null; }
};

export default function CatalogoModule() {
  const { addToast, currentPlan } = usePanelContext();
  const PLAN_WEIGHT = { trial: 1, simple: 1, pro: 2, ia: 3 };
  const isLocked = PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT['pro'];
  const THEMES = [
    { id: 'ocean', name: 'Océano', colors: ['#081228', '#2AD4C2'] },
    { id: 'esmeralda', name: 'Esmeralda', colors: ['#03201A', '#4EE0A8'] },
    { id: 'medianoche', name: 'Medianoche', colors: ['#150F2B', '#C0A8FF'] },
    { id: 'ambar', name: 'Ámbar', colors: ['#291904', '#FFC53D'] },
    { id: 'claro', name: 'Claro', colors: ['#EDF1F6', '#0E8F7F'] },
  ];

  const [isActive, setIsActive] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [slug, setSlug] = useState('');
  const [theme, setTheme] = useState('ocean');
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sendingList, setSendingList] = useState(false);
  const [priceParts, setPriceParts] = useState([]);

  useEffect(() => {
    apiGet('/config').then(r => r.ok && r.json()).then(data => {
      if (data) {
        setStoreName(data.nombre || data.business_name || 'Mi Kiosco');
        setSubtitulo(data.subtitulo || '');
        setDireccion(data.direccion || '');
        setWhatsapp(data.catalogo_whatsapp || data.telefono || data.phone || '');
        setIsActive(!!data.catalogo_activo);
        setSlug(data.catalogo_slug || '');
        setTheme(data.catalogo_tema || 'ocean');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiGet('/products?limit=5000').then(r => r.ok && r.json()).then(d => {
      const list = Array.isArray(d) ? d : [];
      setProducts(list.filter(p => p.is_active !== 0));
    }).catch(() => {});
  }, []);

  useEffect(() => { setPriceParts([]); }, [slug, whatsapp, storeName]);

  const handleSave = async () => {
    try {
      const res = await apiPut('/config', {
        nombre: storeName,
        subtitulo,
        direccion,
        catalogo_whatsapp: whatsapp,
        catalogo_slug: slug,
        catalogo_activo: isActive,
        catalogo_tema: theme,
      });
      if (res.ok) {
        if (addToast) addToast('Configuración guardada correctamente.', 'success');
      } else if (res.status === 409) {
        if (addToast) addToast('Ese enlace ya está en uso por otro negocio. Elegí otro.', 'error');
      } else if (res.status === 402) {
        if (addToast) addToast('El catálogo web requiere Plan Pro o superior.', 'error');
      } else {
        if (addToast) addToast('No se pudo guardar la configuración del catálogo. Reintentá o revisá tu conexión.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin internet. Revisá tu conexión.', 'error');
    }
  };

  const toggleCatalogo = async () => {
    if (saving) return;
    const newVal = !isActive;
    setIsActive(newVal);
    setSaving(true);
    try {
      const res = await apiPut('/config', {
        nombre: storeName,
        subtitulo,
        direccion,
        catalogo_whatsapp: whatsapp,
        catalogo_slug: slug,
        catalogo_activo: newVal,
        catalogo_tema: theme,
      });
      if (res.ok) {
        if (addToast) addToast(newVal ? 'Catálogo activado.' : 'Catálogo desactivado.', 'success');
      } else {
        setIsActive(!newVal);
        const detail = await readErrorDetail(res);
        if (addToast) addToast(detail || 'No se pudo cambiar el estado del catálogo. Reintentá o revisá tu conexión.', 'error');
      }
    } catch {
      setIsActive(!newVal);
      if (addToast) addToast('Sin internet. Revisá tu conexión.', 'error');
    } finally { setSaving(false); }
  };

  const nuevoEnlace = () => setSlug(makeUniqueSlug(storeName || 'miKiosco'));

  const toggleProductoCatalogo = async (producto, mostrar) => {
    try {
      const res = await apiPut(`/products/${producto.id}`, { en_catalogo: mostrar ? 1 : 0 });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === producto.id ? { ...p, en_catalogo: mostrar ? 1 : 0 } : p));
        if (addToast) addToast(`"${producto.name}" ${mostrar ? 'visible' : 'oculto'} en el catálogo.`, 'success');
      } else {
        if (addToast) addToast('No se pudo actualizar el producto. Reintentá.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin internet. Revisá tu conexión.', 'error');
    }
  };

  const sendPriceList = async () => {
    const numero = (whatsapp || '').replace(/[^0-9]/g, '');
    if (!numero) {
      if (addToast) addToast('Primero configurá el WhatsApp para recibir pedidos.', 'error');
      return;
    }
    if (sendingList) return;
    setSendingList(true);
    setPriceParts([]);
    try {
      const res = await apiGet('/products?limit=5000');
      if (!res.ok) throw new Error('bad');
      const products = await res.json();
      const list = Array.isArray(products) ? products : [];
      if (!list.length) {
        if (addToast) addToast('Todavía no hay productos cargados.', 'error');
        return;
      }
      const byCat = {};
      list.forEach(p => {
        const cat = p.category_name || 'General';
        (byCat[cat] = byCat[cat] || []).push(p);
      });
      const header = `*${storeName || 'Lista de precios'}*\n_Lista de precios al día_\n\n`;
      const footer = `\nHacé tu pedido: ${whatsapp}`;
      const blocks = Object.keys(byCat).map(cat =>
        `▫️ *${cat}*\n` + byCat[cat].map(p => {
          const price = Number(p.price || 0);
          return `${p.name}: ${price > 0 ? '$' + price.toLocaleString('es-AR') : 'consultar'}`;
        }).join('\n') + '\n'
      );
      const MAX = 3400;
      const parts = [];
      let cur = header;
      for (const b of blocks) {
        if (cur.length + b.length + footer.length > MAX && cur.trim() !== header.trim()) {
          parts.push(cur + footer);
          cur = header;
        }
        cur += b;
      }
      if (cur.length > header.length || (blocks.length && cur.trim() !== header.trim())) {
        parts.push(cur + footer);
      }
      if (!parts.length) {
        if (addToast) addToast('Todavía no hay productos publicados.', 'error');
        return;
      }
      setPriceParts(parts);
      if (parts.length === 1) {
        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(parts[0])}`, '_blank');
        if (addToast) addToast('Lista armada: se abrió WhatsApp con tu lista de precios.', 'success');
      } else {
        if (addToast) addToast(`La lista es larga: se armó en ${parts.length} mensajes. Enviá cada parte.`, 'error');
      }
    } catch {
      if (addToast) addToast('No se pudo armar la lista de precios. Revisá tu conexión.', 'error');
    } finally {
      setSendingList(false);
    }
  };

  return (
    <FeatureGate isLocked={isLocked} requiredPlan="Pro">
    <div style={{ padding: '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div className="ledger-label">Tu tienda online</div>
        <h1 className="ledger-title" style={{ fontSize: '1.6rem', marginTop: 4 }}>Catálogo web</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '32px', flex: 1 }}>
        <div className="ledger-sheet" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isActive ? 'var(--wash-success)' : 'var(--surface-veil)', padding: '24px', borderRadius: 'var(--radius-sm)', border: `1px solid ${isActive ? 'var(--accent-success)' : 'var(--border-color)'}` }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ color: isActive ? 'var(--accent-success)' : 'var(--text-secondary)' }}><Icons.Globe /></div>
               <div>
                 <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700 }}>Estado del Catálogo</h3>
                 <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{isActive ? 'Tu catálogo está público y aceptando pedidos.' : 'El catálogo está desactivado.'}</p>
               </div>
             </div>
              <button onClick={toggleCatalogo} disabled={saving} style={{ background: isActive ? 'var(--accent-danger)' : 'var(--accent-success)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 800, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.15s', boxShadow: '0 4px 12px rgba(30,58,95,0.2)', opacity: saving ? 0.7 : 1 }}>
                {saving ? '...' : (isActive ? 'Desactivar Catálogo' : 'Activar Catálogo')}
              </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Configuración de la Tienda</h3>
             
             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Nombre de la Tienda</label>
               <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', fontSize: '1rem', outline: 'none' }} />
             </div>

             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Eslogan (aparece debajo del nombre)</label>
               <input type="text" value={subtitulo} onChange={e => setSubtitulo(e.target.value)} placeholder="Ej: Atención 7 días, envíos gratis" maxLength={120} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', fontSize: '1rem', outline: 'none' }} />
             </div>

             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Dirección</label>
               <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej: Av. Corrientes 1234, CABA" maxLength={150} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', fontSize: '1rem', outline: 'none' }} />
             </div>

             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Diseño de tu tienda</label>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                 {THEMES.map(t => (
                   <button key={t.id} onClick={() => setTheme(t.id)} title={t.name}
                     style={{ height: '48px', borderRadius: '10px', cursor: 'pointer', border: theme === t.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', background: t.colors[0], display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all 0.15s', padding: 0, flexDirection: 'column' }}>
                     <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: t.colors[1], border: '2px solid rgba(255,255,255,0.6)' }}></span>
                     <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1 }}>{t.name}</span>
                   </button>
                 ))}
               </div>
               <span style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Colores y letra del catálogo público. 5 diseños fijos: {THEMES.map(t => t.name).join(', ')}.</span>
             </div>

             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Productos visibles en el catálogo ({products.filter(p => p.en_catalogo !== 0).length}/{products.length})</label>
               <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px' }}>
                 {products.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '8px' }}>Cargando productos...</span>}
                 {products.map(p => (
                   <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }}>
                     <button
                       onClick={() => toggleProductoCatalogo(p, p.en_catalogo === 0)}
                       style={{ flexShrink: 0, width: '36px', height: '20px', borderRadius: '999px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.15s', background: p.en_catalogo !== 0 ? 'var(--accent-success)' : 'rgba(255,255,255,0.12)' }}
                       title={p.en_catalogo !== 0 ? 'Visible en el catálogo' : 'Oculto del catálogo'}>
                       <span style={{ position: 'absolute', top: '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s', left: p.en_catalogo !== 0 ? '19px' : '3px' }}></span>
                     </button>
                     <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                     <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{p.category_name || ''}</span>
                   </div>
                 ))}
               </div>
               <span style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Desactivá un producto para ocultarlo del catálogo público. No afecta tu stock ni las ventas.</span>
             </div>

             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>WhatsApp para recibir pedidos</label>
               <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+54 9 11 1234-5678" style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', fontSize: '1rem', outline: 'none' }} />
             </div>

             <div className="input-group">
               <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Enlace único de tu tienda</label>
               <div style={{ display: 'flex', gap: '8px' }}>
                 <input type="text" value={slug} onChange={e => setSlug(slugify(e.target.value))} placeholder="mi-kiosco-3f8k" style={{ flex: 1, background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', fontSize: '1rem', outline: 'none', fontFamily: 'var(--font-mono)' }} />
                 <button onClick={nuevoEnlace} title="Generar enlace nuevo" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Generar</button>
               </div>
               <span style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Este enlace es único para tu negocio: {window.location.origin}/t/{slug || '...'}</span>
             </div>
             
             <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button onClick={handleSave} style={{ background: 'var(--accent-primary)', color: 'var(--sheet)', border: 'none', padding: '16px', borderRadius: 'var(--radius-sm)', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', transition: 'filter 0.15s', flex: 1 }}>Guardar cambios</button>
             </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div className="ledger-sheet" style={{ padding: '24px', border: '1px solid var(--accent-primary)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ color: 'var(--accent-primary)', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Icons.Store /></div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Tu Enlace Único</h3>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Compartí este link en Instagram, WhatsApp o Facebook.</p>
              
<div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', fontFamily: slug ? 'var(--font-mono)' : 'var(--font-main)', fontSize: '0.9rem', color: slug ? 'var(--accent-primary)' : 'var(--text-secondary)', marginBottom: '16px', border: '1px dashed rgba(20,187,166, 0.3)' }}>
                  {slug ? `${window.location.origin}/t/${slug}` : 'Presioná "Generar" para crear tu enlace único'}
               </div>
               
               <div style={{ display: 'flex', gap: '12px' }}>
                 <button disabled={!slug} onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/t/${slug}`); if (addToast) addToast('Enlace copiado al portapapeles.', 'success'); }} style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: slug ? 'pointer' : 'not-allowed', opacity: slug ? 1 : 0.5, transition: 'all 0.15s' }}>
                     <Icons.Share /> Copiar
                  </button>
                  <button disabled={!slug} onClick={() => window.open(`/t/${slug}`, '_blank')} style={{ flex: 1, background: 'var(--accent-primary)', color: 'var(--sheet)', border: 'none', padding: '12px', borderRadius: 'var(--radius-sm)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: slug ? 'pointer' : 'not-allowed', opacity: slug ? 1 : 0.5, transition: 'filter 0.15s' }}>
                     Visitar Tienda
                  </button>
               </div>

               <button onClick={sendPriceList} disabled={sendingList} style={{ width: '100%', marginTop: '12px', background: 'rgba(37, 211, 102, 0.12)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.4)', padding: '14px', borderRadius: '8px', fontWeight: 800, fontSize: '0.95rem', cursor: sendingList ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s', opacity: sendingList ? 0.7 : 1 }}>
                  {sendingList ? 'Armando lista...' : 'Enviar Lista de Precios por WhatsApp'}
               </button>
               {priceParts.length > 1 && (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                   <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>La lista es larga: se dividió en {priceParts.length} mensajes. Enviá cada parte por separado.</p>
                   {priceParts.map((part, i) => (
                     <button key={i} onClick={() => window.open(`https://wa.me/${(whatsapp || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(part)}`, '_blank')} style={{ width: '100%', background: 'rgba(37, 211, 102, 0.08)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.3)', padding: '12px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                       Enviar Parte {i + 1} de {priceParts.length}
                     </button>
                   ))}
                 </div>
               )}
               <p style={{ margin: '12px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Armá una lista de precios al día, agrupada por categoría, y enviala por WhatsApp. Ideal para pedidos por mayor.</p>
           </div>
        </div>
      </div>
    </div>
    </FeatureGate>
  );
}

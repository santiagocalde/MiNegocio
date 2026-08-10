import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_ROOT } from '../config';

const Icons = {
  Search: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  ShoppingCart: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Store: () => <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  MapPin: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Plus: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>,
  Minus: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

const AVAILABILITY = {
  hay:        { label: 'En stock',     color: 'var(--accent-success)', bg: 'rgba(16, 185, 129, 0.15)' },
  'queda-poco': { label: 'Queda poco', color: 'var(--accent-warning)', bg: 'rgba(245, 158, 11, 0.15)' },
  agotado:    { label: 'Agotado',      color: 'var(--accent-danger)', bg: 'rgba(239, 68, 68, 0.15)' },
};

export default function PublicCatalog() {
  const { slug } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [storeName, setStoreName] = useState('Mi Tienda');
  const [subtitulo, setSubtitulo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [theme, setTheme] = useState('ocean');
  const [activeCategory, setActiveCategory] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.body.classList.add('landing-open');
    window.scrollTo(0, 0);
    return () => document.body.classList.remove('landing-open');
  }, []);

  useEffect(() => {
    fetch(`${API_ROOT}/api/catalogo?slug=${encodeURIComponent(slug || '')}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.products || []);
        setProducts(list);
        if (!Array.isArray(data)) {
          setStoreName(data?.nombre || 'Mi Tienda');
          setSubtitulo(data?.subtitulo || '');
          setDireccion(data?.direccion || '');
          setTheme(data?.theme || 'ocean');
          setWhatsapp(data?.catalogo_whatsapp || data?.whatsapp || data?.telefono || '');
        }
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  const addToCart = (product) => {
    if (product.availability === 'agotado') return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const formatPrice = (p) => '$' + Number(p || 0).toLocaleString('es-AR');

  const searched = products.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const categories = [...new Set(products.map(p => p.category_name || p.category || 'General'))].sort();
  const shown = searched.filter(p => !activeCategory || (p.category_name || p.category || 'General') === activeCategory);
  // Grilla: con categoría seleccionada → sin agrupar (vista filtrada). Sin categoría → agrupado por categoría.
  const useGroups = !activeCategory;
  const grouped = useGroups
    ? categories
        .filter(c => shown.some(p => (p.category_name || p.category || 'General') === c))
        .map(c => ({ name: c, items: shown.filter(p => (p.category_name || p.category || 'General') === c) }))
    : [];

  const renderProductCard = (p) => {
    const av = AVAILABILITY[p.availability] || AVAILABILITY.hay;
    const out = p.availability === 'agotado';
    return (
      <div key={p.id} className="product-card" style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'transform 0.2s, box-shadow 0.2s', opacity: out ? 0.72 : 1 }} onMouseEnter={e=>{ if(!out){e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(0,0,0,0.2)'} }} onMouseLeave={e=>{e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          {activeCategory ? (
            <span style={{ background: 'var(--cat-chip-bg)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>{p.category_name || p.category || 'General'}</span>
          ) : (
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-primary)', opacity: 0.7 }}></span>
          )}
          <span style={{ background: av.bg, color: av.color, padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{av.label}</span>
        </div>
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>{p.name}</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: out ? 'var(--text-secondary)' : 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(p.price)}</div>
        </div>
        <button onClick={() => addToCart(p)} disabled={out} style={{ width: '100%', padding: '12px', background: out ? 'var(--cat-chip-bg)' : 'var(--cat-accent-soft)', color: out ? 'var(--text-secondary)' : 'var(--accent-primary)', border: out ? '1px solid var(--border-color)' : '1px solid var(--cat-accent-border)', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 800, cursor: out ? 'not-allowed' : 'pointer', transition: 'all 0.15s', marginTop: 'auto' }} onMouseEnter={e=>{ if(!out){e.target.style.background='var(--gradient-primary)'; e.target.style.color='white'} }} onMouseLeave={e=>{ if(!out){e.target.style.background='var(--cat-accent-soft)'; e.target.style.color='var(--accent-primary)'} }}>
          {out ? 'Agotado' : 'Agregar al Pedido'}
        </button>
      </div>
    );
  };

  const sendWhatsAppOrder = () => {
    const numero = (whatsapp || '').replace(/[^0-9]/g, '');
    if (!numero) {
      alert('Este comercio todavía no configuró su WhatsApp para pedidos.');
      return;
    }
    let msg = `Hola, quiero hacer el siguiente pedido:\n\n`;
    cart.forEach(item => {
      msg += `• ${item.qty}x ${item.name} - ${formatPrice(item.price * item.qty)}\n`;
    });
    msg += `\n*Total: ${formatPrice(cartTotal)}*`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className={`catalog-page theme-${theme}`} data-theme={theme} style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)', fontFamily: 'var(--font-main)', paddingBottom: '100px' }}>

      {/* STICKY TOP: header + category bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>

        {/* HEADER */}
        <header className="catalog-header" style={{ background: 'var(--bg-card)', padding: '24px', borderBottom: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
              <div className="catalog-logo" style={{ width: '48px', height: '48px', background: 'var(--gradient-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px var(--cat-glow)', flexShrink: 0 }}>
                <Icons.Store />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 className="catalog-title" style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {storeName}
                </h1>
                <p style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', margin: '4px 0 0 0', fontWeight: 600 }}>{subtitulo || 'Catálogo Online · Precios al día'}</p>
                {direccion && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icons.MapPin /> {direccion}
                  </p>
                )}
              </div>
            </div>

            <button onClick={() => setIsCartOpen(true)} style={{ background: 'var(--cat-chip-bg)', border: '1px solid var(--border-color)', padding: '12px 20px', borderRadius: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', flexShrink: 0 }} onMouseEnter={e=>e.currentTarget.style.background='var(--cat-chip-hover)'} onMouseLeave={e=>e.currentTarget.style.background='var(--cat-chip-bg)'}>
               <Icons.ShoppingCart />
               <span className="cart-total" style={{ fontWeight: 800 }}>{formatPrice(cartTotal)}</span>
               {cart.length > 0 && (
                 <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--accent-danger)', color: 'white', fontSize: '0.75rem', fontWeight: 800, width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                   {cart.reduce((a,c) => a + c.qty, 0)}
                 </span>
               )}
            </button>
          </div>
        </header>

        {/* CATEGORY BAR — sticky, horizontal scroll */}
        {categories.length > 1 && (
          <div className="catalog-catbar" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
              <div className="catalog-cats-scroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '14px 24px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <button
                  onClick={() => setActiveCategory('')}
                  className={activeCategory === '' ? 'cat-chip cat-chip-active' : 'cat-chip'}>
                  <span>Todos</span>
                  <span className="cat-count">{products.length}</span>
                </button>
                {categories.map(c => {
                  const count = products.filter(p => (p.category_name || p.category || 'General') === c).length;
                  return (
                    <button
                      key={c}
                      onClick={() => setActiveCategory(activeCategory === c ? '' : c)}
                      className={activeCategory === c ? 'cat-chip cat-chip-active' : 'cat-chip'}>
                      <span>{c}</span>
                      <span className="cat-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>{/* end sticky top */}

      {/* SEARCH */}
      <div className="catalog-search" style={{ maxWidth: '1200px', margin: '28px auto 0', padding: '0 24px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '18px 18px 18px 56px', borderRadius: '16px', fontSize: '1.05rem', outline: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
          />
        </div>
      </div>

      {/* PRODUCTS */}
      <main className="catalog-main" style={{ maxWidth: '1200px', margin: '32px auto', padding: '0 24px' }}>
        {loading ? (
           <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>Cargando catálogo...</div>
        ) : notFound ? (
           <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>Este catálogo no está disponible.</div>
        ) : shown.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>No se encontraron productos.</div>
        ) : (
          <div className="catalog-groups" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {useGroups ? grouped.map(group => (
              <section key={group.name}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {group.name}
                  <span style={{ background: 'var(--cat-chip-bg)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>{group.items.length}</span>
                </h2>
                <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                  {group.items.map(p => renderProductCard(p))}
                </div>
              </section>
            )) : (
              <div className="catalog-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                {shown.map(p => renderProductCard(p))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* QR / PRESENTACION */}
      <div className="catalog-footer" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 24px', textAlign: 'center' }}>
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
             style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none', marginTop: '24px' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(37, 211, 102, 0.12)', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>WA</span>
            Consultá por WhatsApp: {whatsapp}
          </a>
        )}
        <p style={{ margin: '16px 0 0', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Catálogo generado por {storeName}</p>
      </div>

      {/* CART DRAWER */}
      {isCartOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--cat-overlay)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--bg-main)', width: '100%', maxWidth: '450px', height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease-out' }}>

             <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Icons.ShoppingCart /> Tu Pedido
               </h2>
               <button onClick={() => setIsCartOpen(false)} style={{ background: 'var(--cat-chip-bg)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Icons.Plus style={{ transform: 'rotate(45deg)' }} />
               </button>
             </div>

             <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {cart.length === 0 ? (
                 <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>Tu pedido está vacío.</div>
               ) : (
                 cart.map(item => (
                   <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{item.name}</div>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{formatPrice(item.price * item.qty)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-main)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <button onClick={() => updateCartQty(item.id, -1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                           {item.qty === 1 ? <Icons.Trash /> : <Icons.Minus />}
                        </button>
                        <span style={{ fontWeight: 800, width: '20px', textAlign: 'center', color: 'var(--text-primary)' }}>{item.qty}</span>
                        <button onClick={() => updateCartQty(item.id, 1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                           <Icons.Plus />
                        </button>
                      </div>
                   </div>
                 ))
               )}
             </div>

             {cart.length > 0 && (
               <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                   <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>Total a pagar</span>
                   <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(cartTotal)}</span>
                 </div>
                 <button onClick={sendWhatsAppOrder} style={{ width: '100%', padding: '16px', background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 8px 24px var(--cat-glow)' }}>
                    Enviar Pedido por WhatsApp
                 </button>
               </div>
             )}
          </div>
        </div>
      )}

      <style>{`
        /* ===== Temas del catálogo (5 paletas fijas) ===== */
        /* Ocean (default, oscuro azul-verde) */
        .theme-ocean {
          --bg-main: #081228;
          --bg-card: #13213D;
          --border-color: rgba(164, 201, 255, 0.14);
          --text-primary: #FFFFFF;
          --text-secondary: rgba(214, 233, 255, 0.95);
          --accent-primary: #2AD4C2;
          --accent-secondary: #0F8A7D;
          --accent-highlight: #57EFDC;
          --gradient-primary: linear-gradient(135deg, #2AD4C2 0%, #0F8A7D 100%);
          --cat-chip-bg: rgba(164, 201, 255, 0.08);
          --cat-chip-hover: rgba(164, 201, 255, 0.16);
          --cat-accent-soft: rgba(42, 212, 194, 0.16);
          --cat-accent-border: rgba(42, 212, 194, 0.4);
          --cat-overlay: rgba(6, 14, 32, 0.82);
          --cat-glow: rgba(42, 212, 194, 0.35);
        }
        /* Esmeralda (oscuro verde) */
        .theme-esmeralda {
          --bg-main: #03201A;
          --bg-card: #0A332B;
          --border-color: rgba(148, 233, 205, 0.15);
          --text-primary: #ECFDF5;
          --text-secondary: rgba(209, 250, 235, 0.95);
          --accent-primary: #4EE0A8;
          --accent-secondary: #059669;
          --accent-highlight: #9CF3CB;
          --gradient-primary: linear-gradient(135deg, #4EE0A8 0%, #059669 100%);
          --cat-chip-bg: rgba(148, 233, 205, 0.08);
          --cat-chip-hover: rgba(148, 233, 205, 0.16);
          --cat-accent-soft: rgba(78, 224, 168, 0.16);
          --cat-accent-border: rgba(78, 224, 168, 0.4);
          --cat-overlay: rgba(3, 32, 26, 0.85);
          --cat-glow: rgba(78, 224, 168, 0.35);
        }
        /* Medianoche (oscuro violeta) */
        .theme-medianoche {
          --bg-main: #150F2B;
          --bg-card: #241A45;
          --border-color: rgba(199, 183, 255, 0.15);
          --text-primary: #F7F5FF;
          --text-secondary: rgba(226, 220, 255, 0.95);
          --accent-primary: #C0A8FF;
          --accent-secondary: #7C3AED;
          --accent-highlight: #E3D7FF;
          --gradient-primary: linear-gradient(135deg, #C0A8FF 0%, #7C3AED 100%);
          --cat-chip-bg: rgba(199, 183, 255, 0.08);
          --cat-chip-hover: rgba(199, 183, 255, 0.16);
          --cat-accent-soft: rgba(192, 168, 255, 0.16);
          --cat-accent-border: rgba(192, 168, 255, 0.4);
          --cat-overlay: rgba(15, 10, 34, 0.85);
          --cat-glow: rgba(192, 168, 255, 0.35);
        }
        /* Ámbar (oscuro cálido) */
        .theme-ambar {
          --bg-main: #291904;
          --bg-card: #3D2709;
          --border-color: rgba(253, 208, 138, 0.18);
          --text-primary: #FFFBEB;
          --text-secondary: rgba(255, 236, 190, 0.95);
          --accent-primary: #FFC53D;
          --accent-secondary: #C26A00;
          --accent-highlight: #FFE08A;
          --gradient-primary: linear-gradient(135deg, #FFC53D 0%, #C26A00 100%);
          --cat-chip-bg: rgba(253, 208, 138, 0.1);
          --cat-chip-hover: rgba(253, 208, 138, 0.2);
          --cat-accent-soft: rgba(255, 197, 61, 0.18);
          --cat-accent-border: rgba(255, 197, 61, 0.45);
          --cat-overlay: rgba(28, 16, 2, 0.85);
          --cat-glow: rgba(255, 197, 61, 0.35);
        }
        /* Claro (light, pedido por comercios) */
        .theme-claro {
          --bg-main: #EDF1F6;
          --bg-card: #FFFFFF;
          --border-color: rgba(13, 29, 55, 0.14);
          --text-primary: #0D1D37;
          --text-secondary: rgba(13, 29, 55, 0.8);
          --accent-primary: #0E8F7F;
          --accent-secondary: #14BBA6;
          --accent-highlight: #0B6E62;
          --gradient-primary: linear-gradient(135deg, #14BBA6 0%, #0E8F7F 100%);
          --cat-chip-bg: rgba(13, 29, 55, 0.06);
          --cat-chip-hover: rgba(13, 29, 55, 0.12);
          --cat-accent-soft: rgba(14, 143, 127, 0.12);
          --cat-accent-border: rgba(14, 143, 127, 0.35);
          --cat-overlay: rgba(13, 29, 55, 0.55);
          --cat-glow: rgba(20, 187, 166, 0.3);
        }
        /* ===== Category chips ===== */
        .cat-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 18px;
          border-radius: 999px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
          border: 1.5px solid var(--border-color);
          background: var(--cat-chip-bg);
          color: var(--text-secondary);
        }
        .cat-chip:hover {
          background: var(--cat-chip-hover);
          color: var(--text-primary);
        }
        .cat-chip-active {
          border-color: var(--accent-primary) !important;
          background: var(--cat-accent-soft) !important;
          color: var(--accent-primary) !important;
        }
        .cat-count {
          background: rgba(255,255,255,0.08);
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 800;
          min-width: 22px;
          text-align: center;
        }
        .cat-chip-active .cat-count {
          background: var(--cat-accent-border);
        }
        /* hide scrollbar on category strip */
        .catalog-cats-scroll::-webkit-scrollbar { display: none; }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 640px) {
          .catalog-header { padding: 16px !important; }
          .catalog-logo { width: 40px !important; height: 40px !important; }
          .catalog-title { font-size: 1.15rem !important; }
          .cart-total { font-size: 0.8rem !important; }
          .catalog-catbar .catalog-cats-scroll { padding: 12px 16px !important; }
          .cat-chip { padding: 9px 14px !important; font-size: 0.88rem !important; }
          .catalog-search, .catalog-main, .catalog-footer { padding-left: 16px !important; padding-right: 16px !important; }
          .catalog-search { margin-top: 20px !important; }
          .catalog-main { margin-top: 20px !important; }
          .catalog-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
        }
      `}</style>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const Icons = {
  Search: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  ShoppingCart: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Store: () => <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Plus: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>,
  Minus: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

export default function PublicCatalog() {
  const { slug } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8005';
    fetch(`${baseUrl}/api/catalogo?slug=${encodeURIComponent(slug || '')}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.products || []);
        setProducts(list);
        if (!Array.isArray(data)) setWhatsapp(data?.catalogo_whatsapp || data?.whatsapp || '');
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setLoading(false);
      });
  }, [slug]);

  const addToCart = (product) => {
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

  const filteredProducts = products.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

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
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)', fontFamily: 'var(--font-main)', paddingBottom: '100px' }}>
      
      {/* HEADER */}
      <header style={{ background: 'var(--bg-card)', padding: '24px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--gradient-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px rgba(20,187,166,0.3)' }}>
              <Icons.Store />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Mi Tienda'}
              </h1>
              <p style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', margin: '4px 0 0 0', fontWeight: 600 }}>Catálogo Online</p>
            </div>
          </div>

          <button onClick={() => setIsCartOpen(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '12px 20px', borderRadius: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.05)'}>
             <Icons.ShoppingCart />
             <span style={{ fontWeight: 800 }}>{formatPrice(cartTotal)}</span>
             {cart.length > 0 && (
               <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--accent-danger)', color: 'white', fontSize: '0.75rem', fontWeight: 800, width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                 {cart.reduce((a,c) => a + c.qty, 0)}
               </span>
             )}
          </button>
        </div>
      </header>

      {/* SEARCH */}
      <div style={{ maxWidth: '1200px', margin: '32px auto 0', padding: '0 24px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
          <input 
            type="text" 
            placeholder="Buscar productos..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '20px 20px 20px 56px', borderRadius: '16px', fontSize: '1.1rem', outline: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
          />
        </div>
      </div>

      {/* PRODUCTS GRID */}
      <main style={{ maxWidth: '1200px', margin: '32px auto', padding: '0 24px' }}>
        {loading ? (
           <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>Cargando catálogo...</div>
        ) : filteredProducts.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>No se encontraron productos.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {filteredProducts.map(p => (
              <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'transform 0.2s, box-shadow 0.2s' }} onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(0,0,0,0.2)'}} onMouseLeave={e=>{e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{p.category}</span>
                </div>
                
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</h3>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(p.price)}</div>
                </div>

                <button onClick={() => addToCart(p)} style={{ width: '100%', padding: '12px', background: 'rgba(20,187,166,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(20,187,166,0.2)', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', marginTop: 'auto' }} onMouseEnter={e=>{e.target.style.background='var(--gradient-primary)'; e.target.style.color='white'}} onMouseLeave={e=>{e.target.style.background='rgba(20,187,166,0.1)'; e.target.style.color='var(--accent-primary)'}}>
                  Agregar al Pedido
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CART DRAWER / MODAL */}
      {isCartOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(11, 19, 43, 0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--bg-main)', width: '100%', maxWidth: '450px', height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease-out' }}>
             
             <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Icons.ShoppingCart /> Tu Pedido
               </h2>
               <button onClick={() => setIsCartOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                 <button onClick={sendWhatsAppOrder} style={{ width: '100%', padding: '16px', background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 8px 24px rgba(20,187,166,0.3)' }}>
                    Enviar Pedido por WhatsApp
                 </button>
               </div>
             )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

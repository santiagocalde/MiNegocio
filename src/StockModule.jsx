import React, { useState, useEffect, useRef } from 'react';

const Icons = {
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Filter: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>,
  Box: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  Clock: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Warning: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  ChevronDown: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>,
  Image: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

function AlertAccordion({ icon: Icon, title, subtitle, data, isOpen, onToggle, columns, renderRow }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: 'var(--text-secondary)' }}><Icon /></div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          {isOpen ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        </div>
      </div>
      {isOpen && data.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {columns.map((c, i) => <th key={i} style={{ padding: '12px 24px', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {renderRow(item)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ isOn }) {
  return (
    <div style={{ width: '36px', height: '20px', background: isOn ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.1)', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
      <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: isOn ? '18px' : '2px', transition: 'all 0.3s' }} />
    </div>
  );
}

export default function StockModule({ serverUrl, onProductsUpdated, addToast, products: globalProductsDB }) {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [openAccordion, setOpenAccordion] = useState(null); // 'vencer', 'empty', 'low'

  const fetchProducts = async (q = '') => {
    setLoading(true);
    try {
      const url = q ? `${serverUrl}/products?q=${encodeURIComponent(q)}` : `${serverUrl}/products`;
      const res = await fetch(url);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSearch = (e) => {
    if (e.key === 'Enter') fetchProducts(query);
  };

  // derived data
  const emptyStock = products.filter(p => p.stock === 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.min_stock);
  const nearExpiry = products.filter(p => p.expiry_date && new Date(p.expiry_date) <= new Date(Date.now() + 15 * 86400000) && new Date(p.expiry_date) >= new Date());

  const toggleAccordion = (name) => {
    setOpenAccordion(openAccordion === name ? null : name);
  };

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Inventario</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>Control y seguimiento de stock de productos.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
             + Nuevo Producto
           </button>
           <button style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}>
             Opciones...
           </button>
        </div>
      </div>

      {/* ACCORDIONS ALERTAS */}
      <div style={{ marginBottom: '24px', flexShrink: 0 }}>
        <AlertAccordion 
          icon={Icons.Clock} title="Productos por vencer" subtitle={`${nearExpiry.length} alerta dentro de los próximos 15 días`} 
          isOpen={openAccordion === 'vencer'} onToggle={() => toggleAccordion('vencer')}
          data={nearExpiry} columns={['Producto', 'Código', 'Cantidad', 'Vence', 'Estado', 'Acción']}
          renderRow={(p) => (
            <>
              <td style={{ padding: '16px 24px', fontWeight: 600 }}>{p.name}</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.code}</td>
              <td style={{ padding: '16px 24px' }}>{p.stock} u</td>
              <td style={{ padding: '16px 24px' }}>{new Date(p.expiry_date).toLocaleDateString('es-AR')}</td>
              <td style={{ padding: '16px 24px' }}><span style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--accent-warning)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>Vence pronto</span></td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', cursor: 'pointer' }}><Icons.Trash /></td>
            </>
          )}
        />
        <AlertAccordion 
          icon={Icons.Box} title="Sin Stock" subtitle={`${emptyStock.length} productos sin stock`} 
          isOpen={openAccordion === 'empty'} onToggle={() => toggleAccordion('empty')}
          data={emptyStock} columns={['Producto', 'Código', 'Categoría', 'Stock', 'Estado']}
          renderRow={(p) => (
            <>
              <td style={{ padding: '16px 24px', fontWeight: 600 }}>{p.name}</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.code}</td>
              <td style={{ padding: '16px 24px' }}><span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', borderRadius: '12px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}>{p.category_name || 'Varios'}</span></td>
              <td style={{ padding: '16px 24px', color: 'var(--accent-danger)', fontWeight: 800 }}>0 u</td>
              <td style={{ padding: '16px 24px' }}><span style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>Agotado</span></td>
            </>
          )}
        />
        <AlertAccordion 
          icon={Icons.Warning} title="Alertas de Stock" subtitle={`${lowStock.length} productos con stock bajo`} 
          isOpen={openAccordion === 'low'} onToggle={() => toggleAccordion('low')}
          data={lowStock} columns={['Producto', 'Código', 'Cantidad Actual', 'Mínimo', 'Estado']}
          renderRow={(p) => (
            <>
              <td style={{ padding: '16px 24px', fontWeight: 600 }}>{p.name}</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.code}</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-primary)', fontWeight: 700 }}>{p.stock} u</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{p.min_stock} u</td>
              <td style={{ padding: '16px 24px' }}><span style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--accent-warning)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>Crítico</span></td>
            </>
          )}
        />
      </div>

      {/* SEARCH BAR FULL WIDTH */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
          <input 
            type="text" 
            placeholder="Buscar por nombre o código..." 
            value={query}
            onChange={e => { setQuery(e.target.value); if(e.target.value==='') fetchProducts(''); }}
            onKeyDown={handleSearch}
            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px 12px 48px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
          />
        </div>
        <button onClick={() => alert('Próximamente: Panel de Filtros Avanzados')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icons.Filter /> Filtros
        </button>
      </div>

      {/* MAIN TABLE */}
      <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Productos</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0 }}>Control y seguimiento de inventario de productos</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
              <tr style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px', width: '80px' }}>Imagen</th>
                <th style={{ padding: '16px 24px' }}>Producto ↑↓</th>
                <th style={{ padding: '16px 24px' }}>Categoría</th>
                <th style={{ padding: '16px 24px' }}>Precio</th>
                <th style={{ padding: '16px 24px' }}>Estado</th>
                <th style={{ padding: '16px 24px' }}>Stock ↑↓</th>
                <th style={{ padding: '16px 24px' }}>Proveedor</th>
                <th style={{ padding: '16px 24px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  {/* IMAGEN */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      <Icons.Image />
                    </div>
                  </td>
                  {/* PRODUCTO */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{p.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{p.code}</div>
                  </td>
                  {/* CATEGORIA */}
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', borderRadius: '12px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {p.category_name || 'Sin categoría'}
                    </span>
                  </td>
                  {/* PRECIO */}
                  <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem' }}>
                    ${p.price.toLocaleString('es-AR')}
                  </td>
                  {/* ESTADO */}
                  <td style={{ padding: '16px 24px' }}>
                    <ToggleSwitch isOn={p.stock > 0} />
                  </td>
                  {/* STOCK */}
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: p.stock === 0 ? 'var(--accent-danger)' : 'var(--text-primary)', marginBottom: '2px' }}>{p.stock} u</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Alerta: {p.min_stock} u</div>
                  </td>
                  {/* PROVEEDOR */}
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Sin proveedor
                  </td>
                  {/* ACCIONES */}
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <button onClick={() => alert('Próximamente: Edición rápida')} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>Editar</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && !loading && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>No hay productos en inventario.</td></tr>
              )}
              {loading && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>Cargando inventario...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

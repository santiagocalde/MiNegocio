import { useState, useEffect, useRef, forwardRef } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost, apiPatch, SERVER_URL } from '../services/apiClient';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import useSortable from '../hooks/useSortable.jsx';

const Icons = {
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Filter: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>,
  Box: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  Clock: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Warning: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  ChevronDown: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>,
  Image: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Chart: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Download: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Wifi: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" /></svg>,
  Package: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
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

const CACHE_KEY = 'minegocio_inventario_cache';

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error(e) }
  return null;
}

function saveCache(products, deadStock) {
  try {
    const limited = products.slice(0, 2000);
    const payload = JSON.stringify({ products: limited, deadStock, ts: Date.now() });
    if (payload.length > 4_000_000) {
      const furtherLimited = products.slice(0, Math.floor(2000 * 4_000_000 / payload.length));
      localStorage.setItem(CACHE_KEY, JSON.stringify({ products: furtherLimited, deadStock, ts: Date.now() }));
    } else {
      localStorage.setItem(CACHE_KEY, payload);
    }
  } catch (e) {
    console.error('Error guardando cache de inventario:', e);
  }
}

export default function StockModule() {
  const { backend, addToast, currentSucursalId, backendError } = usePanelContext();
  const onProductsUpdated = backend.fetchProductsDB;
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [openAccordion, setOpenAccordion] = useState(null);
  const [deadStock, setDeadStock] = useState([]);
  const [offline, setOffline] = useState(false);
  const { sorted: sortedProducts, toggleSort, SortIcon } = useSortable(products, 'name');



  const [showAumentoMasivo, setShowAumentoMasivo] = useState(false);
  const [aumentoPorcentaje, setAumentoPorcentaje] = useState('');
  const fileInputRef = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStock, setFilterStock] = useState('all');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');

  const [showNuevoProducto, setShowNuevoProducto] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newProduct, setNewProduct] = useState({ code: '', name: '', price: '', cost_price: '', stock: '', min_stock: '5', iva: '21%', category_id: '' });

  useEffect(() => {
    apiGet('/categories').then(r => r.ok ? r.json() : []).then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const handleCreateProduct = async () => {
    if (!newProduct.code || !newProduct.name) {
      if (addToast) addToast('Código y nombre son obligatorios.', 'error');
      return;
    }
    const price = parseFloat(newProduct.price) || 0;
    const cost = parseFloat(newProduct.cost_price) || 0;
    const stock = parseInt(newProduct.stock) || 0;
    if (price < 0 || cost < 0 || stock < 0) {
      if (addToast) addToast('Precio, costo y stock no pueden ser negativos.', 'error');
      return;
    }
    try {
      const res = await apiPost('/products', {
        code: newProduct.code,
        name: newProduct.name,
        price,
        cost_price: cost,
        stock,
        min_stock: parseInt(newProduct.min_stock) || 5,
        iva: newProduct.iva || '21%',
        category_id: newProduct.category_id ? parseInt(newProduct.category_id) : null,
      });
      if (res.ok) {
        if (addToast) addToast('Producto creado exitosamente.', 'success');
        setShowNuevoProducto(false);
        setNewProduct({ code: '', name: '', price: '', cost_price: '', stock: '', min_stock: '5', iva: '21%', category_id: '' });
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else {
        const data = await res.json().catch(()=>({}));
        if (addToast) addToast(data.detail || 'Error al crear producto.', 'error');
      }
    } catch {
      if (addToast) addToast('Error de conexión.', 'error');
    }
  };

  const handleUnpack = async (productId) => {
    try {
      const res = await apiPost(`/products/${productId}/unpack?operator=Admin`, {});
      if (res.ok) {
        if (addToast) addToast("Bulto desarmado con éxito.", "success");
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else {
        const data = await res.json().catch(()=>({}));
        if (addToast) addToast(data.detail || "Error al abrir bulto", "error");
      }
    } catch {
      if (addToast) addToast("Error de conexión", "error");
    }
  };

  const handleAumentoMasivo = async () => {
    const pct = parseFloat(aumentoPorcentaje);
    if (aumentoPorcentaje === '' || isNaN(pct) || pct <= 0) {
      if (addToast) addToast('Ingresá un porcentaje mayor a 0.', 'error');
      return;
    }
    if (!window.confirm(`Vas a aumentar TODOS los precios un ${pct}%. Un producto de $1.000 pasara a costar $${Math.round(1000 * (1 + pct / 100)).toLocaleString('es-AR')}. No se puede deshacer. Continuar?`)) return;
    try {
      const payload = { percentage: pct };
      if (filterCategory) payload.category_id = parseInt(filterCategory);
      await apiPost('/products/batch-increase', payload);
      if (addToast) addToast(`Precios aumentados un ${aumentoPorcentaje}% exitosamente.`, 'success');
      setShowAumentoMasivo(false);
      setAumentoPorcentaje('');
      setFilterCategory('');
      fetchProducts();
      if (onProductsUpdated) onProductsUpdated();
    } catch(e) {
      if (addToast) addToast('Error al aumentar precios.', 'error');
    }
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (addToast) addToast(`Importando ${file.name}...`, 'info');
    try {
      const text = await file.text();
      const res = await fetch(`${SERVER_URL}/products/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      });
      const data = await res.json();
      if (res.ok) {
        if (addToast) addToast(`${data.imported} productos importados exitosamente.`, 'success');
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else {
        if (addToast) addToast(data.detail || 'Error al importar archivo.', 'error');
      }
    } catch {
      if (addToast) addToast('Error de conexión al importar archivo.', 'error');
    }
    e.target.value = '';
  };

  const fetchProducts = async (q = '') => {
    setLoading(true);
    setOffline(false);
    try {
      let path = `/products?limit=500`;
      if (q) path += `&q=${encodeURIComponent(q)}`;
      const res = await apiGet(path);
      const data = await res.json();
      const productList = Array.isArray(data) ? data : [];
      setProducts(productList);

      let deadList = [];
      try {
        const deadRes = await apiGet('/products/dead-stock?days=30');
        const deadData = await deadRes.json();
        deadList = Array.isArray(deadData) ? deadData : [];
      } catch (e) { console.error(e) }
      setDeadStock(deadList);

      saveCache(productList, deadList);
    } catch (e) {
      const cached = loadCache();
      if (cached && cached.products?.length > 0) {
        setProducts(cached.products);
        setDeadStock(cached.deadStock || []);
        setOffline(true);
        if (addToast) addToast('Mostrando datos guardados. Sin conexión al servidor.', 'info');
      } else {
        setProducts([]);
        setDeadStock([]);
        if (addToast) addToast('Error al cargar inventario. Verificá la conexión.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = sortedProducts.filter(p => {
    if (p.price == null) return false;
    if (filterCategory && String(p.category_id) !== String(filterCategory)) return false;
    if (filterStock === 'out_stock' && p.stock > 0) return false;
    if (filterStock === 'in_stock' && p.stock <= 0) return false;
    if (filterStock === 'low_stock' && p.stock > p.min_stock) return false;
    return true;
  });

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
           <button onClick={() => setShowNuevoProducto(true)} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
              + Nuevo Producto
            </button>
            <button onClick={() => setShowAumentoMasivo(true)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--accent-danger)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Icons.Chart /> Aumento Masivo
            </button>
            <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleImportCsv} />
            <button onClick={() => fileInputRef.current?.click()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Icons.Download /> Importar CSV
            </button>
        </div>
      </div>

      {/* OFFLINE BANNER */}
      {offline && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Icons.Wifi style={{ width: '20px', height: '20px', color: 'var(--accent-warning)', flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sin conexión al servidor. Mostrando datos guardados.
          </span>
          <button onClick={() => fetchProducts()} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
            Reintentar
          </button>
        </div>
      )}

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
              <td style={{ padding: '16px 24px' }}>{p.stock ?? 0} u</td>
              <td style={{ padding: '16px 24px' }}>{new Date(p.expiry_date).toLocaleDateString('es-AR')}</td>
              <td style={{ padding: '16px 24px' }}><span style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--accent-warning)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>Vence pronto</span></td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => {
                if (window.confirm(`Eliminar ${p.name}?`)) {
                  apiPost(`/products/${p.id}`, {}).then(r => {
                    if (r.ok) { addToast(`${p.name} eliminado.`, 'success'); fetchProducts(); }
                    else addToast('Error al eliminar.', 'error');
                  }).catch(() => addToast('Error de conexion.', 'error'));
                }
              }}><Icons.Trash /></td>
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
              <td style={{ padding: '16px 24px', color: 'var(--text-primary)', fontWeight: 700 }}>{p.stock ?? 0} u</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{p.min_stock ?? 0} u</td>
              <td style={{ padding: '16px 24px' }}><span style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--accent-warning)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>Crítico</span></td>
            </>
          )}
        />
        <AlertAccordion 
          icon={Icons.Trash} title="Stock Muerto" subtitle={`${deadStock.length} productos sin ventas en 30 días`} 
          isOpen={openAccordion === 'dead'} onToggle={() => toggleAccordion('dead')}
          data={deadStock} columns={['Producto', 'Código', 'Categoría', 'Stock Estancado', 'Precio']}
          renderRow={(p) => (
            <>
              <td style={{ padding: '16px 24px', fontWeight: 600 }}>{p.name}</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.code}</td>
              <td style={{ padding: '16px 24px' }}>{p.category_name}</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-primary)', fontWeight: 800 }}>{p.stock ?? 0} u</td>
              <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>${p.price ?? 0}</td>
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
        <button onClick={() => setShowFilters(!showFilters)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icons.Filter /> Filtros
        </button>
      </div>

      {showFilters && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', flexWrap: 'wrap', alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Categoria</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 6, fontSize: '0.85rem', outline: 'none' }}>
              <option value="">Todas</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Stock</label>
            <select value={filterStock} onChange={e => setFilterStock(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 6, fontSize: '0.85rem', outline: 'none' }}>
              <option value="all">Todos</option>
              <option value="in_stock">Con stock</option>
              <option value="out_stock">Sin stock</option>
              <option value="low_stock">Stock bajo</option>
            </select>
          </div>
          <button onClick={() => { setShowFilters(false); setFilterCategory(''); setFilterStock('all'); }} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Limpiar</button>
        </div>
      )}

      {/* MAIN TABLE */}
      <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Productos</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0 }}>Control y seguimiento de inventario de productos</p>
        </div>

        <div style={{ flex: 1 }}>
          {filteredProducts.length > 0 ? (
            <TableVirtuoso
              data={filteredProducts}
              style={{ height: '100%' }}
              components={{
                Table: ({ style, ...props }) => <table style={{ ...style, width: '100%', borderCollapse: 'collapse', textAlign: 'left' }} {...props} />,
                TableHead: forwardRef((props, ref) => <thead ref={ref} style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }} {...props} />),
                TableRow: ({ item, ...props }) => <tr {...props} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background='transparent'} />
              }}
              fixedHeaderContent={() => (
                <tr style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 24px', width: '80px', background: 'var(--bg-main)' }}>Imagen</th>
                  <th style={{ padding: '16px 24px', background: 'var(--bg-main)', cursor: 'pointer' }} onClick={() => toggleSort('name')}>Producto<SortIcon columnKey="name" /></th>
                  <th style={{ padding: '16px 24px', background: 'var(--bg-main)', cursor: 'pointer' }} onClick={() => toggleSort('category_name')}>Categoría<SortIcon columnKey="category_name" /></th>
                  <th style={{ padding: '16px 24px', background: 'var(--bg-main)', cursor: 'pointer' }} onClick={() => toggleSort('price')}>Precio<SortIcon columnKey="price" /></th>
                  <th style={{ padding: '16px 24px', background: 'var(--bg-main)' }}>Estado</th>
                  <th style={{ padding: '16px 24px', background: 'var(--bg-main)', cursor: 'pointer' }} onClick={() => toggleSort('stock')}>Stock<SortIcon columnKey="stock" /></th>
                  <th style={{ padding: '16px 24px', background: 'var(--bg-main)' }}>Proveedor</th>
                  <th style={{ padding: '16px 24px', textAlign: 'center', background: 'var(--bg-main)' }}>Acciones</th>
                </tr>
              )}
              itemContent={(index, p) => (
                <>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      <Icons.Image />
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{p.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{p.code}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', borderRadius: '12px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {p.category_name || 'Sin categoría'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem' }}>
                    ${(p.price ?? 0).toLocaleString('es-AR')}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <ToggleSwitch isOn={p.stock > 0} />
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: (p.stock ?? 0) === 0 ? 'var(--accent-danger)' : 'var(--text-primary)', marginBottom: '2px' }}>{p.stock ?? 0} u</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Alerta: {p.min_stock ?? 0} u</div>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Sin proveedor
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={async () => {
                        const newPrice = prompt(`Nuevo precio para ${p.name} (actual: $${p.price}):`, p.price);
                        if (newPrice !== null && !isNaN(newPrice) && parseFloat(newPrice) >= 0) {
                          try {
                            const res = await apiPatch(`/products/${p.id}/price`, { price: parseFloat(newPrice) });
                            if (res.ok) {
                              if (addToast) addToast(`Precio de ${p.name} actualizado.`, 'success');
                              fetchProducts();
                              if (onProductsUpdated) onProductsUpdated();
                            } else {
                              if (addToast) addToast('Error al actualizar precio.', 'error');
                            }
                          } catch {
                            if (addToast) addToast('Error de conexión.', 'error');
                          }
                        }
                      }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>$ Precio</button>
                      <button onClick={async () => {
                        const newStock = prompt(`Nuevo stock para ${p.name} (actual: ${p.stock}):`, p.stock);
                        if (newStock !== null && !isNaN(newStock) && parseInt(newStock) >= 0) {
                          try {
                            const res = await apiPatch(`/products/${p.id}/stock`, { stock: parseInt(newStock) });
                            if (res.ok) {
                              if (addToast) addToast(`Stock de ${p.name} actualizado.`, 'success');
                              fetchProducts();
                              if (onProductsUpdated) onProductsUpdated();
                            } else {
                              if (addToast) addToast('Error al actualizar stock.', 'error');
                            }
                          } catch {
                            if (addToast) addToast('Error de conexión.', 'error');
                          }
                        }
                      }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Stock</button>
                      <button onClick={async () => {
                        const newName = prompt(`Nuevo nombre para ${p.name}:`, p.name);
                        if (newName !== null && newName.trim()) {
                          try {
                            const res = await apiPatch(`/products/${p.id}`, { name: newName.trim() });
                            if (res.ok) {
                              if (addToast) addToast(`Nombre de ${p.name} actualizado.`, 'success');
                              fetchProducts();
                              if (onProductsUpdated) onProductsUpdated();
                            } else {
                              if (addToast) addToast('Error al actualizar nombre.', 'error');
                            }
                          } catch {
                            if (addToast) addToast('Error de conexión.', 'error');
                          }
                        }
                      }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Nombre</button>
                      {p.is_virtual === 1 && p.stock > 0 && (
                        <button onClick={() => handleUnpack(p.id)} style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icons.Package style={{ width: '14px', height: '14px' }} /> Desarmar</button>
                      )}
                    </div>
                  </td>
                </>
              )}
            />
          ) : loading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : (
            <EmptyState icon="Package" title={offline ? 'Sin conexión' : 'Inventario vacío'}
              description={offline ? 'No se pudieron cargar los datos guardados. Verificá la conexión al servidor.' : 'No hay productos en el inventario. Creá tu primer producto o importá un archivo CSV.'}
              actionLabel={offline ? 'Reintentar' : undefined} actionOnClick={offline ? () => fetchProducts() : undefined} />
          )}
        </div>
      </div>

      {/* MODAL NUEVO PRODUCTO */}
      {showNuevoProducto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 24px 0', color: 'var(--text-primary)' }}>Nuevo Producto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[{ label: 'Código', key: 'code', type: 'text' }, { label: 'Nombre', key: 'name', type: 'text' },
                { label: 'Precio Venta ($)', key: 'price', type: 'number' }, { label: 'Precio Costo ($)', key: 'cost_price', type: 'number' },
                { label: 'Stock', key: 'stock', type: 'number' }, { label: 'Stock Mínimo', key: 'min_stock', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>{f.label}</label>
                  <input type={f.type} value={newProduct[f.key]} onChange={e => setNewProduct({ ...newProduct, [f.key]: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>IVA</label>
                <select value={newProduct.iva} onChange={e => setNewProduct({ ...newProduct, iva: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                  <option value="21%">21%</option><option value="10.5%">10.5%</option><option value="0%">0%</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Categoría</label>
                <select value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => { setShowNuevoProducto(false); setNewProduct({ code: '', name: '', price: '', cost_price: '', stock: '', min_stock: '5', iva: '21%', category_id: '' }); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleCreateProduct}
                style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                Crear Producto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUMENTO MASIVO */}
      {showAumentoMasivo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '400px', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Aumento Masivo de Precios</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
              Ingresa el porcentaje de inflación para actualizar todos los precios de venta automáticamente.
            </p>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>Porcentaje de Aumento (%)</label>
              <input 
                type="number" 
                value={aumentoPorcentaje}
                onChange={e => setAumentoPorcentaje(e.target.value)}
                placeholder="Ej: 15"
                autoFocus
                style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 700, outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>Categoria (opcional — deja vacio para todos)</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '1rem', outline: 'none' }}>
                <option value="">Todas las categorias</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAumentoMasivo(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleAumentoMasivo} disabled={!aumentoPorcentaje} style={{ background: 'var(--accent-danger)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: !aumentoPorcentaje ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: !aumentoPorcentaje ? 0.5 : 1 }}>
                Aplicar Aumento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { usePanelContext } from '../context/PanelContext';
import useIsMobile from '../hooks/useIsMobile';
import { apiGet, apiPost, apiPut, apiDelete, SERVER_URL } from '../services/apiClient';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import useSortable from '../hooks/useSortable.jsx';
import ConfirmModal from '../components/ui/ConfirmModal';
import ProductThumb from '../components/ui/ProductThumb';
import CameraBarcodeScanner from '../components/ui/CameraBarcodeScanner';

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
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '6px', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <div style={{ color: 'var(--text-secondary)', alignSelf: 'center' }}><Icon /></div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{title}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{subtitle}</div>
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
                {columns.map((c, i) => <th key={i} style={{ padding: '8px 16px', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}>{c}</th>)}
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

const APPROX_COST_RATIO = 0.6;

const valorizedStock = (p) => {
  const stock = Number(p.stock) || 0;
  const cost = Number(p.cost_price) || 0;
  const effCost = cost > 0 ? cost : Math.round((Number(p.price) || 0) * APPROX_COST_RATIO);
  return { value: Math.round(stock * effCost), approx: cost <= 0, effCost: Math.round(effCost) };
};

const formatMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

export default function StockModule() {
  const isMobile = useIsMobile();
  const { backend, addToast } = usePanelContext();
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

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [showNuevoProducto, setShowNuevoProducto] = useState(false);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [newProduct, setNewProduct] = useState({ code: '', name: '', price: '', cost_price: '', price_b: '', price_c: '', price_d: '', price_e: '', stock: '', min_stock: '5', iva: '21%', category_id: '', supplier_id: '', unit_label: 'unidad', codigos_extra: '' });
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmLabel: 'Confirmar', variant: 'danger' });
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [promptState, setPromptState] = useState({ isOpen: false, title: '', value: '', onConfirm: null });
  const [variantParent, setVariantParent] = useState(null);   // producto padre para gestión de variantes
  const [variantList, setVariantList] = useState([]);
  const [variantLoading, setVariantLoading] = useState(false);
  const [newVariantLabel, setNewVariantLabel] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('');
  const [variantSaving, setVariantSaving] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [editVariantLabel, setEditVariantLabel] = useState('');
  const [editVariantPrice, setEditVariantPrice] = useState('');
  const [editVariantStock, setEditVariantStock] = useState('');
  const [openActionMenu, setOpenActionMenu] = useState(null); // id del producto con menú de acciones abierto (mobile)

  const openVariantManager = async (p) => {
    setVariantParent(p);
    setVariantLoading(true);
    try {
      const r = await apiGet(`/products/${p.id}/variants`);
      if (r.ok) setVariantList(await r.json());
    } catch {} finally { setVariantLoading(false); }
  };

  const handleAddVariant = async () => {
    if (!newVariantLabel.trim()) { addToast('Escribí la etiqueta de la variante (ej: "25 kg").', 'error'); return; }
    setVariantSaving(true);
    try {
      const r = await apiPost('/products', {
        name: variantParent.name,
        code: `${variantParent.code || ''}-${newVariantLabel.replace(/\s+/g, '').toLowerCase()}`,
        price: parseFloat(newVariantPrice) || variantParent.price || 0,
        stock: parseFloat(newVariantStock) || 0,
        category_id: variantParent.category_id || null,
        parent_product_id: variantParent.id,
        variant_label: newVariantLabel.trim(),
        unit_label: variantParent.unit_label || 'unidad',
      });
      if (r.ok) {
        addToast(`Variante "${newVariantLabel}" creada.`, 'success');
        setNewVariantLabel(''); setNewVariantPrice(''); setNewVariantStock('');
        const r2 = await apiGet(`/products/${variantParent.id}/variants`);
        if (r2.ok) setVariantList(await r2.json());
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else { addToast('No se pudo crear la variante.', 'error'); }
    } catch { addToast('Error de conexión.', 'error'); }
    setVariantSaving(false);
  };

  const startEditVariant = (v) => {
    setEditingVariantId(v.id);
    setEditVariantLabel(v.variant_label || '');
    setEditVariantPrice(v.price || '');
    setEditVariantStock(v.stock ?? '');
  };

  const cancelEditVariant = () => {
    setEditingVariantId(null);
    setEditVariantLabel('');
    setEditVariantPrice('');
    setEditVariantStock('');
  };

  const handleUpdateVariant = async (v) => {
    const price = parseFloat(editVariantPrice);
    const stock = parseFloat(editVariantStock);
    const label = editVariantLabel.trim();
    if (!label) { addToast('La etiqueta no puede estar vacia.', 'error'); return; }
    try {
      const r = await apiPut('/products/' + v.id, {
        variant_label: label,
        price: isNaN(price) ? v.price : price,
        stock: isNaN(stock) ? (v.stock ?? 0) : stock,
      });
      if (r.ok) {
        addToast('Variante actualizada.', 'success');
        cancelEditVariant();
        const r2 = await apiGet('/products/' + variantParent.id + '/variants');
        if (r2.ok) setVariantList(await r2.json());
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else { addToast('No se pudo actualizar.', 'error'); }
    } catch { addToast('Error de conexion.', 'error'); }
  };

  const handleDeleteVariant = async (v) => {
    if (!window.confirm('Eliminar la variante ' + (v.variant_label || v.name) + '? Esta accion no se puede deshacer.')) return;
    try {
      const r = await apiDelete('/products/' + v.id);
      if (r.ok) {
        addToast('Variante eliminada.', 'success');
        const r2 = await apiGet('/products/' + variantParent.id + '/variants');
        if (r2.ok) setVariantList(await r2.json());
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else { addToast('No se pudo eliminar.', 'error'); }
    } catch { addToast('Error de conexion.', 'error'); }
  };
  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState(null); // 'code' when scanning for product code
  const [importResult, setImportResult] = useState(null); // resultado de la última importación CSV
  const [showCsvHelp, setShowCsvHelp] = useState(false);
  const lastScanRef = useRef({ code: '', time: 0 });

  const isDuplicateScan = useCallback((code) => {
    const now = Date.now();
    if (code === lastScanRef.current.code && now - lastScanRef.current.time < 3000) return true;
    lastScanRef.current = { code, time: now };
    return false;
  }, []);

  const handleBarcodeScan = useCallback((code) => {
    if (!code) return;
    // Si el prompt de códigos extra está abierto, inyectar el scan ahí
    if (promptState.isOpen && promptState.text) {
      setPromptState(prev => ({
        ...prev,
        value: prev.value ? prev.value + ', ' + code : code,
      }));
      addToast('Código escaneado: ' + code, 'success');
      return;
    }
    if (scanTarget === 'code') {
      setNewProduct(prev => ({ ...prev, code }));
      addToast('Código escaneado: ' + code, 'success');
    }
    setScanTarget(null);
  }, [scanTarget, promptState, addToast]);

  const handleCreateCategory = async () => {
    if(!newCategoryName.trim()) return;
    try {
      const res = await apiPost('/categories', { name: newCategoryName });
      if(res.ok) {
        const cat = await res.json();
        setCategories([...categories, cat]);
        setNewProduct({...newProduct, category_id: cat.id});
        setShowNewCategory(false);
        setNewCategoryName('');
      }
    } catch (e) {
      console.error('Stock: no se pudo crear la categoría:', e);
      if (addToast) addToast('No se pudo crear la categoría. Revisá la conexión.', 'error');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredProducts.map(p => p.id);
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmState({
      isOpen: true,
      title: 'Eliminar productos',
      message: `¿Eliminar ${selectedIds.size} productos? Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar ${selectedIds.size}`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        let count = 0;
        for (const id of selectedIds) {
          try {
            const res = await apiDelete('/products/' + id);
            if (res.ok) count++;
          } catch { /* seguir con los demás */ }
        }
        if (addToast) addToast(`${count} producto(s) eliminado(s).`, 'success');
        clearSelection();
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      }
    });
  };

  useEffect(() => {
    apiGet('/categories').then(r => r.ok ? r.json() : []).then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet('/suppliers').then(r => r.ok ? r.json() : []).then(d => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
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
        price_b: newProduct.price_b ? parseFloat(newProduct.price_b) : null,
        price_c: newProduct.price_c ? parseFloat(newProduct.price_c) : null,
        price_d: newProduct.price_d ? parseFloat(newProduct.price_d) : null,
        price_e: newProduct.price_e ? parseFloat(newProduct.price_e) : null,
        unit_label: newProduct.unit_label || 'unidad',
        supplier_id: newProduct.supplier_id ? parseInt(newProduct.supplier_id) : null,
        extra_codes: (newProduct.codigos_extra || '').split(',').map(c => c.trim()).filter(Boolean),
      });
      if (res.ok) {
        if (addToast) addToast('Producto creado exitosamente.', 'success');
        setShowNuevoProducto(false);
        setNewProduct({ code: '', name: '', price: '', cost_price: '', price_b: '', price_c: '', price_d: '', price_e: '', stock: '', min_stock: '5', iva: '21%', category_id: '', supplier_id: '', unit_label: 'unidad', codigos_extra: '' });
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else {
        const data = await res.json().catch(()=>({}));
        if (addToast) addToast(data.detail || 'No se pudo crear el producto. Reintentá o revisá tu conexión.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin internet. Revisá tu conexión.', 'error');
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
        if (addToast) addToast(data.detail || "No se pudo abrir el bulto. Reintentá o revisá tu conexión.", "error");
      }
    } catch {
      if (addToast) addToast("Sin internet. Revisá tu conexión.", "error");
    }
  };

  // Acciones por producto, unificadas para desktop (botones) y mobile (menú ⋯)
  const productActions = (p) => {
    const cfg = JSON.parse(localStorage.getItem('minegocio_config') || '{}');
    const lbB = cfg.price_list_b_name || 'Lista B';
    const lbC = cfg.price_list_c_name || 'Lista C';
    const actions = [
      { label: '$ Precio', tone: 'default', onClick: () => setPromptState({ isOpen: true, title: `Nuevo precio para ${p.name} (actual: $${p.price})`, value: p.price ?? '', onConfirm: async (newPrice) => { setPromptState(prev => ({...prev, isOpen: false})); if (newPrice !== null && newPrice !== '' && !isNaN(newPrice) && parseFloat(newPrice) >= 0) { try { const res = await apiPost(`/products/${p.id}/price`, { price: parseFloat(newPrice) }); if (res.ok) { addToast?.(`Precio de ${p.name} actualizado.`, 'success'); fetchProducts(); onProductsUpdated?.(); } else addToast?.('No se pudo actualizar el precio. Reintentá o revisá tu conexión.', 'error'); } catch { addToast?.('Sin internet. Revisá tu conexión.', 'error'); } } } }) },
      { label: `$ ${lbB}`, tone: 'warning', onClick: () => setPromptState({ isOpen: true, title: `${lbB} para ${p.name} (actual: ${p.price_b ? '$' + p.price_b : 'sin cargar'})`, value: p.price_b ?? '', onConfirm: async (val) => { setPromptState(prev => ({...prev, isOpen: false})); if (val !== null && val !== '' && !isNaN(val) && parseFloat(val) >= 0) { try { const res = await apiPut(`/products/${p.id}`, { price_b: parseFloat(val) }); if (res.ok) { addToast?.(`${lbB} de ${p.name} actualizado.`, 'success'); fetchProducts(); onProductsUpdated?.(); } else addToast?.('No se pudo actualizar.', 'error'); } catch { addToast?.('Sin internet.', 'error'); } } } }) },
      { label: `$ ${lbC}`, tone: 'primary', onClick: () => setPromptState({ isOpen: true, title: `${lbC} para ${p.name} (actual: ${p.price_c ? '$' + p.price_c : 'sin cargar'})`, value: p.price_c ?? '', onConfirm: async (val) => { setPromptState(prev => ({...prev, isOpen: false})); if (val !== null && val !== '' && !isNaN(val) && parseFloat(val) >= 0) { try { const res = await apiPut(`/products/${p.id}`, { price_c: parseFloat(val) }); if (res.ok) { addToast?.(`${lbC} de ${p.name} actualizado.`, 'success'); fetchProducts(); onProductsUpdated?.(); } else addToast?.('No se pudo actualizar.', 'error'); } catch { addToast?.('Sin internet.', 'error'); } } } }) },
      { label: 'Stock', tone: 'default', onClick: () => setPromptState({ isOpen: true, title: `Nuevo stock para ${p.name} (actual: ${p.stock})`, value: p.stock ?? '', onConfirm: async (newStock) => { setPromptState(prev => ({...prev, isOpen: false})); if (newStock !== null && newStock !== '' && !isNaN(newStock) && parseInt(newStock) >= 0) { try { const res = await apiPost(`/products/${p.id}/stock`, { stock: parseInt(newStock) }); if (res.ok) { addToast?.(`Stock de ${p.name} actualizado.`, 'success'); fetchProducts(); onProductsUpdated?.(); } else addToast?.('No se pudo actualizar el stock. Reintentá o revisá tu conexión.', 'error'); } catch { addToast?.('Sin internet. Revisá tu conexión.', 'error'); } } } }) },
      { label: 'Nombre', tone: 'default', onClick: () => setPromptState({ isOpen: true, title: `Nuevo nombre para ${p.name}`, value: p.name, onConfirm: async (newName) => { setPromptState(prev => ({...prev, isOpen: false})); if (newName !== null && newName.trim()) { try { const res = await apiPut(`/products/${p.id}`, { name: newName.trim() }); if (res.ok) { addToast?.(`Nombre de ${p.name} actualizado.`, 'success'); fetchProducts(); onProductsUpdated?.(); } else addToast?.('No se pudo actualizar el nombre. Reintentá o revisá tu conexión.', 'error'); } catch { addToast?.('Sin internet. Revisá tu conexión.', 'error'); } } } }) },
      { label: 'Costo', tone: 'default', onClick: () => setPromptState({ isOpen: true, title: `Costo de ${p.name} (actual: ${p.cost_price ? '$' + p.cost_price : 'sin cargar'})`, value: p.cost_price ?? '', onConfirm: async (newCost) => { setPromptState(prev => ({...prev, isOpen: false})); if (newCost !== null && newCost !== '' && !isNaN(newCost) && parseFloat(newCost) >= 0) { try { const res = await apiPut(`/products/${p.id}`, { cost_price: parseFloat(newCost) }); if (res.ok) { addToast?.(`Costo de ${p.name} actualizado.`, 'success'); fetchProducts(); onProductsUpdated?.(); } else addToast?.('No se pudo actualizar el costo. Reintentá o revisá tu conexión.', 'error'); } catch { addToast?.('Sin internet. Revisá tu conexión.', 'error'); } } } }) },
      { label: 'Códigos', tone: 'default', onClick: () => setPromptState({ isOpen: true, title: `Códigos de barra para ${p.name}`, value: (p.extra_codes || []).join(', '), text: true, hint: 'Separados por coma. Los códigos cargados reemplazan a los anteriores.', onConfirm: async (codes) => { setPromptState(prev => ({...prev, isOpen: false})); try { const res = await apiPut(`/products/${p.id}`, { extra_codes: (codes || '').split(',').map(c => c.trim()).filter(Boolean) }); if (res.ok) { addToast?.(`Códigos de ${p.name} actualizados.`, 'success'); fetchProducts(); onProductsUpdated?.(); } else addToast?.('No se pudieron actualizar los códigos. Reintentá o revisá tu conexión.', 'error'); } catch { addToast?.('Sin internet. Revisá tu conexión.', 'error'); } } }) },
      { label: 'Variantes', tone: 'primary', onClick: () => openVariantManager(p) },
      { label: 'Eliminar', tone: 'danger', onClick: () => setConfirmState({ isOpen: true, title: 'Eliminar Producto', message: 'Estas por eliminar ' + p.name + '. Esta accion no se puede deshacer.', confirmLabel: 'Eliminar', variant: 'danger', onConfirm: () => { setConfirmState(prev => ({...prev, isOpen: false})); apiDelete('/products/' + p.id).then(r => { if (r.ok) { addToast(p.name + ' eliminado.', 'success'); fetchProducts(); onProductsUpdated?.(); } else addToast('No se pudo eliminar. Reintenta.', 'error'); }).catch(() => addToast('Sin internet.', 'error')); } }) },
    ];
    if (p.is_virtual === 1 && p.stock > 0) {
      actions.push({ label: 'Desarmar', tone: 'blue', onClick: () => handleUnpack(p.id) });
    }
    return actions;
  };

  const handleAumentoMasivo = async () => {
    const pct = parseFloat(aumentoPorcentaje);
    if (aumentoPorcentaje === '' || isNaN(pct) || pct <= 0) {
      if (addToast) addToast('Ingresá un porcentaje mayor a 0.', 'error');
      return;
    }
    setConfirmState({
      isOpen: true,
      title: 'Confirmar Aumento Masivo',
      message: `Vas a aumentar TODOS los precios un ${pct}%. Un producto de $1.000 pasara a costar $${Math.round(1000 * (1 + pct / 100)).toLocaleString('es-AR')}. No se puede deshacer. Continuar?`,
      confirmLabel: 'Sí, Aumentar',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(prev => ({...prev, isOpen: false}));
        try {
          const body = { percentage: pct };
          if (filterCategory) body.category_id = parseInt(filterCategory);
          const res = await apiPost('/products/batch-increase', body);
          if (res.ok) {
            addToast(`Precios aumentados ${pct}% con éxito`, 'success');
            setShowAumentoMasivo(false);
            setAumentoPorcentaje('');
            fetchProducts();
            onProductsUpdated();
          } else {
            addToast('No se pudieron aumentar los precios. Reintentá o revisá tu conexión.', 'error');
          }
        } catch {
          addToast('Sin internet. Revisá tu conexión.', 'error');
        }
      }
    });
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (addToast) addToast(`Importando ${file.name}…`, 'info');
    try {
      const text = await file.text();
      const token = localStorage.getItem('saas_token');
      const res = await fetch(`${SERVER_URL}/products/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: text,
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
        if (data.imported > 0) {
          if (addToast) addToast(`✅ ${data.imported} productos importados correctamente.`, 'success');
        }
        if (data.errors?.length > 0 && data.imported === 0) {
          if (addToast) addToast(`No se importó ningún producto. Revisá el formato del CSV.`, 'error');
        } else if (data.errors?.length > 0) {
          if (addToast) addToast(`${data.imported} importados, ${data.errors.length} con error.`, 'info');
        }
        fetchProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else {
        setImportResult({ error: data.detail || 'Error al importar' });
        if (addToast) addToast(data.detail || 'No se pudo importar. Tocá "?" para ver el formato correcto.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin internet. No se pudo importar el archivo.', 'error');
    }
    e.target.value = '';
  };

  // Descarga una plantilla CSV de ejemplo
  const downloadCsvTemplate = () => {
    const rows = [
      ['codigo', 'nombre', 'precio', 'costo', 'stock', 'stock_minimo', 'categoria', 'unidad'],
      ['7790001', 'Ejemplo Producto A', '1500', '900', '20', '5', 'Bebidas', 'unidad'],
      ['7790002', 'Ejemplo Producto B', '800', '450', '50', '10', 'Almacén', 'kg'],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_productos.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const fetchProducts = async (q = '') => {
    setLoading(true);
    setOffline(false);

    const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true' || localStorage.getItem('saas_mode') === 'true';
    if (isPreview) {
      const MOCK_PRODUCTS = [
        { id: 1, name: 'Coca Cola 2.25L Retornable', code: '7790895000997', price: 2500, cost_price: 1800, stock: 24, min_stock: 12, category_name: 'Bebidas', category_id: 1, iva: '21%' },
        { id: 2, name: 'Alfajor Jorgito Chocolate', code: '7791234567890', price: 800, cost_price: 500, stock: 45, min_stock: 15, category_name: 'Golosinas', category_id: 2, iva: '21%' },
        { id: 3, name: 'Yerba Playadito 1Kg', code: '7791234567891', price: 3500, cost_price: 2600, stock: 10, min_stock: 5, category_name: 'Almacén', category_id: 3, iva: '21%' },
        { id: 4, name: 'Papas Lays Clásicas 145g', code: '7791234567892', price: 1800, cost_price: 1200, stock: 2, min_stock: 10, category_name: 'Snacks', category_id: 4, iva: '21%' },
        { id: 5, name: 'Cerveza Quilmes 1L Retornable', code: '7791234567893', price: 1900, cost_price: 1400, stock: 36, min_stock: 24, category_name: 'Bebidas Alcoholicas', category_id: 5, iva: '21%' },
        { id: 6, name: 'Chocolate Block 170g', code: '7791234567894', price: 2200, cost_price: 1500, stock: 0, min_stock: 10, category_name: 'Golosinas', category_id: 2, iva: '21%' },
        { id: 7, name: 'Galletitas Oreo 117g', code: '7791234567895', price: 900, cost_price: 600, stock: 20, min_stock: 15, category_name: 'Almacén', category_id: 3, iva: '21%' }
      ];
      setTimeout(() => {
        setProducts(q ? MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : MOCK_PRODUCTS);
        setDeadStock([MOCK_PRODUCTS[1]]);
        setLoading(false);
      }, 400);
      return;
    }

    try {
      let path = `/products?limit=3500`;
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
    } catch {
      const cached = loadCache();
      if (cached && cached.products?.length > 0) {
        setProducts(cached.products);
        setDeadStock(cached.deadStock || []);
        setOffline(true);
        if (addToast) addToast('Mostrando datos guardados. Sin internet.', 'info');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = sortedProducts.filter(p => {
    if (p.price == null) return false;
    if (filterCategory && String(p.category_id) !== String(filterCategory)) return false;
    if (filterStock === 'out_stock' && p.stock > 0) return false;
    if (filterStock === 'in_stock' && p.stock <= 0) return false;
    if (filterStock === 'low_stock' && p.stock > p.min_stock) return false;
    return true;
  });

  const totalValorizado = filteredProducts.reduce((acc, p) => acc + valorizedStock(p).value, 0);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      if (isDuplicateScan(query)) {
        setQuery('');
        return;
      }
      fetchProducts(query);
    }
  };

  // derived data
  const emptyStock = products.filter(p => p.stock === 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.min_stock);
  // eslint-disable-next-line react-hooks/purity
  const nearExpiry = products.filter(p => p.expiry_date && new Date(p.expiry_date) <= new Date(Date.now() + 15 * 86400000) && new Date(p.expiry_date) >= new Date());

  const toggleAccordion = (name) => {
    setOpenAccordion(openAccordion === name ? null : name);
  };

  return (
    <div style={{ padding: isMobile ? '12px 14px' : '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-end', gap: '10px', marginBottom: '16px', flexShrink: 0 }}>
        <div>
          <div className="ledger-label">Libro de inventario</div>
          <h1 className="ledger-title" style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', marginTop: 4 }}>Lo que tenés</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
           <button onClick={() => setShowNuevoProducto(true)} style={{ flex: isMobile ? 1 : undefined, background: 'var(--accent-primary)', color: 'var(--sheet)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'filter 0.15s', textAlign: 'center' }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}>
              + Nuevo
            </button>
            <button onClick={() => setShowAumentoMasivo(true)} style={{ flex: isMobile ? 1 : undefined, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--accent-danger)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-danger)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
              <Icons.Chart /> {isMobile ? 'Aumento' : 'Aumento masivo'}
            </button>
            <input type="file" ref={fileInputRef} accept=".csv,.txt,.tsv" style={{ display: 'none' }} onChange={handleImportCsv} />
            <div style={{ display: 'inline-flex', gap: 0, flex: isMobile ? 1 : undefined }}>
              <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', borderRight: 'none', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Icons.Download /> CSV
              </button>
              <button onClick={() => setShowCsvHelp(true)} title="Ver formato esperado y descargar plantilla"
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '10px 11px', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                ?
              </button>
            </div>
        </div>
      </div>

      {/* OFFLINE BANNER */}
      {offline && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Icons.Wifi style={{ width: '20px', height: '20px', color: 'var(--accent-warning)', flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sin internet. Mostrando datos guardados.
          </span>
          <button onClick={() => fetchProducts()} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
            Reintentar
          </button>
        </div>
      )}

      {/* SEARCH BAR FULL WIDTH */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
          <input 
            type="text" 
            placeholder="Buscar por nombre o código..." 
            value={query}
            onChange={e => { setQuery(e.target.value); if(e.target.value==='') fetchProducts(''); }}
            onKeyDown={handleSearch}
            style={{ width: '100%', background: 'var(--sheet)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px 12px 48px', borderRadius: 'var(--radius-sm)', fontSize: '0.95rem', outline: 'none' }}
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icons.Filter /> Filtros
        </button>
        <button onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()); }} style={{ background: selectMode ? 'var(--wash-danger)' : 'transparent', border: selectMode ? '1px solid var(--accent-danger)' : '1px solid var(--border-color)', color: selectMode ? 'var(--accent-danger)' : 'var(--text-primary)', padding: '0 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icons.Trash /> {selectMode ? 'Cancelar' : 'Seleccionar'}
        </button>
      </div>

      {selectMode && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>{selectedIds.size} seleccionados</span>
          <button onClick={selectAllFiltered} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>Seleccionar todos</button>
          <button onClick={clearSelection} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>Limpiar</button>
          <button
            disabled={selectedIds.size === 0}
            onClick={handleBatchDelete}
            style={{
              marginLeft: 'auto', padding: '6px 20px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: '0.85rem',
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              background: selectedIds.size === 0 ? 'var(--bg-hover)' : 'rgba(239,68,68,0.15)',
              color: selectedIds.size === 0 ? 'var(--text-secondary)' : 'var(--accent-danger)',
              opacity: selectedIds.size === 0 ? 0.5 : 1,
            }}
          >
            Eliminar {selectedIds.size > 0 ? selectedIds.size : ''}
          </button>
        </div>
      )}

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
      <div className="ledger-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '11px 20px', borderBottom: '1px solid var(--rule-strong)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="ledger-label">Productos</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>· {filteredProducts.length} resultados</span>
          <span style={{ flex: 1 }} />
          <span className="ledger-label">Stock valorizado</span>
          <span className="ledger-num" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{formatMoney(totalValorizado)}</span>
        </div>

        <div style={{ flex: 1 }}>
          {filteredProducts.length > 0 ? (
            <TableVirtuoso
              data={filteredProducts}
              style={{ height: '100%' }}
              className="virtuoso-stock-table"
              fixedHeaderContent={() => (
                <tr style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                  {selectMode && <th style={{ padding: '10px 8px', width: '36px', background: 'var(--bg-main)' }}></th>}
                  <th style={{ padding: '10px 16px', width: '64px', background: 'var(--bg-main)' }}>Imagen</th>
                  <th style={{ padding: '10px 16px', background: 'var(--bg-main)', cursor: 'pointer' }} onClick={() => toggleSort('name')}>Producto<SortIcon columnKey="name" /></th>
                  <th style={{ padding: '10px 16px', background: 'var(--bg-main)', cursor: 'pointer' }} onClick={() => toggleSort('category_name')}>Categoría<SortIcon columnKey="category_name" /></th>
                  <th style={{ padding: '10px 16px', background: 'var(--bg-main)', cursor: 'pointer' }} onClick={() => toggleSort('price')}>Precio<SortIcon columnKey="price" /></th>
                  <th style={{ padding: '10px 16px', background: 'var(--bg-main)' }}>Estado</th>
                  <th style={{ padding: '10px 16px', background: 'var(--bg-main)', cursor: 'pointer' }} onClick={() => toggleSort('stock')}>Stock<SortIcon columnKey="stock" /></th>
                  <th style={{ padding: '10px 16px', background: 'var(--bg-main)' }}>Stock Valorizado</th>
                  <th style={{ padding: '10px 16px', background: 'var(--bg-main)' }}>Proveedor</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', background: 'var(--bg-main)' }}>Acciones</th>
                </tr>
              )}
              itemContent={(index, p) => (
                <>
                  {selectMode && (
                    <td style={{ padding: '8px 8px' }}>
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} style={{ accentColor: '#14BBA6', width: 16, height: 16, cursor: 'pointer' }} />
                    </td>
                  )}
                  <td style={{ padding: '8px 16px' }}>
                    <ProductThumb name={p.name} size={40} />
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '2px' }}>{p.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>{p.code}</div>
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <span style={{ background: 'var(--surface-veil)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '3px', padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                      {p.category_name || 'Sin categoría'}
                    </span>
                  </td>
                  <td className="ledger-num" style={{ padding: '8px 16px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    ${(p.price ?? 0).toLocaleString('es-AR')}
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <span className="ledger-label" style={{ background: p.stock > 0 ? 'var(--wash-success)' : 'var(--wash-danger)', border: '1px solid var(--border-color)', color: p.stock > 0 ? 'var(--accent-success)' : 'var(--accent-danger)', padding: '3px 8px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                      {p.stock > 0 ? 'Con stock' : 'Sin stock'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: (p.stock ?? 0) === 0 ? 'var(--accent-danger)' : 'var(--text-primary)', marginBottom: '1px' }}>{p.stock ?? 0} u</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Alerta: {p.min_stock ?? 0} u</div>
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{formatMoney(valorizedStock(p).value)}</div>
                    {valorizedStock(p).approx ? (
                      <div style={{ color: 'var(--accent-warning)', fontSize: '0.72rem' }} title="Sin costo cargado: se usa aprox. 60% del precio">costo aprox.</div>
                    ) : null}
                  </td>
                  <td style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {p.supplier_name || '—'}
                  </td>
                  <td style={{ padding: isMobile ? '8px 8px' : '16px 24px', textAlign: 'center' }}>
                    {isMobile ? (
                      <>
                        <button onClick={() => setOpenActionMenu(p.id)} aria-label="Acciones" title="Acciones" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', width: '36px', height: '36px', fontSize: '1.15rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, letterSpacing: '1px', lineHeight: 1 }}>⋯</button>
                        {openActionMenu === p.id && (
                          <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }} onClick={() => setOpenActionMenu(null)}>
                            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
                            <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1, background: 'var(--bg-card)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '6px 12px 18px', boxShadow: '0 -4px 24px rgba(0,0,0,0.4)', maxHeight: '80vh', overflowY: 'auto' }}>
                              <div style={{ textAlign: 'center', padding: '10px 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{p.name}</div>
                              {productActions(p).map((a, i) => (
                                <button key={i} onClick={() => { setOpenActionMenu(null); a.onClick(); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderTop: i > 0 ? '1px solid var(--border-color)' : 'none', color: a.tone === 'danger' ? 'var(--accent-danger)' : 'var(--text-primary)', padding: '14px 8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>{a.label}</button>
                              ))}
                              <button onClick={() => setOpenActionMenu(null)} style={{ display: 'block', width: '100%', textAlign: 'center', background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-secondary)', padding: '12px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', marginTop: '8px' }}>Cancelar</button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {productActions(p).map((a, i) => (
                          <button key={i} onClick={a.onClick} className="stock-act" style={{ background: a.tone === 'danger' ? 'rgba(239, 68, 68, 0.08)' : 'transparent', color: a.tone === 'danger' ? 'var(--accent-danger)' : a.tone === 'warning' ? 'var(--accent-warning)' : a.tone === 'primary' ? 'var(--accent-primary)' : a.tone === 'blue' ? 'var(--accent-primary)' : 'var(--text-primary)', border: a.tone === 'danger' ? '1px solid rgba(239, 68, 68, 0.2)' : a.tone === 'warning' ? '1px solid rgba(245,158,11,0.3)' : a.tone === 'primary' ? '1px solid rgba(20,187,166,0.3)' : a.tone === 'blue' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>{a.label}</button>
                        ))}
                      </div>
                    )}
                  </td>
                </>
              )}
            />
          ) : loading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : (
            <EmptyState icon="Package" title={offline ? 'Sin conexión' : 'Inventario vacío'}
              description={offline ? 'No se pudieron cargar los datos guardados. Verificá la conexión a internet.' : 'No hay productos en el inventario. Creá tu primer producto o importá un archivo CSV.'}
              actionLabel={offline ? 'Reintentar' : undefined} actionOnClick={offline ? () => fetchProducts() : undefined} />
          )}
        </div>
      </div>

      {/* ACCORDIONS ALERTAS */}
      <div style={{ marginTop: '10px', flexShrink: 0 }}>
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
                setConfirmState({
                  isOpen: true,
                  title: 'Eliminar Producto',
                  message: `¿Seguro que deseas eliminar ${p.name}?`,
                  confirmLabel: 'Eliminar',
                  variant: 'danger',
                  onConfirm: () => {
                    setConfirmState(prev => ({...prev, isOpen: false}));
                  apiDelete(`/products/${p.id}`).then(r => {
                    if (r.ok) { addToast(`${p.name} eliminado.`, 'success'); fetchProducts(); }
                    else addToast('No se pudo eliminar el producto. Reintentá o revisá tu conexión.', 'error');
                  }).catch(() => addToast('Sin internet. Revisá tu conexión.', 'error'));
                  }
                });
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
          icon={Icons.Trash} title="Sin salida" subtitle={`${deadStock.length} productos sin ventas en 30 días`}
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

      {/* MODAL NUEVO PRODUCTO */}
      {showNuevoProducto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '480px', maxWidth: '92vw', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 24px 0', color: 'var(--text-primary)' }}>Nuevo Producto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[{ label: 'Código', key: 'code', type: 'text' }, { label: 'Nombre', key: 'name', type: 'text' },
                { label: 'Precio Venta ($)', key: 'price', type: 'number' }, { label: 'Precio Costo ($)', key: 'cost_price', type: 'number' },
                { label: 'Stock', key: 'stock', type: 'number' }, { label: 'Stock Mínimo', key: 'min_stock', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>{f.label}</label>
                    {f.key === 'code' && (
                      <button onClick={() => { setScanTarget('code'); setShowScanner(true); }} title="Escanear código de barras" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(20,187,166,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        Escanear
                      </button>
                    )}
                  </div>
                  <input type={f.type} value={newProduct[f.key]} onChange={e => setNewProduct({ ...newProduct, [f.key]: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Categoría</label>
                  <button onClick={() => setShowNewCategory(true)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>+ Nueva</button>
                </div>
                <select value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {suppliers.length > 0 && (
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Proveedor</label>
                  <select value={newProduct.supplier_id} onChange={e => setNewProduct({ ...newProduct, supplier_id: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                    <option value="">Sin proveedor</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Códigos de barra adicionales</label>
                <button onClick={() => { setScanTarget('code'); setShowScanner(true); }} title="Escanear código de barras" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(20,187,166,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  Escanear
                </button>
              </div>
              <input value={newProduct.codigos_extra} onChange={e => setNewProduct({ ...newProduct, codigos_extra: e.target.value })}
                placeholder="Ej: 7790001234567, 7790007654321 (separados por coma)"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Si el mismo producto llega con distintos códigos de barra, agregalos acá: al escanear cualquiera se vende igual.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => { setShowNuevoProducto(false); setNewProduct({ code: '', name: '', price: '', cost_price: '', stock: '', min_stock: '5', iva: '21%', category_id: '', codigos_extra: '' }); }}
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
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '400px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
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

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
        onConfirm={confirmState.onConfirm}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
      />

      {showNewCategory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '300px', maxWidth: '92vw', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Nueva Categoría</h3>
            <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus
                   placeholder="Nombre de categoría"
                   style={{ width: '100%', padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', marginBottom: '16px', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCreateCategory} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>Crear</button>
            </div>
          </div>
        </div>
      )}
      {showScanner && (
        <CameraBarcodeScanner onScan={handleBarcodeScan} onClose={() => { setShowScanner(false); setScanTarget(null); }} />
      )}

      {/* Modal: Ayuda formato CSV */}
      {showCsvHelp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCsvHelp(false); }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 800 }}>Formato del CSV</h3>
              <button onClick={() => setShowCsvHelp(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              El archivo puede estar separado por <b>coma</b>, <b>punto y coma</b> o <b>tab</b>. Acepta nombres de columna en español o inglés:
            </p>

            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 14, marginBottom: 16, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--accent-primary)', fontWeight: 800 }}>Columna (español)</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>También acepta</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Req.</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['codigo', 'code, sku, barcode, ean', 'No*'],
                    ['nombre', 'name, descripcion, articulo', 'Sí'],
                    ['precio', 'price, precio_venta, pvp', 'No'],
                    ['costo', 'cost_price, precio_costo', 'No'],
                    ['stock', 'cantidad, existencia', 'No'],
                    ['stock_minimo', 'min_stock, minimo', 'No'],
                    ['categoria', 'category, rubro, familia', 'No'],
                    ['unidad', 'unit_label, medida, um', 'No'],
                  ].map(([col, alt, req]) => (
                    <tr key={col} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '5px 8px', color: 'var(--text-primary)', fontWeight: 700 }}>{col}</td>
                      <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{alt}</td>
                      <td style={{ padding: '5px 8px', color: req === 'Sí' ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>{req}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              * Si no hay <b>codigo</b>, se genera uno automático. Al re-importar, el código se usa para actualizar el producto existente.
            </p>
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              Los precios pueden incluir <b>$</b> y usar <b>coma</b> como decimal (ej: <code>1.500,50</code> o <code>1500.50</code>).
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={downloadCsvTemplate}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}>
                ⬇ Descargar plantilla
              </button>
              <button onClick={() => { setShowCsvHelp(false); fileInputRef.current?.click(); }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#0B132B', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem' }}>
                Subir archivo CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Resultado de importación */}
      {importResult && importResult.errors?.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setImportResult(null); }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800 }}>
                Resultado de importación
              </h3>
              <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>
            {importResult.imported > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(20,187,166,0.08)', border: '1px solid var(--accent-primary)', borderRadius: 8, marginBottom: 14, fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                ✅ {importResult.imported} producto{importResult.imported !== 1 ? 's' : ''} importado{importResult.imported !== 1 ? 's' : ''}
                {importResult.categories_created?.length > 0 && ` · ${importResult.categories_created.length} categoría${importResult.categories_created.length !== 1 ? 's' : ''} nueva${importResult.categories_created.length !== 1 ? 's' : ''}`}
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-danger)', marginBottom: 8 }}>
                  ⚠️ {importResult.errors.length} fila{importResult.errors.length !== 1 ? 's' : ''} con error:
                </div>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 12px', maxHeight: 220, overflowY: 'auto' }}>
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '3px 0', borderBottom: i < importResult.errors.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      {err}
                    </div>
                  ))}
                  {importResult.errors.length > 20 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '6px 0', fontStyle: 'italic' }}>
                      … y {importResult.errors.length - 20} más
                    </div>
                  )}
                </div>
                <p style={{ margin: '12px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tocá el botón <b>?</b> junto a "Importar CSV" para ver el formato correcto o descargar una plantilla.
                </p>
              </>
            )}
            <button onClick={() => setImportResult(null)}
              style={{ marginTop: 16, width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#0B132B', fontWeight: 800, cursor: 'pointer' }}>
              Entendido
            </button>
          </div>
        </div>
      )}
      {promptState.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', width: '320px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>{promptState.title}</h3>
            {promptState.hint && <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>{promptState.hint}</p>}
            <input 
              type={promptState.text ? 'text' : 'number'} 
              step={promptState.text ? undefined : 'any'} 
              value={promptState.value} 
              onChange={e => setPromptState({...promptState, value: e.target.value})} 
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') promptState.onConfirm(e.target.value);
                if (e.key === 'Escape') setPromptState({...promptState, isOpen: false});
              }}
              style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', marginBottom: '24px', outline: 'none', boxSizing: 'border-box', fontSize: '1.2rem', fontWeight: 800, textAlign: promptState.text ? 'left' : 'center' }} 
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPromptState({...promptState, isOpen: false})} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => promptState.onConfirm(promptState.value)} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestión de variantes */}
      {variantParent && (
        <div onClick={() => setVariantParent(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, width: '100%', maxWidth: 460, padding: 24, boxShadow: 'var(--shadow-lg)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>Variantes — {variantParent.name}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Ej: 25 kg, 50 kg, Rojo, Grande</p>
              </div>
              <button onClick={() => setVariantParent(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              {variantLoading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cargando...</p>}
              {!variantLoading && variantList.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Sin variantes todavía. Agregá la primera abajo.</p>}
              {variantList.map(v => (
                editingVariantId === v.id ? (
                  <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'rgba(20,187,166,0.05)', border: '1px solid rgba(20,187,166,0.25)', borderRadius: 8, marginBottom: 6 }}>
                    <input placeholder="Etiqueta" value={editVariantLabel} onChange={e => setEditVariantLabel(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" placeholder="Precio" value={editVariantPrice} onChange={e => setEditVariantPrice(e.target.value)}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', textAlign: 'right' }} />
                      <input type="number" placeholder="Stock" value={editVariantStock} onChange={e => setEditVariantStock(e.target.value)}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', textAlign: 'right' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleUpdateVariant(v)} style={{ flex: 1, padding: '6px', background: 'var(--accent-primary)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>Guardar</button>
                      <button onClick={cancelEditVariant} style={{ flex: 1, padding: '6px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', flex: 1 }}>{v.variant_label}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>${(v.price || 0).toLocaleString('es-AR')}</span>
                      <span>Stock: {v.stock ?? 0}</span>
                      <button onClick={() => startEditVariant(v)} title="Editar" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', padding: 2 }}>???</button>
                      <button onClick={() => handleDeleteVariant(v)} title="Eliminar" style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.9rem', padding: 2 }}>????</button>
                    </div>
                  </div>
                )
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Agregar variante</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: 8, marginBottom: 10 }}>
                <input placeholder="Etiqueta (ej: 25 kg)" value={newVariantLabel} onChange={e => setNewVariantLabel(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }} />
                <input type="number" placeholder="Precio" value={newVariantPrice} onChange={e => setNewVariantPrice(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', textAlign: 'right' }} />
                <input type="number" placeholder="Stock" value={newVariantStock} onChange={e => setNewVariantStock(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', textAlign: 'right' }} />
              </div>
              <button onClick={handleAddVariant} disabled={variantSaving}
                style={{ width: '100%', padding: '10px', background: 'var(--accent-primary)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}>
                {variantSaving ? 'Guardando...' : '+ Agregar variante'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

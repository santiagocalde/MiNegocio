import { useState, useEffect, useRef } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import { SkeletonCard } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import FeatureGate from '../components/ui/FeatureGate';

const PLAN_WEIGHT = { trial: 0, simple: 1, pro: 2, ia: 3 };

// Reusing some SVG icons inline to keep it self-contained or assuming they exist
const Icons = {
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
  X: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>,
  Filter: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>,
  Box: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
  Camera: () => <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  Sparkles: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
};

function AIScannerModal({ onClose, onScanSuccess }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const fileRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScanError('');
    try {
      const { SERVER_URL } = await import('../services/apiClient');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${SERVER_URL.replace('/api', '')}/api/ai/scan-invoice`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al analizar la factura');
      }
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const mapped = data.items.map(item => ({
          product_id: item.product_id || 0,
          product_name: item.product_name || item.name || 'Producto detectado',
          quantity: item.quantity || 1,
          unit_cost: item.unit_cost || item.cost || 0,
        }));
        onScanSuccess(mapped);
      } else {
        setScanError('No se detectaron productos en la imagen. Intenta con otra foto.');
      }
    } catch (err) {
      setScanError(err.message || 'Error al conectar con el servidor');
    }
    setIsScanning(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11, 19, 43, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
       <div style={{ background: 'var(--bg-main)', border: '1px solid rgba(20, 187, 166, 0.3)', borderRadius: '24px', width: '600px', maxWidth: '90vw', padding: '40px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.X /></button>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ background: 'rgba(20, 187, 166, 0.15)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icons.Sparkles /> PRO FEATURE
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Créditos mensuales: <span style={{ color: 'var(--text-primary)' }}>45/50</span></span>
          </div>
          
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Carga de Facturas con IA</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px 0', fontSize: '0.95rem' }}>Fotografiá el remito o factura del proveedor. La IA detectará automáticamente los productos, cantidades y costos. El stock se actualizará solo.</p>

          <div 
             onClick={() => !isScanning && fileRef.current?.click()}
             style={{ border: `2px dashed ${isScanning ? '#10B981' : scanError ? '#ef4444' : 'rgba(20, 187, 166, 0.5)'}`, borderRadius: '16px', padding: '48px 24px', textAlign: 'center', background: isScanning ? 'rgba(16, 185, 129, 0.05)' : scanError ? 'rgba(239,68,68,0.05)' : 'rgba(20, 187, 166, 0.05)', cursor: isScanning ? 'default' : 'pointer', transition: 'all 0.3s', marginBottom: '32px' }}
          >
             <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
             {isScanning ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', border: '4px solid rgba(16, 185, 129, 0.3)', borderTopColor: '#10B981', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#10B981' }}>Analizando documento...</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>Extrayendo productos y costos via IA</div>
                </div>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ color: scanError ? 'var(--accent-danger)' : 'var(--accent-primary)', marginBottom: '16px' }}><Icons.Camera /></div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>{scanError ? 'Error al analizar' : 'Hace clic para subir una foto de la factura'}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{scanError || 'Soporta JPG o PNG (Max 5MB)'}</div>
                </div>
             )}
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
             <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Para mejores resultados:</h4>
             <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#10B981' }}>✓</span> Buena iluminación, sin sombras oscuras.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#10B981' }}>✓</span> Todos los márgenes de la hoja visibles.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#10B981' }}>✓</span> Texto legible, sin desenfoque ni movimiento.</li>
             </ul>
          </div>
          <style>{'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'}</style>
       </div>
    </div>
  );
}

function formatPesos(n) {
  return '$ ' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchasesModule() {
  const { backend, addToast, auth, currentSucursalId } = usePanelContext();
  const globalProductsDB = backend.productsDB;
  const onProductsUpdated = backend.fetchProductsDB;
  const currentTurnId = auth.currentTurnId;
  const [activeTab, setActiveTab] = useState('history'); // history | new_invoice
  const [showAIScanner, setShowAIScanner] = useState(false);
  const currentPlan = backend.businessConfig?.plan || 'trial';
  const isLocked = PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT['simple'];
  
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailPurchase, setDetailPurchase] = useState(null);

  // New Invoice State
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paidFromRegister, setPaidFromRegister] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    fetchSuppliers();
    if (activeTab === 'history') fetchPurchases();
  }, [activeTab]);

  const fetchSuppliers = async () => {
    if (isLocked) {
      setSuppliers([{ id: 1, name: 'Distribuidora Arcor' }, { id: 2, name: 'Coca-Cola FEMSA' }]);
      return;
    }
    try {
      const res = await apiGet('/suppliers');
      if (res.ok) setSuppliers(await res.json());
    } catch (e) { console.error(e) }
  };

  const fetchPurchases = async () => {
    if (isLocked) {
      setPurchases([
        { id: 1, supplier_name: 'Distribuidora Arcor', invoice_number: '0001-00045231', total_cost: 45000, created_at: new Date().toISOString() },
        { id: 2, supplier_name: 'Coca-Cola FEMSA', invoice_number: '0002-00011223', total_cost: 85200, created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, supplier_name: 'Mayorista Makro', invoice_number: '0005-00088991', total_cost: 125000, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
      ]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGet('/purchases?limit=50');
      if (res.ok) setPurchases(await res.json());
    } catch (e) { console.error(e) }
    setLoading(false);
  };

  const addToCart = (product) => {
    const existing = cart.find(i => i.product_id === product.id);
    if (existing) {
      setCart(cart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([{ product_id: product.id, product_name: product.name, quantity: 1, unit_cost: product.cost_price || 0 }, ...cart]);
    }
  };

  const handleProductSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await apiGet(`/products?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const results = await res.json();
        if (results.length > 0) {
          addToCart(results[0]);
          setSearchQuery('');
          setShowQuickAdd(false);
          searchInputRef.current?.focus();
        } else {
          setShowQuickAdd(true);
        }
      }
    } catch (e) { console.error(e) }
  };

  const quickAddCounter = useRef(Date.now());
  const handleQuickAddNew = () => {
    const name = searchQuery.trim();
    if (!name) return;
    quickAddCounter.current += 1;
    setCart([{ product_id: quickAddCounter.current, product_name: name, quantity: 1, unit_cost: 0 }, ...cart]);
    setSearchQuery('');
    setShowQuickAdd(false);
    searchInputRef.current?.focus();
    if (addToast) addToast('Producto nuevo agregado — asigná costo y cantidad');
  };

  const handleCartItemUpdate = (productId, field, value) => {
    setCart(cart.map(item => item.product_id === productId ? { ...item, [field]: value } : item));
  };

  const handleRemoveItem = (productId) => setCart(cart.filter(i => i.product_id !== productId));
  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

  const filteredPurchases = purchases.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (p.supplier_name && p.supplier_name.toLowerCase().includes(term)) || (p.invoice_number && p.invoice_number.toLowerCase().includes(term));
  });

  const handleConfirmPurchase = async () => {
    if (cart.length === 0) return addToast?.("Debe agregar productos a la factura.", "error");
    if (!selectedSupplier || isNaN(parseInt(selectedSupplier))) return addToast?.("Debe seleccionar un proveedor válido.", "error");

    try {
      const payload = {
        supplier_id: parseInt(selectedSupplier),
        invoice_number: invoiceNumber,
        total_cost: cartTotal,
        operator: "Admin",
        turn_id: currentTurnId,
        paid_from_register: paidFromRegister,
        items: cart.map(i => ({ product_id: i.product_id > 0 ? i.product_id : 0, product_name: i.product_name, quantity: parseInt(i.quantity) || 1, unit_cost: parseFloat(i.unit_cost) || 0 }))
      };
      const res = await apiPost('/purchases', payload);
      if (res.ok) {
        addToast?.("Compra registrada correctamente. Stock actualizado.");
        setCart([]); setInvoiceNumber(''); setSelectedSupplier(''); setPaidFromRegister(false);
        onProductsUpdated?.();
        setActiveTab('history');
      } else {
        addToast?.("No se pudo registrar la compra.", "error");
      }
    } catch {
      addToast?.("Error de conexión.", "error");
    }
  };

  const onAIScanSuccess = (items) => {
    setShowAIScanner(false);
    setCart(items);
    setActiveTab('new_invoice');
    addToast?.("Factura procesada con éxito por la IA.");
  };

  return (
    <FeatureGate isLocked={isLocked} requiredPlan="Simple">
      <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* HEADER COMPARTIDO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gestión de Compras</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>Registro de facturas, ingresos de stock y control de gastos.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeTab === 'history' ? (
            <>
              <button onClick={() => setActiveTab('new_invoice')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', height: '46px', transition: 'all 0.2s' }}>
                + Carga Manual
              </button>
              <button onClick={() => setShowAIScanner(true)} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', height: '46px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(20, 187, 166, 0.3)' }}>
                <Icons.Sparkles /> Escanear Factura
              </button>
            </>
          ) : (
            <button onClick={() => setActiveTab('history')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', height: '46px' }}>
              Volver al Historial
            </button>
          )}
        </div>
      </div>

      {activeTab === 'history' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>


          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
                  <input type="text" placeholder="Buscar factura..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px 10px 40px', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', width: '250px' }} />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                ) : filteredPurchases.length === 0 ? (
                  <div style={{ padding: '40px 0' }}>
                    <EmptyState icon="Truck" title={searchTerm.trim() ? 'Sin resultados' : 'Sin compras'}
                      description={searchTerm.trim() ? 'No hay compras que coincidan con la búsqueda.' : 'Todavía no registraste ninguna compra. Cargá tu primera factura manualmente o escaneala con IA.'}
                      actionLabel="+ Carga Manual" actionOnClick={() => setActiveTab('new_invoice')} />
                  </div>
                ) : (
                    filteredPurchases.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.transform='translateX(4px)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                          <div style={{ width: '48px', height: '48px', background: 'rgba(20,187,166, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                            <Icons.Box />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '4px' }}>{p.supplier_name || 'Proveedor General'}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', gap: '12px' }}>
                              <span>{new Date(p.created_at).toLocaleDateString('es-AR')}</span>
                              <span>•</span>
                              <span>Factura: {p.invoice_number || 'S/N'}</span>
                            </div>
                          </div>
                          <div style={{ width: '150px' }}>
                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                              Completado
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                            {formatPesos(p.total_cost)}
                          </div>
                          <button onClick={() => setDetailPurchase(p)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }} title="Ver Detalle">
                            <Icons.Search />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
              </div>
            </div>
          </div>
      )}

      {activeTab === 'new_invoice' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
          
          {/* Metadata Factura */}
          <div style={{ display: 'flex', gap: '24px', background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>PROVEEDOR</label>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', outline: 'none', fontSize: '0.9rem' }}>
                <option value="">Selecciona un proveedor de la lista...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>N° DE FACTURA / REMITO</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ej: 0001-00002451" style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', outline: 'none', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>

          {/* Buscador & Tabla */}
          <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <form onSubmit={handleProductSearch} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
                  <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Escanear código de barras o buscar producto para agregar a la factura..." style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px 12px 42px', borderRadius: '8px', outline: 'none', fontSize: '0.95rem' }} />
                  
                  {(searchQuery.trim().length > 0 && globalProductsDB) || showQuickAdd ? (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '8px', boxShadow: '0 4px 12px rgba(30,58,95,0.5)' }}>
                      {!showQuickAdd && globalProductsDB && globalProductsDB.filter(p => String(p.code || '').toUpperCase().startsWith(searchQuery.toUpperCase()) || p.name.toLowerCase().startsWith(searchQuery.toLowerCase())).slice(0, 5).map((p) => (
                        <button key={p.id} type="button" onClick={() => { setSearchQuery(p.code); setTimeout(() => handleProductSearch(), 50); }} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }} onFocus={e => e.target.style.background = 'var(--bg-hover)'} onBlur={e => e.target.style.background = 'transparent'} onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                          <span style={{ fontWeight: 600 }}>{p.name}</span><span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.code}</span>
                        </button>
                      ))}
                      {showQuickAdd && (
                        <div style={{ padding: '16px' }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>No se encontró "{searchQuery}". ¿Crear nuevo producto?</div>
                          <button type="button" onClick={handleQuickAddNew} style={{ width: '100%', padding: '12px', background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                            Agregar "{searchQuery}"
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <button type="submit" style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 24px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
              </form>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
                  <tr style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '16px 24px' }}>Producto</th>
                    <th style={{ padding: '16px 24px', textAlign: 'center', width: '120px' }}>Costo Unit.</th>
                    <th style={{ padding: '16px 24px', textAlign: 'center', width: '120px' }}>Cantidad</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', width: '150px' }}>Subtotal</th>
                    <th style={{ padding: '16px 24px', textAlign: 'center', width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.product_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.9rem' }}>{item.product_name}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                         <input type="number" step="0.01" min="0" value={item.unit_cost} onChange={e => handleCartItemUpdate(item.product_id, 'unit_cost', e.target.value)} style={{ width: '80px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                         <input type="number" min="1" value={item.quantity} onChange={e => handleCartItemUpdate(item.product_id, 'quantity', e.target.value)} style={{ width: '60px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                         ${(item.quantity * item.unit_cost).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                         <button onClick={() => handleRemoveItem(item.product_id)} style={{ background: 'transparent', color: 'var(--accent-danger)', border: 'none', cursor: 'pointer', padding: '4px' }}><Icons.X /></button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>Aún no hay productos. Buscá arriba o escaneá la factura con IA.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {cart.length > 0 && (
              <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Total Factura (Costo)</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {formatPesos(cartTotal)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                  {currentTurnId && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
                      <input 
                        type="checkbox" 
                        checked={paidFromRegister} 
                        onChange={e => setPaidFromRegister(e.target.checked)} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      Restar de caja registradora (Generar Egreso)
                    </label>
                  )}
                  <button onClick={handleConfirmPurchase} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '16px 32px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Registrar Compra y Actualizar Stock
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAIScanner && (
        <AIScannerModal 
          onClose={() => setShowAIScanner(false)} 
          onScanSuccess={onAIScanSuccess} 
        />
      )}

      {detailPurchase && (() => {
        const items = detailPurchase.items || [];
        const total = items.reduce((acc, i) => acc + (i.unit_cost || 0) * (i.quantity || 0), 0);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDetailPurchase(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '550px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 20px 0', color: 'var(--text-primary)' }}>Detalle de Compra</h2>
              <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Proveedor</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{detailPurchase.supplier_name || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Fecha</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(detailPurchase.created_at).toLocaleString('es-AR', { dateStyle: 'medium' })}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Items</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{items.length}</div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Producto</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Cantidad</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Costo Unit.</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Subtotal</th>
                </tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{it.product_name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{it.quantity}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>${(it.unit_cost || 0).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${((it.unit_cost || 0) * (it.quantity || 0)).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>${total.toLocaleString('es-AR')}</span>
              </div>
              <button onClick={() => setDetailPurchase(null)} style={{ width: '100%', marginTop: 20, padding: '12px', borderRadius: 8, border: 'none', background: 'var(--gradient-primary)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
            </div>
          </div>
        );
      })()}
      </div>
    </FeatureGate>
  );
}

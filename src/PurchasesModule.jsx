import React, { useState, useEffect, useRef } from 'react';

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

  const simulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onScanSuccess([
        { product_id: 1, product_name: "Coca Cola 2.25Lts", quantity: 12, unit_cost: 1500 },
        { product_id: 2, product_name: "Lays Clásicas 150g", quantity: 5, unit_cost: 800 }
      ]);
    }, 2500);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
       <div style={{ background: 'var(--bg-main)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '24px', width: '600px', maxWidth: '90vw', padding: '40px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.X /></button>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', padding: '6px 12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icons.Sparkles /> PRO FEATURE
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Créditos mensuales: <span style={{ color: 'var(--text-primary)' }}>45/50</span></span>
          </div>
          
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Carga de Facturas con IA</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px 0', fontSize: '0.95rem' }}>Fotografiá el remito o factura del proveedor. La IA detectará automáticamente los productos, cantidades y costos. El stock se actualizará solo.</p>

          <div 
             onClick={!isScanning ? simulateScan : undefined}
             style={{ border: `2px dashed ${isScanning ? '#10B981' : 'rgba(139, 92, 246, 0.5)'}`, borderRadius: '16px', padding: '48px 24px', textAlign: 'center', background: isScanning ? 'rgba(16, 185, 129, 0.05)' : 'rgba(139, 92, 246, 0.05)', cursor: isScanning ? 'default' : 'pointer', transition: 'all 0.3s', marginBottom: '32px' }}
          >
             {isScanning ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', border: '4px solid rgba(16, 185, 129, 0.3)', borderTopColor: '#10B981', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#10B981' }}>Analizando documento...</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>Extrayendo productos y costos vía Gemini Vision</div>
                </div>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ color: '#a78bfa', marginBottom: '16px' }}><Icons.Camera /></div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Hacé clic para simular subida</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Soporta JPG, PNG o PDF (Máx 5MB)</div>
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
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
       </div>
    </div>
  );
}

function formatPesos(n) {
  return '$ ' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchasesModule({ serverUrl, onProductsUpdated, addToast, products: globalProductsDB }) {
  const [activeTab, setActiveTab] = useState('history'); // history | new_invoice
  const [showAIScanner, setShowAIScanner] = useState(false);
  
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // New Invoice State
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    fetchSuppliers();
    if (activeTab === 'history') fetchPurchases();
  }, [activeTab]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${serverUrl}/suppliers`);
      if (res.ok) setSuppliers(await res.json());
    } catch {}
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/purchases?limit=50`);
      if (res.ok) setPurchases(await res.json());
    } catch {}
    setLoading(false);
  };

  const handleProductSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`${serverUrl}/products?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const results = await res.json();
        if (results.length > 0) {
          const product = results[0];
          const existing = cart.find(i => i.product_id === product.id);
          if (existing) {
            setCart(cart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
          } else {
            setCart([{ product_id: product.id, product_name: product.name, quantity: 1, unit_cost: product.cost_price || 0 }, ...cart]);
          }
          setSearchQuery('');
          searchInputRef.current?.focus();
        } else {
          if (addToast) addToast('Producto no encontrado', 'error');
        }
      }
    } catch {}
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
    if (!selectedSupplier) return addToast?.("Debe seleccionar un proveedor.", "error");

    try {
      const payload = {
        supplier_id: parseInt(selectedSupplier),
        invoice_number: invoiceNumber,
        total_cost: cartTotal,
        operator: "Admin",
        items: cart.map(i => ({ product_id: i.product_id, product_name: i.product_name, quantity: parseInt(i.quantity) || 1, unit_cost: parseFloat(i.unit_cost) || 0 }))
      };
      const res = await fetch(`${serverUrl}/purchases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        addToast?.("Compra registrada correctamente. Stock actualizado.");
        setCart([]); setInvoiceNumber(''); setSelectedSupplier('');
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
              <button onClick={() => setShowAIScanner(true)} style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', height: '46px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}>
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
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', flexShrink: 0, background: 'var(--bg-card)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: '16px 0', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', borderBottom: '2px solid var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Historial de Compras
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Registros Previos</h2>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0 }}>Todas las compras ingresadas al sistema.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.05)'} onMouseLeave={e => e.target.style.background='var(--bg-card)'}>... Acciones</button>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
                  <input type="text" placeholder="Buscar factura..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px 10px 40px', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', width: '250px' }} />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
                  {filteredPurchases.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay compras registradas.</div>
                  ) : (
                    filteredPurchases.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.transform='translateX(4px)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                          <div style={{ width: '48px', height: '48px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
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
                          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }} title="Ver Detalle">
                            <Icons.Search />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
              </div>
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
                  
                  {searchQuery.trim().length > 0 && globalProductsDB && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                      {globalProductsDB.filter(p => p.code.startsWith(searchQuery) || p.name.toLowerCase().startsWith(searchQuery.toLowerCase())).slice(0, 5).map((p) => (
                        <button key={p.id} type="button" onClick={() => { setSearchQuery(p.code); setTimeout(() => handleProductSearch(), 50); }} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }} onFocus={e => e.target.style.background = 'var(--bg-hover)'} onBlur={e => e.target.style.background = 'transparent'} onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                          <span style={{ fontWeight: 600 }}>{p.name}</span><span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
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
                         <input type="number" min="1" value={item.quantity} onChange={e => handleCartItemUpdate(item.product_id, 'quantity', e.target.value)} style={{ width: '60px', background: 'var(--bg-main)', border: '1px solid var(--text-primary)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, outline: 'none' }} />
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
                <button onClick={handleConfirmPurchase} style={{ background: 'var(--text-primary)', color: 'var(--bg-main)', border: 'none', borderRadius: '8px', padding: '16px 32px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Registrar Compra y Actualizar Stock
                </button>
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
    </div>
  );
}

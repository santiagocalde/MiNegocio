import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './App';

function NewSupplierModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({ name: '', contact: '', cuit: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const inputStyle = { width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', fontSize: '1rem', outline: 'none', marginBottom: '16px' };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#10B981' }}>🏢 Nuevo Proveedor</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre de la Empresa / Vendedor</label>
          <input required autoFocus type="text" style={inputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Arcor, Coca Cola..." />
          
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Contacto (Tel / Email)</label>
          <input type="text" style={inputStyle} value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
          
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>CUIT</label>
          <input type="text" style={inputStyle} value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} />
          
          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-modal-confirm" style={{ background: '#10B981', color: 'white' }} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchasesModule({ serverUrl, onProductsUpdated, addToast, products: globalProductsDB }) {
  const [activeTab, setActiveTab] = useState('new_invoice'); // new_invoice | history
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);

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
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/purchases`);
      if (res.ok) setPurchases(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async (data) => {
    try {
      const res = await fetch(`${serverUrl}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const newSup = await res.json();
        setSuppliers([...suppliers, newSup]);
        setSelectedSupplier(newSup.id.toString());
        setShowNewSupplierModal(false);
        if (addToast) addToast("Proveedor creado exitosamente.");
      } else {
        if (addToast) addToast("No se pudo crear el proveedor. ¿Ya existe uno con ese nombre?", "error");
      }
    } catch (e) {
      console.error(e);
      if (addToast) addToast("Error al crear proveedor", "error");
    }
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
          
          // Check if already in cart
          const existing = cart.find(i => i.product_id === product.id);
          if (existing) {
            setCart(cart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
          } else {
            setCart([{
              product_id: product.id,
              product_name: product.name,
              quantity: 1,
              unit_cost: product.cost_price || 0
            }, ...cart]);
          }
          setSearchQuery('');
          searchInputRef.current?.focus();
        } else {
          if (addToast) addToast('Producto no encontrado', 'error');
        }
      }
    } catch (e) {
      console.error("Error buscando producto:", e);
    }
  };

  const handleCartItemUpdate = (productId, field, value) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (productId) => {
    setCart(cart.filter(i => i.product_id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

  const filteredPurchases = purchases.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (p.supplier_name && p.supplier_name.toLowerCase().includes(term)) ||
           (p.invoice_number && p.invoice_number.toLowerCase().includes(term));
  });

  const handleConfirmPurchase = async () => {
    if (cart.length === 0) return addToast ? addToast("Debe agregar productos a la factura.", "error") : null;
    if (!selectedSupplier) return addToast ? addToast("Debe seleccionar un proveedor.", "error") : null;

    try {
      const payload = {
        supplier_id: parseInt(selectedSupplier),
        invoice_number: invoiceNumber,
        total_cost: cartTotal,
        operator: "Don Julio",
        items: cart.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: parseInt(i.quantity) || 1,
          unit_cost: parseFloat(i.unit_cost) || 0
        }))
      };

      const res = await fetch(`${serverUrl}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (addToast) addToast("Compra registrada correctamente y stock actualizado.");
        setCart([]);
        setInvoiceNumber('');
        setSelectedSupplier('');
        onProductsUpdated?.();
        setActiveTab('history');
      } else {
        if (addToast) addToast("No se pudo registrar la compra. Intentá de nuevo.", "error");
      }
    } catch (e) {
      console.error(e);
      if (addToast) addToast("No se pudo registrar la compra. Verificá la conexión con el servidor.", "error");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      
      {/* Header Tabs */}
      <div style={{ padding: '24px 32px 0 32px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          🚚 Compras y Proveedores
        </h1>
        <div style={{ display: 'flex', gap: '32px' }}>
          <div 
            onClick={() => setActiveTab('new_invoice')}
            style={{ paddingBottom: '16px', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', color: activeTab === 'new_invoice' ? '#10B981' : 'var(--text-secondary)', borderBottom: activeTab === 'new_invoice' ? '3px solid #10B981' : '3px solid transparent' }}
          >
            Ingresar Factura
          </div>
          <div 
            onClick={() => setActiveTab('history')}
            style={{ paddingBottom: '16px', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', color: activeTab === 'history' ? '#10B981' : 'var(--text-secondary)', borderBottom: activeTab === 'history' ? '3px solid #10B981' : '3px solid transparent' }}
          >
            Historial de Compras
          </div>
        </div>
      </div>

      {activeTab === 'new_invoice' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', gap: '16px', padding: '24px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Proveedor</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  value={selectedSupplier} 
                  onChange={e => setSelectedSupplier(e.target.value)}
                  style={{ flex: 1, background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', outline: 'none' }}
                >
                  <option value="">-- Seleccionar Proveedor --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => setShowNewSupplierModal(true)} style={{ background: '#10B981', border: 'none', color: 'white', padding: '0 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  + Nuevo
                </button>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Número de Factura / Remito (Opcional)</label>
              <input 
                type="text" 
                value={invoiceNumber} 
                onChange={e => setInvoiceNumber(e.target.value)} 
                placeholder="Ej: 0001-0004562"
                style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ padding: '24px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <form onSubmit={handleProductSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px', position: 'relative' }}>
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Escaneá el código de barras o buscá el producto recibido..."
                style={{ flex: 1, background: 'var(--bg-main)', border: '2px solid #10B981', color: 'var(--text-primary)', padding: '16px', borderRadius: '12px', fontSize: '1.25rem', outline: 'none' }}
              />
              {searchQuery.trim().length > 0 && globalProductsDB && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: '140px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  {globalProductsDB.filter(p => p.code.startsWith(searchQuery) || p.name.toLowerCase().startsWith(searchQuery.toLowerCase())).slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { 
                        setSearchQuery(p.code); // better to search by exact code for adding to cart
                        setTimeout(() => handleProductSearch(), 50); 
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                      onFocus={e => e.target.style.background = 'var(--bg-hover)'}
                      onBlur={e => e.target.style.background = 'transparent'}
                      onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.target.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="submit" style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: '12px', padding: '0 32px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' }}>
                Agregar
              </button>
            </form>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 0', fontSize: '1.1rem' }}>
                  Aún no hay productos en la factura.<br/>Escaneá para empezar a registrar el ingreso de mercadería.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cart.map(item => (
                    <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-main)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{item.product_name}</div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Costo Unitario ($)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={item.unit_cost} 
                            onChange={e => handleCartItemUpdate(item.product_id, 'unit_cost', e.target.value)}
                            style={{ width: '100px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cantidad</label>
                          <input 
                            type="number" 
                            min="1"
                            value={item.quantity} 
                            onChange={e => handleCartItemUpdate(item.product_id, 'quantity', e.target.value)}
                            style={{ width: '80px', background: 'var(--bg-card)', border: '1px solid #10B981', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                          />
                        </div>

                        <div style={{ minWidth: '120px', textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>
                          ${(item.quantity * item.unit_cost).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                        </div>

                        <button 
                          onClick={() => handleRemoveItem(item.product_id)}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: 'none', width: '36px', height: '36px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Icons.X />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Factura (Costo)</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10B981' }}>
                    ${cartTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                  </div>
                </div>
                
                <button 
                  onClick={handleConfirmPurchase}
                  style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: '12px', padding: '0 48px', height: '64px', fontSize: '1.25rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                >
                  Registrar Ingreso de Stock
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px' }}>Cargando historial...</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Buscar por proveedor o factura..."
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-main)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '1rem', outline: 'none' }}
                  />
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                  {filteredPurchases.length} resultado{filteredPurchases.length !== 1 ? 's' : ''}
                </span>
              </div>
              {filteredPurchases.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px' }}>No se encontraron compras con ese filtro.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '16px', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '16px', textAlign: 'left' }}>Proveedor</th>
                      <th style={{ padding: '16px', textAlign: 'left' }}>N° Factura</th>
                      <th style={{ padding: '16px', textAlign: 'right' }}>Total Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px' }}>{new Date(p.timestamp).toLocaleString('es-AR')}</td>
                        <td style={{ padding: '16px', fontWeight: 600 }}>{p.supplier_name || 'Sin Proveedor'}</td>
                        <td style={{ padding: '16px' }}>{p.invoice_number || '-'}</td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10B981' }}>
                          ${p.total_cost.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {showNewSupplierModal && (
        <NewSupplierModal 
          onClose={() => setShowNewSupplierModal(false)}
          onSave={handleCreateSupplier}
        />
      )}
    </div>
  );
}

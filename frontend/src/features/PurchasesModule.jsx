import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import FeatureGate from '../components/ui/FeatureGate';
import { Icons } from './purchases/shared';
import AIScannerModal from './purchases/AIScannerModal';
import PurchaseDetailModal from './purchases/PurchaseDetailModal';
import PurchasesHistory from './purchases/PurchasesHistory';
import NewInvoiceForm from './purchases/NewInvoiceForm';
import PedidoProveedorTab from './purchases/PedidoProveedorTab';
import useModalExit, { overlayAnim, contentAnim } from '../hooks/useModalExit';

const PLAN_WEIGHT = { trial: 1, simple: 1, pro: 2, ia: 3 };

export default function PurchasesModule() {
  const location = useLocation();
  const { backend, addToast, auth, currentPlan, businessType } = usePanelContext();
  const globalProductsDB = backend.productsDB;
  const onProductsUpdated = backend.fetchProductsDB;
  const currentTurnId = auth.currentTurnId;
  const [activeTab, setActiveTab] = useState('history'); // history | pending | pedido | new_invoice
  // F6: pedidos pendientes
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // {purchase, editItems}
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [showAIScanner, setShowAIScanner] = useState(false);
  const isLocked = PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT['simple'];
  const canUseIA = currentPlan === 'ia';

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

  const fetchPendingPurchases = async () => {
    setLoadingPending(true);
    try {
      const res = await apiGet('/purchases?limit=100');
      if (res.ok) {
        const all = await res.json();
        setPendingPurchases(all.filter(p => p.status === 'pending'));
      }
    } catch (e) { console.error(e) }
    setLoadingPending(false);
  };

  const handleConfirmPending = async () => {
    if (!confirmModal) return;
    setConfirmSaving(true);
    try {
      const res = await apiPost(`/purchases/${confirmModal.purchase.id}/confirm`, {
        operator: 'Admin',
        items: confirmModal.editItems.map(it => ({
          product_id: it.product_id,
          quantity: parseFloat(it.quantity) || 0,
          unit_cost: parseFloat(it.unit_cost) || 0,
        })),
      });
      if (res.ok) {
        addToast?.('Mercadería confirmada. Stock y costos actualizados.', 'success');
        setConfirmModal(null);
        fetchPendingPurchases();
        if (onProductsUpdated) onProductsUpdated();
      } else {
        const data = await res.json().catch(() => ({}));
        addToast?.(data.detail || 'Error al confirmar.', 'error');
      }
    } catch { addToast?.('Error de conexión.', 'error'); }
    setConfirmSaving(false);
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

  // Si se navega desde ProveedoresModule con ?supplier_id=X, filtrar historial por ese proveedor.
  const supplierIdFromUrl = new URLSearchParams(location.search).get('supplier_id');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSuppliers();
    if (activeTab === 'history') fetchPurchases();
    if (activeTab === 'pending') fetchPendingPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Cuando se cargaron los proveedores y hay un supplier_id en la URL,
  // pre-filtrar el historial por ese proveedor.
  useEffect(() => {
    if (!supplierIdFromUrl || suppliers.length === 0) return;
    const found = suppliers.find(s => String(s.id) === String(supplierIdFromUrl));
    if (found) setSearchTerm(found.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers, supplierIdFromUrl]);

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

  const quickAddCounter = useRef(0);
  const handleQuickAddNew = () => {
    const name = searchQuery.trim();
    if (!name) return;
    // id negativo: unico en el carrito y el backend lo trata como producto nuevo
    // (product_id 0), sin pisar el stock de un producto real con ese id.
    // Si ya hay una linea nueva con el mismo nombre, sumamos cantidad en vez
    // de duplicar la linea (id negativo: unico en el carrito; el backend lo
    // crea como producto real al confirmar la compra).
    const existingIdx = cart.findIndex(i => i.is_new && String(i.product_name || '').toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
      setCart(cart.map((i, idx) => idx === existingIdx ? { ...i, quantity: (parseInt(i.quantity) || 1) + 1 } : i));
    } else {
      quickAddCounter.current -= 1;
      setCart([{ product_id: quickAddCounter.current, product_name: name, quantity: 1, unit_cost: 0, is_new: true }, ...cart]);
    }
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
    if (p.status === 'pending') return false; // los pendientes van a la pestaña dedicada
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

  const confirmExit = useModalExit(!!confirmModal);
  const confirmDataRef = useRef(null);
  if (confirmModal) confirmDataRef.current = confirmModal;
  const confirmData = confirmModal || confirmDataRef.current;

  return (
    <FeatureGate isLocked={isLocked} requiredPlan="Simple">
      <div style={{ padding: '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* HEADER COMPARTIDO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', flexShrink: 0 }}>
        <div>
          <div className="ledger-label">Libro de compras</div>
          <h1 className="ledger-title" style={{ fontSize: '1.6rem', marginTop: 4 }}>Lo que entró</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Tab pills */}
          {(activeTab === 'history' || activeTab === 'pending' || activeTab === 'pedido') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Tabs de historial */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-veil)', borderRadius: 8, padding: 3 }}>
                {[['history', 'Facturas recibidas'], ...(businessType === 'corralon' ? [['pending', 'Por llegar']] : [])].map(([key, lbl]) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    style={{ padding: '7px 14px', borderRadius: 6, border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      background: activeTab === key ? 'var(--sheet)' : 'transparent',
                      color: activeTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none' }}>
                    {lbl}
                    {key === 'pending' && pendingPurchases.length > 0 && (
                      <span style={{ marginLeft: 5, background: 'var(--accent-primary)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem' }}>
                        {pendingPurchases.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* Separador + botón de acción distinto */}
              {businessType === 'corralon' && (
                <>
                  <div style={{ width: 1, height: 28, background: 'var(--border-color)' }} />
                  <button onClick={() => setActiveTab('pedido')}
                    style={{ padding: '7px 14px', borderRadius: 6, border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      background: activeTab === 'pedido' ? 'rgba(20,187,166,0.15)' : 'transparent',
                      color: activeTab === 'pedido' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                    📋 Pedir a proveedor
                  </button>
                </>
              )}
            </div>
          )}
          {(activeTab === 'history' || activeTab === 'pedido') && (
            <>
              <button onClick={() => setActiveTab('new_invoice')} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', height: '44px', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                + Carga manual
              </button>
              <button
                onClick={() => canUseIA ? setShowAIScanner(true) : addToast('Esta función requiere el Plan IA.', 'info')}
                style={{ background: canUseIA ? 'var(--accent-primary)' : 'var(--surface-veil)', border: canUseIA ? 'none' : '1px solid var(--border-color)', color: canUseIA ? 'var(--sheet)' : 'var(--text-secondary)', padding: '10px 18px', borderRadius: 'var(--radius-sm)', fontSize: '0.92rem', fontWeight: 800, cursor: canUseIA ? 'pointer' : 'not-allowed', height: '44px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'filter 0.15s' }}
                onMouseEnter={e => { if (canUseIA) e.currentTarget.style.filter = 'brightness(1.08)'; }}
                onMouseLeave={e => { if (canUseIA) e.currentTarget.style.filter = 'brightness(1)'; }}>
                {canUseIA ? <Icons.Sparkles /> : <Icons.Lock style={{width: 16, height: 16}} />} Escanear factura
              </button>
            </>
          )}
          {activeTab === 'new_invoice' && (
            <button onClick={() => setActiveTab('history')} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', height: '44px' }}>
              ← Volver al historial
            </button>
          )}
        </div>
      </div>

      {/* ── TAB: PEDIDOS PENDIENTES ── */}
      {activeTab === 'pending' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loadingPending ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>Cargando...</div>
          ) : pendingPurchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Sin pedidos pendientes</div>
              <div style={{ fontSize: '0.85rem' }}>Los pedidos guardados desde Proveedores aparecen acá hasta que llegue la mercadería.</div>
            </div>
          ) : (
            <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
              {pendingPurchases.map(p => (
                <div key={p.id} className="ledger-row" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {p.supplier_name || 'Sin proveedor'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginTop: 2 }}>
                      Pedido #{p.id} · {p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—'}
                      {p.items && ` · ${p.items.length} ítem${p.items.length !== 1 ? 's' : ''}`}
                    </div>
                    {p.items && p.items.length > 0 && (
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        {p.items.map(it => it.product_name).join(', ')}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: 'var(--accent-warning, #f59e0b)', background: 'rgba(245,158,11,0.1)', alignSelf: 'center', flexShrink: 0 }}>
                    Pendiente
                  </span>
                  <button
                    onClick={() => setConfirmModal({ purchase: p, editItems: (p.items || []).map(it => ({ ...it, quantity: it.quantity, unit_cost: it.unit_cost || 0 })) })}
                    style={{ padding: '8px 14px', background: 'var(--accent-primary)', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', alignSelf: 'center', flexShrink: 0 }}>
                    ✓ Confirmar entrada
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HACER PEDIDO A PROVEEDOR ── */}
      {activeTab === 'pedido' && (
        <PedidoProveedorTab addToast={addToast} />
      )}

      {activeTab === 'history' && (
        <PurchasesHistory
          loading={loading}
          purchases={filteredPurchases}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onNewInvoice={() => setActiveTab('new_invoice')}
          onViewDetail={setDetailPurchase}
        />
      )}

      {activeTab === 'new_invoice' && (
        <NewInvoiceForm
          suppliers={suppliers}
          selectedSupplier={selectedSupplier}
          setSelectedSupplier={setSelectedSupplier}
          invoiceNumber={invoiceNumber}
          setInvoiceNumber={setInvoiceNumber}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleProductSearch={handleProductSearch}
          onPickSuggestion={addToCart}
          globalProductsDB={globalProductsDB}
          showQuickAdd={showQuickAdd}
          handleQuickAddNew={handleQuickAddNew}
          cart={cart}
          handleCartItemUpdate={handleCartItemUpdate}
          handleRemoveItem={handleRemoveItem}
          cartTotal={cartTotal}
          currentTurnId={currentTurnId}
          paidFromRegister={paidFromRegister}
          setPaidFromRegister={setPaidFromRegister}
          handleConfirmPurchase={handleConfirmPurchase}
        />
      )}

      {showAIScanner && (
        <AIScannerModal
          onClose={() => setShowAIScanner(false)}
          onScanSuccess={onAIScanSuccess}
        />
      )}

      <PurchaseDetailModal purchase={detailPurchase} onClose={() => setDetailPurchase(null)} />

      {/* Modal: confirmar entrada de pedido pendiente (F6) */}
      {confirmExit.rendered && confirmData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(11,19,43,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, ...overlayAnim(confirmExit.closing) }}
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmModal(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', background: 'var(--sheet)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', ...contentAnim(confirmExit.closing) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                ✓ Confirmar entrada de mercadería
              </h3>
              <button onClick={() => setConfirmModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{confirmData.purchase.supplier_name || 'Sin proveedor'}</strong>
              {' — '}Pedido #{confirmData.purchase.id}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Revisá cantidades y costos recibidos:
            </div>
            {confirmData.editItems.map((it, idx) => (
              <div key={it.product_id || idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{it.product_name}</div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginBottom: 2 }}>Cant.</div>
                    <input type="number" value={it.quantity} min={0}
                      onChange={e => setConfirmModal(prev => ({ ...prev, editItems: prev.editItems.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x) }))}
                      style={{ width: 60, padding: '5px 7px', background: 'var(--surface-veil)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', textAlign: 'center', outline: 'none', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginBottom: 2 }}>Costo unit.</div>
                    <input type="number" value={it.unit_cost} min={0}
                      onChange={e => setConfirmModal(prev => ({ ...prev, editItems: prev.editItems.map((x, i) => i === idx ? { ...x, unit_cost: e.target.value } : x) }))}
                      style={{ width: 80, padding: '5px 7px', background: 'var(--surface-veil)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', textAlign: 'center', outline: 'none', fontSize: '0.85rem' }} />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--surface-veil)', borderRadius: 6 }}>
              ℹ️ Al confirmar se actualiza el stock y el costo de cada producto, y se registra la deuda con el proveedor.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setConfirmModal(null)} style={{ flex: 1, padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleConfirmPending} disabled={confirmSaving} style={{ flex: 2, padding: '10px 16px', background: 'var(--accent-primary)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, cursor: confirmSaving ? 'default' : 'pointer', opacity: confirmSaving ? 0.7 : 1 }}>
                {confirmSaving ? 'Confirmando...' : '✓ Confirmar entrada'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </FeatureGate>
  );
}

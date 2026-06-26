import { useState, useEffect, useRef } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import FeatureGate from '../components/ui/FeatureGate';
import { Icons } from './purchases/shared';
import AIScannerModal from './purchases/AIScannerModal';
import PurchaseDetailModal from './purchases/PurchaseDetailModal';
import PurchasesHistory from './purchases/PurchasesHistory';
import NewInvoiceForm from './purchases/NewInvoiceForm';

const PLAN_WEIGHT = { trial: 1, simple: 1, pro: 2, ia: 3 };

export default function PurchasesModule() {
  const { backend, addToast, auth, currentSucursalId, currentPlan } = usePanelContext();
  const globalProductsDB = backend.productsDB;
  const onProductsUpdated = backend.fetchProductsDB;
  const currentTurnId = auth.currentTurnId;
  const [activeTab, setActiveTab] = useState('history'); // history | new_invoice
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
      <div style={{ padding: '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      {/* HEADER COMPARTIDO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Gestión de Compras</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeTab === 'history' ? (
            <>
              <button onClick={() => setActiveTab('new_invoice')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', height: '46px', transition: 'all 0.2s' }}>
                + Carga Manual
              </button>
              <button
                onClick={() => canUseIA ? setShowAIScanner(true) : addToast('Esta función requiere el Plan IA.', 'info')}
                style={{ background: canUseIA ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.05)', border: canUseIA ? 'none' : '1px solid rgba(255,255,255,0.1)', color: canUseIA ? 'white' : 'var(--text-secondary)', padding: '10px 20px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 700, cursor: canUseIA ? 'pointer' : 'not-allowed', height: '46px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: canUseIA ? '0 4px 12px rgba(20, 187, 166, 0.3)' : 'none' }}>
                {canUseIA ? <Icons.Sparkles /> : <Icons.Lock style={{width: 16, height: 16}} />} Escanear Factura
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

      {detailPurchase && (
        <PurchaseDetailModal purchase={detailPurchase} onClose={() => setDetailPurchase(null)} />
      )}
      </div>
    </FeatureGate>
  );
}

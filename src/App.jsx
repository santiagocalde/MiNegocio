import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import StockModule from './StockModule.jsx';
import FiadoModule from './FiadoModule.jsx';
import TicketPrint from './TicketPrint.jsx';
import ConfigModal from './ConfigModal.jsx';
import AuditModule from './AuditModule.jsx';
import PurchasesModule from './PurchasesModule.jsx';

const SERVER_URL = 'http://localhost:8000/api';

// Operadores del kiosco — cada uno con su PIN
const DEFAULT_OPERATORS = [
  { pin: '1234', name: 'Dueño', role: 'admin' },
  { pin: '4321', name: 'Juan (Turno Tarde)', role: 'employee' },
  { pin: '9999', name: 'María (Turno Mañana)', role: 'employee' },
];

export const Icons = {
  Box: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  ShoppingCart: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Book: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  Lock: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Search: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Trash: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Edit: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Plus: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>,
  Minus: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>,
  Check: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  X: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>,
  Alert: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Truck: () => <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14V6h8v8m-8 0a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-8-8h8m0 0l3 3v5h-3m-8-8H4v8h4" /></svg>,
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentOperator, setCurrentOperator] = useState(null);
  const [currentTurnId, setCurrentTurnId] = useState(null);
  const [pin, setPin] = useState('');

  const [activeTab, setActiveTab] = useState('ventas');
  const [productsDB, setProductsDB] = useState([]);

  // POS State
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [isCharging, setIsCharging] = useState(false);
  const [payment, setPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [itemDiscounts, setItemDiscounts] = useState({});
  const [discountInputActive, setDiscountInputActive] = useState(null);
  const [clientCuit, setClientCuit] = useState('');
  const [searchError, setSearchError] = useState(false);


  // Modals
  const [isClosingCaja, setIsClosingCaja] = useState(false);
  const [closeCajaPin, setCloseCajaPin] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [isCancelConfirm, setIsCancelConfirm] = useState(false);
  const [isFiadoOpen, setIsFiadoOpen] = useState(false);
  const [fiadoName, setFiadoName] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [businessConfig, setBusinessConfig] = useState({});
  const [lastSale, setLastSale] = useState(null);
  const [ticketNumber, setTicketNumber] = useState(1);
  const [stockAlerts, setStockAlerts] = useState(null); // null = no mostrar, {} = mostrar
  const [showEgreso, setShowEgreso] = useState(false);
  const [egresoMonto, setEgresoMonto] = useState('');
  const [egresoMotivo, setEgresoMotivo] = useState('');
  const [saleConfirm, setSaleConfirm] = useState(false); // flash "VENTA OK"
  const [showHelp, setShowHelp] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null); // { last_backup, etc }
  const [showLogs, setShowLogs] = useState(false);
  const [sysLogs, setSysLogs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [showResumen, setShowResumen] = useState(false);
  const [resumenData, setResumenData] = useState(null);
  const [showPriceCheck, setShowPriceCheck] = useState(false);
  const [priceCheckQuery, setPriceCheckQuery] = useState('');
  const [priceCheckResults, setPriceCheckResults] = useState([]);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [lastSaleId, setLastSaleId] = useState(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [backupLoading, setBackupLoading] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCierres, setShowCierres] = useState(false);
  const [cierresData, setCierresData] = useState([]);
  const [operators, setOperators] = useState(DEFAULT_OPERATORS);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const searchRef = useRef(null);
  const paymentRef = useRef(null);
  const cashRef = useRef(null);
  const pinRef = useRef(null);
  const fiadoRef = useRef(null);

  const fetchProductsDB = () => {
    fetch(`${SERVER_URL}/products`)
      .then(res => res.json())
      .then(data => setProductsDB(data))
      .catch(() => { });
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchProductsDB();
      fetch(`${SERVER_URL}/config`)
        .then(res => res.json())
        .then(cfg => setBusinessConfig(cfg))
        .catch(() => { });
      // Alertas de stock al abrir turno
      fetch(`${SERVER_URL}/stock-alerts`)
        .then(res => res.json())
        .then(alerts => { if (alerts.total > 0) setStockAlerts(alerts); })
        .catch(() => { });
      // Ventas del día para el cierre de caja
      fetch(`${SERVER_URL}/sales/today`)
        .then(res => res.json())
        .then(data => setTodaySalesTotal(data.total_vendido || 0))
        .catch(() => { });
    }
  }, [isAuthenticated]);

  // Efecto: Guardar carrito en localStorage para prevenir pérdida en cortes
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem('novastock_cart', JSON.stringify(cart));
    }
  }, [cart, isAuthenticated]);

  // Efecto: Ping de estado y control de conexión
  useEffect(() => {
    let interval;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendStatus(data);
          setBackendError(false);
        } else {
          setBackendError(true);
        }
      } catch (err) {
        setBackendError(true);
      }
    };

    if (isAuthenticated) {
      interval = setInterval(checkHealth, 10000); // 10 seg (menos spam)
      checkHealth();
    }
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Efecto: Sincronizador en background para "Carrito Ghost" (Outbox pattern)
  useEffect(() => {
    let syncInterval;
    const syncPendingSales = async () => {
      const pendingStr = localStorage.getItem('novastock_pending_sales');
      if (!pendingStr) return;
      let pending = [];
      try { pending = JSON.parse(pendingStr); } catch { return; }
      if (pending.length === 0) {
        setPendingSync(0);
        return;
      }

      const toKeep = [];
      for (const sale of pending) {
        try {
          const res = await fetch(`${SERVER_URL}/sales?idempotency_key=${sale.idempotencyKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sale.payload),
          });
          if (!res.ok) throw new Error("No se pudo enviar");
        } catch (e) {
          toKeep.push(sale);
        }
      }

      localStorage.setItem('novastock_pending_sales', JSON.stringify(toKeep));
      setPendingSync(toKeep.length);
    };

    if (isAuthenticated) {
      syncInterval = setInterval(syncPendingSales, 15000);
      syncPendingSales();
    }
    return () => clearInterval(syncInterval);
  }, [isAuthenticated]);

  // Reloj en vivo para pantalla de login
  useEffect(() => {
    if (!isAuthenticated) {
      const interval = setInterval(() => setCurrentDateTime(new Date()), 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'ventas' && !isCharging && !isClosingCaja && !isCancelConfirm && !isFiadoOpen) {
      searchRef.current?.focus();
    }
    if (!isAuthenticated) {
      pinRef.current?.focus();
    }
  }, [isAuthenticated, activeTab, isCharging, isClosingCaja, isCancelConfirm, isFiadoOpen, cart]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handleKeyDown = (e) => {
      if (activeTab !== 'ventas') return;

      if (e.key === 'Escape') {
        if (search.trim() !== '') setSearch('');
        setIsCharging(false); setIsClosingCaja(false); setIsCancelConfirm(false); setIsFiadoOpen(false); setPayment(''); setPaymentMethod('efectivo'); setClientCuit(''); setCountedCash(''); setFiadoName(''); setAdjustedTotal(null); setEditingTotal(false);
        return;
      }
      if (isCharging || isClosingCaja || isCancelConfirm || isFiadoOpen) return;

      if (e.key === 'F1') { e.preventDefault(); if (cart.length > 0) setIsCharging(true); }
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F3') { e.preventDefault(); if (cart.length > 0) { const lastId = cart[cart.length - 1].id; document.getElementById(`qty-input-${lastId}`)?.focus(); document.getElementById(`qty-input-${lastId}`)?.select(); } }
      if (e.key === 'F4') { e.preventDefault(); if (cart.length > 0) setIsFiadoOpen(true); }
      if (e.key === 'F8' || e.key === 'Delete' || e.key === 'Supr') { e.preventDefault(); if (cart.length > 0) { setCart(prev => prev.slice(0, -1)); addToast("Último producto quitado del carrito", "success"); playBeep(); } }
      if (e.key === 'F10') { e.preventDefault(); setShowHelp(prev => !prev); }
      if (e.key === 'F12') { e.preventDefault(); if (cart.length > 0) setIsCancelConfirm(true); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, activeTab, cart, isCharging, isClosingCaja, isCancelConfirm, isFiadoOpen, addToast]);

  // ─────────────────────────────────────────────────────────────
  // CÁLCULO DE TOTALES
  // ─────────────────────────────────────────────────────────────
  const calculateTotals = () => {
    const rawTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalItemDiscount = Object.values(itemDiscounts).reduce((acc, d) => acc + (parseInt(d) || 0), 0);
    const total = Math.max(0, rawTotal - totalItemDiscount);
    const subtotal = total / 1.21;
    const iva = total - subtotal;
    return { total, discount: totalItemDiscount, subtotal, iva };
  };

  const { discount, total, subtotal, iva } = calculateTotals();
  const effectiveTotal = adjustedTotal ?? total;
  const change = payment ? parseInt(payment) - effectiveTotal : 0;

  const handleUnpack = async (productId) => {
    try {
      const res = await fetch(`${SERVER_URL}/products/${productId}/unpack?operator=${currentOperator?.name}`, { method: 'POST' });
      if (res.ok) {
        addToast("Bulto desarmado con éxito.", "success");
        fetchProductsDB();
      } else {
        const data = await res.json();
        addToast(data.detail || "Error al abrir bulto", "error");
      }
    } catch {
      addToast("No hay conexión con el servidor. Verificá que NovaStock esté iniciado.", "error");
    }
  };

  const playBeep = () => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, context.currentTime); // High pitch A5
    gain.gain.setValueAtTime(0.1, context.currentTime);
    osc.start(context.currentTime);
    osc.stop(context.currentTime + 0.1);
  };

  const playErrorBeep = () => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, context.currentTime); // Low pitch error
    gain.gain.setValueAtTime(0.1, context.currentTime);
    osc.start(context.currentTime);
    osc.stop(context.currentTime + 0.3);
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && search.trim() !== '') {
      const term = search.trim();
      let productToAdd = null;

      const codeMatch = productsDB.find(p => p.code === term);
      if (codeMatch) {
        productToAdd = codeMatch;
      } else {
        const nameMatches = productsDB.filter(p => p.name.toLowerCase().includes(term.toLowerCase()));
        if (nameMatches.length === 1) {
          productToAdd = nameMatches[0];
        } else if (nameMatches.length > 1) {
          const exactNameMatch = nameMatches.find(p => p.name.toLowerCase() === term.toLowerCase());
          if (exactNameMatch) {
            productToAdd = exactNameMatch;
          } else {
            addToast("Múltiples coincidencias. Elija de la lista abajo.", "error");
            playErrorBeep();
            return;
          }
        }
      }

      if (productToAdd) {
        setCart(prev => {
          const ex = prev.find(p => p.id === productToAdd.id);
          if (ex) return prev.map(p => p.id === productToAdd.id ? { ...p, qty: p.qty + 1 } : p);
          return [...prev, { ...productToAdd, qty: 1 }];
        });
        setSearch('');

        // Audio and Visual Feedback
        playBeep();
        setFlash(true);
        setTimeout(() => setFlash(false), 300);
      } else {
        addToast(`No encontré '${term}'. Escaneá de nuevo o buscá por nombre.`, 'error');
        playErrorBeep();
        setSearchError(true);
        searchRef.current?.focus();
        setTimeout(() => setSearchError(false), 1000);
        setSearch('');
      }
    }
  };

  const handleQuickAdd = (code, name, price) => {
    const dbProduct = productsDB.find(p => p.code === code);
    if (dbProduct) {
      setCart(prev => {
        const ex = prev.find(p => p.id === dbProduct.id);
        if (ex) return prev.map(p => p.id === dbProduct.id ? { ...p, qty: p.qty + 1 } : p);
        return [...prev, { ...dbProduct, qty: 1 }];
      });
    } else {
      // Auto-crear producto virtual en DB para que sea editable después
      fetch(`${SERVER_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, price, stock: 999, min_stock: 0, iva: '21%' }),
      }).then(res => res.json()).then(newProduct => {
        setCart(prev => [...prev, { ...newProduct, qty: 1 }]);
        fetchProductsDB();
      }).catch(() => {
        // Offline: usar producto temporal
        const temp = { id: code, code, name, price, stock: 999, min_stock: 0, iva: '21%' };
        setCart(prev => {
          const ex = prev.find(p => p.id === temp.id);
          if (ex) return prev.map(p => p.id === temp.id ? { ...p, qty: p.qty + 1 } : p);
          return [...prev, { ...temp, qty: 1 }];
        });
      });
    }
    playBeep();
    setFlash(true);
    addToast(`✓ ${name} agregado. Presioná F8 si te equivocaste.`);
    setTimeout(() => setFlash(false), 300);
  };

  const handlePin = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 4) setPin(val);
    const op = operators.find(o => o.pin === val);
    if (op) {
      setCurrentOperator(op);
      setIsAuthenticated(true);
      setPin('');
      // Abrir turno en backend
      fetch(`${SERVER_URL}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: op.name }),
      }).then(r => r.json()).then(d => setCurrentTurnId(d.id)).catch(() => { });
    } else if (val.length === 4) {
      playErrorBeep();
      addToast('PIN incorrecto. Probá de nuevo.', 'error');
      setPin('');
    }
  };

  const updateQty = (id, delta) => setCart(prev => prev.map(p => p.id === id ? { ...p, qty: Math.max(1, p.qty + delta) } : p));
  const remove = (id) => setCart(prev => prev.filter(p => p.id !== id));

  const confirmCharge = async () => {
    const saleCart = [...cart];
    const saleTotal = adjustedTotal ?? total;
    const salePayment = paymentMethod === 'efectivo' ? (parseFloat(payment) || saleTotal) : saleTotal;
    const saleChange = paymentMethod === 'efectivo' ? (change < 0 ? 0 : change) : 0;
    const salePayload = {
      turn_id: currentTurnId,
      total: saleTotal,
      payment: salePayment,
      change_given: saleChange,
      operator: currentOperator?.name || 'Sistema',
      is_fiado: false,
      payment_method: paymentMethod,
      client_cuit: clientCuit,
      items: saleCart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.qty, unit_price: i.price })),
    };

    // Generar Idempotency Key
    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await fetch(`${SERVER_URL}/sales?idempotency_key=${idempotencyKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      });
      if (!res.ok) throw new Error("Error al procesar la venta");
      const data = await res.json();
      setTicketNumber(data.id || ticketNumber + 1);
      setLastSaleId(data.id);
      fetchProductsDB();
    } catch {
      // Si falla, Outbox pattern con idempotency key
      const pendingStr = localStorage.getItem('novastock_pending_sales');
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      pending.push({ payload: salePayload, idempotencyKey });
      localStorage.setItem('novastock_pending_sales', JSON.stringify(pending));
    }

    // El carrito SE LIMPIA localmente siempre.
    localStorage.removeItem('novastock_cart');
    setLastSale({ cart: saleCart, total: saleTotal, payment: salePayment, change: saleChange });
    setCart([]);
    setIsCharging(false);
    setPayment('');
    setPaymentMethod('efectivo');
    setClientCuit('');
    setAdjustedTotal(null);
    setEditingTotal(false);
    setItemDiscounts({});
    setDiscountInputActive(null);
    // Confirmación visual 2s
    setSaleConfirm(true);
    setTimeout(() => setSaleConfirm(false), 2500);
    // Imprimir ticket automáticamente
    setTimeout(() => window.print(), 100);
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/backup`, { method: 'POST' });
      if (res.ok) {
        addToast(`Backup completado ${new Date().toLocaleTimeString('es-AR')}`, 'success');
      } else {
        addToast('No se pudo hacer el backup', 'error');
      }
    } catch {
      addToast('No se pudo hacer el backup', 'error');
    }
    setBackupLoading(false);
  };

  const handleDevolucion = async () => {
    if (!lastSaleId) return;
    setSaleConfirm(false);
    try {
      const res = await fetch(`${SERVER_URL}/sales/${lastSaleId}/revert`, { method: 'PATCH' });
      if (res.ok) {
        addToast('Venta anulada. Stock revertido.', 'success');
      } else {
        addToast('Error al anular la venta.', 'error');
      }
    } catch {
      addToast('No se pudo conectar con el servidor.', 'error');
    }
  };

  const handleManualSync = async () => {
    const pendingStr = localStorage.getItem('novastock_pending_sales');
    if (!pendingStr) return;
    let pending = [];
    try { pending = JSON.parse(pendingStr); } catch { return; }
    if (pending.length === 0) return;
    const toKeep = [];
    for (const sale of pending) {
      try {
        const res = await fetch(`${SERVER_URL}/sales?idempotency_key=${sale.idempotencyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sale.payload),
        });
        if (!res.ok) throw new Error("No se pudo enviar");
      } catch (e) {
        toKeep.push(sale);
      }
    }
    localStorage.setItem('novastock_pending_sales', JSON.stringify(toKeep));
    setPendingSync(toKeep.length);
    if (toKeep.length === 0) {
      setShowPendingModal(false);
      addToast('Todas las ventas pendientes fueron sincronizadas.', 'success');
    }
  };

  const getPendingData = () => {
    try {
      const str = localStorage.getItem('novastock_pending_sales');
      if (!str) return { count: 0, total: 0 };
      const data = JSON.parse(str);
      const total = data.reduce((acc, s) => acc + (s.payload?.total || 0), 0);
      return { count: data.length, total };
    } catch {
      return { count: 0, total: 0 };
    }
  };

  const submitEgreso = async () => {
    const monto = parseFloat(egresoMonto);
    if (!monto || monto <= 0 || !egresoMotivo.trim()) return;
    try {
      await fetch(`${SERVER_URL}/egresos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turn_id: currentTurnId, monto, motivo: egresoMotivo, operator: currentOperator?.name }),
      });
      addToast(`Retiro de efectivo registrado: $${monto}`, 'success');
    } catch { addToast('No se pudo registrar el retiro. Verificá la conexión con el servidor.', 'error'); }
    setShowEgreso(false);
    setEgresoMonto('');
    setEgresoMotivo('');
  };

  const confirmFiado = async () => {
    if (!fiadoName) return;
    try {
      await fetch(`${SERVER_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turn_id: currentTurnId,
          total: adjustedTotal ?? total,
          payment: 0,
          change_given: 0,
          operator: currentOperator?.name || 'Sistema',
          is_fiado: true,
          fiado_name: fiadoName,
          items: cart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.qty, unit_price: i.price })),
        }),
      });
      fetchProductsDB();
    } catch { setPendingSync(prev => prev + 1); }
    setCart([]);
    setIsFiadoOpen(false);
    setFiadoName('');
  };

  const calculateCajaDiff = () => {
    if (!countedCash) return null;
    return parseInt(countedCash) - (todaySalesTotal || 0);
  };

  const confirmCloseTurn = () => {
    if (closeCajaPin !== currentOperator?.pin) {
      addToast('PIN incorrecto. No se puede cerrar el turno.', 'error');
      playErrorBeep();
      return;
    }
    if (!countedCash) return;
    // Cerrar turno en backend
    fetch(`${SERVER_URL}/turns/${currentTurnId}/close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales_total: todaySalesTotal || 0,
        counted_cash: parseFloat(countedCash) || 0,
        notes: '',
      }),
    }).catch(() => {});
    // Limpiar carrito y localStorage
    localStorage.removeItem('novastock_cart');
    setCart([]);
    setLastSale(null);
    setIsClosingCaja(false);
    setCountedCash('');
    setCloseCajaPin('');
    addToast('Turno cerrado correctamente. ¡Hasta la próxima!', 'success');
    setTimeout(() => window.print(), 200);
  };

  if (!isAuthenticated) {
    return (
      <div className="layout" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>
          {currentDateTime.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — {currentDateTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="brand-icon" style={{ width: 80, height: 80, marginBottom: 24 }}><Icons.Lock /></div>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>NovaStock</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Ingresá tu PIN para abrir turno</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '32px' }}>
          Dueño: 1234 · Juan: 4321 · María: 9999
        </p>
        <input
          ref={pinRef}
          type="password"
          value={pin}
          onChange={handlePin}
          style={{
            fontSize: '3rem', textAlign: 'center', letterSpacing: '24px', width: '300px',
            background: 'var(--bg-card)', border: '2px solid var(--border-focus)',
            color: 'var(--text-primary)', padding: '16px', borderRadius: '16px',
            fontFamily: 'var(--font-mono)'
          }}
          placeholder="••••"
        />
        <button
          onClick={() => setShowPriceCheck(true)}
          style={{
            marginTop: '24px', background: 'transparent', border: '1px solid var(--border-color)',
            borderRadius: '12px', padding: '12px 24px', color: 'var(--text-primary)',
            cursor: 'pointer', fontSize: '1rem', fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
        >
          🔍 Consultar precio
        </button>
      </div>
    );
  }

  const emptyStockCount = productsDB.filter(p => p.stock <= 0 && p.is_virtual !== 1 && p.code !== '001').length;
  const lowStockCount = productsDB.filter(p => p.stock > 0 && p.stock <= p.min_stock && p.is_virtual !== 1 && p.code !== '001').length;

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Icons.Box /></div>
          <span className="brand-text">NovaStock</span>
        </div>

        <nav className="nav-menu">
          <div className="nav-section-label">MÓDULOS</div>
          <div className={`nav-item ${activeTab === 'ventas' ? 'active' : ''}`} onClick={() => setActiveTab('ventas')}>
            <Icons.ShoppingCart /> Ventas (Caja)
          </div>
          <div className={`nav-item ${activeTab === 'fiado' ? 'active' : ''}`} onClick={() => setActiveTab('fiado')}>
            <Icons.Book /> Fiado (Libreta)
          </div>
          {currentOperator?.role === 'admin' && (
            <>
              <div className={`nav-item ${activeTab === 'inventario' ? 'active' : ''}`} onClick={() => setActiveTab('inventario')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Icons.Box /> Stock</div>
                {(emptyStockCount > 0 || lowStockCount > 0) && (
                  <div style={{ background: emptyStockCount > 0 ? 'var(--accent-danger)' : 'var(--accent-warning)', color: emptyStockCount > 0 ? 'white' : 'black', padding: '4px 12px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }}>
                    {emptyStockCount + lowStockCount}
                  </div>
                )}
              </div>
              <div className={`nav-item ${activeTab === 'compras' ? 'active' : ''}`} onClick={() => setActiveTab('compras')}>
                <Icons.Truck /> Compras
              </div>
              <div className={`nav-item ${activeTab === 'auditoria' ? 'active' : ''}`} onClick={() => setActiveTab('auditoria')}>
                🔍 Auditoría
              </div>
              <div className="nav-item" onClick={async () => { setShowCierres(true); try { const res = await fetch(`${SERVER_URL}/turns`); const data = await res.json(); setCierresData(Array.isArray(data) ? data : []); } catch { setCierresData([]); } }}>
                📋 Cierres anteriores
              </div>
            </>
          )}

          <div className="nav-separator"></div>

          {currentOperator?.role === 'admin' && (
            <div className="nav-item" style={{ border: '1px solid rgba(234, 179, 8, 0.3)' }} onClick={() => setShowEgreso(true)}>
              💸 Retirar Efectivo
            </div>
          )}

          {currentOperator?.role === 'admin' && (
            <div className="nav-item" style={{ color: 'var(--text-secondary)' }} onClick={() => setShowConfig(true)}>
              ⚙️ Configurar negocio
            </div>
          )}

          <div className="nav-item" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }} onClick={() => setIsClosingCaja(true)}>
            🔒 Cerrar Turno
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {backendError && (
          <div style={{ background: 'var(--accent-danger)', color: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
            <Icons.Alert /> ⚠️ Sin conexión al servidor local. Reintentando...
          </div>
        )}

        <header className="topbar">
          <div className="topbar-title">
            {activeTab === 'ventas' && `🛒 VENTAS — ${currentOperator?.name || 'Turno 1'}`}
            {activeTab === 'inventario' && 'Gestión de Stock'}
            {activeTab === 'compras' && 'Compras y Remitos'}
            {activeTab === 'auditoria' && 'Auditoría de Sistema'}
            {activeTab === 'fiado' && 'Libreta de Fiado'}
          </div>
          <div className="status-indicators">
            {backendStatus?.last_backup && (
              <span className="sync-status text-secondary" style={{ fontSize: '0.8rem', marginRight: '16px' }} title="El backup se hace automático cada 10 min">
                💾 Último backup: {backendStatus.last_backup.split(' ')[1]}
                <button onClick={handleBackup} disabled={backupLoading} style={{marginLeft:'12px', background:'rgba(255,255,255,0.1)', border:'1px solid var(--border-color)', borderRadius:'8px', color:'white', padding:'4px 12px', cursor:'pointer', fontSize:'0.8rem', fontWeight:600}}>
                  {backupLoading ? 'Haciendo backup...' : '💾 Backup ahora'}
                </button>
              </span>
            )}
            {pendingSync > 0 && (
              <span className="status-pill warning" style={{ marginRight: '12px', cursor: 'pointer' }} onClick={() => setShowPendingModal(true)}>
                ⏳ {pendingSync} venta{pendingSync !== 1 ? 's' : ''} pendiente{pendingSync !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`${SERVER_URL}/sales/today`);
                  const data = await res.json();
                  setResumenData(data);
                } catch {
                  setResumenData({ total_vendido: 0, total_tickets: 0, total_fiado: 0 });
                }
                setShowResumen(true);
              }}
              style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600, marginRight: '12px' }}
            >
              📊 Exportar resumen
            </button>
            <span className="sync-status online">
              <span className="dot"></span> Conectado
            </span>
          </div>
        </header>

        {activeTab === 'ventas' && (
          <div className="pos-centered">

            {/* 1. INPUT (Arriba) */}
            <div className={`search-bar ${flash ? 'flash' : ''}`} style={{ position: 'relative', borderColor: searchError ? 'var(--accent-danger)' : undefined, borderWidth: searchError ? '2px' : undefined }}>
              <Icons.Search />
              <input
                ref={searchRef}
                type="text"
                placeholder="Escanea o escribe (F2)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    // prevent default to not move cursor
                    e.preventDefault();
                    document.getElementById('autocomplete-0')?.focus();
                  } else {
                    handleSearch(e);
                  }
                }}
              />
              {search.trim().length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  {productsDB.filter(p => p.code.startsWith(search) || p.name.toLowerCase().startsWith(search.toLowerCase())).slice(0, 5).map((p, i) => (
                    <button
                      id={`autocomplete-${i}`}
                      key={p.id}
                      onClick={() => { handleQuickAdd(p.code, p.name, p.price); setSearch(''); searchRef.current?.focus(); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { handleQuickAdd(p.code, p.name, p.price); setSearch(''); searchRef.current?.focus(); }
                        if (e.key === 'ArrowDown') document.getElementById(`autocomplete-${i + 1}`)?.focus();
                        if (e.key === 'ArrowUp') { if (i === 0) searchRef.current?.focus(); else document.getElementById(`autocomplete-${i - 1}`)?.focus(); }
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', outline: 'none' }}
                      onFocus={e => e.target.style.background = 'var(--bg-hover)'}
                      onBlur={e => e.target.style.background = 'transparent'}
                      onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.target.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
                        <span>${p.price}</span>
                        {currentOperator?.role === 'admin' && (
                          <span style={{ color: p.stock > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>Stock: {p.stock}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ATAJOS RÁPIDOS (Cargas, SUBE, etc) */}
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
              <button className="btn" style={{ flex: 1, background: 'var(--bg-card)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', fontSize: '1rem' }} onClick={() => handleQuickAdd('SUBE', 'Carga SUBE', 1000)}>
                🚌 Carga SUBE ($1000)
              </button>
              <button className="btn" style={{ flex: 1, background: 'var(--bg-card)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', fontSize: '1rem' }} onClick={() => handleQuickAdd('VIRTUAL', 'Carga Virtual Celular', 1000)}>
                📱 Carga Celular ($1000)
              </button>
              <button className="btn" style={{ flex: 1, background: 'var(--bg-card)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', fontSize: '1rem' }} onClick={() => handleQuickAdd('AGUA', 'Agua Caliente Termo', 300)}>
                ♨️ Agua Caliente ($300)
              </button>
            </div>

            {/* 2. CARRITO (Centro) */}
            <div className="cart-list">
              {cart.length === 0 ? (
                <div className="placeholder-view">
                  <h2 style={{ fontSize: '3rem', color: 'var(--text-secondary)' }}>CAJA VACÍA</h2>
                  <p style={{ fontSize: '1.25rem', marginTop: '16px' }}>Escanea un código de barras o presiona F2 para buscar manualmente.</p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    CARRITO: {cart.length} item{cart.length !== 1 ? 's' : ''}
                  </div>
                  {cart.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="item-details">
                        <span className="item-title">✓ {item.name}</span>
                        <span className="item-price-unit">${item.price} c/u</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div className="qty-controls">
                          <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>-</button>
                          <input 
                            id={`qty-input-${item.id}`}
                            className="qty-val"
                            type="number" 
                            value={item.qty} 
                            onChange={e => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val > 0) {
                                setCart(prev => prev.map(p => p.id === item.id ? { ...p, qty: val } : p));
                              }
                            }}
                            style={{ width: '60px', textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}
                          />
                          <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                        </div>
                        {item.is_virtual === 1 && item.stock <= 0 && (
                          <button onClick={() => handleUnpack(item.id)} style={{ background: 'var(--accent-warning)', border: 'none', borderRadius: '8px', color: 'black', padding: '8px 12px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            📦 Abrir Bulto
                          </button>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => setDiscountInputActive(discountInputActive === item.id ? null : item.id)}
                            style={{
                              background: itemDiscounts[item.id] ? 'rgba(34,197,94,0.15)' : 'transparent',
                              border: '1px solid',
                              borderColor: itemDiscounts[item.id] ? 'var(--accent-success)' : 'var(--border-color)',
                              borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '1rem',
                              lineHeight: '1',
                            }}
                            title="Aplicar descuento"
                          >
                            🏷️
                          </button>
                          {discountInputActive === item.id && (
                            <input
                              type="number"
                              value={itemDiscounts[item.id] || ''}
                              onChange={e => setItemDiscounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onBlur={() => {
                                if (!itemDiscounts[item.id] || parseInt(itemDiscounts[item.id]) <= 0) {
                                  setItemDiscounts(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                                }
                                setDiscountInputActive(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  if (!e.target.value || parseInt(e.target.value) <= 0) {
                                    setItemDiscounts(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                                  }
                                  setDiscountInputActive(null);
                                }
                                if (e.key === 'Escape') setDiscountInputActive(null);
                              }}
                              placeholder="$"
                              style={{
                                width: '60px', padding: '4px 8px', background: 'var(--bg-main)',
                                border: '1px solid var(--accent-success)', borderRadius: '6px',
                                color: 'var(--text-primary)', fontSize: '0.9rem', textAlign: 'center',
                                fontFamily: 'var(--font-mono)', outline: 'none',
                              }}
                              autoFocus
                            />
                          )}
                          {itemDiscounts[item.id] && discountInputActive !== item.id && (
                            <span style={{ color: 'var(--accent-success)', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              -${parseInt(itemDiscounts[item.id]).toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>
                        <div className="item-price">
                          ${(item.price * item.qty).toLocaleString('es-AR')}
                        </div>
                        <button className="qty-btn-danger" onClick={() => remove(item.id)}>
                          <Icons.Trash />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Totals Block */}
                  <div className="cart-footer">
                    <div className="cart-footer-row">
                      <span>SUBTOTAL:</span>
                      <span>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="cart-footer-row">
                      <span>IVA (21%):</span>
                      <span>${iva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {discount > 0 && (
                      <div className="cart-footer-row" style={{ color: 'var(--accent-success)', fontWeight: 800 }}>
                        <span>DESCUENTOS APLICADOS (COMBOS/PROMOS):</span>
                        <span>-${discount.toLocaleString('es-AR')}</span>
                      </div>
                    )}
                    <div className="cart-footer-total">
                      <span>TOTAL A PAGAR:</span>
                      <span className={`total-amount ${total > 0 ? 'active' : 'zero'}`}>${total.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Overlay VENTA OK */}
            {saleConfirm && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(34, 197, 94, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '16px' }}>
                <div style={{ background: 'white', color: 'var(--accent-success)', borderRadius: '50%', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <Icons.Check />
                </div>
                <h2 style={{ fontSize: '3rem', color: 'white', fontWeight: 800 }}>¡VENTA OK!</h2>
                <p style={{ fontSize: '1.5rem', color: 'white', opacity: 0.9, marginTop: 16 }}>Imprimiendo ticket...</p>
                <button style={{background:'rgba(255,255,255,0.2)', color:'white', border:'2px solid white', borderRadius:'12px', padding:'16px 32px', fontSize:'1.5rem', fontWeight:800, cursor:'pointer', marginTop:'24px'}} onClick={handleDevolucion}>↩️ Devolver producto</button>
              </div>
            )}

            {/* 3. BOTONES (Abajo, Jerárquicos) */}
            <div className="action-stack">
              <div className="action-row-main">
                <button
                  className="btn btn-primary-huge"
                  onClick={() => setIsCharging(true)}
                  disabled={cart.length === 0}
                >
                  [F1] COBRAR - ${(adjustedTotal ?? total).toLocaleString('es-AR')}
                </button>
              </div>
              <div className="action-row-sub">
                <button className="btn btn-warning" onClick={() => { if (cart.length > 0) setIsFiadoOpen(true); }} disabled={cart.length === 0} style={{ opacity: cart.length === 0 ? 0.5 : 1 }}>
                  [F4] Vender Fiado
                </button>
              </div>
              <button className="btn btn-danger-small" onClick={() => { if (cart.length > 0) setIsCancelConfirm(true); }} disabled={cart.length === 0} style={{ opacity: cart.length === 0 ? 0.5 : 1 }}>
                [F12] Anular carrito
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
              <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 700 }}>F1 Cobrar</span>
              <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 700 }}>F2 Buscar</span>
              <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 700 }}>F4 Fiado</span>
              <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 700 }}>F8 ⌫ Quitar</span>
              <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 700 }}>F10 Ayuda</span>
              <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 700 }}>F12 Anular</span>
              <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 700 }}>Esc Salir</span>
            </div>

          </div>
        )}

        {/* MÓDULO STOCK */}
        {activeTab === 'inventario' && (
          <StockModule serverUrl={SERVER_URL} onProductsUpdated={fetchProductsDB} addToast={addToast} products={productsDB} />
        )}

        {/* MÓDULO COMPRAS */}
        {activeTab === 'compras' && (
          <PurchasesModule serverUrl={SERVER_URL} onProductsUpdated={fetchProductsDB} addToast={addToast} products={productsDB} />
        )}

        {/* MÓDULO AUDITORÍA */}
        {activeTab === 'auditoria' && (
          <AuditModule serverUrl={SERVER_URL} addToast={addToast} products={productsDB} />
        )}

        {/* MÓDULO FIADO */}
        {activeTab === 'fiado' && <FiadoModule />}
      </main>

      {/* Charge Modal (Pantalla de Pago) */}
      {isCharging && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">💳 Cobrar con {paymentMethod === 'efectivo' ? 'Efectivo' : paymentMethod === 'tarjeta' ? 'Tarjeta' : paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Transferencia'}</h2>
            {adjustedTotal !== null ? (
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                  Total original: ${total.toLocaleString('es-AR')}
                </div>
                <div className="modal-amount" style={{ color: 'var(--accent-warning)' }}>
                  TOTAL AJUSTADO: ${adjustedTotal.toLocaleString('es-AR')}
                </div>
              </div>
            ) : (
              <div className="modal-amount" style={{ color: 'var(--text-primary)' }}>TOTAL A PAGAR: ${total.toLocaleString('es-AR')}</div>
            )}

            <div className="input-group">
              <label>CUIT del cliente (opcional)</label>
              <input
                type="text"
                value={clientCuit}
                onChange={e => setClientCuit(e.target.value)}
                placeholder="11-12345678-5"
                style={{ fontSize: '1.2rem', fontFamily: 'var(--font-main)', textAlign: 'center' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
              {[
                { key: 'efectivo', label: 'Efectivo' },
                { key: 'tarjeta', label: 'Tarjeta' },
                { key: 'mercadopago', label: 'Mercado Pago' },
                { key: 'transferencia', label: 'Transferencia' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => {
                    setPaymentMethod(m.key);
                    if (m.key !== 'efectivo') setPayment(String(adjustedTotal ?? total));
                  }}
                  style={{
                    padding: '10px 16px', borderRadius: '8px', border: '2px solid',
                    borderColor: paymentMethod === m.key ? 'var(--accent-primary)' : 'var(--border-color)',
                    background: paymentMethod === m.key ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: paymentMethod === m.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: paymentMethod === m.key ? 700 : 600,
                    cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.15s',
                  }}
                >
                  {m.key === 'efectivo' ? '💵' : m.key === 'tarjeta' ? '💳' : m.key === 'mercadopago' ? '🧉' : '🏦'} {m.label}
                </button>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              {editingTotal ? (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                  <input
                    type="number"
                    autoFocus
                    defaultValue={adjustedTotal ?? total}
                    id="ajuste-total-input"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) setAdjustedTotal(val);
                        setEditingTotal(false);
                      }
                      if (e.key === 'Escape') setEditingTotal(false);
                    }}
                    style={{ width: '180px', background: 'var(--bg-main)', border: '2px solid var(--accent-warning)', color: 'var(--text-primary)', borderRadius: '8px', padding: '12px', fontSize: '1.5rem', fontFamily: 'var(--font-mono)', textAlign: 'center', outline: 'none' }}
                  />
                  <button onClick={() => { const inp = document.getElementById('ajuste-total-input'); const val = parseFloat(inp?.value); if (!isNaN(val) && val > 0) setAdjustedTotal(val); setEditingTotal(false); }} style={{ background: 'rgba(34,197,94,0.15)', border: 'none', borderRadius: '6px', width: '40px', height: '40px', cursor: 'pointer', color: 'var(--accent-success)', fontWeight: 700 }}>✓</button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingTotal(true)}
                  style={{ background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  ✏️ Ajustar total
                </button>
              )}
            </div>

            {paymentMethod === 'efectivo' && (
              <div className="input-group">
                <label>¿Cuánto pagó el cliente?</label>
                <input
                  ref={paymentRef}
                  type="number"
                  value={payment}
                  onChange={e => setPayment(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && change >= 0) confirmCharge(); }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setPayment(adjustedTotal ?? total)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-focus)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700 }}>Justo</button>
                  <button type="button" onClick={() => setPayment(Math.ceil((adjustedTotal ?? total) / 1000) * 1000)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Próx. $1.000</button>
                  <button type="button" onClick={() => setPayment(5000)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>$5.000</button>
                  <button type="button" onClick={() => setPayment(10000)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>$10.000</button>
                  <button type="button" onClick={() => setPayment(20000)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>$20.000</button>
                </div>
              </div>
            )}

            {paymentMethod === 'efectivo' && payment && (
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>VUELTO:</span>
                <div style={{ fontSize: '3.5rem', fontWeight: 800, color: change < 0 ? 'var(--accent-danger)' : (change === 0 ? 'var(--accent-primary)' : 'var(--accent-success)'), fontFamily: 'var(--font-mono)' }}>
                  ${change < 0 ? 'Falta dinero' : change.toLocaleString('es-AR')}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-modal-cancel" onClick={() => { setIsCharging(false); setAdjustedTotal(null); setEditingTotal(false); setPaymentMethod('efectivo'); setClientCuit(''); }}>Cancelar (Esc)</button>
              <button className="btn btn-modal-confirm" onClick={confirmCharge} disabled={paymentMethod === 'efectivo' && change < 0} style={{ opacity: paymentMethod === 'efectivo' && change < 0 ? 0.5 : 1 }}>
                Cerrar Venta (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fiado (F4) */}
      {isFiadoOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Vender Fiado</h2>
            <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>Monto a anotar: <strong style={{ color: 'var(--accent-warning)', fontSize: '1.5rem' }}>${(adjustedTotal ?? total).toLocaleString('es-AR')}</strong></p>

            <div className="input-group">
              <label>Nombre del cliente</label>
              <input
                ref={fiadoRef}
                type="text"
                list="fiado-names"
                placeholder="Ej: Doña María"
                value={fiadoName}
                onChange={e => setFiadoName(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') confirmFiado(); }}
                style={{ fontSize: '1.5rem', fontFamily: 'var(--font-main)', textAlign: 'left' }}
              />
              <datalist id="fiado-names">
                {/* Asumimos que podemos inyectar esto aquí. Idealmente tendríamos un useEffect que cargue fiados. Para esta mejora, inyectamos historial local si tuviéramos, pero por ahora permitimos que el navegador recuerde si no se pasan opciones manuales. 
                    Vamos a dejar que el datalist se pueble con el historial de compras fiadas en un futuro o lo dejamos vacío y el navegador lo autocompleta por caché. */}
              </datalist>
            </div>

            <div className="modal-actions">
              <button className="btn btn-modal-cancel" onClick={() => setIsFiadoOpen(false)}>Cancelar (Esc)</button>
              <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-warning)', color: 'black' }} onClick={confirmFiado} disabled={!fiadoName} style={{ opacity: !fiadoName ? 0.5 : 1 }}>
                Guardar en Libreta (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Anular (F12) */}
      {isCancelConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px' }}>
            <h2 className="modal-title" style={{ color: 'var(--accent-danger)' }}>¿Anular Venta?</h2>
            <p style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '32px' }}>Se vaciará el carrito y se perderán los productos escaneados.</p>
            <div className="modal-actions">
              <button className="btn btn-modal-cancel" onClick={() => setIsCancelConfirm(false)}>NO (Esc)</button>
              <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-danger)' }} onClick={() => { setCart([]); setIsCancelConfirm(false); }}>
                SÍ, ANULAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cierre Caja Modal */}
      {isClosingCaja && (
        <div className="modal-overlay">
          {currentOperator?.role === 'admin' ? (
            <div className="modal-content" style={{ width: '500px' }}>
              <h2 className="modal-title" style={{ color: 'var(--text-primary)' }}>Cierre de Turno</h2>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Hoy el sistema registró ventas por:
              </p>
              <div className="modal-amount" style={{ color: 'var(--text-primary)' }}>${(todaySalesTotal || 0).toLocaleString('es-AR')}</div>

              <div className="input-group">
                <label style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', fontWeight: 600 }}>¿Cuánto efectivo contaste en el cajón físico?</label>
                <input
                  ref={cashRef}
                  type="number"
                  value={countedCash}
                  onChange={e => setCountedCash(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Firma del Cierre (PIN 4 dígitos)</label>
                <input
                  type="password"
                  value={closeCajaPin}
                  onChange={e => setCloseCajaPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="••••"
                />
              </div>

              {countedCash && closeCajaPin.length === 4 && (
                <div style={{ textAlign: 'center', marginBottom: '24px', padding: '16px', borderRadius: '12px', background: calculateCajaDiff() === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                  {calculateCajaDiff() === 0 ? (
                    <span style={{ color: 'var(--accent-success)', fontWeight: 700, fontSize: '1.5rem' }}>✅ ¡Caja perfecta! No sobra ni falta.</span>
                  ) : (
                    <div>
                      <span style={{ color: 'var(--accent-danger)', fontWeight: 800, fontSize: '1.8rem' }}>
                        {calculateCajaDiff() > 0 ? `Sobra $${calculateCajaDiff().toLocaleString('es-AR')}` : `Falta $${Math.abs(calculateCajaDiff()).toLocaleString('es-AR')}`}
                      </span>
                      <p style={{ color: 'var(--accent-danger)', marginTop: '8px', fontSize: '0.9rem' }}>
                        Revisá los billetes o anotá el {calculateCajaDiff() > 0 ? 'sobrante' : 'faltante'} en las observaciones.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn-modal-cancel" onClick={() => { setIsClosingCaja(false); setCountedCash(''); setCloseCajaPin(''); }}>Cancelar (Esc)</button>
                <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-danger)', opacity: !countedCash || closeCajaPin.length < 4 ? 0.5 : 1 }} onClick={confirmCloseTurn} disabled={!countedCash || closeCajaPin.length < 4}>
                  Confirmar y Reportar
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-content" style={{ width: '400px', textAlign: 'center' }}>
              <h2 className="modal-title" style={{ color: 'var(--text-primary)' }}>Cerrar mi Turno</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '1.1rem' }}>
                {currentOperator?.name}, ¿estás seguro que querés cerrar tu turno?
              </p>
              <div className="modal-actions" style={{ justifyContent: 'center' }}>
                <button className="btn btn-modal-cancel" onClick={() => setIsClosingCaja(false)}>Cancelar</button>
                <button
                  className="btn btn-modal-confirm"
                  style={{ background: 'var(--accent-danger)' }}
                  onClick={() => {
                    fetch(`${SERVER_URL}/turns/${currentTurnId}/close`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sales_total: 0, counted_cash: 0, notes: '' }),
                    }).catch(() => {});
                    localStorage.removeItem('novastock_cart');
                    setCart([]);
                    setLastSale(null);
                    setIsClosingCaja(false);
                    setCountedCash('');
                    setCloseCajaPin('');
                    addToast('Turno cerrado correctamente. ¡Hasta la próxima!', 'success');
                    setTimeout(() => window.print(), 200);
                  }}
                >
                  Cerrar mi Turno
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TicketPrint — invisible en pantalla, visible solo al imprimir */}
      {lastSale && (
        <TicketPrint
          cart={lastSale.cart}
          total={lastSale.total}
          payment={lastSale.payment}
          change={lastSale.change}
          operator={currentOperator?.name}
          ticketNumber={ticketNumber}
          config={businessConfig}
          isClosingShift={false}
        />
      )}
      {isClosingCaja && (
        <TicketPrint
          cart={[]}
          total={0}
          payment={parseFloat(countedCash) || 0}
          change={0}
          operator={currentOperator?.name}
          ticketNumber={0}
          config={businessConfig}
          isClosingShift={true}
          shiftData={{
            operator: currentOperator?.name,
            opened_at: new Date().toISOString(),
            total_tickets: 0,
            total_efectivo: todaySalesTotal || 0,
            total_fiado: 0,
            sales_total: todaySalesTotal || 0,
            counted_cash: parseFloat(countedCash) || 0,
            top_products: [],
          }}
        />
      )}

      {/* Modal de Configuración */}
      {showConfig && (
        <ConfigModal
          onClose={() => setShowConfig(false)}
          onSave={(cfg) => { setBusinessConfig(cfg); setShowConfig(false); }}
          operators={operators}
          onOperatorsUpdate={setOperators}
        />
      )}

      {/* Modal de Egreso de Caja */}
      {showEgreso && (
        <div className="modal-overlay" onClick={() => setShowEgreso(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ fontSize: '1.5rem', color: 'var(--accent-warning)' }}>💸 Retirar Efectivo (Egreso)</h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px' }}>
              Registrá acá cualquier plata que saques de la caja (pagar a proveedor, sueldo, etc.) para que el cierre de caja no te dé faltante.
            </p>

            <div className="input-group">
              <label>Monto a retirar ($)</label>
              <input
                type="text"
                value={egresoMonto}
                onChange={e => setEgresoMonto(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Escape') { setShowEgreso(false); setEgresoMonto(''); setEgresoMotivo(''); } if (e.key === 'Enter') document.getElementById('egresoMotivoInput')?.focus(); }}
                placeholder="0"
                style={{ fontSize: '2rem', padding: '16px' }}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label>¿Para qué se usó?</label>
              <input
                type="text"
                value={egresoMotivo}
                onChange={e => setEgresoMotivo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setShowEgreso(false); setEgresoMonto(''); setEgresoMotivo(''); } if (e.key === 'Enter' && egresoMonto && egresoMotivo) submitEgreso(); }}
                placeholder="Ej: Pago de luz, Anticipo de Juan..."
                style={{ fontSize: '1.25rem', fontFamily: 'var(--font-main)', padding: '16px' }}
              />
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #EF4444', padding: '12px 16px', borderRadius: '4px', marginBottom: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <strong>⚠️ Importante:</strong> Recordá dejar el comprobante físico (ticket o vale) en la caja para Don Julio, sino se tomará como faltante injustificado.
            </div>

            <div className="modal-actions">
              <button className="btn btn-modal-cancel" onClick={() => { setShowEgreso(false); setEgresoMonto(''); setEgresoMotivo(''); }}>Cancelar (Esc)</button>
              <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-warning)', color: '#000' }} onClick={submitEgreso} disabled={!egresoMonto || !egresoMotivo}>
                Registrar Egreso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alertas de Stock al Iniciar Turno */}
      {stockAlerts && (
        <div className="modal-overlay" onClick={() => setStockAlerts(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Alert /> ¡Alerta de Stock!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Hay productos que están sin stock o bajo el mínimo recomendado:
            </p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
              {stockAlerts.empty && stockAlerts.empty.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--accent-danger)' }}>
                  <span>{p.name}</span>
                  <strong>SIN STOCK</strong>
                </div>
              ))}
              {stockAlerts.low && stockAlerts.low.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--accent-warning)' }}>
                  <span>{p.name}</span>
                  <span>Bajo Mínimo ({p.stock} de {p.min_stock})</span>
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-modal-confirm" onClick={() => setStockAlerts(null)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ayuda (F10) */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2 className="modal-title" style={{ fontSize: '1.8rem' }}>⌨️ Atajos de Teclado</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'F1', label: 'Cobrar — Abre la pantalla de pago' },
                { key: 'F2', label: 'Buscar — Enfoca el campo de búsqueda' },
                { key: 'F3', label: 'Cantidad — Editar cantidad del último producto' },
                { key: 'F4', label: 'Fiado — Registrar venta fiada' },
                { key: 'F8 / Supr', label: 'Quitar — Elimina el último producto del carrito' },
                { key: 'F10', label: 'Ayuda — Muestra esta pantalla' },
                { key: 'F12', label: 'Anular — Vacía todo el carrito' },
                { key: 'Esc', label: 'Salir — Cierra modales o limpia la búsqueda' },
              ].map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-main)', borderRadius: '8px', padding: '12px 16px' }}>
                  <span style={{ background: 'var(--accent-primary)', color: 'white', borderRadius: '6px', padding: '4px 12px', fontWeight: 800, fontSize: '1rem', minWidth: '80px', textAlign: 'center' }}>{s.key}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn btn-modal-confirm" onClick={() => setShowHelp(false)}>Cerrar (Esc)</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resumen del día */}
      {showResumen && (
        <div className="modal-overlay" onClick={() => setShowResumen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h2 className="modal-title" style={{ fontSize: '1.5rem' }}>📊 Resumen del Día</h2>
            {resumenData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Vendido</span>
                  <span style={{ fontWeight: 800, fontSize: '1.5rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>${(resumenData.total_vendido || 0).toLocaleString('es-AR')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cantidad de Tickets</span>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{resumenData.total_tickets || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Fiado</span>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--accent-warning)' }}>${(resumenData.total_fiado || 0).toLocaleString('es-AR')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Efectivo en Caja</span>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--accent-primary)' }}>${((resumenData.total_vendido || 0) - (resumenData.total_fiado || 0)).toLocaleString('es-AR')}</span>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-modal-cancel" onClick={() => setShowResumen(false)}>Cerrar</button>
              <button className="btn btn-modal-confirm" onClick={() => window.print()} style={{ background: 'var(--accent-primary)' }}>
                🖨️ Imprimir reporte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Consultar Precio (sin autenticación) */}
      {showPriceCheck && (
        <div className="modal-overlay" onClick={() => { setShowPriceCheck(false); setPriceCheckQuery(''); setPriceCheckResults([]); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h2 className="modal-title" style={{ fontSize: '1.5rem' }}>🔍 Consultar Precio</h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={priceCheckQuery}
                onChange={e => setPriceCheckQuery(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && priceCheckQuery.trim()) {
                    try {
                      const res = await fetch(`${SERVER_URL}/products?q=${encodeURIComponent(priceCheckQuery.trim())}`);
                      const data = await res.json();
                      setPriceCheckResults(Array.isArray(data) ? data : []);
                    } catch { setPriceCheckResults([]); }
                  }
                }}
                placeholder="Buscá por nombre o código..."
                autoFocus
                style={{
                  flex: 1, background: 'var(--bg-main)', border: '2px solid var(--border-focus)',
                  color: 'var(--text-primary)', padding: '12px', borderRadius: '8px',
                  fontSize: '1.1rem', outline: 'none',
                }}
              />
              <button
                onClick={async () => {
                  if (!priceCheckQuery.trim()) return;
                  try {
                    const res = await fetch(`${SERVER_URL}/products?q=${encodeURIComponent(priceCheckQuery.trim())}`);
                    const data = await res.json();
                    setPriceCheckResults(Array.isArray(data) ? data : []);
                  } catch { setPriceCheckResults([]); }
                }}
                style={{
                  padding: '12px 20px', background: 'var(--accent-primary)', border: 'none',
                  borderRadius: '8px', color: 'white', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Buscar
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {priceCheckResults.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px' }}>
                  {priceCheckQuery ? 'Sin resultados' : 'Escribí un nombre o código y presioná Enter'}
                </p>
              ) : (
                priceCheckResults.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Código: {p.code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>
                        ${p.price?.toLocaleString('es-AR')}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: p.stock > 0 ? 'var(--text-secondary)' : 'var(--accent-danger)' }}>
                        Stock: {p.stock}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button className="btn btn-modal-confirm" onClick={() => { setShowPriceCheck(false); setPriceCheckQuery(''); setPriceCheckResults([]); }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cierres Anteriores */}
      {showCierres && (
        <div className="modal-overlay" onClick={() => setShowCierres(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h2 className="modal-title" style={{ fontSize: '1.5rem' }}>📋 Cierres Anteriores</h2>
            {cierresData.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No hay cierres registrados.</p>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-focus)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px' }}>Fecha</th>
                      <th style={{ padding: '12px 16px' }}>Operador</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ventas</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Contado</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Diferencia</th>
                      <th style={{ padding: '12px 16px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cierresData.map(t => {
                      const diff = (t.counted_cash || 0) - (t.sales_total || 0);
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-focus)' }}>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{new Date(t.closed_at || t.opened_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.operator || '-'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${(t.sales_total || 0).toLocaleString('es-AR')}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${(t.counted_cash || 0).toLocaleString('es-AR')}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: diff === 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{diff === 0 ? '$0' : `${diff > 0 ? '+' : ''}$${diff.toLocaleString('es-AR')}`}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: diff === 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: diff === 0 ? 'var(--accent-success)' : 'var(--accent-danger)', padding: '4px 12px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem' }}>
                              {diff === 0 ? '✅ OK' : '❌ Diferencia'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button className="btn btn-modal-confirm" onClick={() => setShowCierres(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pendientes de Sincronización */}
      {showPendingModal && (
        <div className="modal-overlay" onClick={() => setShowPendingModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 className="modal-title" style={{ fontSize: '1.5rem' }}>⏳ Ventas Pendientes</h2>
            {(() => {
              const data = getPendingData();
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cantidad</span>
                      <span style={{ fontWeight: 800, fontSize: '1.5rem' }}>{data.count}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Monto total</span>
                      <span style={{ fontWeight: 800, fontSize: '1.5rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>${data.total.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button className="btn btn-modal-cancel" onClick={() => setShowPendingModal(false)}>Cerrar</button>
                    <button className="btn btn-modal-confirm" onClick={handleManualSync} style={{ background: 'var(--accent-primary)' }}>
                      Reintentar ahora
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Toasts Container */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', left: 'auto', transform: 'none', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 9999, pointerEvents: 'none', maxWidth: '500px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'success' ? 'var(--accent-success)' : (t.type === 'error' ? 'var(--accent-danger)' : 'var(--bg-card)'),
            color: 'white',
            padding: '20px 32px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            fontWeight: 700,
            fontSize: '1.25rem',
            textAlign: 'left',
            animation: 'slideInRight 0.3s ease',
            pointerEvents: 'auto'
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;

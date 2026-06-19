import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

export default function useCart(productsDB, ivaRate, playBeep) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('minegocio_cart');
      if (saved) {
        const ts = localStorage.getItem('minegocio_cart_ts');
        if (ts) {
          const age = Date.now() - parseInt(ts);
          if (age > 86400000) { localStorage.removeItem('minegocio_cart'); localStorage.removeItem('minegocio_cart_ts'); return []; }
        }
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  });
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState(false);
  const [flash, setFlash] = useState(false);
  const [itemDiscounts, setItemDiscounts] = useState({});
  const [discountInputActive, setDiscountInputActive] = useState(null);
  const [adjustedTotal, setAdjustedTotal] = useState(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [payment, setPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState([{ method: 'efectivo', amount: '' }]);
  const [clientCuit, setClientCuit] = useState('');
  const [vueltoEnCuenta, setVueltoEnCuenta] = useState(false);
  const [clienteVuelto, setClienteVuelto] = useState('');
  const [emitirFactura, setEmitirFactura] = useState(false);
  const [tipoFactura, setTipoFactura] = useState('C');
  const [autoPrint, setAutoPrint] = useState(false);
  const [isCancelConfirm, setIsCancelConfirm] = useState(false);
  const [promotionSavings, setPromotionSavings] = useState(0);
  const addLockRef = useRef(false);
  const debounceRef = useRef(null);

  // Persist cart to localStorage with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem('minegocio_cart', JSON.stringify(cart));
        localStorage.setItem('minegocio_cart_ts', String(Date.now()));
      } catch {}
      try {
        const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('minegocio-cart') : null;
        if (bc) { bc.postMessage('cart-updated'); bc.close(); }
      } catch {}
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cart]);

  // Listen for cart changes from other tabs
  useEffect(() => {
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('minegocio-cart') : null;
    if (!bc) return;
    const handler = () => {
      try {
        const saved = localStorage.getItem('minegocio_cart');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
        }
      } catch {}
    };
    bc.onmessage = handler;
    return () => bc.close();
  }, []);

  const handleQuickAdd = useCallback((code, name, price, extra) => {
    if (addLockRef.current) return;
    addLockRef.current = true;
    const product = productsDB.find(p => p.code === code);
    if (!product && !extra) { addLockRef.current = false; return; }
    setCart(prev => {
      const ex = prev.find(item => item.code === code);
      if (ex) return prev.map(item => item.code === code ? { ...item, qty: item.qty + 1 } : item);
      const itemId = product?.id || (extra?.id || code);
      return [...prev, { id: itemId, code, name, price, stock: product?.stock || 0, qty: 1, ...extra }];
    });
    setTimeout(() => { addLockRef.current = false; }, 300);
    if (playBeep) playBeep();
  }, [productsDB, playBeep]);

  const updateQty = useCallback((id, delta) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(0.01, item.qty + delta) } : item));
  }, []);

  const setItemQty = useCallback((id, val) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: val } : item));
  }, []);

  const removeItem = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setPayment('');
    setPaymentMethod('efectivo');
    setUseSplitPayment(false);
    setSplitPayments([{ method: 'efectivo', amount: '' }]);
    setClientCuit('');
    setAdjustedTotal(null);
    setEditingTotal(false);
    setItemDiscounts({});
    setDiscountInputActive(null);
    setVueltoEnCuenta(false);
    setClienteVuelto('');
    setEmitirFactura(false);
    setTipoFactura('C');
  }, []);

  const ivaMultiplier = 1 + ivaRate / 100;

  const calculateTotals = useCallback(() => {
    const rawTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalItemDiscount = Object.values(itemDiscounts).reduce((acc, d) => acc + (parseFloat(d) || 0), 0);
    const totalBeforePromo = Math.max(0, rawTotal - totalItemDiscount);
    const total = Math.max(0, totalBeforePromo - promotionSavings);
    const subtotal = Math.round((total / ivaMultiplier) * 100) / 100;
    const iva = Math.round((total - subtotal) * 100) / 100;
    const discount = Math.round((totalItemDiscount + promotionSavings) * 100) / 100;
    return { rawTotal: Math.round(rawTotal * 100) / 100, total: Math.round(total * 100) / 100, subtotal, iva, discount };
  }, [cart, itemDiscounts, promotionSavings, ivaMultiplier]);

  const totals = useMemo(() => calculateTotals(), [calculateTotals]);
  const { rawTotal, total, subtotal, iva, discount } = totals;
  const sanitizedAdjusted = adjustedTotal != null && !isNaN(adjustedTotal) && adjustedTotal >= 0 ? adjustedTotal : null;
  const effectiveTotal = sanitizedAdjusted ?? total;
  const change = (payment != null && payment !== '') ? Math.max(0, parseFloat(payment) - effectiveTotal) : 0;

  return {
    cart, setCart,
    search, setSearch,
    searchError, setSearchError,
    flash, setFlash,
    itemDiscounts, setItemDiscounts,
    discountInputActive, setDiscountInputActive,
    adjustedTotal, setAdjustedTotal,
    editingTotal, setEditingTotal,
    payment, setPayment,
    paymentMethod, setPaymentMethod,
    useSplitPayment, setUseSplitPayment,
    splitPayments, setSplitPayments,
    clientCuit, setClientCuit,
    vueltoEnCuenta, setVueltoEnCuenta,
    clienteVuelto, setClienteVuelto,
    emitirFactura, setEmitirFactura,
    tipoFactura, setTipoFactura,
    autoPrint, setAutoPrint,
    isCancelConfirm, setIsCancelConfirm,
    promotionSavings, setPromotionSavings,
    handleQuickAdd,
    updateQty,
    setItemQty,
    removeItem,
    clearCart,
    rawTotal, total, subtotal, iva, discount, effectiveTotal,
    change, ivaRate,
  };
}

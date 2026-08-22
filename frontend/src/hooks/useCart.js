import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { findProductByAnyCode } from '../utils/productLookup';

export default function useCart(productsDB, ivaRate, playBeep, cartKey = 'minegocio_cart') {
  const storageKey = cartKey;
  const storageTsKey = cartKey + '_ts';
  const bcChannel = cartKey + '-bc';
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const ts = localStorage.getItem(storageTsKey);
        if (ts) {
          const age = Date.now() - parseInt(ts);
          if (age > 86400000) { localStorage.removeItem(storageKey); localStorage.removeItem(storageTsKey); return []; }
        }
        return JSON.parse(saved);
      }
    } catch { /* noop */ }
    return [];
  });
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState(false);
  const [flash, setFlash] = useState(false);
  const [itemDiscounts, setItemDiscounts] = useState({});
  const [discountInputActive, setDiscountInputActive] = useState(null);
  const [listType, setListTypeRaw] = useState('a'); // a = público, b = mayorista/contratista

  // Cambia la lista activa Y actualiza el precio de todos los ítems ya en el carrito
  // que tengan ese precio disponible. Si un ítem no tiene precio para la lista elegida
  // (ej: price_b es null/undefined) se queda con su precio actual.
  const setListType = useCallback((newList) => {
    setListTypeRaw(newList);
    const listKey = { a: 'price_a', b: 'price_b', c: 'price_c', d: 'price_d', e: 'price_e' }[newList];
    if (!listKey) return;
    setCart(prev => prev.map(item => {
      const newPrice = item[listKey];
      if (newPrice == null || newPrice === '' || isNaN(parseFloat(newPrice))) return item;
      return { ...item, listType: newList, price: Math.round(parseFloat(newPrice)) };
    }));
  }, []);
  const [cartDiscountPct, setCartDiscountPct] = useState(0); // descuento % sobre TODO el carrito
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
  // Producto en espera de que el cajero ingrese el peso/volumen/longitud.
  // Se activa cuando handleQuickAdd detecta unit_label fraccionario (kg, g, l, etc.).
  // Mientras está seteado, el modal de peso bloquea el POS hasta que confirmen o cancelen.
  const [pendingWeightProduct, setPendingWeightProduct] = useState(null);
  const addLockRef = useRef(false);
  const debounceRef = useRef(null);
  // Un único BroadcastChannel compartido para leer y escribir: el propio objeto nunca
  // recibe los mensajes que él mismo posteó (así lo garantiza la spec). Usar instancias
  // separadas para escuchar y para escribir (como antes) provoca que la pestaña se
  // haga eco a sí misma: cada setCart dispara un post, ese post reactiva el listener,
  // que vuelve a hacer setCart con un array nuevo (JSON.parse siempre da otra referencia
  // aunque el contenido sea igual) — un loop infinito de renders y de fetch en cadena
  // (ej. /api/promotions/evaluate) cada vez que se toca el carrito.
  const bcRef = useRef(null);

  // Persist cart to localStorage with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(cart));
        localStorage.setItem(storageTsKey, String(Date.now()));
      } catch { /* noop */ }
      try { bcRef.current?.postMessage('cart-updated'); } catch { /* noop */ }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cart]);

  // Listen for cart changes from other tabs (mismo canal usado para postear arriba)
  useEffect(() => {
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(bcChannel) : null;
    if (!bc) return;
    bcRef.current = bc;
    const handler = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) { if (parsed.length > 0) setCart(parsed); else if (parsed.length === 0) setCart([]); }
        }
      } catch { /* noop */ }
    };
    bc.onmessage = handler;
    return () => { bcRef.current = null; bc.close(); };
  }, []);

  // Unidades que requieren ingresar cantidad decimal al vender (precio es "por unidad de medida").
  const FRAC_UNITS = ['kg', 'g', 'l', 'ml', 'm', 'm2', 'm²', 'cm', 'cc'];

  const handleQuickAdd = useCallback((code, name, price, extra) => {
    if (addLockRef.current) return;
    addLockRef.current = true;
    const product = findProductByAnyCode(productsDB, code);
    const canonicalCode = product?.code || code;
    if (!product && !extra) { addLockRef.current = false; return; }

    // Si el producto se vende por peso/volumen/longitud, pausar y pedir la cantidad.
    // La excepción es si viene con qty ya seteado en extra (ej: balanza que envía gramos).
    const unitLabel = product?.unit_label || extra?.unit_label || 'unidad';
    const hasExtraQty = extra?.qty != null && extra.qty !== 1;
    if (FRAC_UNITS.includes(unitLabel) && !hasExtraQty) {
      const src = product || extra || {};
      setPendingWeightProduct({
        id: product?.id || extra?.id || canonicalCode,
        code: canonicalCode,
        name, price,
        unit_label: unitLabel,
        stock: product?.stock || 0,
        price_a: src.price ?? price,
        price_b: src.price_b,
        price_c: src.price_c,
        price_d: src.price_d,
        price_e: src.price_e,
        ...extra,
      });
      addLockRef.current = false;
      return;
    }

    setCart(prev => {
      // Merge por ID de variante cuando existe (dos variantes pueden compartir código).
      const ex = extra?.id
        ? prev.find(item => item.id === extra.id)
        : prev.find(item => item.code === canonicalCode);
      if (ex) return prev.map(item => item.id === ex.id ? { ...item, qty: item.qty + 1 } : item);
      const itemId = product?.id || (extra?.id || canonicalCode);
      const src = product || extra || {};
      const item = {
        id: itemId, code: canonicalCode, name, price,
        stock: product?.stock || 0, qty: 1,
        unit_label: product?.unit_label || 'unidad',
        price_a: src.price != null ? src.price : price,
        price_b: src.price_b,
        price_c: src.price_c,
        price_d: src.price_d,
        price_e: src.price_e,
        ...extra,
      };
      // Inferir la lista activa comparando el precio final contra las listas cargadas
      // (el precio puede venir de la lista global A/B/C, de balanza o de un manual).
      const finalPrice = Math.round(parseFloat(item.price) || 0);
      const listKeys = { a: 'price_a', b: 'price_b', c: 'price_c', d: 'price_d', e: 'price_e' };
      let appliedList = 'a';
      for (const k of ['a', 'b', 'c', 'd', 'e']) {
        const v = item[listKeys[k]];
        if (v !== undefined && v !== null && v !== '' && Math.round(parseFloat(v)) === finalPrice) { appliedList = k; break; }
      }
      item.listType = appliedList;
      return [...prev, item];
    });
    setTimeout(() => { addLockRef.current = false; }, 300);
    if (playBeep) playBeep();
  }, [productsDB, playBeep]);

  // Confirma la cantidad fraccionaria y agrega el pendingWeightProduct al carrito.
  const confirmWeight = useCallback((qty) => {
    if (!pendingWeightProduct) return;
    const item = { ...pendingWeightProduct, qty };
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      // Para productos fraccionarios cada venta es un ítem separado (un pollo de 1.2 kg
      // y otro de 0.8 kg son dos líneas distintas — no se acumulan).
      return [...prev, { ...item }];
    });
    setPendingWeightProduct(null);
    if (playBeep) playBeep();
  }, [pendingWeightProduct, playBeep]);

  const cancelWeight = useCallback(() => setPendingWeightProduct(null), []);

  // Repone el carrito completo con los items de una venta anterior (ej. "repetir última venta").
  // Usa setCart directo en vez de handleQuickAdd: handleQuickAdd tiene un lock de 300ms pensado
  // para evitar dobles-escaneos accidentales, que bloquearía agregar varios items distintos en loop.
  const handleRepeatSale = useCallback((previousCartItems) => {
    if (!Array.isArray(previousCartItems) || previousCartItems.length === 0) return;
    setCart(previousCartItems.map(item => ({ ...item })));
  }, []);

  const updateQty = useCallback((id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const isFrac = item.unit_label && ['kg', 'g', 'l', 'ml', 'm', 'm2', 'm²', 'cm', 'cc'].includes(item.unit_label);
      return { ...item, qty: Math.max(isFrac ? 0.001 : 1, item.qty + delta) };
    }));
    // Beep al sumar una unidad con el boton "+", mismo feedback que al escanear. El "-" no suena.
    if (delta > 0 && playBeep) playBeep();
  }, [playBeep]);

  const setItemQty = useCallback((id, val) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: val } : item));
  }, []);

  const setItemPrice = useCallback((id, newPrice) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, price: Math.round(newPrice) } : item));
  }, []);

  // Cambia el precio de un ítem al valor de una lista de precios (A/B/C/D/E)
  const setItemList = useCallback((id, listType, newPrice) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, listType, price: Math.round(newPrice) } : item));
  }, []);

  const removeItem = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const [lastSaleItems, setLastSaleItems] = useState([]);

  const clearCart = useCallback(() => {
    setLastSaleItems([...cart]);
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
    setListType('a');
    setCartDiscountPct(0);
  }, []);

  const ivaMultiplier = 1 + ivaRate / 100;

  const calculateTotals = useCallback(() => {
    const rawTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalItemDiscount = Object.values(itemDiscounts).reduce((acc, d) => acc + (parseFloat(d) || 0), 0);
    const totalBeforePromo = Math.max(0, rawTotal - totalItemDiscount);
    const totalAfterPromo = Math.max(0, totalBeforePromo - promotionSavings);
    // Descuento porcentual general: se aplica sobre el total ya neto de descuentos
    // por ítem y promociones. Queda plegado en `total`, así subtotal/iva/effectiveTotal
    // y el importe cobrado/registrado lo reflejan sin tocar nada más.
    const pct = (cartDiscountPct > 0 && cartDiscountPct < 100) ? cartDiscountPct : 0;
    const pctDiscount = pct ? totalAfterPromo * (pct / 100) : 0;
    const total = Math.max(0, totalAfterPromo - pctDiscount);
    const subtotal = Math.round((total / ivaMultiplier) * 100) / 100;
    const iva = Math.round((total - subtotal) * 100) / 100;
    const discount = Math.round((totalItemDiscount + promotionSavings + pctDiscount) * 100) / 100;
    return { rawTotal: Math.round(rawTotal * 100) / 100, total: Math.round(total * 100) / 100, subtotal, iva, discount };
  }, [cart, itemDiscounts, promotionSavings, ivaMultiplier, cartDiscountPct]);

  const totals = useMemo(() => calculateTotals(), [calculateTotals]);
  const { rawTotal, total, subtotal, iva, discount } = totals;
  const sanitizedAdjusted = adjustedTotal != null && !isNaN(adjustedTotal) && adjustedTotal >= 0 ? adjustedTotal : null;
  const effectiveTotal = sanitizedAdjusted ?? total;
  // El vuelto puede ser negativo: así el modal de cobro bloquea "pago incompleto".
  const change = (payment != null && payment !== '') ? parseFloat(payment) - effectiveTotal : 0;

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
    listType, setListType,
    cartDiscountPct, setCartDiscountPct,
    pendingWeightProduct, confirmWeight, cancelWeight,
    handleQuickAdd,
    handleRepeatSale,
    updateQty,
    setItemQty,
    setItemPrice,
    setItemList,
    removeItem,
    clearCart,
    lastSaleItems,
    rawTotal, total, subtotal, iva, discount, effectiveTotal,
    change, ivaRate,
  };
}

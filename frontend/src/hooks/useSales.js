import { useState, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '../services/apiClient';

export default function useSales(cart, effectiveTotal, payment, paymentMethod, useSplitPayment, splitPayments, clientCuit, emitirFactura, tipoFactura, vueltoEnCuenta, clienteVuelto, adjustedTotal, currentTurnId, currentOperator, setCart, clearCart, setPayment, setPaymentMethod, setUseSplitPayment, setSplitPayments, setClientCuit, setAdjustedTotal, setEditingTotal, setItemDiscounts, setDiscountInputActive, setVueltoEnCuenta, setClienteVuelto, setEmitirFactura, setTipoFactura, mpPaymentStatus, addToast) {
  const [isCharging, setIsCharging] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [lastSaleId, setLastSaleId] = useState(null);
  const [ticketNumber, setTicketNumber] = useState(1);
  const [saleConfirm, setSaleConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFiadoOpen, setIsFiadoOpen] = useState(false);
  const [fiadoName, setFiadoName] = useState('');
  const closeTurnStats = useRef({ total_tickets: 0, total_fiado: 0, top_products: [] });
  const processingRef = useRef(false);
  const fiadoRef2 = useRef(false);

  const generateTicketText = useCallback((saleCart, saleTotal, salePayment, saleChange, facturaTipo, afip) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR');
    let text = '';
    text += 'MiNegocio POS\n';
    text += 'Ticket de Venta\n';
    text += dateStr + '\n';
    text += 'Cajero: ' + (currentOperator?.name || 'Sistema') + '\n';
    text += 'Ticket N°: ' + ticketNumber + '\n';
    if (facturaTipo && afip) {
      text += 'Factura ' + facturaTipo + '\n';
      text += 'CAE: ' + (afip.cae || '') + '\n';
    }
    text += '-'.repeat(32) + '\n';
    saleCart.forEach(item => {
      text += item.qty + 'x ' + item.name.substring(0, 20).padEnd(20) + ' $' + (item.price * item.qty).toFixed(2) + '\n';
    });
    text += '-'.repeat(32) + '\n';
    text += 'TOTAL: $' + saleTotal.toFixed(2) + '\n';
    if (salePayment > 0) text += 'Pagó: $' + salePayment.toFixed(2) + '\n';
    if (saleChange > 0) text += 'Vuelto: $' + saleChange.toFixed(2) + '\n';
    text += '\n¡Gracias por su compra!';
    return text;
  }, [currentOperator, ticketNumber]);

  const confirmCharge = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    const saleCart = [...cart];
    const saleTotal = effectiveTotal ?? (cart.reduce((acc, item) => acc + (item.price * item.qty), 0));
    const effectivePayments = useSplitPayment
      ? splitPayments.filter(p => p.method && parseFloat(p.amount) > 0).map(p => ({ method: p.method, amount: parseFloat(p.amount) }))
      : [{ method: paymentMethod, amount: paymentMethod === 'efectivo' ? ((payment !== '' && !isNaN(parseFloat(payment))) ? parseFloat(payment) : saleTotal) : saleTotal }];
    const totalPaid = effectivePayments.reduce((sum, p) => sum + p.amount, 0);
    const salePayment = totalPaid;
    const saleChange = effectivePayments.length === 1 && effectivePayments[0].method === 'efectivo'
      ? (salePayment < saleTotal ? 0 : salePayment - saleTotal) : 0;
    const salePayload = {
      turn_id: currentTurnId,
      total: saleTotal,
      payment: salePayment,
      change_given: saleChange,
      operator: currentOperator?.name || 'Sistema',
      is_fiado: false,
      payment_method: useSplitPayment ? 'split' : paymentMethod,
      client_cuit: clientCuit,
      facturar: emitirFactura,
      tipo_factura: tipoFactura,
      vuelto_en_cuenta: vueltoEnCuenta,
      cliente_vuelto: clienteVuelto,
      payments: useSplitPayment ? effectivePayments : [],
      items: saleCart.map(i => ({
        product_id: typeof i.id === 'number' ? i.id : null,
        product_name: i.name,
        quantity: i.qty,
        unit_price: i.price,
        is_virtual: i.is_virtual || typeof i.id !== 'number',
        item_discount: 0,
      })),
    };

    const idempotencyKey = crypto.randomUUID();
    let afipResponse = null;
    try {
      const res = await apiPost(`/sales?idempotency_key=${idempotencyKey}`, salePayload);
      if (!res.ok) {
        // HTTP error (4xx/5xx) — show the actual error message, do NOT save offline
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || `Error ${res.status} al procesar la venta`;
        addToast(`Error: ${msg}`, 'error');
        setIsProcessing(false);
        processingRef.current = false;
        return;
      }
      const data = await res.json();
      afipResponse = data.afip;
      try {
        const tRes = await apiGet('/sales/today');
        const tData = await tRes.json();
        setTicketNumber((tData.total_tickets || 0) + 1);
      } catch {
        setTicketNumber(prev => prev + 1);
      }
      setLastSaleId(data.id);
    } catch (err) {
      // Network error (fetch itself threw) — save offline
      console.error('Red inaccesible, guardando en pendientes:', err);
      const pendingStr = localStorage.getItem('minegocio_pending_sales');
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      pending.push({ payload: salePayload, idempotencyKey });
      localStorage.setItem('minegocio_pending_sales', JSON.stringify(pending));
      addToast('⚠️ Venta guardada sin conexión. Se sincronizará automáticamente.', 'info');
      setIsProcessing(false);
      processingRef.current = false;
      localStorage.removeItem('minegocio_cart');
      setLastSale({ cart: saleCart, total: saleTotal, payment: salePayment, change: saleChange, tipoFactura: emitirFactura ? tipoFactura : 'C', afip: null, paymentMethod: useSplitPayment ? 'split' : paymentMethod });
      clearCart();
      setIsCharging(false);
      return;
    }
    setIsProcessing(false);
    processingRef.current = false;

    localStorage.removeItem('minegocio_cart');
    setLastSale({ cart: saleCart, total: saleTotal, payment: salePayment, change: saleChange, tipoFactura: emitirFactura ? tipoFactura : 'C', afip: afipResponse, paymentMethod: useSplitPayment ? 'split' : paymentMethod });
    clearCart();
    setIsCharging(false);
    setSaleConfirm(true);
    setTimeout(() => setSaleConfirm(false), 2500);
    return { saleCart, saleTotal, salePayment, saleChange, afipResponse, effectivePayments };
  }, [isProcessing, cart, adjustedTotal, effectiveTotal, useSplitPayment, splitPayments, paymentMethod, payment, currentTurnId, currentOperator, clientCuit, emitirFactura, tipoFactura, vueltoEnCuenta, clienteVuelto, clearCart, setTicketNumber]);

  const confirmFiado = useCallback(async (partialAmount) => {
    if (!fiadoName) return;
    const cartTotal = effectiveTotal ?? (cart.reduce((acc, item) => acc + (item.price * item.qty), 0));

    let saleTotal, fiadoAmount, paymentAmount;
    if (cartTotal > 0) {
      // Fiar el carrito: monto parcial (<= total) o total completo
      fiadoAmount = (partialAmount && partialAmount > 0 && partialAmount <= cartTotal) ? partialAmount : cartTotal;
      paymentAmount = cartTotal - fiadoAmount;
      saleTotal = cartTotal;
    } else {
      // Deuda manual sin productos en el carrito (anotar cuánto debe)
      fiadoAmount = (partialAmount && partialAmount > 0) ? partialAmount : 0;
      paymentAmount = 0;
      saleTotal = fiadoAmount;
    }

    if (!fiadoAmount || fiadoAmount <= 0) {
      addToast('Ingresá un monto a fiar mayor a cero', 'error');
      return;
    }

    const salePayload = {
      turn_id: currentTurnId,
      total: saleTotal,
      payment: paymentAmount,
      change_given: 0,
      operator: currentOperator?.name || 'Sistema',
      is_fiado: true,
      fiado_name: fiadoName.trim(),
      payment_method: paymentAmount > 0 ? 'split' : 'fiado',
      client_cuit: '',
      items: cart.map(i => ({
        product_id: typeof i.id === 'number' ? i.id : null,
        product_name: i.name,
        quantity: i.qty,
        unit_price: i.price,
        is_virtual: i.is_virtual || typeof i.id !== 'number',
        item_discount: 0,
      })),
    };
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await apiPost(`/sales?idempotency_key=${idempotencyKey}`, salePayload);
      if (!res.ok) throw new Error("Error al procesar venta fiada");
      const data = await res.json();
      addToast(`✅ Fiado registrado a nombre de ${fiadoName}`, 'success');
      setLastSaleId(data.id);
    } catch {
      const pendingStr = localStorage.getItem('minegocio_pending_sales');
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      pending.push({ payload: salePayload, idempotencyKey });
      localStorage.setItem('minegocio_pending_sales', JSON.stringify(pending));
      addToast('Venta fiada guardada para sincronizar', 'info');
    }
    clearCart();
    setIsFiadoOpen(false);
    setFiadoName('');
  }, [fiadoName, adjustedTotal, effectiveTotal, cart, currentTurnId, currentOperator, addToast, clearCart]);

  return {
    isCharging, setIsCharging,
    lastSale, setLastSale,
    lastSaleId, setLastSaleId,
    ticketNumber, setTicketNumber,
    saleConfirm, setSaleConfirm,
    isProcessing, setIsProcessing,
    isFiadoOpen, setIsFiadoOpen,
    fiadoName, setFiadoName,
    closeTurnStats,
    generateTicketText,
    confirmCharge,
    confirmFiado,
  };
}

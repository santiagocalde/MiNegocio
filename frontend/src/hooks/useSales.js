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
    const saleTotal = adjustedTotal ?? (cart.reduce((acc, item) => acc + (item.price * item.qty), 0));
    const effectivePayments = useSplitPayment
      ? splitPayments.filter(p => p.method && parseFloat(p.amount) > 0).map(p => ({ method: p.method, amount: parseFloat(p.amount) }))
      : [{ method: paymentMethod, amount: paymentMethod === 'efectivo' ? (parseFloat(payment) || saleTotal) : saleTotal }];
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
      items: saleCart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.qty, unit_price: i.price })),
    };

    const idempotencyKey = crypto.randomUUID();
    let afipResponse = null;
    try {
      const res = await apiPost(`/sales?idempotency_key=${idempotencyKey}`, salePayload);
      if (!res.ok) throw new Error("Error al procesar la venta");
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
      console.error('Venta falló, guardando en pendientes:', err);
      // Punto 42: Outbox pattern con idempotency key - offline queue persists
      const pendingStr = localStorage.getItem('minegocio_pending_sales');
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      pending.push({ payload: salePayload, idempotencyKey });
      localStorage.setItem('minegocio_pending_sales', JSON.stringify(pending));
    }
    setIsProcessing(false);
    processingRef.current = false;

    localStorage.removeItem('minegocio_cart');
    setLastSale({ cart: saleCart, total: saleTotal, payment: salePayment, change: saleChange, tipoFactura: emitirFactura ? tipoFactura : 'C', afip: afipResponse });
    clearCart();
    setIsCharging(false);
    setSaleConfirm(true);
    setTimeout(() => setSaleConfirm(false), 2500);
    return { saleCart, saleTotal, salePayment, saleChange, afipResponse, effectivePayments };
  }, [isProcessing, cart, adjustedTotal, useSplitPayment, splitPayments, paymentMethod, payment, currentTurnId, currentOperator, clientCuit, emitirFactura, tipoFactura, vueltoEnCuenta, clienteVuelto, clearCart, setTicketNumber]);

  const confirmFiado = useCallback(async () => {
    if (!fiadoName) return;
    const saleTotal = adjustedTotal ?? (cart.reduce((acc, item) => acc + (item.price * item.qty), 0));
    const salePayload = {
      turn_id: currentTurnId,
      total: saleTotal,
      payment: 0,
      change_given: 0,
      operator: currentOperator?.name || 'Sistema',
      is_fiado: true,
      fiado_name: fiadoName,
      payment_method: 'fiado',
      client_cuit: '',
      items: cart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.qty, unit_price: i.price })),
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
  }, [fiadoName, adjustedTotal, cart, currentTurnId, currentOperator, addToast, clearCart]);

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

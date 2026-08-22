import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useIsMobile from '../hooks/useIsMobile';
import useCart from '../hooks/useCart';
import useSales from '../hooks/useSales';
import usePromotions from '../hooks/usePromotions';
import { usePanelContext } from '../context/PanelContext';
import { apiPost } from '../services/apiClient';
import ClientePicker from '../components/corralon/ClientePicker';
import TopBar from '../components/pos/TopBar';
import SearchBar from '../components/pos/SearchBar';
import CartPanel from '../components/pos/CartPanel';
import PaymentPanel from '../components/pos/PaymentPanel';
import ChargeModal from '../components/pos/ChargeModal';
import FiadoModal from '../components/pos/FiadoModal';
import CancelConfirmModal from '../components/pos/CancelConfirmModal';
import DevolucionModal from '../components/pos/DevolucionModal';
import DuplicateCodeModal from '../components/pos/DuplicateCodeModal';
import PriceCheckModal from '../components/pos/PriceCheckModal';
import OperatorSwitchModal from '../components/pos/OperatorSwitchModal';
import TicketPrint from '../components/TicketPrint';
import useModalExit, { overlayAnim, contentAnim } from '../hooks/useModalExit';

// Accesos rápidos por defecto. Se definen a nivel módulo (referencia estable) y
// el estado vive en VentasPage para poder compartirlo entre PaymentPanel (donde
// se ven/editan) y SearchBar (donde se navegan con las flechas sin sacar el foco
// del buscador).
const DEFAULT_QUICK_BUTTONS = [
  { id: 1, name: 'Carga SUBE', price: 1000 },
  { id: 2, name: 'Saldo Virtual', price: 500 },
  { id: 3, name: 'Agua Hervida', price: 100 },
  { id: 4, name: 'Fotocopias', price: 50 },
  { id: 5, name: 'Impresiones', price: 80 },
  { id: 6, name: 'Varios', price: 100 },
];

export default function VentasPage() {
  const isMobile = useIsMobile();
  const { auth, backend, addToast, playBeep, currentSucursalId, setCurrentSucursalId, businessType, currentPlan } = usePanelContext();
  const ivaRate = backend.businessConfig?.iva_rate ?? 0;
  const hasMultiCart = currentPlan === 'pro' || currentPlan === 'ia';

  // Dos instancias independientes de carrito — cada una con su propia key en localStorage
  const cart1 = useCart(backend.productsDB, ivaRate, playBeep, 'minegocio_cart_1');
  const cart2 = useCart(backend.productsDB, ivaRate, playBeep, 'minegocio_cart_2');
  const [activeCart, setActiveCart] = useState(1);
  const cart = activeCart === 1 ? cart1 : cart2;
  const promos = usePromotions(cart.cart);

  // Nombres configurables de las listas de precio (A/B/C/D/E) para el selector por ítem
  const cfg = backend.businessConfig || {};
  const priceLists = [
    { v: 'a', label: cfg.price_list_a_name || 'Lista A — Minorista' },
    { v: 'b', label: cfg.price_list_b_name || 'Lista B — Mayorista' },
    { v: 'c', label: cfg.price_list_c_name || 'Lista C' },
    { v: 'd', label: cfg.price_list_d_name || 'Lista D' },
    { v: 'e', label: cfg.price_list_e_name || 'Lista E' },
  ];
  // Botones del selector global de lista del carrito: A/B/C siempre (comportamiento
  // histórico), D y E solo si el negocio les puso nombre en Configuración — así los
  // negocios que usan Lista D pueden vender todo el carrito con esa lista, sin
  // ensuciar la barra para los kioscos que sólo usan A/B.
  const globalListOptions = [
    { v: 'a', label: 'A' },
    { v: 'b', label: 'B' },
    { v: 'c', label: 'C' },
    ...(cfg.price_list_d_name ? [{ v: 'd', label: 'D' }] : []),
    ...(cfg.price_list_e_name ? [{ v: 'e', label: 'E' }] : []),
  ];

  useEffect(() => { cart.setPromotionSavings(promos.promotionSavings); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promos.promotionSavings]);

  const searchRef = useRef(null);
  const paymentRef = useRef(null);
  const fiadoRef = useRef(null);

  // Accesos rápidos compartidos + índice resaltado por navegación con flechas.
  // quickNavIndex === null significa "no estás navegando los accesos": el Enter
  // del buscador funciona como siempre. Apenas tocás una flecha (con el buscador
  // vacío) se resalta uno y el Enter agrega ESE acceso en vez de procesar.
  const [quickButtons, setQuickButtons] = useState(() => {
    try { const s = localStorage.getItem('minegocio_quick_buttons'); return s ? JSON.parse(s) : DEFAULT_QUICK_BUTTONS; } catch { return DEFAULT_QUICK_BUTTONS; }
  });
  const saveQuickButtons = (b) => { setQuickButtons(b); try { localStorage.setItem('minegocio_quick_buttons', JSON.stringify(b)); } catch { /* noop */ } };
  const [quickNavIndex, setQuickNavIndex] = useState(null);

  // Cambio de operador en pleno turno (relevo liviano, sin cerrar caja)
  const [showOperatorSwitch, setShowOperatorSwitch] = useState(false);

  // ── Foco permanente en el buscador (fix scanner Leandro) ──────────────────
  // Dos mecanismos combinados:
  // 1. mousedown: cuando el usuario hace clic en algo que no es un input ni un
  //    modal abierto, devolvemos el foco al buscador de inmediato.
  // 2. useEffect sobre estados de modal: cuando cualquier modal se cierra,
  //    devolvemos el foco al buscador (cubre el caso de hacer clic en Cerrar/✕
  //    de un modal, donde al momento del mousedown el overlay todavía existe).
  useEffect(() => {
    if (isMobile) return;
    const handleMouseDown = (e) => {
      const tag = e.target?.tagName?.toUpperCase();
      const isFormField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;
      if (isFormField) return;
      if (document.querySelector('.modal-overlay, [data-modal-open]')) return;
      setTimeout(() => {
        if (!document.querySelector('.modal-overlay, [data-modal-open]')) {
          searchRef.current?.focus();
        }
      }, 0);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isMobile]);

  // (el useEffect de cierre de modales va después de que se defina `sales`)
  // ─────────────────────────────────────────────────────────────────────────

  // Pedido de envío desde mostrador — con split por ítem retira/envío
  const [showShipModal, setShowShipModal] = useState(false);
  const shipExit = useModalExit(showShipModal);
  const [shipClient, setShipClient] = useState(null);
  const [shipDate, setShipDate] = useState('');
  const [shipSaving, setShipSaving] = useState(false);
  // Set de índices del carrito marcados como "envío" (default: todos)
  const [shipItemIdxs, setShipItemIdxs] = useState(new Set());
  const [lastShipNote, setLastShipNote] = useState(null); // {id, client, items, date}

  const printShipNote = (note) => {
    const w = window.open('', '_blank', 'width=400,height=600');
    const items = (note.items || []).map(it =>
      `<tr><td style="padding:4px 8px">${it.name || it.product_name || '—'}</td><td style="text-align:right;padding:4px 8px;font-weight:700">${it.qty || it.quantity || 1}</td></tr>`
    ).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nota de entrega</title>
    <style>body{font-family:monospace;font-size:13px;padding:16px;max-width:320px;margin:0 auto}
    h2{text-align:center;font-size:1rem;margin:0 0 8px}
    .sep{border-top:1px dashed #000;margin:8px 0}
    table{width:100%;border-collapse:collapse}
    @media print{body{margin:0}}</style></head><body>
    <h2>📦 NOTA DE ENTREGA #${note.id}</h2>
    <div class="sep"></div>
    <p style="margin:4px 0"><b>Cliente:</b> ${note.client?.name || '—'}</p>
    <p style="margin:4px 0"><b>Dirección:</b> ${note.client?.address || '—'}</p>
    <p style="margin:4px 0"><b>Fecha:</b> ${note.date || new Date().toLocaleDateString('es-AR')}</p>
    <div class="sep"></div>
    <table><thead><tr><th style="text-align:left;padding:4px 8px">Producto</th><th style="text-align:right;padding:4px 8px">Cant.</th></tr></thead>
    <tbody>${items}</tbody></table>
    <div class="sep"></div>
    <p style="text-align:center;margin:8px 0">Firma: ____________________</p>
    <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  const openShipModal = () => {
    // Por default todos los ítems se marcan como envío al abrir
    setShipItemIdxs(new Set(cart.cart.map((_, i) => i)));
    setShowShipModal(true);
  };

  const toggleShipItem = (idx) => {
    setShipItemIdxs(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleCreateShipOrder = async () => {
    if (!shipClient) { addToast('Seleccioná un cliente.', 'error'); return; }
    const envioItems = cart.cart.filter((_, i) => shipItemIdxs.has(i));
    if (envioItems.length === 0) { addToast('Marcá al menos un ítem para enviar.', 'error'); return; }
    setShipSaving(true);
    try {
      const r = await apiPost('/remitos', {
        customer_id: shipClient.id,
        address: shipClient.address || '',
        scheduled_date: shipDate || new Date().toISOString().slice(0, 10),
        operator: auth.currentOperator?.name || 'Sistema',
        items: envioItems.map(it => ({
          product_id: it.id,
          quantity: it.qty || it.quantity || 1,
          unit_price: it.price || 0,
        })),
      });
      if (r.ok) {
        const data = await r.json();
        const envioItems = cart.cart.filter((_, i) => shipItemIdxs.has(i));
        setLastShipNote({ id: data.id, client: shipClient, date: shipDate || new Date().toLocaleDateString('es-AR'), items: envioItems });
        addToast(`Nota de pedido #${data.id} creada. Aparece en Notas de pedido.`, 'success');
        setShowShipModal(false);
        setShipClient(null);
        setShipDate('');
        setShipItemIdxs(new Set());
      } else {
        addToast('No se pudo crear la nota de pedido.', 'error');
      }
    } catch { addToast('Error de conexión.', 'error'); }
    setShipSaving(false);
  };

  const sales = useSales(
    cart.cart, cart.effectiveTotal, cart.payment, cart.paymentMethod,
    cart.useSplitPayment, cart.splitPayments, cart.clientCuit,
    cart.emitirFactura, cart.tipoFactura, cart.vueltoEnCuenta, cart.clienteVuelto,
    cart.adjustedTotal, auth.currentTurnId, auth.currentOperator,
    cart.setCart, cart.clearCart, cart.setPayment, cart.setPaymentMethod,
    cart.setUseSplitPayment, cart.setSplitPayments, cart.setClientCuit,
    cart.setAdjustedTotal, cart.setEditingTotal, cart.setItemDiscounts,
    cart.setDiscountInputActive, cart.setVueltoEnCuenta, cart.setClienteVuelto,
    cart.setEmitirFactura, cart.setTipoFactura,
    addToast
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Delete') { e.preventDefault(); cart.setCart(prev => prev.slice(0, -1)); }
      if (e.key === 'Escape') { cart.setSearch(''); setQuickNavIndex(null); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.cart.length]);

  // Devolver foco al buscador cuando se cierra cualquier modal conocido de VentasPage.
  // Cubre el caso de cerrar modales con botón ✕/Cancelar (donde el mousedown
  // ve el overlay todavía presente y no puede enfocar en ese momento).
  const anyModalOpen = (
    showOperatorSwitch || showShipModal ||
    !!backend.showDevolucionItems || !!backend.showDuplicateCodeModal ||
    !!backend.showPriceCheck || !!sales.isFiadoOpen || !!sales.isCharging ||
    !!cart.isCancelConfirm
  );
  useEffect(() => {
    if (isMobile || anyModalOpen) return;
    const t = setTimeout(() => searchRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [anyModalOpen, isMobile]);

  // Auto-print al confirmar venta cuando autoPrint está activo
  const lastPrintedRef = useRef(null);
  useEffect(() => {
    if (sales.lastSale && sales.lastSale !== lastPrintedRef.current && cart.autoPrint) {
      lastPrintedRef.current = sales.lastSale;
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [sales.lastSale, cart.autoPrint]);

  return (
    <>
      <TopBar currentOperator={auth.currentOperator} sucursales={backend.sucursales}
        currentSucursalId={currentSucursalId} setCurrentSucursalId={setCurrentSucursalId}
        canSwitchOperator={(backend.operators?.length || 0) > 1}
        onSwitchOperator={() => setShowOperatorSwitch(true)} />

      {/* Pestañas multi-carrito — solo plan Pro/IA */}
      {hasMultiCart && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 16px 0', background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
          {[1, 2].map(n => {
            const c = n === 1 ? cart1 : cart2;
            const isActive = activeCart === n;
            const itemCount = c.cart.length;
            return (
              <button key={n} onClick={() => setActiveCart(n)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px 8px',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                border: '1px solid', borderBottom: isActive ? '1px solid var(--bg-card)' : '1px solid transparent',
                borderColor: isActive ? 'var(--border-color)' : 'transparent',
                borderRadius: '8px 8px 0 0', cursor: 'pointer',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.82rem', fontWeight: isActive ? 700 : 500,
                marginBottom: '-1px', transition: 'all 0.12s',
              }}>
                🛒 Venta {n}
                {itemCount > 0 && (
                  <span style={{ background: isActive ? 'var(--accent-primary)' : 'var(--bg-hover)', color: isActive ? '#fff' : 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>
                    {itemCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ padding: isMobile ? '8px 16px' : '16px 24px', width: '100%', height: isMobile ? 'calc(100dvh - 60px)' : hasMultiCart ? 'calc(100% - 108px)' : 'calc(100% - 72px)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : '16px', alignItems: isMobile ? 'stretch' : 'flex-start', boxSizing: 'border-box', overflowY: isMobile ? 'auto' : undefined }}>
        <div style={{ flex: isMobile ? '0 0 auto' : '2', display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '16px', minHeight: 0, height: isMobile ? 'auto' : '100%', maxHeight: isMobile ? '55vh' : undefined }}>
          <div data-tour="search-bar" style={{ width: '100%', flexShrink: 0 }}>
          <SearchBar search={cart.search} setSearch={cart.setSearch} searchRef={searchRef}
            searchError={cart.searchError} flash={cart.flash}
            productsDB={backend.productsDB} handleQuickAdd={cart.handleQuickAdd}
            setShowPriceCheck={backend.setShowPriceCheck} addToast={addToast}
            listType={cart.listType}
            quickButtons={quickButtons} quickNavIndex={quickNavIndex} setQuickNavIndex={setQuickNavIndex}
            handleEmptyEnter={() => { if (cart.cart.length > 0) sales.setIsCharging(true); }} />
          </div>
          <div data-tour="cart-panel" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CartPanel cart={cart.cart} total={cart.total} adjustedTotal={cart.adjustedTotal}
            updateQty={cart.updateQty} setItemQty={cart.setItemQty} removeItem={cart.removeItem}
            setItemPrice={cart.setItemPrice}
            setItemList={cart.setItemList}
            priceLists={priceLists}
            listOptions={globalListOptions}
            cartDiscountPct={cart.cartDiscountPct} setCartDiscountPct={cart.setCartDiscountPct}
            canEditPrice={true}
            listType={cart.listType} setListType={cart.setListType} />
          </div>
        </div>
        <div data-tour="payment-panel" style={{ flex: 1, minHeight: 0, overflowY: "auto", width: isMobile ? '100%' : undefined }}>
        {/* Botón nota de pedido — visible cuando hay ítems en el carrito, antes de cobrar */}
        {businessType === 'corralon' && cart.cart.length > 0 && !showShipModal && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button onClick={openShipModal}
              style={{ flex: 1, padding: '10px 16px', background: 'rgba(20,187,166,0.08)', border: '1.5px solid rgba(20,187,166,0.4)', borderRadius: 8, color: 'var(--accent-primary, #14BBA6)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              🚚 Crear nota de pedido
            </button>
            {lastShipNote && (
              <button onClick={() => printShipNote(lastShipNote)} title="Imprimir última nota de entrega"
                style={{ padding: '10px 14px', background: 'rgba(20,187,166,0.08)', border: '1.5px solid rgba(20,187,166,0.4)', borderRadius: 8, color: 'var(--accent-primary, #14BBA6)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                🖨️
              </button>
            )}
          </div>
        )}
        <PaymentPanel cart={cart.cart} total={cart.total} adjustedTotal={cart.adjustedTotal}
          effectiveTotal={cart.effectiveTotal} subtotal={cart.subtotal} iva={cart.iva}
          discount={cart.discount} ivaRate={cart.ivaRate} change={cart.change}
          payment={cart.payment} paymentMethod={cart.paymentMethod}
          useSplitPayment={cart.useSplitPayment} splitPayments={cart.splitPayments}
          setSplitPayments={cart.setSplitPayments} clientCuit={cart.clientCuit}
          setClientCuit={cart.setClientCuit} emitirFactura={cart.emitirFactura}
          setEmitirFactura={cart.setEmitirFactura} tipoFactura={cart.tipoFactura}
          setTipoFactura={cart.setTipoFactura} vueltoEnCuenta={cart.vueltoEnCuenta}
          setVueltoEnCuenta={cart.setVueltoEnCuenta} clienteVuelto={cart.clienteVuelto}
          setClienteVuelto={cart.setClienteVuelto} editingTotal={cart.editingTotal}
          setEditingTotal={cart.setEditingTotal} setAdjustedTotal={cart.setAdjustedTotal}
          setPayment={cart.setPayment} setPaymentMethod={cart.setPaymentMethod}
          setUseSplitPayment={cart.setUseSplitPayment}
          isProcessing={sales.isProcessing} setIsCharging={sales.setIsCharging}
          confirmCharge={sales.confirmCharge} isFiadoOpen={sales.isFiadoOpen}
          setIsFiadoOpen={sales.setIsFiadoOpen} lastSale={sales.lastSale}
          setShowDevolucionItems={backend.setShowDevolucionItems}
          setDevolucionQtys={backend.setDevolucionQtys}
          setIsCancelConfirm={cart.setIsCancelConfirm} searchRef={searchRef}
          autoPrint={cart.autoPrint} setAutoPrint={cart.setAutoPrint}
          saleConfirm={sales.saleConfirm}
          handleQuickAdd={cart.handleQuickAdd}
          handleRepeatSale={cart.handleRepeatSale}
          quickButtons={quickButtons} saveQuickButtons={saveQuickButtons} quickNavIndex={quickNavIndex}
          businessConfig={backend.businessConfig} setBusinessConfig={backend.setBusinessConfig} addToast={addToast}
          currentOperator={auth.currentOperator} promotionSavings={promos.promotionSavings} />
        </div>
      </div>

      <ChargeModal isCharging={sales.isCharging} setIsCharging={sales.setIsCharging}
        total={cart.total} adjustedTotal={cart.adjustedTotal} effectiveTotal={cart.effectiveTotal}
        change={cart.change} payment={cart.payment} setPayment={cart.setPayment}
        paymentMethod={cart.paymentMethod} setPaymentMethod={cart.setPaymentMethod}
        useSplitPayment={cart.useSplitPayment} setUseSplitPayment={cart.setUseSplitPayment}
        splitPayments={cart.splitPayments} setSplitPayments={cart.setSplitPayments}
        clientCuit={cart.clientCuit} setClientCuit={cart.setClientCuit}
        emitirFactura={cart.emitirFactura} setEmitirFactura={cart.setEmitirFactura}
        tipoFactura={cart.tipoFactura} setTipoFactura={cart.setTipoFactura}
        vueltoEnCuenta={cart.vueltoEnCuenta} setVueltoEnCuenta={cart.setVueltoEnCuenta}
        clienteVuelto={cart.clienteVuelto} setClienteVuelto={cart.setClienteVuelto}
        editingTotal={cart.editingTotal} setEditingTotal={cart.setEditingTotal}
        setAdjustedTotal={cart.setAdjustedTotal}
        cart={cart.cart} autoPrint={cart.autoPrint} setAutoPrint={cart.setAutoPrint}
        isProcessing={sales.isProcessing} confirmCharge={sales.confirmCharge}
        paymentRef={paymentRef}
        businessConfig={backend.businessConfig} addToast={addToast}
        currentOperator={auth.currentOperator} />

      <FiadoModal isFiadoOpen={sales.isFiadoOpen} setIsFiadoOpen={sales.setIsFiadoOpen}
        adjustedTotal={cart.adjustedTotal} total={cart.total}
        fiadoName={sales.fiadoName} setFiadoName={sales.setFiadoName}
        fiadoRef={fiadoRef} confirmFiado={sales.confirmFiado} onFiadoClose={() => backend.fetchCustomers()}
        customers={backend.customers} />

      <CancelConfirmModal isCancelConfirm={cart.isCancelConfirm} setIsCancelConfirm={cart.setIsCancelConfirm}
        clearCart={cart.clearCart} cart={cart.cart} adjustedTotal={cart.adjustedTotal}
        total={cart.total} currentOperator={auth.currentOperator} addToast={addToast} />

      <DevolucionModal showDevolucionItems={backend.showDevolucionItems}
        setShowDevolucionItems={backend.setShowDevolucionItems}
        lastSale={sales.lastSale} lastSaleId={sales.lastSaleId}
        devolucionQtys={backend.devolucionQtys} setDevolucionQtys={backend.setDevolucionQtys}
        handleDevolucionItem={backend.handleDevolucionItem} handleDevolucion={backend.handleDevolucion}
        singleUser={(backend.operators?.length || 0) <= 1} />

      <DuplicateCodeModal showDuplicateCodeModal={backend.showDuplicateCodeModal}
        setShowDuplicateCodeModal={backend.setShowDuplicateCodeModal}
        duplicateCodeMatches={backend.duplicateCodeMatches}
        setDuplicateCodeMatches={backend.setDuplicateCodeMatches}
        setCart={cart.setCart} playBeep={playBeep} searchRef={searchRef} />

      <PriceCheckModal
        showPriceCheck={backend.showPriceCheck} setShowPriceCheck={backend.setShowPriceCheck}
        priceCheckQuery={backend.priceCheckQuery} setPriceCheckQuery={backend.setPriceCheckQuery}
        priceCheckResults={backend.priceCheckResults} setPriceCheckResults={backend.setPriceCheckResults}
        productsDB={backend.productsDB}
        onAddToCart={p => cart.handleQuickAdd(p.code, p.name, p.price)} />

      {sales.lastSale && createPortal(
        <TicketPrint cart={sales.lastSale.cart} total={sales.lastSale.total} payment={sales.lastSale.payment}
          change={sales.lastSale.change} operator={auth.currentOperator?.name} ticketNumber={sales.ticketNumber}
          config={backend.businessConfig} isClosingShift={false} tipoFactura={sales.lastSale.tipoFactura} afip={sales.lastSale.afip} paymentMethod={sales.lastSale.paymentMethod || cart.paymentMethod} />,
        document.body
      )}

      {showOperatorSwitch && (
        <OperatorSwitchModal
          operators={backend.operators || []}
          onClose={() => setShowOperatorSwitch(false)}
          onConfirm={(op) => {
            auth.switchOperator(op);
            setShowOperatorSwitch(false);
            addToast(`Ahora atiende ${op.name}. La caja sigue abierta.`, 'success');
          }}
        />
      )}

      {/* F7: Modal pedido de envío */}
      {shipExit.rendered && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(11,19,43,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, ...overlayAnim(shipExit.closing) }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowShipModal(false); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--lp-paper-raised, #0d1b38)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', ...contentAnim(shipExit.closing) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--lp-ink, #e8eaf0)' }}>📦 Pedido de envío</h3>
              <button onClick={() => setShowShipModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            {/* Split por ítem: Retira / Envío */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>Ítem</span>
                <span>¿Retira o envío?</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cart.cart.map((it, i) => {
                  const esEnvio = shipItemIdxs.has(i);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, gap: 12 }}>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', flex: 1 }}>
                        {it.name} <span style={{ color: 'rgba(255,255,255,0.4)' }}>× {it.qty || it.quantity || 1}{it.unit_label && it.unit_label !== 'unidad' ? ' ' + it.unit_label : ''}</span>
                      </span>
                      <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
                        <button onClick={() => esEnvio && toggleShipItem(i)} style={{ padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, background: !esEnvio ? '#14BBA6' : 'transparent', color: !esEnvio ? '#fff' : 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
                          🏠 Retira
                        </button>
                        <button onClick={() => !esEnvio && toggleShipItem(i)} style={{ padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, background: esEnvio ? '#14BBA6' : 'transparent', color: esEnvio ? '#fff' : 'rgba(255,255,255,0.4)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', transition: 'all 0.15s' }}>
                          🚚 Envío
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'rgba(20,187,166,0.8)', textAlign: 'right' }}>
                {shipItemIdxs.size} de {cart.cart.length} ítems se envían
              </div>
            </div>

            {/* Cliente */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Cliente destinatario
              </label>
              <ClientePicker selected={shipClient} onSelect={setShipClient} />
              {shipClient?.address && (
                <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'rgba(20,187,166,0.9)' }}>📍 {shipClient.address}</div>
              )}
            </div>

            {/* Fecha programada */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Fecha de entrega (opcional)
              </label>
              <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'var(--lp-ink, #e8eaf0)', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowShipModal(false)} style={{ flex: 1, padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 700, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreateShipOrder} disabled={!shipClient || shipSaving || shipItemIdxs.size === 0}
                style={{ flex: 2, padding: '10px 16px', background: (shipClient && shipItemIdxs.size > 0) ? '#14BBA6' : 'rgba(20,187,166,0.2)', border: 'none', borderRadius: 8, color: (shipClient && shipItemIdxs.size > 0) ? '#fff' : 'rgba(20,187,166,0.5)', fontWeight: 800, cursor: (shipClient && shipItemIdxs.size > 0) ? 'pointer' : 'default', fontSize: '0.95rem' }}>
                {shipSaving ? 'Creando...' : `🚚 Crear nota (${shipItemIdxs.size} ítem${shipItemIdxs.size !== 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal de peso/volumen ─────────────────────────────────────────────────
          Aparece automáticamente cuando el cajero escanea/agrega un producto cuya
          unidad de medida es fraccionaria (kg, g, l, ml, m, etc.). Pide la cantidad
          antes de sumar el ítem al carrito.
      ──────────────────────────────────────────────────────────────────────────── */}
      {cart.pendingWeightProduct && (
        <WeightInputModal
          product={cart.pendingWeightProduct}
          onConfirm={cart.confirmWeight}
          onCancel={cart.cancelWeight}
        />
      )}
    </>
  );
}

// ── Modal de ingreso de peso/volumen ──────────────────────────────────────────
// Se monta vía portal para quedar siempre encima de todo. El input tiene
// autoFocus y acepta Enter para confirmar y Escape para cancelar.
function WeightInputModal({ product, onConfirm, onCancel }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Pequeño delay para que el portal esté en el DOM antes del focus
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const unit = product.unit_label || 'u';

  // Paso de los botones + / − según unidad
  const step = unit === 'g' || unit === 'ml' || unit === 'cc' ? 1
    : unit === 'cm' ? 1
    : 0.1; // kg, l, m, m2 → de 100g / 100ml / 10cm en 10cm

  const numVal = parseFloat(value) || 0;
  const subtotal = Math.round(numVal * product.price);

  const handleConfirm = () => {
    const qty = parseFloat(value);
    if (!qty || qty <= 0) return;
    onConfirm(qty);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  const adjustValue = (delta) => {
    setValue(prev => {
      const cur = parseFloat(prev) || 0;
      const next = Math.max(step, Math.round((cur + delta) * 1000) / 1000);
      return String(next);
    });
  };

  return createPortal(
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--bg-card)', borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '28px 32px', maxWidth: '360px', width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Encabezado */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px' }}>
            ¿Cuántos {unit}?
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {product.name}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            ${product.price.toLocaleString('es-AR')} / {unit}
          </div>
        </div>

        {/* Input grande con botones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button
            onClick={() => adjustValue(-step)}
            style={{ width: '44px', height: '44px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >−</button>

          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={inputRef}
              type="number"
              step={step}
              min={step}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKey}
              placeholder="0"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 44px 12px 16px',
                background: 'var(--bg-main)', border: '2px solid var(--accent-primary)',
                borderRadius: '10px', color: 'var(--text-primary)',
                fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', outline: 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.9rem', pointerEvents: 'none',
            }}>{unit}</span>
          </div>

          <button
            onClick={() => adjustValue(step)}
            style={{ width: '44px', height: '44px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >+</button>
        </div>

        {/* Subtotal en tiempo real */}
        <div style={{ textAlign: 'center', marginBottom: '20px', minHeight: '24px' }}>
          {numVal > 0 && (
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
              = ${subtotal.toLocaleString('es-AR')}
            </span>
          )}
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
          >Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!numVal || numVal <= 0}
            style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: numVal > 0 ? 'var(--accent-primary)' : 'rgba(20,187,166,0.2)', color: numVal > 0 ? '#fff' : 'rgba(20,187,166,0.4)', fontWeight: 800, cursor: numVal > 0 ? 'pointer' : 'default', fontSize: '0.95rem' }}
          >Agregar al carrito</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

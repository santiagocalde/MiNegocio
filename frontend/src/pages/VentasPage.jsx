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
import TicketPrint from '../components/TicketPrint';

export default function VentasPage() {
  const isMobile = useIsMobile();
  const { auth, backend, addToast, playBeep, currentSucursalId, setCurrentSucursalId, businessType } = usePanelContext();
  const ivaRate = backend.businessConfig?.iva_rate ?? 0;
  const cart = useCart(backend.productsDB, ivaRate, playBeep);
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

  useEffect(() => { cart.setPromotionSavings(promos.promotionSavings); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promos.promotionSavings]);

  const searchRef = useRef(null);
  const paymentRef = useRef(null);
  const fiadoRef = useRef(null);

  // Pedido de envío desde mostrador — con split por ítem retira/envío
  const [showShipModal, setShowShipModal] = useState(false);
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
      if (e.key === 'Escape') { cart.setSearch(''); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.cart.length]);

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
        currentSucursalId={currentSucursalId} setCurrentSucursalId={setCurrentSucursalId} />

      <div style={{ padding: isMobile ? '8px 16px' : '16px 24px', width: '100%', height: isMobile ? 'calc(100dvh - 60px)' : 'calc(100% - 72px)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : '16px', alignItems: isMobile ? 'stretch' : 'flex-start', boxSizing: 'border-box', overflowY: isMobile ? 'auto' : undefined }}>
        <div style={{ flex: isMobile ? '0 0 auto' : '2', display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '16px', minHeight: 0, height: isMobile ? 'auto' : '100%', maxHeight: isMobile ? '55vh' : undefined }}>
          <div data-tour="search-bar" style={{ width: '100%', flexShrink: 0 }}>
          <SearchBar search={cart.search} setSearch={cart.setSearch} searchRef={searchRef}
            searchError={cart.searchError} flash={cart.flash}
            productsDB={backend.productsDB} handleQuickAdd={cart.handleQuickAdd}
            setShowPriceCheck={backend.setShowPriceCheck} addToast={addToast}
            listType={cart.listType}
            handleEmptyEnter={() => { if (cart.cart.length > 0) sales.setIsCharging(true); }} />
          </div>
          <div data-tour="cart-panel" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CartPanel cart={cart.cart} total={cart.total} adjustedTotal={cart.adjustedTotal}
            updateQty={cart.updateQty} setItemQty={cart.setItemQty} removeItem={cart.removeItem}
            setItemPrice={cart.setItemPrice}
            setItemList={cart.setItemList}
            priceLists={priceLists}
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
        handleDevolucionItem={backend.handleDevolucionItem} handleDevolucion={backend.handleDevolucion} />

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

      {/* F7: Modal pedido de envío */}
      {showShipModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(11,19,43,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowShipModal(false); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--lp-paper-raised, #0d1b38)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
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
                        {it.name} <span style={{ color: 'rgba(255,255,255,0.4)' }}>× {it.qty || it.quantity || 1}</span>
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
    </>
  );
}

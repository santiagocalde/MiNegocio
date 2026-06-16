import React, { useEffect, useRef } from 'react';
import useCart from '../hooks/useCart';
import useSales from '../hooks/useSales';
import usePromotions from '../hooks/usePromotions';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import TopBar from '../components/pos/TopBar';
import SearchBar from '../components/pos/SearchBar';
import CartPanel from '../components/pos/CartPanel';
import PaymentPanel from '../components/pos/PaymentPanel';
import ChargeModal from '../components/pos/ChargeModal';
import FiadoModal from '../components/pos/FiadoModal';
import CancelConfirmModal from '../components/pos/CancelConfirmModal';
import DevolucionModal from '../components/pos/DevolucionModal';
import DuplicateCodeModal from '../components/pos/DuplicateCodeModal';
import TicketPrint from '../components/TicketPrint';

export default function VentasPage() {
  const { auth, backend, addToast, playBeep, currentSucursalId, setCurrentSucursalId } = usePanelContext();
  const cart = useCart(backend.productsDB, 21);
  const promos = usePromotions(cart.cart);

  useEffect(() => { cart.setPromotionSavings(promos.promotionSavings); }, [promos.promotionSavings]);

  const searchRef = useRef(null);
  const paymentRef = useRef(null);
  const fiadoRef = useRef(null);

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
    backend.mpPaymentStatus, addToast
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'F8') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F9') { e.preventDefault(); if (cart.cart.length > 0) sales.setIsCharging(true); }
      if (e.key === 'F4') { e.preventDefault(); sales.setIsFiadoOpen(true); }
      if (e.key === 'F7' || e.key === 'Delete') { e.preventDefault(); cart.setCart(prev => prev.slice(0, -1)); }
      if (e.key === 'F6') { e.preventDefault(); backend.setShowHelp(true); }
      if (e.key === 'F10') { e.preventDefault(); if (cart.cart.length > 0) cart.setIsCancelConfirm(true); }
      if (e.key === 'Escape') { cart.setSearch(''); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cart.cart.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        if (cart.cart.length > 0) {
          const lastId = cart.cart[cart.cart.length - 1].id;
          document.getElementById(`qty-input-${lastId}`)?.focus();
          document.getElementById(`qty-input-${lastId}`)?.select();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.cart]);

  useEffect(() => {
    if (!backend.mpIntentId || backend.mpPaymentStatus === 'approved') return;
    const checkStatus = async () => {
      try {
        const res = await apiGet(`/mercadopago/payment-status/${backend.mpIntentId}`);
        if (res.ok) { const data = await res.json(); if (data.status === 'approved') backend.setMpPaymentStatus('approved'); }
      } catch (e) { console.error(e) }
    };
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [backend.mpIntentId, backend.mpPaymentStatus]);

  return (
    <>
      <TopBar currentOperator={auth.currentOperator} sucursales={backend.sucursales}
        currentSucursalId={currentSucursalId} setCurrentSucursalId={setCurrentSucursalId}
        backendStatus={backend.backendStatus} addToast={addToast} setShowHelp={backend.setShowHelp} />

      <div style={{ padding: '16px 24px', width: '100%', height: 'calc(100% - 72px)', display: 'flex', gap: '16px', alignItems: 'flex-start', boxSizing: 'border-box' }}>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
          <SearchBar search={cart.search} setSearch={cart.setSearch} searchRef={searchRef}
            searchError={cart.searchError} flash={cart.flash}
            productsDB={backend.productsDB} handleQuickAdd={cart.handleQuickAdd}
            setShowPriceCheck={backend.setShowPriceCheck} addToast={addToast}
            handleEmptyEnter={() => { if (cart.cart.length > 0) sales.setIsCharging(true); }} />
          <CartPanel cart={cart.cart} total={cart.total} adjustedTotal={cart.adjustedTotal}
            updateQty={cart.updateQty} setItemQty={cart.setItemQty} removeItem={cart.removeItem} />
        </div>
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
          mpQrData={backend.mpQrData} setMpQrData={backend.setMpQrData}
          mpPaymentUrl={backend.mpPaymentUrl} setMpPaymentUrl={backend.setMpPaymentUrl}
          mpLoading={backend.mpLoading} setMpLoading={backend.setMpLoading}
          mpPaymentStatus={backend.mpPaymentStatus} setMpPaymentStatus={backend.setMpPaymentStatus}
          setMpIntentId={backend.setMpIntentId}
          businessConfig={backend.businessConfig} addToast={addToast}
          currentOperator={auth.currentOperator} promotionSavings={promos.promotionSavings} />
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
        mpQrData={backend.mpQrData} setMpQrData={backend.setMpQrData}
        mpPaymentUrl={backend.mpPaymentUrl} setMpPaymentUrl={backend.setMpPaymentUrl}
        mpLoading={backend.mpLoading} setMpLoading={backend.setMpLoading}
        mpPaymentStatus={backend.mpPaymentStatus} setMpPaymentStatus={backend.setMpPaymentStatus}
        setMpIntentId={backend.setMpIntentId}
        businessConfig={backend.businessConfig} addToast={addToast}
        currentOperator={auth.currentOperator} />

      <FiadoModal isFiadoOpen={sales.isFiadoOpen} setIsFiadoOpen={sales.setIsFiadoOpen}
        adjustedTotal={cart.adjustedTotal} total={cart.total}
        fiadoName={sales.fiadoName} setFiadoName={sales.setFiadoName}
        fiadoRef={fiadoRef} confirmFiado={sales.confirmFiado} />

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

      {sales.lastSale && (
        <TicketPrint cart={sales.lastSale.cart} total={sales.lastSale.total} payment={sales.lastSale.payment}
          change={sales.lastSale.change} operator={auth.currentOperator?.name} ticketNumber={sales.ticketNumber}
          config={backend.businessConfig} isClosingShift={false} tipoFactura={sales.lastSale.tipoFactura} afip={sales.lastSale.afip} paymentMethod={sales.lastSale.paymentMethod || cart.paymentMethod} />
      )}
    </>
  );
}

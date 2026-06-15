import React from 'react';
import { Icons } from '../ui/Icons';
import { apiPost } from '../../services/apiClient';

export default function PaymentPanel({
  cart, total, adjustedTotal, effectiveTotal, subtotal, iva, discount, ivaRate, change, payment, paymentMethod,
  useSplitPayment, splitPayments, setSplitPayments, clientCuit, setClientCuit,
  emitirFactura, setEmitirFactura, tipoFactura, setTipoFactura,
  vueltoEnCuenta, setVueltoEnCuenta, clienteVuelto, setClienteVuelto,
  editingTotal, setEditingTotal, setAdjustedTotal,
  setPayment, setPaymentMethod, setUseSplitPayment,
  isProcessing, setIsCharging, confirmCharge,
  isFiadoOpen, setIsFiadoOpen, lastSale,
  setShowDevolucionItems, setDevolucionQtys,
  setIsCancelConfirm, searchRef,
  autoPrint, setAutoPrint,
  saleConfirm,
  mpQrData, setMpQrData, mpPaymentUrl, setMpPaymentUrl,
  mpLoading, setMpLoading, mpPaymentStatus, setMpPaymentStatus, setMpIntentId,
  businessConfig, addToast, currentOperator,
  promotionSavings
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 2px 0', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Cliente</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Selecciona el cliente para la venta</p>
        </div>
        <select style={{ width: '100%', height: '48px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 16px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
          <option>Consumidor Final</option>
          <option>Cliente Frecuente</option>
        </select>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Resumen</h2>
          <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>{cart.length} items</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          <span>Subtotal:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        {iva > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            <span>IVA ({ivaRate}%):</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.95rem', color: 'var(--accent-success)' }}>
            <span>{promotionSavings > 0 ? 'Descuento + Promo:' : 'Descuento:'}</span>
            <span style={{ fontWeight: 600 }}>-${discount.toLocaleString('es-AR')}</span>
          </div>
        )}

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '12px 0' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>
          <span>Total:</span>
          <span>${(adjustedTotal ?? total).toLocaleString('es-AR')}</span>
        </div>

        <button
          onClick={() => setIsCharging(true)}
          disabled={cart.length === 0 || isProcessing}
          style={{ width: '100%', background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '18px 16px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 800, cursor: cart.length === 0 ? 'not-allowed' : 'pointer', opacity: cart.length === 0 ? 0.5 : 1, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: cart.length === 0 ? 'none' : '0 8px 24px rgba(20,187,166,0.3)' }}
        >
          <Icons.Check /> {isProcessing ? 'Procesando...' : 'Procesar Venta (Doble Enter)'}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <button style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: '12px', borderRadius: '12px', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.05)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.02)'} onClick={() => setIsFiadoOpen(true)}>
            % Gestionar Extras
          </button>
          {lastSale && (
            <button style={{ width: '100%', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: '12px', borderRadius: '12px', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(239,68,68,0.05)'} onClick={() => { setDevolucionQtys({}); setShowDevolucionItems(true); }}>
              ↩ Devolver ítems (última venta)
            </button>
          )}
          {cart.length > 0 && (
            <button style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: '8px' }} onClick={() => setIsCancelConfirm(true)}>
              Anular Venta (F12)
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: '0', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(30,58,95,0.1)' }} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='none'} onClick={() => searchRef.current?.focus()}>
          <div style={{ background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 800, fontSize: '0.8rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-block', marginBottom: '8px' }}>F8</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Buscar Producto</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1, textAlign: 'center', cursor: cart.length > 0 ? 'pointer' : 'not-allowed', opacity: cart.length > 0 ? 1 : 0.5, transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(30,58,95,0.1)' }} onMouseEnter={e=>{if(cart.length>0)e.currentTarget.style.transform='translateY(-2px)'}} onMouseLeave={e=>e.currentTarget.style.transform='none'} onClick={() => { if(cart.length > 0) setIsCharging(true); }}>
          <div style={{ background: 'var(--gradient-primary)', color: 'white', fontWeight: 800, fontSize: '0.8rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-block', marginBottom: '8px' }}>F9</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Cobrar Venta</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1, textAlign: 'center', cursor: cart.length > 0 ? 'pointer' : 'not-allowed', opacity: cart.length > 0 ? 1 : 0.5, transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(30,58,95,0.1)' }} onMouseEnter={e=>{if(cart.length>0)e.currentTarget.style.transform='translateY(-2px)'}} onMouseLeave={e=>e.currentTarget.style.transform='none'} onClick={() => { if(cart.length > 0) setIsCancelConfirm(true); }}>
          <div style={{ background: 'var(--accent-danger)', color: 'white', fontWeight: 800, fontSize: '0.8rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-block', marginBottom: '8px' }}>F10</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Anular Ticket</div>
        </div>
      </div>

      <div style={{ marginTop: '0', display: 'flex', justifyContent: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} style={{ width: '16px', height: '16px' }} />
          Imprimir ticket automáticamente tras cobrar
        </label>
      </div>

      {saleConfirm && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(34, 197, 94, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '16px' }}>
          <div style={{ background: 'white', color: 'var(--accent-success)', borderRadius: '50%', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Icons.Check />
          </div>
          <h2 style={{ fontSize: '3rem', color: 'white', fontWeight: 800 }}>¡VENTA OK!</h2>
          <p style={{ fontSize: '1.5rem', color: 'white', opacity: 0.9, marginTop: 16 }}>Imprimiendo ticket...</p>
        </div>
      )}
    </div>
  );
}

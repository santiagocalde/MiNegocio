import React from 'react';
import { apiPost } from '../../services/apiClient';
import { Icons } from '../ui/Icons';

const PAYMENT_METHODS = [
  { key: 'efectivo', label: 'Efectivo', Icon: Icons.CashIcon },
  { key: 'tarjeta', label: 'Tarjeta', Icon: Icons.CardIcon },
  { key: 'transferencia', label: 'Transferencia', Icon: Icons.BankIcon },
  { key: 'mercadopago', label: 'QR M.Pago', Icon: Icons.QRIcon },
];

export default function ChargeModal({
  isCharging, setIsCharging,
  total, adjustedTotal, effectiveTotal, change,
  payment, setPayment, paymentMethod, setPaymentMethod,
  useSplitPayment, setUseSplitPayment,
  splitPayments, setSplitPayments,
  clientCuit, setClientCuit,
  emitirFactura, setEmitirFactura, tipoFactura, setTipoFactura,
  vueltoEnCuenta, setVueltoEnCuenta, clienteVuelto, setClienteVuelto,
  editingTotal, setEditingTotal, setAdjustedTotal,
  cart, autoPrint, setAutoPrint,
  isProcessing,
  confirmCharge, paymentRef,
  mpQrData, setMpQrData, mpPaymentUrl, setMpPaymentUrl,
  mpLoading, setMpLoading, mpPaymentStatus, setMpPaymentStatus, setMpIntentId,
  businessConfig, addToast, currentOperator
}) {
  if (!isCharging) return null;

  const finalTotal = adjustedTotal ?? total;
  const isConfirmDisabled = (!useSplitPayment && paymentMethod === 'efectivo' && change < 0) || isProcessing || (paymentMethod === 'mercadopago' && mpPaymentStatus !== 'approved') || (useSplitPayment && splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) < finalTotal);

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,58,95,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000 }} role="dialog" aria-modal="true">
      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(30,58,95, 0.5)' }}>
        
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Procesar Venta</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.95rem' }}>Confirme el método de pago e importe</p>
          </div>
          <button onClick={() => { if(!isProcessing) setIsCharging(false); }} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s' }}><Icons.X /></button>
        </div>

        {/* 2-Column Layout */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left Column: Cart Summary */}
          <div style={{ width: '40%', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'rgba(30,58,95,0.1)' }}>
            <div style={{ padding: '20px 24px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Resumen ({cart?.length || 0} ítems)</div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
              {cart?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1, paddingRight: '16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.2' }}>{item.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>{item.qty} x ${(item.price || 0).toLocaleString('es-AR', {minimumFractionDigits:2})}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>${((item.price || 0) * item.qty).toLocaleString('es-AR', {minimumFractionDigits:2})}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '24px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>TOTAL A PAGAR</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', lineHeight: '1' }}>${finalTotal.toLocaleString('es-AR')}</div>
              </div>
            </div>
          </div>

          {/* Right Column: Payments */}
          <div style={{ width: '60%', padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Payment Method Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Método de Pago</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => { setPaymentMethod(m.key); setUseSplitPayment(false); if (m.key !== 'efectivo') setPayment(String(finalTotal)); setTimeout(() => { if (m.key === 'efectivo') paymentRef?.current?.focus(); }, 100); }}
                    style={{
                      padding: '16px', borderRadius: '12px', border: '2px solid',
                      borderColor: !useSplitPayment && paymentMethod === m.key ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: !useSplitPayment && paymentMethod === m.key ? 'rgba(20,187,166, 0.08)' : 'var(--bg-card)',
                      color: !useSplitPayment && paymentMethod === m.key ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontWeight: 700, cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center'
                    }}
                  >
                    <span style={{ width: 24, height: 24, color: 'currentColor' }}><m.Icon /></span> {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dinero Recibido (Sólo Efectivo) */}
            {paymentMethod === 'efectivo' && (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>¿Con cuánto paga? (Ingresa monto + Enter)</label>
                <input 
                  ref={paymentRef} 
                  type="number" 
                  value={payment} 
                  onChange={e => setPayment(e.target.value)} 
                  autoFocus 
                  onKeyDown={e => { if (e.key === 'Enter' && change >= 0 && !isConfirmDisabled) confirmCharge(); }} 
                  style={{ width: '100%', background: 'var(--bg-main)', border: '2px solid var(--accent-primary)', color: 'var(--text-primary)', borderRadius: '12px', padding: '16px', fontSize: '2rem', fontFamily: 'var(--font-mono)', textAlign: 'center', outline: 'none', marginBottom: '16px', boxShadow: '0 0 0 4px rgba(20,187,166, 0.1)' }}
                />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>VUELTO:</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: change < 0 ? 'var(--accent-danger)' : 'var(--accent-success)', fontFamily: 'var(--font-mono)' }}>
                    ${change < 0 ? 'Falta dinero' : change.toLocaleString('es-AR')}
                  </div>
                </div>
              </div>
            )}

            {/* Mercado Pago QR */}
            {paymentMethod === 'mercadopago' && (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                {mpQrData ? (
                  <div style={{ display: 'inline-block', padding: '16px', background: 'white', borderRadius: '16px' }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mpQrData)}`} alt="QR" style={{ width: 200, height: 200, opacity: mpPaymentStatus === 'approved' ? 0.3 : 1 }} />
                    {mpPaymentStatus === 'approved' && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#10B981', fontSize: '2rem', fontWeight: 900 }}>✅ PAGADO</div>}
                  </div>
                ) : (
                  <button onClick={async () => {
                    setMpLoading(true); setMpPaymentStatus('pending');
                    try {
                      const res = await apiPost('/mercadopago/create-payment', { total: effectiveTotal, description: `Venta` });
                      if (res.ok) { const data = await res.json(); setMpQrData(data.qr_data); if(data.intent_id) setMpIntentId(data.intent_id); } else { addToast?.('Error al generar QR de MercadoPago.', 'error'); }
                    } catch { addToast?.('Error de conexión con MercadoPago.', 'error'); } setMpLoading(false);
                  }} style={{ background: '#009EE3', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer' }}>Generar QR Oficial MP</button>
                )}
              </div>
            )}

            {/* Configs Opcionales (Ticket) */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <input type="checkbox" checked={autoPrint || false} onChange={e => setAutoPrint?.(e.target.checked)} style={{ width: '24px', height: '24px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}><Icons.Printer /> Imprimir Ticket Fisico (Opcional)</span>
              </label>

              {/* Botonera de Acción Final */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={() => setIsCharging(false)} style={{ flex: 1, padding: '20px', background: 'transparent', border: '2px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                  Cancelar (Esc)
                </button>
                <button 
                  onClick={confirmCharge} 
                  disabled={isConfirmDisabled}
                  style={{ flex: 2, padding: '20px', background: isConfirmDisabled ? 'var(--bg-hover)' : 'var(--gradient-primary)', color: isConfirmDisabled ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 800, cursor: isConfirmDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: isConfirmDisabled ? 'none' : '0 10px 25px -5px rgba(20,187,166, 0.4)' }}>
                  {isProcessing ? 'PROCESANDO...' : 'PROCESAR VENTA (Enter)'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import useIsMobile from '../../hooks/useIsMobile';
import { Icons } from '../ui/Icons';

const PAYMENT_METHODS = [
  { key: 'efectivo',       label: 'Efectivo',       Icon: Icons.CashIcon },
  { key: 'tarjeta',        label: 'Tarjeta Débito', Icon: Icons.CardIcon },
  { key: 'transferencia',  label: 'Transferencia',  Icon: Icons.BankIcon },
];

export default function ChargeModal({
  isCharging, setIsCharging,
  total, adjustedTotal, change,
  payment, setPayment, paymentMethod, setPaymentMethod,
  useSplitPayment, setUseSplitPayment,
  splitPayments,
  cart, autoPrint, setAutoPrint,
  isProcessing,
  confirmCharge, paymentRef,
  businessConfig
}) {
  const finalTotal = adjustedTotal ?? total;
  const isConfirmDisabled =
    (!useSplitPayment && paymentMethod === 'efectivo' && (payment === '' || change < 0)) ||
    isProcessing ||
    (useSplitPayment && splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) < finalTotal);

  const transferAlias = businessConfig?.catalogo_whatsapp || businessConfig?.mp_collector_id || null;
  const isMobile = useIsMobile();

  // El hook debe llamarse SIEMPRE (antes de cualquier return) para no violar las Reglas de Hooks
  useEffect(() => {
    if (!isCharging) return;
    const handler = (e) => {
      if (e.key === 'Escape') { setIsCharging(false); return; }
      if (e.key === 'Enter' && !isConfirmDisabled) { e.preventDefault(); confirmCharge(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCharging, isConfirmDisabled, confirmCharge, setIsCharging]);

  if (!isCharging) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,58,95,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000 }} role="dialog" aria-modal="true">
      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(30,58,95, 0.5)' }}>
        
        {/* Header */}
        <div style={{ padding: isMobile ? '16px' : '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
          <div>
            <h2 style={{ fontSize: isMobile ? '1.2rem' : '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Procesar Venta</h2>
            {!isMobile && <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.95rem' }}>Confirme el método de pago e importe</p>}
          </div>
          <button onClick={() => { if(!isProcessing) setIsCharging(false); }} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '50%', width: isMobile ? '44px' : '36px', height: isMobile ? '44px' : '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s' }}><Icons.X /></button>
        </div>

        {/* 2-Column Layout */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>
          
          {/* Left Column: Cart Summary */}
          <div style={{ width: isMobile ? '0' : '40%', minWidth: isMobile ? 0 : undefined, borderRight: isMobile ? 'none' : '1px solid var(--border-color)', display: isMobile ? 'none' : 'flex', flexDirection: 'column', background: 'rgba(30,58,95,0.1)' }}>
            <div style={{ padding: '20px 24px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Resumen ({cart?.length || 0} ítems)</div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
              {cart?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1, paddingRight: '16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.2' }}>{item.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: '4px' }}>{item.qty} x ${(item.price || 0).toLocaleString('es-AR', {minimumFractionDigits:2})}</div>
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
          <div style={{ width: isMobile ? '100%' : '60%', padding: isMobile ? '14px' : '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '24px' }}>
            
            {/* Payment Method Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Método de Pago</label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '8px' : '12px' }}>
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => { setPaymentMethod(m.key); setUseSplitPayment(false); if (m.key !== 'efectivo') setPayment(String(finalTotal)); setTimeout(() => { if (m.key === 'efectivo') paymentRef?.current?.focus(); }, 100); }}
                    style={{
                      padding: isMobile ? '12px' : '16px', borderRadius: '12px', border: '2px solid',
                      borderColor: !useSplitPayment && paymentMethod === m.key ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: !useSplitPayment && paymentMethod === m.key ? 'rgba(20,187,166, 0.08)' : 'var(--bg-card)',
                      color: !useSplitPayment && paymentMethod === m.key ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center'
                    }}
                  >
                    <span style={{ width: 24, height: 24, color: 'currentColor' }}><m.Icon /></span> {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Efectivo */}
            {paymentMethod === 'efectivo' && (
              <div style={{ background: 'var(--bg-card)', padding: isMobile ? '14px' : '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>¿Con cuánto paga? (Ingresa monto + Enter)</label>
                <input 
                  ref={paymentRef} 
                  type="number" 
                  value={payment} 
                  onChange={e => setPayment(e.target.value)} 
                  autoFocus 
                  onKeyDown={e => { if (e.key === 'Enter' && change >= 0 && !isConfirmDisabled) confirmCharge(); e.stopPropagation(); }} 
                  style={{ width: '100%', background: 'var(--bg-main)', border: '2px solid var(--accent-primary)', color: 'var(--text-primary)', borderRadius: '12px', padding: '16px', fontSize: isMobile ? '1.5rem' : '2rem', fontFamily: 'var(--font-mono)', textAlign: 'center', outline: 'none', marginBottom: isMobile ? '12px' : '16px', boxShadow: '0 0 0 4px rgba(20,187,166, 0.1)' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  <button onClick={() => setPayment(finalTotal.toString())} style={{ flex: '1 0 auto', minHeight: '44px', padding: '8px 12px', background: 'var(--accent-success)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: 'var(--fs-body)', cursor: 'pointer' }}>Pago Exacto</button>
                  {[1000, 2000, 5000, 10000, 20000].map(bill => (
                    <button key={bill} onClick={() => setPayment(p => (parseFloat(p || 0) + bill).toString())} style={{ flex: '1 0 auto', minHeight: '44px', padding: '8px 10px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                      +${bill.toLocaleString('es-AR')}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>VUELTO:</span>
                  <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 800, color: change < 0 ? 'var(--accent-danger)' : 'var(--accent-success)', fontFamily: 'var(--font-mono)' }}>
                    {change < 0 ? 'Falta dinero' : `$${change.toLocaleString('es-AR')}`}
                  </div>
                </div>
              </div>
            )}

            {/* Transferencia - muestra alias */}
            {paymentMethod === 'transferencia' && (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(20,187,166,0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Datos para Transferencia</div>
                {transferAlias ? (
                  <>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Alias / CBU</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '2px', background: 'rgba(20,187,166,0.08)', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(20,187,166,0.3)' }}>
                      {transferAlias}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '12px' }}>
                      Podés editar tu alias en Configuración → Datos del negocio
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    <p>⚠️ No tenés un alias configurado.</p>
                    <p>Andá a <strong style={{ color: 'var(--accent-primary)' }}>Configuración → Datos del negocio</strong> para agregar tu alias o CBU.</p>
                  </div>
                )}
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(20,187,166,0.06)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Total a transferir: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>${finalTotal.toLocaleString('es-AR')}</strong>
                </div>
              </div>
            )}

            {/* Tarjeta débito */}
            {paymentMethod === 'tarjeta' && (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '8px' }}>💳</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Pasá la tarjeta por el posnet</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>${finalTotal.toLocaleString('es-AR')}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Confirmá el pago en el posnet y luego presioná "Procesar Venta"</div>
              </div>
            )}

            {/* Configs Opcionales (Ticket) */}
            <div style={{ marginTop: isMobile ? '8px' : 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <input type="checkbox" checked={autoPrint || false} onChange={e => setAutoPrint?.(e.target.checked)} style={{ width: '24px', height: '24px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}><Icons.Printer /> Imprimir Ticket Físico (Opcional)</span>
              </label>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={() => setIsCharging(false)} style={{ flex: 1, padding: isMobile ? '14px' : '20px', background: 'transparent', border: '2px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                  Cancelar (Esc)
                </button>
                <button 
                  onClick={confirmCharge} 
                  disabled={isConfirmDisabled}
                  style={{ flex: 2, padding: isMobile ? '14px' : '20px', background: isConfirmDisabled ? 'var(--bg-hover)' : 'var(--gradient-primary)', color: isConfirmDisabled ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 800, cursor: isConfirmDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: isConfirmDisabled ? 'none' : '0 10px 25px -5px rgba(20,187,166, 0.4)' }}>
                  {isProcessing ? 'PROCESANDO...' : 'PROCESAR VENTA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

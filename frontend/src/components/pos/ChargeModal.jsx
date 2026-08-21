import { useEffect, useRef, useState } from 'react';
import useIsMobile from '../../hooks/useIsMobile';
import useModalExit from '../../hooks/useModalExit';
import { Icons } from '../ui/Icons';
import MpQrFijoCobro from './MpQrFijoCobro';

const PAYMENT_METHODS = [
  { key: 'efectivo',       label: 'Efectivo',      Icon: Icons.CashIcon },
  { key: 'tarjeta',        label: 'Tarjeta',       Icon: Icons.CardIcon },
  { key: 'transferencia',  label: 'Transferencia', Icon: Icons.BankIcon },
  { key: 'mercadopago',    label: 'QR',            Icon: Icons.QRIcon },
];

const SPLIT_METHODS = [
  { key: 'efectivo',       label: 'Efectivo' },
  { key: 'tarjeta',        label: 'Tarjeta' },
  { key: 'transferencia',  label: 'Transferencia' },
  { key: 'mercadopago',    label: 'QR' },
];

const QUICK_AMOUNT_IDS = ['qa-btn-exacto', 'qa-btn-1000', 'qa-btn-2000', 'qa-btn-5000', 'qa-btn-10000', 'qa-btn-20000'];

export default function ChargeModal({
  isCharging, setIsCharging,
  total, adjustedTotal, change,
  payment, setPayment, paymentMethod, setPaymentMethod,
  useSplitPayment, setUseSplitPayment,
  splitPayments, setSplitPayments,
  cart, autoPrint, setAutoPrint,
  isProcessing,
  confirmCharge, paymentRef,
  businessConfig, addToast
}) {
  const finalTotal = adjustedTotal ?? total;
  const splitSum = splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const transferAlias = businessConfig?.mp_collector_id || businessConfig?.catalogo_whatsapp || null;
  const isMobile = useIsMobile();

  // Auto-confirmación de MP: solo si el negocio la activó y cargó su token.
  const mpAutoConfirm =
    [1, '1', true, 'true'].includes(businessConfig?.mp_auto_confirm) &&
    !!businessConfig?.mp_access_token_set;
  // Con MP auto-confirmado, "Procesar Venta" queda BLOQUEADO hasta que el pago
  // entre; la alerta de MpQrCobro (onPaid) lo desbloquea (setMpPaid).
  const [mpPaid, setMpPaid] = useState(false);
  // La caja QR automática puede no estar configurada: en ese caso caemos al QR
  // manual y NO bloqueamos "Procesar Venta" (configurarla es opcional).
  const [mpFijoError, setMpFijoError] = useState(false);
  const mpWaiting = !useSplitPayment && paymentMethod === 'mercadopago' && mpAutoConfirm && !mpFijoError && !mpPaid;

  const isConfirmDisabled =
    (!useSplitPayment && paymentMethod === 'efectivo' && (payment === '' || change < 0)) ||
    isProcessing ||
    (useSplitPayment && (splitSum < finalTotal - 0.01 || splitSum > finalTotal + 0.01)) ||
    mpWaiting;

  // Cerrar el modal (reseteando el pago mixto) sin tocar el carrito.
  // Blindaje: si el cliente YA pagó por QR y no se cerró la venta, pedir
  // confirmación fuerte para no perder un pago (el caso "cancela sin querer").
  const cancelCharge = () => {
    if (isProcessing) return;
    if (mpPaid && !window.confirm(
      `⚠️ El cliente YA PAGÓ $${Number(finalTotal).toLocaleString('es-AR')} por QR.\n\n` +
      `Si cerrás ahora, la venta NO queda registrada. ¿Cancelar igual?`)) return;
    setIsCharging(false);
    setUseSplitPayment?.(false);
    setSplitPayments?.([{ method: 'efectivo', amount: '' }]);
    setPayment?.('');
  };

  // Compartida entre el click y la navegación por flechas del método de pago.
  const selectPaymentMethod = (key) => {
    setPaymentMethod(key);
    setUseSplitPayment(false);
    if (key !== 'efectivo') setPayment(String(finalTotal));
    setTimeout(() => { if (key === 'efectivo') paymentRef?.current?.focus(); }, 100);
  };

  // Ref con el estado más reciente para que el listener global lea siempre
  // valores frescos sin tener que re-suscribirse en cada render.
  const kbRef = useRef({});
  kbRef.current = { paymentMethod, useSplitPayment, isConfirmDisabled, confirmCharge, cancelCharge, selectPaymentMethod, mpPaid, isMobile };

  // Un único listener de teclado para todo el modal (Reglas de Hooks: se
  // llama SIEMPRE, antes de cualquier return).
  useEffect(() => {
    if (!isCharging) return;
    const handler = (e) => {
      const s = kbRef.current;
      const active = document.activeElement;
      const tag = active?.tagName;
      const inTextField = tag === 'INPUT' || tag === 'TEXTAREA';
      const inSplitArea = !!active?.closest?.('[data-split-area]');
      const onBillBtn = active?.dataset?.billnav === '1';

      if (e.key === 'Escape') { s.cancelCharge(); return; }

      if (e.key === 'Enter') {
        // Sobre un botón, dejamos que Espacio lo active — Enter no debe
        // activar el botón Y procesar la venta a la vez.
        if (tag === 'BUTTON') return;
        if (!s.isConfirmDisabled) { e.preventDefault(); s.confirmCharge(); }
        return;
      }

      // Flechas → cambian el método de pago respetando la GRILLA en la que se
      // ven los botones (2 columnas en desktop, 1 en mobile): ← → se mueven de a
      // uno dentro de la fila, ↑ ↓ saltan de fila. Así "bajar" de Efectivo lleva
      // a Transferencia (el de abajo), no a Tarjeta (el de al lado).
      // Excepciones: pago mixto (el <select> navega solo) y los botones de billete.
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (inSplitArea || onBillBtn) return;
        // En un campo de texto distinto al de efectivo, dejar el cursor. En el
        // de efectivo sí interceptamos (un solo número, el cursor no importa y
        // así se puede cambiar de método sin sacar la mano del teclado).
        if (inTextField && active !== paymentRef?.current) return;
        if (s.mpPaid) return; // método bloqueado tras cobrar QR
        e.preventDefault();
        const cols = s.isMobile ? 1 : 2;
        const idx = PAYMENT_METHODS.findIndex(m => m.key === s.paymentMethod);
        if (idx === -1) return;
        let next = idx;
        if (e.key === 'ArrowRight') next = idx + 1;
        else if (e.key === 'ArrowLeft') next = idx - 1;
        else if (e.key === 'ArrowDown') next = idx + cols;
        else if (e.key === 'ArrowUp') next = idx - cols;
        if (next < 0 || next >= PAYMENT_METHODS.length) return; // fuera de la grilla
        // ← → no deben saltar de fila (en 2 columnas): si cambia la fila, no move.
        if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && Math.floor(next / cols) !== Math.floor(idx / cols)) return;
        s.selectPaymentMethod(PAYMENT_METHODS[next].key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCharging]);

  // Navegación por flechas SOLO entre los botones de "monto rápido" (billetes):
  // mueve el foco sin activar. Se activan con Espacio o clic (Enter queda
  // desactivado a propósito: evita sumar de más o disparar la venta por
  // reflejo tras navegar).
  const arrowNavBills = (e, ids) => {
    if (e.key === 'Enter') { e.preventDefault(); return; }
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const idx = ids.indexOf(e.currentTarget.id);
    if (idx === -1) return;
    const nextId = ids[(idx + dir + ids.length) % ids.length];
    document.getElementById(nextId)?.focus();
  };

  // Resetear el estado de pago QR SOLO al abrir/cerrar el modal (una venta nueva
  // arranca sin pago). El método queda bloqueado una vez pagado, así que no hace
  // falta resetear al cambiarlo.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMpPaid(false); setMpFijoError(false); }, [isCharging]);

  const { rendered, closing } = useModalExit(isCharging);
  if (!rendered) return null;

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={cancelCharge} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,58,95,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000 }} role="dialog" aria-modal="true">
      <div className={closing ? 'closing' : ''} onClick={e => e.stopPropagation()} style={{ animation: closing ? 'modalContentOut 0.16s cubic-bezier(0.4, 0, 1, 1) forwards' : 'modalContentIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(30,58,95, 0.5)' }}>
        
        {/* Header */}
        <div style={{ padding: isMobile ? '16px' : '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
          <div>
            <h2 style={{ fontSize: isMobile ? '1.2rem' : '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Procesar Venta</h2>
            {!isMobile && <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.95rem' }}>Confirme el método de pago e importe</p>}
          </div>
          <button onClick={cancelCharge} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '50%', width: isMobile ? '44px' : '36px', height: isMobile ? '44px' : '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s' }}><Icons.X /></button>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Método de Pago</label>
                <button
                  onClick={() => setUseSplitPayment(!useSplitPayment)}
                  disabled={mpPaid}
                  aria-pressed={useSplitPayment}
                  title="Activar pago mixto"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', background: useSplitPayment ? 'rgba(20,187,166,0.12)' : 'var(--bg-hover)',
                    border: `1px solid ${useSplitPayment ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: '999px', padding: isMobile ? '6px 10px' : '8px 14px', cursor: mpPaid ? 'not-allowed' : 'pointer',
                    color: useSplitPayment ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s', opacity: mpPaid ? 0.5 : 1,
                  }}
                >
                  <span style={{ width: 30, height: 16, borderRadius: '999px', position: 'relative', flexShrink: 0, background: useSplitPayment ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: 2, left: useSplitPayment ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </span>
                  Pago Mixto
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '8px' : '12px' }}>
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.key}
                    disabled={mpPaid}
                    onClick={() => selectPaymentMethod(m.key)}
                    style={{
                      padding: isMobile ? '12px' : '16px', borderRadius: '12px', border: '2px solid',
                      borderColor: !useSplitPayment && paymentMethod === m.key ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: !useSplitPayment && paymentMethod === m.key ? 'rgba(20,187,166, 0.08)' : 'var(--bg-card)',
                      color: !useSplitPayment && paymentMethod === m.key ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontWeight: 700, cursor: mpPaid ? 'not-allowed' : 'pointer', fontSize: '0.95rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', opacity: mpPaid && paymentMethod !== m.key ? 0.45 : 1
                    }}
                  >
                    <span style={{ width: 24, height: 24, color: 'currentColor' }}><m.Icon /></span> {m.label}
                  </button>
                ))}
              </div>
              <p style={{ margin: '6px 2px 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>Flechas ← → ↑ ↓ para cambiar de método</p>
            </div>

            {/* Pago Mixto: cada parte con su método y monto */}
            {useSplitPayment && (
              <div data-split-area style={{ background: 'var(--bg-card)', padding: isMobile ? '14px' : '24px', borderRadius: '16px', border: '1px solid var(--accent-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Pago Mixto — cargá cada parte</label>
                  <button onClick={() => setUseSplitPayment(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', padding: 0 }}>Volver a método simple</button>
                </div>
                {splitPayments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <select
                      value={p.method}
                      onChange={e => setSplitPayments(prev => prev.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}
                      style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
                    >
                      {SPLIT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={p.amount}
                      onChange={e => setSplitPayments(prev => prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                      onWheel={e => e.currentTarget.blur()}
                      style={{ width: '130px', padding: '10px 12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '1rem', fontFamily: 'var(--font-mono)', textAlign: 'right', outline: 'none' }}
                    />
                    {splitPayments.length > 1 && (
                      <button
                        onClick={() => setSplitPayments(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-danger)', borderRadius: 8, width: 38, height: 38, cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0 }}
                      >✕</button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setSplitPayments(prev => [...prev, { method: 'efectivo', amount: '' }])}
                  style={{ background: 'var(--bg-hover)', border: '1px dashed var(--border-color)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >+ Agregar otra parte</button>
                {(() => {
                  const cargado = splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                  const falta = finalTotal - cargado;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Cargado: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>${cargado.toLocaleString('es-AR')}</strong> de ${finalTotal.toLocaleString('es-AR')}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-mono)', color: falta > 0.01 ? 'var(--accent-warning)' : falta < -0.01 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                        {falta > 0.01 ? `Faltan $${falta.toLocaleString('es-AR')}` : falta < -0.01 ? `Te pasaste $${Math.abs(falta).toLocaleString('es-AR')}` : '✓ Completo'}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Efectivo */}
            {!useSplitPayment && paymentMethod === 'efectivo' && (
              <div style={{ background: 'var(--bg-card)', padding: isMobile ? '14px' : '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>¿Con cuánto paga?</label>
                <input
                  ref={paymentRef}
                  type="number"
                  value={payment}
                  onChange={e => setPayment(e.target.value)}
                  autoFocus
                  onWheel={e => e.currentTarget.blur()}
                  style={{ width: '100%', background: 'var(--bg-main)', border: '2px solid var(--accent-primary)', color: 'var(--text-primary)', borderRadius: '12px', padding: '16px', fontSize: isMobile ? '1.5rem' : '2rem', fontFamily: 'var(--font-mono)', textAlign: 'center', outline: 'none', marginBottom: isMobile ? '12px' : '16px', boxShadow: '0 0 0 4px rgba(20,187,166, 0.1)' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '4px' }}>
                  <button id="qa-btn-exacto" data-billnav="1" onClick={() => setPayment(finalTotal.toString())} onKeyDown={e => arrowNavBills(e, QUICK_AMOUNT_IDS)} style={{ height: '40px', padding: '0 8px', background: 'var(--accent-success)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>Pago Exacto</button>
                  {[1000, 2000, 5000, 10000, 20000].map(bill => (
                    <button key={bill} id={`qa-btn-${bill}`} data-billnav="1" onClick={() => setPayment(p => (parseFloat(p || 0) + bill).toString())} onKeyDown={e => arrowNavBills(e, QUICK_AMOUNT_IDS)} style={{ height: '40px', padding: '0 6px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                      +${bill.toLocaleString('es-AR')}
                    </button>
                  ))}
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '0.72rem', color: 'var(--text-faint)' }}>Escribí el monto y Enter cobra · flechas + Espacio para los billetes</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>VUELTO:</span>
                  <div style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 800, color: change < 0 ? 'var(--accent-danger)' : 'var(--accent-success)', fontFamily: 'var(--font-mono)' }}>
                    {change < 0 ? 'Falta dinero' : `$${change.toLocaleString('es-AR')}`}
                  </div>
                </div>
              </div>
            )}

            {/* Transferencia - muestra alias */}
            {!useSplitPayment && paymentMethod === 'transferencia' && (
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
            {!useSplitPayment && paymentMethod === 'tarjeta' && (
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Pasá la tarjeta por el posnet</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>${finalTotal.toLocaleString('es-AR')}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Confirmá el pago en el posnet y luego presioná "Procesar Venta"</div>
              </div>
            )}

            {/* Mercado Pago con auto-confirmación: QR fijo del mostrador que se confirma solo.
                Si la caja QR no está configurada, cae al modo manual de abajo (mpFijoError). */}
            {!useSplitPayment && paymentMethod === 'mercadopago' && mpAutoConfirm && !mpFijoError && (
              <MpQrFijoCobro total={finalTotal} onPaid={() => setMpPaid(true)} onError={() => setMpFijoError(true)} addToast={addToast} />
            )}

            {/* Mercado Pago simple - QR del comercio (el cajero confirma a mano).
                También es el fallback cuando la caja QR automática no está lista. */}
            {!useSplitPayment && paymentMethod === 'mercadopago' && (!mpAutoConfirm || mpFijoError) && (
              <div style={{ background: 'var(--bg-card)', padding: isMobile ? '16px' : '24px', borderRadius: '16px', border: '1px solid rgba(20,187,166,0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Pago con Mercado Pago</div>
                {businessConfig?.mp_qr_url ? (
                  <>
                    <img src={businessConfig.mp_qr_url} alt="QR Mercado Pago" style={{ width: isMobile ? 180 : 220, height: isMobile ? 180 : 220, objectFit: 'contain', background: '#fff', borderRadius: '12px', padding: '8px' }} />
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '12px' }}>El cliente escanea con la app de Mercado Pago y paga</div>
                    <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(20,187,166,0.06)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Monto a cobrar: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}>${finalTotal.toLocaleString('es-AR')}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '10px' }}>Cuando veas el pago acreditado, presioná "Procesar Venta".</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>${finalTotal.toLocaleString('es-AR')}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                      Mostrale al cliente tu QR de Mercado Pago (el de tu celular sirve). Cuando veas el pago acreditado, presioná <strong style={{ color: 'var(--text-primary)' }}>Procesar Venta</strong>.
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginTop: '10px' }}>
                      Consejo: subí tu QR en Configuración → Datos del negocio para que aparezca acá en pantalla.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Configs Opcionales (Ticket) */}
            <div style={{ marginTop: isMobile ? '8px' : 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <input type="checkbox" checked={autoPrint || false} onChange={e => setAutoPrint?.(e.target.checked)} style={{ width: '24px', height: '24px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}><Icons.Printer /> Imprimir Ticket Físico (Opcional)</span>
              </label>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={cancelCharge} style={{ flex: 1, padding: isMobile ? '14px' : '20px', background: 'transparent', border: '2px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                  Cancelar (Esc)
                </button>
                <button 
                  onClick={confirmCharge} 
                  disabled={isConfirmDisabled}
                  style={{ flex: 2, padding: isMobile ? '14px' : '20px', background: isConfirmDisabled ? 'var(--bg-hover)' : 'var(--gradient-primary)', color: isConfirmDisabled ? 'var(--text-secondary)' : 'white', border: 'none', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 800, cursor: isConfirmDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: isConfirmDisabled ? 'none' : '0 10px 25px -5px rgba(20,187,166, 0.4)' }}>
                  {isProcessing ? 'PROCESANDO...' : mpWaiting ? 'ESPERANDO PAGO...' : 'PROCESAR VENTA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

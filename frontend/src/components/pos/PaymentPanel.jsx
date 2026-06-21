import React from 'react';
import { Icons } from '../ui/Icons';
import { apiPost, apiPut } from '../../services/apiClient';
import { formatMoney } from '../../utils/format';

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
  businessConfig, setBusinessConfig, addToast, currentOperator,
  promotionSavings,
  handleQuickAdd
}) {
  const ivaActual = String(businessConfig?.iva_rate ?? '0');

  const cambiarIva = async (nuevoIva) => {
    const updated = { ...businessConfig, iva_rate: nuevoIva };
    setBusinessConfig?.(updated); // recalcula al instante
    try {
      await apiPut('/config', updated);
      try { new BroadcastChannel('minegocio-sync').postMessage('config-changed'); } catch {}
      addToast(nuevoIva === '0' ? 'IVA desactivado: precios finales sin discriminar' : `IVA configurado en ${nuevoIva}%`, 'success');
    } catch {
      addToast('No se pudo guardar el IVA', 'error');
    }
  };
  const defaultQuickButtons = [
    { id: 1, name: 'Carga SUBE', price: 1000 },
    { id: 2, name: 'Saldo Virtual', price: 500 },
    { id: 3, name: 'Agua Hervida', price: 100 },
    { id: 4, name: 'Fotocopias', price: 50 },
    { id: 5, name: 'Impresiones', price: 80 },
    { id: 6, name: 'Varios', price: 100 }
  ];
  const [quickButtons, setQuickButtons] = React.useState(() => {
    try { const saved = localStorage.getItem('minegocio_quick_buttons'); return saved ? JSON.parse(saved) : defaultQuickButtons; } catch { return defaultQuickButtons; }
  });
  const [isEditingQuick, setIsEditingQuick] = React.useState(false);

  const saveQuickButtons = (newBtns) => {
    setQuickButtons(newBtns);
    localStorage.setItem('minegocio_quick_buttons', JSON.stringify(newBtns));
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Resumen</h2>
          <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>{cart.length} items</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          <span>Subtotal:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatMoney(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          <span>IVA{iva > 0 ? ` (${ivaRate}%)` : ''}:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {iva > 0 && <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatMoney(iva)}</span>}
            <select value={ivaActual} onChange={e => cambiarIva(e.target.value)} title="Cambiar el IVA del negocio"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: ivaActual === '0' ? 'var(--text-secondary)' : 'var(--accent-primary)', borderRadius: '6px', padding: '3px 6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
              <option value="0">No discrimina</option>
              <option value="21">21%</option>
              <option value="10.5">10,5%</option>
              <option value="27">27%</option>
            </select>
          </div>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.95rem', color: 'var(--accent-success)' }}>
            <span>{promotionSavings > 0 ? 'Descuento + Promo:' : 'Descuento:'}</span>
            <span style={{ fontWeight: 600 }}>-{formatMoney(discount)}</span>
          </div>
        )}

        <div style={{ height: '1px', background: 'var(--border-color)', margin: '12px 0' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 800 }}>
          <span>Total:</span>
          <span>{formatMoney(adjustedTotal ?? total)}</span>
        </div>

        <button
          onClick={() => setIsCharging(true)}
          disabled={cart.length === 0 || isProcessing}
          style={{ width: '100%', background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '18px 16px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 800, cursor: cart.length === 0 ? 'not-allowed' : 'pointer', opacity: cart.length === 0 ? 0.5 : 1, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: cart.length === 0 ? 'none' : '0 8px 24px rgba(20,187,166,0.3)' }}
        >
          <Icons.Check /> {isProcessing ? 'Procesando...' : 'Procesar Venta'}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <button style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: '12px', borderRadius: '12px', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.05)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.02)'} onClick={() => setIsFiadoOpen(true)}>
            Anotar Fiado
          </button>
          {lastSale && (
            <button style={{ width: '100%', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: '12px', borderRadius: '12px', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(239,68,68,0.05)'} onClick={() => { setDevolucionQtys({}); setShowDevolucionItems(true); }}>
              ↩ Devolver ítems (última venta)
            </button>
          )}
          {cart.length > 0 && (
            <button style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: '8px' }} onClick={() => setIsCancelConfirm(true)}>
              Anular Venta
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: '0', background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700 }}>Accesos Rápidos</h3>
          <button onClick={() => setIsEditingQuick(!isEditingQuick)} style={{ background: isEditingQuick ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)', color: isEditingQuick ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
            <Icons.Edit style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {quickButtons.map((btn, idx) => (
            <div key={btn.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
              {isEditingQuick ? (
                <>
                  <input type="text" value={btn.name} onChange={e => {
                    const newBtns = [...quickButtons];
                    newBtns[idx].name = e.target.value;
                    saveQuickButtons(newBtns);
                  }} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.75rem', padding: '4px', borderRadius: '4px', textAlign: 'center', boxSizing: 'border-box' }} />
                  <input type="number" value={btn.price} onChange={e => {
                    const newBtns = [...quickButtons];
                    newBtns[idx].price = Number(e.target.value);
                    saveQuickButtons(newBtns);
                  }} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--accent-success)', fontSize: '0.75rem', padding: '4px', borderRadius: '4px', textAlign: 'center', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }} />
                </>
              ) : (
                <div onClick={() => handleQuickAdd('BTN_' + btn.id, btn.name, btn.price, { is_virtual: true })} style={{ cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{btn.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-success)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>${btn.price.toLocaleString('es-AR')}</div>
                </div>
              )}
            </div>
          ))}
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

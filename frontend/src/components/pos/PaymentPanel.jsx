import React from 'react';
import { Icons } from '../ui/Icons';
import { apiPost } from '../../services/apiClient';
import { formatMoney } from '../../utils/format';
import useIsMobile from '../../hooks/useIsMobile';

export default function PaymentPanel({
  cart, total, adjustedTotal, subtotal, iva, discount, ivaRate,
  isProcessing, setIsCharging,
  setIsFiadoOpen, lastSale,
  setShowDevolucionItems, setDevolucionQtys,
  setIsCancelConfirm,
  autoPrint, setAutoPrint,
  saleConfirm,
  businessConfig, setBusinessConfig, addToast,
  promotionSavings,
  handleQuickAdd, handleRepeatSale,
  quickButtons, saveQuickButtons, quickNavIndex
}) {
  const ivaActual = String(businessConfig?.iva_rate ?? '0');
  const isMobile = useIsMobile();
  // Espaciados/fuentes más compactos en celular para que entre todo en pantalla.
  const rowMb = isMobile ? '8px' : '16px';
  const rowFs = isMobile ? '0.85rem' : '0.95rem';

  const cambiarIva = async (nuevoIva) => {
    const updated = { ...businessConfig, iva_rate: nuevoIva };
    setBusinessConfig?.(updated); // recalcula al instante
    try {
      await apiPost('/config', updated);
      try { new BroadcastChannel('minegocio-sync').postMessage('config-changed'); } catch { /* noop */ }
      addToast(nuevoIva === '0' ? 'IVA desactivado: precios finales sin discriminar' : `IVA configurado en ${nuevoIva}%`, 'success');
    } catch {
      addToast('No se pudo guardar el IVA. Reintentá o revisá tu conexión.', 'error');
    }
  };
  // quickButtons / saveQuickButtons ahora vienen del padre (VentasPage), así el
  // buscador puede navegarlos con las flechas sin duplicar el estado.
  const [isEditingQuick, setIsEditingQuick] = React.useState(false);
  const btns = quickButtons || [];
  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflowY: 'auto' }}>
      <div className="ledger-sheet" style={{ padding: isMobile ? '10px 12px' : '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: rowMb }}>
          <h2 className="ledger-title" style={{ fontSize: isMobile ? '1.05rem' : '1.25rem' }}>Resumen</h2>
          <span style={{ background: 'var(--surface-veil)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em' }}>{cart.length} items</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: rowMb, fontSize: rowFs, color: 'var(--text-secondary)' }}>
          <span>Subtotal:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: rowMb, fontSize: rowFs, color: 'var(--text-secondary)' }}>
          <span>IVA{iva > 0 ? ` (${ivaRate}%)` : ''}:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {iva > 0 && <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(iva)}</span>}
            <select value={ivaActual} onChange={e => cambiarIva(e.target.value)} title="Cambiar el IVA del negocio"
              style={{ background: 'var(--surface-veil)', border: '1px solid var(--border-color)', color: ivaActual === '0' ? 'var(--text-secondary)' : 'var(--accent-primary)', borderRadius: '6px', padding: '3px 6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
              <option value="0">No discrimina</option>
              <option value="21">21%</option>
              <option value="10.5">10,5%</option>
              <option value="27">27%</option>
            </select>
          </div>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: rowMb, fontSize: rowFs, color: 'var(--accent-success)' }}>
            <span>{promotionSavings > 0 ? 'Descuento + Promo:' : 'Descuento:'}</span>
            <span style={{ fontWeight: 600 }}>-{formatMoney(discount)}</span>
          </div>
        )}

        <div style={{ height: '1px', background: 'var(--border-color)', margin: isMobile ? '8px 0' : '12px 0' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: isMobile ? '12px' : '18px' }}>
          <span style={{ fontSize: isMobile ? '0.78rem' : '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-secondary)' }}>Total a cobrar</span>
          <span style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{formatMoney(adjustedTotal ?? total)}</span>
        </div>

        <button
          onClick={() => setIsCharging(true)}
          disabled={cart.length === 0 || isProcessing}
          style={{ width: '100%', background: 'var(--accent-primary)', color: 'var(--sheet)', border: 'none', padding: isMobile ? '13px 16px' : '18px 16px', borderRadius: 'var(--radius-sm)', fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 800, cursor: cart.length === 0 ? 'not-allowed' : 'pointer', opacity: cart.length === 0 ? 0.5 : 1, transition: 'filter 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Icons.Check /> {isProcessing ? 'Procesando...' : 'Procesar Venta'}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {cart.length === 0 && lastSale?.cart?.length > 0 && (
            <button style={{ width: '100%', minHeight: '44px', background: 'var(--wash-primary)', border: '1px solid var(--border-color)', color: 'var(--accent-primary)', fontWeight: 700, fontSize: 'var(--fs-body)', cursor: 'pointer', padding: '12px', borderRadius: '12px', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.borderColor='var(--accent-primary)'} onMouseLeave={e=>e.target.style.borderColor='var(--border-color)'} onClick={() => handleRepeatSale(lastSale.cart)}>
              ↻ Repetir última venta
            </button>
          )}
          <button style={{ width: '100%', minHeight: '44px', background: 'var(--surface-veil)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 'var(--fs-body)', cursor: 'pointer', padding: '12px', borderRadius: '12px', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='var(--bg-hover)'} onMouseLeave={e=>e.target.style.background='var(--surface-veil)'} onClick={() => setIsFiadoOpen(true)}>
            Anotar Fiado
          </button>
          {lastSale && (
            <button style={{ width: '100%', minHeight: '44px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--accent-danger)', fontWeight: 700, fontSize: 'var(--fs-body)', cursor: 'pointer', padding: '12px', borderRadius: '12px', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(239,68,68,0.05)'} onClick={() => { setDevolucionQtys({}); setShowDevolucionItems(true); }}>
              ↩ Devolver ítems (última venta)
            </button>
          )}
          {cart.length > 0 && (
            <button style={{ width: '100%', minHeight: '44px', background: 'transparent', border: 'none', color: 'var(--accent-danger)', fontWeight: 700, fontSize: 'var(--fs-body)', cursor: 'pointer', padding: '8px' }} onClick={() => setIsCancelConfirm(true)}>
              Anular Venta
            </button>
          )}
        </div>
      </div>

      <div className="ledger-sheet" style={{ marginTop: '0', padding: isMobile ? '10px 12px' : '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="ledger-label" style={{ fontSize: '0.72rem' }}>Accesos rápidos</h3>
          <button onClick={() => setIsEditingQuick(!isEditingQuick)} style={{ background: isEditingQuick ? 'var(--accent-primary)' : 'var(--surface-veil)', color: isEditingQuick ? 'var(--bg-card)' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
            <Icons.Edit style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {btns.map((btn, idx) => {
            const navSel = quickNavIndex === idx;
            return (
            <div key={btn.id} style={{ background: navSel ? 'var(--wash-primary, rgba(20,187,166,0.12))' : 'var(--surface-veil)', border: `1px solid ${navSel ? 'var(--accent-primary)' : 'var(--border-color)'}`, boxShadow: navSel ? '0 0 0 2px rgba(20,187,166,0.25)' : 'none', borderRadius: '8px', padding: '8px', minHeight: '44px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', position: 'relative', transition: 'border-color 0.12s, box-shadow 0.12s, background 0.12s' }}>
              {isEditingQuick ? (
                <>
                  <input type="text" value={btn.name} onChange={e => {
                    const newBtns = [...btns];
                    newBtns[idx] = { ...newBtns[idx], name: e.target.value };
                    saveQuickButtons(newBtns);
                  }} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.75rem', padding: '4px', borderRadius: '4px', textAlign: 'center', boxSizing: 'border-box' }} />
                  <input type="number" value={btn.price} onChange={e => {
                    const newBtns = [...btns];
                    newBtns[idx] = { ...newBtns[idx], price: Number(e.target.value) };
                    saveQuickButtons(newBtns);
                  }} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border-color)', color: 'var(--accent-success)', fontSize: '0.75rem', padding: '4px', borderRadius: '4px', textAlign: 'center', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }} />
                </>
              ) : (
                <div onClick={() => handleQuickAdd('BTN_' + btn.id, btn.name, btn.price, { is_virtual: true })} style={{ cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{btn.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-success)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>${btn.price.toLocaleString('es-AR')}</div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '0', display: 'flex', justifyContent: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} style={{ width: '16px', height: '16px' }} />
          Imprimir ticket automáticamente tras cobrar
        </label>
      </div>

      {saleConfirm && (
        <div style={{ position: 'absolute', inset: 0,             background: 'rgba(16, 185, 129, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '16px', animation: 'scaleIn 0.25s ease' }}>
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

import React from 'react';
import { Icons } from '../ui/Icons';
import { formatMoney } from '../../utils/format';

// Color del badge de stock según nivel: agotado (rojo), bajo (ámbar), sano (verde)
const stockTone = (stock, min) => {
  if (stock <= 0) return { bg: 'rgba(239,68,68,0.2)', bd: 'rgba(239,68,68,0.3)', fg: '#FCA5A5' };
  if (stock <= (min || 5)) return { bg: 'rgba(245,158,11,0.18)', bd: 'rgba(245,158,11,0.3)', fg: '#FCD34D' };
  return { bg: 'rgba(16,185,129,0.15)', bd: 'rgba(16,185,129,0.3)', fg: '#6EE7B7' };
};

export default function CartPanel({ cart, total, adjustedTotal, updateQty, setItemQty, removeItem }) {
  const displayTotal = adjustedTotal ?? total;
  return (
    <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Carrito</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Total: {formatMoney(displayTotal)}</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>No hay productos en el carrito. Utilice el buscador superior.</div>
        ) : (
          cart.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <Icons.Image style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', letterSpacing: '0.1px' }}>{item.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{item.code}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatMoney(item.price)}</span>
                    {!item.is_virtual && (() => {
                      const tone = stockTone(item.stock, item.min_stock);
                      return <span style={{ background: tone.bg, border: `1px solid ${tone.bd}`, color: tone.fg, padding: '2px 4px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>Stock: {item.stock} u</span>;
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Subtotal</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{formatMoney(item.price * item.qty)}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 6px' }}>
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => updateQty(item.id, -1)}>-</button>
                    <input
                      id={`qty-input-${item.id}`}
                      type="number"
                      step="0.01"
                      value={item.qty}
                      onChange={e => { const val = parseFloat(e.target.value); if (!isNaN(val) && val > 0) setItemQty(item.id, val); }}
                      style={{ width: '40px', textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontWeight: 600, fontSize: '0.9rem' }}
                    />
                    <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => updateQty(item.id, 1)}>+</button>
                  </div>
                  <button style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '8px', color: 'var(--accent-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeItem(item.id)}>
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

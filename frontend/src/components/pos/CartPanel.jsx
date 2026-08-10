
import { useState } from 'react';
import { Icons } from '../ui/Icons';
import ProductThumb from '../ui/ProductThumb';
import { formatMoney } from '../../utils/format';

// Color del badge de stock según nivel: agotado (rojo), bajo (ámbar), sano (verde).
// Usa tokens theme-aware (wash + accent) para leerse bien en claro y oscuro.
const stockTone = (stock, min) => {
  if (stock <= 0) return { bg: 'var(--wash-danger)', bd: 'var(--border-color)', fg: 'var(--accent-danger)' };
  if (stock <= (min || 5)) return { bg: 'var(--wash-warning)', bd: 'var(--border-color)', fg: 'var(--accent-warning)' };
  return { bg: 'var(--wash-success)', bd: 'var(--border-color)', fg: 'var(--accent-success)' };
};

export default function CartPanel({ cart, total, adjustedTotal, updateQty, setItemQty, removeItem, listType, setListType, businessType, canEditPrice, setItemPrice }) {
  const displayTotal = adjustedTotal ?? total;

  // Precio editable por ítem (solo si canEditPrice)
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');

  // Descuento porcentual por ítem
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [editingDiscountVal, setEditingDiscountVal] = useState('');

  const confirmPrice = (id) => {
    const v = parseFloat(editingPriceVal);
    if (!isNaN(v) && v >= 0 && setItemPrice) setItemPrice(id, Math.round(v));
    setEditingPriceId(null);
    setEditingPriceVal('');
  };

  const confirmDiscount = (item) => {
    const pct = parseFloat(editingDiscountVal);
    if (!isNaN(pct) && pct > 0 && pct < 100 && setItemPrice) {
      setItemPrice(item.id, Math.round(item.price * (1 - pct / 100)));
    }
    setEditingDiscountId(null);
    setEditingDiscountVal('');
  };

  const roundPrice = (item, to = 10) => {
    if (setItemPrice) setItemPrice(item.id, Math.round(item.price / to) * to);
  };

  return (
    <div className="ledger-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--rule-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 className="ledger-title" style={{ fontSize: '1.15rem' }}>Carrito</h2>
          {cart.length > 0 && (
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', background: 'rgba(20,187,166,0.1)', padding: '2px 8px', borderRadius: 10 }}>
              {cart.length} {cart.length === 1 ? 'artículo' : 'artículos'}
            </span>
          )}
          {businessType === 'corralon' && setListType && (
            <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--rule-strong)', fontSize: '0.70rem', fontWeight: 600 }}>
              <button onClick={() => setListType('a')} style={{ padding: '3px 9px', border: 'none', cursor: 'pointer',
                background: listType === 'a' ? 'var(--lp-primary)' : 'transparent',
                color: listType === 'a' ? '#fff' : 'var(--lp-ink-faint)', transition: 'all 0.15s' }}>A</button>
              <button onClick={() => setListType('b')} style={{ padding: '3px 9px', border: 'none', cursor: 'pointer',
                background: listType === 'b' ? 'var(--lp-primary)' : 'transparent',
                color: listType === 'b' ? '#fff' : 'var(--lp-ink-faint)', transition: 'all 0.15s' }}>B</button>
            </div>
          )}
        </div>
        <p className="ledger-num" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0 }}>{formatMoney(displayTotal)}</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>No hay productos en el carrito. Utilice el buscador superior.</div>
        ) : (
          cart.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-veil)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                <ProductThumb name={item.name} size={36} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', letterSpacing: '0.1px' }}>{item.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>{item.code}</div>

                  {/* Fila de precio + controles de ajuste */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', flexWrap: 'wrap' }}>

                    {/* Precio editable */}
                    {canEditPrice && editingPriceId === item.id ? (
                      <input
                        type="number"
                        value={editingPriceVal}
                        autoFocus
                        onChange={e => setEditingPriceVal(e.target.value)}
                        onBlur={() => confirmPrice(item.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') { setEditingPriceId(null); setEditingPriceVal(''); }
                        }}
                        style={{ width: '76px', background: 'var(--bg-main)', border: '1px solid var(--accent-primary)', borderRadius: '4px', color: 'var(--text-primary)', padding: '2px 6px', fontSize: '0.88rem', fontWeight: 800, outline: 'none' }}
                      />
                    ) : (
                      <span
                        style={{
                          fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem',
                          fontVariantNumeric: 'tabular-nums',
                          cursor: canEditPrice ? 'pointer' : 'default',
                          borderBottom: canEditPrice ? '1px dashed var(--border-color)' : 'none',
                          paddingBottom: canEditPrice ? '1px' : '0',
                        }}
                        onClick={() => canEditPrice && (setEditingPriceId(item.id), setEditingPriceVal(String(item.price)))}
                        title={canEditPrice ? 'Clic para editar precio' : undefined}
                      >
                        {formatMoney(item.price)}
                      </span>
                    )}

                    {/* Botón / input de descuento % */}
                    {editingDiscountId === item.id ? (
                      <input
                        type="number"
                        placeholder="%"
                        value={editingDiscountVal}
                        autoFocus
                        min="0" max="99"
                        onChange={e => setEditingDiscountVal(e.target.value)}
                        onBlur={() => confirmDiscount(item)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') { setEditingDiscountId(null); setEditingDiscountVal(''); }
                        }}
                        style={{ width: '46px', background: 'var(--bg-main)', border: '1px solid var(--accent-warning)', borderRadius: '4px', color: 'var(--accent-warning)', padding: '2px 5px', fontSize: '0.82rem', fontWeight: 800, outline: 'none' }}
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingDiscountId(item.id); setEditingDiscountVal(''); }}
                        title="Aplicar descuento (%)"
                        style={{ background: 'var(--wash-warning)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: '4px', padding: '2px 5px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-warning)', cursor: 'pointer', lineHeight: 1 }}
                      >%</button>
                    )}

                    {/* Redondear */}
                    <button
                      onClick={() => roundPrice(item, 10)}
                      title="Redondear al múltiplo de 10 más cercano"
                      style={{ background: 'var(--surface-veil)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1, whiteSpace: 'nowrap' }}
                    >10</button>
                    <button
                      onClick={() => roundPrice(item, 100)}
                      title="Redondear al múltiplo de 100 más cercano"
                      style={{ background: 'var(--surface-veil)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1, whiteSpace: 'nowrap' }}
                    >100</button>

                    {/* Badge de stock */}
                    {!item.is_virtual && (() => {
                      const tone = stockTone(item.stock, item.min_stock);
                      return <span style={{ background: tone.bg, border: `1px solid ${tone.bd}`, color: tone.fg, padding: '2px 4px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 800 }}>Stock: {item.stock} u</span>;
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Subtotal</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(item.price * item.qty)}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 6px' }}>
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', borderRadius: '4px', padding: '2px 6px', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >-</button>
                    <input
                      id={`qty-input-${item.id}`}
                      type="number"
                      step="1"
                      min="1"
                      value={item.qty}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1) setItemQty(item.id, v);
                      }}
                      style={{ width: '40px', textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontWeight: 600, fontSize: '0.9rem' }}
                    />
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', borderRadius: '4px', padding: '2px 6px', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >+</button>
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


import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../ui/Icons';
import ProductThumb from '../ui/ProductThumb';
import { formatMoney } from '../../utils/format';
import useIsMobile from '../../hooks/useIsMobile';

// Color del badge de stock según nivel: agotado (rojo), bajo (ámbar), sano (verde).
// Usa tokens theme-aware (wash + accent) para leerse bien en claro y oscuro.
const stockTone = (stock, min) => {
  if (stock <= 0) return { bg: 'var(--wash-danger)', bd: 'var(--border-color)', fg: 'var(--accent-danger)' };
  if (stock <= (min || 5)) return { bg: 'var(--wash-warning)', bd: 'var(--border-color)', fg: 'var(--accent-warning)' };
  return { bg: 'var(--wash-success)', bd: 'var(--border-color)', fg: 'var(--accent-success)' };
};

export default function CartPanel({ cart, total, adjustedTotal, updateQty, setItemQty, removeItem, listType, setListType, canEditPrice, setItemPrice, setItemList, priceLists, listOptions, cartDiscountPct, setCartDiscountPct }) {
  const isMobile = useIsMobile();
  const displayTotal = adjustedTotal ?? total;

  // Precio editable por ítem (solo si canEditPrice)
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');

  // Descuento porcentual por ítem
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [editingDiscountVal, setEditingDiscountVal] = useState('');

  // Descuento porcentual general (todo el carrito)
  const [editingCartDisc, setEditingCartDisc] = useState(false);
  const [cartDiscInput, setCartDiscInput] = useState('');

  // Ítem con el menú de listas de precio abierto (3 puntitos).
  // En desktop guarda además la posición para anclar el dropdown al botón;
  // en mobile queda como bottom-sheet (comportamiento aprobado).
  const [listMenuFor, setListMenuFor] = useState(null);

  const confirmCartDisc = () => {
    const v = parseFloat(cartDiscInput);
    if (setCartDiscountPct) setCartDiscountPct(!isNaN(v) && v > 0 && v < 100 ? Math.round(v) : 0);
    setEditingCartDisc(false);
    setCartDiscInput('');
  };

  // Listas de precio disponibles para un ítem (solo las que tienen valor cargado).
  const availableLists = (item) => {
    const defs = [
      { v: 'a', key: 'price_a', label: priceLists?.[0]?.label || 'Lista A — Minorista' },
      { v: 'b', key: 'price_b', label: priceLists?.[1]?.label || 'Lista B — Mayorista' },
      { v: 'c', key: 'price_c', label: priceLists?.[2]?.label || 'Lista C' },
      { v: 'd', key: 'price_d', label: priceLists?.[3]?.label || 'Lista D' },
      { v: 'e', key: 'price_e', label: priceLists?.[4]?.label || 'Lista E' },
    ];
    return defs.filter(l => {
      const val = item[l.key];
      return val !== undefined && val !== null && val !== '' && !isNaN(parseFloat(val));
    }).map(l => ({ ...l, value: parseFloat(item[l.key]) }));
  };

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
      <div style={{ padding: isMobile ? '8px 12px' : '13px 20px', borderBottom: '1px solid var(--rule-strong)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="ledger-title" style={{ fontSize: '1.15rem' }}>Carrito</h2>
          {cart.length > 0 && (
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', background: 'rgba(20,187,166,0.1)', padding: '2px 8px', borderRadius: 10 }}>
              {cart.length} {cart.length === 1 ? 'artículo' : 'artículos'}
            </span>
          )}
          {setListType && (
            <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--rule-strong)', fontSize: '0.70rem', fontWeight: 600 }}>
              {(listOptions || [{ v: 'a', label: 'A' }, { v: 'b', label: 'B' }, { v: 'c', label: 'C' }]).map(opt => (
                <button key={opt.v} onClick={() => setListType(opt.v)} title={`Vender con Lista ${opt.label}`} style={{ padding: '3px 9px', border: 'none', cursor: 'pointer',
                  background: listType === opt.v ? 'var(--lp-primary)' : 'transparent',
                  color: listType === opt.v ? '#fff' : 'var(--lp-ink-faint)', transition: 'all 0.15s' }}>{opt.label}</button>
              ))}
            </div>
          )}
          {/* Descuento % sobre TODO el carrito */}
          {setCartDiscountPct && (
            editingCartDisc ? (
              <input
                type="number" autoFocus min="0" max="99" placeholder="%"
                value={cartDiscInput}
                onChange={e => setCartDiscInput(e.target.value)}
                onBlur={confirmCartDisc}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setEditingCartDisc(false); setCartDiscInput(''); } }}
                style={{ width: 54, background: 'var(--bg-main)', border: '1px solid var(--accent-warning)', borderRadius: 5, color: 'var(--accent-warning)', padding: '3px 6px', fontSize: '0.72rem', fontWeight: 800, outline: 'none' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button
                  onClick={() => { setCartDiscInput(cartDiscountPct ? String(cartDiscountPct) : ''); setEditingCartDisc(true); }}
                  title="Descuento sobre todo el carrito"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', lineHeight: 1, fontWeight: 800, fontSize: '0.7rem',
                    padding: '3px 8px', borderRadius: 5,
                    background: cartDiscountPct > 0 ? 'var(--accent-warning)' : 'var(--wash-warning)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    color: cartDiscountPct > 0 ? '#fff' : 'var(--accent-warning)',
                  }}
                >{cartDiscountPct > 0 ? `−${cartDiscountPct}% desc.` : '% desc.'}</button>
                {cartDiscountPct > 0 && (
                  <button onClick={() => setCartDiscountPct(0)} title="Quitar descuento" aria-label="Quitar descuento"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.95rem', lineHeight: 1, padding: '0 2px', fontWeight: 800 }}>×</button>
                )}
              </div>
            )
          )}
        </div>
        <p className="ledger-num" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0 }}>{formatMoney(displayTotal)}</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '6px 10px' : '12px 20px', display: 'flex', flexDirection: 'column', gap: isMobile ? '4px' : '6px' }}>
        {cart.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 6 : 10, padding: isMobile ? '10px 0' : '40px 0', color: 'var(--text-secondary)' }}>
            <svg width={isMobile ? 28 : 40} height={isMobile ? 28 : 40} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" opacity="0.35"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
            <span style={{ fontSize: isMobile ? '0.82rem' : '0.92rem' }}>Buscá un producto para agregar</span>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '6px 8px' : '8px 12px', background: 'var(--surface-veil)', borderRadius: isMobile ? '8px' : '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px', alignItems: 'center', minWidth: 0 }}>
                {!isMobile && <ProductThumb name={item.name} size={36} />}

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

                    {/* 3 puntitos: elegir lista de precio del producto (solo si hay más de una lista cargada) */}
                    {availableLists(item).length > 1 && (
                      <button
                        onClick={e => {
                          if (listMenuFor?.id === item.id) { setListMenuFor(null); return; }
                          if (isMobile) { setListMenuFor({ id: item.id }); return; }
                          // Desktop: anclar el dropdown al botón (abajo, o arriba si no hay lugar).
                          const r = e.currentTarget.getBoundingClientRect();
                          const menuH = 70 + availableLists(item).length * 44;
                          const openUp = (window.innerHeight - r.bottom) < menuH;
                          setListMenuFor({
                            id: item.id,
                            left: Math.max(8, Math.min(r.left, window.innerWidth - 252)),
                            top: openUp ? undefined : r.bottom + 6,
                            bottom: openUp ? (window.innerHeight - r.top + 6) : undefined,
                            up: openUp,
                          });
                        }}
                        title="Cambiar lista de precio"
                        aria-label="Cambiar lista de precio"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, letterSpacing: '1px', lineHeight: 1, padding: '0 2px', opacity: listMenuFor?.id === item.id ? 1 : 0.65, borderRadius: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >⋮</button>
                    )}

                    {listMenuFor?.id === item.id && createPortal(
                      isMobile ? (
                        // Mobile: bottom-sheet (comportamiento aprobado)
                        <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }} onClick={() => setListMenuFor(null)}>
                          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
                          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1, background: 'var(--bg-card)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '6px 12px 18px', boxShadow: '0 -4px 24px rgba(0,0,0,0.4)', maxHeight: '80vh', overflowY: 'auto' }}>
                            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{item.name} — Lista de precios</div>
                            {availableLists(item).map((l, i) => (
                              <button
                                key={l.v}
                                onClick={() => { setListMenuFor(null); setItemList && setItemList(item.id, l.v, l.value); }}
                                style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left',
                                  background: item.listType === l.v ? 'var(--wash-primary, rgba(20,187,166,0.1))' : 'transparent',
                                  border: 'none', borderTop: i > 0 ? '1px solid var(--border-color)' : 'none',
                                  color: item.listType === l.v ? 'var(--accent-primary)' : 'var(--text-primary)',
                                  padding: '14px 8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', borderRadius: '6px',
                                }}
                              >
                                <span>{l.label}{item.listType === l.v ? ' ✓' : ''}</span>
                                <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(l.value)}</span>
                              </button>
                            ))}
                            <button onClick={() => setListMenuFor(null)} style={{ display: 'block', width: '100%', textAlign: 'center', background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-secondary)', padding: '12px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', marginTop: '8px' }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        // Desktop: dropdown anclado al botón, con flechita (como parte de él)
                        <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }} onClick={() => setListMenuFor(null)}>
                          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: listMenuFor.top, bottom: listMenuFor.bottom, left: listMenuFor.left, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 6, minWidth: 244, boxShadow: '0 12px 34px rgba(0,0,0,0.28)', zIndex: 1 }}>
                            <div style={{ position: 'absolute', [listMenuFor.up ? 'bottom' : 'top']: -5, left: 16, width: 10, height: 10, background: 'var(--bg-card)', borderLeft: listMenuFor.up ? 'none' : '1px solid var(--border-color)', borderTop: listMenuFor.up ? 'none' : '1px solid var(--border-color)', borderRight: listMenuFor.up ? '1px solid var(--border-color)' : 'none', borderBottom: listMenuFor.up ? '1px solid var(--border-color)' : 'none', transform: 'rotate(45deg)' }} />
                            <div style={{ padding: '8px 10px 2px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Lista de precios</div>
                            <div style={{ padding: '0 10px 8px', fontSize: '0.74rem', color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{item.name}</div>
                            {availableLists(item).map((l) => (
                              <button
                                key={l.v}
                                onClick={() => { setListMenuFor(null); setItemList && setItemList(item.id, l.v, l.value); }}
                                style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left',
                                  background: item.listType === l.v ? 'var(--wash-primary, rgba(20,187,166,0.1))' : 'transparent',
                                  border: 'none', borderRadius: 8,
                                  color: item.listType === l.v ? 'var(--accent-primary)' : 'var(--text-primary)',
                                  padding: '10px', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => { if (item.listType !== l.v) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (item.listType !== l.v) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <span>{l.label}{item.listType === l.v ? ' ✓' : ''}</span>
                                <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--accent-primary)' }}>{formatMoney(l.value)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ),
                      document.body
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

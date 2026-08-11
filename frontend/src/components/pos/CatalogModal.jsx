import { useState, useMemo } from 'react';
import useIsMobile from '../../hooks/useIsMobile';

/**
 * CatalogModal — pantalla de catálogo por categoría
 *
 * Props:
 *   products   — array de productos (productsDB o similar), cada uno con category_name
 *   onSelect   — fn(product) → lo que sea que el padre haga (agregar al carrito, al presupuesto, etc.)
 *   onClose    — fn() para cerrar
 *   getPrice   — fn(product) → number  (opcional; si no se pasa usa p.price)
 *   title      — string (opcional)
 */
export default function CatalogModal({ products = [], onSelect, onClose, getPrice, title = 'Catálogo de productos' }) {
  const isMobile = useIsMobile();
  const [activeCategory, setActiveCategory] = useState('__all__');
  const [search, setSearch] = useState('');

  const price = (p) => getPrice ? getPrice(p) : (p.price || 0);

  // Categorías únicas, ordenadas
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach(p => set.add(p.category_name || 'Sin categoría'));
    return ['Todos', ...Array.from(set).sort()];
  }, [products]);

  // Filtrado por categoría + búsqueda
  const visible = useMemo(() => {
    let list = products;
    if (activeCategory !== '__all__') {
      list = list.filter(p => (p.category_name || 'Sin categoría') === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, search]);

  const handleSelect = (p) => {
    onSelect(p);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '0' : '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: isMobile ? '16px 16px 0 0' : '12px',
          width: '100%',
          maxWidth: isMobile ? '100%' : '800px',
          maxHeight: isMobile ? '90dvh' : '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          ...(isMobile ? { position: 'fixed', bottom: 0, left: 0, right: 0 } : {}),
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Tocá un producto para agregarlo
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: '1.4rem', lineHeight: 1,
              padding: '4px 8px', borderRadius: '6px',
            }}
            aria-label="Cerrar catálogo"
          >✕</button>
        </div>

        {/* Buscador interno */}
        <div style={{ padding: '12px 20px', flexShrink: 0, borderBottom: '1px solid var(--border-color)' }}>
          <input
            type="text"
            placeholder="Buscar dentro del catálogo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input, var(--bg-hover))',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Pills de categoría */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 20px',
          overflowX: 'auto',
          flexShrink: 0,
          borderBottom: '1px solid var(--border-color)',
          scrollbarWidth: 'none',
        }}>
          {categories.map(cat => {
            const key = cat === 'Todos' ? '__all__' : cat;
            const active = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                style={{
                  flexShrink: 0,
                  padding: '5px 14px',
                  borderRadius: '20px',
                  border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  background: active ? 'var(--accent-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Grilla de productos */}
        <div style={{
          overflowY: 'auto',
          flex: 1,
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: isMobile
            ? 'repeat(2, 1fr)'
            : 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '12px',
          alignContent: 'start',
        }}>
          {visible.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', gridColumn: '1/-1', textAlign: 'center', paddingTop: '32px' }}>
              Sin productos en esta categoría.
            </p>
          )}
          {visible.map(p => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.border = '1px solid var(--accent-primary)';
                e.currentTarget.style.background = 'var(--wash-primary, rgba(20,187,166,0.08))';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.border = '1px solid var(--border-color)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
            >
              {/* Thumbnail si existe */}
              {p.image_url && (
                <img
                  src={p.image_url}
                  alt={p.name}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', marginBottom: '2px' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}

              <span style={{
                fontWeight: 600,
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {p.name}
              </span>

              <span style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ${price(p).toLocaleString('es-AR')}
              </span>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {p.category_name || 'Sin categoría'}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: p.stock > 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                  fontWeight: 600,
                }}>
                  Stock: {p.stock ?? '—'}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer con conteo */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          textAlign: 'right',
        }}>
          {visible.length} de {products.length} productos
        </div>
      </div>
    </div>
  );
}

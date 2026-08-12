import { useState, useEffect } from 'react';
import { apiGet } from '../../services/apiClient';

/**
 * VariantPicker — mini-modal que aparece cuando se selecciona un producto con variantes.
 *
 * Props:
 *   product   — el producto padre (con has_variants = true)
 *   onSelect  — fn(variantProduct) — igual que handleQuickAdd pero recibe el producto variante
 *   onClose   — fn()
 *   getPrice  — fn(p) → number (opcional)
 */
export default function VariantPicker({ product, onSelect, onClose, getPrice }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);

  const price = (p) => getPrice ? getPrice(p) : (p.price || 0);

  useEffect(() => {
    apiGet(`/products/${product.id}/variants`)
      .then(r => r.json())
      .then(data => setVariants(Array.isArray(data) ? data : []))
      .catch(() => setVariants([]))
      .finally(() => setLoading(false));
  }, [product.id]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 380,
          padding: 24,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {product.name}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Elegí una presentación
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.3rem', cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>

        {loading && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '16px 0' }}>
            Cargando variantes...
          </p>
        )}

        {!loading && variants.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '16px 0' }}>
            Sin variantes cargadas.
          </p>
        )}

        {!loading && variants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {variants.map(v => (
              <button
                key={v.id}
                onClick={() => { onSelect(v); onClose(); }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
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
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {v.variant_label || v.name}
                  </span>
                  <span style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: v.stock > 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                    marginTop: 2,
                  }}>
                    Stock: {v.stock ?? '—'}
                  </span>
                </div>
                <span style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: 'var(--accent-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  ${price(v).toLocaleString('es-AR')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

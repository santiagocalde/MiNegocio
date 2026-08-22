import { useState, useEffect, useRef } from 'react';
import useModalExit from '../../hooks/useModalExit';

export default function AddAmountModal({ show, setShow, handleQuickAdd }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const inputRef = useRef(null);
  const priceRef = useRef(null);

  useEffect(() => {
    if (show) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName('');
      setPrice('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const handler = (e) => { if (e.key === 'Escape') setShow(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [show, setShow]);

  const { rendered, closing } = useModalExit(show);
  if (!rendered) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const finalPrice = parseFloat(price);
    if (isNaN(finalPrice) || finalPrice < 0) return;

    handleQuickAdd('VIRTUAL_' + Date.now(), name.trim(), finalPrice, { is_virtual: true });
    setShow(false);
  };

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={() => setShow(false)}>
      <div className={`modal-content${closing ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <h2 className="modal-title" style={{ fontSize: '1.4rem' }}>Agregar Producto Manual</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nombre del Ítem</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (name.trim()) priceRef.current?.focus();
                }
              }}
              style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', outline: 'none', fontSize: '1rem' }}
              placeholder="Ej: Caramelos sueltos"
              autoFocus
            />
            <p style={{ margin: '5px 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>Enter pasa al precio</p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Precio ($)</label>
            <input
              ref={priceRef}
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', outline: 'none', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}
              placeholder="0.00"
              step="any"
              min="0"
            />
            <p style={{ margin: '5px 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>Enter agrega directo</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={() => setShow(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={!name.trim() || price === '' || parseFloat(price) < 0} style={{ flex: 1, background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, cursor: (!name.trim() || price === '' || parseFloat(price) < 0) ? 'not-allowed' : 'pointer', opacity: (!name.trim() || price === '' || parseFloat(price) < 0) ? 0.5 : 1 }}>
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

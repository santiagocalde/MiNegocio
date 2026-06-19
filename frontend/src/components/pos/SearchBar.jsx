import React, { useMemo, useState } from 'react';
import { Icons } from '../ui/Icons';
import AddAmountModal from './AddAmountModal';

export default function SearchBar({
  search, setSearch, searchRef, searchError, flash,
  productsDB, handleQuickAdd, setShowPriceCheck, addToast, handleEmptyEnter
}) {
  const [showAddAmountModal, setShowAddAmountModal] = useState(false);
  const autocomplete = useMemo(() => {
    if (!search.trim() || !productsDB) return [];
    return productsDB
      .filter(p => p.code?.startsWith(search) || p.name?.toLowerCase().startsWith(search.toLowerCase()))
      .slice(0, 5);
  }, [search, productsDB]);

  return (
    <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 2px 0', letterSpacing: '-0.2px' }}>Buscar Producto</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Escanee código de barras o escriba el nombre del producto</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowPriceCheck(true)} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e => e.target.style.background='var(--bg-hover)'}>
            Consultar Precio
          </button>
          <button onClick={() => addToast('Debes conectar una balanza compatible.', 'info')} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e => e.target.style.background='var(--bg-hover)'}>
            Balanza
          </button>
          <button onClick={() => setShowAddAmountModal(true)} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e => e.target.style.background='var(--bg-hover)'}>
            Agregar Monto
          </button>
        </div>
      </div>

      <div className={`search-bar ${flash ? 'flash' : ''}`} style={{ margin: 0, position: 'relative', borderColor: searchError ? 'var(--accent-danger)' : 'var(--border-color)', borderWidth: searchError ? '2px' : '1px' }}>
        <Icons.Search />
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar producto... (Enter para agregar)"
          aria-label="Buscar producto por código o nombre"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            if (e.target.value.trim().length > 0 && e.target.value.trim().length < 3) {
              const term = e.target.value.trim();
              const codeMatch = autocomplete.find(p => p.code === term);
              if (codeMatch) { handleQuickAdd(codeMatch.code, codeMatch.name, codeMatch.price); setSearch(''); searchRef.current?.focus(); }
            }
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); document.getElementById('autocomplete-0')?.focus(); }
            if (e.key === 'Enter') {
              const term = e.target.value.trim();
              if (!term) {
                if (handleEmptyEnter) handleEmptyEnter();
                return;
              }
              // Detectar código de barras de balanza (EAN-13 que empieza con "20")
              if (/^20\d{11}$/.test(term)) {
                const productCode = term.slice(2, 7);
                const priceCents = parseInt(term.slice(7, 12), 10);
                const scalePrice = priceCents / 100;
                const match = productsDB?.find(p => p.code === productCode);
                if (match) {
                  addToast(`Balanza: ${match.name} - $${scalePrice.toFixed(2)}`, 'info');
                  handleQuickAdd(match.code, match.name, scalePrice);
                  setSearch('');
                  searchRef.current?.focus();
                  return;
                } else {
                  addToast(`Código de balanza ${productCode} no encontrado`, 'error');
                  setSearch('');
                  return;
                }
              }
              // Búsqueda normal por código exacto
              const exact = productsDB?.find(p => p.code === term);
              if (exact) {
                handleQuickAdd(exact.code, exact.name, exact.price);
                setSearch('');
                searchRef.current?.focus();
              } else if (autocomplete.length === 1) {
                handleQuickAdd(autocomplete[0].code, autocomplete[0].name, autocomplete[0].price);
                setSearch('');
                searchRef.current?.focus();
              }
            }
          }}
          autoFocus
        />
        {search.trim().length > 0 && autocomplete.length > 0 && (
          <div role="listbox" aria-label="Resultados de búsqueda" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '4px', boxShadow: '0 4px 12px rgba(30,58,95,0.2)' }}>
            {autocomplete.map((p, i) => (
              <button
                id={`autocomplete-${i}`}
                key={p.id}
                onClick={() => { handleQuickAdd(p.code, p.name, p.price); setSearch(''); searchRef.current?.focus(); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { handleQuickAdd(p.code, p.name, p.price); setSearch(''); searchRef.current?.focus(); }
                  if (e.key === 'ArrowDown') document.getElementById(`autocomplete-${i + 1}`)?.focus();
                  if (e.key === 'ArrowUp') { if (i === 0) searchRef.current?.focus(); else document.getElementById(`autocomplete-${i - 1}`)?.focus(); }
                }}
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', outline: 'none' }}
                onFocus={e => e.target.style.background = 'var(--bg-hover)'}
                onBlur={e => e.target.style.background = 'transparent'}
                onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.target.style.background = 'transparent'}
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
                  <span>${p.price}</span>
                  <span style={{ color: p.stock > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>Stock: {p.stock}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <AddAmountModal show={showAddAmountModal} setShow={setShowAddAmountModal} handleQuickAdd={handleQuickAdd} />
    </div>
  );
}

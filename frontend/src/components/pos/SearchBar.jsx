import { useMemo, useState, useRef, useCallback } from 'react';
import { Icons } from '../ui/Icons';
import AddAmountModal from './AddAmountModal';
import CameraBarcodeScanner from '../ui/CameraBarcodeScanner';
import CatalogModal from './CatalogModal';
import VariantPicker from './VariantPicker';
import useIsMobile from '../../hooks/useIsMobile';
import { findProductByAnyCode } from '../../utils/productLookup';

export default function SearchBar({
  search, setSearch, searchRef, searchError, flash,
  productsDB, handleQuickAdd, setShowPriceCheck, addToast, handleEmptyEnter, listType
}) {
  const [showAddAmountModal, setShowAddAmountModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null); // producto padre esperando selección de variante

  const getPrice = (p) => {
    const map = { a: p.price, b: p.price_b, c: p.price_c, d: p.price_d, e: p.price_e };
    return (map[listType] || p.price) || 0;
  };

  // Agrega al carrito directo o abre el picker si tiene variantes
  const addOrPickVariant = useCallback((p) => {
    if (p.has_variants) {
      setVariantProduct(p);
    } else {
      handleQuickAdd(p.code, p.name, getPrice(p));
      setSearch('');
      searchRef.current?.focus();
    }
  }, [handleQuickAdd, getPrice, setSearch, searchRef]);
  const isMobile = useIsMobile();
  const lastScanRef = useRef({ code: '', time: 0 });

  const isDuplicateScan = useCallback((code) => {
    const now = Date.now();
    if (code === lastScanRef.current.code && now - lastScanRef.current.time < 3000) return true;
    lastScanRef.current = { code, time: now };
    return false;
  }, []);

  const playErrorBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }, []);

  const handleBarcodeScan = useCallback((code) => {
    if (!code || !productsDB) return;
    setSearch(code);
    const exact = findProductByAnyCode(productsDB, code);
    if (exact) {
      addToast(`Escaneado: ${exact.name}`, 'info');
      addOrPickVariant(exact);
      setSearch('');
      searchRef.current?.focus();
    } else {
      // Código no encontrado: seleccionar texto, beep de error, toast largo
      setTimeout(() => searchRef.current?.select(), 0);
      playErrorBeep();
      addToast(`Código no encontrado: ${code}`, 'warning', 3500);
    }
  }, [productsDB, addOrPickVariant, setSearch, searchRef, addToast, listType, playErrorBeep]);
  const autocomplete = useMemo(() => {
    if (!search.trim() || !productsDB) return [];
    return productsDB
      .filter(p => p.code?.startsWith(search) || (p.extra_codes || []).some(c => c?.startsWith(search)) || p.name?.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 5);
  }, [search, productsDB]);

  // Estilos de acción compactos (mobile) vs normales (desktop)
  const actionBtnStyle = isMobile
    ? { flex: 1, background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0 4px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', height: 52 }
    : { background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' };

  return (
    <div className="ledger-sheet" style={{ padding: isMobile ? '12px 12px' : '14px 18px' }}>
      {/* Desktop: título + botones en la misma fila */}
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <h2 className="ledger-title" style={{ fontSize: '1.25rem', marginBottom: 2 }}>Buscar producto</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Escaneá el código de barras o escribí el nombre</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowCatalog(true)} title="Ver catálogo" style={actionBtnStyle} onMouseEnter={e => e.currentTarget.style.background='var(--surface-veil)'} onMouseLeave={e => e.currentTarget.style.background='var(--bg-hover)'}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Ver catálogo
            </button>
            <button onClick={() => setShowPriceCheck(true)} title="Consultar Precio" style={actionBtnStyle} onMouseEnter={e => e.currentTarget.style.background='var(--surface-veil)'} onMouseLeave={e => e.currentTarget.style.background='var(--bg-hover)'}>
              <Icons.Search style={{ width: 15, height: 15 }} />Consultar Precio
            </button>
            <button onClick={() => setShowAddAmountModal(true)} title="Agregar Monto" style={actionBtnStyle} onMouseEnter={e => e.currentTarget.style.background='var(--surface-veil)'} onMouseLeave={e => e.currentTarget.style.background='var(--bg-hover)'}>
              <Icons.DollarSign style={{ width: 15, height: 15 }} />Agregar Monto
            </button>
          </div>
        </div>
      )}

      <div className={`search-bar ${flash ? 'flash' : ''}`} style={{ margin: 0, position: 'relative', borderColor: searchError ? 'var(--accent-danger)' : 'var(--border-color)', borderWidth: searchError ? '2px' : '1px' }}>
        <Icons.Search />
        <button onClick={() => setShowScanner(true)} title="Escanear con cámara" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.background = 'var(--wash-primary)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}>
          <Icons.Camera style={{ width: '18px', height: '18px' }} />
        </button>
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
              const codeMatch = findProductByAnyCode(productsDB, term);
              if (codeMatch && !isDuplicateScan(term)) { addOrPickVariant(codeMatch); setSearch(''); searchRef.current?.focus(); }
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
                const match = findProductByAnyCode(productsDB, productCode);
                if (match) {
                  if (isDuplicateScan(term)) return;
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
              const exact = findProductByAnyCode(productsDB, term);
              if (exact && !isDuplicateScan(term)) {
                addOrPickVariant(exact);
              } else if (autocomplete.length === 1 && !isDuplicateScan(term)) {
                addOrPickVariant(autocomplete[0]);
              }
            }
          }}
          autoFocus
        />
        {search.trim().length > 0 && autocomplete.length > 0 && (
          <div role="listbox" aria-label="Resultados de búsqueda" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '4px', boxShadow: 'var(--shadow-md)' }}>
            {autocomplete.map((p, i) => (
              <button
                id={`autocomplete-${i}`}
                key={p.id}
                onClick={() => addOrPickVariant(p)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addOrPickVariant(p);
                  if (e.key === 'ArrowDown') document.getElementById(`autocomplete-${i + 1}`)?.focus();
                  if (e.key === 'ArrowUp') { if (i === 0) searchRef.current?.focus(); else document.getElementById(`autocomplete-${i - 1}`)?.focus(); }
                }}
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', outline: 'none' }}
                onFocus={e => e.target.style.background = 'var(--bg-hover)'}
                onBlur={e => e.target.style.background = 'transparent'}
                onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.target.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  {p.has_variants && <span style={{ fontSize: '0.72rem', background: 'var(--wash-primary, rgba(20,187,166,0.12))', color: 'var(--accent-primary)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>Variantes</span>}
                </div>
                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
                  {!p.has_variants && <span>${getPrice(p)}</span>}
                  <span style={{ color: p.stock > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>Stock: {p.stock}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Mobile: fila de acciones debajo del campo de búsqueda */}
      {isMobile && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => setShowCatalog(true)} style={actionBtnStyle}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Catálogo
          </button>
          <button onClick={() => setShowPriceCheck(true)} style={actionBtnStyle}>
            <Icons.Search style={{ width: 18, height: 18, flexShrink: 0 }} />
            Precio
          </button>
          <button onClick={() => setShowAddAmountModal(true)} style={actionBtnStyle}>
            <Icons.DollarSign style={{ width: 18, height: 18, flexShrink: 0 }} />
            Monto
          </button>
        </div>
      )}

      {showScanner && (
        <CameraBarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}
      {showCatalog && (
        <CatalogModal
          products={productsDB}
          onSelect={p => {
            setShowCatalog(false);
            if (p.has_variants) { setVariantProduct(p); }
            else { handleQuickAdd(p.code, p.name, getPrice(p)); searchRef.current?.focus(); }
          }}
          onClose={() => setShowCatalog(false)}
          getPrice={getPrice}
        />
      )}
      {variantProduct && (
        <VariantPicker
          product={variantProduct}
          onSelect={v => { handleQuickAdd(v.code || variantProduct.code, v.variant_label || v.name, getPrice(v), v); searchRef.current?.focus(); }}
          onClose={() => setVariantProduct(null)}
          getPrice={getPrice}
        />
      )}
      <AddAmountModal show={showAddAmountModal} setShow={setShowAddAmountModal} handleQuickAdd={handleQuickAdd} />
    </div>
  );
}

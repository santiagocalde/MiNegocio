import { useState, useEffect, useMemo } from 'react';

const apiGet = url => fetch('/api' + url, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('access_token') || '') } }).then(r => r.ok ? r.json() : Promise.reject(r));
const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function EtiquetasModule() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [labelSize, setLabelSize] = useState('medium');

  const sizes = {
    small:  { w: 70,  h: 32, priceFont: 14, nameFont: 9  },
    medium: { w: 100, h: 48, priceFont: 18, nameFont: 11 },
    large:  { w: 130, h: 60, priceFont: 22, nameFont: 13 },
  };

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) return;
    const labelsHtml = selectedProducts.map(p => {
      const shortName = p.name.length > 22 ? p.name.slice(0, 20) + '...' : p.name;
      const barcode = s.h >= 45 ? `<div style="font-size:7px;color:#666;margin-top:1px">${p.code}</div>` : '';
      return `<div style="width:${s.w}mm;height:${s.h}mm;border:1px dashed #ccc;border-radius:3px;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:2mm;box-sizing:border-box;overflow:hidden;background:#fff;color:#111;font-family:Arial,sans-serif;page-break-inside:avoid">
        <div style="font-size:${s.nameFont}px;font-weight:700;text-align:center;line-height:1.1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${shortName}</div>
        <div style="font-size:${s.priceFont}px;font-weight:900;color:#111;line-height:1.1">$${formatPesos(p.price)}</div>
        ${barcode}
      </div>`;
    }).join('');
    printWin.document.write(`
      <html><head><title>Etiquetas Góndola</title>
      <style>@page { size: A4; margin: 8mm; } body { margin: 0; padding: 8mm; display: flex; flex-wrap: wrap; gap: 6mm; }</style>
      </head><body>${labelsHtml}</body></html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); printWin.close(); }, 300);
  };

  useEffect(() => {
    apiGet('/products?limit=9999').then(data => {
      setProducts(data || []);
      const cats = [...new Set((data || []).map(p => p.category_name).filter(Boolean))];
      setCategories(cats.sort());
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
    }
    if (catFilter) list = list.filter(p => p.category_name === catFilter);
    return list;
  }, [products, search, catFilter]);

  const toggleProduct = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map(p => p.id)));
  const clearAll = () => setSelected(new Set());

  const selectedProducts = products.filter(p => selected.has(p.id));
  const s = sizes[labelSize];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Etiquetas para Góndola</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selected.size} seleccionados</span>
      </div>

      {/* Filtros y controles */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={selectAll} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Todos</button>
        <button onClick={clearAll} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Ninguno</button>
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          {['small', 'medium', 'large'].map(k => (
            <button key={k} onClick={() => setLabelSize(k)} style={{
              padding: '6px 12px', borderRadius: '6px', border: labelSize === k ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: labelSize === k ? 'rgba(20,187,166,0.12)' : 'var(--bg-card)', color: labelSize === k ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', textTransform: 'capitalize'
            }}>
              {k === 'small' ? 'Chica' : k === 'medium' ? 'Mediana' : 'Grande'}
            </button>
          ))}
        </div>
        <button
          disabled={selected.size === 0}
          onClick={() => handlePrint()}
          style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: 800, fontSize: '0.9rem', cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            background: selected.size === 0 ? 'var(--bg-hover)' : 'var(--gradient-primary)', color: selected.size === 0 ? 'var(--text-secondary)' : 'white',
            opacity: selected.size === 0 ? 0.5 : 1,
          }}
        >
          Imprimir {selected.size} etiquetas
        </button>
      </div>

      {/* Vista dividida: productos a seleccionar + preview de etiquetas */}
      <div style={{ flex: 1, display: 'flex', gap: '12px', minHeight: 0, overflow: 'hidden' }}>
        {/* Lista de productos */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Productos ({filtered.length})
          </div>
          {filtered.slice(0, 500).map(p => (
            <div
              key={p.id}
              onClick={() => toggleProduct(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.85rem',
                background: selected.has(p.id) ? 'rgba(20,187,166,0.08)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!selected.has(p.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => { if (!selected.has(p.id)) e.currentTarget.style.background = 'transparent'; }}
            >
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => {}} style={{ accentColor: '#14BBA6' }} />
              <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                ${formatPesos(p.price)}
              </span>
            </div>
          ))}
        </div>

        {/* Preview de etiquetas */}
        <div style={{ flex: selectedProducts.length > 0 ? 1.2 : 0.4, minWidth: 0, overflowY: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
            Vista previa · {selectedProducts.length} etiquetas · Tamaño {labelSize === 'small' ? 'chico' : labelSize === 'medium' ? 'mediano' : 'grande'}
          </div>
          <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', background: 'white' }}>
            {selectedProducts.map(p => (
              <div key={p.id} style={{
                width: s.w + 'mm', height: s.h + 'mm', border: '1px dashed #ccc', borderRadius: '3px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                padding: '2mm', boxSizing: 'border-box', overflow: 'hidden',
                background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif',
                pageBreakInside: 'avoid',
              }}>
                <div style={{ fontSize: s.nameFont + 'px', fontWeight: 700, textAlign: 'center', lineHeight: 1.1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name.length > 22 ? p.name.slice(0, 20) + '...' : p.name}
                </div>
                <div style={{ fontSize: s.priceFont + 'px', fontWeight: 900, color: '#111', lineHeight: 1.1 }}>
                  ${formatPesos(p.price)}
                </div>
                {s.h >= 45 && (
                  <div style={{ fontSize: '7px', color: '#666', marginTop: '1px' }}>
                    {p.code}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

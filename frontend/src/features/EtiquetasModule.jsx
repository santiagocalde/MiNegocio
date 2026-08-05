import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiGet } from '../services/apiClient';

const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const A4_MM = [210, 297];
const MARGIN_MM = 8;
const GAP_MM = 5;
const MM_TO_PX = 3.78;
const PREVIEW_SCALE = 0.48;

const SIZE_PRESETS = {
  small:  { mm: [70, 32],  priceFont: 13, nameFont: 8  },
  medium: { mm: [100, 48], priceFont: 18, nameFont: 11 },
  large:  { mm: [130, 60], priceFont: 22, nameFont: 13 },
};

function calcLayout(labelSize) {
  const [lw, lh] = SIZE_PRESETS[labelSize].mm;
  const usableW = A4_MM[0] - MARGIN_MM * 2;
  const usableH = A4_MM[1] - MARGIN_MM * 2;
  const cols = Math.max(1, Math.floor((usableW + GAP_MM) / (lw + GAP_MM)));
  const rows = Math.max(1, Math.floor((usableH + GAP_MM) / (lh + GAP_MM)));
  return { cols, rows, perPage: cols * rows, lw, lh };
}

export default function EtiquetasModule() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [labelSize, setLabelSize] = useState('medium');
  const [previewPage, setPreviewPage] = useState(0);
  const printFrameRef = useRef(null);

  const layout = useMemo(() => calcLayout(labelSize), [labelSize]);
  const presets = SIZE_PRESETS[labelSize];

  const selectedProducts = useMemo(() => products.filter(p => selected.has(p.id)), [products, selected]);

  const pages = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < selectedProducts.length; i += layout.perPage) {
      chunks.push(selectedProducts.slice(i, i + layout.perPage));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [selectedProducts, layout.perPage]);

  const maxPerPage = layout.perPage;
  const totalPages = pages.length;

  const handlePrint = useCallback(() => {
    if (!printFrameRef.current) return;
    const frame = printFrameRef.current;
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();

    const pagesHtml = pages.map((pageProducts, pi) => {
      const labelsHtml = pageProducts.map(p => {
        const shortName = p.name.length > 20 ? p.name.slice(0, 18) + '..' : p.name;
        const barcode = presets.mm[1] >= 45 ? `<div class="lbl-code">${p.code}</div>` : '';
        return `<div class="label" style="width:${layout.lw}mm;height:${layout.lh}mm">
          <div class="lbl-name" style="font-size:${presets.nameFont}px">${shortName}</div>
          <div class="lbl-price" style="font-size:${presets.priceFont}px">$${formatPesos(p.price)}</div>
          ${barcode}
        </div>`;
      }).join('');
      return `<div class="page">${labelsHtml}</div>`;
    }).join('');

    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas Góndola</title>
<style>
  @page { size: A4; margin: ${MARGIN_MM}mm; }
  body { margin: 0; font-family: Arial, sans-serif; }
  .page { width: ${A4_MM[0]}mm; height: ${A4_MM[1]}mm; padding: ${MARGIN_MM}mm; box-sizing: border-box;
          display: flex; flex-wrap: wrap; gap: ${GAP_MM}mm; align-content: flex-start;
          page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .label { border: 1px dashed #aaa; border-radius: 2px; display: flex; flex-direction: column;
           justify-content: center; align-items: center; padding: 1mm 2mm; box-sizing: border-box;
           overflow: hidden; }
  .lbl-name { font-weight: 700; text-align: center; line-height: 1.1; max-width: 100%;
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lbl-price { font-weight: 900; line-height: 1.1; }
  .lbl-code { font-size: 6px; color: #999; margin-top: 1px; }
</style></head><body>${pagesHtml}</body></html>`);
    doc.close();
    setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); }, 200);
  }, [pages, layout, presets]);

  useEffect(() => {
    apiGet('/products?limit=9999').then(r => r.ok && r.json()).then(data => {
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
    const sel = new Set(selected);
    sel.has(id) ? sel.delete(id) : sel.add(id);
    setSelected(sel);
  };

  const isFull = selectedProducts.length >= maxPerPage;
  const wrappedPage = ((previewPage % totalPages) + totalPages) % totalPages;
  const currentPage = pages[wrappedPage] || [];

  const canAdd = (id) => selected.has(id) || !isFull;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
      <iframe ref={printFrameRef} title="print-frame" style={{ display: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Etiquetas para Góndola</h2>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {['small', 'medium', 'large'].map(k => (
            <button key={k} onClick={() => setLabelSize(k)} style={{
              padding: '5px 10px', borderRadius: '5px', border: labelSize === k ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              background: labelSize === k ? 'rgba(20,187,166,0.12)' : 'var(--bg-card)', color: labelSize === k ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem', textTransform: 'capitalize'
            }}>
              {k === 'small' ? 'Chica' : k === 'medium' ? 'Mediana' : 'Grande'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
        <input type="text" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}>
          <option value="">Todas</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setSelected(new Set(filtered.map(p => p.id).slice(0, maxPerPage)))}
          style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>Todos</button>
        <button onClick={() => setSelected(new Set())}
          style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>Ninguno</button>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
          {selected.size}/{maxPerPage}
        </span>
        <button disabled={selected.size === 0} onClick={handlePrint} style={{
          marginLeft: 'auto', padding: '7px 18px', borderRadius: '6px', border: 'none', fontWeight: 800, fontSize: '0.85rem',
          cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
          background: selected.size === 0 ? 'var(--bg-hover)' : 'var(--gradient-primary)',
          color: selected.size === 0 ? 'var(--text-secondary)' : 'white', opacity: selected.size === 0 ? 0.5 : 1,
        }}>
          Imprimir {totalPages} {totalPages === 1 ? 'página' : 'páginas'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '8px', minHeight: 0, overflow: 'hidden' }}>
        {/* Lista de productos */}
        <div style={{ width: '340px', minWidth: '260px', flexShrink: 0, overflowY: 'auto', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
            Productos ({filtered.length})
            {isFull && <span style={{ color: 'var(--accent-warning)', marginLeft: 8 }}>· hoja llena</span>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.slice(0, 500).map(p => {
              const checked = selected.has(p.id);
              const disabled = !checked && isFull;
              return (
                <div key={p.id}
                  onClick={() => !disabled && toggleProduct(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', cursor: disabled ? 'not-allowed' : 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.82rem',
                    background: checked ? 'rgba(20,187,166,0.08)' : 'transparent',
                    opacity: disabled ? 0.4 : 1,
                    transition: 'background 0.15s',
                  }}
                >
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => {}} style={{ accentColor: '#14BBA6', flexShrink: 0, width: 15, height: 15 }} />
                  <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>${formatPesos(p.price)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview: A4 pages */}
        <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Vista previa · página {wrappedPage + 1} de {totalPages} · {presets.mm[0]}×{presets.mm[1]}mm
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setPreviewPage(p => Math.max(0, p - 1))} disabled={wrappedPage === 0}
                style={{ padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: wrappedPage === 0 ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: wrappedPage === 0 ? 'default' : 'pointer', fontSize: '0.75rem', fontWeight: 700, opacity: wrappedPage === 0 ? 0.4 : 1 }}>←</button>
              <button onClick={() => setPreviewPage(p => p + 1)} disabled={wrappedPage >= totalPages - 1}
                style={{ padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: wrappedPage >= totalPages - 1 ? 'var(--text-secondary)' : 'var(--text-primary)', cursor: wrappedPage >= totalPages - 1 ? 'default' : 'pointer', fontSize: '0.75rem', fontWeight: 700, opacity: wrappedPage >= totalPages - 1 ? 0.4 : 1 }}>→</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '10px', display: 'flex', justifyContent: 'center', background: '#e2e6ea' }}>
            {selectedProducts.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', alignSelf: 'center', textAlign: 'center', padding: 20 }}>
                Seleccioná productos de la izquierda<br/>para previsualizar las etiquetas<br/><br/>
                <span style={{ fontSize: '0.7rem' }}>{maxPerPage} etiquetas por hoja A4 (tamaño {labelSize === 'small' ? 'chico' : labelSize === 'medium' ? 'mediano' : 'grande'})</span>
              </div>
            ) : (
              <div style={{
                width: Math.round(A4_MM[0] * MM_TO_PX * PREVIEW_SCALE),
                minHeight: Math.round(A4_MM[1] * MM_TO_PX * PREVIEW_SCALE),
                background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
                padding: Math.round(MARGIN_MM * MM_TO_PX * PREVIEW_SCALE),
                display: 'flex', flexWrap: 'wrap', gap: Math.round(GAP_MM * MM_TO_PX * PREVIEW_SCALE),
                alignContent: 'flex-start', boxSizing: 'border-box',
              }}>
                {currentPage.map(p => {
                  const shortName = p.name.length > 16 ? p.name.slice(0, 14) + '..' : p.name;
                  const LW = Math.round(layout.lw * MM_TO_PX * PREVIEW_SCALE);
                  const LH = Math.round(layout.lh * MM_TO_PX * PREVIEW_SCALE);
                  const NF = Math.max(6, Math.round(presets.nameFont * PREVIEW_SCALE * 0.9));
                  const PF = Math.max(8, Math.round(presets.priceFont * PREVIEW_SCALE * 0.9));
                  return (
                    <div key={p.id} style={{
                      width: LW, height: LH,
                      border: '1px dashed #ccc', borderRadius: '2px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                      padding: '1px 2px', boxSizing: 'border-box', overflow: 'hidden',
                      background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif',
                      flexShrink: 0,
                    }}>
                      <div style={{ fontSize: NF, fontWeight: 700, textAlign: 'center', lineHeight: 1.1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {shortName}
                      </div>
                      <div style={{ fontSize: PF, fontWeight: 900, color: '#111', lineHeight: 1.1 }}>
                        ${formatPesos(p.price)}
                      </div>
                      {presets.mm[1] >= 45 && (
                        <div style={{ fontSize: Math.max(4, Math.round(5 * PREVIEW_SCALE)), color: '#999', marginTop: '1px' }}>
                          {p.code}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Fill remaining slots with empty placeholders */}
                {Array.from({ length: maxPerPage - currentPage.length }, (_, i) => (
                  <div key={`empty-${i}`} style={{
                    width: Math.round(layout.lw * MM_TO_PX * PREVIEW_SCALE),
                    height: Math.round(layout.lh * MM_TO_PX * PREVIEW_SCALE),
                    border: '1px dashed #eee', borderRadius: '2px',
                    background: '#fafafa', flexShrink: 0,
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

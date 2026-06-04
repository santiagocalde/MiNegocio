// StockModule recibe serverUrl como prop desde App.jsx (http://localhost:8000/api)
import React, { useState, useEffect, useRef } from 'react';

const Icons = {
  Search: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Plus: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>,
  Minus: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>,
  Edit: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Check: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  X: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>,
  Alert: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Box: () => <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
};

function getStockStatus(stock, minStock) {
  if (stock === 0) return 'empty';
  if (stock < minStock) return 'low';
  return 'ok';
}

function ProductCard({ product, onPriceUpdate, onStockUpdate, onCrearBulto, addToast }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingStock, setEditingStock] = useState(false);
  const [priceVal, setPriceVal] = useState(product.price.toString());
  const [stockVal, setStockVal] = useState(product.stock.toString());
  const [saving, setSaving] = useState(false);
  const priceRef = useRef(null);
  const stockRef = useRef(null);

  const status = getStockStatus(product.stock, product.min_stock);
  const profit = product.price - (product.cost_price || 0);
  const marginPercent = product.cost_price > 0 && product.price > 0 ? Math.round((profit / product.price) * 100) : 0;
  const marginColor = marginPercent > 20 ? 'var(--accent-success)' : marginPercent > 10 ? 'var(--accent-warning)' : 'var(--accent-danger)';

  const handlePriceClick = () => {
    setPriceVal(product.price.toString());
    setEditingPrice(true);
    setTimeout(() => priceRef.current?.focus(), 50);
  };

  const handlePriceSave = async () => {
    const val = parseInt(priceVal);
    if (!isNaN(val) && val > 0 && val !== product.price) {
      setSaving(true);
      await onPriceUpdate(product.id, val);
      setSaving(false);
    }
    setEditingPrice(false);
  };

  const handleStockEdit = () => {
    setStockVal(product.stock.toString());
    setEditingStock(true);
    setTimeout(() => stockRef.current?.focus(), 50);
  };

  const handleStockSave = async () => {
    const val = parseInt(stockVal);
    if (!isNaN(val) && val >= 0 && val !== product.stock) {
      setSaving(true);
      await onStockUpdate(product.id, val);
      setSaving(false);
    }
    setEditingStock(false);
  };

  const handleQuickStock = async (delta) => {
    const newStock = Math.max(0, product.stock + delta);
    if (newStock !== product.stock) {
      setSaving(true);
      await onStockUpdate(product.id, newStock);
      setSaving(false);
    }
  };

  const cardBorder = status === 'empty'
    ? '2px solid rgba(239,68,68,0.5)'
    : status === 'low'
      ? '2px solid rgba(234,179,8,0.4)'
      : '1px solid var(--border-color)';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: cardBorder,
      borderRadius: '12px',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      opacity: saving ? 0.7 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Info del producto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {product.is_virtual === 1 ? '📦' : ''} {product.name}
          {product.is_virtual === 1 && (
            <span style={{ fontSize: '0.8rem', background: 'rgba(168, 85, 247, 0.15)', color: '#A855F7', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              Bulto x{product.pack_size} ({product.parent_name})
            </span>
          )}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Código: {product.code}</span>
          {product.category_name && <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.2)' }}>{product.category_name}</span>}
          {product.is_virtual === 0 && (
            <button onClick={() => onCrearBulto(product)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', padding: '2px 8px', fontSize: '0.75rem' }}>+ Crear Bulto</button>
          )}
          {product.is_virtual === 1 && (
            <button onClick={async () => {
              if (product.stock <= 0) return addToast ? addToast("No hay cajas en stock para abrir.", "error") : alert("No hay cajas en stock para abrir.");
              try {
                const res = await fetch(`http://localhost:8000/api/products/${product.id}/unpack`, { method: 'POST' });
                if (res.ok) {
                  if (addToast) addToast("Caja abierta exitosamente. Unidades agregadas al stock.");
                  setTimeout(() => window.location.reload(), 1000); // Dar un segundo para leer el toast
                } else {
                  const data = await res.json();
                  if (addToast) addToast(data.detail || "Error al abrir el bulto.", "error");
                }
} catch {
      if (addToast) addToast("No se pudo abrir el bulto. Verificá la conexión con el servidor.", "error");
    }
            }} style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '4px', color: '#A855F7', cursor: 'pointer', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>📦 Abrir Caja (Pasar a Sueltos)</button>
          )}
          {status === 'empty' && <span style={{ color: 'var(--accent-danger)', fontWeight: 700 }}>🔴 SE TERMINÓ</span>}
          {status === 'low' && <span style={{ color: 'var(--accent-warning)', fontWeight: 700 }}>⚠️ Stock bajo (mín. {product.min_stock})</span>}
        </div>
      </div>

      {/* PRECIO (editable al click) */}
      <div style={{ textAlign: 'center', minWidth: '130px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Precio Venta</div>
        {editingPrice ? (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              ref={priceRef}
              type="number"
              value={priceVal}
              onChange={e => setPriceVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePriceSave(); if (e.key === 'Escape') setEditingPrice(false); }}
              style={{
                width: '90px', background: 'var(--bg-main)', border: '2px solid var(--border-focus)',
                color: 'var(--text-primary)', borderRadius: '8px', padding: '8px', fontSize: '1.2rem',
                fontFamily: 'var(--font-mono)', textAlign: 'center', outline: 'none',
              }}
            />
            <button onClick={handlePriceSave} style={{ background: 'rgba(34,197,94,0.15)', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Check /></button>
            <button onClick={() => setEditingPrice(false)} style={{ background: 'transparent', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.X /></button>
          </div>
        ) : (
          <div
            onClick={handlePriceClick}
            title="Click para editar precio"
            style={{
              fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
              cursor: 'pointer', padding: '8px 12px', borderRadius: '8px',
              border: '1px dashed var(--border-color)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            ${product.price.toLocaleString('es-AR')}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '6px', display: 'block', marginTop: '2px' }}>✎ clic para editar</span>
          </div>
        )}
      </div>

      {/* Costo y Margen */}
      <div style={{ textAlign: 'center', minWidth: '150px', padding: '0 8px' }}>
        {product.cost_price > 0 && (
          <>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Costo y Ganancia</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
              Costo: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>${product.cost_price.toLocaleString('es-AR')}</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: marginColor }}>
              Ganancia: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>${profit.toLocaleString('es-AR')}</span> ({marginPercent}%)
            </div>
          </>
        )}
      </div>

      {/* STOCK (controles +/-/editar) */}
      <div style={{ textAlign: 'center', minWidth: '180px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {product.is_virtual === 1 ? 'Cajas Cerradas' : 'Stock'}
        </div>
        {editingStock ? (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
            <input
              ref={stockRef}
              type="number"
              value={stockVal}
              min="0"
              onChange={e => setStockVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleStockSave(); if (e.key === 'Escape') setEditingStock(false); }}
              style={{
                width: '80px', background: 'var(--bg-main)', border: '2px solid var(--border-focus)',
                color: 'var(--text-primary)', borderRadius: '8px', padding: '8px', fontSize: '1.5rem',
                fontFamily: 'var(--font-mono)', textAlign: 'center', outline: 'none',
              }}
            />
            <button onClick={handleStockSave} style={{ background: 'rgba(34,197,94,0.15)', border: 'none', borderRadius: '6px', width: '36px', height: '36px', cursor: 'pointer', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Check /></button>
            <button onClick={() => setEditingStock(false)} style={{ background: 'transparent', border: 'none', borderRadius: '6px', width: '36px', height: '36px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.X /></button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={() => handleQuickStock(-1)}
              style={{
                width: '40px', height: '40px', background: 'var(--bg-main)', border: '1px solid var(--border-color)',
                borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><Icons.Minus /></button>

            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, minWidth: '50px', textAlign: 'center',
              color: status === 'empty' ? 'var(--accent-danger)' : status === 'low' ? 'var(--accent-warning)' : 'var(--text-primary)',
            }}>
              {product.stock}
            </span>

            <button
              onClick={() => handleQuickStock(1)}
              style={{
                width: '40px', height: '40px', background: 'var(--bg-main)', border: '1px solid var(--border-color)',
                borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><Icons.Plus /></button>

            <button
              onClick={handleStockEdit}
              title="Ingresar cantidad exacta"
              style={{
                width: '36px', height: '36px', background: 'transparent', border: '1px dashed var(--border-color)',
                borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><Icons.Edit /></button>
          </div>
        )}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>mín. {product.min_stock} u.</div>
      </div>
    </div>
  );
}

function NewProductModal({ onClose, onSave, categories }) {
  const [formData, setFormData] = useState({ code: '', name: '', price: '', stock: '', min_stock: '5', category_id: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      code: formData.code,
      name: formData.name,
      price: parseFloat(formData.price) || 0,
      stock: parseInt(formData.stock) || 0,
      min_stock: parseInt(formData.min_stock) || 5,
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
    });
    setSaving(false);
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)',
    color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', fontSize: '1rem',
    outline: 'none', marginBottom: '16px'
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>📦 Nuevo Producto</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Código de Barras</label>
          <input required autoFocus type="text" style={inputStyle} value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: 779..." />

          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre y descripción</label>
          <input required type="text" style={inputStyle} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Coca Cola 500ml" />

          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Categoría</label>
          <select style={inputStyle} value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })}>
            <option value="">-- Sin categoría --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Precio Venta</label>
              <input required type="number" min="0" step="0.01" style={inputStyle} value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="$" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Stock Inicial</label>
              <input required type="number" min="0" style={inputStyle} value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="0" />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-modal-confirm" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BatchIncreaseModal({ onClose, onConfirm, categories }) {
  const [percent, setPercent] = useState('10');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem', marginBottom: '24px', color: 'var(--accent-warning)' }}>📈 Aumento Masivo</h2>

        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Seleccione a qué aplicar el aumento:</label>
        <select style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', fontSize: '1rem', outline: 'none', marginBottom: '16px' }} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">🌍 TODO EL INVENTARIO</option>
          {categories.map(c => <option key={c.id} value={c.id}>📁 Solo {c.name}</option>)}
        </select>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Porcentaje de aumento (usá negativo para descuento):</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <input
            type="number"
            autoFocus
            value={percent}
            onChange={e => setPercent(e.target.value)}
            style={{ width: '100px', background: 'var(--bg-main)', border: '2px solid var(--accent-warning)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', fontSize: '2rem', textAlign: 'center', outline: 'none' }}
          />
          <span style={{ fontSize: '2rem', color: 'var(--text-secondary)' }}>%</span>
        </div>
        <div className="modal-actions">
          <button className="btn btn-modal-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-warning)', color: 'black' }} onClick={async () => {
            setSaving(true);
            await onConfirm(parseFloat(percent), categoryId ? parseInt(categoryId) : null);
            setSaving(false);
          }} disabled={saving || !percent || parseFloat(percent) === 0}>
            {saving ? 'Aplicando...' : 'Aplicar Aumento'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewVirtualModal({ onClose, onSave, parentProduct }) {
  const [formData, setFormData] = useState({ code: '', name: `Bulto x24 ${parentProduct.name}`, price: '', pack_size: '24' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const size = parseInt(formData.pack_size) || 1;
    setFormData(prev => ({ ...prev, price: (parentProduct.price * size).toString() }));
  }, [formData.pack_size, parentProduct.price]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      code: formData.code,
      name: formData.name,
      price: parseFloat(formData.price) || 0,
      stock: 0,
      min_stock: 0,
      category_id: parentProduct.category_id,
      is_virtual: true,
      parent_id: parentProduct.id,
      pack_size: parseInt(formData.pack_size) || 1,
    });
    setSaving(false);
  };

  const inputStyle = { width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', fontSize: '1rem', outline: 'none', marginBottom: '16px' };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem', marginBottom: '8px', color: '#A855F7' }}>📦 Crear Bulto</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: '1.4' }}>
          Este producto derivará de: <strong style={{ color: 'var(--text-primary)' }}>{parentProduct.name}</strong>.<br />
          Ideal para kioscos: Vendes la "caja cerrada" y el sistema resta automáticamente las unidades sueltas correspondientes del stock.
        </p>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Código de Barras del Bulto</label>
          <input required autoFocus type="text" style={inputStyle} value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: 779... (Código de la caja)" />

          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Nombre Descriptivo</label>
          <input required type="text" style={inputStyle} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Precio Venta (Bulto)</label>
              <input required type="number" min="0.01" step="0.01" style={inputStyle} value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="$" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Unidades x Bulto</label>
              <input required type="number" min="1" style={inputStyle} value={formData.pack_size} onChange={e => setFormData({ ...formData, pack_size: e.target.value })} placeholder="Ej: 24" />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="btn btn-modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-modal-confirm" style={{ background: '#A855F7', color: 'white' }} disabled={saving}>
              {saving ? 'Creando...' : 'Crear Bulto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StockModule({ serverUrl, onProductsUpdated, addToast, products: globalProductsDB }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(null); // { productId, field }
  const [filter, setFilter] = useState('all'); // all | low | empty
  const [showNewModal, setShowNewModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [creatingVirtualFor, setCreatingVirtualFor] = useState(null);
  const searchRef = useRef(null);

  const fetchProducts = async (q = '') => {
    setLoading(true);
    try {
      const url = q ? `${serverUrl}/products?q=${encodeURIComponent(q)}` : `${serverUrl}/products`;
      const res = await fetch(url);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${serverUrl}/categories`);
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch { }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    searchRef.current?.focus();
  }, []);

  const handleSearch = (e) => {
    if (e.key === 'Enter') fetchProducts(query);
  };

  const handlePriceUpdate = async (id, price) => {
    try {
      await fetch(`${serverUrl}/products/${id}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, operator: 'Turno 1' }),
      });
    } catch { /* offline: update local only */ }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, price } : p));
    setSaved({ id, field: 'price' });
    setTimeout(() => setSaved(null), 2000);
    onProductsUpdated?.();
  };

  const handleStockUpdate = async (id, stock) => {
    try {
      await fetch(`${serverUrl}/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock, operator: 'Turno 1' }),
      });
    } catch { /* offline: update local only */ }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, stock } : p));
    setSaved({ id, field: 'stock' });
    setTimeout(() => setSaved(null), 2000);
    if (addToast) addToast("Stock actualizado correctamente", "success");
    onProductsUpdated?.();
  };

  const handleCreateProduct = async (productData) => {
    try {
      const res = await fetch(`${serverUrl}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      if (res.ok) {
        await fetchProducts();
        setShowNewModal(false);
        setCreatingVirtualFor(null);
        if (addToast) addToast("Producto creado correctamente", "success");
        onProductsUpdated?.();
      } else {
        if (addToast) addToast("Error al crear. ¿El código ya existe?", "error");
      }
    } catch {
      if (addToast) addToast("No se pudo crear el producto. Verificá la conexión con el servidor.", "error");
    }
  };

  const handleBatchIncrease = async (percentage, categoryId) => {
    try {
      const res = await fetch(`${serverUrl}/products/batch-increase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage, operator: 'Turno 1', category_id: categoryId }),
      });
      if (res.ok) {
        await fetchProducts();
        setShowBatchModal(false);
        if (addToast) addToast(`¡Precios aumentados un ${percentage}% con éxito!`, "success");
        onProductsUpdated?.();
      }
    } catch {
      if (addToast) addToast("No se pudieron actualizar los precios. Verificá la conexión con el servidor.", "error");
    }
  };

  const filteredProducts = products.filter(p => {
    if (filter === 'empty') return p.stock === 0;
    if (filter === 'low') return p.stock > 0 && p.stock < p.min_stock;
    return true;
  });

  const emptyCount = products.filter(p => p.stock === 0).length;
  const lowCount = products.filter(p => p.stock > 0 && p.stock < p.min_stock).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>

        {/* Alertas de stock */}
        {(emptyCount > 0 || lowCount > 0) && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {emptyCount > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 16px', color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.9rem' }}>
                🔴 {emptyCount} producto{emptyCount > 1 ? 's' : ''} SIN STOCK — ¡Hacer pedido!
              </div>
            )}
            {lowCount > 0 && (
              <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '8px', padding: '10px 16px', color: 'var(--accent-warning)', fontWeight: 700, fontSize: '0.9rem' }}>
                ⚠️ {lowCount} producto{lowCount > 1 ? 's' : ''} con stock bajo
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Buscador */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-main)', border: '2px solid var(--border-color)', borderRadius: '10px', padding: '0 16px', height: '52px', position: 'relative' }}>
            <Icons.Search />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                if (e.target.value.trim() === '') fetchProducts('');
              }}
              onKeyDown={handleSearch}
              placeholder="Busca: Coca, Cerveza, código 001... (Enter)"
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', outline: 'none' }}
            />
            {query.trim().length > 0 && globalProductsDB && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                {globalProductsDB.filter(p => p.code.startsWith(query) || p.name.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setQuery(p.name); fetchProducts(p.name); }}
                    style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                    onFocus={e => e.target.style.background = 'var(--bg-hover)'}
                    onBlur={e => e.target.style.background = 'transparent'}
                    onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}
                  >
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => fetchProducts(query)}
            style={{ height: '52px', padding: '0 24px', background: 'var(--accent-primary)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
          >Buscar</button>
          <button
            onClick={() => setShowNewModal(true)}
            style={{ height: '52px', padding: '0 24px', background: 'var(--accent-success)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Icons.Plus /> Nuevo
          </button>
          <button
            onClick={() => setShowBatchModal(true)}
            style={{ height: '52px', padding: '0 24px', background: 'transparent', border: '1px solid var(--accent-warning)', borderRadius: '10px', color: 'var(--accent-warning)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            📈 Aumento Masivo
          </button>
        </div>

        {/* Filtros rápidos */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {[
            { key: 'all', label: `Todos (${products.length})` },
            { key: 'empty', label: `🔴 Sin stock (${emptyCount})` },
            { key: 'low', label: `⚠️ Stock bajo (${lowCount})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px', borderRadius: '99px', border: '1px solid',
                borderColor: filter === f.key ? 'var(--accent-primary)' : 'var(--border-color)',
                background: filter === f.key ? 'rgba(59,130,246,0.1)' : 'transparent',
                color: filter === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}
            >{f.label}</button>
          ))}

          {saved && (
            <span style={{ marginLeft: 'auto', color: 'var(--accent-success)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✅ Guardado
            </span>
          )}
        </div>
      </div>

      {/* Lista de productos */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>Cargando productos...</div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Icons.Box />
            <div>
              <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>No se encontraron productos</p>
              <p style={{ marginTop: '8px' }}>Probá buscar por nombre o código de barras</p>
            </div>
          </div>
        )}

        {!loading && filteredProducts.slice(0, visibleCount).map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onPriceUpdate={handlePriceUpdate}
            onStockUpdate={handleStockUpdate}
            onCrearBulto={setCreatingVirtualFor}
            addToast={addToast}
          />
        ))}

        {!loading && visibleCount < filteredProducts.length && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', padding: '16px' }}>
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              style={{ padding: '12px 32px', background: 'var(--bg-card)', border: '1px solid var(--accent-primary)', borderRadius: '8px', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
            >
              Ver más (+50)
            </button>
            <button
              onClick={() => setVisibleCount(filteredProducts.length)}
              style={{ padding: '12px 32px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
            >
              Ver todos ({filteredProducts.length})
            </button>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewProductModal
          categories={categories}
          onClose={() => setShowNewModal(false)}
          onSave={handleCreateProduct}
        />
      )}

      {showBatchModal && (
        <BatchIncreaseModal
          categories={categories}
          onClose={() => setShowBatchModal(false)}
          onConfirm={handleBatchIncrease}
        />
      )}

      {creatingVirtualFor && (
        <NewVirtualModal
          parentProduct={creatingVirtualFor}
          onClose={() => setCreatingVirtualFor(null)}
          onSave={handleCreateProduct}
        />
      )}
    </div>
  );
}

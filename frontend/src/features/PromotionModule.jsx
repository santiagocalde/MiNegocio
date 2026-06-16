import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/apiClient';

const Icons = {
  Plus: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  X: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
  ToggleLeft: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  ToggleRight: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Close: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
};

export default function PromotionModule() {
  const navigate = useNavigate();
  const { addToast } = usePanelContext();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'combo',
    combo_price: '',
    discount_percent: '',
    conditions: []
  });

  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/promotions/all');
      if (res.ok) {
        const data = await res.json();
        setPromotions(Array.isArray(data) ? data : []);
      } else {
        setPromotions([]);
      }
    } catch {
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleToggleActive = async (promo) => {
    try {
      const res = await apiPut(`/promotions/${promo.id}`, { is_active: !promo.is_active });
      if (res.ok) {
        fetchPromotions();
        addToast(`Promocion ${promo.is_active ? 'desactivada' : 'activada'}.`, 'success');
      }
    } catch { addToast('Error de conexion.', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar esta promocion?')) return;
    try {
      const res = await apiDelete(`/promotions/${id}`);
      if (res.ok) {
        setPromotions(prev => prev.filter(p => p.id !== id));
        addToast('Promocion eliminada.', 'success');
      } else {
        addToast('Error al eliminar.', 'error');
      }
    } catch { addToast('Error de conexion.', 'error'); }
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      type: 'combo',
      combo_price: '',
      discount_percent: '',
      conditions: []
    });
    setProductQuery('');
    setProductResults([]);
  };

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  const searchTimer = useRef(null);
  const handleProductSearch = async (q) => {
    setProductQuery(q);
    if (!q.trim()) {
      setProductResults([]);
      setShowProductDropdown(false);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await apiGet(`/products?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setProductResults(Array.isArray(data) ? data : []);
          setShowProductDropdown(true);
        }
      } catch (e) { console.error(e) }
    }, 300);
  };

  const handleAddCondition = (product) => {
    const exists = form.conditions.find(c => c.product_id === product.id);
    if (exists) return;
    setForm({
      ...form,
      conditions: [...form.conditions, { product_id: product.id, product_name: product.name, min_qty: 1 }]
    });
    setProductQuery('');
    setProductResults([]);
    setShowProductDropdown(false);
  };

  const handleRemoveCondition = (productId) => {
    setForm({
      ...form,
      conditions: form.conditions.filter(c => c.product_id !== productId)
    });
  };

  const handleConditionQtyChange = (productId, value) => {
    setForm({
      ...form,
      conditions: form.conditions.map(c =>
        c.product_id === productId ? { ...c, min_qty: Math.max(1, parseInt(value) || 1) } : c
      )
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return addToast('El nombre es obligatorio.', 'error');
    if (form.conditions.length === 0) return addToast('Agregá al menos un producto a la promoción.', 'error');
    if (form.type === 'combo' && (!form.combo_price || parseFloat(form.combo_price) <= 0)) return addToast('El precio del combo debe ser mayor a $0.', 'error');
    if (form.type === 'discount' && (!form.discount_percent || parseFloat(form.discount_percent) <= 0 || parseFloat(form.discount_percent) > 100)) return addToast('El descuento debe ser entre 1% y 100%.', 'error');
    const payload = {
      name: form.name,
      description: form.description,
      type: form.type,
      combo_price: form.type === 'combo' ? parseFloat(form.combo_price) || 0 : null,
      discount_percent: form.type === 'discount' ? parseFloat(form.discount_percent) || 0 : null,
      conditions: form.conditions.map(c => ({
        product_id: c.product_id,
        min_qty: c.min_qty
      }))
    };
    try {
      const res = await apiPost('/promotions', payload);
      if (res.ok) {
        addToast('Promocion creada correctamente.', 'success');
        setShowModal(false);
        resetForm();
        fetchPromotions();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Error al crear promocion.', 'error');
      }
    } catch { addToast('Error de conexion.', 'error'); }
  };

  const getTypeLabel = (type) => {
    if (type === 'combo') return 'Combo (Precio Fijo)';
    if (type === 'discount') return 'Descuento por Porcentaje';
    return type;
  };

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Promociones</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Gestión de combos y descuentos especiales.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleOpenModal} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Icons.Plus /> Nueva Promoción
          </button>
          <button onClick={() => navigate('/panel/ventas')} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.Close /> Cerrar
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
              <tr style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px' }}>Nombre</th>
                <th style={{ padding: '16px 24px' }}>Tipo</th>
                <th style={{ padding: '16px 24px' }}>Descuento %</th>
                <th style={{ padding: '16px 24px' }}>Precio Combo</th>
                <th style={{ padding: '16px 24px' }}>Estado</th>
                <th style={{ padding: '16px 24px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>Cargando promociones...</td></tr>
              )}
              {!loading && promotions.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>No hay promociones registradas.</td></tr>
              )}
              {!loading && promotions.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ background: p.type === 'combo' ? 'rgba(20,187,166,0.1)' : 'rgba(234,179,8,0.1)', color: p.type === 'combo' ? 'var(--accent-primary)' : 'var(--accent-warning)', borderRadius: '12px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {getTypeLabel(p.type)}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.discount_percent ? `${p.discount_percent}%` : '-'}
                  </td>
                  <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.combo_price ? `$${p.combo_price.toLocaleString('es-AR')}` : '-'}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ background: p.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: p.is_active ? 'var(--accent-success)' : 'var(--accent-danger)', borderRadius: '12px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {p.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleToggleActive(p)} style={{ background: p.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: 'none', color: p.is_active ? 'var(--accent-danger)' : 'var(--accent-success)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {p.is_active ? <Icons.ToggleLeft /> : <Icons.ToggleRight />}
                        {p.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--accent-danger)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Icons.Trash /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '600px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Nueva Promoción</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><Icons.X /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Nombre</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Combo Hamburguesa" style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Descripción</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción breve de la promoción..." rows={3} style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Tipo de Promoción</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }}>
                  <option value="combo">Combo (Precio Fijo)</option>
                  <option value="discount">Descuento por Porcentaje</option>
                </select>
              </div>

              {form.type === 'combo' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Precio del Combo ($)</label>
                  <input type="number" value={form.combo_price} onChange={e => setForm({ ...form, combo_price: e.target.value })} placeholder="Ej: 15000" style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.95rem', fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}

              {form.type === 'discount' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Porcentaje de Descuento (%)</label>
                  <input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} placeholder="Ej: 15" style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.95rem', fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Condiciones (Productos)</label>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
                  <input type="text" value={productQuery} onChange={e => handleProductSearch(e.target.value)} placeholder="Buscar producto por nombre o código..." style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px 12px 40px', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }} />
                  {showProductDropdown && productResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '4px', boxShadow: '0 4px 12px rgba(30,58,95,0.5)' }}>
                      {productResults.slice(0, 8).map(p => (
                        <button key={p.id} type="button" onClick={() => handleAddCondition(p)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem', transition: 'background 0.15s' }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                          <span style={{ fontWeight: 600 }}>{p.name}</span>
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{p.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {form.conditions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.conditions.map(c => (
                      <div key={c.product_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{c.product_name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Mín:</label>
                          <input type="number" min="1" value={c.min_qty} onChange={e => handleConditionQtyChange(c.product_id, e.target.value)} style={{ width: '60px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', fontFamily: 'var(--font-mono)', outline: 'none' }} />
                        </div>
                        <button onClick={() => handleRemoveCondition(c.product_id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: 'var(--accent-danger)', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Icons.Trash />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Cancelar</button>
              <button onClick={handleSave} disabled={!form.name.trim()} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '12px 32px', borderRadius: '8px', fontWeight: 800, cursor: !form.name.trim() ? 'not-allowed' : 'pointer', opacity: !form.name.trim() ? 0.5 : 1, fontSize: '0.9rem' }}>Guardar Promoción</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

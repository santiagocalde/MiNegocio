import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';

export default function ObrasModule() {
  const { addToast } = usePanelContext();
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');

  const fetchObras = useCallback(async () => {
    setLoading(true);
    try { const res = await apiGet('/obras'); if (res.ok) setObras(await res.json()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchObras(); }, [fetchObras]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    const res = await apiPost('/obras', { name: formName.trim(), address: formAddress });
    if (res.ok) { addToast?.('Obra creada.', 'success'); setShowForm(false); setFormName(''); setFormAddress(''); fetchObras(); }
    else { addToast?.('Error.', 'error'); }
  };

  const handleStatus = async (id, status) => {
    const res = await apiPost(`/obras/${id}/update`, { status });
    if (res.ok) { addToast?.('Actualizado.', 'success'); fetchObras(); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', padding: '12px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0, letterSpacing: '-0.02em' }}>Obras</h2>
        <button onClick={() => setShowForm(true)} className="lp-btn lp-btn--primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>Nueva obra</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
        ) : obras.length === 0 ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>
            No hay obras cargadas.
          </div>
        ) : (
          obras.map(o => (
            <div key={o.id} className="ledger-sheet" style={{
              padding: '12px 18px', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)',
              borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.9rem' }}>{o.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)' }}>{o.address || 'Sin dirección'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                  color: o.status === 'activa' ? 'var(--lp-green)' : 'var(--lp-ink-faint)',
                  background: o.status === 'activa' ? 'var(--lp-green)15' : 'var(--lp-paper-sunken)' }}>
                  {o.status === 'activa' ? 'Activa' : 'Terminada'}
                </span>
                {o.status === 'activa' && (
                  <button onClick={() => handleStatus(o.id, 'terminada')} className="lp-btn lp-btn--ghost" style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                    Terminar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: '0 0 16px' }}>Nueva obra</h3>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nombre de la obra"
              style={{ width: '100%', padding: '10px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', marginBottom: 10, outline: 'none' }} autoFocus />
            <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Dirección (opcional)"
              style={{ width: '100%', padding: '10px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 6, color: 'var(--lp-ink)', marginBottom: 16, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowForm(false)} className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={handleCreate} disabled={!formName.trim()} className="lp-btn lp-btn--primary" style={{ flex: 1, opacity: formName.trim() ? 1 : 0.5 }}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

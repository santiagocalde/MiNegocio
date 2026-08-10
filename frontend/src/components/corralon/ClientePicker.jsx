/**
 * ClientePicker — buscador/creador de clientes inline.
 * Usado en: RemitosModule, AcopiosModule, QuotesModule (to-remito).
 *
 * Props:
 *   selected   — objeto cliente seleccionado { id, name, phone, address } o null
 *   onSelect   — callback cuando cambia la selección; recibe el objeto o null
 *   placeholder — string opcional
 */
import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost } from '../../services/apiClient';

const IS = { // inputStyle
  width: '100%', padding: '8px 12px',
  background: 'var(--lp-paper-sunken)',
  border: '1px solid var(--lp-line-strong)',
  borderRadius: 6, color: 'var(--lp-ink)', fontSize: '0.88rem', outline: 'none',
};

export default function ClientePicker({ selected, onSelect, placeholder = 'Buscar por nombre o teléfono…' }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch]       = useState('');
  const [open, setOpen]           = useState(false);
  const [showNew, setShowNew]      = useState(false);
  const [newName, setNewName]      = useState('');
  const [newPhone, setNewPhone]    = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBetween, setNewBetween] = useState('');
  const [saving, setSaving]        = useState(false);
  const ref = useRef();

  // Carga lista completa una sola vez por montaje
  useEffect(() => {
    apiGet('/customers?limit=500')
      .then(r => r.ok ? r.json() : [])
      .then(d => setCustomers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Cierra al hacer click fuera
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowNew(false); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const filtered = search.length >= 1
    ? customers
        .filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone && c.phone.includes(search))
        )
        .slice(0, 8)
    : [];

  const pick = (c) => {
    onSelect(c);
    setSearch('');
    setOpen(false);
    setShowNew(false);
  };

  const startNew = () => {
    setNewName(search);
    setNewPhone('');
    setNewAddress('');
    setNewBetween('');
    setShowNew(true);
  };

  const createAndSelect = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      // Combinar domicilio y entre calles en el campo address
      const addressParts = [newAddress.trim(), newBetween.trim() ? `entre ${newBetween.trim()}` : ''].filter(Boolean);
      const fullAddress = addressParts.join(' — ') || null;
      const res = await apiPost('/customers', {
        name: newName.trim(),
        phone: newPhone.trim() || null,
        address: fullAddress,
      });
      if (res.ok) {
        const data = await res.json();
        const nc = { id: data.id, name: data.name || newName.trim(), phone: newPhone.trim() || null, address: fullAddress || '' };
        setCustomers(prev => [nc, ...prev]);
        pick(nc);
      }
    } catch { /* sin conexión */ }
    setSaving(false);
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {selected ? (
        /* Cliente ya seleccionado — chip verde-teal */
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: 'var(--lp-primary-wash)', border: '1.5px solid var(--lp-primary)', borderRadius: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.88rem' }}>
              {selected.name}
            </div>
            {selected.phone && (
              <div style={{ fontSize: '0.74rem', color: 'var(--lp-ink-faint)', marginTop: 2 }}>
                {selected.phone}
              </div>
            )}
            {selected.address && (
              <div style={{ fontSize: '0.74rem', color: 'var(--lp-ink-faint)' }}>
                📍 {selected.address}
              </div>
            )}
          </div>
          <button
            onClick={() => { onSelect(null); setSearch(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: 0, flexShrink: 0 }}>
            ✕
          </button>
        </div>
      ) : (
        /* Búsqueda */
        <>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); setShowNew(false); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            style={IS}
          />
          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 200,
              background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)',
              borderRadius: 8, maxHeight: 230, overflow: 'auto',
              boxShadow: 'var(--lp-shadow-md)',
            }}>
              {showNew ? (
                /* Mini formulario de creación */
                <div style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.85rem', marginBottom: 8 }}>
                    Nuevo cliente
                  </div>
                  <input
                    autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Nombre *"
                    style={{ ...IS, marginBottom: 7 }}
                  />
                  <input
                    value={newPhone} onChange={e => setNewPhone(e.target.value)}
                    placeholder="Celular (opcional)"
                    style={{ ...IS, marginBottom: 7 }}
                  />
                  <input
                    value={newAddress} onChange={e => setNewAddress(e.target.value)}
                    placeholder="Domicilio (opcional)"
                    style={{ ...IS, marginBottom: 7 }}
                  />
                  <input
                    value={newBetween} onChange={e => setNewBetween(e.target.value)}
                    placeholder="Entre calles (opcional)"
                    style={{ ...IS, marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button onClick={() => setShowNew(false)}
                      style={{ flex: 1, padding: '7px', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--lp-line-strong)', borderRadius: 5, color: 'var(--lp-ink-faint)', cursor: 'pointer' }}>
                      ← Volver
                    </button>
                    <button onClick={createAndSelect} disabled={saving || !newName.trim()}
                      style={{ flex: 2, padding: '7px', fontSize: '0.83rem', fontWeight: 700, background: 'var(--lp-primary)', border: 'none', borderRadius: 5, color: '#0B132B', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                      {saving ? 'Creando…' : 'Crear y seleccionar'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Lista de resultados */
                <>
                  {search.length < 1 ? (
                    <div style={{ padding: '10px 12px', color: 'var(--lp-ink-faint)', fontSize: '0.8rem' }}>
                      Escribí nombre o teléfono…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ color: 'var(--lp-ink-faint)', fontSize: '0.82rem', marginBottom: 8 }}>
                        No se encontró "{search}"
                      </div>
                      <button onClick={startNew}
                        style={{ width: '100%', padding: '8px 12px', background: 'var(--lp-primary-wash)', border: '1px solid var(--lp-primary)', borderRadius: 5, color: 'var(--lp-primary)', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', textAlign: 'left' }}>
                        + Crear cliente "{search}"
                      </button>
                    </div>
                  ) : (
                    <>
                      {filtered.map(c => (
                        <div key={c.id} onClick={() => pick(c)}
                          style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--lp-line)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontWeight: 700, color: 'var(--lp-ink)', fontSize: '0.88rem' }}>
                            {c.name}
                          </div>
                          {(c.phone || c.address) && (
                            <div style={{ fontSize: '0.73rem', color: 'var(--lp-ink-faint)', marginTop: 1 }}>
                              {c.phone && <span>📞 {c.phone}</span>}
                              {c.phone && c.address && <span> · </span>}
                              {c.address && <span>📍 {c.address}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                      <div onClick={startNew}
                        style={{ padding: '9px 12px', cursor: 'pointer', color: 'var(--lp-primary)', fontSize: '0.82rem', fontWeight: 700, borderTop: '1px solid var(--lp-line)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        + Crear cliente nuevo
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

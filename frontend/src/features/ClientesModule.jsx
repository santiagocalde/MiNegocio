/**
 * ClientesModule — Lista completa de clientes (directorio).
 * Muestra TODOS los clientes, no filtra por saldo.
 * Gestiona múltiples direcciones por cliente.
 * Las Cuentas Corrientes (deudores) siguen en FiadoModule.
 */
import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost, apiDelete } from '../services/apiClient';

const formatPesos = (v) => (v ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ClientesModule() {
  const { addToast } = usePanelContext();
  const [clientes, setClientes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [detail, setDetail]       = useState(null); // { cliente, addresses }
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);

  // Form nuevo cliente
  const [fName, setFName]         = useState('');
  const [fPhone, setFPhone]       = useState('');
  const [fEmail, setFEmail]       = useState('');
  const [fDni, setFDni]           = useState('');
  const [fAddress, setFAddress]   = useState('');
  const [fDebt, setFDebt]         = useState('');

  // Agregar dirección
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [addrLabel, setAddrLabel]     = useState('');
  const [addrText, setAddrText]       = useState('');
  const [addrSaving, setAddrSaving]   = useState(false);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const url = search.length > 1
        ? `/customers?q=${encodeURIComponent(search)}`
        : '/customers';
      const res = await apiGet(url);
      if (res.ok) setClientes(await res.json());
    } catch { setClientes([]); }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const loadDetail = async (c) => {
    const res = await apiGet(`/customers/${c.id}/addresses`);
    const addresses = res.ok ? await res.json() : [];
    setDetail({ cliente: c, addresses });
    setShowAddAddr(false);
  };

  const resetForm = () => {
    setFName(''); setFPhone(''); setFEmail(''); setFDni(''); setFAddress(''); setFDebt('');
  };

  const handleCreate = async () => {
    if (!fName.trim()) { addToast?.('El nombre es obligatorio.', 'error'); return; }
    setSaving(true);
    const res = await apiPost('/customers', {
      name: fName.trim(), phone: fPhone || null,
      email: fEmail || null, dni_cuit: fDni || null,
      address: fAddress || null,
      amount: parseFloat(fDebt) || 0,
      operator: 'Sistema',
    });
    if (res.ok) {
      addToast?.('Cliente creado.', 'success');
      setShowForm(false); resetForm(); fetchClientes();
    } else { addToast?.('Error al crear cliente.', 'error'); }
    setSaving(false);
  };

  const handleAddAddress = async () => {
    if (!addrText.trim() || !detail) return;
    setAddrSaving(true);
    const res = await apiPost(`/customers/${detail.cliente.id}/addresses`, {
      label: addrLabel.trim() || 'Dirección',
      address: addrText.trim(),
    });
    if (res.ok) {
      addToast?.('Dirección agregada.', 'success');
      setAddrLabel(''); setAddrText(''); setShowAddAddr(false);
      loadDetail(detail.cliente);
    } else { addToast?.('Error al agregar dirección.', 'error'); }
    setAddrSaving(false);
  };

  const handleDeleteAddress = async (addrId) => {
    const res = await apiDelete(`/customers/addresses/${addrId}`);
    if (res.ok) {
      addToast?.('Dirección eliminada.', 'success');
      loadDetail(detail.cliente);
    } else { addToast?.('Error.', 'error'); }
  };

  const inputS = {
    width: '100%', padding: '8px 12px', fontSize: '0.88rem',
    background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)',
    borderRadius: 6, color: 'var(--lp-ink)', outline: 'none',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', padding: '12px 20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 10 }}>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0, letterSpacing: '-0.02em' }}>
          Lista de clientes
        </h2>
        <button onClick={() => { setShowForm(true); resetForm(); }} className="lp-btn lp-btn--primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
          + Nuevo cliente
        </button>
      </div>

      {/* ── Buscador ── */}
      <div style={{ flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          style={{ ...inputS, padding: '9px 14px', fontSize: '0.9rem' }}
        />
      </div>

      {/* ── Lista ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>Cargando...</div>
        ) : clientes.length === 0 ? (
          <div style={{ color: 'var(--lp-ink-faint)', textAlign: 'center', padding: 40 }}>
            {search ? 'Sin resultados.' : 'No hay clientes. Creá uno con "+ Nuevo cliente".'}
          </div>
        ) : (
          <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
            {clientes.map(c => (
              <div key={c.id} className="ledger-row ledger-row--hover" onClick={() => loadDetail(c)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </div>
                  {(c.phone || c.address) && (
                    <div className="ledger-label" style={{ marginTop: 2 }}>
                      {[c.phone, c.address].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                {c.balance > 0 && (
                  <div className="ledger-num" style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
                    ${formatPesos(c.balance)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: Nuevo cliente ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '92vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>Nuevo cliente</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', marginBottom: 16, marginTop: -8 }}>
              Registrá un nuevo cliente en el sistema.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 4 }}>Nombre completo *</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ej: González María" style={inputS} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 4 }}>Teléfono (Opcional)</label>
                  <input value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="11 1234-5678" style={inputS} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 4 }}>Email (Opcional)</label>
                  <input value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="cliente@email.com" style={inputS} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 4 }}>DNI / CUIT (Opcional)</label>
                  <input value={fDni} onChange={e => setFDni(e.target.value)} placeholder="20-12345678-9" style={inputS} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 4 }}>Saldo inicial ($)</label>
                  <input value={fDebt} onChange={e => setFDebt(e.target.value)} placeholder="0" type="number" min={0} style={inputS} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 4 }}>Dirección principal (Opcional)</label>
                <input value={fAddress} onChange={e => setFAddress(e.target.value)} placeholder="Ej: Av. Siempre Viva 742" style={inputS} />
                <p style={{ fontSize: '0.72rem', color: 'var(--lp-ink-faint)', marginTop: 4 }}>Podés agregar más direcciones después desde el detalle del cliente.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} className="lp-btn lp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !fName.trim()} className="lp-btn lp-btn--primary"
                style={{ flex: 2, opacity: (!fName.trim() || saving) ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalle de cliente + direcciones ── */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,19,43,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setDetail(null); setShowAddAddr(false); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, maxHeight: '92vh', overflow: 'auto', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, padding: 24, boxShadow: 'var(--lp-shadow-lg)' }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--lp-ink)', margin: '0 0 2px' }}>
                  {detail.cliente.name}
                </h3>
                {detail.cliente.balance > 0 && (
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-danger)', background: 'var(--wash-danger)', padding: '2px 10px', borderRadius: 20 }}>
                    Debe ${formatPesos(detail.cliente.balance)}
                  </span>
                )}
              </div>
              <button onClick={() => { setDetail(null); setShowAddAddr(false); }} style={{ background: 'none', border: 'none', color: 'var(--lp-ink-faint)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
            </div>

            {/* Info básica */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18, padding: '12px 14px', background: 'var(--lp-paper-sunken)', borderRadius: 8, fontSize: '0.83rem', color: 'var(--lp-ink-faint)' }}>
              {detail.cliente.phone && <div>📞 {detail.cliente.phone}</div>}
              {detail.cliente.email && <div>✉️ {detail.cliente.email}</div>}
              {detail.cliente.dni_cuit && <div>🪪 {detail.cliente.dni_cuit}</div>}
              {!detail.cliente.phone && !detail.cliente.email && !detail.cliente.dni_cuit && (
                <div style={{ color: 'var(--lp-ink-faint)', fontStyle: 'italic' }}>Sin datos de contacto adicionales.</div>
              )}
            </div>

            {/* Sección de direcciones */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--lp-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Domicilios
                </div>
                <button onClick={() => setShowAddAddr(v => !v)}
                  style={{ background: 'rgba(20,187,166,0.1)', border: '1px solid rgba(20,187,166,0.3)', color: 'var(--lp-primary)', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                  {showAddAddr ? '✕ Cancelar' : '+ Agregar dirección'}
                </button>
              </div>

              {/* Dirección legacy (customers.address) */}
              {detail.cliente.address && detail.addresses.length === 0 && (
                <div style={{ padding: '9px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line)', borderRadius: 7, marginBottom: 6 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--lp-ink-faint)', marginBottom: 2 }}>DIRECCIÓN PRINCIPAL</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--lp-ink)', fontWeight: 600 }}>{detail.cliente.address}</div>
                </div>
              )}

              {/* Direcciones en customer_addresses */}
              {detail.addresses.length === 0 && !detail.cliente.address && (
                <div style={{ fontSize: '0.83rem', color: 'var(--lp-ink-faint)', fontStyle: 'italic', padding: '8px 0' }}>
                  Sin domicilios registrados.
                </div>
              )}
              {detail.addresses.map(addr => (
                <div key={addr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 12px', background: 'var(--lp-paper-sunken)', border: `1px solid ${addr.is_default ? 'rgba(20,187,166,0.35)' : 'var(--lp-line)'}`, borderRadius: 7, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: addr.is_default ? 'var(--lp-primary)' : 'var(--lp-ink-faint)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {addr.label}{addr.is_default ? ' ★' : ''}
                    </div>
                    <div style={{ fontSize: '0.87rem', color: 'var(--lp-ink)', fontWeight: 600 }}>{addr.address}</div>
                  </div>
                  <button onClick={() => handleDeleteAddress(addr.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--lp-red)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, opacity: 0.7, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                    title="Eliminar dirección">
                    ✕
                  </button>
                </div>
              ))}

              {/* Form agregar dirección */}
              {showAddAddr && (
                <div style={{ marginTop: 8, padding: 14, background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 9 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 3 }}>Etiqueta (ej: "Obra Sarmiento")</label>
                      <input value={addrLabel} onChange={e => setAddrLabel(e.target.value)} placeholder="Dirección, Obra, Local..."
                        style={{ ...inputS, padding: '6px 10px', fontSize: '0.83rem' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--lp-ink-faint)', display: 'block', marginBottom: 3 }}>Dirección *</label>
                    <input value={addrText} onChange={e => setAddrText(e.target.value)} placeholder="Ej: Av. San Martín 1234, Lomas de Zamora"
                      style={{ ...inputS, padding: '6px 10px', fontSize: '0.83rem' }} autoFocus />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowAddAddr(false); setAddrLabel(''); setAddrText(''); }} className="lp-btn lp-btn--ghost" style={{ flex: 1, padding: '7px' }}>Cancelar</button>
                    <button onClick={handleAddAddress} disabled={addrSaving || !addrText.trim()} className="lp-btn lp-btn--primary"
                      style={{ flex: 2, padding: '7px', opacity: (!addrText.trim() || addrSaving) ? 0.6 : 1 }}>
                      {addrSaving ? 'Guardando...' : 'Guardar dirección'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp rápido si tiene teléfono */}
            {detail.cliente.phone && (
              <button onClick={() => window.open(`https://wa.me/54${detail.cliente.phone.replace(/\D/g, '')}`, '_blank')}
                style={{ width: '100%', background: 'rgba(37,211,102,0.09)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366', padding: '9px', borderRadius: 8, cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700 }}>
                📱 Abrir WhatsApp con {detail.cliente.name.split(' ')[0]}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

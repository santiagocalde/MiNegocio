import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../services/apiClient';

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    business_name: '',
    admin_name: 'Dueño',
    admin_pin: '',
    admin_pin_confirm: '',
  });

  useEffect(() => {
    apiGet('/setup/status')
      .then(r => r.json())
      .then(d => {
        if (!d.needs_setup) return onComplete();
        setLoading(false);
      })
      .catch(() => { setLoading(false); setError('No se puede conectar con el servidor'); });
  }, [onComplete]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name.trim()) return setError('Ingresá el nombre del negocio');
    if (form.admin_pin.length < 4) return setError('El PIN debe tener al menos 4 dígitos');
    if (form.admin_pin !== form.admin_pin_confirm) return setError('Los PIN no coinciden');
    setSaving(true);
    setError('');
    try {
      const res = await apiPost('/setup/init', {
        business_name: form.business_name.trim(),
        admin_name: form.admin_name.trim() || 'Dueño',
        admin_pin: form.admin_pin,
      });
      if (res.ok) {
        onComplete();
      } else {
        const d = await res.json();
        setError(d.detail || 'Error al guardar');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ maxWidth: 420, width: '100%', padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.8rem', marginBottom: 8 }}>Configuración Inicial</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Completá los datos para empezar a usar MiNegocio</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nombre del negocio</label>
            <input type="text" value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder="Ej: Kiosco Don Julio" autoFocus
              style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nombre del administrador</label>
            <input type="text" value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))}
              placeholder="Dueño"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>PIN de administrador (4+ dígitos)</label>
            <input type="password" value={form.admin_pin} onChange={e => setForm(f => ({ ...f, admin_pin: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
              placeholder="••••" maxLength={6}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '1.5rem', letterSpacing: '4px', textAlign: 'center', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Confirmar PIN</label>
            <input type="password" value={form.admin_pin_confirm} onChange={e => setForm(f => ({ ...f, admin_pin_confirm: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
              placeholder="••••" maxLength={6}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '1.5rem', letterSpacing: '4px', textAlign: 'center', outline: 'none' }} />
          </div>

          {error && <div style={{ color: 'var(--accent-danger)', textAlign: 'center', padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>}

          <button type="submit" disabled={saving}
            style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '14px', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1, marginTop: 8 }}>
            {saving ? 'Guardando...' : 'Comenzar'}
          </button>
        </form>
      </div>
    </div>
  );
}

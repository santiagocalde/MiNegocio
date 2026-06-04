import React, { useState, useEffect } from 'react';

const FIELDS = [
  { key: 'nombre',         label: 'Nombre del negocio',    placeholder: 'Kiosco Don Julio' },
  { key: 'subtitulo',      label: 'Subtítulo / Slogan',    placeholder: 'Atención 7 días de la semana' },
  { key: 'direccion',      label: 'Dirección',             placeholder: 'Av. Corrientes 1234, CABA' },
  { key: 'telefono',       label: 'Teléfono',              placeholder: '011-4855-0000' },
  { key: 'cuit',           label: 'CUIT / CUIL',           placeholder: '20-12345678-9' },
  { key: 'condicion_iva',  label: 'Condición IVA',         placeholder: 'Monotributista', options: ['Monotributista', 'Responsable Inscripto', 'Exento', 'Consumidor Final'] },
  { key: 'numero_caja',    label: 'Nombre de la caja',     placeholder: 'CAJA 1' },
  { key: 'mensaje_ticket', label: 'Mensaje final del ticket', placeholder: '¡Gracias por su compra!' },
];

export default function ConfigModal({ onClose, onSave }) {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/api/config')
      .then(r => r.json())
      .then(d => { setConfig(d); setLoading(false); })
      .catch(() => {
        setConfig({
          nombre: 'Kiosco El Barrio', subtitulo: 'Atención 7 días',
          direccion: '', telefono: '', cuit: '', condicion_iva: 'Monotributista',
          numero_caja: 'CAJA 1', mensaje_ticket: '¡Gracias por su compra!',
        });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('http://localhost:8000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      onSave?.(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* offline */ }
    setSaving(false);
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)',
    color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px',
    fontSize: '1rem', outline: 'none', fontFamily: 'var(--font-main)',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem' }}>⚙️ Configuración del Negocio</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px', fontSize: '0.9rem' }}>
          Estos datos aparecen en los tickets impresos y en el encabezado del sistema.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>Cargando...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {f.label}
                </label>
                {f.options ? (
                  <select
                    value={config[f.key] || ''}
                    onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config[f.key] || ''}
                    placeholder={f.placeholder}
                    onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}

            {/* Preview del encabezado */}
            <div style={{ background: 'var(--bg-main)', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '16px', marginTop: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Preview del ticket (encabezado)
              </div>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
{`══════════════════════════════════════════
${(config.nombre || 'NOMBRE').toUpperCase().padStart(21 + Math.floor((config.nombre || '').length / 2))}
${(config.subtitulo || '').padStart(21 + Math.floor((config.subtitulo || '').length / 2))}
${(config.direccion || '').padStart(21 + Math.floor((config.direccion || '').length / 2))}
Tel: ${config.telefono || '---'}
══════════════════════════════════════════
CUIT: ${config.cuit || '---'}  ${config.condicion_iva || '---'}`}
              </pre>
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button className="btn btn-modal-cancel" onClick={onClose}>Cancelar (Esc)</button>
          <button
            className="btn btn-modal-confirm"
            onClick={handleSave}
            disabled={saving}
            style={{ opacity: saving ? 0.7 : 1 }}
          >
            {saved ? '✅ Guardado' : saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

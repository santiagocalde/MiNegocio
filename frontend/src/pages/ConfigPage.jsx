import React, { useState, useEffect } from 'react';
import ConfigPrinting from '../components/pos/ConfigPrinting';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPut } from '../services/apiClient';
import { Icons } from '../components/ui/Icons';

const FIELDS = [
  { key: 'nombre',         label: 'Nombre del negocio',    placeholder: 'Kiosco Don Julio' },
  { key: 'subtitulo',      label: 'Subtítulo / Slogan',    placeholder: 'Atención 7 días de la semana' },
  { key: 'direccion',      label: 'Dirección',             placeholder: 'Av. Corrientes 1234, CABA' },
  { key: 'telefono',       label: 'Teléfono',              placeholder: '011-4855-0000' },
  { key: 'cuit',           label: 'CUIT / CUIL',           placeholder: '20-12345678-9' },
  { key: 'condicion_iva',  label: 'Condición IVA',         placeholder: 'Monotributista', options: ['Monotributista', 'Responsable Inscripto', 'Exento', 'Consumidor Final'] },
  { key: 'numero_caja',    label: 'Nombre de la caja',     placeholder: 'CAJA 1' },
  { key: 'mensaje_ticket', label: 'Mensaje final del ticket', placeholder: '¡Gracias por su compra!' },
  { key: 'iva_rate',       label: 'IVA % por defecto',     placeholder: '21', options: ['21', '10.5', '27', '0'] },
  { key: 'mp_access_token',label: 'Access Token de Mercado Pago', placeholder: 'APP_USR-...', type: 'password' },
];

const inputStyle = {
  width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)',
  color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px',
  fontSize: '1rem', outline: 'none', fontFamily: 'var(--font-main)',
};

export default function ConfigPage() {
  const { backend, addToast, printing } = usePanelContext();
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [operators, setOperators] = useState([]);
  const [showMpToken, setShowMpToken] = useState(false);

  useEffect(() => {
    apiGet('/config')
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
    apiGet('/operators')
      .then(r => r.json())
      .then(d => setOperators(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiPut('/config', config),
        apiPut('/operators', operators),
      ]);
      backend.setBusinessConfig(config);
      backend.setOperators(operators);
      setSaved(true);
      addToast('Configuración guardada', 'success');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      addToast('Error al guardar configuración', 'error');
    }
    setSaving(false);
  };

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--bg-card)', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', marginBottom: '8px' }}><Icons.Settings /> Ajustes y Configuración</h2>
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
                    style={{ ...inputStyle, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      type={f.type === 'password' ? (showMpToken ? 'text' : 'password') : 'text'}
                      value={config[f.key] || ''}
                      placeholder={f.placeholder}
                      onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={inputStyle}
                    />
                    {f.type === 'password' && (
                      <span onClick={() => setShowMpToken(!showMpToken)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem', userSelect: 'none' }}>
                        {showMpToken ? 'Ocultar' : 'Mostrar'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

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

            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}><Icons.Users /> Operadores</h3>
              {operators && operators.map((op, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Nombre</label>
                    <input
                      type="text"
                      value={op.name}
                      onChange={e => {
                        const nuevos = [...operators];
                        nuevos[i] = { ...nuevos[i], name: e.target.value };
                        setOperators(nuevos);
                      }}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ width: '120px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>PIN</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={op.pin}
                      onChange={e => {
                        const nuevos = [...operators];
                        nuevos[i] = { ...nuevos[i], pin: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) };
                        setOperators(nuevos);
                      }}
                      style={{ ...inputStyle, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>({op.role})</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Impresión</h3>
              <ConfigPrinting printConfig={printing.printConfig} setPrintConfig={printing.setPrintConfig}
                qzConnected={printing.qzConnected} setQzConnected={printing.setQzConnected}
                addToast={addToast} />
            </div>
          </div>
        )}

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-modal-confirm"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '200px', opacity: saving ? 0.7 : 1, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            {saved ? <><Icons.Check /> Guardado</> : saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

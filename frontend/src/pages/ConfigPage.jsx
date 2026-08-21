import { useState, useEffect, useRef } from 'react';
import ConfigPrinting from '../components/pos/ConfigPrinting';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import { Icons } from '../components/ui/Icons';
import useIsMobile from '../hooks/useIsMobile';
import { API_BASE } from '../config';

const FIELDS = [
  { key: 'nombre',              label: 'Nombre del negocio',          placeholder: 'Kiosco Don Julio', section: 'Negocio' },
  { key: 'subtitulo',           label: 'Subtítulo / Slogan',          placeholder: 'Atención 7 días de la semana', section: 'Negocio' },
  { key: 'direccion',           label: 'Dirección',                   placeholder: 'Av. Corrientes 1234, CABA', section: 'Negocio' },
  { key: 'telefono',            label: 'Teléfono / WhatsApp',         placeholder: '1123063167', section: 'Negocio' },
  { key: 'instagram',           label: 'Instagram',                   placeholder: '@tunegocio', section: 'Negocio' },
  { key: 'propietario',         label: 'Propietario / Responsable',   placeholder: 'De López Juan Manuel', section: 'Negocio' },
  { key: 'numero_caja',         label: 'Nombre de la caja',           placeholder: 'CAJA 1', section: 'Negocio' },
  { key: 'logo_url',            label: 'Logo del negocio',            placeholder: 'https://ejemplo.com/logo.png', isLogo: true, section: 'Negocio' },
  { key: 'caja_inicial_fija',   label: 'Monto fijo de caja inicial',  placeholder: '10000', isCajaFija: true, section: 'Caja y Turnos' },
  { key: 'cuit',                label: 'CUIT / CUIL',                 placeholder: '20-12345678-9', section: 'Fiscal' },
  { key: 'ing_brutos',          label: 'Ing. Brutos (Nº)',            placeholder: '(902)-20-18423262-7', section: 'Fiscal' },
  { key: 'inicio_actividades',  label: 'Inicio de Actividades',       placeholder: '01/07/2025', section: 'Fiscal' },
  { key: 'condicion_iva',       label: 'Condición IVA',               placeholder: 'Monotributista', options: ['Monotributista', 'Responsable Inscripto', 'Exento', 'Consumidor Final'], section: 'Fiscal' },
  { key: 'iva_rate',            label: 'IVA % por defecto',           placeholder: '21', options: ['21', '10.5', '27', '0'], section: 'Fiscal' },
  { key: 'mp_access_token',     label: 'Access Token de Mercado Pago', placeholder: 'APP_USR-...', type: 'password', section: 'Medios de Pago' },
  { key: 'mp_collector_id',     label: 'Alias / ID de Cobro de Mercado Pago', placeholder: 'TuAliasMP o ID de caja', type: 'password', section: 'Medios de Pago' },
  { key: 'mp_qr_url',           label: 'QR de Mercado Pago (cobro en el mostrador)', isMpQr: true, section: 'Medios de Pago' },
  { key: 'mp_auto_confirm',     label: 'Auto-confirmación de pagos con QR', isMpAuto: true, section: 'Medios de Pago' },
  { key: 'mp_qr_pos',           label: 'Caja con QR fijo del mostrador', isMpQrPos: true, section: 'Medios de Pago' },
  { key: 'mensaje_ticket',      label: 'Mensaje final del ticket',    placeholder: '¡Gracias por su compra!', section: 'Ticket' },
  { key: 'margen_estimado',     label: 'Margen de ganancia estimado (%)', placeholder: '35', section: 'Análisis' },
];

const SECTIONS = ['Negocio', 'Caja y Turnos', 'Fiscal', 'Medios de Pago', 'Ticket', 'Análisis'];

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
  const [settingUpCaja, setSettingUpCaja] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const isMobile = useIsMobile();

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('saas_token');
      const res = await fetch(`${API_BASE}/config/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (res.ok) {
        const { logo_url } = await res.json();
        setConfig(prev => ({ ...prev, logo_url }));
        // Actualizar localStorage para que el logo aparezca en presupuestos
        const cfg = JSON.parse(localStorage.getItem('minegocio_config') || '{}');
        cfg.logo_url = logo_url;
        localStorage.setItem('minegocio_config', JSON.stringify(cfg));
        addToast?.('Logo actualizado correctamente.', 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        addToast?.(err.detail || 'Error al subir el logo.', 'error');
      }
    } catch { addToast?.('Error de red al subir el logo.', 'error'); }
    setUploadingLogo(false);
    e.target.value = '';
  };

  // Crea la caja fija en Mercado Pago y trae el QR imprimible. Requiere que el
  // Access Token ya esté GUARDADO (el backend lo lee de la config del negocio).
  const handleSetupCaja = async () => {
    setSettingUpCaja(true);
    try {
      const res = await apiPost('/mp/setup-caja', { name: config.nombre || 'MiNegocio' });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.qr_pos_url) {
        setConfig(prev => ({ ...prev, mp_qr_pos_url: d.qr_pos_url }));
        addToast?.(d.already ? 'Tu caja QR ya estaba creada.' : '¡Caja QR creada! Imprimí el QR y pegalo en el mostrador.', 'success');
      } else {
        addToast?.(d.detail || 'No se pudo crear la caja QR.', 'error');
      }
    } catch { addToast?.('Error de red al crear la caja QR.', 'error'); }
    setSettingUpCaja(false);
  };

  // Tarjeta imprimible con el QR fijo: nombre del negocio, bordes, instrucciones.
  const handlePrintQr = () => {
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nombre = esc(config.nombre || 'Mi Negocio');
    const w = window.open('', '_blank', 'width=460,height=620');
    if (!w) { addToast?.('Permití ventanas emergentes para imprimir.', 'error'); return; }
    w.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>QR de pago — ' + nombre + '</title><style>' +
      '@page { size: A5; margin: 10mm; }' +
      '* { box-sizing: border-box; }' +
      'body { font-family: Arial, Helvetica, sans-serif; margin: 0; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }' +
      '.card { width: 330px; border: 2px dashed #b0b0b0; border-radius: 18px; padding: 26px 22px; text-align: center; background: #ffffff; }' +
      '.name { font-size: 24px; font-weight: 800; color: #0B132B; margin: 0 0 2px; }' +
      '.sub { font-size: 13px; color: #777; margin: 0 0 18px; letter-spacing: 1px; text-transform: uppercase; }' +
      '.qrbox { border: 1px solid #e3e3e3; border-radius: 14px; padding: 12px; width: 216px; height: 216px; margin: 0 auto 18px; display: flex; align-items: center; justify-content: center; }' +
      '.qrbox img { width: 100%; height: 100%; object-fit: contain; }' +
      '.pay { font-size: 18px; font-weight: 800; color: #009EE3; margin: 0 0 8px; }' +
      '.hint { font-size: 13px; color: #444; line-height: 1.5; margin: 0 0 16px; }' +
      '.foot { font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }' +
      '@media print { body { background: #fff; } .card { border: 1px dashed #b0b0b0; } }' +
      '</style></head><body><div class="card">' +
      '<h1 class="name">' + nombre + '</h1>' +
      '<div class="sub">Pago con QR</div>' +
      '<div class="qrbox"><img src="' + esc(config.mp_qr_pos_url) + '" alt="QR de pago" /></div>' +
      '<div class="pay">Escaneá y pagá</div>' +
      '<p class="hint">Abrí la app de <strong>Mercado Pago</strong>, tocá <strong>Escanear</strong> y apuntá a este código.<br />El monto lo carga el cajero en la caja.</p>' +
      '<div class="foot">MiNegocio · Punto de venta para kioscos</div>' +
      '</div><script>window.onload = function () { setTimeout(function () { window.print(); }, 500); };<\/script></body></html>');
    w.document.close();
  };

  useEffect(() => {
    apiGet('/config')
      .then(r => r.json())
      .then(d => { setConfig(d); localStorage.setItem('minegocio_config', JSON.stringify(d)); setLoading(false); })
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
      const configRes = await apiPost('/config', config);
      if (!configRes.ok) throw new Error('No se pudo guardar la configuracion');

      const operatorResponses = await Promise.all(
        operators
          .filter(op => op.id)
          .map(op => {
            const payload = { name: op.name, role: op.role };
            if (op.pin) payload.pin = op.pin;
            return apiPost(`/operators/${op.id}`, payload);
          })
      );
      if (operatorResponses.some(res => !res.ok)) {
        throw new Error('No se pudo actualizar un operador');
      }

      backend.setBusinessConfig(config);
      backend.setOperators(operators);
      setSaved(true);
      addToast('Configuración guardada', 'success');
      setTimeout(() => setSaved(false), 2000);
      try { localStorage.setItem('minegocio_config', JSON.stringify(config)); } catch { /* noop */ }
    } catch {
      addToast('No se pudo guardar la configuración. Reintentá o revisá tu conexión.', 'error');
    }
    setSaving(false);
  };

  const renderField = (f) => (
    <div key={f.key}>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {f.label}
      </label>
      {f.isLogo ? (
        <div>
          <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={handleLogoUpload} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {config.logo_url && (
              <div style={{ width: 72, height: 72, border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={config.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                style={{ ...inputStyle, cursor: 'pointer', background: 'var(--bg-card)', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '10px 16px' }}
              >
                {uploadingLogo ? 'Subiendo...' : config.logo_url ? '🖼️ Cambiar logo' : '📁 Subir logo (PNG, JPG, WebP)'}
              </button>
              <input
                type="text"
                value={config.logo_url || ''}
                placeholder="O pegá una URL: https://ejemplo.com/logo.png"
                onChange={e => setConfig(prev => ({ ...prev, logo_url: e.target.value }))}
                style={{ ...inputStyle, fontSize: '0.8rem', padding: '8px 12px', color: 'var(--text-secondary)' }}
              />
            </div>
          </div>
        </div>
      ) : f.isMpQr ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {config.mp_qr_url && (
            <div style={{ width: 72, height: 72, border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src={config.mp_qr_url} alt="QR MP" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ ...inputStyle, padding: '8px', fontSize: '0.85rem', cursor: 'pointer' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 500 * 1024) { addToast('La imagen es muy grande (máx 500KB).', 'error'); return; }
                const reader = new FileReader();
                reader.onload = () => setConfig(prev => ({ ...prev, mp_qr_url: reader.result }));
                reader.readAsDataURL(file);
              }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              Subí tu "Mi QR" de Mercado Pago. El cliente lo escanea en el mostrador y paga. El pago lo confirmás vos, como con efectivo.
              {config.mp_qr_url && <button type="button" onClick={() => setConfig(prev => ({ ...prev, mp_qr_url: '' }))} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.75rem' }}>Quitar</button>}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              ¿Querés que se confirme solo y aparezca "pago recibido"? Activá la auto-confirmación acá abajo (necesita tu Access Token de arriba).
            </p>
          </div>
        </div>
      ) : f.isMpAuto ? (
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input type="checkbox"
              checked={[1, '1', true, 'true'].includes(config.mp_auto_confirm)}
              onChange={e => setConfig(prev => ({ ...prev, mp_auto_confirm: e.target.checked ? 1 : 0 }))}
              style={{ width: 20, height: 20, accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>Confirmar los pagos con QR automáticamente</span>
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '6px 0 0 32px' }}>
            Cuando el cliente paga, la notebook muestra "PAGO RECIBIDO" y cierra la venta sola. Necesita tu Access Token de Mercado Pago (cargado arriba) y la caja QR de acá abajo.
          </p>
        </div>
      ) : f.isMpQrPos ? (
        <div>
          {config.mp_qr_pos_url ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <img src={config.mp_qr_pos_url} alt="QR fijo del mostrador" style={{ width: 150, height: 150, background: '#fff', borderRadius: 10, padding: 8, objectFit: 'contain' }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 6px' }}>✅ Caja QR lista</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Imprimí este QR y pegalo en el mostrador. El cliente lo escanea, paga, y la venta se confirma sola con el monto exacto.
                </p>
                <button type="button" onClick={handlePrintQr}
                  style={{ display: 'inline-block', background: 'var(--accent-primary)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer' }}>
                  Abrir / Imprimir QR
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button type="button" onClick={handleSetupCaja} disabled={settingUpCaja || !config.mp_access_token_set}
                style={{ background: config.mp_access_token_set ? 'var(--accent-primary)' : 'var(--border-color)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: config.mp_access_token_set ? 'pointer' : 'not-allowed' }}>
                {settingUpCaja ? 'Creando caja…' : 'Crear mi caja con QR fijo'}
              </button>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                {config.mp_access_token_set
                  ? 'Crea un QR fijo para imprimir y pegar en el mostrador. Guardá primero la configuración si acabás de cargar el Access Token.'
                  : 'Cargá y guardá tu Access Token de Mercado Pago arriba para poder crear la caja.'}
              </p>
            </div>
          )}
        </div>
      ) : f.isCajaFija ? (
        <div>
          <input
            type="number"
            min="0"
            step="1"
            value={config.caja_inicial_fija || ''}
            placeholder={f.placeholder}
            onChange={e => setConfig(prev => ({ ...prev, caja_inicial_fija: e.target.value }))}
            style={inputStyle}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Si lo dejás vacío, cada turno arranca con lo que contó el empleado anterior al cerrar (como hoy).
            Si ponés un monto, <strong>todos los turnos arrancan siempre con ese número fijo</strong> — vos administrás
            el resto por afuera (al cerrar, se te va a sugerir retirar el excedente para dejar siempre este monto en el cajón).
          </p>
        </div>
      ) : f.options ? (
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
            placeholder={f.key === 'mp_access_token' && config.mp_access_token_set
              ? '•••••••• ya configurado (dejá vacío para no cambiarlo)'
              : f.placeholder}
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
  );

  const sectionCard = (title, children) => (
    <div key={title} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? '10px 12px' : '12px 20px', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div className="ledger-sheet" style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '16px 14px' : '28px', boxShadow: 'var(--shadow-md)', boxSizing: 'border-box' }}>
        <div className="ledger-label">Los datos de tu negocio</div>
        <h1 className="ledger-title" style={{ fontSize: '1.5rem', margin: '4px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}><Icons.Settings /> Configuración</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px', fontSize: '0.9rem' }}>
          Estos datos aparecen en los tickets impresos y en el encabezado del sistema.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>Cargando...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {SECTIONS.map(s => sectionCard(s, FIELDS.filter(f => f.section === s).map(renderField)))}

            <div style={{ background: 'var(--bg-main)', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '16px', marginTop: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Preview del ticket (encabezado)
              </div>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? '0.62rem' : '0.75rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, overflowX: 'auto' }}>
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
                <div key={i} style={{ display: 'flex', gap: isMobile ? '8px' : '12px', marginBottom: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                  <div style={{ width: isMobile ? '78px' : '120px', flexShrink: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>PIN</label>
                    <input
                      type="password"
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}><Icons.Settings /> Impresión</h3>
              <ConfigPrinting printConfig={printing.printConfig} setPrintConfig={printing.setPrintConfig}
                qzConnected={printing.qzConnected} setQzConnected={printing.setQzConnected}
                addToast={addToast} />
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}><Icons.Activity /> Facturación ARCA (AFIP)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                Habilitar emisión automática de facturas electrónicas con CAE. Requiere validación manual de certificados.
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input 
                  type="checkbox" 
                  checked={false} 
                  onChange={(e) => {
                    e.preventDefault();
                    if (window.confirm("🏛️ Configuración de ARCA Requerida\n\nPara emitir facturas legales, necesitamos dar de alta tus Certificados Digitales por seguridad. Este trámite debe ser configurado manualmente por Soporte.\n\n¿Contactar a Soporte por WhatsApp ahora?")) {
                      window.open('https://wa.me/5491144276384?text=Hola,%20quiero%20habilitar%20la%20facturaci%C3%B3n%20con%20ARCA%20en%20mi%20cuenta', '_blank');
                    }
                  }} 
                  style={{ cursor: 'pointer', width: '20px', height: '20px' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Habilitar Facturación Electrónica ARCA
                </span>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
          <button
            className="btn btn-modal-confirm"
            onClick={handleSave}
            disabled={saving}
            style={{ width: isMobile ? '100%' : '200px', opacity: saving ? 0.7 : 1, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            {saved ? <><Icons.Check /> Guardado</> : saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

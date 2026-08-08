import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/ui/Icons';
import { API_ROOT } from '../config';
import { getSource } from '../utils/attribution';
import LogoPrincipal from '../assets/images/MiNegocio_transparente_real.png';
import LogoLight from '../assets/images/MiNegocio_light.png';

const Svg = {
  ArrowRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
  ArrowLeft:  () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  CheckCircle: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
};

const tiposNegocio = [
  { id: 'kiosco',          label: 'Kiosco',           icon: <Icons.Package /> },
  { id: 'almacen',         label: 'Almacén',          icon: <Icons.Box /> },
  { id: 'minimercado',     label: 'Mini Mercado',     icon: <Icons.ShoppingCart /> },
  { id: 'autoservicio',    label: 'Autoservicio',     icon: <Icons.Clock /> },
  { id: 'dietetica',       label: 'Dietética',        icon: <Icons.Sparkles /> },
  { id: 'panaderia',       label: 'Panadería',        icon: <Icons.Tag /> },
  { id: 'ferreteria',      label: 'Ferretería',       icon: <Icons.Settings /> },
  { id: 'electrodomesticos', label: 'Electrodomésticos', icon: <Icons.Truck /> },
  { id: 'libreria',        label: 'Librería',         icon: <Icons.Book /> },
  { id: 'petshop',         label: 'Pet Shop',         icon: <Icons.Users /> },
  { id: 'corralon',        label: 'Corralón',         icon: <Icons.Truck /> },
  { id: 'vineria',         label: 'Vinería',          icon: <Icons.Crown /> },
  { id: 'otro',            label: 'Otro',             icon: <Icons.Help /> },
];

const objetivos = [
  { id: 'stock',    label: 'Controlar stock' },
  { id: 'robos',    label: 'Evitar robos' },
  { id: 'rapidez',  label: 'Facturar rápido' },
  { id: 'ganancias',label: 'Saber cuánto gano' },
  { id: 'cuentas',  label: 'Cuentas claras' },
  { id: 'orden',    label: 'Ordenar el negocio' },
  { id: 'precios',  label: 'Actualizar precios' },
  { id: 'tiempo',   label: 'Ahorrar tiempo' },
  { id: 'otro',     label: 'Otro' }
];

const prefijos = [
  { code: '+54',  country: '🇦🇷' },
  { code: '+56',  country: '🇨🇱' },
  { code: '+57',  country: '🇨🇴' },
  { code: '+52',  country: '🇲🇽' },
  { code: '+51',  country: '🇵🇪' },
  { code: '+598', country: '🇺🇾' },
  { code: '+595', country: '🇵🇾' },
  { code: '+591', country: '🇧🇴' },
  { code: '+34',  country: '🇪🇸' },
  { code: '+1',   country: '🇺🇸' },
];

/* ─────────────────────────────────────────────────────────
   ORDEN DE PASOS
   1 · WhatsApp
   2 · ¿Cómo te llamás?
   3 · Nombre del negocio
   4 · Tipo de negocio
   5 · ¿Usaste un sistema antes?
   6 · ¿Necesitás facturas electrónicas?
   7 · ¿Qué buscás resolver?
   8 · Email + contraseña  (con check de duplicado en tiempo real)
   9 · ¡Listo! Confirmar
   ───────────────────────────────────────────────────────── */
const TOTAL_STEPS = 9;

export default function Onboarding() {
  const navigate = useNavigate();
  const [theme] = useState(() => { try { return localStorage.getItem('lp_theme') || 'light'; } catch { return 'light'; } });
  const [step, setStep]                     = useState(1);
  const [, setDirection]                    = useState(1);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError]   = useState('');
  const [termsAccepted, setTermsAccepted]   = useState(false);
  const [showPwd, setShowPwd]               = useState(false);

  // Check de email en step 8
  const [emailChecking, setEmailChecking]   = useState(false);
  const [emailError, setEmailError]         = useState('');

  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem('minegocio_onboarding_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch { /* noop */ }
    return { prefijo: '+54', telefono: '', email: '', password: '', nombre: '', negocio: '', tipo: '', posPrevio: '', arca: '', objetivo: '' };
  });

  // Requisitos de contraseña
  const _pwd = formData.password || '';
  const pwdChecks = {
    len:     _pwd.length >= 10,
    upper:   /[A-Z]/.test(_pwd),
    lower:   /[a-z]/.test(_pwd),
    digit:   /[0-9]/.test(_pwd),
    special: /[^a-zA-Z0-9]/.test(_pwd),
  };
  const passwordValid = Object.values(pwdChecks).every(Boolean);

  const progress   = (step / TOTAL_STEPS) * 100;
  const isLoggedIn = !!localStorage.getItem('saas_token');

  // Persistir form (sin contraseña)
  useEffect(() => {
    try {
      const { password: _p, ...persist } = formData;
      localStorage.setItem('minegocio_onboarding_form', JSON.stringify(persist));
    } catch { /* noop */ }
  }, [formData]);

  // Setup tema
  useEffect(() => {
    document.body.classList.add('landing-open');
    document.body.setAttribute('data-lp-theme', theme);
    return () => {
      document.body.classList.remove('landing-open');
      document.body.removeAttribute('data-lp-theme');
    };
  }, [theme]);

  // Si ya está logueado, saltar paso 8 (email+pwd)
  useEffect(() => {
    if (isLoggedIn && step === 8) {
      setStep(9);
    }
  }, [step, isLoggedIn]);

  const handleNext = () => { setDirection(1); setStep(s => Math.min(s + 1, TOTAL_STEPS)); };
  const handlePrev = () => { setDirection(-1); setStep(s => Math.max(s - 1, 1)); };

  // Avanzar desde step 8 con verificación de email
  const handleEmailNext = async () => {
    if (!formData.email.includes('@') || !passwordValid) return;
    setEmailChecking(true);
    setEmailError('');
    try {
      const res = await fetch(`${API_ROOT}/api/auth/check-email?email=${encodeURIComponent(formData.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.available) {
          setEmailError('Ese email ya tiene una cuenta registrada. ¿Querés iniciar sesión?');
          setEmailChecking(false);
          return;
        }
      }
      // Si el check falla (red) dejamos pasar — el registro final lo detectará igual
    } catch { /* noop */ }
    setEmailChecking(false);
    handleNext();
  };

  const handleComplete = async () => {
    if (registerLoading) return;
    setRegisterLoading(true);
    setRegisterError('');
    try {
      const baseUrl = API_ROOT;

      if (isLoggedIn) {
        const token = localStorage.getItem('saas_token');
        const res = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            business_name: formData.negocio,
            phone:         `${formData.prefijo} ${formData.telefono}`,
            business_type: formData.tipo,
            prior_pos:     formData.posPrevio,
            needs_arca:    formData.arca,
            objective:     formData.objetivo,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || 'Error al completar el registro');
        }
        const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
        biz.business_name = formData.negocio;
        biz.business_type = formData.tipo;
        localStorage.setItem('saas_business', JSON.stringify(biz));
        localStorage.setItem('minegocio_current_operator', JSON.stringify({ name: formData.nombre || 'Dueño', role: 'admin' }));
        localStorage.removeItem('minegocio_onboarding_pending');
        window.location.href = '/panel';

      } else {
        const res = await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:         formData.email,
            password:      formData.password,
            name:          formData.nombre,
            business_name: formData.negocio,
            phone:         `${formData.prefijo} ${formData.telefono}`,
            business_type: formData.tipo,
            prior_pos:     formData.posPrevio,
            needs_arca:    formData.arca,
            objective:     formData.objetivo,
            source:        getSource(),
          }),
        });
        if (!res.ok) {
          let errStr = 'Error al crear la cuenta';
          try {
            const data = await res.json();
            if (data.detail) errStr = Array.isArray(data.detail) ? data.detail[0].msg : data.detail;
          } catch { errStr = `Error del sistema (${res.status})`; }
          throw new Error(errStr);
        }
        const data = await res.json();
        localStorage.setItem('saas_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('saas_refresh_token', data.refresh_token);
        data.business.business_type = formData.tipo;
        localStorage.setItem('saas_business', JSON.stringify(data.business));
        localStorage.setItem('minegocio_current_operator', JSON.stringify({ name: formData.nombre || 'Dueño', role: 'admin' }));
        if (data.operator_pin) localStorage.setItem('minegocio_onboarding_pin', data.operator_pin);
        localStorage.removeItem('saas_mode');
        localStorage.removeItem('minegocio_onboarding_pending');
        localStorage.removeItem('minegocio_onboarding_form');
        window.location.href = '/panel';
      }
    } catch (err) {
      setRegisterError(err.message);
      setRegisterLoading(false);
    }
  };

  // Estilos reutilizables
  const inputStyle = {
    width: '100%', padding: '16px 20px',
    background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)',
    borderRadius: 12, color: 'var(--lp-ink)', fontSize: '1.1rem', outline: 'none', transition: 'all 0.2s',
  };
  const focusOn  = e => { e.target.style.borderColor = 'var(--lp-primary)'; };
  const focusOff = e => { e.target.style.borderColor = 'var(--lp-line-strong)'; };

  const renderStep = () => {
    switch (step) {

      /* ── 1 · WhatsApp ── */
      case 1:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>¿Cuál es tu número de WhatsApp?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Lo pedimos por seguridad para enviarte notificaciones importantes y darte soporte directo. No enviamos spam.</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
              <div style={{ position: 'relative' }}>
                <select value={formData.prefijo} onChange={e => setFormData({ ...formData, prefijo: e.target.value })}
                  style={{ width: 110, padding: '16px 12px', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', borderRadius: 12, color: 'var(--lp-ink)', fontSize: '1.1rem', fontWeight: 600, outline: 'none', appearance: 'none', cursor: 'pointer' }}
                  onFocus={focusOn} onBlur={focusOff}>
                  {prefijos.map(p => (
                    <option key={p.code} value={p.code} style={{ background: 'var(--lp-paper-raised)', color: 'var(--lp-ink)' }}>{p.country} {p.code}</option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--lp-ink-faint)' }}>▼</div>
              </div>
              <input type="tel" placeholder="11 1234 5678" value={formData.telefono}
                onChange={e => setFormData({ ...formData, telefono: e.target.value.replace(/[^0-9]/g, '') })}
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                onFocus={focusOn} onBlur={focusOff} autoFocus />
            </div>
            <button onClick={handleNext} disabled={formData.telefono.length < 8} className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: formData.telefono.length < 8 ? 0.5 : 1 }}>
              Continuar
            </button>
          </div>
        );

      /* ── 2 · Nombre ── */
      case 2:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>¿Cómo te llamás?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Queremos saber con quién hablamos para darte una atención más personalizada.</p>
            <input type="text" placeholder="Ej. Carlos Pérez" value={formData.nombre}
              onChange={e => setFormData({ ...formData, nombre: e.target.value })}
              style={{ ...inputStyle, marginBottom: 32 }}
              onFocus={focusOn} onBlur={focusOff} autoFocus />
            <button onClick={handleNext} disabled={formData.nombre.length < 2} className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: formData.nombre.length < 2 ? 0.5 : 1 }}>
              Continuar
            </button>
          </div>
        );

      /* ── 3 · Nombre del negocio ── */
      case 3:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>Nombre de tu negocio</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Este nombre aparecerá en los tickets de tus clientes y en el panel principal.</p>
            <input type="text" placeholder="Ej. Kiosco Don Carlos" value={formData.negocio}
              onChange={e => setFormData({ ...formData, negocio: e.target.value })}
              style={{ ...inputStyle, marginBottom: 32 }}
              onFocus={focusOn} onBlur={focusOff} autoFocus />
            <button onClick={handleNext} disabled={formData.negocio.length < 2} className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: formData.negocio.length < 2 ? 0.5 : 1 }}>
              Continuar
            </button>
          </div>
        );

      /* ── 4 · Tipo de negocio ── */
      case 4:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>¿De qué trata tu negocio?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Seleccioná la categoría que mejor te represente.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 32 }}>
              {tiposNegocio.map(tipo => (
                <button key={tipo.id} onClick={() => { setFormData({ ...formData, tipo: tipo.id }); handleNext(); }} style={{
                  background: formData.tipo === tipo.id ? 'var(--lp-primary-wash)' : 'var(--lp-paper-sunken)',
                  border:     formData.tipo === tipo.id ? '1px solid var(--lp-primary)' : '1px solid var(--lp-line-strong)',
                  padding: '28px 14px 20px', borderRadius: 16, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, transition: 'all 0.18s',
                  boxShadow: formData.tipo === tipo.id ? 'var(--lp-shadow-sm)' : 'none',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--lp-paper-raised)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--lp-shadow-sm)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = formData.tipo === tipo.id ? 'var(--lp-primary-wash)' : 'var(--lp-paper-sunken)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: formData.tipo === tipo.id ? 'var(--lp-primary)' : 'var(--lp-primary-wash)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: formData.tipo === tipo.id ? '#fff' : 'var(--lp-primary)', transition: 'all 0.18s',
                  }}>
                    {tipo.icon}
                  </div>
                  <span style={{ color: 'var(--lp-ink)', fontSize: '0.82rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{tipo.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      /* ── 5 · ¿Usaste un sistema antes? ── */
      case 5:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>¿Usaste un sistema de ventas antes?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Contanos tu experiencia para adaptar el sistema a tu nivel.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {['Si, actualmente uso uno', 'Lo use en el pasado', 'No, siempre use cuaderno / memoria'].map((opt, i) => (
                <button key={i} onClick={() => { setFormData({ ...formData, posPrevio: opt }); handleNext(); }}
                  style={{ background: formData.posPrevio === opt ? 'var(--lp-primary-wash)' : 'var(--lp-paper-sunken)', border: formData.posPrevio === opt ? '1px solid var(--lp-primary)' : '1px solid var(--lp-line-strong)', padding: '16px 20px', borderRadius: 12, cursor: 'pointer', color: 'var(--lp-ink)', fontSize: '0.95rem', fontWeight: 600, textAlign: 'left', transition: 'all 0.2s' }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );

      /* ── 6 · ¿Facturas electrónicas? ── */
      case 6:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>¿Necesitás emitir facturas electrónicas?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Así sabemos si tenés que conectar tu cuenta con ARCA (ex AFIP).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {['Si, necesito emitir facturas electronicas', 'No, facturo por mi cuenta / no facturo', 'No lo se todavia'].map((opt, i) => (
                <button key={i} onClick={() => { setFormData({ ...formData, arca: opt }); handleNext(); }}
                  style={{ background: formData.arca === opt ? 'var(--lp-primary-wash)' : 'var(--lp-paper-sunken)', border: formData.arca === opt ? '1px solid var(--lp-primary)' : '1px solid var(--lp-line-strong)', padding: '16px 20px', borderRadius: 12, cursor: 'pointer', color: 'var(--lp-ink)', fontSize: '0.95rem', fontWeight: 600, textAlign: 'left', transition: 'all 0.2s' }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );

      /* ── 7 · ¿Qué buscás resolver? ── */
      case 7:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>¿Qué buscás resolver principalmente?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Seleccioná tu objetivo principal para que podamos ayudarte a lograrlo.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
              {objetivos.map(obj => (
                <button key={obj.id} onClick={() => { setFormData({ ...formData, objetivo: obj.label }); handleNext(); }}
                  style={{ background: formData.objetivo === obj.label ? 'var(--lp-primary-wash)' : 'var(--lp-paper-sunken)', border: formData.objetivo === obj.label ? '1px solid var(--lp-primary)' : '1px solid var(--lp-line-strong)', padding: '16px 20px', borderRadius: 12, cursor: 'pointer', color: 'var(--lp-ink)', fontSize: '0.95rem', fontWeight: 600, textAlign: 'left', transition: 'all 0.2s' }}>
                  {obj.label}
                </button>
              ))}
            </div>
          </div>
        );

      /* ── 8 · Email + contraseña (solo usuarios nuevos) ── */
      case 8:
        if (isLoggedIn) return null;
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 12, letterSpacing: '-0.03em' }}>Creá tu acceso</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 24 }}>Con estos datos vas a entrar a tu cuenta todos los días. Anotá la contraseña en un lugar seguro.</p>

            {/* Email */}
            <input type="email" placeholder="kiosco@ejemplo.com" value={formData.email}
              onChange={e => { setFormData({ ...formData, email: e.target.value }); setEmailError(''); }}
              style={{ ...inputStyle, marginBottom: emailError ? 6 : 14 }}
              onFocus={focusOn} onBlur={focusOff} autoFocus />
            {emailError && (
              <div style={{ marginBottom: 10, padding: '8px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--lp-red, #dc2626)', fontWeight: 600 }}>
                {emailError}{' '}
                <a href="/login" style={{ color: 'inherit', textDecoration: 'underline' }}>Iniciar sesión →</a>
              </div>
            )}

            {/* Contraseña */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input type={showPwd ? 'text' : 'password'} placeholder="Tu contraseña" value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                style={{ ...inputStyle, paddingRight: 72 }}
                onFocus={focusOn} onBlur={focusOff} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--lp-text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                {showPwd ? 'Ocultar' : 'Ver'}
              </button>
            </div>

            {/* Requisitos */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 28 }}>
              {[['len', '10+ caracteres'], ['upper', '1 mayúscula'], ['lower', '1 minúscula'], ['digit', '1 número'], ['special', '1 símbolo (!@#$)']].map(([k, l]) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: pwdChecks[k] ? '#10b981' : 'var(--lp-ink-faint)', transition: 'color 0.2s' }}>
                  <span style={{ fontSize: '0.7rem' }}>{pwdChecks[k] ? '✓' : '○'}</span>{l}
                </span>
              ))}
            </div>

            <button
              onClick={handleEmailNext}
              disabled={!formData.email.includes('@') || !passwordValid || emailChecking}
              className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: (!formData.email.includes('@') || !passwordValid || emailChecking) ? 0.5 : 1 }}>
              {emailChecking ? 'Verificando...' : 'Continuar'}
            </button>
          </div>
        );

      /* ── 9 · ¡Listo! ── */
      case 9:
        return (
          <div style={{ animation: 'fadeIn 0.5s ease', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <Svg.CheckCircle />
            </div>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '2.2rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 16, letterSpacing: '-0.03em' }}>
              ¡Estás listo{formData.nombre ? `, ${formData.nombre.split(' ')[0]}` : ''}!
            </h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '1.05rem', marginBottom: 40, maxWidth: 400, margin: '0 auto 40px' }}>
              Bienvenido a <strong>{formData.negocio || 'MiNegocio'}</strong>. La demo de 7 días te permitirá probar todo sin restricciones.
            </p>

            {!isLoggedIn && formData.email && (
              <div style={{ background: 'var(--lp-primary-wash)', border: '1px solid var(--lp-primary-glow)', borderRadius: 12, padding: '16px', marginBottom: 24, textAlign: 'left' }}>
                <p style={{ color: 'var(--lp-ink)', fontSize: '0.9rem', margin: '0 0 4px 0', fontWeight: 700 }}>Tu email de acceso — guardalo</p>
                <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.85rem', margin: 0 }}>Email: <strong style={{ color: 'var(--lp-ink)' }}>{formData.email}</strong></p>
              </div>
            )}

            {registerError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>
                {registerError}
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, cursor: 'pointer', textAlign: 'left' }} onClick={() => setTermsAccepted(v => !v)}>
              <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${termsAccepted ? 'var(--lp-primary)' : 'var(--lp-line-strong)'}`, background: termsAccepted ? 'var(--lp-primary-wash)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, transition: 'all 0.2s' }}>
                {termsAccepted && <svg width="12" height="12" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', lineHeight: 1.5, userSelect: 'none' }}>
                Leí y acepto los{' '}
                <span onClick={e => { e.stopPropagation(); window.open('/terminos', '_blank'); }} style={{ color: 'var(--lp-primary)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>Términos y Condiciones</span>
                {' '}y la{' '}
                <span onClick={e => { e.stopPropagation(); window.open('/privacidad', '_blank'); }} style={{ color: 'var(--lp-primary)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>Política de Privacidad</span>
                , incluyendo el tratamiento de mis datos personales según la Ley 25.326.
              </span>
            </label>

            <button onClick={handleComplete} disabled={registerLoading || !termsAccepted} className="lp-btn lp-btn--primary"
              style={{ width: '100%', padding: '20px', fontSize: '1.2rem', boxShadow: termsAccepted ? '0 0 30px var(--lp-primary-glow)' : 'none', opacity: (registerLoading || !termsAccepted) ? 0.5 : 1, cursor: (registerLoading || !termsAccepted) ? 'not-allowed' : 'pointer' }}>
              {registerLoading ? 'Creando cuenta...' : 'Empezar a vender'} {!registerLoading && <Svg.ArrowRight />}
            </button>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="lp-noise" style={{ fontFamily: 'var(--lp-font-body)', color: 'var(--lp-text)', minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div className="lp-canvas" />

      <nav style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px)', position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <img src={theme === 'dark' ? LogoPrincipal : LogoLight} alt="MiNegocio" style={{ height: 'clamp(40px, 8vw, 64px)', objectFit: 'contain' }} />
        </a>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', left: 'clamp(16px, 4vw, 40px)', background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)', color: 'var(--lp-ink)', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 600 }}>
          <Svg.ArrowLeft /> Salir
        </button>
      </nav>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', zIndex: 10 }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <div style={{ width: '100%', height: 4, background: 'var(--lp-paper-sunken)', borderRadius: 4, marginBottom: 40, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--lp-primary), var(--lp-primary-ink))', width: `${progress}%`, transition: 'width 0.4s ease' }} />
          </div>
          <div className="lp-glass" style={{ padding: 'clamp(28px, 6vw, 60px) clamp(20px, 5vw, 48px)', borderRadius: 24, border: '1px solid var(--lp-line-strong)', background: 'var(--lp-paper-raised)', minHeight: 400, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {step > 1 && step < TOTAL_STEPS && (
              <button onClick={handlePrev} style={{ background: 'none', border: 'none', color: 'var(--lp-text-muted)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 24, padding: 0, fontSize: '0.95rem' }}
                onMouseEnter={e => e.target.style.color = 'var(--lp-ink)'}
                onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>
                <Svg.ArrowLeft /> Volver
              </button>
            )}
            {renderStep()}
          </div>
        </div>
      </main>
    </div>
  );
}

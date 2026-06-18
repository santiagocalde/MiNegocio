import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/ui/Icons';
import LogoPrincipal from '../assets/images/MiNegocio_transparente_real.png';

const Svg = {
  ArrowRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
  ArrowLeft: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  CheckCircle: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
};

const tiposNegocio = [
  { id: 'kiosco', label: 'Kiosco', icon: <Icons.Package /> },
  { id: 'almacen', label: 'Almacén', icon: <Icons.Box /> },
  { id: 'minimercado', label: 'Mini Mercado', icon: <Icons.ShoppingCart /> },
  { id: 'dietetica', label: 'Dietética', icon: <Icons.Sparkles /> },
  { id: 'panaderia', label: 'Panadería', icon: <Icons.Tag /> },
  { id: 'carniceria', label: 'Carnicería', icon: <Icons.Truck /> },
  { id: 'verduleria', label: 'Verdulería', icon: <Icons.Image /> },
  { id: 'fiambreria', label: 'Fiambrería', icon: <Icons.Clipboard /> },
  { id: 'ferreteria', label: 'Ferretería', icon: <Icons.Settings /> },
  { id: 'libreria', label: 'Librería', icon: <Icons.Book /> },
  { id: 'petshop', label: 'Pet Shop', icon: <Icons.Users /> },
  { id: 'otro', label: 'Otro', icon: <Icons.Crown /> },
];

const objetivos = [
  { id: 'stock', label: 'Controlar stock' },
  { id: 'robos', label: 'Evitar robos' },
  { id: 'rapidez', label: 'Facturar rápido' },
  { id: 'ganancias', label: 'Saber cuánto gano' },
  { id: 'cuentas', label: 'Cuentas claras' },
  { id: 'orden', label: 'Ordenar el negocio' },
  { id: 'precios', label: 'Actualizar precios' },
  { id: 'tiempo', label: 'Ahorrar tiempo' },
  { id: 'otro', label: 'Otro' }
];

const prefijos = [
  { code: '+54', country: '🇦🇷' },
  { code: '+56', country: '🇨🇱' },
  { code: '+57', country: '🇨🇴' },
  { code: '+52', country: '🇲🇽' },
  { code: '+51', country: '🇵🇪' },
  { code: '+598', country: '🇺🇾' },
  { code: '+595', country: '🇵🇾' },
  { code: '+591', country: '🇧🇴' },
  { code: '+34', country: '🇪🇸' },
  { code: '+1', country: '🇺🇸' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [formData, setFormData] = useState({
    prefijo: '+54', telefono: '', email: '', nombre: '', negocio: '', tipo: '', posPrevio: '', arca: '', objetivo: ''
  });

  const TOTAL_STEPS = 9;
  const progress = (step / TOTAL_STEPS) * 100;
  
  const isLoggedIn = !!localStorage.getItem('saas_token');

  useEffect(() => {
    document.body.classList.add('landing-open');
    if (isLoggedIn) {
      setStep(1); // Pedir telefono siempre, aunque ya este registrado
    }
    return () => document.body.classList.remove('landing-open');
  }, [isLoggedIn]);

  // Auto-avanzar pasos de email y nombre si ya esta logueado
  useEffect(() => {
    if (isLoggedIn && (step === 2 || step === 3)) {
      setStep(4);
    }
  }, [step, isLoggedIn]);

  const handleNext = () => {
    setDirection(1);
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };
  const handlePrev = () => {
    setDirection(-1);
    setStep(s => Math.max(s - 1, 1));
  };

  const handleComplete = async () => {
    setRegisterLoading(true);
    setRegisterError('');
    try {
      const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8005';
      
      if (isLoggedIn) {
        const token = localStorage.getItem('saas_token');
        const res = await fetch(`${baseUrl}/api/auth/complete-onboarding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            business_name: formData.negocio,
            phone: `${formData.prefijo} ${formData.telefono}`,
            business_type: formData.tipo,
            prior_pos: formData.posPrevio,
            needs_arca: formData.arca,
            objective: formData.objetivo,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || 'Error al completar el registro');
        }

        const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
        biz.business_name = formData.negocio;
        localStorage.setItem('saas_business', JSON.stringify(biz));
        localStorage.setItem('minegocio_current_operator', JSON.stringify({ name: formData.nombre || 'Dueño', role: 'admin' }));
        localStorage.removeItem('minegocio_onboarding_pending');
        window.location.href = '/panel';
      } else {
        const registerPassword = formData.telefono.replace(/[^0-9]/g, '').slice(-8).padStart(8, '0') + 'Aa1';
        const res = await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: registerPassword,
            name: formData.nombre,
            business_name: formData.negocio,
            phone: `${formData.prefijo} ${formData.telefono}`,
            business_type: formData.tipo,
            prior_pos: formData.posPrevio,
            needs_arca: formData.arca,
            objective: formData.objetivo,
          }),
        });

        if (!res.ok) {
          let errStr = 'Error al crear la cuenta';
          try {
            const data = await res.json();
            if (data.detail) {
              errStr = Array.isArray(data.detail) ? data.detail[0].msg : data.detail;
            }
          } catch (e) {
            errStr = `Error del servidor (${res.status})`;
          }
          throw new Error(errStr);
        }

        const data = await res.json();
        localStorage.setItem('saas_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('saas_refresh_token', data.refresh_token);
        localStorage.setItem('saas_business', JSON.stringify(data.business));
        localStorage.setItem('minegocio_current_operator', JSON.stringify({ name: formData.nombre || 'Dueño', role: 'admin' }));
        if (data.operator_pin) {
          localStorage.setItem('minegocio_onboarding_pin', data.operator_pin);
        }
        localStorage.removeItem('saas_mode');
        localStorage.removeItem('minegocio_onboarding_pending');

        window.location.href = '/panel';
      }
    } catch (err) {
      setRegisterError(err.message);
      setRegisterLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>¿Cuál es tu número de WhatsApp?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Lo pedimos por seguridad para enviarte notificaciones importantes y darte soporte directo. No enviamos spam.</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
              <div style={{ position: 'relative' }}>
                <select value={formData.prefijo} onChange={e => setFormData({ ...formData, prefijo: e.target.value })} style={{ width: 110, padding: '16px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '1.1rem', fontWeight: 600, outline: 'none', appearance: 'none', cursor: 'pointer', transition: 'all 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}>
                  {prefijos.map(p => (
                    <option key={p.code} value={p.code} style={{ background: '#1E3A5F', color: '#fff' }}>{p.country} {p.code}</option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.5)' }}>▼</div>
              </div>
              <input type="tel" placeholder="11 1234 5678" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value.replace(/[^0-9\s-]/g, '') })} style={{ flex: 1, padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '1.1rem', outline: 'none', transition: 'all 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} autoFocus />
            </div>
            <button onClick={handleNext} disabled={formData.telefono.length < 8} className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: formData.telefono.length < 8 ? 0.5 : 1 }}>Continuar</button>
          </div>
        );
      case 2:
        if (isLoggedIn) return null;
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>Tu correo electrónico</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Este será el mail que uses para iniciar sesión en tu cuenta todos los días.</p>
            <input type="email" placeholder="kiosco@ejemplo.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '1.1rem', outline: 'none', transition: 'all 0.2s', marginBottom: 32 }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} autoFocus />
            <button onClick={handleNext} disabled={!formData.email.includes('@')} className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: !formData.email.includes('@') ? 0.5 : 1 }}>Continuar</button>
          </div>
        );
      case 3:
        if (isLoggedIn) return null;
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>¿Cómo te llamás?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Queremos saber con quién hablamos para darte una atención más personalizada.</p>
            <input type="text" placeholder="Ej. Carlos Pérez" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '1.1rem', outline: 'none', transition: 'all 0.2s', marginBottom: 32 }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} autoFocus />
            <button onClick={handleNext} disabled={formData.nombre.length < 2} className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: formData.nombre.length < 2 ? 0.5 : 1 }}>Continuar</button>
          </div>
        );
      case 4:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>Nombre de tu negocio</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Este nombre aparecerá en los tickets de tus clientes y en el panel principal.</p>
            <input type="text" placeholder="Ej. Kiosco Don Carlos" value={formData.negocio} onChange={e => setFormData({ ...formData, negocio: e.target.value })} style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '1.1rem', outline: 'none', transition: 'all 0.2s', marginBottom: 32 }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} autoFocus />
            <button onClick={handleNext} disabled={formData.negocio.length < 2} className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', opacity: formData.negocio.length < 2 ? 0.5 : 1 }}>Continuar</button>
          </div>
        );
      case 5:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>¿De qué trata tu negocio?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Seleccioná la categoría que mejor te represente.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
              {tiposNegocio.map(tipo => (
                <button key={tipo.id} onClick={() => { setFormData({ ...formData, tipo: tipo.id }); handleNext(); }} style={{ background: formData.tipo === tipo.id ? 'rgba(20,187,166,0.15)' : 'rgba(255,255,255,0.03)', border: formData.tipo === tipo.id ? '1px solid var(--lp-primary)' : '1px solid rgba(255,255,255,0.1)', padding: '20px 12px', borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}>
                  <span style={{ display: 'inline-flex', width: 40, height: 40, color: 'var(--lp-primary)' }}>{tipo.icon}</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{tipo.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 6:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>¿Usaste un sistema de ventas antes?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Esto nos ayuda a adaptar la experiencia a tus conocimientos previos.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['Sí, actualmente uso uno', 'Lo usé en el pasado', 'No, siempre usé cuaderno / memoria'].map((opt, i) => (
                 <button key={i} onClick={() => { setFormData({ ...formData, posPrevio: opt }); handleNext(); }} style={{ background: formData.posPrevio === opt ? 'rgba(20,187,166,0.15)' : 'rgba(255,255,255,0.03)', border: formData.posPrevio === opt ? '1px solid var(--lp-primary)' : '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: 12, cursor: 'pointer', color: '#fff', fontSize: '1.05rem', fontWeight: 600, textAlign: 'left', transition: 'all 0.2s' }}>
                   {opt}
                 </button>
              ))}
            </div>
          </div>
        );
      case 7:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>¿Necesitás facturar con ARCA (ex AFIP)?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Podemos conectar tu cuenta para que emitas tickets fiscales de forma automática.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['Sí, necesito emitir facturas electrónicas', 'No, facturo por mi cuenta / no facturo', 'Aún no lo sé, lo decido después'].map((opt, i) => (
                 <button key={i} onClick={() => { setFormData({ ...formData, arca: opt }); handleNext(); }} style={{ background: formData.arca === opt ? 'rgba(20,187,166,0.15)' : 'rgba(255,255,255,0.03)', border: formData.arca === opt ? '1px solid var(--lp-primary)' : '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: 12, cursor: 'pointer', color: '#fff', fontSize: '1.05rem', fontWeight: 600, textAlign: 'left', transition: 'all 0.2s' }}>
                   {opt}
                 </button>
              ))}
            </div>
          </div>
        );
      case 8:
        return (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>¿Qué buscás resolver principalmente?</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32 }}>Seleccioná tu objetivo principal para que podamos ayudarte a lograrlo.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
              {objetivos.map(obj => (
                <button key={obj.id} onClick={() => { setFormData({ ...formData, objetivo: obj.label }); handleNext(); }} style={{ background: formData.objetivo === obj.label ? 'rgba(20,187,166,0.15)' : 'rgba(255,255,255,0.03)', border: formData.objetivo === obj.label ? '1px solid var(--lp-primary)' : '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: 12, cursor: 'pointer', color: '#fff', fontSize: '0.95rem', fontWeight: 600, textAlign: 'left', transition: 'all 0.2s' }}>
                  {obj.label}
                </button>
              ))}
            </div>
          </div>
        );
      case 9:
        return (
          <div style={{ animation: 'fadeIn 0.5s ease', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
               <Svg.CheckCircle />
            </div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', marginBottom: 16, letterSpacing: '-0.5px' }}>¡Estas listo{formData.nombre ? `, ${formData.nombre.split(' ')[0]}` : ''}!</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '1.05rem', marginBottom: 40, maxWidth: 400, margin: '0 auto 40px' }}>Bienvenido a <strong>{formData.negocio || 'MiNegocio'}</strong>. La demo de 7 dias te permitira probar todo sin restricciones.</p>
            
            <div style={{ background: 'rgba(20,187,166,0.1)', border: '1px solid rgba(20,187,166,0.3)', borderRadius: 12, padding: '16px', marginBottom: 24, textAlign: 'left' }}>
              <p style={{ color: '#fff', fontSize: '0.9rem', margin: '0 0 8px 0', fontWeight: 700 }}>Datos de acceso — guardalos</p>
              <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.85rem', margin: '0 0 4px 0' }}>Email: <strong style={{ color: '#fff' }}>{formData.email}</strong></p>
              <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.85rem', margin: 0 }}>Contraseña: <strong style={{ color: '#fff', fontFamily: 'var(--lp-font-mono)' }}>{formData.telefono.replace(/[^0-9]/g, '').slice(-8).padStart(8, '0') + 'Aa1'}</strong></p>
            </div>
            
            {registerError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontWeight: 600, fontSize: '0.9rem' }}>
                {registerError}
              </div>
            )}

            <button onClick={handleComplete} disabled={registerLoading} className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '20px', fontSize: '1.2rem', boxShadow: '0 0 30px rgba(15,138,125, 0.4)', opacity: registerLoading ? 0.6 : 1, cursor: registerLoading ? 'not-allowed' : 'pointer' }}>
              {registerLoading ? 'Creando cuenta...' : 'Entrar al Sistema'} {!registerLoading && <Svg.ArrowRight />}
            </button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="lp-noise" style={{ fontFamily: 'var(--lp-font-body)', color: 'var(--lp-text)', minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div className="lp-canvas" />
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--3" />
      
      {/* Header simple para poder volver */}
      <nav style={{ padding: '32px 40px', position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
         <a href="/" style={{ textDecoration: 'none' }}>
            <img src={LogoPrincipal} alt="MiNegocio" style={{ height: 140, objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(15,138,125, 0.3))', transform: 'scale(1.5)', marginTop: -20 }} />
         </a>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', left: 40, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 600 }}>
          <Svg.ArrowLeft /> Salir
        </button>
      </nav>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', zIndex: 10 }}>
         <div style={{ width: '100%', maxWidth: 640 }}>
            {/* Progress bar */}
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 40, overflow: 'hidden' }}>
               <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--lp-primary), var(--lp-secondary))', width: `${progress}%`, transition: 'width 0.4s ease' }} />
            </div>

            <div className="lp-glass" style={{ padding: '60px 48px', borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,58,95,0.85)', minHeight: 400, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
               {step > 1 && step < TOTAL_STEPS && (
                 <button onClick={handlePrev} style={{ background: 'none', border: 'none', color: 'var(--lp-text-muted)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 24, padding: 0, fontSize: '0.95rem' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>
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

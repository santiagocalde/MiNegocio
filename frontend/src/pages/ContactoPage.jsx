import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Svg = {
  ArrowLeft: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Mail: () => <svg width="24" height="24" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
  Phone: () => <svg width="24" height="24" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>,
  MapPin: () => <svg width="24" height="24" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
};

export default function ContactoPage() {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', contacto: '', mensaje: '' });

  useEffect(() => {
    document.body.classList.add('landing-open');
    window.scrollTo(0, 0);
    return () => document.body.classList.remove('landing-open');
  }, []);

  const handleSend = async () => {
    if (!formData.nombre || !formData.contacto || !formData.mensaje) {
      setErrorMsg('Por favor, completa todos los campos.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8005';
      const res = await fetch(`${baseUrl}/api/send-contact-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSent(true);
        setFormData({ nombre: '', contacto: '', mensaje: '' });
      } else {
        setErrorMsg('Hubo un error al enviar el mensaje. Reintenta por favor.');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Error de red. Asegurate de tener conexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-noise" style={{ fontFamily: 'var(--lp-font-body)', color: 'var(--lp-text)', minHeight: '100vh', position: 'relative', padding: '40px 24px' }}>
      <div className="lp-canvas" />
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />

      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--lp-text-muted)', fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>
          <Svg.ArrowLeft /> Volver a Inicio
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
          
          {/* Info de contacto */}
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: 16, color: '#fff' }}>Contacto</h1>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.5, color: 'rgba(230,255,251,0.7)', marginBottom: 32 }}>
              ¿Tenés dudas sobre nuestros planes personalizados o querés una demostración en vivo? Escribinos y un especialista se pondrá en contacto con vos a la brevedad.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 10, background: 'rgba(20,187,166,0.1)', borderRadius: 10 }}>
                  <Svg.Mail />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--lp-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Email</div>
                  <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 500 }}>upcodednow@gmail.com</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 10, background: 'rgba(20,187,166,0.1)', borderRadius: 10 }}>
                  <Svg.Phone />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--lp-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>WhatsApp</div>
                  <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 500 }}>+54 9 11 4427-6384</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 10, background: 'rgba(20,187,166,0.1)', borderRadius: 10 }}>
                  <Svg.MapPin />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--lp-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Oficinas</div>
                  <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 500 }}>Buenos Aires, Argentina</div>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="lp-glass" style={{ padding: '32px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(35,65,105,0.85)' }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: 56, height: 56, background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h3 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: 8 }}>¡Mensaje enviado!</h3>
                <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.9rem' }}>Nos pondremos en contacto con vos en las próximas horas.</p>
                <button onClick={() => setSent(false)} className="lp-btn lp-btn--ghost" style={{ marginTop: 20, padding: '8px 20px', fontSize: '0.85rem' }}>Enviar otro</button>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {errorMsg && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontWeight: 500, fontSize: '0.85rem' }}>{errorMsg}</div>}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Nombre completo</label>
                  <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Tu nombre" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', fontSize: '0.9rem', transition: 'all 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Email o Teléfono</label>
                  <input type="text" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} placeholder="Para contactarte" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', fontSize: '0.9rem', transition: 'all 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Mensaje</label>
                  <textarea value={formData.mensaje} onChange={e => setFormData({...formData, mensaje: e.target.value})} placeholder="¿En qué te podemos ayudar?" rows="4" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', fontSize: '0.9rem', transition: 'all 0.2s', resize: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                <button onClick={handleSend} disabled={loading} style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(90deg, var(--lp-primary), var(--lp-secondary))', color: loading ? 'var(--lp-text-muted)' : '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, boxShadow: loading ? 'none' : '0 8px 24px rgba(20,187,166, 0.3)', transition: 'all 0.2s' }}>
                  {loading ? 'Enviando...' : 'Enviar Mensaje'}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

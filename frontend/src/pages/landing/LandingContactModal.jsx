import { useState } from 'react';
import useModalExit, { overlayAnim, contentAnim } from '../../hooks/useModalExit';

const Svg = { X: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg> };

export default function LandingContactModal({ showContactModal, setShowContactModal }) {
  const [contactForm, setContactForm] = useState({ nombre: '', contacto: '', mensaje: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState('');

  const handleContactSubmit = async () => {
    if (!contactForm.nombre.trim() || !contactForm.contacto.trim() || !contactForm.mensaje.trim()) return;
    setContactLoading(true); setContactError('');
    try {
      const res = await fetch('/api/send-contact-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: contactForm.nombre, contacto: contactForm.contacto, mensaje: contactForm.mensaje }),
      });
      if (res.ok) { setContactSent(true); } else { setContactError('No se pudo enviar. Probá de nuevo.'); }
    } catch { setContactError('Error de conexión.'); }
    setContactLoading(false);
  };

  const { rendered, closing } = useModalExit(showContactModal);
  if (!rendered) return null;

  const inputStyle = {
    width: '100%', padding: '14px 16px', marginTop: 6,
    background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)',
    borderRadius: 12, color: 'var(--lp-ink)', outline: 'none',
    fontSize: '0.95rem', transition: 'border-color 0.2s',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,19,43,0.85)', backdropFilter: 'blur(20px)', padding: 20, ...overlayAnim(closing) }}
      onMouseDown={e => { if (e.target === e.currentTarget) setShowContactModal(false); }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 24, padding: '40px 38px 32px', position: 'relative', boxShadow: 'var(--lp-shadow-lg)', ...contentAnim(closing) }}>
        <button onClick={() => setShowContactModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'var(--lp-paper-sunken)', border: 'none', color: 'var(--lp-ink-faint)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'color 0.18s, transform 0.18s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--lp-ink)'; e.currentTarget.style.background = 'var(--lp-primary-wash)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-ink-faint)'; e.currentTarget.style.background = 'var(--lp-paper-sunken)'; }}>
          <Svg.X />
        </button>
        <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--lp-ink)', marginBottom: 8, letterSpacing: '-0.03em' }}>Escribinos</h2>
        <p style={{ color: 'var(--lp-ink-faint)', fontSize: '0.9rem', marginBottom: 20 }}>
          <span style={{ color: 'var(--lp-ink-soft)', fontWeight: 600 }}>Email:</span> calderonsantiago2019@gmail.com <br/>
          <span style={{ color: 'var(--lp-ink-soft)', fontWeight: 600 }}>WhatsApp:</span> +54 9 11 4427-6384
        </p>

        {contactSent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--lp-ink)', marginBottom: 8, fontWeight: 700 }}>¡Mensaje enviado!</h3>
            <p style={{ color: 'var(--lp-ink-faint)', marginBottom: 24 }}>Te respondemos en menos de 24 horas.</p>
            <button onClick={() => setShowContactModal(false)} className="lp-btn lp-btn--primary" style={{ padding: '14px 32px' }}>Listo</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {contactError && <div style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem' }}>{contactError}</div>}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--lp-ink-soft)', fontWeight: 500 }}>Tu Nombre <span style={{ color: 'var(--lp-primary)' }}>*</span></label>
              <input placeholder="Ej: Carlos" value={contactForm.nombre} onChange={e => setContactForm({ ...contactForm, nombre: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'var(--lp-line-strong)'} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--lp-ink-soft)', fontWeight: 500 }}>Email o WhatsApp <span style={{ color: 'var(--lp-primary)' }}>*</span></label>
              <input placeholder="Ej: tuemail@mail.com o tu WhatsApp" value={contactForm.contacto} onChange={e => setContactForm({ ...contactForm, contacto: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'var(--lp-line-strong)'} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--lp-ink-soft)', fontWeight: 500 }}>Mensaje <span style={{ color: 'var(--lp-primary)' }}>*</span></label>
              <textarea placeholder="¿En qué podemos ayudarte?" value={contactForm.mensaje} onChange={e => setContactForm({ ...contactForm, mensaje: e.target.value })} rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 100, fontFamily: 'inherit' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'var(--lp-line-strong)'} />
            </div>
            <button onClick={handleContactSubmit} disabled={contactLoading || !contactForm.nombre.trim() || !contactForm.contacto.trim() || !contactForm.mensaje.trim()}
              className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: 700, borderRadius: 12, opacity: (contactLoading || !contactForm.nombre.trim() || !contactForm.contacto.trim() || !contactForm.mensaje.trim()) ? 0.5 : 1, cursor: (contactLoading || !contactForm.nombre.trim() || !contactForm.contacto.trim() || !contactForm.mensaje.trim()) ? 'not-allowed' : 'pointer' }}>
              {contactLoading ? 'Enviando...' : 'Enviar mensaje'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

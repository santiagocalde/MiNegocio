const Svg = {
  X: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>,
};

export default function LandingContactModal({ showContactModal, setShowContactModal, contactSent, setContactSent, contactLoading, contactForm, setContactForm, handleContactSubmit, contactError }) {
  if (!showContactModal) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(20px)', padding: 20, animation: 'fadeIn 0.2s ease' }} onMouseDown={(e) => { if (e.target === e.currentTarget) setShowContactModal(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setShowContactModal(false); }}>
      <style>{`
        .contact-input {
          width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08); borderRadius: 12px; color: #fff;
          outline: none; fontSize: 0.95rem; fontFamily: inherit; transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }
        .contact-input:focus {
          border-color: var(--lp-primary) !important;
          background: rgba(20, 187, 166, 0.05) !important;
          box-shadow: 0 0 0 4px rgba(20, 187, 166, 0.15) !important;
        }
        .contact-btn {
          background: linear-gradient(135deg, var(--lp-primary), var(--lp-secondary));
          background-size: 200% auto;
          animation: gradient-shift 3s ease infinite;
          border: none;
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'linear-gradient(145deg, rgba(25, 35, 55, 0.95) 0%, rgba(15, 20, 35, 0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '40px', position: 'relative', boxShadow: '0 40px 80px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)' }}>
        <button onClick={() => setShowContactModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--lp-text-muted)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}>
          <Svg.X />
        </button>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '-0.5px' }}>Escribinos</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', marginBottom: 28, lineHeight: 1.5 }}>
          Respondemos rápido.<br/>
          <span style={{ color: '#fff', fontWeight: 600 }}>Email:</span> upcodednow@gmail.com <br/>
          <span style={{ color: '#fff', fontWeight: 600 }}>WhatsApp:</span> +54 9 11 4427-6384
        </p>
        {contactSent ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 30px rgba(16,185,129,0.2)' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h3 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: 8, fontWeight: 700 }}>¡Mensaje enviado!</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>Nos pondremos en contacto con vos a la brevedad.</p>
            <button onClick={() => { setContactSent(false); setShowContactModal(false); }} className="lp-btn lp-btn--ghost" style={{ marginTop: 24, padding: '10px 24px', fontSize: '0.9rem', borderRadius: 100 }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {contactError && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontWeight: 500, fontSize: '0.85rem' }}>{contactError}</div>}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'block', marginBottom: 8, letterSpacing: '0.3px' }}>Nombre completo</label>
              <input className="contact-input" type="text" value={contactForm.nombre} onChange={e => setContactForm({...contactForm, nombre: e.target.value})} placeholder="Ej. Juan Pérez" />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'block', marginBottom: 8, letterSpacing: '0.3px' }}>Email o Teléfono</label>
              <input className="contact-input" type="text" value={contactForm.contacto} onChange={e => setContactForm({...contactForm, contacto: e.target.value})} placeholder="Para que podamos contactarte" />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600, display: 'block', marginBottom: 8, letterSpacing: '0.3px' }}>Mensaje</label>
              <textarea className="contact-input" value={contactForm.mensaje} onChange={e => setContactForm({...contactForm, mensaje: e.target.value})} placeholder="¿En qué te podemos ayudar?" rows="4" style={{ resize: 'none' }} />
            </div>
            <button className={(contactLoading || !contactForm.nombre || !contactForm.mensaje) ? '' : 'contact-btn'} onClick={handleContactSubmit} disabled={contactLoading || !contactForm.nombre || !contactForm.mensaje} style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: (contactLoading || !contactForm.nombre || !contactForm.mensaje) ? 'rgba(255,255,255,0.05)' : '', color: (contactLoading || !contactForm.nombre || !contactForm.mensaje) ? 'rgba(255,255,255,0.4)' : '#fff', fontSize: '1.05rem', fontWeight: 700, cursor: (contactLoading || !contactForm.nombre || !contactForm.mensaje) ? 'not-allowed' : 'pointer', marginTop: 8, boxShadow: (contactLoading || !contactForm.nombre || !contactForm.mensaje) ? 'none' : '0 10px 30px rgba(20,187,166, 0.3)', transition: 'all 0.3s' }}>
              {contactLoading ? 'Enviando...' : 'Enviar Mensaje'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

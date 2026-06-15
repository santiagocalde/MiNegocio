export default function LandingFooter({ navigate, setShowContactModal, handleDogClick, logoImg, mascotaImg }) {
  return (
    <footer style={{ padding: '220px 24px 60px', textAlign: 'center', color: 'var(--lp-text-muted)', background: 'transparent', position: 'relative', zIndex: 10, borderTop: 'none' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}>
        <img src={logoImg} alt="MiNegocio" loading="lazy" style={{ height: 160, objectFit: 'contain', transform: 'scale(1.8)', transformOrigin: 'center bottom' }} />

        <div style={{ marginTop: 20, marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img onClick={handleDogClick} src={mascotaImg} alt="Perrito Guardián" loading="lazy" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(30,58,95,0.5)', transition: 'transform 0.3s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05) rotate(2deg)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1) rotate(0deg)'} />
          <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--lp-text-muted)' }}>Con la garantía de nuestra Oficial de Seguridad 🐾</span>
        </div>

        <p style={{ fontSize: '1.2rem', lineHeight: 1.6, maxWidth: 500, margin: '0', fontFamily: 'var(--lp-font-display)', fontWeight: 300 }}>
          El sistema Punto de Venta definitivo para los comercios de Argentina. Rápido, seguro y sin depender de internet.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 32, fontSize: '0.95rem', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 24 }}>
          <a href="#funciones" style={{ color: 'var(--lp-text-muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>Funciones</a>
          <a href="#planes" style={{ color: 'var(--lp-text-muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>Planes</a>
          <span onClick={() => setShowContactModal(true)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setShowContactModal(true); }} style={{ color: 'var(--lp-text-muted)', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>Contacto</span>
          <span onClick={() => { document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ color: 'var(--lp-text-muted)', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>Preguntas Frecuentes</span>
          <span onClick={() => navigate('/nosotros')} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') navigate('/nosotros'); }} style={{ color: 'var(--lp-text-muted)', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>Nosotros</span>
        </div>
        <p style={{ fontSize: '0.85rem', letterSpacing: '0.5px' }}>© 2026 MiNegocio · Hecho con fuerza para los kioscos de Argentina</p>
        <div style={{ display: 'flex', gap: 20, fontSize: '0.8rem', color: 'var(--lp-text-muted)' }}>
          <span onClick={() => navigate('/terminos')} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') navigate('/terminos'); }} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>Terminos y Condiciones</span>
          <span onClick={() => navigate('/privacidad')} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') navigate('/privacidad'); }} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>Politica de Privacidad</span>
        </div>
      </div>
    </footer>
  );
}

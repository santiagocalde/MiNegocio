import { Reveal } from './hooks/useReveal';

const Svg = {
  ArrowRight: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Check: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
};

export default function LandingFinalCTA({ isLoggedIn, goPanel, goOnboard }) {
  return (
    <section style={{ padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', background: 'radial-gradient(circle at center, rgba(20,187,166,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{ background: 'linear-gradient(145deg, rgba(30,58,95,0.4), rgba(11,19,43,0.8))', border: '1px solid rgba(20,187,166,0.2)', borderRadius: 32, padding: '64px 40px', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(20,187,166,0.05)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, transparent, var(--lp-primary), transparent)' }} />
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#fff', letterSpacing: '-1px', marginBottom: 16, lineHeight: 1.1 }}>
              {isLoggedIn ? 'Tu negocio te espera' : 'Dejá de perder plata anotando mal.'}
            </h2>
            <p style={{ color: 'rgba(230,255,251,0.7)', fontSize: '1.1rem', marginBottom: 40, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              {isLoggedIn ? 'Accedé a tu panel y continuá gestionando todo fácilmente.' : 'Empezá hoy mismo. En 5 minutos estás cobrando tu primera venta con sistema y sin estrés.'}
            </p>
            <button onClick={isLoggedIn ? goPanel : goOnboard} className="lp-btn lp-btn--primary" style={{ padding: '20px 56px', fontSize: '1.2rem', borderRadius: 100, transition: 'all 0.3s ease', boxShadow: '0 0 30px rgba(20,187,166, 0.4)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 15px 40px rgba(20,187,166, 0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(20,187,166, 0.4)'; }}>
              {isLoggedIn ? 'Ir a mi Panel' : 'Empezar 7 días gratis'} <Svg.ArrowRight />
            </button>
            {!isLoggedIn && (
              <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Svg.Check /> Sin tarjeta de crédito</span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Svg.Check /> Cancelás cuando querés</span>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

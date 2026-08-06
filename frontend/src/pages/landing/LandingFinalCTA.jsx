import { Reveal } from './hooks/useReveal';

const Svg = {
  ArrowRight: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Check: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
};

export default function LandingFinalCTA({ isLoggedIn, goPanel, goOnboard }) {
  return (
    <section style={{ padding: '64px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{ background: 'var(--lp-primary-wash)', border: '1px solid var(--lp-line-strong)', borderRadius: 24, padding: '48px 36px', textAlign: 'center', boxShadow: 'var(--lp-shadow-md)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, var(--lp-primary), transparent)' }} />
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontWeight: 700, fontSize: 'clamp(1.7rem, 3vw, 2.4rem)', color: 'var(--lp-ink)', letterSpacing: '-0.03em', marginBottom: 14, lineHeight: 1.08 }}>
              {isLoggedIn ? 'Tu negocio te espera' : 'Dejá de perder plata anotando mal.'}
            </h2>
            <p style={{ color: 'var(--lp-ink-soft)', fontSize: '1.05rem', marginBottom: 30, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              {isLoggedIn ? 'Accedé a tu panel y continuá gestionando todo fácilmente.' : 'Empezá hoy mismo. En 5 minutos estás cobrando tu primera venta con sistema y sin estrés.'}
            </p>
            <button onClick={isLoggedIn ? goPanel : goOnboard} className="lp-btn lp-btn--primary" style={{ padding: '16px 44px', fontSize: '1.12rem' }}>
              {isLoggedIn ? 'Ir a mi Panel' : 'Empezar 7 días gratis'} <Svg.ArrowRight />
            </button>
            {!isLoggedIn && (
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--lp-ink-faint)', fontSize: '0.85rem', fontWeight: 600, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--lp-primary-ink)' }}><Svg.Check /> Sin tarjeta de crédito</span>
                <span style={{ color: 'var(--lp-line-strong)' }}>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--lp-primary-ink)' }}><Svg.Check /> Cancelás cuando querés</span>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

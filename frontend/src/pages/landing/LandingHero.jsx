import { Reveal } from './hooks/useReveal';

const Svg = { ArrowRight: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg> };

export default function LandingHero({ isLoggedIn, goPanel, goOnboard }) {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '120px 16px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Reveal delay={1}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(20,187,166, 0.1)', border: '1px solid rgba(20,187,166, 0.2)', borderRadius: 100, marginBottom: 32, fontSize: '0.75rem', fontWeight: 600, color: 'var(--lp-primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--lp-primary)', boxShadow: '0 0 10px var(--lp-primary)' }}></span>
            EL SISTEMA DE KIOSCOS #1 DE ARGENTINA
          </div>
          <h1 style={{
            fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, var(--lp-font-display), sans-serif',
            fontSize: 'clamp(2.5rem, 8.5vw, 6.5rem)',
            lineHeight: 1.15,
            letterSpacing: '-2px',
            fontWeight: 800,
            marginBottom: 24,
            paddingTop: '0.05em',
            paddingLeft: '0.1em',
            paddingRight: '0.1em',
            color: '#ffffff'
          }}>
            ¿Seguís usando<br />
            <span className="lp-gradient-text" style={{ fontStyle: 'italic' }}>hoja y lápiz?</span>
          </h1>
        </Reveal>
        <Reveal delay={2}>
          <p style={{
            fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, var(--lp-font-display), sans-serif',
            fontSize: 'clamp(1.2rem, 5vw, 2.2rem)',
            color: 'var(--lp-text)',
            letterSpacing: '-1px',
            marginBottom: 32,
            fontWeight: 600,
          }}>
            Digitalizá. Cobrá. Crecé.
          </p>
        </Reveal>
        <Reveal delay={3}>
          <p style={{
            fontSize: '1.25rem', color: 'rgba(230,255,251, 0.7)',
            lineHeight: 1.6, maxWidth: 650, margin: '0 auto 48px', fontWeight: 500
          }}>
            <strong style={{ color: '#fff', fontWeight: 700 }}>El sistema de ventas para tu kiosco que funciona sin internet.</strong> Dejá de perder plata por cuentas mal hechas y recuperá las horas que perdés cerrando caja.
          </p>
        </Reveal>
        <Reveal delay={4}>
          <style>{`
            @keyframes shine-sweep {
              0% { left: -100%; }
              20% { left: 200%; }
              100% { left: 200%; }
            }
            .btn-nuevo {
              position: relative;
              overflow: hidden;
              background: linear-gradient(90deg, var(--lp-primary), var(--lp-secondary));
              transition: all 0.3s ease;
              border-radius: 100px;
              box-shadow: 0 0 20px rgba(20,187,166, 0.4);
            }
            .btn-nuevo:hover {
              transform: translateY(-2px);
              box-shadow: 0 0 40px rgba(20,187,166, 0.8);
            }
            .btn-nuevo::after {
              content: "";
              position: absolute;
              top: 0;
              left: -100%;
              width: 60%;
              height: 100%;
              background: linear-gradient(
                to right,
                rgba(255, 255, 255, 0) 0%,
                rgba(255, 255, 255, 0.85) 50%,
                rgba(255, 255, 255, 0) 100%
              );
              transform: skewX(-25deg);
              animation: shine-sweep 3.5s infinite;
            }
          `}</style>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <button onClick={isLoggedIn ? goPanel : goOnboard} className="lp-btn lp-btn--primary btn-nuevo" style={{ padding: '18px 48px', fontSize: '1.15rem', fontWeight: 700, border: 'none' }}>
              {isLoggedIn ? 'Ir a mi Panel' : 'Probar Gratis 7 Días'} <Svg.ArrowRight />
            </button>
            <div style={{ fontSize: '0.85rem', color: 'rgba(230,255,251,0.55)', fontWeight: 500 }}>
              Sin tarjeta de crédito · Cancelás cuando quieras
            </div>
            <a href="#planes" style={{ fontSize: '0.95rem', color: 'rgba(230,255,251,0.7)', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid rgba(230,255,251,0.2)', paddingBottom: 2, marginTop: 4 }}>
              o mirá los planes
            </a>
          </div>
        </Reveal>
        <Reveal delay={5}>
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'center', marginTop: 32, flexWrap: 'wrap', width: '100%', maxWidth: '800px', margin: '32px auto 0' }}>
            {[
              { label: 'Sin internet', desc: 'Seguís vendiendo' },
              { label: 'Sin límites', desc: 'Stock ilimitado' },
              { label: 'Sin tarjeta', desc: '7 días gratis' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.label}</div>
                <div style={{ color: 'var(--lp-text-muted)', fontSize: '0.8rem', marginTop: 4 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

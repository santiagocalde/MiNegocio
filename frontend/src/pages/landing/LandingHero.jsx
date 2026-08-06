import { useState, useEffect } from 'react';
import { Reveal } from './hooks/useReveal';
import imgPos from '../../assets/landing/punto-de-venta.webp';

const Svg = {
  ArrowRight: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Check: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
};

/* El typewriter de rubros — mantiene el gesto pero sin gradient-text.
   La palabra va en tinta turquesa sobre un resaltado tipo marcador. */
function TypewriterRubro() {
  const words = ['kiosco', 'almacén', 'fiambrería', 'verdulería', 'despensa', 'maxikiosco', 'vinería'];
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState('');
  const [del, setDel] = useState(false);

  useEffect(() => {
    const full = words[i];
    let delay = del ? 55 : 110;
    if (!del && txt === full) delay = 1500;
    if (del && txt === '') delay = 250;
    const t = setTimeout(() => {
      if (!del && txt === full) { setDel(true); return; }
      if (del && txt === '') { setDel(false); setI((i + 1) % words.length); return; }
      setTxt(full.slice(0, del ? txt.length - 1 : txt.length + 1));
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txt, del, i]);

  return (
    <span className="hero-rubro">
      {txt}
      <span className="hero-caret" aria-hidden="true">&nbsp;</span>
    </span>
  );
}

export default function LandingHero({ isLoggedIn, goPanel, goOnboard }) {
  return (
    <section aria-label="Sistema de punto de venta para kioscos en Argentina" className="hero">
      <style>{`
        @keyframes lp-caret { 50% { opacity: 0 } }

        .hero {
          position: relative; z-index: 1;
          padding: 132px 24px 56px;
          max-width: 1080px; margin: 0 auto;
          text-align: center;
        }
        .hero-eyebrow-wrap { display: flex; justify-content: center; }

        .hero-h1 {
          font-family: var(--lp-font-display);
          font-weight: 700;
          font-size: clamp(2.7rem, 6vw, 4.7rem);
          line-height: 1.01;
          letter-spacing: -0.035em;
          color: var(--lp-ink);
          margin: 20px auto 0;
          max-width: 15ch;
        }
        .hero-h1 .l1 { display: block; }
        .hero-h1 .l2 { display: block; }

        .hero-rubro {
          color: var(--lp-primary-ink);
          font-style: italic;
          box-shadow: inset 0 -0.16em 0 var(--lp-primary-wash);
          padding: 0 0.04em;
          white-space: nowrap;
        }
        .hero-caret {
          border-right: 3px solid var(--lp-primary);
          margin-left: 1px;
          animation: lp-caret 0.9s step-end infinite;
        }

        .hero-sub {
          font-family: var(--lp-font-body);
          font-size: clamp(1.06rem, 1.5vw, 1.24rem);
          line-height: 1.5; color: var(--lp-ink-soft);
          margin: 20px auto 0; max-width: 600px;
        }
        .hero-sub strong { color: var(--lp-ink); font-weight: 700; }

        .hero-proof {
          display: inline-flex; align-items: center; gap: 9px;
          margin-top: 18px; font-size: 0.92rem; font-weight: 600;
          color: var(--lp-primary-ink);
        }
        .hero-proof .tick {
          display: inline-flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 999px;
          background: var(--lp-primary); color: #fff; flex-shrink: 0;
        }

        .hero-cta-row {
          display: flex; flex-wrap: wrap; gap: 13px; align-items: center; justify-content: center;
          margin-top: 30px;
        }
        .hero-btn-primary { padding: 15px 30px; font-size: 1.05rem; font-weight: 700; border: none; }
        .hero-btn-ghost { padding: 15px 26px; font-size: 1.01rem; font-weight: 700; }
        .hero-micro {
          margin-top: 15px; font-family: var(--lp-font-mono);
          font-size: 0.8rem; color: var(--lp-ink-faint); letter-spacing: 0.01em;
        }

        /* ── Captura real del producto, enmarcada ── */
        .hero-shot {
          margin: 52px auto 0; max-width: 940px; width: 100%;
          border: 1px solid var(--lp-line);
          border-radius: 16px; overflow: hidden;
          background: var(--lp-paper-raised);
          box-shadow: var(--lp-shadow-lg);
        }
        .hero-shot-chrome {
          display: flex; align-items: center; gap: 7px;
          padding: 11px 15px; border-bottom: 1px solid var(--lp-line);
          background: var(--lp-paper-sunken);
        }
        .hero-shot-dot { width: 11px; height: 11px; border-radius: 999px; }
        .hero-shot-url {
          margin-left: 10px; font-family: var(--lp-font-mono);
          font-size: 0.72rem; color: var(--lp-ink-faint);
          background: var(--lp-paper); border: 1px solid var(--lp-line);
          padding: 3px 12px; border-radius: 6px;
        }
        .hero-shot img { display: block; width: 100%; height: auto; }

        @media (max-width: 720px) {
          .hero { padding: 104px 20px 40px; }
          .hero-h1 { font-size: clamp(2.3rem, 11vw, 3.3rem); }
          .hero-rubro { white-space: normal; }
          .hero-shot { margin-top: 40px; }
        }
        @media (prefers-reduced-motion: reduce) { .hero-caret { animation: none; } }
      `}</style>

      <Reveal delay={1}>
        <div className="hero-eyebrow-wrap"><span className="lp-eyebrow">Sistema para tu mostrador</span></div>
        <h1 className="hero-h1">
          <span className="l1">Dejá el cuaderno.</span>
          <span className="l2">Tu <TypewriterRubro /> merece algo mejor.</span>
        </h1>
      </Reveal>

      <Reveal delay={2}>
        <p className="hero-sub">
          <strong>Vendé sin internet, controlá los fiados y sabé cuánta plata tenés en caja.</strong>{' '}
          Más fácil que WhatsApp. Sin cuentas mal hechas ni horas perdidas cerrando el día.
        </p>
        <div><span className="hero-proof">
          <span className="tick"><Svg.Check /></span>
          Más de 52 kioscos ya digitalizaron su negocio en Argentina
        </span></div>
      </Reveal>

      <Reveal delay={3}>
        <div className="hero-cta-row">
          <button onClick={isLoggedIn ? goPanel : goOnboard} className="lp-btn lp-btn--primary hero-btn-primary">
            {isLoggedIn ? 'Ir a mi Panel' : 'Empezar mi prueba gratis'} <Svg.ArrowRight />
          </button>
          <a href="#planes" className="lp-btn lp-btn--ghost hero-btn-ghost">Ver los planes</a>
        </div>
        <div className="hero-micro">
          {isLoggedIn ? 'Tu negocio te espera' : '7 días gratis · En 3 minutos ya estás vendiendo'}
        </div>
      </Reveal>

      <Reveal delay={4}>
        <div className="hero-shot">
          <div className="hero-shot-chrome">
            <span className="hero-shot-dot" style={{ background: '#ff5f57' }} />
            <span className="hero-shot-dot" style={{ background: '#febc2e' }} />
            <span className="hero-shot-dot" style={{ background: '#28c840' }} />
            <span className="hero-shot-url">mi-negocio.app/panel</span>
          </div>
          <img src={imgPos} alt="Punto de venta de MiNegocio con productos en el carrito y total a cobrar" width="1366" height="768" fetchPriority="high" decoding="async" />
        </div>
      </Reveal>
    </section>
  );
}

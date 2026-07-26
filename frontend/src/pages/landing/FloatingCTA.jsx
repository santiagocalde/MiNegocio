import { useState, useEffect } from 'react';

/**
 * CTA flotante fijo abajo — SOLO mobile.
 * Aparece cuando el usuario scrollea un poco (ya vio el hero).
 * Si está logueado va al panel, si no va al onboarding.
 */
export default function FloatingCTA({ isLoggedIn, goPanel, goOnboard }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setVisible(window.scrollY > 300);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => {
    if (isLoggedIn) { goPanel(); } else { goOnboard(); }
  };

  return (
    <div
      className={`lp-floating-cta${visible ? ' is-visible' : ''}`}
      aria-hidden={!visible}
    >
      <button
        type="button"
        className="lp-floating-cta-btn"
        onClick={handleClick}
      >
        {isLoggedIn ? 'Ir al panel' : 'Empezar gratis'}
      </button>
    </div>
  );
}

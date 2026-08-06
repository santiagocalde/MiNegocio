import { Reveal } from './hooks/useReveal';

/**
 * Barra de confianza inmediata — mobile y desktop.
 * Frases cortas que eliminan la duda más común del kiosquero.
 */
export default function LandingTrustBar() {
  const items = [
    { icon: '⚡', text: 'En 3 minutos ya estás vendiendo' },
    { icon: '📶', text: 'Funciona sin internet' },
    { icon: '🇦🇷', text: 'Soporte argentino en minutos' },
    { icon: '🔓', text: 'Cancelás cuando querés' },
  ];

  return (
    <section className="lp-section" style={{ padding: '16px 16px' }} aria-label="Garantías">
      <Reveal>
        <div style={{
          maxWidth: 900, margin: '0 auto', display: 'flex',
          flexWrap: 'wrap', gap: '10px 28px', justifyContent: 'center', alignItems: 'center',
          background: 'var(--lp-primary-wash)', border: '1px solid var(--lp-line)',
          borderRadius: 16, padding: '15px 26px'
        }}>
          {items.map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', color: 'var(--lp-ink-soft)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              {item.text}
              {i < items.length - 1 && <span style={{ color: 'var(--lp-line-strong)', marginLeft: 12 }}>·</span>}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

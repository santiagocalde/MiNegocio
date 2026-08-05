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
          maxWidth: 860, margin: '0 auto', display: 'flex',
          flexWrap: 'wrap', gap: '10px 28px', justifyContent: 'center', alignItems: 'center',
          background: 'rgba(20,187,166,0.06)', border: '1px solid rgba(20,187,166,0.14)',
          borderRadius: 14, padding: '14px 24px'
        }}>
          {items.map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.84rem', color: 'rgba(230,255,251,0.8)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              {item.text}
              {i < items.length - 1 && <span style={{ color: 'rgba(230,255,251,0.2)', marginLeft: 12 }}>·</span>}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

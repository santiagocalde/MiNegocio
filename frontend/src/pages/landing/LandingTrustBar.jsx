import { Reveal } from './hooks/useReveal';

/**
 * Barra de confianza inmediata — mobile y desktop.
 * Números reales que el kiosquero entiende en 2 segundos.
 */
export default function LandingTrustBar() {
  return (
    <section className="lp-section" style={{ padding: '12px 16px' }} aria-label="Confianza">
      <Reveal>
        <div className="lp-trust-bar" style={{
          maxWidth: 520, margin: '0 auto', display: 'flex',
          flexWrap: 'wrap', gap: '8px 20px', justifyContent: 'center',
          alignItems: 'center', fontSize: '0.82rem', color: 'rgba(230,255,251,0.72)',
          background: 'rgba(20,187,166,0.06)', border: '1px solid rgba(20,187,166,0.12)',
          borderRadius: 12, padding: '12px 18px'
        }}>
          <span>+100 kioscos lo usan</span>
          <span style={{ color: 'rgba(230,255,251,0.3)' }}>|</span>
          <span>La tía de Santi lo usa hace 3 meses</span>
          <span style={{ color: 'rgba(230,255,251,0.3)' }}>|</span>
          <span>Funciona sin internet</span>
        </div>
      </Reveal>
    </section>
  );
}

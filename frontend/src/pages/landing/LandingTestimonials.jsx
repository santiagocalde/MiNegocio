import { useState, useEffect } from 'react';
import { Reveal } from './hooks/useReveal';
import testimonialsFallback from './data/testimonials';

const Svg = { Star: () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> };

export default function LandingTestimonials() {
  const [testimonials, setTestimonials] = useState(testimonialsFallback);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8005';
    fetch(`${baseUrl}/api/testimonials`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTestimonials(data);
        }
      })
      .catch(() => {});
  }, []);
  return (
    <section className="lp-section" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 className="lp-section-title" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Lo que dicen los que ya usan MiNegocio</h2>
            <p className="lp-section-sub" style={{ maxWidth: 500, margin: '0 auto', fontSize: '1.1rem', color: 'rgba(230,255,251, 0.65)' }}>Dueños de kioscos de verdad, no casos de estudio.</p>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i + 1} style={{ height: '100%' }}>
              <div className="lp-glass" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(20,187,166,0.2)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(20,187,166,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>{Array.from({ length: t.stars }).map((_, j) => <Svg.Star key={j} />)}</div>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 16, fontStyle: 'italic', flex: 1 }}>"{t.text}"</p>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.name}</div>
                <div style={{ color: 'var(--lp-text-muted)', fontSize: '0.75rem' }}>{t.business}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

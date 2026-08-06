import { useState, useEffect } from 'react';
import { API_ROOT } from '../../config';
import { Reveal } from './hooks/useReveal';
import testimonialsFallback from './data/testimonials';
import useIsMobile from '../../hooks/useIsMobile';

const Svg = { Star: () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> };

export default function LandingTestimonials() {
  const [testimonials, setTestimonials] = useState(testimonialsFallback);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch(`${API_ROOT}/api/testimonials`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTestimonials(data);
        }
      })
      .catch(() => {});
  }, []);

  // En mobile: menos testimonios (3) y más cortos, para que sea cercano y no largo.
  const visible = isMobile ? testimonials.slice(0, 3) : testimonials;
  return (
    <section className="lp-section" style={{ padding: isMobile ? '48px 16px' : '64px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 32 }}>
            <h2 className="lp-section-title">Lo que dicen los que ya lo usan</h2>
            <p className="lp-section-sub" style={{ maxWidth: 500 }}>Kiosqueros de verdad, como vos.</p>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: isMobile ? 12 : 16 }}>
          {visible.map((t, i) => (
            <Reveal key={t.id} delay={i + 1} style={{ height: '100%' }}>
              <div className="lp-glass" style={{ padding: isMobile ? 16 : 24, height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(20,187,166,0.2)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(20,187,166,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--lp-line)'; e.currentTarget.style.boxShadow = 'var(--lp-shadow-sm)'; }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 10, color: '#F5C518' }}>{Array.from({ length: t.stars }).map((_, j) => <Svg.Star key={j} />)}</div>
                <p style={{ fontSize: isMobile ? '0.88rem' : '0.92rem', lineHeight: 1.55, marginBottom: 14, fontStyle: 'italic', color: 'var(--lp-ink-soft)', flex: 1,
                  ...(isMobile ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div aria-hidden="true" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: 'var(--lp-gradient-main)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                    {(t.name || '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.name}</div>
                    <div style={{ color: 'var(--lp-text-muted)', fontSize: '0.75rem' }}>{t.business_name || t.business}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

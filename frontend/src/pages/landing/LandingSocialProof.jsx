import { useState, useEffect } from 'react';
import { Reveal } from './hooks/useReveal';
import useCountUp from './hooks/useCountUp';

function AnimatedStat({ value, label, suffix = '', prefix = '', isLast }) {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
  const { count, ref } = useCountUp(numValue, 1500);

  const formatDisplay = () => {
    if (prefix === '$') return `${prefix}${count.toLocaleString('es-AR')}`;
    if (suffix === '%' || suffix.includes('★')) return `${count}${suffix}`;
    return `${count.toLocaleString('es-AR')}${suffix}`;
  };

  const display = formatDisplay();

  return (
    <div ref={ref} style={{
      textAlign: 'center', flex: 1, padding: '0 16px',
      borderRight: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
    }}>
      <div className="lp-gradient-text" style={{
        fontFamily: 'var(--lp-font-display)',
        fontSize: 'clamp(2rem, 3.5vw, 3rem)',
        letterSpacing: '-2px',
        fontWeight: 800,
        lineHeight: 1,
      }}>{display}</div>
      <div style={{ color: 'var(--lp-text-muted)', fontSize: '0.8rem', fontWeight: 500, marginTop: 6, letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}

const DEFAULT_STATS = [
  { value: 20, label: 'Kioscos activos', suffix: '+' },
  { value: 380, label: 'Ventas procesadas', prefix: '', suffix: 'K+' },
  { value: 98.7, label: 'Disponibilidad', suffix: '%' },
  { value: 4.9, label: 'Puntuacion', suffix: ' ★' },
];

export default function LandingSocialProof() {
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8005';
    fetch(`${baseUrl}/api/metrics`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setStats([
          { value: data.kioscos_activos || 20, label: 'Kioscos activos', suffix: '+' },
          { value: data.ventas_procesadas ? Math.round(data.ventas_procesadas / 1000) : 380, label: 'Ventas procesadas', prefix: '', suffix: 'K+' },
          { value: data.disponibilidad || 98.7, label: 'Disponibilidad', suffix: '%' },
          { value: data.puntuacion || 4.9, label: 'Puntuacion', suffix: ' ★' },
        ]);
      })
      .catch(() => {});
  }, []);
  return (
    <section className="lp-section" style={{ padding: '80px 24px' }}>
      <div className="lp-container">
        <Reveal>
          <p style={{ textAlign: 'center', color: 'var(--lp-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 24, fontWeight: 600 }}>Confían en MiNegocio</p>
        </Reveal>
        <Reveal delay={1}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, flexWrap: 'wrap', maxWidth: 700, margin: '32px auto 0' }}>
            {stats.map((s, i) => (
              <AnimatedStat key={i} value={s.value} label={s.label} suffix={s.suffix || ''} prefix={s.prefix || ''} isLast={i === stats.length - 1} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

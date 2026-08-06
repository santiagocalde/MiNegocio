import { useState, useEffect } from 'react';
import { API_ROOT } from '../../config';
import { Reveal } from './hooks/useReveal';
import useCountUp from './hooks/useCountUp';

function AnimatedStat({ value, label, suffix = '', isLast }) {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
  const { count, ref } = useCountUp(numValue, 1500);

  const display = suffix ? `${count.toLocaleString('es-AR')}${suffix}` : count.toLocaleString('es-AR');

  return (
    <div ref={ref} style={{
      textAlign: 'center', flex: 1, padding: '0 24px',
      borderRight: isLast ? 'none' : '1px solid var(--lp-line)',
    }}>
      <div className="lp-money" style={{
        fontSize: 'clamp(1.9rem, 3.2vw, 2.7rem)',
        letterSpacing: '-0.02em',
        fontWeight: 700,
        lineHeight: 1,
        color: 'var(--lp-ink)',
      }}>{display}</div>
      <div style={{ color: 'var(--lp-ink-faint)', fontSize: '0.78rem', fontWeight: 600, marginTop: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--lp-font-mono)' }}>{label}</div>
    </div>
  );
}

const DEFAULT_STATS = [
  { value: 52, label: 'Negocios activos' },
  { value: 56476, label: 'Ventas procesadas' },
  { value: 24, label: 'Soporte', suffix: '/7' },
];

export default function LandingSocialProof() {
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    fetch(`${API_ROOT}/api/metrics`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setStats([
          { value: data.kioscos_activos || 52, label: 'Negocios activos' },
          { value: data.ventas_procesadas || 56476, label: 'Ventas procesadas' },
          { value: 24, label: 'Soporte', suffix: '/7' },
        ]);
      })
      .catch(() => {});
  }, []);
  return (
    <section className="lp-section" style={{ padding: '32px 0' }}>
      <hr style={{ border: 'none', borderTop: '1px solid var(--lp-line)', margin: '0 0 28px' }} />
      <div className="lp-container" style={{ padding: '0 24px' }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, flexWrap: 'wrap', maxWidth: 700, margin: '0 auto' }}>
            {stats.map((s, i) => (
              <AnimatedStat key={i} value={s.value} label={s.label} suffix={s.suffix || ''} isLast={i === stats.length - 1} />
            ))}
          </div>
        </Reveal>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--lp-line)', margin: '28px 0 0' }} />
    </section>
  );
}

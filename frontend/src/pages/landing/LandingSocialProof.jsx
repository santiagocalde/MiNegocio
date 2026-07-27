import { useState, useEffect } from 'react';
import { API_ROOT } from '../../config';
import { Reveal } from './hooks/useReveal';
import useCountUp from './hooks/useCountUp';

function AnimatedStat({ value, label, suffix = '', prefix = '', isLast, isMoney }) {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
  const { count, ref } = useCountUp(numValue, 1500);

  const formatDisplay = () => {
    if (isMoney) return `$ ${count.toLocaleString('es-AR')}`;
    if (suffix) return `${count.toLocaleString('es-AR')}${suffix}`;
    return count.toLocaleString('es-AR');
  };

  return (
    <div ref={ref} style={{
      textAlign: 'center', flex: 1, padding: '0 16px',
      borderRight: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
    }}>
      <div className="lp-gradient-text" style={{
        fontFamily: 'var(--lp-font-display)',
        fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)',
        letterSpacing: '-1px',
        fontWeight: 800,
        lineHeight: 1,
      }}>{formatDisplay()}</div>
      <div style={{ color: 'var(--lp-text-muted)', fontSize: '0.82rem', fontWeight: 500, marginTop: 6, letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}

const DEFAULT_STATS = [
  { value: 16, label: 'Negocios activos' },
  { value: 19546, label: 'Facturado este mes', isMoney: true },
  { value: 24, label: 'Soporte', suffix: '/7' },
];

export default function LandingSocialProof() {
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    fetch(`${API_ROOT}/api/metrics`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setStats([
          { value: data.kioscos_activos || 16, label: 'Negocios activos' },
          { value: data.ventas_mes || 19546, label: 'Facturado este mes', isMoney: true },
          { value: 24, label: 'Soporte', suffix: '/7' },
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
              <AnimatedStat key={i} value={s.value} label={s.label} suffix={s.suffix || ''} isMoney={s.isMoney || false} isLast={i === stats.length - 1} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

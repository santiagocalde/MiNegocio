import { useState, useEffect } from 'react';
import { Reveal } from './hooks/useReveal';

const Svg = {
  Check: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  XIcon: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>,
  Zap: () => <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
};

const rows = [
  { feature: '¿Vender en segundos?', cuaderno: { i: 'X', t: 'Anotar y sumar' }, otros: { i: '-', t: 'Menú complejo' }, minegocio: { i: 'C', t: 'Pistoleá y listo' } },
  { feature: '¿Fácil de aprender?', cuaderno: { i: 'C', t: 'Ya lo sabés' }, otros: { i: 'X', t: 'Requiere curso' }, minegocio: { i: 'C', t: 'En 5 minutos' } },
  { feature: '¿Controlar caja y stock?', cuaderno: { i: 'X', t: 'Siempre falta' }, otros: { i: '-', t: 'Reportes difusos' }, minegocio: { i: 'C', t: 'Cierre perfecto' } },
  { feature: '¿Cuentas corrientes (Fiados)?', cuaderno: { i: 'X', t: 'Hojas sueltas' }, otros: { i: 'X', t: 'No diseñado' }, minegocio: { i: 'C', t: 'Todo claro' } },
  { feature: '¿Soporte para ayudarte?', cuaderno: { i: 'X', t: 'Estás solo' }, otros: { i: 'X', t: 'Mails lentos' }, minegocio: { i: 'C', t: 'WhatsApp humano' } },
];

const minegocioRows = ['Pistoleá y listo', 'En 5 minutos', 'Cierre perfecto', 'Todo claro', 'WhatsApp humano'];

function RowIcon({ i }) {
  if (i === 'X') return <Svg.XIcon />;
  if (i === 'C') return <Svg.Check />;
  return <span style={{ fontWeight: 800 }}>-</span>;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return isMobile;
}

const iconColors = (i) => ({
  bg: i === 'X' ? 'rgba(220,38,38,0.10)' : i === 'C' ? 'rgba(15,157,107,0.12)' : 'var(--lp-paper-sunken)',
  border: i === 'X' ? '1px solid rgba(220,38,38,0.22)' : i === 'C' ? '1px solid rgba(15,157,107,0.24)' : '1px solid var(--lp-line)',
  color: i === 'X' ? 'var(--lp-red)' : i === 'C' ? 'var(--lp-green)' : 'var(--lp-ink-faint)',
});

// ── Mobile: tarjetas apiladas ──
function ComparativaMobile() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto' }}>
      {rows.map((row, i) => {
        const opciones = [
          { label: 'El Cuaderno', ...row.cuaderno },
          { label: 'Otros POS', ...row.otros },
        ];
        return (
          <div key={i} style={{ background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--lp-shadow-sm)' }}>
            <div style={{ padding: '12px 15px', fontWeight: 700, fontSize: '0.95rem', color: 'var(--lp-ink)', borderBottom: '1px solid var(--lp-line)', background: 'var(--lp-paper-sunken)' }}>
              {row.feature}
            </div>
            {opciones.map((op, j) => {
              const c = iconColors(op.i);
              return (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 15px', borderBottom: '1px solid var(--lp-line)' }}>
                  <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: c.bg, border: c.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>
                    <RowIcon i={op.i} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--lp-ink-faint)', fontWeight: 600, width: 86, flexShrink: 0 }}>{op.label}</span>
                  <span style={{ fontSize: '0.84rem', color: 'var(--lp-ink-soft)' }}>{op.t}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', background: 'var(--lp-primary-wash)' }}>
              <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Svg.Check />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--lp-primary-ink)', fontWeight: 800, width: 86, flexShrink: 0 }}>MiNegocio</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--lp-ink)', fontWeight: 700 }}>{row.minegocio.t}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Desktop: tabla compacta con columna MiNegocio destacada ──
function ComparativaDesktop() {
  const GRID = '1.6fr 1fr 1fr 1.2fr';
  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto', paddingBottom: 26, paddingTop: 14 }}>
      <div style={{ position: 'relative', minWidth: 720, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)', borderRadius: 20, position: 'relative', overflow: 'hidden', zIndex: 1, boxShadow: 'var(--lp-shadow-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, borderBottom: '1px solid var(--lp-line)', position: 'relative', zIndex: 1 }}>
            <div style={{ padding: '20px 22px 14px', display: 'flex', alignItems: 'flex-end', fontWeight: 700, fontSize: '0.78rem', color: 'var(--lp-ink-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--lp-font-mono)' }}>Comparativa</div>
            <div style={{ textAlign: 'center', padding: '20px 14px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'var(--lp-ink-soft)' }}>El Cuaderno</div>
            <div style={{ textAlign: 'center', padding: '20px 14px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'var(--lp-ink-soft)' }}>Otros POS</div>
            <div style={{ padding: '20px 14px 14px' }} />
          </div>
          {rows.map((row, i, arr) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--lp-line)', transition: 'background 0.25s', position: 'relative', zIndex: 1 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600, fontSize: '0.98rem', padding: '15px 22px', display: 'flex', alignItems: 'center', color: 'var(--lp-ink)' }}>{row.feature}</div>
              <div style={{ textAlign: 'center', padding: '15px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: row.cuaderno.i === 'X' ? 'rgba(220,38,38,0.10)' : 'rgba(15,157,107,0.12)', border: row.cuaderno.i === 'X' ? '1px solid rgba(220,38,38,0.22)' : '1px solid rgba(15,157,107,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: row.cuaderno.i === 'X' ? 'var(--lp-red)' : 'var(--lp-green)' }}>
                  <RowIcon i={row.cuaderno.i} />
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', fontWeight: 500 }}>{row.cuaderno.t}</span>
              </div>
              <div style={{ textAlign: 'center', padding: '15px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: row.otros.i === 'X' ? 'rgba(220,38,38,0.10)' : row.otros.i === 'C' ? 'rgba(15,157,107,0.12)' : 'var(--lp-paper-sunken)', border: row.otros.i === 'X' ? '1px solid rgba(220,38,38,0.22)' : row.otros.i === 'C' ? '1px solid rgba(15,157,107,0.24)' : '1px solid var(--lp-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: row.otros.i === 'X' ? 'var(--lp-red)' : row.otros.i === 'C' ? 'var(--lp-green)' : 'var(--lp-ink-faint)' }}>
                  <RowIcon i={row.otros.i} />
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', fontWeight: 500 }}>{row.otros.t}</span>
              </div>
              <div style={{ padding: '15px 14px' }} />
            </div>
          ))}
        </div>
        {/* Columna MiNegocio — destacada, funciona en claro y oscuro */}
        <div style={{ position: 'absolute', top: -12, right: 0, bottom: -12, width: '25.53%', background: 'var(--lp-paper-raised)', border: '2px solid var(--lp-primary)', borderRadius: 20, boxShadow: '0 18px 44px var(--lp-primary-glow)', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: '0 0 auto', padding: '18px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderBottom: '1px solid var(--lp-line)', background: 'var(--lp-primary-wash)' }}>
            <span style={{ fontSize: '0.64rem', background: 'var(--lp-primary)', color: '#fff', padding: '3px 11px', borderRadius: 100, letterSpacing: '0.12em', fontWeight: 800, fontFamily: 'var(--lp-font-mono)' }}>TU SOLUCIÓN</span>
            <span style={{ fontSize: '1.35rem', fontFamily: 'var(--lp-font-display)', fontWeight: 700, color: 'var(--lp-ink)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              MiNegocio <span style={{ color: 'var(--lp-primary-ink)' }}><Svg.Zap /></span>
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 8, paddingBottom: 8 }}>
            {minegocioRows.map((t, i, arr) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--lp-line)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Svg.Check />
                </div>
                <span style={{ fontSize: '0.9rem', color: 'var(--lp-ink)', fontWeight: 700 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingComparativa() {
  const isMobile = useIsMobile();
  return (
    <section className="lp-section" style={{ padding: '64px 24px' }}>
      <div className="lp-container">
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 className="lp-section-title">Vendé <span style={{ color: 'var(--lp-primary-ink)' }}>más rápido</span> que nunca</h2>
            <p className="lp-section-sub">Optimizamos cada paso para que tu atención al cliente sea impecable y ágil.</p>
          </div>
        </Reveal>
        <Reveal delay={1}>
          {isMobile ? <ComparativaMobile /> : <ComparativaDesktop />}
        </Reveal>
      </div>
    </section>
  );
}

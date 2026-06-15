import { Reveal } from './hooks/useReveal';

const Svg = {
  Check: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  XIcon: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>,
  Zap: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
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

export default function LandingComparativa() {
  return (
    <section className="lp-section" style={{ padding: '100px 24px' }}>
      <div className="lp-container">
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 className="lp-section-title" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Vendé <span style={{ color: 'var(--lp-primary)', fontWeight: 900 }}>más rápido</span> que nunca</h2>
            <p className="lp-section-sub" style={{ fontSize: '1.1rem', color: 'rgba(230,255,251, 0.65)' }}>Optimizamos cada paso para que tu atención al cliente sea impecable y ágil.</p>
          </div>
        </Reveal>
        <Reveal delay={1}>
          <div style={{ position: 'relative', width: '100%', overflowX: 'auto', paddingBottom: 40, paddingTop: 20 }}>
            <div style={{ position: 'relative', minWidth: 800, maxWidth: 1000, margin: '0 auto' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '80%', background: 'radial-gradient(ellipse at center, rgba(20,187,166,0.15) 0%, transparent 60%)', pointerEvents: 'none', filter: 'blur(60px)', zIndex: 0 }} />
              <div 
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                }}
                onMouseEnter={(e) => {
                  const glow = e.currentTarget.querySelector('.table-glow');
                  if (glow) glow.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  const glow = e.currentTarget.querySelector('.table-glow');
                  if (glow) glow.style.opacity = '0';
                }}
                style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, position: 'relative', overflow: 'hidden', zIndex: 1, '--mouse-x': '-1000px', '--mouse-y': '-1000px' }}>
                <div className="table-glow" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', background: 'radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(20,187,166,0.08), transparent 40%)', opacity: 0, transition: 'opacity 0.5s ease', zIndex: 0 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative', zIndex: 1 }}>
                  <div style={{ padding: '32px 32px 24px', display: 'flex', alignItems: 'flex-end', fontWeight: 800, fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '2px' }}>Comparativa</div>
                  <div style={{ textAlign: 'center', padding: '32px 16px 24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>El Cuaderno</div>
                  <div style={{ textAlign: 'center', padding: '32px 16px 24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>Otros POS</div>
                  <div style={{ padding: '32px 16px 24px' }} />
                </div>
                {rows.map((row, i, arr) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr', borderBottom: i === arr.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)', transition: 'background 0.3s', position: 'relative', zIndex: 1 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', padding: '24px 32px', display: 'flex', alignItems: 'center', color: '#fff' }}>{row.feature}</div>
                    <div style={{ textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: row.cuaderno.i === 'X' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: row.cuaderno.i === 'X' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: row.cuaderno.i === 'X' ? '#ef4444' : '#10b981' }}>
                        <RowIcon i={row.cuaderno.i} />
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{row.cuaderno.t}</span>
                    </div>
                    <div style={{ textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: row.otros.i === 'X' ? 'rgba(239,68,68,0.1)' : row.otros.i === 'C' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: row.otros.i === 'X' ? '1px solid rgba(239,68,68,0.2)' : row.otros.i === 'C' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: row.otros.i === 'X' ? '#ef4444' : row.otros.i === 'C' ? '#10b981' : 'rgba(255,255,255,0.5)' }}>
                        <RowIcon i={row.otros.i} />
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{row.otros.t}</span>
                    </div>
                    <div style={{ padding: '24px 16px' }} />
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', top: -16, right: 0, bottom: -16, width: '25.53%', background: 'linear-gradient(145deg, #12223b, #0B132B)', border: '1px solid rgba(20,187,166, 0.4)', borderRadius: 24, boxShadow: '0 20px 50px rgba(11,19,43,0.8), 0 0 30px rgba(20,187,166,0.15)', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', transform: 'skewX(-20deg)', animation: 'lp-shimmer 4s infinite' }} />
                <div style={{ flex: '0 0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderBottom: '1px solid rgba(20,187,166,0.15)', background: 'rgba(20,187,166,0.03)' }}>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(20,187,166,0.15)', color: '#00E5FF', padding: '4px 12px', borderRadius: 100, letterSpacing: '1.5px', fontWeight: 800 }}>TU SOLUCIÓN</span>
                  <span style={{ fontSize: '1.5rem', fontFamily: 'var(--lp-font-display)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    MiNegocio <span style={{ color: '#00E5FF' }}><Svg.Zap /></span>
                  </span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 12, paddingBottom: 12 }}>
                  {minegocioRows.map((t, i, arr) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, borderBottom: i === arr.length - 1 ? 'none' : '1px solid rgba(20,187,166,0.05)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(20,187,166,0.15)', border: '1px solid rgba(20,187,166,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00E5FF', boxShadow: '0 0 15px rgba(20,187,166,0.2)' }}>
                        <Svg.Check />
                      </div>
                      <span style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 700 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

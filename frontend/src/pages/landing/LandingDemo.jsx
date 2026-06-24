import { useState, useEffect, useRef } from 'react';
import { Reveal } from './hooks/useReveal';

// Demo animada del flujo de venta — 100% en código (sin video).
// Una sola máquina de estados con un timer; se limpia al desmontar y
// respeta prefers-reduced-motion (muestra el estado final, sin animar).

const ITEMS = [
  { name: 'Coca-Cola 2.25L', price: 2500, emoji: '🥤' },
  { name: 'Pan lactal', price: 1800, emoji: '🍞' },
  { name: 'Yerba 1kg', price: 3200, emoji: '🧉' },
];
const TOTAL = ITEMS.reduce((s, i) => s + i.price, 0);

// Secuencia: 0 vacío · 1-3 productos · 4 cobrando · 5 listo → vuelve a 0
const STEPS = 6;
const STEP_MS = 1400;

function peso(n) { return '$' + n.toLocaleString('es-AR'); }

export default function LandingDemo() {
  const [step, setStep] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced.current) { setStep(5); return; }
    const id = setInterval(() => setStep(s => (s + 1) % STEPS), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const visibleCount = Math.min(step, 3);
  const visibleItems = ITEMS.slice(0, visibleCount);
  const runningTotal = visibleItems.reduce((s, i) => s + i.price, 0);
  const charging = step === 4;
  const done = step === 5;

  return (
    <section className="lp-section" style={{ padding: '100px 24px' }}>
      <div className="lp-container" style={{ maxWidth: 820, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 className="lp-section-title" style={{ fontSize: '2.5rem', marginBottom: 12 }}>
              Así de <span style={{ color: 'var(--lp-primary)', fontWeight: 900 }}>simple</span> es vender
            </h2>
            <p className="lp-section-sub" style={{ fontSize: '1.1rem', color: 'rgba(230,255,251, 0.65)' }}>
              Pistoleás el producto, cobrás y listo. En segundos.
            </p>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <style>{`
            @keyframes demo-row-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes demo-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(2400%); } }
            @keyframes demo-pop { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
            @keyframes demo-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(20,187,166,0.5); } 50% { box-shadow: 0 0 0 10px rgba(20,187,166,0); } }
            .demo-row { animation: demo-row-in 0.35s cubic-bezier(0.16,1,0.3,1) both; }
            .demo-pulse { animation: demo-pulse 1s ease-out infinite; }
          `}</style>

          <div style={{
            position: 'relative', background: 'rgba(30,58,95,0.5)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24, padding: 0, overflow: 'hidden', backdropFilter: 'blur(12px)',
            boxShadow: '0 24px 60px rgba(11,19,43,0.6)', maxWidth: 480, margin: '0 auto'
          }}>
            {/* barra superior estilo caja */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--lp-primary)', boxShadow: '0 0 8px var(--lp-primary)' }} />
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff', letterSpacing: 0.5 }}>Caja — MiNegocio</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'rgba(230,255,251,0.4)', fontFamily: 'var(--lp-font-mono)' }}>● EN VIVO</span>
            </div>

            {/* zona del scanner */}
            <div style={{ position: 'relative', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', background: 'rgba(0,0,0,0.15)' }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(230,255,251,0.45)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {done ? '✓ Próxima venta lista' : charging ? 'Cobrando…' : 'Pistoleá un producto…'}
              </span>
              {!done && !charging && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--lp-primary), transparent)', animation: 'demo-scan 1.4s linear infinite', opacity: 0.7 }} />
              )}
            </div>

            {/* lista de items */}
            <div style={{ minHeight: 168, padding: '8px 0' }}>
              {visibleItems.length === 0 && (
                <div style={{ padding: '52px 20px', textAlign: 'center', color: 'rgba(230,255,251,0.3)', fontSize: '0.9rem' }}>
                  Carrito vacío
                </div>
              )}
              {visibleItems.map((it, idx) => (
                <div key={it.name} className="demo-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
                  <span style={{ fontSize: '1.3rem', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>{it.emoji}</span>
                  <span style={{ flex: 1, fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>{it.name}</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'rgba(230,255,251,0.85)', fontSize: '0.95rem' }}>{peso(it.price)}</span>
                </div>
              ))}
            </div>

            {/* total + cobrar */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(230,255,251,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Total</span>
                <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 800, fontSize: '1.8rem', color: '#fff', letterSpacing: '-1px' }}>
                  {peso(done ? TOTAL : runningTotal)}
                </span>
              </div>
              <button
                className={charging ? 'demo-pulse' : ''}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'default',
                  fontWeight: 800, fontSize: '1rem', color: '#fff',
                  background: done ? '#10b981' : 'linear-gradient(90deg, var(--lp-primary), var(--lp-secondary))',
                  transition: 'background 0.3s ease'
                }}>
                {done ? '✓ Venta completada' : charging ? 'Procesando pago…' : `Cobrar ${peso(runningTotal || TOTAL)}`}
              </button>
            </div>

            {/* overlay de éxito */}
            {done && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(11,19,43,0.82)', backdropFilter: 'blur(2px)' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: reduced.current ? 'none' : 'demo-pop 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
                  <svg width="36" height="36" fill="none" stroke="#10b981" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#fff' }}>¡Venta registrada!</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(230,255,251,0.6)' }}>Stock y caja actualizados solos</div>
              </div>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: '0.9rem', color: 'rgba(230,255,251,0.5)' }}>
            Funciona igual aunque se te corte internet. Lo que vendiste no se pierde.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

import { Reveal } from './hooks/useReveal';

const Svg = {
  WifiOff: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M8.464 15.536a5 5 0 010-7.072" /></svg>,
  Check: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  Refresh: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

export default function LandingOffline() {
  return (
    <section className="lp-section" style={{ padding: '100px 24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', height: '100%', background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.06) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <span className="lp-badge" style={{ marginBottom: 16, background: 'rgba(16,185,129,0.1)', color: 'var(--lp-green)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Svg.WifiOff width={14} style={{ marginRight: 6 }} /> FUNCIONA SIN INTERNET
            </span>
            <h2 className="lp-section-title" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: 16 }}>Sin internet ≠ Sin ventas</h2>
            <p className="lp-section-sub" style={{ fontSize: '1.1rem', color: 'rgba(230,255,251, 0.65)', maxWidth: 600, margin: '0 auto' }}>
              Con otros sistemas cerrás el local. Con MiNegocio la caja sigue funcionando y sincroniza cuando vuelve la conexión.
            </p>
          </div>
        </Reveal>
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 40, alignItems: 'start', marginTop: 40 }}>
          <div style={{ position: 'absolute', top: 35, left: '-5%', right: '-5%', height: 2, background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.5) 20%, rgba(16,185,129,0.5) 80%, transparent)', zIndex: 0 }} className="hidden md:block" />
          <Reveal delay={1} style={{ zIndex: 1 }}>
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#1E3A5F', border: '2px solid rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-red)', margin: '0 auto 24px', boxShadow: '0 0 30px rgba(239,68,68,0.2)', position: 'relative' }}>
                <Svg.WifiOff width={28} />
                <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1px dashed rgba(239,68,68,0.4)', animation: 'spin 10s linear infinite' }} />
              </div>
              <div style={{ display: 'inline-block', background: 'rgba(239,68,68,0.1)', color: 'var(--lp-red)', padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 800, letterSpacing: 1, marginBottom: 12 }}>ALERTA DE RED</div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 10, color: '#fff' }}>Se corta internet</div>
              <div style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>Microcorte o falta de datos. El sistema detecta la caída en milisegundos.</div>
            </div>
          </Reveal>
          <Reveal delay={2} style={{ zIndex: 1 }}>
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#1E3A5F', border: '2px solid rgba(16,185,129,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-green)', margin: '0 auto 24px', boxShadow: '0 0 30px rgba(16,185,129,0.2)', position: 'relative' }}>
                <Svg.Check width={28} />
                <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1px solid rgba(16,185,129,0.5)', animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
              </div>
              <div style={{ display: 'inline-block', background: 'rgba(16,185,129,0.1)', color: 'var(--lp-green)', padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 800, letterSpacing: 1, marginBottom: 12 }}>MODO LOCAL ACTIVO</div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 10, color: '#fff' }}>Seguís vendiendo</div>
              <div style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>Tu caja no se bloquea. Las transacciones se guardan cifradas en tu PC.</div>
            </div>
          </Reveal>
          <Reveal delay={3} style={{ zIndex: 1 }}>
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#1E3A5F', border: '2px solid rgba(245,158,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-amber)', margin: '0 auto 24px', boxShadow: '0 0 30px rgba(245,158,11,0.2)', position: 'relative' }}>
                <Svg.Refresh width={28} />
                <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1px dashed rgba(245,158,11,0.4)', animation: 'spin 4s linear infinite reverse' }} />
              </div>
              <div style={{ display: 'inline-block', background: 'rgba(245,158,11,0.1)', color: 'var(--lp-amber)', padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 800, letterSpacing: 1, marginBottom: 12 }}>AUTO-SYNC INVISIBLE</div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 10, color: '#fff' }}>Vuelve la conexión</div>
              <div style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>Las ventas se sincronizan a la nube automáticamente. Sin tocar nada.</div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

import { Reveal } from './hooks/useReveal';

const chatMessages = [
  { from: 'user', text: '¡Hola! El proveedor me aumentó un 15% todo lo de limpieza. ¿Tengo que cambiar producto por producto? 😩' },
  { from: 'agent', text: '¡Hola Silvia! Para nada. Andá a Inventario > Modificar Precios, filtrá por categoría "Limpieza" y poné +15%.' },
  { from: 'user', text: 'Me salvaste la vida. Pensé que me quedaba hasta las 12 de la noche cargando precios jajaja' },
  { from: 'agent', text: 'Olvidate, con el sistema actualizas todo en un clic. ¡Buenas ventas! 🚀' },
];

export default function LandingSoporteHumano() {
  return (
    <section className="lp-section" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--lp-primary)', marginBottom: 12 }}>Soporte real</p>
            <h2 style={{ fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.1, color: '#fff', marginBottom: 16 }}>
              Cuando algo falla,{' '}
              <span className="lp-gradient-text" style={{ fontStyle: 'italic' }}>respondemos nosotros.</span>
            </h2>
            <p style={{ color: 'rgba(230,255,251,0.55)', fontSize: '1rem', maxWidth: 500, margin: '0 auto' }}>
              Sin chatbots. Sin formularios. Una persona real, en minutos.
            </p>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20, alignItems: 'center', margin: '40px 0' }}>
          <Reveal delay={1}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 50, alignItems: 'flex-end', paddingRight: 30 }}>
              <div style={{ background: 'rgba(30,58,95,0.8)', border: '1px solid rgba(20,187,166,0.3)', borderRadius: '16px', padding: '14px 18px', maxWidth: 220, backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(30,58,95,0.4)', transform: 'rotate(-4deg) translateX(-20px)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginBottom: 4 }}>Lunes a sábado 📅</div>
                <div style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.75rem', lineHeight: 1.4 }}>Estamos en tu mismo horario.</div>
              </div>
              <div style={{ background: 'rgba(30,58,95,0.8)', border: '1px solid rgba(15,138,125,0.3)', borderRadius: '16px', padding: '14px 18px', maxWidth: 220, backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(30,58,95,0.4)', transform: 'rotate(3deg) translateX(15px)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginBottom: 4 }}>WhatsApp Directo 💬</div>
                <div style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.75rem', lineHeight: 1.4 }}>Sin tickets. Escribís y listo.</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={2} style={{ zIndex: 1 }}>
            <div style={{ position: 'relative', width: 340 }}>
              <div style={{ position: 'absolute', inset: '-40px', background: 'radial-gradient(ellipse at center, rgba(20,187,166,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', background: 'rgba(30,58,95,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(30,58,95,0.6)' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>S</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Silvia (Kiosco El Sol)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} /> escribiendo...
                    </div>
                  </div>
                </div>
                <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 280 }}>
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'agent' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '85%', padding: '10px 14px',
                        borderRadius: msg.from === 'agent' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.from === 'agent' ? 'linear-gradient(135deg, var(--lp-primary), var(--lp-secondary))' : 'rgba(255,255,255,0.06)',
                        border: msg.from === 'agent' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                        fontSize: '0.82rem', lineHeight: 1.5,
                        color: msg.from === 'agent' ? '#fff' : 'rgba(230,255,251,0.85)',
                        fontWeight: msg.from === 'agent' ? 500 : 400
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '9px 16px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Escribí tu mensaje...</div>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(20,187,166,0.4)' }}>
                    <svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24" style={{ transform: 'rotate(45deg) translateX(-1px) translateY(1px)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={3}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 50, alignItems: 'flex-start', paddingLeft: 30 }}>
              <div style={{ background: 'rgba(30,58,95,0.8)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '16px', padding: '14px 18px', maxWidth: 220, backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(30,58,95,0.4)', transform: 'rotate(5deg) translateX(10px)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginBottom: 4 }}>Respuestas rápidas ⚡</div>
                <div style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.75rem', lineHeight: 1.4 }}>Resolvemos en minutos.</div>
              </div>
              <div style={{ background: 'rgba(30,58,95,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '14px 18px', maxWidth: 220, backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(30,58,95,0.4)', transform: 'rotate(-3deg) translateX(-15px)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginBottom: 4 }}>100% Argentino 🇦🇷</div>
                <div style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.75rem', lineHeight: 1.4 }}>Entendemos tu kiosco.</div>
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={4}>
          <div style={{ marginTop: 56, textAlign: 'center', maxWidth: 700, margin: '56px auto 0', padding: '24px 32px', borderRadius: 16, background: 'rgba(20,187,166,0.05)', border: '1px solid rgba(20,187,166,0.12)' }}>
            <p style={{ fontStyle: 'italic', color: 'rgba(230,255,251,0.7)', fontSize: '1rem', lineHeight: 1.7, marginBottom: 16 }}>
              "Aumentó todo y pensé que iba a estar horas remarcando precios. Escribí al soporte y en 2 minutos me enseñaron a hacerlo masivo. Un alivio total."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--lp-primary), var(--lp-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>S</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Silvia M.</div>
                <div style={{ color: 'rgba(230,255,251,0.5)', fontSize: '0.75rem' }}>Kiosco El Sol, Córdoba</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

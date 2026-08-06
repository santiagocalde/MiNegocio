import { Reveal } from './hooks/useReveal';

const chatMessages = [
  { from: 'user', text: '¡Hola! El proveedor me aumentó un 15% todo lo de limpieza. ¿Tengo que cambiar producto por producto? 😩' },
  { from: 'agent', text: '¡Hola Silvia! Para nada. Andá a Inventario > Modificar Precios, filtrá por categoría "Limpieza" y poné +15%.' },
  { from: 'user', text: 'Me salvaste la vida. Pensé que me quedaba hasta las 12 de la noche cargando precios jajaja' },
  { from: 'agent', text: 'Olvidate, con el sistema actualizas todo en un clic. ¡Buenas ventas! 🚀' },
];

export default function LandingSoporteHumano() {
  return (
    <section className="lp-section" style={{ padding: '64px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 44, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="lp-eyebrow" style={{ marginBottom: 14 }}>Soporte real</span>
            <h2 className="lp-section-title">
              Cuando algo falla,{' '}
              <span style={{ color: 'var(--lp-primary-ink)', fontStyle: 'italic' }}>respondemos nosotros.</span>
            </h2>
            <p className="lp-section-sub" style={{ maxWidth: 500 }}>
              Sin chatbots. Sin formularios. Una persona real, en minutos.
            </p>
          </div>
        </Reveal>
        <div className="lp-soporte-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20, alignItems: 'center', margin: '40px 0' }}>
          <Reveal delay={1} className="lp-soporte-side">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 50, alignItems: 'flex-end', paddingRight: 30 }}>
              <div style={{ background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-primary)', borderRadius: '16px', padding: '14px 18px', maxWidth: 220, boxShadow: 'var(--lp-shadow-md)', transform: 'rotate(-4deg) translateX(-20px)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--lp-ink)', marginBottom: 4 }}>Lunes a sábado 📅</div>
                <div style={{ color: 'var(--lp-ink-soft)', fontSize: '0.75rem', lineHeight: 1.4 }}>Lunes a sábado, 08:00 a 20:00 (ARG).</div>
              </div>
              <div style={{ background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-secondary)', borderRadius: '16px', padding: '14px 18px', maxWidth: 220, boxShadow: 'var(--lp-shadow-md)', transform: 'rotate(3deg) translateX(15px)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--lp-ink)', marginBottom: 4 }}>WhatsApp Directo 💬</div>
                <div style={{ color: 'var(--lp-ink-soft)', fontSize: '0.75rem', lineHeight: 1.4 }}>Sin tickets. Escribís y listo.</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={2} className="lp-soporte-chat" style={{ zIndex: 1 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 340, margin: '0 auto' }}>
              <div style={{ position: 'relative', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--lp-shadow-lg)' }}>
                <div style={{ background: 'var(--lp-paper-sunken)', borderBottom: '1px solid var(--lp-line)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>S</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--lp-ink)' }}>Silvia (Kiosco El Sol)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--lp-green)', fontSize: '0.72rem', fontWeight: 600 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lp-green)' }} /> escribiendo...
                    </div>
                  </div>
                </div>
                <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 280 }}>
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'agent' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '85%', padding: '10px 14px',
                        borderRadius: msg.from === 'agent' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.from === 'agent' ? 'var(--lp-primary)' : 'var(--lp-paper-sunken)',
                        border: msg.from === 'agent' ? 'none' : '1px solid var(--lp-line)',
                        fontSize: '0.82rem', lineHeight: 1.5,
                        color: msg.from === 'agent' ? '#fff' : 'var(--lp-ink-soft)',
                        fontWeight: msg.from === 'agent' ? 500 : 400
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--lp-line)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line)', borderRadius: 20, padding: '9px 16px', fontSize: '0.8rem', color: 'var(--lp-ink-faint)' }}>Escribí tu mensaje...</div>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px var(--lp-primary-glow)' }}>
                    <svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24" style={{ transform: 'rotate(45deg) translateX(-1px) translateY(1px)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={3} className="lp-soporte-side">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 50, alignItems: 'flex-start', paddingLeft: 30 }}>
              <div style={{ background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-green)', borderRadius: '16px', padding: '14px 18px', maxWidth: 220, boxShadow: 'var(--lp-shadow-md)', transform: 'rotate(5deg) translateX(10px)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--lp-ink)', marginBottom: 4 }}>Respuestas rápidas ⚡</div>
                <div style={{ color: 'var(--lp-ink-soft)', fontSize: '0.75rem', lineHeight: 1.4 }}>Resolvemos en minutos.</div>
              </div>
              <div style={{ background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: '16px', padding: '14px 18px', maxWidth: 220, boxShadow: 'var(--lp-shadow-md)', transform: 'rotate(-3deg) translateX(-15px)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--lp-ink)', marginBottom: 4 }}>100% Argentino 🇦🇷</div>
                <div style={{ color: 'var(--lp-ink-soft)', fontSize: '0.75rem', lineHeight: 1.4 }}>Entendemos tu kiosco.</div>
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={4}>
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '44px auto 0', padding: '24px 32px', borderRadius: 16, background: 'var(--lp-primary-wash)', border: '1px solid var(--lp-line)' }}>
            <p style={{ fontStyle: 'italic', color: 'var(--lp-ink-soft)', fontSize: '1rem', lineHeight: 1.7, marginBottom: 16 }}>
              "Aumentó todo y pensé que iba a estar horas remarcando precios. Escribí al soporte y en 2 minutos me enseñaron a hacerlo masivo. Un alivio total."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>S</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--lp-ink)' }}>Silvia M.</div>
                <div style={{ color: 'var(--lp-ink-faint)', fontSize: '0.75rem' }}>Kiosco El Sol, Córdoba</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

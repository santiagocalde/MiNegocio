import { Reveal } from './hooks/useReveal';

const FAQS = [
  { q: '¿Qué es un POS y por qué lo necesito?', a: 'Un POS (Punto de Venta) es el sistema donde registrás tus ventas, controlás el stock y cerrás la caja. Reemplaza al cuaderno y la calculadora para que no pierdas plata ni tiempo.' },
  { q: '¿Es fácil de usar si nunca usé un sistema?', a: '¡Sí! Está diseñado específicamente para kiosqueros. En 5 minutos ya estás vendiendo. No necesitás saber de computación, es más fácil que usar WhatsApp.' },
  { q: '¿Necesito internet todo el tiempo?', a: 'No. Podés seguir cobrando aunque se corte internet. Cuando vuelve la conexión, todo se guarda solo en la nube.' },
  { q: '¿Funciona en mi computadora vieja?', a: 'Totalmente. Como corre en el navegador (Google Chrome), funciona perfecto en cualquier PC, notebook o hasta desde el celular.' },
  { q: '¿Cómo son los 7 días de prueba gratis?', a: 'Te creás la cuenta y usás el sistema completo sin límites. No te pedimos tarjeta de crédito para empezar. Si no te gusta, simplemente dejás de usarlo y listo.' },
];

export default function LandingFAQ() {
  return (
    <section id="faq" className="lp-section" style={{ padding: '64px 24px' }}>
      <div style={{ maxWidth: 650, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 className="lp-section-title">Preguntas frecuentes</h2>
            <p className="lp-section-sub">Todo lo que necesitás saber antes de arrancar.</p>
          </div>
        </Reveal>
        <style>{`
          .faq-details {
            background: var(--lp-paper-raised);
            border: 1px solid var(--lp-line);
            border-radius: 14px;
            overflow: hidden;
            transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
            margin-bottom: 10px;
            box-shadow: var(--lp-shadow-sm);
          }
          .faq-details:hover {
            border-color: var(--lp-primary);
            transform: translateY(-2px);
            box-shadow: var(--lp-shadow-md);
          }
          .faq-details summary {
            padding: 18px 22px;
            font-weight: 700;
            font-size: 1.02rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            list-style: none;
            color: var(--lp-ink);
            cursor: pointer;
            outline: none;
          }
          .faq-details summary::-webkit-details-marker {
            display: none;
          }
          .faq-details[open] {
            border-color: var(--lp-primary);
          }
          .faq-details[open] .faq-chevron {
            transform: rotate(45deg);
            color: var(--lp-red);
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FAQS.map((faq, i) => (
            <Reveal key={i} delay={Math.min(i, 3)}>
              <details className="faq-details">
                <summary>
                  {faq.q}
                  <span className="faq-chevron" style={{ color: 'var(--lp-primary)', transition: 'all 0.3s', fontSize: '1.6rem', lineHeight: 1 }}>+</span>
                </summary>
                <div style={{ padding: '0 22px 18px', color: 'var(--lp-ink-soft)', fontSize: '0.95rem', lineHeight: 1.7 }}>{faq.a}</div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

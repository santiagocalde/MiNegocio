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
    <section id="faq" className="lp-section" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 650, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 className="lp-section-title" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', marginBottom: 12 }}>Preguntas frecuentes</h2>
            <p className="lp-section-sub" style={{ fontSize: '1.1rem', color: 'rgba(230,255,251, 0.65)' }}>Todo lo que necesitás saber antes de arrancar.</p>
          </div>
        </Reveal>
        <style>{`
          .faq-details {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            margin-bottom: 12px;
          }
          .faq-details:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(20, 187, 166, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          }
          .faq-details summary {
            padding: 20px 24px;
            font-weight: 600;
            font-size: 1.05rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            list-style: none;
            color: #fff;
            cursor: pointer;
            outline: none;
          }
          .faq-details summary::-webkit-details-marker {
            display: none;
          }
          .faq-details[open] {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(20, 187, 166, 0.6);
            box-shadow: 0 10px 30px rgba(20, 187, 166, 0.1);
          }
          .faq-details[open] .faq-chevron {
            transform: rotate(45deg);
            color: #ff4757;
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
                <div style={{ padding: '0 24px 20px', color: 'rgba(255,255,255,0.65)', fontSize: '0.95rem', lineHeight: 1.7 }}>{faq.a}</div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

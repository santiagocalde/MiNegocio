import { Reveal } from './hooks/useReveal';

const Svg = {
  AnimZap: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="icon-anim-zap"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  AnimChart: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="icon-anim-chart"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  AnimWifi: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="icon-anim-wifi"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" /></svg>,
  AnimScanner: () => <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="icon-anim-scanner"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7V5a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2M4 17v2a2 2 0 002 2h2m8 0h2a2 2 0 002-2v-2" /><path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M7 8v8M10 8v8M14 8v8M17 8v8" /><line x1="3" y1="12" x2="21" y2="12" stroke="#ef4444" strokeWidth="1.5" className="laser-line" /></svg>,
  AnimBell: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="icon-anim-bell"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  AnimGlobe: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="icon-anim-globe"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

const items = [
  { icon: Svg.AnimZap, color: 'var(--lp-primary)', bg: 'rgba(20,187,166,0.1)', border: 'rgba(20,187,166,0.2)', pain: '"El sistema se colgó en el medio de una fila"', solution: 'Reiniciás y seguís vendiendo. Todo se guarda automáticamente, nunca perdés una venta.' },
  { icon: Svg.AnimChart, color: 'var(--lp-secondary)', bg: 'rgba(15,138,125,0.1)', border: 'rgba(15,138,125,0.2)', pain: '"No sé cuánto gané hoy ni qué me debe cada cliente"', solution: 'El panel te muestra todo en tiempo real: cierre de caja, fiados y ganancias del día en un vistazo.' },
  { icon: Svg.AnimWifi, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', pain: '"Se fue internet y no pude cobrar nada"', solution: 'Si te quedás sin internet mientras la usás, la caja sigue andando. Cuando vuelve, todo se sincroniza solo.' },
  { icon: Svg.AnimScanner, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', pain: '"Llevo horas cargando los precios nuevos del proveedor"', solution: 'Sacá una foto a la factura. La IA carga los productos, precios y cantidades en segundos.' },
  { icon: Svg.AnimBell, color: 'var(--lp-primary)', bg: 'rgba(20,187,166,0.1)', border: 'rgba(20,187,166,0.2)', pain: '"Me quedé sin Coca Cola un domingo a la tarde"', solution: 'El sistema te alerta antes de quedarte sin stock de tus productos más vendidos para que repongas a tiempo.' },
  { icon: Svg.AnimGlobe, color: 'var(--lp-secondary)', bg: 'rgba(15,138,125,0.1)', border: 'rgba(15,138,125,0.2)', pain: '"Mi sistema anterior era complicadísimo de aprender"', solution: 'En 5 minutos ya estás vendiendo. Sin manuales, sin cursos, sin técnicos. Te instalamos nosotros.' },
];

export default function LandingFeatures() {
  return (
    <section id="funciones" className="lp-section" style={{ padding: '100px 24px' }}>
      <div className="lp-container">
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 className="lp-section-title" style={{ fontSize: '2.5rem', marginBottom: 12 }}>El sistema te falla cuando más lo necesitás</h2>
            <p className="lp-section-sub" style={{ fontSize: '1.1rem', color: 'rgba(230,255,251, 0.65)' }}>
              Con MiNegocio tenés soporte real, de personas reales. No un chatbot.
            </p>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 1000, margin: '0 auto' }}>
          {items.map((item, i) => (
            <Reveal key={i} delay={i + 1} style={{ height: '100%' }}>
              <div className="lp-glass feature-card" style={{
                padding: 28, borderColor: item.border,
                display: 'flex', flexDirection: 'column', gap: 16,
                transition: 'transform 0.2s, border-color 0.2s',
                height: '100%'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 12px 32px ${item.color}12`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = item.border; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                  <item.icon />
                </div>
                <p style={{ fontSize: '0.95rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, margin: 0 }}>
                  {item.pain}
                </p>
                <p style={{ fontSize: '0.95rem', color: 'var(--lp-text)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  {item.solution}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

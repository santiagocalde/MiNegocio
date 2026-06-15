import { useState, useEffect } from 'react';
import { Reveal } from './hooks/useReveal';

const Svg = {
  Check: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  ChevronRight: () => <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
};

const FALLBACK_PLANS = [
  { id: 'simple', name: 'Simple', monthly: 20000, yearly: 200000, desc: 'Todo lo necesario para arrancar.', popular: false, features: ['Hasta 3.500 productos', 'Clientes y ventas', 'Soporta cortes de internet', 'Manejo de fiados', 'Lector laser e impresoras', 'Hasta 2 usuarios'], cta: 'Probar gratis' },
  { id: 'pro', name: 'Pro', monthly: 30000, yearly: 300000, desc: 'Para kioscos que crecen.', popular: true, features: ['Todo lo de Simple', 'Hasta 7.000 productos', 'Manejo de proveedores', 'Catalogo web online QR', 'Reportes de ventas detallados', 'Alta asistida en ARCA/AFIP', 'Hasta 5 usuarios'], cta: 'Probar gratis' },
  { id: 'ia', name: 'IA', monthly: 40000, yearly: 400000, desc: 'Automatizacion con inteligencia artificial.', popular: false, features: ['Todo lo de Pro', 'Hasta 10.000 productos', 'Escanner de facturas IA', 'Asesor de precios inteligente', 'Alta asistida en ARCA/AFIP', 'Reportes inteligentes', 'Hasta 10 usuarios'], cta: 'Probar gratis' },
];

function PlanCard({ plan, isYearly, onCta, isLoggedIn }) {
  const mainPrice = isYearly ? Math.round(plan.yearly / 12) : plan.monthly;
  const totalYearly = isYearly ? plan.yearly : null;
  const savings = isYearly ? plan.monthly * 12 - plan.yearly : 0;

  return (
    <div style={{
      position: 'relative', padding: '32px 24px', borderRadius: 24,
      background: plan.popular ? 'rgba(20,187,166,0.05)' : 'rgba(30,58,95,0.6)',
      border: plan.popular ? '1px solid rgba(20,187,166,0.4)' : '1px solid rgba(255,255,255,0.08)',
      boxShadow: plan.popular ? '0 24px 60px rgba(20,187,166,0.15)' : '0 10px 30px rgba(30,58,95,0.2)',
      backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', height: '100%',
      transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
      zIndex: plan.popular ? 2 : 1,
      transition: 'transform 0.3s ease, box-shadow 0.3s ease'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = plan.popular ? 'scale(1.07)' : 'scale(1.02) translateY(-4px)'; e.currentTarget.style.boxShadow = plan.popular ? '0 28px 64px rgba(20,187,166,0.22)' : '0 14px 40px rgba(30,58,95,0.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = plan.popular ? 'scale(1.05)' : 'scale(1)'; e.currentTarget.style.boxShadow = plan.popular ? '0 24px 60px rgba(20,187,166,0.15)' : '0 10px 30px rgba(30,58,95,0.2)'; }}
    >
      {plan.popular && (
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: 'linear-gradient(90deg, var(--lp-primary), var(--lp-secondary))', color: '#fff', fontSize: '0.75rem', fontWeight: 800, padding: '6px 16px', borderRadius: 20, letterSpacing: 1 }}>
          MÁS ELEGIDO
        </div>
      )}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: '#fff' }}>{plan.name}</h3>
        <p style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.85rem', lineHeight: 1.5, minHeight: 40 }}>{plan.desc}</p>
      </div>
      <div style={{ marginBottom: 24, minHeight: 90 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 600, color: 'rgba(230,255,251,0.8)' }}>$</span>
          <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>{mainPrice.toLocaleString('es-AR')}</span>
          <span style={{ fontSize: '0.9rem', color: 'rgba(230,255,251,0.5)' }}>/mes</span>
        </div>
        {isYearly ? (
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'rgba(230,255,251,0.5)' }}>
            Facturado ${totalYearly.toLocaleString('es-AR')} por año.
            {savings > 0 && <span style={{ display: 'block', color: '#10b981', marginTop: 4, fontWeight: 600 }}>Ahorrás ${savings.toLocaleString('es-AR')} anuales</span>}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'rgba(230,255,251,0.5)' }}>
            Facturado mensualmente. Cancelás cuando quieras.
          </div>
        )}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: '0.9rem', color: 'rgba(230,255,251,0.8)' }}>
            <div style={{ color: plan.popular ? 'var(--lp-primary)' : '#10b981', marginTop: 2 }}>
              <Svg.Check width={14} />
            </div>
            {f}
          </li>
        ))}
      </ul>
      <button onClick={onCta} style={{
        width: '100%', padding: '12px 0', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s',
        background: plan.popular ? 'linear-gradient(90deg, var(--lp-primary), var(--lp-secondary))' : 'rgba(255,255,255,0.05)',
        color: '#fff',
        border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.1)'
      }}
        onMouseEnter={e => { if (!plan.popular) e.target.style.background = 'rgba(255,255,255,0.1)' }}
        onMouseLeave={e => { if (!plan.popular) e.target.style.background = 'rgba(255,255,255,0.05)' }}>
        {isLoggedIn ? `Activar plan ${plan.name}` : plan.cta}
      </button>
    </div>
  );
}

export default function LandingPricing({ isYearly, setIsYearly, isLoggedIn, setCheckoutPlan, navigate, setShowContactModal }) {
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  useEffect(() => {
    const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8005';
    fetch(`${baseUrl}/api/plans`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(p => ({
            id: p.id,
            name: p.name,
            monthly: p.monthly,
            yearly: p.yearly,
            desc: p.desc,
            popular: p.popular || false,
            features: p.features || [],
            cta: 'Probar gratis',
          }));
          setPlans(mapped);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section id="planes" className="lp-section" style={{ padding: '100px 24px' }}>
      <div className="lp-container">
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 className="lp-section-title" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Planes simples, sin letra chica</h2>
            <p className="lp-section-sub" style={{ fontSize: '1.1rem', color: 'rgba(230,255,251, 0.65)' }}>Empezás con lo justo. Escalás cuando quieras.</p>
          </div>
        </Reveal>
        <Reveal delay={1}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-flex', padding: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setIsYearly(false)} style={{ padding: '8px 24px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s', background: !isYearly ? 'var(--lp-gradient-main)' : 'transparent', color: !isYearly ? '#fff' : 'var(--lp-text-muted)' }}>Mensual</button>
              <button onClick={() => setIsYearly(true)} style={{ padding: '8px 24px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s', background: isYearly ? 'var(--lp-gradient-main)' : 'transparent', color: isYearly ? '#fff' : 'var(--lp-text-muted)' }}>Anual <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(ahorrá 20%)</span></button>
            </div>
          </div>
        </Reveal>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'stretch' }}>
          {plans.map((plan, i) => (
            <Reveal key={plan.id} delay={i + 1} style={{ height: '100%' }}>
              <PlanCard plan={plan} isYearly={isYearly} onCta={() => isLoggedIn ? setCheckoutPlan(plan) : navigate('/register')} isLoggedIn={isLoggedIn} />
            </Reveal>
          ))}
        </div>
        <Reveal delay={4}>
          <div style={{ textAlign: 'center', marginTop: 120, padding: '32px', borderRadius: 16, border: '1px solid rgba(20,187,166,0.15)', background: 'rgba(20,187,166,0.03)' }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>¿Necesitás un plan a medida?</p>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>Ideal para cadenas de kioscos con múltiples sucursales.</p>
            <button onClick={() => setShowContactModal(true)} className="lp-btn lp-btn--ghost" style={{ padding: '10px 28px', fontSize: '0.85rem', borderColor: 'rgba(20,187,166,0.3)', color: 'var(--lp-primary)' }}
              onMouseEnter={e => e.target.style.background = 'rgba(20,187,166,0.08)'}
              onMouseLeave={e => e.target.style.background = 'transparent'}>
              Contactar <Svg.ChevronRight />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

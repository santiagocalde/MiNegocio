import { useState, useEffect } from 'react';
import { API_ROOT } from '../../config';
import { Reveal } from './hooks/useReveal';

const Svg = {
  Check: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  ChevronRight: () => <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
  Bolt: () => <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
};

const FALLBACK_PLANS = [
  { id: 'simple', name: 'Básico', monthly: 19999, yearly: 180000, desc: 'Otorga hasta 3.500 productos y 2 usuarios', popular: false,
    features: ['Punto de venta con lector de código de barras', 'Vuelto automático en efectivo, transferencia, tarjeta y QR', 'Cobro dividido (pago mixto) en un solo ticket', 'Control de stock con alertas de reposición', 'Cuentas corrientes (fiados) con historial de pagos', 'Compras a proveedores con control de deuda', 'Promociones y descuentos por producto', 'Módulo Cajas: arqueo, cierre de turno y caja inicial', 'Reportes y resumen del día (ventas, pagos y operador)', 'Impresión de tickets y comprobantes', 'Funciona sin internet (modo offline)', 'Facturación ARCA (+adicional)'],
    cta: 'Adquirir' },
  { id: 'pro', name: 'Pro', monthly: 29999, yearly: 270000, desc: 'Otorga hasta 7.000 productos y 5 usuarios', popular: true,
    features: ['Todo lo del plan Simple', 'QR fijo imprimible para tu mostrador (auto-confirmación)', 'Reportes de ventas, ganancias y rentabilidad', 'Exportación de tus datos a Excel', 'Análisis de qué productos te convienen (ventas por categoría)', 'Dashboard ejecutivo: deudores, proveedores y top productos', 'Catálogo web con QR (tu tienda online)', 'Devoluciones y notas de crédito', 'Etiquetas de precio imprimibles', 'Historial completo y auditoría de operaciones', 'Facturación ARCA (+adicional)'],
    cta: 'Adquirir' },
  { id: 'ia', name: 'IA', monthly: 39999, yearly: 360000, desc: 'Otorga hasta 10.000 productos y usuarios ilimitados', popular: false,
    features: ['Todo lo del plan Pro', 'Escáner de facturas con IA', 'Resumen diario del negocio con IA', 'Asesor de precios y reposición con IA', 'Sugerencias de compra y reposición inteligentes', 'Advertencia de stock próximo a agotarse con IA', 'Cobranza de fiados por WhatsApp con IA', 'Pedidos por adelantado con entregas parciales', 'Facturación ARCA (+adicional)'],
    cta: 'Adquirir' },
];

const ARCA_TIERS = [
  { label: '150 fact/mes',  limit: 150,  monthly: 4500,  popular: false },
  { label: '400 fact/mes',  limit: 400,  monthly: 8000,  popular: true  },
  { label: '800 fact/mes',  limit: 800,  monthly: 14000, popular: false },
  { label: 'Sin límite',    limit: null, monthly: 20000, popular: false },
];

function PlanCard({ plan, isYearly, onCta, isLoggedIn }) {
  const mainPrice = isYearly ? Math.round(plan.yearly / 12) : plan.monthly;
  const totalYearly = isYearly ? plan.yearly : null;
  const savings = isYearly ? plan.monthly * 12 - plan.yearly : 0;

  return (
    <div className={`lp-plan-card${plan.popular ? ' lp-plan-popular' : ''}`} style={{
      position: 'relative', padding: '30px 24px', borderRadius: 20,
      background: plan.popular ? 'var(--lp-primary-wash)' : 'var(--lp-paper-raised)',
      border: plan.popular ? '2px solid var(--lp-primary)' : '1px solid var(--lp-line)',
      boxShadow: plan.popular ? '0 24px 56px var(--lp-primary-glow)' : 'var(--lp-shadow-sm)',
      display: 'flex', flexDirection: 'column', height: '100%',
      transform: plan.popular ? 'scale(1.04)' : 'scale(1)',
      zIndex: plan.popular ? 2 : 1,
      transition: 'transform 0.3s ease, box-shadow 0.3s ease'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = plan.popular ? 'scale(1.06)' : 'scale(1.02) translateY(-4px)'; e.currentTarget.style.boxShadow = plan.popular ? '0 28px 60px var(--lp-primary-glow)' : 'var(--lp-shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = plan.popular ? 'scale(1.04)' : 'scale(1)'; e.currentTarget.style.boxShadow = plan.popular ? '0 24px 56px var(--lp-primary-glow)' : 'var(--lp-shadow-sm)'; }}
    >
      {plan.popular && (
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--lp-primary)', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '5px 15px', borderRadius: 20, letterSpacing: '0.1em', fontFamily: 'var(--lp-font-mono)' }}>
          MÁS ELEGIDO
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.4rem', fontWeight: 700, marginBottom: 6, color: 'var(--lp-ink)' }}>{plan.name}</h3>
        <p style={{ color: 'var(--lp-ink-soft)', fontSize: '0.85rem', lineHeight: 1.45 }}>{plan.desc}</p>
      </div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span className="lp-money" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--lp-ink-soft)' }}>$</span>
          <span className="lp-money" style={{ fontSize: '2.6rem', fontWeight: 700, color: 'var(--lp-ink)', letterSpacing: '-0.02em' }}>{mainPrice.toLocaleString('es-AR')}</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--lp-ink-faint)' }}>/mes</span>
        </div>
        {isYearly ? (
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--lp-ink-faint)' }}>
            Facturado ${totalYearly.toLocaleString('es-AR')} por año.
            {savings > 0 && <span style={{ display: 'block', color: 'var(--lp-green)', marginTop: 4, fontWeight: 600 }}>Ahorrás ${savings.toLocaleString('es-AR')} anuales</span>}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--lp-ink-faint)' }}>
            Facturado mensualmente. Cancelás cuando quieras.
          </div>
        )}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {plan.features.map((f, i) => {
          const isArca = f.includes('ARCA');
          return (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, fontSize: '0.9rem', color: isArca ? 'var(--lp-ink-faint)' : 'var(--lp-ink-soft)' }}>
              <div style={{ color: plan.popular ? 'var(--lp-primary-ink)' : 'var(--lp-green)', marginTop: 3, flexShrink: 0 }}>
                <Svg.Check />
              </div>
              {isArca
                ? <span>Facturación ARCA <span style={{ fontSize: '0.78rem', color: '#D97706', fontWeight: 700 }}>+adicional</span></span>
                : f}
            </li>
          );
        })}
      </ul>
      <button onClick={onCta} className={plan.popular ? 'lp-btn lp-btn--primary' : 'lp-btn lp-btn--ghost'} style={{
        width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: '0.95rem',
      }}>
        {isLoggedIn ? `Activar plan ${plan.name}` : plan.cta}
      </button>
    </div>
  );
}

function ArcaAddonSection({ isYearly, onCta }) {
  return (
    <div style={{ maxWidth: 1000, margin: '44px auto 0', padding: '28px 32px', borderRadius: 20, background: 'var(--lp-paper-raised)', border: '1px solid rgba(217,119,6,0.25)', boxShadow: '0 4px 24px rgba(217,119,6,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ background: 'rgba(217,119,6,0.12)', color: '#D97706', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <div>
          <h3 style={{ fontFamily: 'var(--lp-font-display)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--lp-ink)', margin: 0 }}>
            Facturación Electrónica ARCA
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--lp-ink-soft)', margin: '4px 0 0', lineHeight: 1.5 }}>
            Se suma a cualquier plan. Elegí el tramo según tu volumen mensual de facturas.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {ARCA_TIERS.map((tier, i) => (
          <div key={i}
            style={{
              padding: '20px 16px', borderRadius: 14, textAlign: 'center', cursor: 'pointer',
              background: tier.popular ? 'rgba(217,119,6,0.07)' : 'var(--lp-paper-sunken)',
              border: tier.popular ? '2px solid #D97706' : '1px solid var(--lp-line)',
              position: 'relative', transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(217,119,6,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            onClick={() => onCta && onCta(tier)}
          >
            {tier.popular && (
              <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#D97706', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                MÁS ELEGIDO
              </div>
            )}
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--lp-ink-soft)', marginBottom: 12, letterSpacing: '0.01em' }}>
              {tier.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--lp-ink-faint)' }}>$</span>
              <span className="lp-money" style={{ fontSize: '1.75rem', fontWeight: 800, color: tier.popular ? '#D97706' : 'var(--lp-ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {tier.monthly.toLocaleString('es-AR')}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--lp-ink-faint)', marginTop: 4 }}>/mes</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.73rem', color: 'var(--lp-ink-faint)', margin: '18px 0 0', textAlign: 'center', lineHeight: 1.6 }}>
        Requiere CUIT y certificado digital ARCA (gratuito, se tramita desde el sistema). · Facturación tipo A, B y C.
      </p>
    </div>
  );
}

export default function LandingPricing({ isYearly, setIsYearly, isLoggedIn, setCheckoutPlan, navigate, setShowContactModal }) {
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  useEffect(() => {
    fetch(`${API_ROOT}/api/plans`)
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
            cta: 'Adquirir',
          }));
          setPlans(mapped);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section id="planes" className="lp-section" style={{ padding: '64px 24px' }}>
      <div className="lp-container">
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 className="lp-section-title">Planes simples, sin letra chica</h2>
            <p className="lp-section-sub">Empezás con lo justo. Escalás cuando quieras.</p>
          </div>
        </Reveal>
        <Reveal delay={1}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 44 }}>
            <div style={{ display: 'inline-flex', padding: 4, background: 'var(--lp-paper-sunken)', borderRadius: 11, border: '1px solid var(--lp-line)' }}>
              <button onClick={() => setIsYearly(false)} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s', background: !isYearly ? 'var(--lp-primary)' : 'transparent', color: !isYearly ? '#fff' : 'var(--lp-ink-soft)' }}>Mensual</button>
              <button onClick={() => setIsYearly(true)} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s', background: isYearly ? 'var(--lp-primary)' : 'transparent', color: isYearly ? '#fff' : 'var(--lp-ink-soft)' }}>Anual <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>(ahorrá 20%)</span></button>
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

        {/* Add-on: Facturación ARCA */}
        <Reveal delay={4}>
          <ArcaAddonSection isYearly={isYearly} onCta={() => isLoggedIn ? null : navigate('/register')} />
        </Reveal>

        <Reveal delay={5}>
          <div className="lp-plan-custom" style={{ textAlign: 'center', marginTop: 44, padding: '28px', borderRadius: 16, border: '1px solid var(--lp-line)', background: 'var(--lp-paper-raised)' }}>
            <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lp-ink)' }}>¿Necesitás un plan a medida?</p>
            <p style={{ color: 'var(--lp-ink-soft)', fontSize: '0.85rem', marginBottom: 14 }}>Ideal para cadenas de kioscos con múltiples sucursales.</p>
            <button onClick={() => setShowContactModal(true)} className="lp-btn lp-btn--ghost" style={{ padding: '10px 28px', fontSize: '0.85rem' }}>
              Contactar <Svg.ChevronRight />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

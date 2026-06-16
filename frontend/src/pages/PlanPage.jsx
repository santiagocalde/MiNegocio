import React, { useState, useEffect } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { WHATSAPP_LINK } from '../utils/constants';
import { Icons } from '../components/ui/Icons';
import { apiPost } from '../services/apiClient';

const FALLBACK_PLANS = [
  { id: 'simple', name: 'Simple', monthly: 20000, yearly: 200000, desc: 'Todo lo necesario para arrancar.', popular: false, features: ['Hasta 3.500 productos', 'Clientes y ventas', 'Soporta cortes de internet', 'Cuentas corrientes', 'Manejo de proveedores', 'Lector laser e impresoras', 'Hasta 2 usuarios'], cta: 'Adquirir' },
  { id: 'pro', name: 'Pro', monthly: 30000, yearly: 300000, desc: 'Para kioscos que crecen.', popular: true, features: ['Todo lo de Simple', 'Hasta 7.000 productos', 'Catalogo web online QR', 'Reportes de ventas detallados', 'Alta asistida en ARCA/AFIP', 'Hasta 5 usuarios'], cta: 'Adquirir' },
  { id: 'ia', name: 'IA', monthly: 40000, yearly: 400000, desc: 'Automatizacion con inteligencia artificial.', popular: false, features: ['Todo lo de Pro', 'Hasta 10.000 productos', 'Escanner de facturas IA', 'Asesor de precios inteligente', 'Alta asistida en ARCA/AFIP', 'Reportes inteligentes', 'Hasta 10 usuarios'], cta: 'Adquirir' },
];

function PlanCard({ plan, isYearly, currentPlan, onSubscribe }) {
  const mainPrice = isYearly ? Math.round(plan.yearly / 12) : plan.monthly;
  const totalYearly = plan.yearly;
  const savings = plan.monthly * 12 - plan.yearly;
  const isCurrent = plan.id === currentPlan;

  return (
      <div className="lp-glass" style={{
      padding: '32px 24px', display: 'flex', flexDirection: 'column', position: 'relative',
      background: plan.popular ? 'rgba(20, 187, 166, 0.05)' : 'var(--bg-card)',
      border: plan.popular ? '1px solid rgba(20,187,166,0.3)' : '1px solid var(--border-color)',
      transform: plan.popular ? 'scale(1.02)' : 'none',
      boxShadow: plan.popular ? '0 20px 40px rgba(0,0,0,0.3), inset 0 0 20px rgba(20,187,166,0.05)' : 'none',
      borderRadius: '16px',
      zIndex: plan.popular ? 2 : 1
    }}>
      {plan.popular && (
        <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--gradient-primary)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '4px 12px', borderRadius: 20, letterSpacing: 1, boxShadow: '0 4px 12px rgba(20,187,166,0.4)' }}>
          MÁS ELEGIDO
        </div>
      )}

      {isCurrent && !plan.popular && (
        <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-success)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '4px 12px', borderRadius: 20, letterSpacing: 1 }}>
          TU PLAN
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

        {isYearly && plan.monthly > 0 ? (
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'rgba(230,255,251,0.5)' }}>
            Facturado ${totalYearly.toLocaleString('es-AR')} por año.
            {savings > 0 && <span style={{ display: 'block', color: '#10b981', marginTop: 4, fontWeight: 600 }}>Ahorrás ${savings.toLocaleString('es-AR')} anuales</span>}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'rgba(230,255,251,0.5)' }}>
            {plan.monthly > 0 ? 'Facturado mensualmente. Cancelás cuando quieras.' : 'Para siempre.'}
          </div>
        )}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: '0.9rem', color: 'rgba(230,255,251,0.8)' }}>
            <div style={{ color: plan.popular ? 'var(--accent-primary)' : 'var(--accent-success)', marginTop: 2 }}>
              <Icons.Check />
            </div>
            {f}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <button disabled style={{
          width: '100%', padding: '12px 0', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem',
          background: 'rgba(16,185,129,0.1)', color: 'var(--accent-success)', border: '1px solid rgba(16,185,129,0.2)'
        }}>
          Plan Actual
        </button>
      ) : (
        <button onClick={() => onSubscribe(plan.id, isYearly)} style={{
          display: 'block', width: '100%', padding: '12px 0', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', textDecoration: 'none',
          background: plan.popular ? 'var(--gradient-primary)' : 'var(--bg-card)',
          color: '#fff',
          border: plan.popular ? 'none' : '1px solid var(--border-color)'
        }}>
          {plan.cta}
        </button>
      )}
    </div>
  );
}

export default function PlanPage() {
  const { currentPlan, trialDaysRemaining, isTrialExpired } = usePanelContext();
  const [isYearly, setIsYearly] = useState(false);
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  useEffect(() => {
    const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8005';
    fetch(`${baseUrl}/api/plans`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data.map(p => ({
            id: p.id,
            name: p.name,
            desc: p.desc,
            monthly: p.monthly,
            yearly: p.yearly,
            features: p.features || [],
            popular: p.popular || false,
            cta: 'Contactar Ventas',
          })));
        }
      })
      .catch(() => {});
  }, []);

  const activePlanId = currentPlan === 'trial' ? 'simple' : currentPlan;

  const handleSubscribe = async (planId, isYearly) => {
    try {
      const response = await apiPost('/billing/subscribe', { plan_id: planId, is_yearly: isYearly });
      const data = await response.json();
      if (data && data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert('Hubo un error al generar el link de pago.');
      }
    } catch (err) {
      alert('Error de conexión con MercadoPago.');
    }
  };

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box', background: 'transparent', color: '#fff', fontFamily: 'var(--font-main)' }}>
      {currentPlan === 'trial' && !isTrialExpired && (
        <div style={{ background: 'linear-gradient(135deg, rgba(20,187,166,0.15), rgba(15,138,125,0.1))', border: '1px solid rgba(20,187,166,0.2)', borderRadius: 12, padding: '16px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.5rem' }}>🎁</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#fff' }}>Periodo de prueba activa</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>
              Te quedan {trialDaysRemaining} día{trialDaysRemaining !== 1 ? 's' : ''} de prueba premium. Disfrutá de todas las funciones sin límites.
            </span>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.5px' }}>Planes simples, sin letra chica</h2>
        <p style={{ fontSize: '1.05rem', color: 'rgba(230,255,251, 0.65)' }}>Empezás con lo justo. Escalás cuando quieras.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
        <div style={{ display: 'inline-flex', padding: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setIsYearly(false)} style={{
            padding: '8px 24px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
            background: !isYearly ? 'var(--gradient-primary)' : 'transparent', color: !isYearly ? '#fff' : 'rgba(255,255,255,0.5)',
          }}>Mensual</button>
          <button onClick={() => setIsYearly(true)} style={{
            padding: '8px 24px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
            background: isYearly ? 'var(--gradient-primary)' : 'transparent', color: isYearly ? '#fff' : 'rgba(255,255,255,0.5)',
          }}>Anual <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(ahorrá 20%)</span></button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'stretch', paddingBottom: 40 }}>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} isYearly={isYearly} currentPlan={activePlanId} onSubscribe={handleSubscribe} />
        ))}
      </div>
    </div>
  );
}

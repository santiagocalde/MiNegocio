import React, { useState, useEffect } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { WHATSAPP_LINK } from '../utils/constants';
import { Icons } from '../components/ui/Icons';
import { apiPost, apiGet } from '../services/apiClient';

const FALLBACK_PLANS = [
  { id: 'simple', name: 'Simple', monthly: 20000, yearly: 200000, desc: 'Todo lo necesario para arrancar.', popular: false, features: ['Hasta 3.500 productos', 'Clientes y ventas', 'Soporta cortes de internet', 'Cuentas corrientes', 'Manejo de proveedores', 'Lector laser e impresoras', 'Hasta 2 usuarios'], cta: 'Adquirir' },
  { id: 'pro', name: 'Pro', monthly: 30000, yearly: 300000, desc: 'El plan más elegido por los kioscos.', popular: true, features: ['Todo lo de Simple', 'Catálogo web con QR (tu tienda online)', 'Reportes de ventas y ganancias', 'Análisis de rentabilidad por producto', 'Hasta 7.000 productos', 'Hasta 5 usuarios'], cta: 'Adquirir' },
  { id: 'ia', name: 'IA', monthly: 40000, yearly: 400000, desc: 'Tu negocio con inteligencia artificial.', popular: false, features: ['Todo lo de Pro', 'Escáner de facturas con IA', 'Resumen diario del negocio con IA', 'Asesor de precios y reposición con IA', 'Cobranza de fiados por WhatsApp con IA', 'Hasta 10.000 productos'], cta: 'Adquirir' },
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
          {plan.id === 'simple' && currentPlan === 'trial' ? 'Adquirir' : plan.cta || 'Adquirir'}
        </button>
      )}
    </div>
  );
}

export default function PlanPage() {
  const { currentPlan, trialDaysRemaining, isTrialExpired } = usePanelContext();
  const [isYearly, setIsYearly] = useState(true); // anual por default: resalta el ahorro del 20%
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [planPageLoading, setPlanPageLoading] = useState(false);
  const [planPageError, setPlanPageError] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetail, setCancelDetail] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    apiGet('/plans')
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
            cta: 'Adquirir',
          })));
        }
      })
      .catch(() => {});
  }, []);

  const activePlanId = currentPlan;
  const hasPaidPlan = ['simple', 'pro', 'ia'].includes(currentPlan);

  const CANCEL_OPTIONS = [
    { id: 'precio', label: 'Es muy caro para mí' },
    { id: 'no_lo_uso', label: 'No lo estoy usando' },
    { id: 'cambie_sistema', label: 'Me cambio a otro sistema' },
    { id: 'faltan_funciones', label: 'Le faltan funciones que necesito' },
    { id: 'cerro_negocio', label: 'Cerré / pausé el negocio' },
    { id: 'otro', label: 'Otro motivo' },
  ];

  const handleCancel = async () => {
    if (cancelling || !cancelReason) return;
    setCancelling(true);
    setCancelError('');
    try {
      const res = await apiPost('/billing/cancel', { reason: cancelReason, detail: cancelDetail });
      if (res.ok) {
        setCancelDone(true);
      } else {
        setCancelError('No se pudo procesar la cancelación. Escribinos por WhatsApp y lo resolvemos.');
      }
    } catch {
      setCancelError('Error de conexión. Intentá de nuevo o escribinos por WhatsApp.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubscribe = async (planId, isYearly) => {
    if (planPageLoading) return;
    setPlanPageLoading(true);
    setPlanPageError('');
    try {
      const response = await apiPost('/billing/subscribe', { plan_id: planId, is_yearly: isYearly });
      const data = await response.json();
      if (data && data.init_point) {
        window.location.href = data.init_point;
      } else {
        setPlanPageError('No se pudo generar el link de pago. Intenta nuevamente.');
      }
    } catch (err) {
      setPlanPageError('Error de conexion con MercadoPago. Revisa tu internet.');
    } finally {
      setPlanPageLoading(false);
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

      {planPageError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 20px', marginBottom: 20, color: '#FCA5A5', fontSize: '0.88rem', fontWeight: 500, textAlign: 'center', maxWidth: 400, margin: '0 auto 20px' }}>
          {planPageError}
        </div>
      )}

      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'stretch', paddingBottom: 40 }}>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} isYearly={isYearly} currentPlan={activePlanId} onSubscribe={handleSubscribe} />
        ))}
      </div>

      {hasPaidPlan && (
        <div style={{ textAlign: 'center', paddingBottom: 40 }}>
          <button onClick={() => { setShowCancel(true); setCancelDone(false); setCancelReason(''); setCancelDetail(''); setCancelError(''); }}
            style={{ background: 'none', border: 'none', color: 'rgba(230,255,251,0.4)', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
            Cancelar suscripción
          </button>
        </div>
      )}

      {showCancel && (
        <div onClick={() => !cancelling && setShowCancel(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#0F1A30', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {cancelDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>👋</div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: 10 }}>Suscripción cancelada</h3>
                <p style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
                  No se harán más cobros. Podés seguir usando tu plan hasta que termine el período que ya pagaste. Gracias por probar MiNegocio.
                </p>
                <button onClick={() => setShowCancel(false)}
                  style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: 'var(--gradient-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  Entendido
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: 6 }}>¿Por qué querés cancelar?</h3>
                <p style={{ color: 'rgba(230,255,251,0.55)', fontSize: '0.85rem', marginBottom: 18 }}>Tu respuesta nos ayuda a mejorar. Solo tomás un segundo.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {CANCEL_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => setCancelReason(opt.id)}
                      style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 9, cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit',
                        border: `1px solid ${cancelReason === opt.id ? 'var(--primary, #14BBA6)' : 'rgba(255,255,255,0.08)'}`,
                        background: cancelReason === opt.id ? 'rgba(20,187,166,0.12)' : 'rgba(255,255,255,0.02)',
                        color: cancelReason === opt.id ? '#fff' : 'rgba(230,255,251,0.7)' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <textarea value={cancelDetail} onChange={e => setCancelDetail(e.target.value)} placeholder="Contanos algo más (opcional)"
                  rows={2} maxLength={500}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: 16 }} />
                {cancelError && <div style={{ color: '#FCA5A5', fontSize: '0.82rem', marginBottom: 12 }}>{cancelError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowCancel(false)} disabled={cancelling}
                    style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(230,255,251,0.8)', fontWeight: 600, cursor: cancelling ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    Mejor no
                  </button>
                  <button onClick={handleCancel} disabled={!cancelReason || cancelling}
                    style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: (!cancelReason || cancelling) ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.85)', color: '#fff', fontWeight: 600, cursor: (!cancelReason || cancelling) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {cancelling ? 'Cancelando…' : 'Cancelar suscripción'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

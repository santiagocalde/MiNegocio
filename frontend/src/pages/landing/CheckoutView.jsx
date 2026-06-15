import { useState } from 'react';
import LogoMercadoPago from '../../assets/images/mercadopago_logo.png';

const Svg = {
  ArrowRight: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
};

export default function CheckoutView({ plan, isYearly, onBack, onComplete }) {
  const [step, setStep] = useState(1);
  const [usersLimit, setUsersLimit] = useState(2);
  const [formData, setFormData] = useState({ nombre: '', apellido: '', telefono: '' });
  const [isPaying, setIsPaying] = useState(false);

  const extraCostMap = { 2: 0, 5: 10000, 10: 25000 };
  const usersCost = extraCostMap[usersLimit] || 0;
  const subtotalBase = isYearly ? plan.monthly * 12 : plan.monthly;
  const descuentoNum = isYearly ? (subtotalBase - plan.yearly) : 0;
  const discountPercentage = isYearly ? Math.round((descuentoNum / subtotalBase) * 100) : 0;
  const totalUsers = isYearly ? usersCost * 12 : usersCost;
  const total = (subtotalBase - descuentoNum) + totalUsers;

  const handlePay = () => {
    setIsPaying(true);
    console.log("Checkout iniciado", { plan: plan.name, isYearly, usersLimit, user: formData });
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  return (
    <div className="lp-noise" style={{ fontFamily: 'var(--lp-font-body)', color: 'var(--lp-text)', minHeight: '100vh', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
      <div className="lp-canvas" />
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: step === 1 ? 600 : 950, display: 'flex', flexDirection: 'column', gap: 24, transition: 'all 0.3s ease' }}>
        <button onClick={() => step === 2 ? setStep(1) : onBack()} style={{ background: 'transparent', border: 'none', color: 'var(--lp-text-muted)', fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 16 }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>
          <Svg.ArrowRight /> {step === 2 ? 'Volver a Cantidad de Usuarios' : 'Volver a los planes'}
        </button>
        <div className="lp-glass" style={{ padding: step === 1 ? 40 : 0, borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,58,95,0.85)', overflow: 'hidden' }}>
          {step === 1 && (
            <div style={{ animation: 'fadeIn 0.4s ease' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8, color: '#fff', letterSpacing: '-0.5px', textAlign: 'center' }}>Paso 1: Módulo de Usuarios</h2>
              <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem', marginBottom: 32, textAlign: 'center' }}>¿Cuántas personas van a usar el sistema al mismo tiempo?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
                {[
                  { label: 'Hasta 2 usuarios/cajas', limit: 2, cost: extraCostMap[2] },
                  { label: 'Hasta 5 usuarios/cajas', limit: 5, cost: extraCostMap[5] },
                  { label: 'Hasta 10 usuarios/cajas', limit: 10, cost: extraCostMap[10] },
                ].map((opt, i) => (
                  <label key={i} onClick={() => setUsersLimit(opt.limit)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: usersLimit === opt.limit ? 'rgba(20,187,166,0.15)' : 'rgba(255,255,255,0.03)', border: usersLimit === opt.limit ? '1px solid rgba(20,187,166,0.4)' : '1px solid rgba(255,255,255,0.05)', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: usersLimit === opt.limit ? '6px solid var(--lp-primary)' : '2px solid rgba(255,255,255,0.3)', transition: 'all 0.2s', background: usersLimit === opt.limit ? 'var(--lp-primary)' : 'transparent', boxShadow: usersLimit === opt.limit ? 'inset 0 0 0 3px rgba(30,58,95,0.85)' : 'none' }} />
                      <span style={{ fontSize: '1rem', color: '#fff', fontWeight: usersLimit === opt.limit ? 600 : 400 }}>{opt.label}</span>
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: opt.cost === 0 ? 'var(--lp-text-muted)' : '#10b981' }}>{opt.cost === 0 ? 'Incluido' : `+$${opt.cost.toLocaleString('es-AR')}/mes`}</span>
                  </label>
                ))}
              </div>
              <button onClick={() => setStep(2)} style={{ width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg, var(--lp-primary), var(--lp-secondary))', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 32px rgba(20,187,166, 0.5)', transition: 'all 0.2s' }}>
                Continuar a Datos
              </button>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', alignItems: 'stretch', animation: 'fadeIn 0.4s ease' }}>
              <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8, color: '#fff', letterSpacing: '-0.5px' }}>Tus Datos</h2>
                <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.9rem', marginBottom: 32 }}>Completá tu info para activar el Plan {plan.name}.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Nombre</label>
                      <input type="text" placeholder="Ej. Juan" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', outline: 'none', fontSize: '0.95rem', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Apellido</label>
                      <input type="text" placeholder="Ej. Pérez" value={formData.apellido} onChange={e => setFormData({ ...formData, apellido: e.target.value })} style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', outline: 'none', fontSize: '0.95rem', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Número de WhatsApp</label>
                    <input type="tel" placeholder="Ej. +54 9 11 1234 5678" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', outline: 'none', fontSize: '0.95rem', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 32 }}>
                    <div style={{ padding: '16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden' }}>
                        <img src={LogoMercadoPago} alt="Mercado Pago" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div>
                        <div style={{ color: 'var(--lp-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 2 }}>Método de Pago</div>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>Mercado Pago</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: 'rgba(30,58,95,0.6)', padding: '48px 40px', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4, letterSpacing: '-0.5px' }}>Resumen</h3>
                <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.9rem', marginBottom: 32 }}>El importe que se te cobra hoy.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem' }}>Plan</span>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>Plan {plan.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem' }}>Duración</span>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>{isYearly ? '1 año' : '1 mes'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem' }}>Subtotal</span>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>${subtotalBase.toLocaleString('es-AR')}</span>
                  </div>
                  {isYearly && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem' }}>Descuento ({discountPercentage}%)</span>
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.95rem' }}>-${descuentoNum.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.95rem' }}>Modalidad</span>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>Pago único</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Total</span>
                    <span style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1 }}>${total.toLocaleString('es-AR')}</span>
                  </div>
                  <span style={{ color: 'rgba(230,255,251,0.5)', fontSize: '0.85rem' }}>Pago único para este periodo.</span>
                </div>
                <button onClick={handlePay} disabled={isPaying || !formData.nombre || !formData.telefono} style={{ width: '100%', padding: '16px 0', borderRadius: 10, border: 'none', background: '#14BBA6', color: '#fff', fontSize: '1.1rem', fontWeight: 700, cursor: (isPaying || !formData.nombre || !formData.telefono) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 24px rgba(20,187,166, 0.25)', opacity: (isPaying || !formData.nombre || !formData.telefono) ? 0.6 : 1, transition: 'all 0.2s' }}>
                  {isPaying ? 'Procesando...' : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      Pagar
                    </>
                  )}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(230,255,251,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(230,255,251,0.4)' }}>Pago seguro con cifrado SSL</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Svg = {
  ArrowLeft: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
};

export default function NosotrosPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('landing-open');
    window.scrollTo(0, 0);
    return () => document.body.classList.remove('landing-open');
  }, []);

  return (
    <div className="lp-noise" style={{ fontFamily: 'var(--lp-font-body)', color: 'var(--lp-text)', minHeight: '100vh', position: 'relative', padding: '40px 24px' }}>
      <div className="lp-canvas" />
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />

      <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--lp-text-muted)', fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>
          <Svg.ArrowLeft /> Volver a Inicio
        </button>

        <div className="lp-glass" style={{ padding: '40px 32px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(35,65,105,0.85)' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: 16, color: '#fff' }}>Sobre Nosotros</h1>
          
          <div style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'rgba(230,255,251,0.8)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p>
              En <strong>MiNegocio</strong> nacimos con una misión clara: devolverle el tiempo a los dueños de kioscos, almacenes y comercios minoristas de toda Argentina. Sabemos que el trabajo detrás del mostrador no termina cuando se baja la persiana; hacer números, controlar faltantes y pelear con los proveedores consume horas valiosas.
            </p>
            <p>
              Por eso creamos un Punto de Venta que no te exige conexión a internet para funcionar, porque entendemos las realidades de la infraestructura en muchos barrios. Te damos una herramienta rápida, estable y diseñada pensando en la velocidad de atención que requiere un kiosco en hora pico.
            </p>
            <div style={{ padding: '20px', background: 'rgba(20,187,166,0.05)', borderRadius: 16, border: '1px solid rgba(20,187,166,0.2)' }}>
              <h3 style={{ color: 'var(--lp-primary)', marginBottom: 10, fontSize: '1.05rem', fontWeight: 700 }}>Nuestra Filosofía</h3>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li><strong>Cero Fricción:</strong> Cada botón de nuestro sistema está pensado para usarse con un solo toque.</li>
                <li><strong>Autonomía Total:</strong> Tu información es tuya y funciona en tu computadora localmente sin depender de la nube para vender.</li>
                <li><strong>Transparencia:</strong> Precios claros, en pesos, sin letras chicas ni sorpresas.</li>
              </ul>
            </div>
            <p>
              Hoy acompañamos a cientos de negocios a dar el salto digital de forma amigable y profesional. Estamos orgullosos de desarrollar tecnología de primer nivel mundial, aplicada a la necesidad del comerciante local.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

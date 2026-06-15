import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
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

      <div style={{ maxWidth: 750, margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--lp-text-muted)', fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>
          ← Volver a Inicio
        </button>

        <div className="lp-glass" style={{ padding: '40px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(35,65,105,0.85)' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: 8, color: '#fff' }}>Términos y Condiciones</h1>
          <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.85rem', marginBottom: 32 }}>Última actualización: Junio 2026</p>

          <div style={{ fontSize: '0.95rem', lineHeight: 1.8, color: 'rgba(230,255,251,0.8)', display: 'flex', flexDirection: 'column', gap: 24 }}>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>1. Aceptación de los Términos</h2>
              <p>Al acceder y utilizar MiNegocio ("el Servicio"), aceptás estar sujeto a estos Términos y Condiciones. Si no estás de acuerdo con alguna parte de los términos, no podés usar el Servicio.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>2. Descripción del Servicio</h2>
              <p>MiNegocio es un sistema de Punto de Venta (POS) diseñado para kioscos, almacenes y comercios minoristas. El Servicio incluye gestión de inventario, registro de ventas, control de caja, manejo de fiados, reportes y funcionalidades de facturación electrónica (ARCA).</p>
              <p style={{ marginTop: 8 }}>El Servicio funciona tanto en modo online (conectado a nuestros servidores) como en modo offline (localmente en tu dispositivo), sincronizando automáticamente los datos cuando se restablece la conexión.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>3. Registro y Cuentas</h2>
              <p>Para utilizar el Servicio, debés crear una cuenta proporcionando información veraz y completa. Sos responsable de mantener la confidencialidad de tu contraseña y de todas las actividades que ocurran bajo tu cuenta.</p>
              <p style={{ marginTop: 8 }}>No podés compartir tu cuenta con terceros no autorizados. Cada plan incluye un número máximo de usuarios simultáneos. Exceder este límite sin autorización puede resultar en la suspensión del servicio.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>4. Planes y Pagos</h2>
              <p>MiNegocio ofrece planes de suscripción mensual o anual con diferentes características y límites. Los precios están expresados en pesos argentinos (ARS) e incluyen IVA cuando corresponda.</p>
              <p style={{ marginTop: 8 }}>Los pagos se procesan a través de Mercado Pago. Al contratar un plan, autorizás el cobro recurrente según la periodicidad elegida. Podés cancelar tu suscripción en cualquier momento desde el panel de configuración. La cancelación será efectiva al finalizar el período ya abonado.</p>
              <p style={{ marginTop: 8 }}>Ofrecemos un período de prueba gratuito de 7 días sin necesidad de ingresar datos de pago. Durante este período, tenés acceso completo a todas las funcionalidades del plan elegido.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>5. Propiedad Intelectual</h2>
              <p>MiNegocio, su código fuente, diseño, logo, nombre y todos los elementos visuales y funcionales son propiedad exclusiva de sus desarrolladores. No se otorga ninguna licencia de uso del software más allá del acceso al Servicio según el plan contratado.</p>
              <p style={{ marginTop: 8 }}>No está permitido copiar, modificar, descompilar, realizar ingeniería inversa ni crear obras derivadas del software sin autorización expresa por escrito.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>6. Uso Aceptable</h2>
              <p>Te comprometés a usar el Servicio únicamente para fines legítimos de gestión comercial. Está prohibido:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>Usar el sistema para actividades ilegales o fraudulentas.</li>
                <li>Intentar acceder a datos de otros comercios o usuarios.</li>
                <li>Sobrecargar o atacar nuestros servidores.</li>
                <li>Revender o sublicenciar el acceso al Servicio sin autorización.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>7. Limitación de Responsabilidad</h2>
              <p>MiNegocio se proporciona "tal cual", sin garantías explícitas o implícitas. Si bien trabajamos para mantener una disponibilidad del 98.7%, no garantizamos que el servicio sea ininterrumpido o libre de errores.</p>
              <p style={{ marginTop: 8 }}>No seremos responsables por pérdidas de datos derivadas de fallas en tu conexión a internet, hardware o sistema operativo. Recomendamos mantener copias de seguridad regulares de tu información.</p>
              <p style={{ marginTop: 8 }}>El modo offline está diseñado para funcionar durante cortes temporales de internet. Los datos se almacenan localmente y se sincronizan al reconectar. No nos hacemos responsables por pérdidas de ventas registradas offline si el dispositivo sufre un daño antes de la sincronización.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>8. Privacidad y Datos</h2>
              <p>El tratamiento de tus datos personales y los de tu negocio se rige por nuestra Política de Privacidad, que forma parte integral de estos Términos. Al usar el Servicio, consentís las prácticas descritas en dicha política.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>9. Modificaciones</h2>
              <p>Nos reservamos el derecho de modificar estos Términos en cualquier momento. Las modificaciones serán notificadas por correo electrónico y/o mediante un aviso en el panel de administración. El uso continuado del Servicio después de dichas modificaciones constituye tu aceptación de los nuevos términos.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>10. Contacto</h2>
              <p>Para cualquier consulta sobre estos Términos, podés contactarnos a través de:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>Email: upcodednow@gmail.com</li>
                <li>WhatsApp: +54 9 11 4427-6384</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

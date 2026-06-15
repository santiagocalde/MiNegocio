import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
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
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: 8, color: '#fff' }}>Política de Privacidad</h1>
          <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.85rem', marginBottom: 32 }}>Última actualización: Junio 2026</p>

          <div style={{ fontSize: '0.95rem', lineHeight: 1.8, color: 'rgba(230,255,251,0.8)', display: 'flex', flexDirection: 'column', gap: 24 }}>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>1. Información que Recopilamos</h2>
              <p>Para proporcionar el servicio MiNegocio, recopilamos la siguiente información:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li><strong>Datos de registro:</strong> nombre, correo electrónico, número de teléfono (WhatsApp) y nombre del negocio.</li>
                <li><strong>Datos de uso:</strong> productos cargados, ventas realizadas, movimientos de stock, cierres de caja y reportes generados.</li>
                <li><strong>Datos de facturación:</strong> información necesaria para emitir facturas electrónicas ARCA cuando el servicio está habilitado.</li>
                <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador, sistema operativo y registros de acceso para diagnóstico y seguridad.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>2. Cómo Usamos tu Información</h2>
              <p>Utilizamos la información recopilada para:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>Proveer, mantener y mejorar el Servicio.</li>
                <li>Procesar transacciones y gestionar tu suscripción.</li>
                <li>Enviar notificaciones relacionadas con tu cuenta (recordatorios de stock bajo, cierres de caja).</li>
                <li>Brindar soporte técnico a través de WhatsApp y correo electrónico.</li>
                <li>Detectar y prevenir fraudes o usos no autorizados.</li>
                <li>Cumplir con obligaciones legales y fiscales argentinas.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>3. Almacenamiento y Seguridad</h2>
              <p>Tus datos se almacenan en servidores seguros con cifrado en tránsito (TLS/SSL) y en reposo. Implementamos medidas de seguridad estándar de la industria para proteger tu información contra accesos no autorizados, alteraciones o destrucción.</p>
              <p style={{ marginTop: 8 }}>Las contraseñas se almacenan utilizando funciones hash criptográficas (bcrypt). Nunca almacenamos contraseñas en texto plano.</p>
              <p style={{ marginTop: 8 }}>El modo offline almacena temporalmente los datos de ventas en tu dispositivo local. Estos datos se transmiten de forma cifrada a nuestros servidores cuando se restablece la conexión a internet.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>4. Tus Datos de Negocio</h2>
              <p>Toda la información comercial que ingresás al sistema (productos, precios, ventas, clientes, proveedores) es de tu exclusiva propiedad. No accedemos, compartimos ni utilizamos esta información para ningún fin que no sea la operación técnica del servicio.</p>
              <p style={{ marginTop: 8 }}>No vendemos, alquilamos ni compartimos tus datos comerciales con terceros.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>5. Comunicaciones</h2>
              <p>Podemos enviarte correos electrónicos o mensajes de WhatsApp relacionados con:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>Confirmación de registro y activación de cuenta.</li>
                <li>Notificaciones de facturación y vencimiento de planes.</li>
                <li>Actualizaciones importantes del Servicio.</li>
                <li>Respuestas a tus consultas de soporte técnico.</li>
              </ul>
              <p style={{ marginTop: 8 }}>No enviamos comunicaciones promocionales ni spam. Si en el futuro implementamos un boletín informativo, será únicamente con tu consentimiento explícito (opt-in).</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>6. Cookies y Tecnologías Similares</h2>
              <p>MiNegocio utiliza almacenamiento local del navegador (localStorage) para mantener tu sesión activa y guardar preferencias de uso. No utilizamos cookies de seguimiento de terceros ni tecnologías de publicidad dirigida.</p>
              <p style={{ marginTop: 8 }}>El token de autenticación se almacena en localStorage para permitir el acceso persistente a tu cuenta. Este token se elimina al cerrar sesión.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>7. Terceros</h2>
              <p>Compartimos información limitada con los siguientes terceros únicamente para la operación del Servicio:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li><strong>Mercado Pago:</strong> para procesar los pagos de suscripción. No almacenamos datos de tarjetas de crédito.</li>
                <li><strong>ARCA (ex AFIP):</strong> para la emisión de facturas electrónicas, únicamente cuando el servicio está habilitado por el usuario.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>8. Retención de Datos</h2>
              <p>Conservamos tus datos mientras tu cuenta esté activa. Si cancelás tu suscripción, tus datos comerciales se conservan durante 90 días por si decidís reactivar el servicio. Pasado ese período, podés solicitar la eliminación definitiva de tus datos.</p>
              <p style={{ marginTop: 8 }}>Los datos necesarios para cumplir con obligaciones fiscales argentinas se conservan por el período legal requerido (actualmente 5 años para documentación comercial).</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>9. Tus Derechos</h2>
              <p>De acuerdo con la Ley de Protección de Datos Personales de Argentina (Ley 25.326), tenés derecho a:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>Acceder a tus datos personales almacenados en nuestros sistemas.</li>
                <li>Solicitar la rectificación o actualización de datos inexactos.</li>
                <li>Solicitar la supresión de tus datos cuando ya no sean necesarios.</li>
                <li>Retirar tu consentimiento para el tratamiento de datos en cualquier momento.</li>
              </ul>
              <p style={{ marginTop: 8 }}>Para ejercer estos derechos, contactanos a upcodednow@gmail.com.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>10. Cambios a esta Política</h2>
              <p>Podemos actualizar esta Política de Privacidad periódicamente. Te notificaremos sobre cambios significativos por correo electrónico y/o mediante un aviso en el panel de administración. El uso continuado del Servicio después de dichos cambios implica la aceptación de la nueva política.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 12 }}>11. Contacto</h2>
              <p>Para cualquier consulta sobre esta Política de Privacidad o sobre el tratamiento de tus datos:</p>
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

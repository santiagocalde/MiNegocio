import React, { useState } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { WHATSAPP_LINK } from '../utils/constants';
import { Icons } from '../components/ui/Icons';

const FAQS = [
  { q: '¿Cómo abro un turno?', a: 'Ingresá tu PIN de 4 dígitos en la pantalla de inicio. Si no tenés turno abierto, pedile a un administrador que te asigne uno desde Configuración > Usuarios.' },
  { q: '¿Cómo agrego un producto al stock?', a: 'Andá a Inventario y usá el botón "Agregar Producto". Podés escanear el código de barras o ingresarlo manualmente.' },
  { q: '¿Cómo imprimo un ticket?', a: 'Las impresiones se configuran en Configuración > Impresión. Podés imprimir por ventana del navegador o por QZ Tray para impresión térmica directa.' },
  { q: '¿Cómo manejo ventas offline?', a: 'Si perdés conexión, las ventas se guardan automáticamente y se sincronizan cuando vuelvas a estar online. Podés ver el estado en el panel de sincronización.' },
  { q: '¿Cómo cambio mi plan?', a: 'Andá a "Mi Plan" en el menú lateral. Ahí podés ver los planes disponibles y contactarnos para hacer el upgrade.' },
  { q: '¿Cómo exporto reportes?', a: 'En Reportes, seleccioná el período y usá los botones de exportación a Excel. Disponible en planes Pro e IA.' },
];

function ChevronDown() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
}

function ChevronUp() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;
}

export default function SoportePage() {
  const { backend, currentPlan, trialDaysRemaining, isTrialExpired, trialEndDateFormatted, backendError } = usePanelContext();
  const [openFaq, setOpenFaq] = useState(null);

  const planLabel = { trial: 'Trial', simple: 'Simple', pro: 'Pro', ia: 'IA' }[currentPlan] || 'Trial';

  const toggleFaq = (idx) => setOpenFaq(openFaq === idx ? null : idx);

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}><Icons.HelpCircle /> Soporte</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>Centro de ayuda y contacto</p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 32, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ marginBottom: 12, color: 'var(--accent-primary)' }}><Icons.MessageCircle /></div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Hablanos por WhatsApp</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0', fontSize: '0.9rem' }}>
            Respondemos en menos de 5 minutos en horario comercial
          </p>
          <a href={WHATSAPP_LINK('Hola Necesito ayuda con MiNegocio')}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--gradient-primary)',
              color: 'white',
              padding: '14px 32px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Contactar por WhatsApp
          </a>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}><Icons.Star /> Mi Plan</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Plan actual</span>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {planLabel}
                {currentPlan === 'trial' && !isTrialExpired && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(20,187,166,0.1)', color: 'var(--accent-primary)', padding: '2px 10px', borderRadius: 10, fontWeight: 600 }}>Prueba {trialDaysRemaining > 0 ? `${trialDaysRemaining}d` : 'hoy'}</span>
                )}
                {isTrialExpired && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', padding: '2px 10px', borderRadius: 10, fontWeight: 600 }}>Expirado</span>
                )}
                {(currentPlan === 'pro' || currentPlan === 'ia') && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-success)', padding: '2px 10px', borderRadius: 10, fontWeight: 600 }}>Activo</span>
                )}
              </div>
            </div>
            <a href="/panel/plan"
              style={{ background: 'var(--gradient-primary)', color: 'white', textDecoration: 'none', padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem' }}>
              {currentPlan === 'trial' ? 'Ver Planes' : 'Gestionar'}
            </a>
          </div>
          {currentPlan === 'trial' && trialDaysRemaining > 0 && trialEndDateFormatted && (
            <div style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <Icons.Calendar /> Periodo de prueba termina el <strong style={{ color: 'var(--text-primary)' }}>{trialEndDateFormatted}</strong>.
            </div>
          )}
          {isTrialExpired && (
            <div style={{ marginTop: 12, color: 'var(--accent-danger)', fontSize: '0.85rem', background: 'rgba(239,68,68,0.08)', padding: '10px 14px', borderRadius: 8 }}>
              <Icons.Lock /> Tu prueba gratuita finalizo. Algunas funciones avanzadas estan deshabilitadas.
            </div>
          )}
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Preguntas Frecuentes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <button onClick={() => toggleFaq(i)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, textAlign: 'left' }}>
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp /> : <ChevronDown />}
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 0 14px 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Estado del Sistema</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Versión</span>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>1.0.0</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Backend</span>
              <div style={{ fontWeight: 700, color: backend.backendStatus?.status === 'ok' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                {backend.backendStatus?.status === 'ok' ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

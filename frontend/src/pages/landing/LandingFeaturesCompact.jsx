import { Reveal } from './hooks/useReveal';

/**
 * Tira compacta de beneficios — SOLO mobile. "¿Qué me resuelve?" en 5 segundos,
 * antes del precio, sin el peso de la sección Features completa (que queda plegada).
 */
const ITEMS = [
  {
    title: 'Cobrás en segundos',
    desc: 'Escaneás y listo, el vuelto se calcula solo',
    icon: (
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3M17 13l2 2M9 20a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" />
    ),
  },
  {
    title: 'Controlás el stock',
    desc: 'Precios y cantidades siempre al día',
    icon: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  },
  {
    title: 'Sabés cuánto ganás',
    desc: 'Reportes claros de ventas y ganancia',
    icon: <path d="M9 19v-6H5v6zM15 19V9h-4v10zM21 19V5h-4v14z" />,
  },
  {
    title: 'Fiados sin cuaderno',
    desc: 'Quién te debe y cuánto, sin perder plata',
    icon: <path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />,
  },
];

export default function LandingFeaturesCompact() {
  return (
    <section className="lp-section" style={{ padding: '20px 16px 8px' }} aria-label="Beneficios principales">
      <Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 480, margin: '0 auto' }}>
          {ITEMS.map(it => (
            <div key={it.title} className="lp-glass" style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: 'var(--lp-primary)' }}>
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  {it.icon}
                </svg>
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--lp-text)', lineHeight: 1.2 }}>{it.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(230,255,251,0.6)', lineHeight: 1.35 }}>{it.desc}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

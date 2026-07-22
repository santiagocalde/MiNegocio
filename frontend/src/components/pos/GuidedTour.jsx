import React, { useState, useEffect, useRef, useCallback } from 'react';

const STEPS = [
  {
    id: 'inicio-stats',
    title: 'Tu panel de control',
    text: 'Acá ves todo de un vistazo: cuánto vendiste hoy, cuánto hay en efectivo y el ticket promedio de tus ventas.',
    Icon: () => (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    placement: 'bottom',
  },
  {
    id: 'inicio-vender',
    title: 'Empezá a cobrar',
    text: 'Tocá acá para ir al Punto de Venta. Ahí escaneás productos, cobrás y manejás todo en segundos.',
    Icon: () => (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    ),
    placement: 'left',
  },
  {
    id: 'inicio-stock',
    title: 'No te quedes sin stock',
    text: 'Acá ves los productos que se están por agotar. Tocá "Ver inventario" para cargar más stock o agregar productos nuevos.',
    Icon: () => (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
    placement: 'left',
  },
  {
    id: 'sidebar-nav',
    title: 'Todo desde el menu',
    text: 'El menu te lleva a Punto de Venta, Fiados, Inventario y Reportes. Fijate en Fiados: ahi anotas lo que te deben sin perder plata.',
    Icon: () => (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
    ),
    placement: 'right',
  },
  {
    id: 'sidebar-bottom',
    title: 'Listo para arrancar',
    text: 'Cuando termines el dia, cerra la caja para llevar el control de lo que vendiste. Podes volver a ver este tour desde Ayuda.',
    Icon: () => (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    placement: 'right',
  },
];

export default function GuidedTour({ onClose }) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [rect, setRect] = useState(null);
  const timerRef = useRef(null);

  const current = STEPS[step];
  const ToolIcon = current.Icon;

  const calc = useCallback(() => {
    const el = document.querySelector('[data-tour="' + current.id + '"]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect(r);
    const tw = 340, th = 220, gap = 16;
    let top = 0, left = 0;
    if (current.placement === 'bottom') {
      top = r.bottom + gap;
      left = Math.max(16, r.left + r.width / 2 - tw / 2);
    } else if (current.placement === 'left') {
      top = Math.max(16, r.top + r.height / 2 - th / 2);
      left = Math.max(16, r.left - tw - gap);
    } else {
      top = Math.max(16, r.top + r.height / 2 - th / 2);
      left = Math.min(window.innerWidth - tw - 16, r.right + gap);
    }
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
    if (top < 8) top = 8;
    if (left < 8) left = 8;
    setPos({ top, left });
  }, [current]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(calc, 80);
    const el = document.querySelector('[data-tour="' + current.id + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const onResize = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(calc, 50); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [step, calc, current]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { try { localStorage.setItem('guided_tour_completed', 'true'); } catch {} onClose(); }
      if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setStep(s => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const finish = () => {
    try { localStorage.setItem('guided_tour_completed', 'true'); } catch {}
    onClose();
  };

  const btnBase = {
    border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem',
    cursor: 'pointer', padding: '8px 18px', transition: 'all .2s',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, fontFamily: 'inherit' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <mask id="tmask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect x={rect.x - 6} y={rect.y - 6} width={rect.width + 12} height={rect.height + 12} fill="black" rx="10" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(5,8,18,0.85)" mask="url(#tmask)" onClick={finish} />
        {rect && (
          <rect x={rect.x - 6} y={rect.y - 6} width={rect.width + 12} height={rect.height + 12}
            fill="none" stroke="rgba(20,187,166,0.55)" strokeWidth="2.5" rx="10" />
        )}
      </svg>

      <div style={{
        position: 'absolute', top: pos.top, left: pos.left, width: 340,
        background: 'var(--bg-card, #0B132B)',
        border: '1px solid rgba(20,187,166,0.25)', borderRadius: 16,
        padding: '24px 22px 20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(20,187,166,0.08)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      }}>
        <div style={{ color: '#14BBA6', marginBottom: 12, opacity: 0.9 }}><ToolIcon /></div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= step ? '#14BBA6' : 'rgba(255,255,255,0.1)',
              transition: 'background .3s',
            }} />
          ))}
        </div>

        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Paso {step + 1} de {STEPS.length}
        </div>

        <h3 style={{ color: '#F1F5F9', fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.2px' }}>
          {current.title}
        </h3>

        <p style={{ color: '#94A3B8', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 20px' }}>
          {current.text}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={finish}
            style={{ ...btnBase, background: 'transparent', color: 'rgba(255,255,255,0.5)', padding: '8px 12px', fontSize: '0.8rem' }}>
            Saltar tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ ...btnBase, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1' }}>
                Anterior
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                style={{ ...btnBase, background: 'linear-gradient(135deg,#14BBA6,#0F8A7D)', color: '#fff' }}>
                Siguiente
              </button>
            ) : (
              <button onClick={finish}
                style={{ ...btnBase, background: 'linear-gradient(135deg,#14BBA6,#0F8A7D)', color: '#fff' }}>
                ¡Listo, a vender!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

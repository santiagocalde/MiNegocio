import { useState, useEffect } from 'react';
import { Reveal } from './hooks/useReveal';

import imgInicio from '../../assets/landing/inicio.webp';
import imgPos from '../../assets/landing/punto-de-venta.webp';
import imgInventario from '../../assets/landing/inventario.webp';
import imgReportes from '../../assets/landing/reportes.webp';
import imgFiados from '../../assets/landing/fiados.webp';
import imgCompras from '../../assets/landing/compras.webp';
import imgProveedores from '../../assets/landing/proveedores.webp';
import imgPromociones from '../../assets/landing/promociones.webp';

const SCREENS = [
  { src: imgInicio,      name: 'Inicio',         desc: 'Ventas del día, efectivo en caja y ticket promedio de un vistazo.', alt: 'Panel de inicio de MiNegocio: ventas del día, efectivo en caja y ticket promedio de un kiosco' },
  { src: imgPos,         name: 'Punto de Venta', desc: 'Cobrá en segundos. Escaneás, elegís el pago y el vuelto se calcula solo.', alt: 'Punto de venta (POS) de MiNegocio con productos en el carrito y total a cobrar destacado' },
  { src: imgInventario,  name: 'Inventario',     desc: 'Stock, precios y categorías ordenados y siempre actualizados.', alt: 'Inventario de productos de MiNegocio con categorías, precios y estado de stock' },
  { src: imgReportes,    name: 'Reportes',       desc: 'Cuánto vendiste, con qué método de pago y qué producto sale más.', alt: 'Reportes de ventas de MiNegocio con ingresos, métodos de pago y producto más vendido' },
  { src: imgFiados,      name: 'Fiados',         desc: 'Quién te debe y cuánto, sin cuaderno y sin perder plata.', alt: 'Gestión de fiados de MiNegocio mostrando clientes y saldos deudores' },
  { src: imgCompras,     name: 'Compras',        desc: 'Cargá las facturas de tus proveedores y actualizá el stock al instante.', alt: 'Gestión de compras de MiNegocio con facturas de proveedores cargadas' },
  { src: imgProveedores, name: 'Proveedores',    desc: 'Todos tus proveedores y lo que les debés, en un solo lugar.', alt: 'Listado de proveedores de MiNegocio con datos de contacto y deuda' },
  { src: imgPromociones, name: 'Promociones',    desc: 'Armá combos y descuentos en un minuto para vender más.', alt: 'Promociones de MiNegocio con combos 2x1 y descuentos por porcentaje' },
];

const ROTATE_MS = 4500;

export default function LandingShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [reduceMotion] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (paused || zoom || reduceMotion) return;
    const t = setInterval(() => setActive(a => (a + 1) % SCREENS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, zoom, active, reduceMotion]);

  // Lightbox: navegación por teclado y cierre con Escape
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setZoom(false);
      else if (e.key === 'ArrowRight') setActive(a => (a + 1) % SCREENS.length);
      else if (e.key === 'ArrowLeft') setActive(a => (a - 1 + SCREENS.length) % SCREENS.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const go = (i) => setActive((i + SCREENS.length) % SCREENS.length);
  const openZoom = () => { if (typeof window !== 'undefined' && window.innerWidth >= 768) setZoom(true); };
  const cur = SCREENS[active];

  return (
    <section id="sistema" className="lp-section" style={{ padding: '90px 24px' }}>
      <div className="lp-container">
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 100, background: 'rgba(20,187,166,0.1)', border: '1px solid rgba(20,187,166,0.2)', color: 'var(--lp-primary)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 18 }}>
              El sistema por dentro
            </span>
            <h2 className="lp-section-title" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Mirá cómo se ve trabajando</h2>
            <p className="lp-section-sub" style={{ fontSize: '1.1rem', color: 'rgba(230,255,251,0.65)', maxWidth: 620, margin: '0 auto' }}>
              Todo lo que necesitás para tu kiosco en una sola pantalla, simple y clara. Pasá por cada módulo.
            </p>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="lp-showcase-wrap" style={{ margin: '0 auto' }}
            onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

            {/* Tabs (solo celular; en PC se navega con flechas/dots/zoom) */}
            <div className="lp-showcase-tabs" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
              {SCREENS.map((s, i) => (
                <button key={s.name} onClick={() => go(i)}
                  aria-label={`Ver ${s.name}`} aria-pressed={i === active}
                  style={{
                    padding: '7px 15px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                    transition: 'all 0.2s', border: '1px solid',
                    borderColor: i === active ? 'rgba(20,187,166,0.4)' : 'rgba(255,255,255,0.08)',
                    background: i === active ? 'var(--lp-gradient-main)' : 'rgba(255,255,255,0.02)',
                    color: i === active ? '#fff' : 'var(--lp-text-muted)',
                  }}>
                  {s.name}
                </button>
              ))}
            </div>

            {/* Mockup (con barra de navegador en celular; en PC se muestra discreto, solo la imagen) */}
            <div className="lp-glass lp-showcase-mockup" style={{ overflow: 'hidden', padding: 0 }}>
              <div className="lp-showcase-chrome" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(230,255,251,0.45)', background: 'rgba(0,0,0,0.2)', padding: '3px 14px', borderRadius: 6, fontFamily: 'var(--lp-font-mono, monospace)' }}>
                    mi-negocio.app/panel
                  </span>
                </div>
              </div>
              <div className="lp-showcase-stage" onClick={openZoom}>
                {/* Todas apiladas: se precargan una vez y el cambio es un crossfade instantáneo (sin parpadeo) */}
                {SCREENS.map((s, i) => (
                  <img key={s.name} src={s.src} alt={s.alt} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" width="1366" height="768"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top',
                             opacity: i === active ? 1 : 0, transition: reduceMotion ? 'none' : 'opacity 0.5s ease', pointerEvents: 'none' }} />
                ))}
                {/* Flechas laterales discretas (solo PC) */}
                <button className="lp-showcase-side-arrow lp-showcase-side-left" aria-label="Anterior"
                  onClick={(e) => { e.stopPropagation(); go(active - 1); }}>‹</button>
                <button className="lp-showcase-side-arrow lp-showcase-side-right" aria-label="Siguiente"
                  onClick={(e) => { e.stopPropagation(); go(active + 1); }}>›</button>
              </div>
            </div>

            {/* Caption + flechas debajo: SOLO celular (en PC las flechas van sobre la imagen) */}
            <div className="lp-showcase-caption-row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 18 }}>
              <button onClick={() => go(active - 1)} aria-label="Anterior" className="lp-show-arrow"
                style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'var(--lp-text)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>‹</button>
              <div style={{ textAlign: 'center', flex: 1, minHeight: 44 }}>
                <div style={{ fontWeight: 700, color: 'var(--lp-text)', fontSize: '1rem' }}>{cur.name}</div>
                <div style={{ color: 'rgba(230,255,251,0.6)', fontSize: '0.9rem', marginTop: 2 }}>{cur.desc}</div>
              </div>
              <button onClick={() => go(active + 1)} aria-label="Siguiente" className="lp-show-arrow"
                style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'var(--lp-text)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>›</button>
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 16 }}>
              {SCREENS.map((s, i) => (
                <button key={s.name} onClick={() => go(i)} aria-label={`Ir a ${s.name}`}
                  style={{ width: i === active ? 22 : 7, height: 7, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s', background: i === active ? 'var(--lp-primary)' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Lightbox: al hacer click la imagen se agranda un poco para mirarla y moverse entre módulos */}
      {zoom && (
        <div className="lp-showcase-lightbox" onClick={() => setZoom(false)} role="dialog" aria-modal="true" aria-label={`Vista ampliada: ${cur.name}`}>
          <button className="lp-lightbox-close" onClick={() => setZoom(false)} aria-label="Cerrar">✕</button>
          <button className="lp-lightbox-arrow lp-lightbox-prev" aria-label="Anterior"
            onClick={(e) => { e.stopPropagation(); go(active - 1); }}>‹</button>
          <figure className="lp-lightbox-fig" onClick={(e) => e.stopPropagation()}>
            <img src={cur.src} alt={cur.alt} />
            <figcaption>{cur.name}</figcaption>
          </figure>
          <button className="lp-lightbox-arrow lp-lightbox-next" aria-label="Siguiente"
            onClick={(e) => { e.stopPropagation(); go(active + 1); }}>›</button>
        </div>
      )}
    </section>
  );
}

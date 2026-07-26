import { useState } from 'react';

/**
 * En MOBILE oculta a sus hijos detrás de un botón "Ver más" para no agobiar al
 * visitante que llega scrolleando (la mayoría viene de redes en el celu). En
 * DESKTOP es transparente: el wrapper usa `display:contents`, así no altera el
 * layout ni el orden — la vista de escritorio queda idéntica.
 *
 * El contenido SIEMPRE está en el DOM (solo se oculta con CSS), así no se pierde
 * para SEO ni para el que decide desplegarlo.
 */
export default function MobileCollapse({ children, label = 'Ver todo lo que incluye' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`lp-mobile-more${open ? ' is-open' : ''}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        {label}
        <span aria-hidden="true" style={{ marginLeft: 8 }}>↓</span>
      </button>
      <div className={`lp-mobile-collapse${open ? ' is-open' : ''}`}>
        {children}
      </div>
    </>
  );
}

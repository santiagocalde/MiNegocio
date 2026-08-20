import { useState, useEffect, useRef } from 'react';

// Duración de la animación de salida — debe coincidir con
// modalOverlayOut/modalContentOut en index.css.
const EXIT_MS = 160;

/**
 * Retiene un modal montado durante la animación de salida en vez de
 * desmontarlo de golpe. React normalmente saca el nodo del DOM apenas
 * `isOpen` pasa a false, sin darle tiempo a ninguna transición CSS de
 * correr — este hook resuelve eso.
 *
 * Uso:
 *   const { rendered, closing } = useModalExit(showX);
 *   if (!rendered) return null;
 *   <div className={`modal-overlay${closing ? ' closing' : ''}`}>...
 */
export default function useModalExit(isOpen) {
  const [rendered, setRendered] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      clearTimeout(timerRef.current);
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      // Estaba abierto y se pidió cerrar: reproducimos la salida antes
      // de desmontar de verdad.
      setClosing(true);
      timerRef.current = setTimeout(() => {
        setRendered(false);
        setClosing(false);
      }, EXIT_MS);
    }
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return { rendered, closing };
}

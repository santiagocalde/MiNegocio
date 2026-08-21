import { useState, useEffect, useRef } from 'react';

// Duración de la animación de salida — debe coincidir con
// modalOverlayOut/modalContentOut en index.css.
const EXIT_MS = 160;

// Helpers para modales con estilos inline (no usan las clases compartidas
// .modal-overlay/.modal-content). Reutilizan los mismos @keyframes globales
// de index.css, así que el efecto es idéntico en todo el sistema.
//   style={{ ...overlayAnim(closing), background: '...' }}
export const overlayAnim = (closing) => ({
  animation: closing ? 'modalOverlayOut 0.16s ease-in forwards' : 'modalOverlayIn 0.16s ease-out',
});
export const contentAnim = (closing) => ({
  animation: closing ? 'modalContentOut 0.16s cubic-bezier(0.4, 0, 1, 1) forwards' : 'modalContentIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
});

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

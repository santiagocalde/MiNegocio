import { useState, useEffect, useRef } from 'react';

// Duración de la animación de salida — debe coincidir con
// modalOverlayOut/modalContentOut en index.css.
const EXIT_MS = 160;

// Bloqueo del scroll de fondo mientras hay algún modal abierto. Sin esto, al
// pasar la rueda del mouse sobre el modal se scrollea lo que hay DETRÁS, y al
// cerrar el modal quedás en una posición rara ("se buguea y queda ahí"). El
// scroll del panel no está en <body> sino en <main>, así que en vez de tocar
// body.style.overflow ponemos la clase `modal-open` en <body> y el CSS congela
// tanto el body (páginas públicas) como el <main> del panel. Un contador global
// soporta modales anidados: se libera recién al cerrar el último.
let _openModals = 0;
function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (_openModals === 0) document.body.classList.add('modal-open');
  _openModals += 1;
}
function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  _openModals = Math.max(0, _openModals - 1);
  if (_openModals === 0) document.body.classList.remove('modal-open');
}

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

  // Bloqueo del scroll de fondo mientras el modal está montado (incluye la
  // ventana de animación de salida). Se libera al desmontar, con seguridad
  // ante cierres abruptos gracias al cleanup.
  useEffect(() => {
    if (!rendered) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [rendered]);

  return { rendered, closing };
}

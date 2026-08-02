import { useState, useEffect } from 'react';

/**
 * Devuelve true cuando el viewport es <= breakpoint (mobile).
 * Usa matchMedia (barato, sin escuchar resize continuo) con cleanup.
 * El estado inicial se calcula una sola vez (lazy) para no parpadear.
 */
export default function useIsMobile(breakpoint = 768) {
  // El OR con max-height agarra el celular en horizontal (ancho > breakpoint
  // pero pantalla baja), así el modo mobile aplica en las dos orientaciones.
  const query = `(max-width: ${breakpoint}px), (max-height: 500px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}

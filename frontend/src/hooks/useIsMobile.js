import { useState, useEffect } from 'react';

/**
 * Devuelve true cuando el viewport es <= breakpoint (mobile).
 * Usa matchMedia (barato, sin escuchar resize continuo) con cleanup.
 * El estado inicial se calcula una sola vez (lazy) para no parpadear.
 */
export default function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px)`;
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

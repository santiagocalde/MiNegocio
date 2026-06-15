import { useRef, useEffect } from 'react';

let sharedObserver = null;
let observedElements = 0;

function getObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('lp-visible');
          sharedObserver.unobserve(entry.target);
          observedElements--;
        }
      });
    }, { threshold: 0.1 });
  }
  return sharedObserver;
}

function observe(el) {
  if (!el) return;
  const obs = getObserver();
  obs.observe(el);
  observedElements++;
}

function unobserve(el) {
  if (!el) return;
  if (sharedObserver) {
    sharedObserver.unobserve(el);
    observedElements--;
  }
}

export function useReveal() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    observe(el);
    return () => {
      unobserve(el);
    };
  }, []);

  return ref;
}

export function Reveal({ children, delay = 0, className = '', style }) {
  const ref = useReveal();
  const cls = `lp-reveal${delay ? ` lp-reveal-d${delay}` : ''}${className ? ` ${className}` : ''}`;
  return <div ref={ref} className={cls} style={style}>{children}</div>;
}

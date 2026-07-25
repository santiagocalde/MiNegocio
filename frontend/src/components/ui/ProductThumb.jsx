import { useState } from 'react';

/**
 * Miniatura de producto. Muestra la foto (p.image_url) si existe y carga bien;
 * si no hay imagen o falla la carga, cae a un placeholder de ícono. Pensado para
 * ocupar poco: tamaño fijo chico, object-fit contain y carga lazy.
 */
export default function ProductThumb({ src, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const box = {
    width: size, height: size, minWidth: size, flexShrink: 0,
    background: 'rgba(255,255,255,0.05)', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-secondary)', overflow: 'hidden',
  };
  const showImg = src && !failed;
  return (
    <div style={box}>
      {showImg ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )}
    </div>
  );
}

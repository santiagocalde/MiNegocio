export default function WhatsAppButton({ logoImg }) {
  return (
    <a
      href="https://wa.me/5491144276384"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 16,
        zIndex: 9998,
        width: 56,
        height: 56,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(37, 211, 102, 0.4)',
        cursor: 'pointer',
        overflow: 'hidden',
        background: '#fff',
        /* Impide scroll horizontal al deslizar sobre el botón en mobile */
        touchAction: 'pan-y',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <img
        src={logoImg}
        alt=""
        loading="lazy"
        style={{ width: '115%', height: '115%', objectFit: 'cover', pointerEvents: 'none' }}
      />
    </a>
  );
}

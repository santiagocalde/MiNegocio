export default function WhatsAppButton({ logoImg }) {
  return (
    <a
      href="https://wa.me/5491144276384"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="lp-whatsapp-btn"
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

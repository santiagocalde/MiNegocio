export default function WhatsAppButton({ logoImg }) {
  return (
    <a href="https://wa.me/5491144276384" target="_blank" rel="noopener noreferrer" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9998, width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37, 211, 102, 0.4)', transition: 'transform 0.2s', cursor: 'pointer', overflow: 'hidden', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      <img src={logoImg} alt="Contactar por WhatsApp" loading="lazy" style={{ width: '115%', height: '115%', objectFit: 'cover' }} />
    </a>
  );
}

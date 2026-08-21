import { useState } from 'react';
import useModalExit, { overlayAnim, contentAnim } from '../../hooks/useModalExit';

const Svg = {
  X: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>,
  ArrowLeft: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 12H5m0 0l7 7m-7-7l7-7" /></svg>,
};

export default function ForgotPasswordModal({ showForgotPassword, setShowForgotPassword, setShowLoginModal }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch { /* el endpoint siempre responde ok por seguridad */ }
    setLoading(false);
  };

  const { rendered, closing } = useModalExit(showForgotPassword);
  if (!rendered) return null;

  const inputStyle = {
    width: '100%', padding: '14px 16px',
    background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)',
    borderRadius: 12, color: 'var(--lp-ink)', outline: 'none',
    fontSize: '0.95rem', transition: 'border-color 0.2s',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,19,43,0.85)', backdropFilter: 'blur(20px)', padding: 20, ...overlayAnim(closing) }}
      onMouseDown={e => { if (e.target === e.currentTarget) { setShowForgotPassword(false); } }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 24, padding: '36px', position: 'relative', boxShadow: 'var(--lp-shadow-lg)', ...contentAnim(closing) }}>
        <button onClick={() => setShowForgotPassword(false)}
          style={{ position: 'absolute', top: 18, right: 18, background: 'var(--lp-paper-sunken)', border: 'none', color: 'var(--lp-ink-faint)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--lp-ink)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-ink-faint)'; }}>
          <Svg.X />
        </button>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--lp-ink)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>¡Correo enviado!</h2>
            <p style={{ color: 'var(--lp-ink-soft)', fontSize: '0.9rem', marginBottom: 12, lineHeight: 1.6 }}>
              Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.
            </p>
            <p style={{ color: 'var(--lp-ink-faint)', fontSize: '0.8rem', marginBottom: 24 }}>
              Revisá la bandeja de spam si no lo ves.
            </p>
            <button onClick={() => { setShowForgotPassword(false); setShowLoginModal('login'); }}
              className="lp-btn lp-btn--primary" style={{ padding: '14px 32px' }}>
              Volver al inicio
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <button onClick={() => { setShowForgotPassword(false); setShowLoginModal('login'); }}
                style={{ background: 'var(--lp-paper-sunken)', border: 'none', color: 'var(--lp-ink-faint)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--lp-ink)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-ink-faint)'; }}>
                <Svg.ArrowLeft />
              </button>
              <h2 style={{ color: 'var(--lp-ink)', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>Recuperar contraseña</h2>
            </div>
            <p style={{ color: 'var(--lp-ink-faint)', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.5 }}>
              Ingresá tu email y te enviamos un enlace para crear una nueva contraseña.
            </p>
            <label style={{ fontSize: '0.85rem', color: 'var(--lp-ink-soft)', fontWeight: 500, marginBottom: 8, display: 'block' }}>Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@kiosco.com"
              style={inputStyle} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'var(--lp-line-strong)'} />
            <button onClick={handleSend} disabled={loading}
              className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: 700, borderRadius: 12, marginTop: 24, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

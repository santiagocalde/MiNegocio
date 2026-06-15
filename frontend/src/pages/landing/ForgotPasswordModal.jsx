import { useState } from 'react';

const Svg = {
  Mail: () => <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
  CheckCircle: () => <svg width="48" height="48" fill="none" stroke="#10b981" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  X: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>,
  ArrowLeft: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>,
};

export default function ForgotPasswordModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email || !email.includes('@')) {
      setError('Ingresá un correo electrónico válido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8005';
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        setStep(2);
      } else {
        const data = await res.json();
        throw new Error(data.detail || 'No pudimos enviar el correo.');
      }
    } catch (err) {
      setError(err.message || 'Error de conexion. Intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,58,95,0.85)', backdropFilter: 'blur(20px)', padding: 20, animation: 'fadeIn 0.2s ease' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'linear-gradient(145deg, rgba(11,19,43,0.95) 0%, rgba(30,58,95,0.95) 100%)', border: '1px solid rgba(20,187,166,0.15)', borderRadius: 24, padding: '40px 36px 32px', position: 'relative', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--lp-text-muted)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}>
          <Svg.X />
        </button>

        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(20,187,166,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(20,187,166,0.2)', color: 'var(--lp-primary)' }}>
              <Svg.Mail />
            </div>
            <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>Recuperar contraseña</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.5 }}>
              Ingresá tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontWeight: 500, fontSize: '0.85rem' }}>{error}</div>}

            <div style={{ marginBottom: 20 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="nombre@kiosco.com"
                autoFocus
                style={{ width: '100%', padding: '14px 16px', background: 'rgba(30,58,95,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', outline: 'none', fontSize: '0.95rem', transition: 'all 0.2s' }}
                onFocus={e => { e.target.style.borderColor = 'var(--lp-primary)'; e.target.style.background = 'rgba(30,58,95,0.5)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(30,58,95,0.3)' }}
              />
            </div>

            <button onClick={handleSend} disabled={loading} style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(90deg, var(--lp-primary), var(--lp-secondary))', color: loading ? 'var(--lp-text-muted)' : '#fff', fontSize: '1.05rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 8px 24px rgba(20,187,166, 0.3)', transition: 'all 0.2s' }}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>

            <button onClick={onClose} style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--lp-text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 500, padding: 0 }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>
              <Svg.ArrowLeft /> Volver al inicio de sesión
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <Svg.CheckCircle />
            </div>
            <h2 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>¡Correo enviado!</h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 24 }}>
              Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
            </p>
            <p style={{ color: 'rgba(230,255,251,0.4)', fontSize: '0.8rem', marginBottom: 24 }}>
              Revisá tu bandeja de entrada y la carpeta de spam.
            </p>
            <button onClick={onClose} className="lp-btn lp-btn--ghost" style={{ padding: '10px 28px', fontSize: '0.85rem' }}>
              Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

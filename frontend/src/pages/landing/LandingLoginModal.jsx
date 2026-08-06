import { useState, useEffect } from 'react';

const Svg = {
  X: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>,
};

export default function LandingLoginModal({
  showLoginModal, setShowLoginModal, setShowForgotPassword,
  loginName, setLoginName, loginEmail, setLoginEmail,
  loginPassword, setLoginPassword, showPassword, setShowPassword,
  loginLoading, loginError, handleAuthSubmit
}) {
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    setTermsAccepted(false);
  }, [showLoginModal]);

  if (!showLoginModal) return null;

  const isRegister = showLoginModal === 'register';
  const canSubmit = !loginLoading && (!isRegister || termsAccepted);

  const inputStyle = {
    width: '100%', padding: '14px 16px', marginTop: 6,
    background: 'var(--lp-paper-sunken)', border: '1px solid var(--lp-line-strong)',
    borderRadius: 12, color: 'var(--lp-ink)', outline: 'none',
    fontSize: '0.95rem', transition: 'border-color 0.2s',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,19,43,0.85)', backdropFilter: 'blur(20px)', padding: 20, animation: 'fadeIn 0.2s ease' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false); }}
      onKeyDown={(e) => { if (e.key === 'Escape') setShowLoginModal(false); }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line-strong)', borderRadius: 24, padding: '40px 40px 32px', position: 'relative', boxShadow: 'var(--lp-shadow-lg)' }}
      >
        <button
          onClick={() => setShowLoginModal(false)}
          style={{ position: 'absolute', top: 20, right: 20, background: 'var(--lp-paper-sunken)', border: 'none', color: 'var(--lp-ink-faint)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'color 0.18s, transform 0.18s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--lp-ink)'; e.currentTarget.style.background = 'var(--lp-primary-wash)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-ink-faint)'; e.currentTarget.style.background = 'var(--lp-paper-sunken)'; }}
        >
          <Svg.X />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--lp-primary-wash)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--lp-primary-glow)' }}>
            <svg width="24" height="24" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h2 style={{ color: 'var(--lp-ink)', fontFamily: 'var(--lp-font-display)', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {isRegister ? 'Creá tu cuenta' : 'Bienvenido'}
            </h2>
            <p style={{ color: 'var(--lp-ink-faint)', fontSize: '0.9rem', marginTop: 4 }}>
              O{' '}
              <span onClick={() => setShowLoginModal(isRegister ? 'login' : 'register')} style={{ color: 'var(--lp-primary-ink)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                {isRegister ? 'iniciá sesión' : 'registrate gratis'}
              </span>
            </p>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          {loginError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600, textAlign: 'center', fontSize: '0.9rem' }}>
              {loginError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {isRegister && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--lp-ink-soft)', fontWeight: 500 }}>Tu Nombre</label>
                <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Ej: Carlos"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'var(--lp-line-strong)'} />
              </div>
            )}
            <label style={{ fontSize: '0.85rem', color: 'var(--lp-ink-soft)', fontWeight: 500 }}>Correo electrónico</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="nombre@kiosco.com"
              style={inputStyle} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'var(--lp-line-strong)'} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: isRegister ? 20 : 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--lp-ink-soft)', fontWeight: 500 }}>Contraseña</label>
              {!isRegister && (
                <span onClick={() => { setShowLoginModal(false); setShowForgotPassword(true); }}
                  style={{ color: 'var(--lp-primary-ink)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>
                  ¿Olvidaste tu contraseña?
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••"
                style={inputStyle} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'var(--lp-line-strong)'} />
              <div
                style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--lp-ink-faint)', zIndex: 10 }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword
                  ? <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  : <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                }
              </div>
            </div>
          </div>

          {isRegister && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24, cursor: 'pointer' }} onClick={() => setTermsAccepted(v => !v)}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, border: `2px solid ${termsAccepted ? 'var(--lp-primary)' : 'var(--lp-line-strong)'}`,
                background: termsAccepted ? 'var(--lp-primary-wash)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1, transition: 'all 0.2s'
              }}>
                {termsAccepted && (
                  <svg width="12" height="12" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--lp-ink-faint)', lineHeight: 1.5, userSelect: 'none' }}>
                Leí y acepto los{' '}
                <span onClick={e => { e.stopPropagation(); window.open('/terminos', '_blank'); }} style={{ color: 'var(--lp-primary-ink)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  Términos y Condiciones
                </span>
                {' '}y la{' '}
                <span onClick={e => { e.stopPropagation(); window.open('/privacidad', '_blank'); }} style={{ color: 'var(--lp-primary-ink)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  Política de Privacidad
                </span>
                , incluyendo el tratamiento de mis datos personales según la Ley 25.326.
              </span>
            </label>
          )}

          <button
            onClick={handleAuthSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '16px', borderRadius: 12, border: 'none',
              background: canSubmit ? 'linear-gradient(90deg, var(--lp-primary), var(--lp-primary-ink))' : 'var(--lp-paper-sunken)',
              color: canSubmit ? '#fff' : 'var(--lp-ink-faint)',
              fontSize: '1.05rem', fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 8px 24px var(--lp-primary-glow)' : 'none',
              transition: 'transform 0.18s, box-shadow 0.18s'
            }}
            onMouseEnter={e => { if (canSubmit) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { if (canSubmit) e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {loginLoading ? 'Procesando...' : (isRegister ? 'Crear mi cuenta' : 'Entrar a mi cuenta')}
          </button>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          localStorage.setItem('saas_token', 'preview-token');
          localStorage.setItem('saas_mode', 'preview');
          localStorage.setItem('minegocio_current_operator', 'Vista Previa');
          localStorage.setItem('minegocio_current_turn_id', 'preview-turn');
          window.location.href = '/panel?preview=true';
        }}
        style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 100, border: '1px solid var(--lp-line-strong)', background: 'var(--lp-paper-sunken)', color: 'var(--lp-ink-soft)', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.18s, color 0.18s, border-color 0.18s' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--lp-primary-ink)'; e.currentTarget.style.borderColor = 'var(--lp-primary)'; e.currentTarget.style.transform = 'scale(1.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-ink-soft)'; e.currentTarget.style.borderColor = 'var(--lp-line-strong)'; e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        Probá cómo funciona
      </button>
    </div>
  );
}

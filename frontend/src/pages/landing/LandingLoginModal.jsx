const Svg = {
  X: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>,
};

export default function LandingLoginModal({
  showLoginModal, setShowLoginModal, setShowForgotPassword,
  loginName, setLoginName, loginEmail, setLoginEmail,
  loginPassword, setLoginPassword, showPassword, setShowPassword,
  loginLoading, loginError, handleAuthSubmit, goOnboard, navigate
}) {
  if (!showLoginModal) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,58,95,0.85)', backdropFilter: 'blur(20px)', padding: 20, animation: 'fadeIn 0.2s ease' }} onMouseDown={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setShowLoginModal(false); }}>
      <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(145deg, rgba(11,19,43,0.95) 0%, rgba(30,58,95,0.95) 100%)', border: '1px solid rgba(20,187,166,0.3)', borderRadius: 24, padding: '40px 40px 32px', position: 'relative', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
        <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--lp-text-muted)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}>
          <Svg.X />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(20,187,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(20,187,166,0.3)' }}>
            <svg width="24" height="24" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h2 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {showLoginModal === 'login' ? 'Bienvenido' : 'Creá tu cuenta'}
            </h2>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
              {showLoginModal === 'login' ? 'O ' : 'O '}
              <span onClick={() => setShowLoginModal(showLoginModal === 'login' ? 'register' : 'login')} style={{ color: 'var(--lp-primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                {showLoginModal === 'login' ? 'registrate gratis' : 'iniciá sesión'}
              </span>
            </p>
          </div>
        </div>
        <div style={{ marginTop: 32 }}>
          {loginError && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600, textAlign: 'center', fontSize: '0.9rem' }}>{loginError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {showLoginModal === 'register' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Tu Nombre</label>
                <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Ej: Carlos" style={{ width: '100%', padding: '14px 16px', marginTop: 6, background: 'rgba(30,58,95,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', outline: 'none', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(30,58,95,0.1)' }} onFocus={e => { e.target.style.borderColor = 'var(--lp-primary)'; e.target.style.background = 'rgba(30,58,95,0.5)' }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(30,58,95,0.3)' }} />
              </div>
            )}
            <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Correo electrónico</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="nombre@kiosco.com" style={{ width: '100%', padding: '14px 16px', background: 'rgba(30,58,95,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', outline: 'none', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(30,58,95,0.1)' }} onFocus={e => { e.target.style.borderColor = 'var(--lp-primary)'; e.target.style.background = 'rgba(30,58,95,0.5)' }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(30,58,95,0.3)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Contraseña</label>
              {showLoginModal === 'login' && (
                <span onClick={() => { setShowLoginModal(false); setShowForgotPassword(true); }} style={{ color: 'var(--lp-primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>¿Olvidaste tu contraseña?</span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '14px 16px', background: 'rgba(30,58,95,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', outline: 'none', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(30,58,95,0.1)' }} onFocus={e => { e.target.style.borderColor = 'var(--lp-primary)'; e.target.style.background = 'rgba(30,58,95,0.5)' }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(30,58,95,0.3)' }} />
              <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', zIndex: 10 }} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> : <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>}
              </div>
            </div>
          </div>
          <button onClick={handleAuthSubmit} disabled={loginLoading} style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: loginLoading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(90deg, var(--lp-primary), var(--lp-secondary))', color: loginLoading ? 'var(--lp-text-muted)' : '#fff', fontSize: '1.05rem', fontWeight: 700, cursor: loginLoading ? 'not-allowed' : 'pointer', boxShadow: loginLoading ? 'none' : '0 8px 24px rgba(20,187,166, 0.3)', transition: 'all 0.2s' }} onMouseEnter={e => { if (!loginLoading) e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { if (!loginLoading) e.currentTarget.style.transform = 'translateY(0)' }}>
            {loginLoading ? 'Procesando...' : (showLoginModal === 'login' ? 'Entrar a mi cuenta' : 'Crear mi cuenta')}
          </button>
        </div>
      </div>
      <button onClick={(e) => {
        e.stopPropagation();
        localStorage.setItem('saas_token', 'preview-token');
        localStorage.setItem('saas_mode', 'preview');
        localStorage.setItem('minegocio_current_operator', 'Vista Previa');
        localStorage.setItem('minegocio_current_turn_id', 'preview-turn');
        navigate('/preview');
      }} style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(30,58,95,0.5)', color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'scale(1.05)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(30,58,95,0.5)'; e.currentTarget.style.transform = 'scale(1)' }}>
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        Visualización previa del sistema POS
      </button>
    </div>
  );
}

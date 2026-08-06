const Svg = {
  ChevronRight: () => <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
  Bar3: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  X: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
  Sun: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" strokeWidth="2" /><path strokeLinecap="round" strokeWidth="2" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  Moon: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>,
};

export default function LandingNav({
  isScrolled, isLoggedIn, userName, showUserMenu, setShowUserMenu,
  mobileMenu, setMobileMenu, setIsLoggedIn,
  setShowLoginModal, goPanel, goOnboard, navigate, setShowContactModal,
  logoImg, activeSection, theme, toggleTheme
}) {
  const getBizName = () => {
    try {
      const data = localStorage.getItem('saas_business');
      if (data) return JSON.parse(data).business_name || userName || 'Mi Negocio';
    } catch { /* noop */ }
    return userName || 'Mi Negocio';
  };
  const bizName = getBizName();

  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 38, height: 38, borderRadius: 11, cursor: 'pointer',
        background: 'var(--lp-paper-raised)', color: 'var(--lp-ink-soft)',
        border: '1px solid var(--lp-line-strong)', transition: 'color .18s, border-color .18s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--lp-primary-ink)'; e.currentTarget.style.borderColor = 'var(--lp-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-ink-soft)'; e.currentTarget.style.borderColor = 'var(--lp-line-strong)'; }}
    >
      {theme === 'dark' ? <Svg.Sun /> : <Svg.Moon />}
    </button>
  );

  return (
    <nav className="lp-nav" style={{
      padding: '14px 40px',
      position: 'fixed',
      top: 0, left: 0, right: 0, zIndex: 100,
      background: isScrolled ? 'color-mix(in srgb, var(--lp-paper) 82%, transparent)' : 'transparent',
      backdropFilter: isScrolled ? 'blur(16px) saturate(1.4)' : 'none',
      WebkitBackdropFilter: isScrolled ? 'blur(16px) saturate(1.4)' : 'none',
      borderBottom: isScrolled ? '1px solid var(--lp-line)' : '1px solid transparent',
      transition: 'background 0.3s ease, border-color 0.3s ease'
    }}>
      <div className="lp-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
          <span onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ cursor: 'pointer', display: 'inline-block' }} aria-label="MiNegocio - Ir al inicio">
            <img src={logoImg} alt="MiNegocio" fetchpriority="high" decoding="async" style={{ height: 48, objectFit: 'contain', transform: 'scale(1.3)', transformOrigin: 'left 35%' }} />
          </span>
        </div>

        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 40, justifyContent: 'center', position: 'relative', zIndex: 10 }}>
          {['Funciones', 'Sistema', 'Planes', 'Contacto'].map(link => (
            <a key={link}
               href={link === 'Contacto' ? '#' : `#${link.toLowerCase()}`}
               className={`lp-nav-link${activeSection === link.toLowerCase() ? ' lp-nav-link--active' : ''}`}
               aria-current={activeSection === link.toLowerCase() ? 'true' : undefined}
               onClick={(e) => {
                 if (link === 'Contacto') {
                   e.preventDefault();
                   setShowContactModal(true);
                 }
               }}>
               {link}
            </a>
          ))}
          <div style={{ position: 'relative' }} className="nav-dropdown-container"
            onMouseEnter={() => { const el = document.getElementById('info-dropdown'); if (el) { el.style.opacity = '1'; el.style.pointerEvents = 'auto'; el.style.transform = 'translateX(-50%) translateY(0)'; } }}
            onMouseLeave={() => { const el = document.getElementById('info-dropdown'); if (el) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; el.style.transform = 'translateX(-50%) translateY(-10px)'; } }}>
            <button className="lp-nav-link">
              Info <Svg.ChevronRight />
            </button>
            <div id="info-dropdown" style={{ opacity: 0, pointerEvents: 'none', transform: 'translateX(-50%) translateY(-10px)', transition: 'all 0.2s', position: 'absolute', top: '100%', left: '50%', background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)', borderRadius: 14, padding: 8, display: 'flex', flexDirection: 'column', minWidth: 200, boxShadow: 'var(--lp-shadow-md)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--lp-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 12px 2px' }}>Empresa</div>
              <a onClick={(e) => { e.preventDefault(); navigate('/nosotros'); }} className="lp-dropdown-item">Sobre Nosotros</a>
              <a onClick={(e) => { e.preventDefault(); navigate('/soporte'); }} className="lp-dropdown-item">Soporte</a>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--lp-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 12px 2px' }}>Recursos</div>
              <a href="/blog/" className="lp-dropdown-item">Blog</a>
              <a href="/glosario/" className="lp-dropdown-item">Glosario</a>
              <a href="/pos-sin-internet/" className="lp-dropdown-item">Sistema sin internet</a>
              <a href="/sistema-fiados/" className="lp-dropdown-item">Control de fiados</a>
              <a href="/comparar-sistemas-para-kioscos/" className="lp-dropdown-item">Comparar sistemas</a>
            </div>
          </div>
        </div>

        <div className="nav-actions" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
          <ThemeToggle />
          {isLoggedIn ? (
            <div style={{ position: 'relative' }} onMouseLeave={() => setShowUserMenu(false)}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="lp-btn lp-btn--ghost" style={{ padding: '6px 14px 6px 6px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--lp-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem' }}>
                  {bizName.charAt(0).toUpperCase()}
                </div>
                {bizName} <Svg.ChevronRight />
              </button>
              {showUserMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 100 }}>
                  <div style={{ background: 'var(--lp-paper-raised)', border: '1px solid var(--lp-line)', borderRadius: 14, padding: 8, display: 'flex', flexDirection: 'column', minWidth: 180, boxShadow: 'var(--lp-shadow-md)' }}>
                    <button onClick={goPanel} style={{ background: 'none', border: 'none', color: 'var(--lp-ink)', padding: '12px 16px', borderRadius: 9, fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-paper-sunken)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      Ir a mi Panel <Svg.ChevronRight />
                    </button>
                    <div style={{ height: 1, background: 'var(--lp-line)', margin: '4px 8px' }} />
                    <button onClick={() => {
                      localStorage.removeItem('saas_token'); localStorage.removeItem('saas_refresh_token');
                      localStorage.removeItem('saas_mode');
                      localStorage.removeItem('saas_admin_gate'); localStorage.removeItem('admin_token');
                      localStorage.removeItem('saas_business');
                      localStorage.removeItem('minegocio_current_operator');
                      localStorage.removeItem('minegocio_current_turn_id');
                      localStorage.removeItem('minegocio_cart');
                      localStorage.removeItem('minegocio_pending_sales');
                      localStorage.removeItem('minegocio_onboarding_pending');
                      setIsLoggedIn(false);
                      setShowUserMenu(false);
                      window.location.reload();
                    }} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', padding: '12px 16px', borderRadius: 9, fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 600 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-peso-wash)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Cerrar Sesión</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => setShowLoginModal('login')} className="lp-btn lp-btn--ghost" style={{ padding: '9px 20px', fontSize: '0.88rem' }}>Iniciar Sesión</button>
              <button onClick={() => setShowLoginModal('register')} className="lp-btn lp-btn--primary" style={{ padding: '9px 20px', fontSize: '0.88rem' }}>Registrarse</button>
            </>
          )}
        </div>

        <button onClick={() => setMobileMenu(!mobileMenu)} className="nav-mobile-toggle" style={{ background: 'none', border: 'none', color: 'var(--lp-ink)', cursor: 'pointer', padding: 4 }} aria-label={mobileMenu ? 'Cerrar menu' : 'Abrir menu'}>
          {mobileMenu ? <Svg.X /> : <Svg.Bar3 />}
        </button>
      </div>
      {mobileMenu && (
        <div className="nav-mobile-menu" style={{ flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0', marginTop: 12, borderTop: '1px solid var(--lp-line)' }}>
          {['Funciones', 'Sistema', 'Planes', 'Contacto'].map(link => (
            <a key={link}
               href={link === 'Contacto' ? '#' : `#${link.toLowerCase()}`}
               onClick={(e) => {
                 setMobileMenu(false);
                 if (link === 'Contacto') {
                   e.preventDefault();
                   setShowContactModal(true);
                 }
               }}
               style={{ color: 'var(--lp-ink-soft)', textDecoration: 'none', fontSize: '1rem', fontWeight: 600 }}>{link}</a>
          ))}
          <button onClick={toggleTheme} className="lp-btn lp-btn--ghost" style={{ padding: '10px 24px', fontSize: '0.9rem', display: 'inline-flex', gap: 8 }}>
            {theme === 'dark' ? <><Svg.Sun /> Modo claro</> : <><Svg.Moon /> Modo oscuro</>}
          </button>
          {isLoggedIn ? (
            <>
              <button onClick={goPanel} className="lp-btn lp-btn--primary" style={{ padding: '12px 32px', fontSize: '0.9rem', width: '100%', maxWidth: 200 }}>Ir al Panel</button>
              <button onClick={() => {
                localStorage.removeItem('saas_token'); localStorage.removeItem('saas_refresh_token');
                localStorage.removeItem('saas_mode');
                localStorage.removeItem('minegocio_current_operator');
                setIsLoggedIn(false);
                setMobileMenu(false);
                window.location.reload();
              }} className="lp-btn lp-btn--ghost" style={{ padding: '12px 32px', fontSize: '0.9rem', width: '100%', maxWidth: 200, color: 'var(--lp-red)' }}>Cerrar Sesión</button>
            </>
          ) : (
            <>
              <button onClick={goOnboard} className="lp-btn lp-btn--primary" style={{ padding: '12px 32px', fontSize: '0.9rem', width: '100%', maxWidth: 200 }}>Probar Gratis</button>
              <button onClick={() => { setMobileMenu(false); setShowLoginModal('login'); }} className="lp-btn lp-btn--ghost" style={{ padding: '12px 32px', fontSize: '0.9rem', width: '100%', maxWidth: 200 }}>Iniciar Sesión</button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

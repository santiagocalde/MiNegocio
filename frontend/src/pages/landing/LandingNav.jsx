const Svg = {
  ChevronRight: () => <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
  Bar3: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  X: () => <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
};

export default function LandingNav({
  isScrolled, isLoggedIn, userName, showUserMenu, setShowUserMenu,
  mobileMenu, setMobileMenu, setIsLoggedIn,
  setShowLoginModal, goPanel, goOnboard, navigate, setShowContactModal,
  logoImg, activeSection
}) {
  const getBizName = () => {
    try {
      const data = localStorage.getItem('saas_business');
      if (data) return JSON.parse(data).business_name || userName || 'Mi Negocio';
    } catch(e) {}
    return userName || 'Mi Negocio';
  };
  const bizName = getBizName();

  return (
    <nav className="lp-nav" style={{ 
      padding: isScrolled ? '16px 40px' : '16px 40px', 
      position: 'fixed', 
      top: 0, left: 0, right: 0, zIndex: 100,
      background: isScrolled ? 'rgba(11,19,43,0.85)' : 'transparent',
      backdropFilter: isScrolled ? 'blur(20px)' : 'none',
      borderBottom: isScrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
      transition: 'all 0.3s ease'
    }}>
      <div className="lp-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
          <span onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ cursor: 'pointer', display: 'inline-block' }} aria-label="MiNegocio - Ir al inicio">
            <img src={logoImg} alt="MiNegocio" fetchpriority="high" decoding="async" style={{ height: 80, objectFit: 'contain', filter: 'drop-shadow(0 0 15px rgba(20,187,166, 0.25))', transform: 'scale(1.8)', transformOrigin: 'left 35%' }} />
          </span>
        </div>

        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 40, justifyContent: 'center', position: 'relative', zIndex: 10 }}>
          {['Funciones', 'Planes', 'Contacto'].map(link => (
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
              INFORMACIÓN <Svg.ChevronRight />
            </button>
            <div id="info-dropdown" style={{ opacity: 0, pointerEvents: 'none', transform: 'translateX(-50%) translateY(-10px)', transition: 'all 0.2s', position: 'absolute', top: '100%', left: '50%', background: '#1E3A5F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', minWidth: 180, backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(30,58,95,0.5)' }}>
              <a onClick={(e) => { e.preventDefault(); navigate('/nosotros'); }} style={{ color: 'var(--lp-text-muted)', textDecoration: 'none', padding: '10px 16px', borderRadius: 8, fontSize: '0.9rem', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#fff' }} onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--lp-text-muted)' }}>Sobre Nosotros</a>
              <a onClick={(e) => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ color: 'var(--lp-text-muted)', textDecoration: 'none', padding: '10px 16px', borderRadius: 8, fontSize: '0.9rem', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#fff' }} onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--lp-text-muted)' }}>Preguntas Frecuentes</a>
              <a onClick={(e) => { e.preventDefault(); navigate('/soporte'); }} style={{ color: 'var(--lp-text-muted)', textDecoration: 'none', padding: '10px 16px', borderRadius: 8, fontSize: '0.9rem', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#fff' }} onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--lp-text-muted)' }}>Soporte</a>
            </div>
          </div>
        </div>

        <div className="nav-actions" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
          {isLoggedIn ? (
            <div style={{ position: 'relative' }} onMouseLeave={() => setShowUserMenu(false)}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="lp-btn lp-btn--ghost" style={{ padding: '6px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--lp-primary), var(--lp-secondary))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', boxShadow: '0 0 10px rgba(20,187,166,0.3)' }}>
                  {bizName.charAt(0).toUpperCase()}
                </div>
                {bizName} <Svg.ChevronRight />
              </button>
              {showUserMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 100 }}>
                  <div style={{ background: '#1E3A5F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', minWidth: 180, backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(30,58,95,0.5)' }}>
                    <button onClick={goPanel} style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 16px', borderRadius: 8, fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                      Ir a mi Panel <Svg.ChevronRight />
                    </button>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 8px' }} />
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
                    }} style={{ background: 'none', border: 'none', color: 'var(--lp-red)', padding: '12px 16px', borderRadius: 8, fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s', fontWeight: 600 }} onMouseEnter={e => e.target.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.target.style.background = 'transparent'}>Cerrar Sesión</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => setShowLoginModal('login')} className="lp-btn lp-btn--ghost" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>Iniciar Sesión</button>
              <button onClick={() => setShowLoginModal('register')} className="lp-btn lp-btn--primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>Registrarse</button>
            </>
          )}
        </div>

        <button onClick={() => setMobileMenu(!mobileMenu)} className="nav-mobile-toggle" style={{ background: 'none', border: 'none', color: 'var(--lp-text)', cursor: 'pointer', padding: 4 }} aria-label={mobileMenu ? 'Cerrar menu' : 'Abrir menu'}>
          {mobileMenu ? <Svg.X /> : <Svg.Bar3 />}
        </button>
      </div>
      {mobileMenu && (
        <div className="nav-mobile-menu" style={{ flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0', marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {['Funciones', 'Planes', 'Contacto'].map(link => (
            <a key={link} 
               href={link === 'Contacto' ? '#' : `#${link.toLowerCase()}`} 
               onClick={(e) => {
                 setMobileMenu(false);
                 if (link === 'Contacto') {
                   e.preventDefault();
                   setShowContactModal(true);
                 }
               }} 
               style={{ color: 'var(--lp-text-muted)', textDecoration: 'none', fontSize: '1rem', fontWeight: 600 }}>{link}</a>
          ))}
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

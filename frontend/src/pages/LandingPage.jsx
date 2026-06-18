import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import LogoPrincipal from '../assets/images/MiNegocio_transparente_real.png';
import FotoMascota from '../assets/images/mascota_oficial.jpg';
import LogoWhatsApp from '../assets/images/whatsapp_logo.png';

import LandingNav from './landing/LandingNav';
import LandingHero from './landing/LandingHero';
import LandingComparativa from './landing/LandingComparativa';
import LandingSocialProof from './landing/LandingSocialProof';
import LandingFeatures from './landing/LandingFeatures';
import LandingSoporteHumano from './landing/LandingSoporteHumano';
import LandingOffline from './landing/LandingOffline';
import LandingTestimonials from './landing/LandingTestimonials';
import LandingPricing from './landing/LandingPricing';
import LandingFAQ from './landing/LandingFAQ';
import LandingFinalCTA from './landing/LandingFinalCTA';
import LandingFooter from './landing/LandingFooter';
import LandingContactModal from './landing/LandingContactModal';
import LandingLoginModal from './landing/LandingLoginModal';
import CheckoutView from './landing/CheckoutView';
import ForgotPasswordModal from './landing/ForgotPasswordModal';
import WhatsAppButton from './landing/WhatsAppButton';
import DogEasterEgg from './landing/DogEasterEgg';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [isExploding, setIsExploding] = useState(false);
  const [contactForm, setContactForm] = useState({ nombre: '', contacto: '', mensaje: '' });

  const handleAuthSubmit = async () => {
    if (!loginEmail || !loginPassword) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8005';
      const endpoint = `${baseUrl}/api/auth/${showLoginModal === 'register' ? 'register' : 'login'}`;
      const body = showLoginModal === 'register'
        ? { email: loginEmail, password: loginPassword, name: loginName || 'Usuario', business_name: 'Mi Negocio', business_type: 'kiosco', phone: loginPhone ? '+54 ' + loginPhone : '' }
        : { email: loginEmail, password: loginPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        let errStr = 'Error de autenticación';
        try {
          const data = await res.json();
          if (data.detail) {
            errStr = Array.isArray(data.detail) ? data.detail[0].msg : data.detail;
          }
        } catch (e) {
          errStr = `Error del servidor (${res.status})`;
        }
        throw new Error(errStr);
      }

      const data = await res.json();
      localStorage.setItem('saas_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('saas_refresh_token', data.refresh_token);
      localStorage.setItem('saas_business', JSON.stringify(data.business));
      if (data.operator_pin) localStorage.setItem('minegocio_onboarding_pin', data.operator_pin);
      
      const superAdminEmails = ['calderonsantiago2019@gmail.com', 'admin@minegocio.app'];
      if (data.business && superAdminEmails.includes(data.business.email)) {
        localStorage.setItem('saas_admin_gate', 'true');
        const adminAuthUrl = import.meta.env.PROD ? '/api/admin/auth' : 'http://localhost:8005/api/admin/auth';
        fetch(adminAuthUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password: loginPassword })
        }).then(r => r.ok ? r.json() : null).then(d => {
          if (d && d.access_token) localStorage.setItem('admin_token', d.access_token);
        }).catch(() => {});
      }
      
      if (showLoginModal === 'register') {
        setIsLoggedIn(true);
        setUserName(loginName || 'Usuario');
        setShowLoginModal(false);
        localStorage.setItem('minegocio_onboarding_pending', 'true');
        if (loginPhone) localStorage.setItem('minegocio_prefill_phone', loginPhone);
      } else {
        window.location.href = '/panel';
      }
    } catch (err) {
      setLoginError(err.message);
    }
    setLoginLoading(false);
  };

  const [contactError, setContactError] = useState('');

  const handleContactSubmit = async () => {
    if (!contactForm.nombre || !contactForm.mensaje) return;
    setContactLoading(true);
    setContactError('');
    try {
      const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8005';
      const res = await fetch(`${baseUrl}/api/send-contact-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Error al enviar el mensaje');
      }
      setContactSent(true);
    } catch (err) {
      setContactError(err.message || 'Error de conexion. Intenta de nuevo mas tarde.');
    }
    setContactLoading(false);
  };

  const handleDogClick = () => {
    if (isExploding) return;
    setIsExploding(true);
    setTimeout(() => setIsExploding(false), 3500);
  };

  const goPanel = useCallback(() => { 
    if (localStorage.getItem('minegocio_onboarding_pending') === 'true') {
      navigate('/register');
    } else {
      window.location.href = '/panel'; 
    }
  }, [navigate]);
  const goOnboard = useCallback(() => { navigate('/register'); }, [navigate]);

  // Scroll spy
  const [activeSection, setActiveSection] = useState('');
  useEffect(() => {
    const sections = ['funciones', 'planes', 'faq'];
    const observers = [];

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) setActiveSection(id);
      }, { threshold: 0, rootMargin: '-40% 0px -55% 0px' });
      observer.observe(el);
      observers.push(observer);
    });

    const handleScrollTop = () => {
      if (window.scrollY < 300) setActiveSection('');
    };
    window.addEventListener('scroll', handleScrollTop, { passive: true });

    return () => {
      observers.forEach(o => o.disconnect());
      window.removeEventListener('scroll', handleScrollTop);
    };
  }, []);

  // Close forgot password and reopen login
  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setShowLoginModal('login');
  };

  useEffect(() => {
    document.body.classList.add('landing-open');
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    const token = localStorage.getItem('saas_token');
    if (token && token !== 'demo-token' && token !== 'preview-token') {
      setIsLoggedIn(true);
      setUserName(localStorage.getItem('minegocio_current_operator') || 'Dueño');
    } else if (token === 'demo-token' || token === 'preview-token') {
      localStorage.removeItem('saas_token');
      localStorage.removeItem('saas_mode');
      localStorage.removeItem('minegocio_current_operator');
      localStorage.removeItem('minegocio_current_turn_id');
    }

    if (window.location.search.includes('login=true')) {
      setShowLoginModal('login');
      window.history.replaceState({}, document.title, '/');
    }
    return () => {
      document.body.classList.remove('landing-open');
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showLoginModal) setShowLoginModal(false);
        else if (showForgotPassword) setShowForgotPassword(false);
        else if (showContactModal) setShowContactModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLoginModal, showForgotPassword, showContactModal]);

  if (checkoutPlan) {
    return <CheckoutView plan={checkoutPlan} isYearly={isYearly} onBack={() => setCheckoutPlan(null)} onComplete={goPanel} />;
  }

  return (
    <div className="lp-noise" style={{ fontFamily: 'var(--lp-font-body)', color: 'var(--lp-text)', minHeight: '100vh', position: 'relative' }}>
      <div className="lp-canvas" />
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />
      <div className="lp-orb lp-orb--3" />

      <LandingNav
        isScrolled={isScrolled} isLoggedIn={isLoggedIn} userName={userName}
        showUserMenu={showUserMenu} setShowUserMenu={setShowUserMenu}
        mobileMenu={mobileMenu} setMobileMenu={setMobileMenu}
        setIsLoggedIn={setIsLoggedIn} setShowLoginModal={setShowLoginModal}
        goPanel={goPanel} goOnboard={goOnboard} navigate={navigate}
        setShowContactModal={setShowContactModal} logoImg={LogoPrincipal}
        activeSection={activeSection}
      />

      <LandingHero isLoggedIn={isLoggedIn} goPanel={goPanel} goOnboard={goOnboard} />
      <div className="lp-divider" />
      <LandingComparativa />
      <div className="lp-divider" />
      <LandingSocialProof />
      <LandingFeatures />
      <div className="lp-divider" />
      <LandingSoporteHumano />
      <div className="lp-divider" />
      <LandingOffline />
      <div className="lp-divider" />
      <LandingTestimonials />
      <div className="lp-divider" />
      <LandingPricing
        isYearly={isYearly} setIsYearly={setIsYearly}
        isLoggedIn={isLoggedIn} setCheckoutPlan={setCheckoutPlan}
        navigate={navigate} setShowContactModal={setShowContactModal}
      />
      <div className="lp-divider" />
      <LandingFAQ />
      <LandingFinalCTA isLoggedIn={isLoggedIn} goPanel={goPanel} goOnboard={goOnboard} />
      <LandingFooter
        navigate={navigate} setShowContactModal={setShowContactModal}
        handleDogClick={handleDogClick} logoImg={LogoPrincipal} mascotaImg={FotoMascota}
      />

      <LandingLoginModal
        showLoginModal={showLoginModal} setShowLoginModal={setShowLoginModal}
        setShowForgotPassword={setShowForgotPassword}
        loginName={loginName} setLoginName={setLoginName}
        loginEmail={loginEmail} setLoginEmail={setLoginEmail}
        loginPassword={loginPassword} setLoginPassword={setLoginPassword}
        loginPhone={loginPhone} setLoginPhone={setLoginPhone}
        showPassword={showPassword} setShowPassword={setShowPassword}
        loginLoading={loginLoading} loginError={loginError}
        handleAuthSubmit={handleAuthSubmit} goOnboard={goOnboard} navigate={navigate}
      />

      <LandingContactModal
        showContactModal={showContactModal} setShowContactModal={setShowContactModal}
        contactSent={contactSent} setContactSent={setContactSent}
        contactLoading={contactLoading} contactForm={contactForm}
        setContactForm={setContactForm} handleContactSubmit={handleContactSubmit}
        contactError={contactError}
      />

      <WhatsAppButton logoImg={LogoWhatsApp} />
      <DogEasterEgg isExploding={isExploding} />

      {showForgotPassword && <ForgotPasswordModal onClose={handleCloseForgotPassword} />}
    </div>
  );
}

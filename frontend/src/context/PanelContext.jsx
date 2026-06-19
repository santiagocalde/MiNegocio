/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useCallback, useMemo, useContext, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import useBackend from '../hooks/useBackend';
import useCloseTurn from '../hooks/useCloseTurn';
import usePrinting from '../hooks/usePrinting';
import useSound from '../hooks/useSound';
import usePlan from '../hooks/usePlan';
import SetupWizard from '../components/SetupWizard';
import { apiGet, apiPost } from '../services/apiClient';
import { Icons } from '../components/ui/Icons';

const PanelContext = createContext(null);

export function usePanelContext() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanelContext must be used within PanelProvider');
  return ctx;
}

export function PanelProvider({ children }) {
  const { playBeep, playErrorBeep } = useSound();
  const [currentSucursalId, setCurrentSucursalId] = useState(1);
  const [toasts, setToasts] = useState([]);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [needsSetup, setNeedsSetup] = useState(null);
  const [businessName, setBusinessName] = useState('MiNegocio');

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const auth = useAuth(addToast);
  const backend = useBackend(auth.currentOperator, auth.currentTurnId, currentSucursalId, addToast);
  const closeTurn = useCloseTurn(backend.resumenData);
  const printing = usePrinting();
  const plan = usePlan(backend.businessConfig);

  useEffect(() => {
    const interval = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setNeedsSetup(false);
    }, 5000);
    apiGet('/setup/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled && d) {
          setNeedsSetup(d.needs_setup);
          if (d.business_name) setBusinessName(d.business_name);
        } else if (!cancelled) {
          setNeedsSetup(false);
        }
      })
      .catch(() => { if (!cancelled) setNeedsSetup(false); })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    const isPreview = localStorage.getItem('saas_mode') === 'preview';
    if (auth.isAuthenticated && auth.currentTurnId && !isPreview) {
      apiGet('/turns/active')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !data.id) {
            auth.setIsAuthenticated(false);
            auth.setCurrentTurnId(null);
            auth.setTurnOpenedAt(null);
            auth.setCurrentOperator(null);
            localStorage.removeItem('minegocio_current_turn_id');
            localStorage.removeItem('minegocio_current_operator');
            localStorage.removeItem('minegocio_turn_opened_at');
          } else {
            if (String(data.id) !== String(auth.currentTurnId)) {
              auth.setCurrentTurnId(data.id);
              localStorage.setItem('minegocio_current_turn_id', String(data.id));
            }
            if (data.opened_at && data.opened_at !== auth.turnOpenedAt) {
              auth.setTurnOpenedAt(data.opened_at);
              localStorage.setItem('minegocio_turn_opened_at', data.opened_at);
            }
            if (data.initial_cash != null) {
              auth.setInitialCash(data.initial_cash);
            }
          }
        })
        .catch(() => { addToast('Error al validar turno. Reintentá.', 'error'); });
    }
  }, [auth.isAuthenticated]);

  const value = useMemo(() => ({
    auth,
    backend,
    closeTurn,
    printing,
    addToast,
    playBeep,
    playErrorBeep,
    toasts,
    currentSucursalId,
    setCurrentSucursalId,
    currentDateTime,
    ...plan,
  }), [
    auth, backend, closeTurn, printing, addToast, playBeep, playErrorBeep,
    toasts, currentSucursalId, currentDateTime, plan,
  ]);

  if (needsSetup === null) {
    return <div className="layout" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cargando...</span>
    </div>;
  }

  if (needsSetup) {
    return <SetupWizard onComplete={() => setNeedsSetup(false)} />;
  }

  if (!auth.isAuthenticated) {
    if (auth.isSaaSAuthenticated) {
      return (
        <div className="layout" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', top: 20, right: 20, color: 'var(--text-secondary)' }}>
            {currentDateTime.toLocaleString('es-AR')}
            <button onClick={() => { localStorage.removeItem('saas_token'); localStorage.removeItem('saas_mode'); auth.setIsSaaSAuthenticated(false); }} style={{ marginLeft: 12, background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Salir</button>
          </div>
          <div className="brand-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, marginBottom: 24 }}><Icons.Lock /></div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>{businessName}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Ingresa tu PIN para abrir turno</p>
            {(() => {
            const onboardingPin = localStorage.getItem('minegocio_onboarding_pin');
            if (onboardingPin) {
              return (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, textAlign: 'center', maxWidth: 320 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                    <svg width="18" height="18" fill="none" stroke="#F59E0B" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-8v4m-9 4h18l-3.6-14.4A2 2 0 0015.56 1H8.44a2 2 0 00-1.92 1.4L3 17z"/></svg>
                    <span style={{ color: '#F59E0B', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Importante</span>
                  </div>
                  <span style={{ color: '#F1F5F9', fontSize: '0.85rem', fontWeight: 500 }}>Tu PIN de acceso es </span>
                  <span style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '6px', background: 'rgba(255,255,255,0.05)', padding: '4px 14px', borderRadius: 6, margin: '0 6px' }}>{onboardingPin}</span>
                  <div style={{ color: '#F87171', fontSize: '0.8rem', marginTop: 10, fontWeight: 600 }}>Este PIN se muestra una sola vez. Anotalo ahora, no lo pierdas.</div>
                </div>
              );
            }
            return null;
          })()}
          <form onSubmit={auth.handlePin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <input type="password" value={auth.pin} onChange={e => auth.setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="••••" style={{ width: 'clamp(180px, 25vw, 240px)', textAlign: 'center', fontSize: '2rem', letterSpacing: '12px', padding: '14px 16px', background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', outline: 'none' }} autoFocus />
            <button type="submit" style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '12px 48px', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>Abrir Turno</button>
            <ForgotPinLink />
          </form>
        </div>
      );
    }
    window.location.href = '/';
    return null;
  }

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

function ForgotPinLink() {
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleForgotPin = async () => {
    setLoading(true); setErr('');
    try {
      const biz = JSON.parse(localStorage.getItem('saas_business') || '{}');
      if (!biz.email) { setErr('No se encontro el email de la cuenta.'); setLoading(false); return; }
      await apiPost('/auth/forgot-pin', { email: biz.email });
      setSent(true);
    } catch { setErr('Error de conexion. Intenta de nuevo.'); }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 4, textAlign: 'center' }}>
      {!show && !sent && (
        <button onClick={() => setShow(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, padding: '4px 8px' }}>
          Olvide mi PIN
        </button>
      )}
      {show && !sent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>Te enviamos un nuevo PIN a tu correo</p>
          <button onClick={handleForgotPin} disabled={loading} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '8px 24px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Enviando...' : 'Enviar nuevo PIN'}
          </button>
          <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}>Cancelar</button>
        </div>
      )}
      {sent && (
        <div style={{ color: 'var(--accent-success)', fontSize: '0.85rem', fontWeight: 600, padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 8 }}>
          PIN enviado. Revisa tu correo.
        </div>
      )}
      {err && <div style={{ color: 'var(--accent-danger)', fontSize: '0.78rem', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

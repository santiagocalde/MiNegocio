/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useCallback, useMemo, useContext, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import useBackend from '../hooks/useBackend';
import useCloseTurn from '../hooks/useCloseTurn';
import usePrinting from '../hooks/usePrinting';
import useSound from '../hooks/useSound';
import usePlan from '../hooks/usePlan';
import SetupWizard from '../components/SetupWizard';
import { apiGet } from '../services/apiClient';
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
  const closeTurn = useCloseTurn(backend.todaySalesTotal);
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
                <div style={{ background: 'rgba(20,187,166,0.1)', border: '1px solid rgba(20,187,166,0.3)', borderRadius: 8, padding: '8px 16px', marginBottom: 16, textAlign: 'center' }}>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>Tu PIN de acceso es: </span>
                  <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '4px' }}>{onboardingPin}</span>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 4 }}>Guardalo. No se volvera a mostrar.</div>
                </div>
              );
            }
            return null;
          })()}
          <form onSubmit={auth.handlePin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <input type="password" value={auth.pin} onChange={e => auth.setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="••••" style={{ width: 160, textAlign: 'center', fontSize: '2rem', letterSpacing: '8px', padding: '12px', background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', outline: 'none' }} autoFocus />
            <button type="submit" style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '12px 48px', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>Abrir Turno</button>
          </form>
        </div>
      );
    }
    window.location.href = '/';
    return null;
  }

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

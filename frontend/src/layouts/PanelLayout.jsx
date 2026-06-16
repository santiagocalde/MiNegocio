import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/pos/Sidebar';
import { Icons } from '../components/ui/Icons';
import { usePanelContext } from '../context/PanelContext';
import EgresoModal from '../components/pos/EgresoModal';
import CloseTurnModal from '../components/pos/CloseTurnModal';
import StockAlertsModal from '../components/pos/StockAlertsModal';
import HelpModal from '../components/pos/HelpModal';
import ResumenModal from '../components/pos/ResumenModal';
import PriceCheckModal from '../components/pos/PriceCheckModal';
import PendingSyncModal from '../components/pos/PendingSyncModal';
import CierresAnterioresModal from '../components/pos/CierresAnterioresModal';
import BackupRestoreModal from '../components/pos/BackupRestoreModal';
import ExpiryAlertsModal from '../components/pos/ExpiryAlertsModal';
import ToastContainer from '../components/pos/ToastContainer';

export default function PanelLayout() {
  const { auth, backend, closeTurn, addToast, toasts, trialDaysRemaining, currentPlan, isTrialExpired } = usePanelContext();
  const location = useLocation();

  // Estados para Onboarding Modals
  const [showInitialCaja, setShowInitialCaja] = React.useState(false);
  const [showCreatePassword, setShowCreatePassword] = React.useState(false);
  const [initialCajaMonto, setInitialCajaMonto] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  useEffect(() => {
    if (localStorage.getItem('minegocio_onboarding_pending') === 'true') {
      setShowInitialCaja(true);
      localStorage.removeItem('minegocio_onboarding_pending');
    }
  }, []);

  const handleCajaSubmit = async (e) => {
    e.preventDefault();
    try {
      const { apiPost } = await import('../services/apiClient');
      await apiPost('/turns', {
        operator: auth.currentOperator?.name || 'Dueño',
        sucursal_id: 1,
        initial_cash: parseFloat(initialCajaMonto) || 0
      });
    } catch { addToast('Error al abrir la caja. Reintentá.', 'error'); }
    setShowInitialCaja(false);
    setShowCreatePassword(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('Las contraseñas no coinciden', 'error');
      return;
    }
    if (newPassword.length < 6) {
      addToast('Debe tener al menos 6 caracteres', 'error');
      return;
    }
    try {
      const { apiPut } = await import('../services/apiClient');
      const opName = auth.currentOperator?.name || 'Dueño';
      await apiPut('/operators', [
        { name: opName, pin: newPassword, role: 'admin' }
      ]);
    } catch { addToast('Error al guardar la contraseña. Reintentá.', 'error'); }
    setShowCreatePassword(false);
    addToast('Configuracion completada! Bienvenido.', 'success');
  };

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
  }, [location.pathname]);

  const isDemo = localStorage.getItem('saas_token') === 'demo-token' || localStorage.getItem('saas_token') === 'preview-token' || localStorage.getItem('saas_mode') === 'preview';

  useEffect(() => {
    if (isDemo) {
      document.body.classList.add('demo-mode');
    } else {
      document.body.classList.remove('demo-mode');
    }
    return () => document.body.classList.remove('demo-mode');
  }, [isDemo]);

  useEffect(() => {
    // Escape key listener removed to avoid UX issues
  }, [isDemo]);

  return (
    <div className="layout">
      <Sidebar
        currentOperator={auth.currentOperator}
        pendingSync={backend.pendingSync}
        setShowPendingModal={backend.setShowPendingModal}
        todaySalesTotal={backend.todaySalesTotal}
        setShowResumen={backend.setShowResumen}
        setShowEgreso={backend.setShowEgreso}
        setIsClosingCaja={closeTurn.setIsClosingCaja}
        currentTurnId={auth.currentTurnId}
      />

      <main style={{ flex: 1, overflow: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>

        {currentPlan === 'trial' && !isTrialExpired && !isDemo && (
          <div style={{ background: 'var(--gradient-primary)', padding: '8px 24px', textAlign: 'center', color: 'white', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(20,187,166,0.2)' }}>
            <Icons.Clock style={{ width: '16px', height: '16px', flexShrink: 0 }} /> Período de prueba — quedan <strong>{trialDaysRemaining}</strong> día{trialDaysRemaining === 1 ? '' : 's'}. <a href="/panel/plan" style={{ color: 'white', textDecoration: 'underline', fontWeight: 800 }}>Ver planes</a>
          </div>
        )}
        {currentPlan === 'trial' && isTrialExpired && (
          <div style={{ background: 'linear-gradient(135deg, #EF4444, #F59E0B)', padding: '8px 24px', textAlign: 'center', color: 'white', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Icons.Alert style={{ width: '16px', height: '16px', flexShrink: 0 }} /> El período de prueba finalizó. <a href="/panel/plan" style={{ color: 'white', textDecoration: 'underline', fontWeight: 800 }}>Elegí un plan</a> para seguir usando MiNegocio.
          </div>
        )}
        {isDemo && (
          <div style={{ background: 'var(--gradient-primary)', color: 'white', padding: '8px 24px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <span>Estás en modo visualización previa. Los datos no se guardarán permanentemente.</span>
            <button onClick={() => window.location.href = '/?login=true'} style={{ background: 'white', color: 'var(--text-primary)', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Registrarse</button>
            <button onClick={() => {
              localStorage.removeItem('saas_token');
              localStorage.removeItem('minegocio_current_operator');
              localStorage.removeItem('minegocio_current_turn_id');
              localStorage.removeItem('saas_mode');
              window.location.href = '/';
            }} style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
              Salir de la demo
            </button>
          </div>
        )}
        <Suspense fallback={
          <div style={{ padding: 40, color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>
            Cargando...
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>

      <EgresoModal showEgreso={backend.showEgreso} setShowEgreso={backend.setShowEgreso}
        egresoType={backend.egresoType} setEgresoType={backend.setEgresoType}
        egresoMonto={backend.egresoMonto} setEgresoMonto={backend.setEgresoMonto}
        egresoMotivo={backend.egresoMotivo} setEgresoMotivo={backend.setEgresoMotivo}
        submitEgreso={backend.submitEgreso} />

      <CloseTurnModal isClosingCaja={closeTurn.isClosingCaja} setIsClosingCaja={closeTurn.setIsClosingCaja}
        currentOperator={auth.currentOperator} todaySalesTotal={backend.todaySalesTotal}
        countedCash={closeTurn.countedCash} setCountedCash={closeTurn.setCountedCash}
        closeCajaPin={closeTurn.closeCajaPin} setCloseCajaPin={closeTurn.setCloseCajaPin}
        calculateCajaDiff={closeTurn.calculateCajaDiff} cashRef={closeTurn.cashRef} addToast={addToast}
        currentTurnId={auth.currentTurnId}
        onTurnClosed={() => { auth.setIsAuthenticated(false); auth.setCurrentTurnId(null); auth.setCurrentOperator(null); localStorage.removeItem('minegocio_current_operator'); localStorage.removeItem('minegocio_current_turn_id'); }} />

      <StockAlertsModal stockAlerts={backend.stockAlerts} setStockAlerts={backend.setStockAlerts} />

      <HelpModal showHelp={backend.showHelp} setShowHelp={backend.setShowHelp} />

      <ResumenModal showResumen={backend.showResumen} setShowResumen={backend.setShowResumen}
        resumenData={backend.resumenData} businessConfig={backend.businessConfig} addToast={addToast} />

      <PriceCheckModal showPriceCheck={backend.showPriceCheck} setShowPriceCheck={backend.setShowPriceCheck}
        priceCheckQuery={backend.priceCheckQuery} setPriceCheckQuery={backend.setPriceCheckQuery}
        priceCheckResults={backend.priceCheckResults} setPriceCheckResults={backend.setPriceCheckResults}
        productsDB={backend.productsDB} />

      <PendingSyncModal showPendingModal={backend.showPendingModal} setShowPendingModal={backend.setShowPendingModal}
        getPendingData={backend.getPendingData} handleManualSync={backend.handleManualSync}
        setPendingSync={backend.setPendingSync} addToast={addToast} />

      <CierresAnterioresModal showCierres={backend.showCierres} setShowCierres={backend.setShowCierres}
        cierresData={backend.cierresData} />

      <BackupRestoreModal showBackupRestore={backend.showBackupRestore} setShowBackupRestore={backend.setShowBackupRestore}
        backupList={backend.backupList} restoring={backend.restoring} setRestoring={backend.setRestoring}
        addToast={addToast} />

      <ExpiryAlertsModal showExpiryAlerts={backend.showExpiryAlerts} setShowExpiryAlerts={backend.setShowExpiryAlerts}
        expiryAlerts={backend.expiryAlerts} />

      {/* MODALES DE PRIMER INGRESO (ONBOARDING) */}
      {showInitialCaja && (
        <div className="modal-overlay" style={{ background: 'rgba(30,58,95,0.8)', backdropFilter: 'blur(10px)', zIndex: 99999 }}>
          <div className="lp-glass" style={{ maxWidth: 450, width: '100%', margin: '0 20px', animation: 'scaleIn 0.3s ease-out', padding: 48, borderRadius: 24, textAlign: 'center', background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
               <Icons.Box style={{ color: 'var(--lp-primary)' }} /> Abrir mi caja
            </h2>
            <form onSubmit={handleCajaSubmit}>
              <p style={{ color: 'var(--lp-text-muted)', marginBottom: 32, fontSize: '0.95rem', lineHeight: 1.5 }}>Para comenzar a vender, ingresá el monto de dinero en efectivo (cambio) con el que empezás el día.</p>
              <div style={{ textAlign: 'left', marginBottom: 32 }}>
                <label style={{ display: 'block', color: '#fff', marginBottom: 8, fontWeight: 600 }}>Monto inicial ($)</label>
                <input type="number" min="0" step="1" required autoFocus value={initialCajaMonto} onChange={e => setInitialCajaMonto(e.target.value)} placeholder="Ej. 15000" style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '1.2rem', outline: 'none', transition: 'all 0.2s', fontFamily: 'var(--lp-font-body)' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </div>
              <button type="submit" className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', boxShadow: '0 0 30px rgba(15,138,125, 0.4)' }}>Abrir Caja</button>
            </form>
          </div>
        </div>
      )}

      {showCreatePassword && (
        <div className="modal-overlay" style={{ background: 'rgba(30,58,95,0.8)', backdropFilter: 'blur(10px)', zIndex: 99999 }}>
          <div className="lp-glass" style={{ maxWidth: 450, width: '100%', margin: '0 20px', animation: 'scaleIn 0.3s ease-out', padding: 48, borderRadius: 24, textAlign: 'center', background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
               <Icons.User style={{ color: 'var(--lp-primary)' }} /> Crear Contraseña
            </h2>
            <form onSubmit={handlePasswordSubmit}>
              <p style={{ color: 'var(--lp-text-muted)', marginBottom: 32, fontSize: '0.95rem', lineHeight: 1.5 }}>Creá una contraseña segura para ingresar a tu cuenta de administrador todos los días. <strong style={{color:'#fff'}}>Por favor, anotala para no olvidarla.</strong></p>
              <div style={{ textAlign: 'left', marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#fff', marginBottom: 8, fontWeight: 600 }}>Nueva contraseña</label>
                <input type="password" required autoFocus value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '1.1rem', outline: 'none', transition: 'all 0.2s', fontFamily: 'var(--lp-font-body)' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </div>
              <div style={{ textAlign: 'left', marginBottom: 32 }}>
                <label style={{ display: 'block', color: '#fff', marginBottom: 8, fontWeight: 600 }}>Confirmar contraseña</label>
                <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repetir contraseña" style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: '1.1rem', outline: 'none', transition: 'all 0.2s', fontFamily: 'var(--lp-font-body)' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </div>
              <button type="submit" className="lp-btn lp-btn--primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', boxShadow: '0 0 30px rgba(15,138,125, 0.4)' }}>Guardar Contraseña</button>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

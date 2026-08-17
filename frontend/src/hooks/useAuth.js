import { useState } from 'react';
import { apiPost } from '../services/apiClient';

const K_OPERATOR = 'minegocio_current_operator';
const K_TURN_ID = 'minegocio_current_turn_id';
const K_TURN_OPENED = 'minegocio_turn_opened_at';

export default function useAuth(addToast) {
  const [isSaaSAuthenticated, setIsSaaSAuthenticated] = useState(
    !!localStorage.getItem('saas_token') || localStorage.getItem('saas_mode') === 'offline'
  );
  const [saasMode, setSaasMode] = useState(localStorage.getItem('saas_mode') || 'online');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem(K_TURN_ID));
  const [currentOperator, setCurrentOperator] = useState(() => {
    try {
      const raw = localStorage.getItem(K_OPERATOR);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [currentTurnId, setCurrentTurnId] = useState(localStorage.getItem(K_TURN_ID) || null);
  const [turnOpenedAt, setTurnOpenedAt] = useState(localStorage.getItem(K_TURN_OPENED) || null);
  const [initialCash, setInitialCash] = useState(0);
  const [pin, setPin] = useState('');

  const handlePin = async (e) => {
    e.preventDefault();
    if (pin.length === 0) return;
    try {
      const res = await apiPost(`/login`, { pin, mode: saasMode });
      if (res.ok) {
        const data = await res.json();
        const operatorObj = data.operator_id
          ? { id: data.operator_id, name: data.name || data.operator_name || 'Dueño', role: data.role || 'admin', permissions: data.permissions ?? null }
          : { name: data.name || 'Dueño', role: 'admin', permissions: null };
        setCurrentOperator(operatorObj);
        setCurrentTurnId(data.turn_id);
        if (data.turn_opened_at) {
          setTurnOpenedAt(data.turn_opened_at);
          localStorage.setItem(K_TURN_OPENED, data.turn_opened_at);
        } else {
          setTurnOpenedAt(null);
          localStorage.removeItem(K_TURN_OPENED);
        }
        localStorage.setItem(K_OPERATOR, JSON.stringify(operatorObj));
        localStorage.setItem(K_TURN_ID, String(data.turn_id || ''));
        localStorage.removeItem('minegocio_onboarding_pin');
        if (data.initial_cash != null) setInitialCash(Number(data.initial_cash) || 0);
        if (data.turn_auto_opened && (data.suggested_initial_cash || 0) > 0) {
          addToast(`Caja abierta con $${Number(data.suggested_initial_cash).toLocaleString('es-AR')} (igual al arqueo de ayer). Si arrancás con otro monto, editá "Caja inicial" en el panel.`, 'info', 7000);
        }
        setIsAuthenticated(true);
      } else {
        addToast('PIN incorrecto', 'error');
        setPin('');
      }
    } catch {
      addToast('Sin internet', 'error');
    }
  };

  // Abre turno sin PIN para cuentas de un solo operador (el dueño). El backend
  // autoriza por el JWT de la cuenta y responde:
  //   409 → hay más de un operador (ahí sí hace falta el PIN)
  //   401 → la sesión SaaS no es válida (hay que volver al login, nunca PIN)
  // Devuelve 'ok' | 'multi' | 'auth' | 'error'.
  const openOwnerTurn = async () => {
    try {
      const res = await apiPost(`/login/owner`);
      if (res.status === 409) return 'multi';
      if (res.status === 401) return 'auth';
      if (!res.ok) return 'error';
      const data = await res.json();
      const operatorObj = data.operator_id
        ? { id: data.operator_id, name: data.name || data.operator_name || 'Dueño', role: data.role || 'admin', permissions: data.permissions ?? null }
        : { name: data.name || 'Dueño', role: 'admin', permissions: null };
      setCurrentOperator(operatorObj);
      setCurrentTurnId(data.turn_id);
      if (data.turn_opened_at) {
        setTurnOpenedAt(data.turn_opened_at);
        localStorage.setItem(K_TURN_OPENED, data.turn_opened_at);
      } else {
        setTurnOpenedAt(null);
        localStorage.removeItem(K_TURN_OPENED);
      }
      localStorage.setItem(K_OPERATOR, JSON.stringify(operatorObj));
      localStorage.setItem(K_TURN_ID, String(data.turn_id || ''));
      localStorage.removeItem('minegocio_onboarding_pin');
      if (data.initial_cash != null) setInitialCash(Number(data.initial_cash) || 0);
      if (data.turn_auto_opened && (data.suggested_initial_cash || 0) > 0) {
        addToast(`Caja abierta con $${Number(data.suggested_initial_cash).toLocaleString('es-AR')} (igual al arqueo de ayer). Si arrancás con otro monto, editá "Caja inicial" en el panel.`, 'info', 7000);
      }
      setIsAuthenticated(true);
      return 'ok';
    } catch {
      return 'error';
    }
  };

  const handleSaaSCallback = (data) => {
    setIsSaaSAuthenticated(true);
    if (data.mode) setSaasMode(data.mode);
  };

  return {
    isSaaSAuthenticated, setIsSaaSAuthenticated,
    saasMode, setSaasMode,
    isAuthenticated, setIsAuthenticated,
    currentOperator, setCurrentOperator,
    currentTurnId, setCurrentTurnId,
    turnOpenedAt, setTurnOpenedAt,
    initialCash, setInitialCash,
    pin, setPin,
    handlePin,
    openOwnerTurn,
    handleSaaSCallback,
  };
}

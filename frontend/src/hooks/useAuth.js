import { useState, useCallback } from 'react';
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
          ? { id: data.operator_id, name: data.name || data.operator_name || 'Dueño', role: data.role || 'admin' }
          : { name: data.name || 'Dueño', role: 'admin' };
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
        if (data.turn_auto_opened) {
          localStorage.setItem('minegocio_onboarding_pending', 'true');
        }
        setIsAuthenticated(true);
      } else {
        addToast('PIN incorrecto', 'error');
        setPin('');
      }
    } catch {
      addToast('Error de conexion con el servidor', 'error');
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
    handleSaaSCallback,
  };
}

import React, { useState } from 'react';
import { apiPatch } from '../../services/apiClient';

export default function CloseTurnModal({ isClosingCaja, setIsClosingCaja, currentOperator, todaySalesTotal, countedCash, setCountedCash, closeCajaPin, setCloseCajaPin, calculateCajaDiff, cashRef, addToast, currentTurnId, onTurnClosed }) {
  const [closing, setClosing] = useState(false);
  if (!isClosingCaja) return null;

  const handleCloseTurn = async () => {
    if (!currentTurnId) {
      if (addToast) addToast('No hay turno activo.', 'error');
      return;
    }
    if (!closeCajaPin || closeCajaPin.length < 4) {
      if (addToast) addToast('Ingresa tu PIN de 4 digitos.', 'error');
      return;
    }
    setClosing(true);
    try {
      const res = await apiPatch(`/turns/${currentTurnId}/close`, {
        sales_total: todaySalesTotal || 0,
        counted_cash: parseFloat(countedCash) || 0,
        pin: closeCajaPin,
        operator_id: currentOperator?.id || null,
        notes: calculateCajaDiff() !== 0 ? (calculateCajaDiff() > 0 ? `Sobrante: $${calculateCajaDiff()}` : `Faltante: $${Math.abs(calculateCajaDiff())}`) : 'Caja cerrada sin diferencias.',
      });
      if (res.ok) {
        if (addToast) addToast('Turno cerrado correctamente.', 'success');
        setCountedCash('');
        setCloseCajaPin('');
        setIsClosingCaja(false);
        if (onTurnClosed) onTurnClosed();
      } else {
        const data = await res.json().catch(() => ({}));
        if (addToast) addToast(data.detail || 'Error al cerrar turno.', 'error');
      }
    } catch {
      if (addToast) addToast('Error de conexion al cerrar turno.', 'error');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="modal-overlay"><div className="modal-content" style={{ width: '500px' }}>
      <h2 className="modal-title" style={{ color: 'var(--text-primary)' }}>Cierre de Turno</h2>
      {currentOperator?.role === 'admin' && (
        <>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '8px' }}>Hoy el sistema registró ventas por:</p>
        <div className="modal-amount" style={{ color: 'var(--text-primary)', marginBottom: '24px', textAlign: 'center' }}>${(todaySalesTotal || 0).toLocaleString('es-AR')}</div>
        </>
      )}
      {currentOperator?.role !== 'admin' && (
        <div style={{ background: 'rgba(20,187,166, 0.1)', padding: '16px', borderRadius: '8px', marginBottom: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Arqueo Ciego: Por favor, ingrese el total de efectivo que hay en la caja.</p>
        </div>
      )}
      <div className="input-group"><label style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Cuanto efectivo contaste en el cajon fisico?</label>
        <input ref={cashRef} type="number" value={countedCash} onChange={e => setCountedCash(e.target.value)} autoFocus />
      </div>
      <div className="input-group"><label style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Firma del Cierre (PIN 4 digitos)</label>
        <input type="password" value={closeCajaPin} onChange={e => setCloseCajaPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="****" />
      </div>
      {countedCash && closeCajaPin.length === 4 && currentOperator?.role === 'admin' && (
        <div style={{ textAlign: 'center', marginBottom: '24px', padding: '16px', borderRadius: '12px', background: calculateCajaDiff() === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
          {calculateCajaDiff() === 0 ? <span style={{ color: 'var(--accent-success)', fontWeight: 700, fontSize: '1.5rem' }}>Caja perfecta! No sobra ni falta.</span> : (
            <div><span style={{ color: 'var(--accent-danger)', fontWeight: 800, fontSize: '1.8rem' }}>{calculateCajaDiff() > 0 ? `Sobra $${calculateCajaDiff().toLocaleString('es-AR')}` : `Falta $${Math.abs(calculateCajaDiff()).toLocaleString('es-AR')}`}</span>
              <p style={{ color: 'var(--accent-danger)', marginTop: '8px', fontSize: '0.9rem' }}>Revisa los billetes o anota el {calculateCajaDiff() > 0 ? 'sobrante' : 'faltante'} en las observaciones.</p>
            </div>
          )}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-modal-cancel" onClick={() => { setIsClosingCaja(false); setCountedCash(''); setCloseCajaPin(''); }} disabled={closing}>Cancelar (Esc)</button>
        <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-danger)', opacity: !countedCash || closeCajaPin.length < 4 || closing ? 0.5 : 1 }} onClick={handleCloseTurn} disabled={!countedCash || closeCajaPin.length < 4 || closing}>
          {closing ? 'Cerrando turno...' : 'Confirmar y Reportar'}
        </button>
      </div>
    </div></div>
  );
}

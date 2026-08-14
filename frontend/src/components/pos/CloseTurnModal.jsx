import { useState, useEffect } from 'react';
import { apiPost, apiGet } from '../../services/apiClient';
import CategoryBreakdown from './CategoryBreakdown';

export default function CloseTurnModal({ isClosingCaja, setIsClosingCaja, currentOperator, todaySalesTotal, countedCash, setCountedCash, closeCajaPin, setCloseCajaPin, calculateCajaDiff, cashRef, addToast, currentTurnId, onTurnClosed }) {
  const [closing, setClosing] = useState(false);
  const [pendingRemitos, setPendingRemitos] = useState([]);
  const [postponing, setPostponing] = useState(false);
  const [turnCats, setTurnCats] = useState([]);
  const [turnResumen, setTurnResumen] = useState(null);

  const isLogistica = currentOperator?.role === 'logistica';
  const isAdmin = currentOperator?.role === 'admin';

  // Cargar remitos pendientes para el rol logística (hook antes de cualquier early return)
  useEffect(() => {
    if (!isLogistica || !isClosingCaja) return;
    apiGet('/remitos?status=pending&limit=50')
      .then(r => r.ok ? r.json() : [])
      .then(data => setPendingRemitos(Array.isArray(data) ? data : []))
      .catch(() => setPendingRemitos([]));
  }, [isLogistica, isClosingCaja]);

  // Detalle del turno activo: resumen de caja del turno + ventas por categoría.
  // El arqueo se calcula SIEMPRE contra los números de ESTE turno (no del día),
  // igual que el backend al confirmar.
  useEffect(() => {
    if (!isClosingCaja || !currentTurnId) return;
    apiGet(`/turns/${currentTurnId}/detail`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setTurnCats(Array.isArray(d?.por_categoria) ? d.por_categoria : []);
        if (d?.resumen_caja) setTurnResumen(d.resumen_caja);
      })
      .catch(() => {});
  }, [isClosingCaja, currentTurnId]);

  if (!isClosingCaja) return null;

  // Efectivo del turno = ventas 100% efectivo + porción efectivo de pagos mixtos.
  const turnEfectivo = turnResumen
    ? (turnResumen.efectivo || 0) + (turnResumen.split_efectivo || 0)
    : null;

  // Diferencia del arqueo calculada contra el TURNO actual (igual que el backend).
  // Si el detalle todavía no cargó, cae al cálculo diario como respaldo.
  const cajaDiff = () => {
    const counted = parseFloat(countedCash) || 0;
    if (turnResumen) {
      return Math.round(counted - turnEfectivo - (turnResumen.initial_cash || 0) + (turnResumen.egresos || 0));
    }
    return Math.round(calculateCajaDiff ? calculateCajaDiff() : 0);
  };

  const handlePostponeAll = async () => {
    if (pendingRemitos.length === 0) return;
    setPostponing(true);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    await Promise.all(pendingRemitos.map(r =>
      apiPost(`/remitos/${r.id}/status`, { status: 'postponed', scheduled_date: dateStr, operator: currentOperator?.name || 'Sistema' })
    ));
    setPendingRemitos([]);
    setPostponing(false);
    if (addToast) addToast(`${pendingRemitos.length} pedido(s) pasado(s) a mañana.`, 'success');
  };

  const handleCloseTurn = async () => {
    if (!currentTurnId) {
      if (addToast) addToast('No hay turno activo.', 'error');
      return;
    }
    // Para logística no se pide efectivo ni PIN
    if (!isLogistica) {
      if (!countedCash) {
        if (addToast) addToast('Ingresa cuánto efectivo contaste.', 'error');
        return;
      }
      if (!isAdmin && (!closeCajaPin || closeCajaPin.length < 4)) {
        if (addToast) addToast('Ingresa tu PIN de 4 digitos.', 'error');
        return;
      }
    }
    setClosing(true);
    try {
      const diff = cajaDiff();
      const res = await apiPost(`/turns/${currentTurnId}/close`, {
        sales_total: todaySalesTotal || 0,
        counted_cash: isLogistica ? 0 : (parseFloat(countedCash) || 0),
        operator_id: isAdmin ? null : (currentOperator?.id || null),
        pin: (isAdmin || isLogistica) ? undefined : closeCajaPin,
        notes: isLogistica ? 'Cierre de turno logística' : (diff !== 0 ? (diff > 0 ? `Sobrante: $${diff}` : `Faltante: $${Math.abs(diff)}`) : 'Caja cerrada sin diferencias.'),
      });
      if (res.ok) {
        if (addToast) addToast('Turno cerrado correctamente.', 'success');
        setCountedCash('');
        setCloseCajaPin('');
        setIsClosingCaja(false);
        if (onTurnClosed) onTurnClosed();
      } else {
        const data = await res.json().catch(() => ({}));
        if (addToast) addToast(data.detail || 'No se pudo cerrar el turno. Reintentá o revisá tu conexión.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin internet. No se pudo cerrar el turno.', 'error');
    } finally {
      setClosing(false);
    }
  };

  // ── Vista para rol logística ──────────────────────────────────
  if (isLogistica) {
    return (
      <div className="modal-overlay"><div className="modal-content" style={{ width: '500px' }}>
        <h2 className="modal-title" style={{ color: 'var(--text-primary)' }}>Cierre de turno — Logística</h2>
        {pendingRemitos.length > 0 ? (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              Hay <strong style={{ color: 'var(--accent-warning)' }}>{pendingRemitos.length} pedido(s) pendiente(s)</strong> para hoy. ¿Los pasás a mañana o los dejás?
            </p>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 0', marginBottom: 16, maxHeight: 180, overflowY: 'auto' }}>
              {pendingRemitos.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>#{r.id} {r.customer_name ? '— ' + r.customer_name : ''}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{r.address || '—'}</span>
                </div>
              ))}
            </div>
            <button onClick={handlePostponeAll} disabled={postponing}
              style={{ width: '100%', padding: '11px', marginBottom: 8, background: 'var(--accent-warning)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', opacity: postponing ? 0.6 : 1 }}>
              {postponing ? 'Pasando...' : `Pasar ${pendingRemitos.length} pedido(s) a mañana`}
            </button>
          </>
        ) : (
          <div style={{ background: 'rgba(16,185,129,0.1)', padding: 16, borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>
            <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>Sin pedidos pendientes para hoy.</span>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-modal-cancel" onClick={() => setIsClosingCaja(false)} disabled={closing}>Cancelar</button>
          <button className="btn btn-modal-confirm" onClick={handleCloseTurn} disabled={closing}
            style={{ background: 'var(--accent-danger)', opacity: closing ? 0.5 : 1 }}>
            {closing ? 'Cerrando...' : 'Cerrar turno'}
          </button>
        </div>
      </div></div>
    );
  }

  return (
    <div className="modal-overlay"><div className="modal-content" style={{ width: '500px' }}>
      <h2 className="modal-title" style={{ color: 'var(--text-primary)' }}>Cierre de Turno</h2>
      {currentOperator?.role === 'admin' && (
        <>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '8px' }}>{turnResumen ? 'Este turno registró ventas por:' : 'Hoy el sistema registró ventas por:'}</p>
        <div className="modal-amount" style={{ color: 'var(--text-primary)', marginBottom: '8px', textAlign: 'center' }}>${((turnResumen ? turnResumen.total : todaySalesTotal) || 0).toLocaleString('es-AR')}</div>
        {turnResumen ? (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Efectivo de este turno</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>${(turnEfectivo || 0).toLocaleString('es-AR')}</span>
            </div>
            {(turnResumen.egresos || 0) !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Egresos / ingresos de este turno</span>
                <span style={{ color: 'var(--accent-warning)', fontWeight: 700 }}>{turnResumen.egresos > 0 ? `−$${turnResumen.egresos.toLocaleString('es-AR')}` : `+$${Math.abs(turnResumen.egresos).toLocaleString('es-AR')}`}</span>
              </div>
            )}
            {(turnResumen.initial_cash || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Caja inicial</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>${(turnResumen.initial_cash || 0).toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>
        ) : null}
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.8rem' }}>
          El arqueo compara solo el <strong>efectivo físico</strong> del cajón. Las transferencias y posnet van a tu cuenta bancaria aparte.
        </p>
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
      {!isAdmin && (
        <div className="input-group"><label style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Firma del Cierre (PIN 4 digitos)</label>
          <input type="password" value={closeCajaPin} onChange={e => setCloseCajaPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="****" />
        </div>
      )}
      {countedCash && (isAdmin || closeCajaPin.length === 4) && (
        <div style={{ textAlign: 'center', marginBottom: '24px', padding: '16px', borderRadius: '12px', background: cajaDiff() === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
          {cajaDiff() === 0 ? <span style={{ color: 'var(--accent-success)', fontWeight: 700, fontSize: '1.5rem' }}>Caja perfecta! No sobra ni falta.</span> : (
            <div><span style={{ color: 'var(--accent-danger)', fontWeight: 800, fontSize: '1.8rem' }}>{cajaDiff() > 0 ? `Sobra $${cajaDiff().toLocaleString('es-AR')}` : `Falta $${Math.abs(cajaDiff()).toLocaleString('es-AR')}`}</span>
              <p style={{ color: 'var(--accent-danger)', marginTop: '8px', fontSize: '0.9rem' }}>Revisa los billetes o anota el {cajaDiff() > 0 ? 'sobrante' : 'faltante'} en las observaciones.</p>
            </div>
          )}
        </div>
      )}

      {/* Ventas por categoría — componente aparte al pie del cierre */}
      <CategoryBreakdown items={turnCats} />

      <div className="modal-actions">
        <button className="btn btn-modal-cancel" onClick={() => { setIsClosingCaja(false); setCountedCash(''); setCloseCajaPin(''); }} disabled={closing}>Cancelar (Esc)</button>
        <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-danger)', opacity: !countedCash || (!isAdmin && closeCajaPin.length < 4) || closing ? 0.5 : 1 }} onClick={handleCloseTurn} disabled={!countedCash || (!isAdmin && closeCajaPin.length < 4) || closing}>
          {closing ? 'Cerrando turno...' : 'Confirmar y Reportar'}
        </button>
      </div>
    </div></div>
  );
}

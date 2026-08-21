import { useState, useEffect } from 'react';
import { apiPost, apiGet } from '../../services/apiClient';
import CategoryBreakdown from './CategoryBreakdown';
import TopProductsList from './TopProductsList';
import useIsMobile from '../../hooks/useIsMobile';
import useModalExit from '../../hooks/useModalExit';
import { Icons } from '../ui/Icons';

export default function CloseTurnModal({ isClosingCaja, setIsClosingCaja, currentOperator, todaySalesTotal, countedCash, setCountedCash, closeCajaPin, setCloseCajaPin, cashRef, addToast, currentTurnId, onTurnClosed, businessConfig, setShowEgreso, setEgresoType, setEgresoMonto, setEgresoMotivo }) {
  const isMobile = useIsMobile();
  const [closing, setClosing] = useState(false);
  const [pendingRemitos, setPendingRemitos] = useState([]);
  const [postponing, setPostponing] = useState(false);
  const [turnCats, setTurnCats] = useState([]);
  const [turnTop, setTurnTop] = useState([]);
  const [turnResumen, setTurnResumen] = useState(null);
  // Resumen final tras cerrar: se muestra ANTES de cerrar sesión, para que el
  // operador tenga algo concreto que mostrarle al dueño (o sacarle foto) en
  // vez de solo un toast que desaparece.
  const [closedSummary, setClosedSummary] = useState(null);

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
        setTurnTop(Array.isArray(d?.productos_top) ? d.productos_top : []);
        if (d?.resumen_caja) setTurnResumen(d.resumen_caja);
      })
      .catch(() => {});
  }, [isClosingCaja, currentTurnId]);

  const { rendered, closing: exiting } = useModalExit(isClosingCaja);
  if (!rendered) return null;

  const handleFinishAndLogout = () => {
    setClosedSummary(null);
    setIsClosingCaja(false);
    if (onTurnClosed) onTurnClosed();
  };

  // Pantalla de resumen final — se muestra ANTES de cerrar sesión, con los
  // números que ya confirmó el backend (no recalculados en el cliente).
  if (closedSummary) {
    const d = closedSummary.difference;
    const dColor = d === null || d === undefined ? 'var(--text-secondary)'
      : Math.abs(d) <= 200 ? 'var(--accent-success)'
      : d > 0 ? 'var(--accent-warning)' : 'var(--accent-danger)';
    return (
      <div className={`modal-overlay${exiting ? ' closing' : ''}`} onClick={handleFinishAndLogout}><div className={`modal-content${exiting ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ width: '460px', maxWidth: '95vw', textAlign: 'center' }}>
        <Icons.CheckCircle style={{ width: 44, height: 44, margin: '0 auto 4px', color: 'var(--accent-success)', display: 'block' }} />
        <h2 className="modal-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>Turno cerrado</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
          {closedSummary.operator ? `${closedSummary.operator} — ` : ''}{new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: 'var(--bg-main)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Vendido este turno</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>${(closedSummary.total || 0).toLocaleString('es-AR')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Contaste en el cajón</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>${(closedSummary.counted || 0).toLocaleString('es-AR')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Diferencia</span>
            <span style={{ color: dColor, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
              {d === null || d === undefined ? '—' : Math.abs(d) < 0.01 ? '$0' : (d > 0 ? '+$' : '−$') + Math.abs(d).toLocaleString('es-AR')}
            </span>
          </div>
        </div>
        <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', marginBottom: 20 }}>
          Podés mostrarle esta pantalla al dueño o sacarle una foto antes de continuar.
        </p>
        <button className="btn btn-modal-confirm" style={{ width: '100%', background: 'var(--accent-primary)' }} onClick={handleFinishAndLogout}>
          Listo, cerrar sesión
        </button>
      </div></div>
    );
  }

  // Efectivo del turno (el backend ya incluye la porción efectivo de pagos mixtos).
  const turnEfectivo = turnResumen ? (turnResumen.efectivo || 0) : null;

  // Diferencia del arqueo calculada contra el TURNO actual (igual que el backend).
  // Devuelve null mientras el detalle del turno no cargó: no mostramos el cálculo
  // diario porque en días multi-turno no coincide con el backend.
  const cajaDiff = () => {
    if (!turnResumen) return null;
    const counted = parseFloat(countedCash) || 0;
    return Math.round(counted - turnEfectivo - (turnResumen.initial_cash || 0) + (turnResumen.egresos || 0));
  };

  const handlePostponeAll = async () => {
    if (pendingRemitos.length === 0) return;
    setPostponing(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      await Promise.all(pendingRemitos.map(r =>
        apiPost(`/remitos/${r.id}/status`, { status: 'postponed', scheduled_date: dateStr, operator: currentOperator?.name || 'Sistema' })
      ));
      setPendingRemitos([]);
      if (addToast) addToast(`${pendingRemitos.length} pedido(s) pasado(s) a mañana.`, 'success');
    } catch {
      if (addToast) addToast('No se pudieron pasar los pedidos. Reintentá.', 'error');
    } finally {
      setPostponing(false);
    }
  };

  const handleCloseTurn = async () => {
    if (!currentTurnId) {
      if (addToast) addToast('No hay turno activo.', 'error');
      return;
    }
    // Para logística no se pide efectivo ni PIN
    if (!isLogistica) {
      if (countedCash === '') {
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
        notes: isLogistica ? 'Cierre de turno logística' : (diff === null ? 'Cierre sin arqueo en vivo' : (diff !== 0 ? (diff > 0 ? `Sobrante: $${diff}` : `Faltante: $${Math.abs(diff)}`) : 'Caja cerrada sin diferencias.')),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (addToast) addToast('Turno cerrado correctamente.', 'success');
        setCountedCash('');
        setCloseCajaPin('');
        if (isLogistica) {
          // Logística no cuenta efectivo — no hay nada que resumir, cerramos directo.
          setIsClosingCaja(false);
          if (onTurnClosed) onTurnClosed();
        } else {
          // Guardamos una foto de los números finales antes de limpiar el estado
          // del formulario — la pantalla de resumen se arma con esto y se muestra
          // ANTES de cerrar sesión, para que el operador tenga algo concreto que
          // mostrarle al dueño en vez de solo un toast que desaparece.
          setClosedSummary({
            total: turnResumen?.total || 0,
            counted: parseFloat(countedCash) || 0,
            expected_cash: data.expected_cash,
            difference: data.difference,
            operator: currentOperator?.name || '',
          });
        }
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
      <div className={`modal-overlay${exiting ? ' closing' : ''}`} onClick={() => setIsClosingCaja(false)}><div className={`modal-content${exiting ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
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

  // Sobrante grande: probable efectivo de turno anterior no contado
  const diff = cajaDiff();
  const sobrante_de_turno_anterior = diff !== null && diff > 0 && diff > (turnEfectivo || 0) * 0.5;

  // Monto fijo de caja inicial (Ajustes -> Caja y Turnos, opt-in por negocio).
  // Si está configurado, sugerimos en vivo cuánto retirar para dejar siempre
  // ese número en el cajón — se calcula contra lo que el empleado YA tipeó en
  // "¿Cuánto contás en el cajón ahora?", no algo a futuro.
  const cajaInicialFija = parseFloat(businessConfig?.caja_inicial_fija) || 0;
  const retiroSugerido = cajaInicialFija > 0 && countedCash !== ''
    ? Math.round((parseFloat(countedCash) || 0) - cajaInicialFija)
    : null;

  const handleQuickWithdraw = () => {
    if (!retiroSugerido || retiroSugerido <= 0) return;
    setEgresoType?.('retiro');
    setEgresoMonto?.(String(retiroSugerido));
    setEgresoMotivo?.(`Dejar caja en $${cajaInicialFija.toLocaleString('es-AR')} para el próximo turno`);
    setShowEgreso?.(true);
  };

  // Cuánto debería haber en el cajón (lo que el backend va a calcular al cierre)
  const expectedCash = turnResumen
    ? (turnResumen.initial_cash || 0) + (turnResumen.efectivo || 0) - (turnResumen.egresos || 0)
    : null;

  return (
    <div className={`modal-overlay${exiting ? ' closing' : ''}`} onClick={() => setIsClosingCaja(false)}><div className={`modal-content${exiting ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ width: '940px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <h2 className="modal-title" style={{ color: 'var(--text-primary)', flexShrink: 0 }}>Cierre de Turno</h2>

      {/* ── Zona de resumen — scroll propio, no arrastra la zona de acción ── */}
      <div style={{ overflowY: 'auto', flexShrink: 1, minHeight: 0, maxHeight: isMobile ? '32vh' : '38vh', marginBottom: '14px', paddingRight: 2 }}>
      {turnResumen ? (
        <>
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Este turno — ventas totales</div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>${(turnResumen.total || 0).toLocaleString('es-AR')}</div>
          {todaySalesTotal > (turnResumen.total || 0) && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Día completo: <strong style={{ color: 'var(--text-primary)' }}>${todaySalesTotal.toLocaleString('es-AR')}</strong> (incluye turnos anteriores)
            </div>
          )}
        </div>

        {/* Método, Caja, Más vendidos y Categoría — todo en UNA fila para aprovechar
            el ancho (en desktop). En mobile se apilan. Las columnas se ajustan a
            cuántas tarjetas hay con datos. */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${2 + (turnTop.length > 0 ? 1 : 0) + (turnCats.length > 0 ? 1 : 0)}, minmax(0, 1fr))`, gap: '12px', marginBottom: '12px', alignItems: 'start' }}>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-main)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>Ventas por método</div>
            {[
              { label: 'Efectivo', key: 'efectivo' },
              { label: 'Tarjeta', key: 'tarjeta' },
              { label: 'Transferencia', key: 'transferencia' },
              { label: 'QR', key: 'mercadopago' },
            ].map((m, i, arr) => (
              <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', fontSize: '0.9rem', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{m.label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${((turnResumen[m.key] || 0)).toLocaleString('es-AR')}</span>
              </div>
            ))}
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-main)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>Caja del turno</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Caja inicial</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${(turnResumen.initial_cash || 0).toLocaleString('es-AR')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {(turnResumen.egresos || 0) < 0 ? 'Ingresos a caja' : 'Egresos / retiros'}
              </span>
              <span style={{ color: (turnResumen.egresos || 0) < 0 ? 'var(--accent-primary)' : 'var(--accent-warning)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {(turnResumen.egresos || 0) === 0 ? '$0' : (turnResumen.egresos > 0 ? '−$' : '+$') + Math.abs(turnResumen.egresos).toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {turnTop.length > 0 && <TopProductsList items={turnTop} compact />}
          {turnCats.length > 0 && <CategoryBreakdown items={turnCats} compact />}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.8rem' }}>
          El arqueo compara solo el <strong>efectivo físico</strong> del cajón. Transferencias y QR van a tu cuenta bancaria aparte.
        </p>
        </>
      ) : (
        <>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '8px' }}>Hoy el sistema registró ventas por:</p>
        <div className="modal-amount" style={{ color: 'var(--text-primary)', marginBottom: '16px', textAlign: 'center' }}>${(todaySalesTotal || 0).toLocaleString('es-AR')}</div>
        </>
      )}

      </div>
      {/* ── Fin zona de resumen ── */}

      {/* ── Zona de acción — siempre visible, no scrollea con el resumen ── */}
      <div style={{ flexShrink: 0, overflowY: 'auto' }}>
      {/* Bloque de arqueo centrado — es el foco de la acción de cerrar caja */}
      {/* Cuánto debería haber — el operador lo ve ANTES de contar, no después */}
      {expectedCash !== null && (
        <div style={{ background: 'rgba(20,187,166,0.08)', border: '1px solid rgba(20,187,166,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 14, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
            El cajón debería tener
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            ${expectedCash.toLocaleString('es-AR')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
            {[
              turnResumen.initial_cash > 0 && `$${Number(turnResumen.initial_cash).toLocaleString('es-AR')} que había al empezar`,
              turnResumen.efectivo > 0 && `+ $${Number(turnResumen.efectivo).toLocaleString('es-AR')} cobrado en efectivo`,
              turnResumen.egresos > 0 && `− $${Number(turnResumen.egresos).toLocaleString('es-AR')} retirado`,
              turnResumen.egresos < 0 && `+ $${Math.abs(turnResumen.egresos).toLocaleString('es-AR')} agregado al cajón`,
            ].filter(Boolean).join(' ')}
          </div>
        </div>
      )}

      <div className="input-group" style={{ marginBottom: 12, textAlign: 'center' }}>
        <label style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', fontWeight: 600 }}>¿Cuánto contás en el cajón ahora?</label>
        <input ref={cashRef} type="number" value={countedCash} onChange={e => setCountedCash(e.target.value)} autoFocus placeholder="0" onWheel={e => e.currentTarget.blur()} style={{ fontSize: '1.3rem', padding: '11px 14px', fontFamily: 'var(--font-mono)', maxWidth: '240px', textAlign: 'center', marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
        <p style={{ margin: '6px 2px 0', fontSize: '0.78rem', color: 'var(--text-faint)' }}>Abrí el cajón, contá los billetes y escribí el total.</p>
      </div>
      {retiroSugerido !== null && retiroSugerido > 0 && (
        <div style={{ background: 'rgba(20,187,166,0.08)', border: '1px solid rgba(20,187,166,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, textAlign: 'center' }}>
            Retirá <strong style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>${retiroSugerido.toLocaleString('es-AR')}</strong> y dejá <strong style={{ fontFamily: 'var(--font-mono)' }}>${cajaInicialFija.toLocaleString('es-AR')}</strong> en el cajón para el próximo turno.
          </span>
          <button type="button" onClick={handleQuickWithdraw}
            style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Registrar retiro
          </button>
        </div>
      )}
      {countedCash !== '' && parseFloat(countedCash) === 0 && (
        <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icons.Alert style={{ width: 18, height: 18, flexShrink: 0, color: 'var(--accent-warning)' }} />
          <span style={{ color: 'var(--accent-warning)', fontSize: '0.88rem', fontWeight: 600 }}>
            Ingresaste $0. Si el cajón está vacío está bien, pero verificá antes de confirmar.
          </span>
        </div>
      )}
      {!isAdmin && (
        <div className="input-group"><label style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Firma del Cierre (PIN 4 dígitos)</label>
          <input type="password" value={closeCajaPin} onChange={e => setCloseCajaPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="****" />
        </div>
      )}
      {countedCash !== '' && (isAdmin || closeCajaPin.length === 4) && (
        <div style={{ textAlign: 'center', marginBottom: '24px', padding: '16px', borderRadius: '12px',
          background: diff === null ? 'rgba(20,187,166,0.06)'
            : diff === 0 || Math.abs(diff) <= 200 ? 'rgba(16,185,129,0.1)'
            : diff > 0 ? 'rgba(245,158,11,0.1)'
            : 'rgba(239,68,68,0.1)' }}>
          {diff === null
            ? <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '1rem' }}>Calculando arqueo del turno...</span>
            : diff === 0
              ? <span style={{ color: 'var(--accent-success)', fontWeight: 700, fontSize: '1.5rem' }}>¡Caja perfecta! No sobra ni falta.</span>
              : Math.abs(diff) <= 200
                ? <div>
                    <span style={{ color: 'var(--accent-success)', fontWeight: 700, fontSize: '1.3rem' }}>
                      {diff > 0 ? `Sobra $${diff.toLocaleString('es-AR')}` : `Falta $${Math.abs(diff).toLocaleString('es-AR')}`}
                    </span>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.85rem' }}>
                      Diferencia mínima — puede ser monedas o redondeo. Está dentro del margen normal.
                    </p>
                  </div>
                : (
                  <div>
                    <span style={{ color: diff > 0 ? 'var(--accent-warning)' : 'var(--accent-danger)', fontWeight: 800, fontSize: '1.8rem' }}>
                      {diff > 0 ? `Sobra $${diff.toLocaleString('es-AR')}` : `Falta $${Math.abs(diff).toLocaleString('es-AR')}`}
                    </span>
                    {sobrante_de_turno_anterior
                      ? <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.85rem' }}>
                          El sobrante puede incluir efectivo de un turno anterior que se cerró sin contar. Es normal.
                        </p>
                      : diff < 0
                        ? <p style={{ color: 'var(--accent-danger)', marginTop: '8px', fontSize: '0.85rem' }}>
                            ¿Hiciste algún retiro de efectivo que no registraste? Si sí, cerrá igual y avisale al dueño.
                          </p>
                        : <p style={{ color: 'var(--accent-warning)', marginTop: '8px', fontSize: '0.85rem' }}>
                            ¿Pusiste plata extra en el cajón? Si sí, cerrá igual y avisale al dueño.
                          </p>
                    }
                  </div>
                )
          }
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 4 }}>
        <button className="btn btn-modal-cancel" onClick={() => { setIsClosingCaja(false); setCountedCash(''); setCloseCajaPin(''); }} disabled={closing}>Cancelar</button>
        <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-danger)', opacity: countedCash === '' || (!isAdmin && closeCajaPin.length < 4) || closing ? 0.5 : 1 }} onClick={handleCloseTurn} disabled={countedCash === '' || (!isAdmin && closeCajaPin.length < 4) || closing}>
          {closing ? 'Cerrando turno...' : 'Confirmar y Reportar'}
        </button>
      </div>
      </div>
      {/* ── Fin zona de acción ── */}
    </div></div>
  );
}

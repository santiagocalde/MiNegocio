

export default function EgresoModal({ showEgreso, setShowEgreso, egresoType, setEgresoType, egresoMonto, setEgresoMonto, egresoMotivo, setEgresoMotivo, submitEgreso, estimatedCash }) {
  if (!showEgreso) return null;
  const isIngreso = egresoType === 'ingreso';
  const montoNum = parseFloat(egresoMonto) || 0;
  // Solo advertimos cuando sale plata (gasto/retiro) y supera lo que debería haber
  // en el cajón ahora mismo — evita que el operador registre un retiro imposible
  // sin darse cuenta y se confunda después al ver el faltante en el cierre.
  const excedeCajon = !isIngreso && estimatedCash != null && montoNum > estimatedCash;
  return (
    <div className="modal-overlay" onClick={() => setShowEgreso(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem', color: 'var(--accent-warning)' }}>Registrar movimiento de caja</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px' }}>
          {isIngreso ? 'Registrá acá la plata que agregaste al cajón para que no aparezca como sobrante sin explicación.' : 'Registrá acá la plata que saques de la caja para que no te dé faltante en el cierre.'}
        </p>
        <div className="input-group"><label>Tipo de Operación</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button onClick={() => setEgresoType('gasto')} style={{ flex: '1 1 30%', padding: '12px', borderRadius: '8px', border: '1px solid', borderColor: egresoType === 'gasto' ? 'var(--accent-danger)' : 'var(--border-color)', background: egresoType === 'gasto' ? 'rgba(239,68,68,0.15)' : 'transparent', color: egresoType === 'gasto' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>Gasto — afecta ganancia</button>
            <button onClick={() => setEgresoType('retiro')} style={{ flex: '1 1 30%', padding: '12px', borderRadius: '8px', border: '1px solid', borderColor: egresoType === 'retiro' ? 'var(--accent-primary)' : 'var(--border-color)', background: egresoType === 'retiro' ? 'rgba(20,187,166,0.15)' : 'transparent', color: egresoType === 'retiro' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>Sangría / Retiro del dueño</button>
            <button onClick={() => setEgresoType('ingreso')} style={{ flex: '1 1 30%', padding: '12px', borderRadius: '8px', border: '1px solid', borderColor: egresoType === 'ingreso' ? 'var(--accent-success)' : 'var(--border-color)', background: egresoType === 'ingreso' ? 'rgba(16,185,129,0.15)' : 'transparent', color: egresoType === 'ingreso' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>Ingreso — agregué plata</button>
          </div>
        </div>
        <div className="input-group"><label>{isIngreso ? 'Monto que agregaste ($)' : 'Monto a retirar ($)'}</label>
          <input type="text" value={egresoMonto} onChange={e => setEgresoMonto(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => { if (e.key === 'Escape') { setShowEgreso(false); setEgresoMonto(''); setEgresoMotivo(''); setEgresoType('gasto'); } if (e.key === 'Enter') document.getElementById('egresoMotivoInput')?.focus(); }}
            placeholder="0" style={{ fontSize: '2rem', padding: '16px' }} autoFocus />
        </div>
        {excedeCajon && (
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span style={{ color: 'var(--accent-warning)', fontSize: '0.85rem', fontWeight: 600 }}>
              El cajón debería tener ${Math.round(estimatedCash).toLocaleString('es-AR')} — estás sacando más de lo que hay. Revisá el monto.
            </span>
          </div>
        )}
        <div className="input-group"><label>{isIngreso ? '¿De dónde salió esa plata?' : '¿Para qué se usó?'}</label>
          <input id="egresoMotivoInput" type="text" value={egresoMotivo} onChange={e => setEgresoMotivo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && egresoMonto && egresoMotivo) submitEgreso(); }}
            placeholder={egresoType === 'gasto' ? "Ej: Pago de luz..." : egresoType === 'retiro' ? "Ej: Retiro para pagar alquiler..." : "Ej: Fondo de cambio del dueño..."}
            style={{ fontSize: '1.25rem', fontFamily: 'var(--font-main)', padding: '16px' }} />
        </div>
        <div style={{ background: 'var(--wash-danger)', borderLeft: '4px solid var(--accent-danger)', padding: '12px 16px', borderRadius: '4px', marginBottom: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}><strong>Importante:</strong> Recordá dejar el comprobante físico en la caja.</div>
        <div className="modal-actions">
          <button className="btn btn-modal-cancel" onClick={() => { setShowEgreso(false); setEgresoMonto(''); setEgresoMotivo(''); setEgresoType('gasto'); }}>Cancelar (Esc)</button>
          <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-warning)', color: '#1E3A5F' }} onClick={submitEgreso} disabled={!egresoMonto || !egresoMotivo}>
            Registrar {egresoType === 'gasto' ? 'Gasto' : egresoType === 'retiro' ? 'Retiro' : 'Ingreso'}
          </button>
        </div>
      </div>
    </div>
  );
}

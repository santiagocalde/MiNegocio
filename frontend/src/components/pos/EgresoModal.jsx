import React from 'react';

export default function EgresoModal({ showEgreso, setShowEgreso, egresoType, setEgresoType, egresoMonto, setEgresoMonto, egresoMotivo, setEgresoMotivo, submitEgreso }) {
  if (!showEgreso) return null;
  return (
    <div className="modal-overlay" onClick={() => setShowEgreso(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem', color: 'var(--accent-warning)' }}>💸 Registrar Egreso / Retiro</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px' }}>Registrá acá la plata que saques de la caja para que no te dé faltante en el cierre.</p>
        <div className="input-group"><label>Tipo de Operación</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => setEgresoType('gasto')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid', borderColor: egresoType === 'gasto' ? 'var(--accent-danger)' : 'var(--border-color)', background: egresoType === 'gasto' ? 'rgba(239,68,68,0.15)' : 'transparent', color: egresoType === 'gasto' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>📉 Gasto (Afecta Ganancia)</button>
            <button onClick={() => setEgresoType('retiro')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid', borderColor: egresoType === 'retiro' ? 'var(--accent-primary)' : 'var(--border-color)', background: egresoType === 'retiro' ? 'rgba(20,187,166,0.15)' : 'transparent', color: egresoType === 'retiro' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>💼 Sangría / Retiro (Dueño)</button>
          </div>
        </div>
        <div className="input-group"><label>Monto a retirar ($)</label>
          <input type="text" value={egresoMonto} onChange={e => setEgresoMonto(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => { if (e.key === 'Escape') { setShowEgreso(false); setEgresoMonto(''); setEgresoMotivo(''); setEgresoType('gasto'); } if (e.key === 'Enter') document.getElementById('egresoMotivoInput')?.focus(); }}
            placeholder="0" style={{ fontSize: '2rem', padding: '16px' }} autoFocus />
        </div>
        <div className="input-group"><label>¿Para qué se usó?</label>
          <input id="egresoMotivoInput" type="text" value={egresoMotivo} onChange={e => setEgresoMotivo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && egresoMonto && egresoMotivo) submitEgreso(); }}
            placeholder={egresoType === 'gasto' ? "Ej: Pago de luz..." : "Ej: Retiro para pagar alquiler..."}
            style={{ fontSize: '1.25rem', fontFamily: 'var(--font-main)', padding: '16px' }} />
        </div>
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #EF4444', padding: '12px 16px', borderRadius: '4px', marginBottom: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}><strong>⚠️ Importante:</strong> Recordá dejar el comprobante físico en la caja.</div>
        <div className="modal-actions">
          <button className="btn btn-modal-cancel" onClick={() => { setShowEgreso(false); setEgresoMonto(''); setEgresoMotivo(''); setEgresoType('gasto'); }}>Cancelar (Esc)</button>
          <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-warning)', color: '#1E3A5F' }} onClick={submitEgreso} disabled={!egresoMonto || !egresoMotivo}>Registrar {egresoType === 'gasto' ? 'Gasto' : 'Retiro'}</button>
        </div>
      </div>
    </div>
  );
}

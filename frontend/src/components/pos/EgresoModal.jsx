import { Icons } from '../ui/Icons';
import useModalExit from '../../hooks/useModalExit';

export default function EgresoModal({ showEgreso, setShowEgreso, egresoType, setEgresoType, egresoMonto, setEgresoMonto, egresoMotivo, setEgresoMotivo, submitEgreso, estimatedCash }) {
  const { rendered, closing } = useModalExit(showEgreso);
  if (!rendered) return null;
  const isIngreso = egresoType === 'ingreso';
  // 'gasto' y 'retiro' son las dos variantes de "saqué efectivo": gasto resta
  // de la ganancia en Reportes (luz, insumos...), retiro es plata que ya era
  // tuya y solo sale del cajón. El toggle grande no distingue esto — aparece
  // como un paso secundario chico solo cuando elegís "Saqué efectivo".
  const isSaque = egresoType === 'gasto' || egresoType === 'retiro';
  const montoNum = parseFloat(egresoMonto) || 0;
  // Solo advertimos cuando sale plata (gasto/retiro) y supera lo que debería haber
  // en el cajón ahora mismo — evita que el operador registre un retiro imposible
  // sin darse cuenta y se confunda después al ver el faltante en el cierre.
  const excedeCajon = isSaque && estimatedCash != null && montoNum > estimatedCash;

  const closeAndReset = () => { setShowEgreso(false); setEgresoMonto(''); setEgresoMotivo(''); setEgresoType('gasto'); };

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={closeAndReset}>
      <div className={`modal-content${closing ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
        <h2 className="modal-title" style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>Movimiento de caja</h2>

        {/* Toggle principal — simple, dos opciones. Icono y texto en fila
            (no apilados) para que entren en un solo renglón parejo. */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <button onClick={() => setEgresoType('retiro')}
            style={{ flex: 1, padding: '13px 6px', borderRadius: '10px', border: '2px solid', borderColor: isSaque ? 'var(--accent-danger)' : 'var(--border-color)', background: isSaque ? 'rgba(239,68,68,0.12)' : 'transparent', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Icons.Minus style={{ width: 13, height: 13, color: 'var(--accent-danger)', flexShrink: 0 }} />
            Retirar efectivo
          </button>
          <button onClick={() => setEgresoType('ingreso')}
            style={{ flex: 1, padding: '13px 6px', borderRadius: '10px', border: '2px solid', borderColor: isIngreso ? 'var(--accent-success)' : 'var(--border-color)', background: isIngreso ? 'rgba(16,185,129,0.12)' : 'transparent', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Icons.Plus style={{ width: 13, height: 13, color: 'var(--accent-success)', flexShrink: 0 }} />
            Ingresar efectivo
          </button>
        </div>

        {/* Sub-elección compacta — solo al retirar, para que Reportes calcule bien la ganancia */}
        {isSaque && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            <button onClick={() => setEgresoType('gasto')}
              style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid', borderColor: egresoType === 'gasto' ? 'var(--accent-warning)' : 'var(--border-color)', background: egresoType === 'gasto' ? 'rgba(245,158,11,0.12)' : 'transparent', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
              Fue un gasto (luz, insumos...)
            </button>
            <button onClick={() => setEgresoType('retiro')}
              style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid', borderColor: egresoType === 'retiro' ? 'var(--accent-primary)' : 'var(--border-color)', background: egresoType === 'retiro' ? 'rgba(20,187,166,0.12)' : 'transparent', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
              Fue para mí
            </button>
          </div>
        )}

        <div className="input-group"><label>{isIngreso ? 'Monto que agregaste ($)' : 'Monto a retirar ($)'}</label>
          <input type="text" value={egresoMonto} onChange={e => setEgresoMonto(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => { if (e.key === 'Escape') closeAndReset(); if (e.key === 'Enter') document.getElementById('egresoMotivoInput')?.focus(); }}
            placeholder="0" style={{ fontSize: '2rem', padding: '16px' }} autoFocus />
        </div>
        {excedeCajon && (
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icons.Alert style={{ width: 18, height: 18, flexShrink: 0, color: 'var(--accent-warning)' }} />
            <span style={{ color: 'var(--accent-warning)', fontSize: '0.85rem', fontWeight: 600 }}>
              El cajón debería tener ${Math.round(estimatedCash).toLocaleString('es-AR')} — estás sacando más de lo que hay. Revisá el monto.
            </span>
          </div>
        )}
        <div className="input-group"><label>{isIngreso ? '¿De dónde salió esa plata?' : '¿Para qué se usó?'}</label>
          <input id="egresoMotivoInput" type="text" value={egresoMotivo} onChange={e => setEgresoMotivo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && egresoMonto && egresoMotivo) submitEgreso(); }}
            placeholder={isIngreso ? "Ej: Fondo de cambio..." : "Ej: Pago de luz, retiro para vos..."}
            style={{ fontSize: '1.25rem', fontFamily: 'var(--font-main)', padding: '16px' }} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-modal-cancel" onClick={closeAndReset}>Cancelar (Esc)</button>
          <button className="btn btn-modal-confirm" style={{ background: isIngreso ? 'var(--accent-success)' : 'var(--accent-danger)' }} onClick={submitEgreso} disabled={!egresoMonto || !egresoMotivo}>
            {isIngreso ? 'Ingresar efectivo' : 'Retirar efectivo'}
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Icons } from '../ui/Icons';

function CierresAnterioresModal({ showCierres, setShowCierres, cierresData }) {
  if (!showCierres) return null;
  return (
    <div className="modal-overlay" onClick={() => setShowCierres(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem' }}><Icons.Clipboard /> Cierres Anteriores</h2>
        {cierresData.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No hay cierres registrados.</p> : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr style={{ borderBottom: '2px solid var(--border-focus)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Fecha</th><th style={{ padding: '12px 16px' }}>Operador</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ventas</th><th style={{ padding: '12px 16px', textAlign: 'right' }}>Contado</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Diferencia</th><th style={{ padding: '12px 16px' }}>Estado</th>
              </tr></thead>
              <tbody>{cierresData.map(t => { const diff = (t.counted_cash || 0) - (t.sales_total || 0); return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-focus)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{new Date(t.closed_at || t.opened_at).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.operator || '-'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${(t.sales_total||0).toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>${(t.counted_cash||0).toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: diff===0?'var(--accent-success)':'var(--accent-danger)' }}>{diff===0?'$0':`${diff>0?'+':''}$${diff.toLocaleString('es-AR')}`}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: diff===0?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)', color: diff===0?'var(--accent-success)':'var(--accent-danger)', padding:'4px 12px', borderRadius:'8px', fontWeight:700, fontSize:'0.85rem' }}>
                      {diff===0 ? <><Icons.CheckCircle /> OK</> : <><Icons.XCircle /> Diferencia</>}
                    </span>
                  </td>
                </tr>); })}
              </tbody>
            </table>
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: '16px' }}><button className="btn btn-modal-confirm" onClick={() => setShowCierres(false)}>Cerrar</button></div>
      </div>
    </div>
  );
}

export default CierresAnterioresModal;

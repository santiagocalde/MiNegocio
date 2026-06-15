import React from 'react';
import { Icons } from '../ui/Icons';

function ResumenModal({ showResumen, setShowResumen, resumenData, businessConfig, addToast }) {
  if (!showResumen) return null;
  return (
    <div className="modal-overlay" onClick={() => setShowResumen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem' }}><Icons.Activity /> Resumen del Dia</h2>
        {resumenData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
            {[['Total Vendido', `$${(resumenData.total_vendido || 0).toLocaleString('es-AR')}`, 'var(--accent-success)'],
              ['Cantidad de Tickets', String(resumenData.total_tickets || 0), ''],
              ['Fiado', `$${(resumenData.total_fiado || 0).toLocaleString('es-AR')}`, 'var(--accent-warning)'],
              ['Efectivo en Caja', `$${(resumenData.total_efectivo || 0).toLocaleString('es-AR')}`, 'var(--accent-primary)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 800, fontSize: '1.5rem', fontFamily: 'var(--font-mono)', color: color || 'var(--text-primary)' }}>{val}</span>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-modal-cancel" onClick={() => setShowResumen(false)}>Cerrar</button>
          <button className="btn btn-modal-confirm" onClick={() => {
            const w = window.open('', '_blank');
            if (!w) { addToast('Permiti ventanas emergentes para imprimir', 'error'); return; }
            const d = w.document;
            d.write('<!DOCTYPE html><html><head><title></title></head><body></body></html>');
            d.close();
            const meta = d.createElement('meta'); meta.charset = 'utf-8'; d.head.appendChild(meta);
            const title = d.createElement('title'); title.textContent = 'Resumen - ' + new Date().toLocaleDateString('es-AR'); d.head.appendChild(title);
            const style = d.createElement('style'); style.textContent = 'body{font-family:monospace;font-size:14px;padding:40px}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd}.right{text-align:right}'; d.head.appendChild(style);
            const h1 = d.createElement('h1'); h1.textContent = businessConfig.nombre || 'Kiosco'; d.body.appendChild(h1);
            const h2 = d.createElement('h2'); h2.textContent = new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' }); d.body.appendChild(h2);
            const table = d.createElement('table');
            const thead = d.createElement('thead'); const hRow = d.createElement('tr');
            ['Metrica', 'Valor'].forEach(t => { const th = d.createElement('th'); th.textContent = t; hRow.appendChild(th); });
            thead.appendChild(hRow); table.appendChild(thead);
            const tbody = d.createElement('tbody');
            [['Total vendido', '$' + (resumenData?.total_vendido || 0).toLocaleString('es-AR')],
             ['Ticket promedio', '$' + ((resumenData?.total_vendido || 0) / Math.max(1, resumenData?.total_tickets || 1)).toLocaleString('es-AR', { maximumFractionDigits: 2 })],
             ['Cantidad de tickets', String(resumenData?.total_tickets || 0)],
             ['Fiado pendiente', '$' + (resumenData?.total_fiado || 0).toLocaleString('es-AR')],
            ].forEach(([label, val]) => {
              const tr = d.createElement('tr'); const td1 = d.createElement('td'); td1.textContent = label; tr.appendChild(td1);
              const td2 = d.createElement('td'); td2.textContent = val; td2.style.textAlign = 'right'; tr.appendChild(td2); tbody.appendChild(tr);
            });
            table.appendChild(tbody); d.body.appendChild(table);
            const footer = d.createElement('div'); footer.style.cssText = 'text-align:center;margin-top:40px;color:#999;font-size:11px'; footer.textContent = 'Generado por MiNegocio'; d.body.appendChild(footer);
            setTimeout(() => { w.focus(); w.print(); }, 300);
          }} style={{ background: 'var(--accent-primary)' }}><Icons.Printer /> Imprimir resumen</button>
        </div>
      </div>
    </div>
  );
}

export default ResumenModal;

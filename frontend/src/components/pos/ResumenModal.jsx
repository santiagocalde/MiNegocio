import React from 'react';
import { Icons } from '../ui/Icons';

function ResumenModal({ showResumen, setShowResumen, resumenData, businessConfig, addToast }) {
  if (!showResumen) return null;

  const fmt = (n) => '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 });

  const rows = [
    ['💰 Total Vendido',          fmt(resumenData?.total_vendido),       'var(--accent-success)'],
    ['🎫 Cantidad de Tickets',    String(resumenData?.total_tickets || 0), ''],
    ['📊 Ticket Promedio',        fmt((resumenData?.total_vendido || 0) / Math.max(1, resumenData?.total_tickets || 1)), ''],
    ['💵 Efectivo en Caja',       fmt(resumenData?.total_efectivo),      'var(--accent-primary)'],
    ['💳 Tarjeta Débito',         fmt(resumenData?.total_tarjeta),       'var(--text-primary)'],
    ['🏦 Transferencias',         fmt(resumenData?.total_transferencia), 'var(--text-primary)'],
    ['📋 Fiado Pendiente',        fmt(resumenData?.total_fiado),         'var(--accent-warning)'],
  ];

  return (
    <div className="modal-overlay" onClick={() => setShowResumen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
        <h2 className="modal-title" style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icons.Activity /> Resumen del Día
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 16px' }}>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        {resumenData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-main)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{label}</span>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', fontFamily: 'var(--font-mono)', color: color || 'var(--text-primary)' }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button className="btn btn-modal-cancel" onClick={() => setShowResumen(false)}>Cerrar</button>
          <button className="btn btn-modal-confirm" onClick={() => {
            const w = window.open('', '_blank');
            if (!w) { addToast('Permití ventanas emergentes para imprimir', 'error'); return; }
            const d = w.document;
            d.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resumen</title><style>body{font-family:monospace;font-size:14px;padding:40px}h1,h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:10px 12px;border-bottom:1px solid #ddd}.val{text-align:right;font-weight:bold}footer{text-align:center;margin-top:40px;color:#999;font-size:11px}</style></head><body></body></html>');
            d.close();
            const h1 = d.createElement('h1'); h1.textContent = businessConfig?.nombre || 'Mi Negocio'; d.body.appendChild(h1);
            const h2 = d.createElement('h2'); h2.textContent = new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' }); d.body.appendChild(h2);
            const table = d.createElement('table');
            const tbody = d.createElement('tbody');
            rows.forEach(([label, val]) => {
              const tr = d.createElement('tr');
              const td1 = d.createElement('td'); td1.textContent = label; tr.appendChild(td1);
              const td2 = d.createElement('td'); td2.textContent = val; td2.className = 'val'; tr.appendChild(td2);
              tbody.appendChild(tr);
            });
            table.appendChild(tbody); d.body.appendChild(table);
            const footer = d.createElement('footer'); footer.textContent = 'Generado por MiNegocio'; d.body.appendChild(footer);
            setTimeout(() => { w.focus(); w.print(); }, 300);
          }} style={{ background: 'var(--accent-primary)' }}>
            <Icons.Printer /> Imprimir Resumen
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResumenModal;

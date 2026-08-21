
import { useEffect, useState } from 'react';
import { Icons } from '../ui/Icons';
import { usePanelContext } from '../../context/PanelContext';
import { apiGet } from '../../services/apiClient';
import CategoryBreakdown from './CategoryBreakdown';
import TopProductsList from './TopProductsList';
import useModalExit from '../../hooks/useModalExit';

/** Icono inline 16 × 16, color heredado del padre */
const Ico = ({ icon: Icon }) => (
  <span style={{ width: 16, height: 16, display: 'inline-flex', flexShrink: 0, color: 'var(--text-faint)', verticalAlign: 'middle' }}>
    <Icon />
  </span>
);

function ResumenModal({ showResumen, setShowResumen, resumenData, businessConfig, addToast }) {
  const { businessType } = usePanelContext();
  const isCorralon = businessType === 'corralon';

  const [corralonData, setCorralonData] = useState(null);
  const [corralonLoading, setCorralonLoading] = useState(false);

  useEffect(() => {
    if (!showResumen || !isCorralon) return;
    let cancelled = false;
    setCorralonLoading(true);
    Promise.all([
      apiGet('/remitos?status=pending&limit=500').then(r => r.ok ? r.json() : []).catch(() => []),
      apiGet('/quotes?status=draft&limit=200').then(r => r.ok ? r.json() : []).catch(() => []),
      apiGet('/quotes?status=sent&limit=200').then(r => r.ok ? r.json() : []).catch(() => []),
      apiGet('/acopios?status=active&limit=200').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([remPend, qDraft, qSent, acopios]) => {
      if (cancelled) return;
      setCorralonData({
        remitos_pendientes: remPend.length,
        presupuestos_activos: qDraft.length + qSent.length,
        acopios_activos: acopios.length,
        acopios_monto: acopios.reduce((s, a) => s + (a.total || 0), 0),
      });
      setCorralonLoading(false);
    });
    return () => { cancelled = true; };
  }, [showResumen, isCorralon]);

  const { rendered, closing } = useModalExit(showResumen);
  if (!rendered) return null;

  const fmt  = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');
  const fmtN = (n) => String(n ?? 0);

  // ── Kiosco: filas planas ──
  const kioscRows = [
    ['Total vendido',       fmt(resumenData?.total_vendido),       'var(--accent-success)'],
    ['Tickets',             fmtN(resumenData?.total_tickets),      ''],
    ['Ticket promedio',     fmt((resumenData?.total_vendido || 0) / Math.max(1, resumenData?.total_tickets || 1)), ''],
    ['Efectivo',            fmt(resumenData?.total_efectivo),      'var(--accent-primary)'],
    ['Tarjeta',             fmt(resumenData?.total_tarjeta),       'var(--text-primary)'],
    ['Transferencias',      fmt(resumenData?.total_transferencia), 'var(--text-primary)'],
    ['QR',                  fmt(resumenData?.total_mp),            'var(--text-primary)'],
    ['Fiado pendiente',     fmt(resumenData?.total_fiado),         'var(--accent-warning)'],
  ];

  const topProducts = Array.isArray(resumenData?.productos_top) ? resumenData.productos_top : [];

  // ── Corralón: secciones ──
  const cajaSections = [
    { label: 'Total facturado',   value: fmt(resumenData?.total_vendido),       color: 'var(--accent-success)', big: true },
    { label: 'Efectivo',          value: fmt(resumenData?.total_efectivo),      color: 'var(--accent-primary)' },
    { label: 'Tarjeta',           value: fmt(resumenData?.total_tarjeta),       color: 'var(--text-primary)' },
    { label: 'Transferencias',    value: fmt(resumenData?.total_transferencia), color: 'var(--text-primary)' },
    { label: 'QR',                value: fmt(resumenData?.total_mp),            color: 'var(--text-primary)' },
    { label: 'Cuenta corriente',  value: fmt(resumenData?.total_fiado),         color: 'var(--accent-warning)' },
  ];
  const despachoPending = corralonData?.remitos_pendientes ?? 0;
  const presActivos     = corralonData?.presupuestos_activos ?? 0;
  const acopiosN        = corralonData?.acopios_activos ?? 0;
  const acopiosMonto    = corralonData?.acopios_monto ?? 0;

  // filas para impresión (corralón)
  const corralonPrintRows = [
    ['Total facturado',       fmt(resumenData?.total_vendido)],
    ['Efectivo',              fmt(resumenData?.total_efectivo)],
    ['Tarjeta',               fmt(resumenData?.total_tarjeta)],
    ['Transferencias',        fmt(resumenData?.total_transferencia)],
    ['QR',                    fmt(resumenData?.total_mp)],
    ['Cta. corriente',        fmt(resumenData?.total_fiado)],
    ['— Despacho —',         ''],
    ['Notas pendientes',      fmtN(despachoPending)],
    ['Presupuestos activos',  fmtN(presActivos)],
    ['Acopios sin retirar',   acopiosN > 0 ? `${fmtN(acopiosN)} (${fmt(acopiosMonto)})` : '0'],
  ];

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) { addToast('Permití ventanas emergentes para imprimir', 'error'); return; }
    const d = w.document;
    const printRows = isCorralon ? corralonPrintRows : kioscRows.map(([l, v]) => [l, v]);
    d.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resumen</title><style>body{font-family:monospace;font-size:14px;padding:40px}h1,h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:10px 12px;border-bottom:1px solid #ddd}.val{text-align:right;font-weight:bold}.sep{color:#999;font-style:italic;border-bottom:2px solid #ccc}footer{text-align:center;margin-top:40px;color:#999;font-size:11px}</style></head><body></body></html>');
    d.close();
    const h1 = d.createElement('h1'); h1.textContent = businessConfig?.nombre || 'Mi Negocio'; d.body.appendChild(h1);
    const h2 = d.createElement('h2'); h2.textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); d.body.appendChild(h2);
    const table = d.createElement('table');
    const tbody = d.createElement('tbody');
    printRows.forEach(([label, val]) => {
      const tr = d.createElement('tr');
      if (val === '') { tr.className = 'sep'; const td = d.createElement('td'); td.colSpan = 2; td.textContent = label; tr.appendChild(td); }
      else { const td1 = d.createElement('td'); td1.textContent = label; const td2 = d.createElement('td'); td2.textContent = val; td2.className = 'val'; tr.appendChild(td1); tr.appendChild(td2); }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); d.body.appendChild(table);
    const footer = d.createElement('footer'); footer.textContent = 'Generado por MiNegocio'; d.body.appendChild(footer);
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={() => setShowResumen(false)}>
      <div className={`modal-content${closing ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '100%', maxHeight: '88dvh', overflowY: 'auto' }}>

        {/* Header */}
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icons.Activity /> {isCorralon ? 'Cierre del día' : 'Resumen del Día'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '-12px 0 18px', textAlign: 'center' }}>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        {/* ── Kiosco — mismo lenguaje de tarjetas que Cierre de Turno ── */}
        {!isCorralon && resumenData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total vendido hoy</div>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--accent-success)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{fmt(resumenData?.total_vendido)}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {fmtN(resumenData?.total_tickets)} tickets — promedio {fmt((resumenData?.total_vendido || 0) / Math.max(1, resumenData?.total_tickets || 1))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-main)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>Ventas por método</div>
                {[
                  ['Efectivo', resumenData?.total_efectivo],
                  ['Tarjeta', resumenData?.total_tarjeta],
                  ['Transferencia', resumenData?.total_transferencia],
                  ['QR', resumenData?.total_mp],
                ].map(([label, val], i, arr) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', fontSize: '0.9rem', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt(val)}</span>
                  </div>
                ))}
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>Fiado</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px' }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: (resumenData?.total_fiado || 0) > 0 ? 'var(--accent-warning)' : 'var(--text-faint)' }}>{fmt(resumenData?.total_fiado)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>pendiente de cobro</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Corralón ── */}
        {isCorralon && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Sección caja */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', paddingLeft: '2px' }}>
                Caja
              </div>
              <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
                {cajaSections.map(({ label, value, color, big }) => (
                  <div key={label} className="ledger-row" style={{ padding: '10px 16px' }}>
                    <span className="ledger-label" style={{ fontSize: '0.82rem' }}>{label}</span>
                    <span className="ledger-num" style={{ color, fontSize: big ? '1.4rem' : '1rem', fontWeight: big ? 800 : 700 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección despacho */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', paddingLeft: '2px' }}>
                Despacho y operaciones
              </div>
              {corralonLoading ? (
                <div style={{ color: 'var(--text-faint)', fontSize: '0.85rem', padding: '12px 0', textAlign: 'center' }}>Cargando operaciones...</div>
              ) : (
                <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
                  {/* Notas de pedido */}
                  <div className="ledger-row" style={{ padding: '10px 16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <span className="ledger-label" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Ico icon={Icons.Truck} /> Notas pendientes de entrega
                      </span>
                    </div>
                    <span className="ledger-num" style={{
                      color: despachoPending > 0 ? 'var(--accent-warning)' : 'var(--text-faint)',
                      fontSize: '1.2rem', fontWeight: 800
                    }}>{fmtN(despachoPending)}</span>
                  </div>

                  {/* Presupuestos */}
                  <div className="ledger-row" style={{ padding: '10px 16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <span className="ledger-label" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Ico icon={Icons.File} /> Presupuestos activos
                      </span>
                    </div>
                    <span className="ledger-num" style={{
                      color: presActivos > 0 ? 'var(--accent-primary)' : 'var(--text-faint)',
                      fontSize: '1.2rem', fontWeight: 800
                    }}>{fmtN(presActivos)}</span>
                  </div>

                  {/* Acopios */}
                  <div className="ledger-row" style={{ padding: '10px 16px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span className="ledger-label" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Ico icon={Icons.Box} /> Acopios sin retirar
                      </span>
                      {acopiosN > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 2 }}>
                          Material reservado: {fmt(acopiosMonto)}
                        </div>
                      )}
                    </div>
                    <span className="ledger-num" style={{
                      color: acopiosN > 0 ? 'var(--accent-danger)' : 'var(--text-faint)',
                      fontSize: '1.2rem', fontWeight: 800
                    }}>{fmtN(acopiosN)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Más vendidos + Ventas por categoría — lado a lado, cada uno con su propio tope de altura */}
        {(topProducts.length > 0 || (resumenData?.por_categoria || []).length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: topProducts.length === 0 || (resumenData?.por_categoria || []).length === 0 ? '1fr' : '1fr 1fr', gap: '12px', marginTop: '14px' }}>
            <TopProductsList items={topProducts} compact />
            <CategoryBreakdown items={resumenData?.por_categoria} compact />
          </div>
        )}

        {/* Acciones */}
        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button className="btn btn-modal-cancel" onClick={() => setShowResumen(false)}>Cerrar</button>
          <button className="btn btn-modal-confirm" onClick={handlePrint} style={{ background: 'var(--accent-primary)' }}>
            <Icons.Printer /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResumenModal;

import React, { useState, useEffect, useCallback } from 'react';

function formatPesos(n) {
  return '$ ' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportsModule({ serverUrl, sucursalId }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [summary, setSummary] = useState({ totalVentas: 0, ingresos: 0, metodoUsado: 'Efectivo', pctEfectivo: 0, productoPopular: '...', pctProducto: 0 });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${serverUrl}/sales?limit=200`;
      if (sucursalId) url += `&sucursal_id=${sucursalId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSalesData(data);
        const ingresos = data.reduce((acc, s) => acc + (s.total || 0), 0);
        
        const metodos = {};
        const productos = {};
        let totalItems = 0;
        data.forEach(s => {
          metodos[s.payment_method] = (metodos[s.payment_method] || 0) + 1;
          if (s.items) s.items.forEach(i => {
            productos[i.product_name] = (productos[i.product_name] || 0) + i.quantity;
            totalItems += i.quantity;
          });
        });

        const bestMetodoEntries = Object.entries(metodos).sort((a,b)=>b[1]-a[1]);
        const bestMetodo = bestMetodoEntries[0]?.[0] || 'Efectivo';
        const bestMetodoCount = bestMetodoEntries[0]?.[1] || 0;
        const pctEfectivo = data.length > 0 ? Math.round((bestMetodoCount / data.length) * 100) : 0;

        const bestProductoEntries = Object.entries(productos).sort((a,b)=>b[1]-a[1]);
        const bestProducto = bestProductoEntries[0]?.[0] || 'Varios';
        const bestProductoCount = bestProductoEntries[0]?.[1] || 0;

        setSummary({ 
          totalVentas: data.length, 
          ingresos, 
          metodoUsado: bestMetodo === 'mercadopago' ? 'Mercado Pago' : bestMetodo === 'tarjeta' ? 'Tarjeta' : bestMetodo === 'transferencia' ? 'Transferencia' : 'Efectivo', 
          pctEfectivo, 
          productoPopular: bestProducto, 
          pctProducto: bestProductoCount 
        });
      }
    } catch {
      setSalesData([]);
    }
    setLoading(false);
  }, [serverUrl, sucursalId]);

  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setDate(lastMonth.getDate() - 30);
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(lastMonth.toISOString().split('T')[0]);
    fetchReports();
  }, [fetchReports]);

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* 1. HEADER & FILTERS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Reportes de Ventas</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Historial y analíticas de la caja</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <button style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', height: '42px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg> Filtros
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, paddingLeft: '4px' }}>Fecha desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 16px', borderRadius: '8px', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '42px', fontWeight: 600 }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, paddingLeft: '4px' }}>Fecha hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 16px', borderRadius: '8px', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '42px', fontWeight: 600 }} />
          </div>

          <button style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '42px', height: '42px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem', paddingBottom: '8px' }}>
            ...
          </button>
        </div>
      </div>

      {/* 2. METRICS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        
        {/* Metric 1 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Total de Ventas</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px' }}>{summary.totalVentas}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total de ventas registradas del negocio.</div>
          <svg style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        </div>

        {/* Metric 2 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Ingresos Totales</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px' }}>{formatPesos(summary.ingresos)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ingresos totales registrados del negocio.</div>
          <svg style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>

        {/* Metric 3 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Método de Pago Más Usado</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px' }}>{summary.metodoUsado}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{summary.pctEfectivo}% de las ventas</div>
          <svg style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
        </div>

        {/* Metric 4 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Producto Más Popular</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary.productoPopular}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{summary.pctProducto} ventas</div>
          <svg style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </div>

      </div>

      {/* 3. CONTENT / TABLE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {loading ? (
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Cargando datos...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                      Ventas Realizadas
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Resumen de las ventas realizadas en el periodo seleccionado.</p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                      ... Acciones
                    </button>
                    <div style={{ position: 'relative' }}>
                      <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input type="text" placeholder="Buscar por ID..." style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px 8px 32px', borderRadius: '8px', outline: 'none', fontSize: '0.85rem', width: '250px' }} />
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
                      <tr style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '16px', width: '40px' }}><input type="checkbox" style={{ cursor: 'pointer' }}/></th>
                        <th style={{ padding: '16px' }}>ID</th>
                        <th style={{ padding: '16px' }}>Fecha</th>
                        <th style={{ padding: '16px' }}>Usuario</th>
                        <th style={{ padding: '16px' }}>Cliente</th>
                        <th style={{ padding: '16px' }}>Productos</th>
                        <th style={{ padding: '16px' }}>Método de Pago</th>
                        <th style={{ padding: '16px' }}>Total</th>
                        <th style={{ padding: '16px' }}>Factura</th>
                        <th style={{ padding: '16px' }}>Estado</th>
                        <th style={{ padding: '16px', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.map((sale) => (
                        <tr key={sale.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <td style={{ padding: '16px' }}><input type="checkbox" style={{ cursor: 'pointer' }}/></td>
                          <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{sale.id.toString().padStart(8, '0')}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem' }}>{new Date(sale.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem' }}>{sale.operator}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem' }}>Cliente general</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sale.items?.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'Varios'}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                              {sale.payment_method === 'efectivo' ? 'Efectivo' : sale.payment_method === 'transferencia' ? 'Talo Transferencia' : sale.payment_method === 'tarjeta' ? 'Tarjeta' : sale.payment_method?.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatPesos(sale.total)}</td>
                          <td style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sin factura</td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                              Completada
                            </span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>...</td>
                        </tr>
                      ))}
                      {salesData.length === 0 && (
                        <tr><td colSpan="11" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No hay ventas en este período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
        )}
      </div>
    </div>
  );
}

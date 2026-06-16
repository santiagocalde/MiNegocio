import { useState, useEffect, useCallback } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, SERVER_URL } from '../services/apiClient';
import { SkeletonTable, SkeletonCard } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import useSortable from '../hooks/useSortable.jsx';
import { Icons } from '../components/ui/Icons';

function formatPesos(n) {
  return '$ ' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportsModule() {
  const { currentPlan, currentSucursalId, trialDaysRemaining, isTrialExpired, trialEndDateFormatted } = usePanelContext();
  const serverUrl = SERVER_URL;
  const sucursalId = currentSucursalId;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [summary, setSummary] = useState({ totalVentas: 0, ingresos: 0, metodoUsado: 'Efectivo', pctEfectivo: 0, productoPopular: '...', pctProducto: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSales = searchQuery.trim()
    ? salesData.filter(s =>
        s.id?.toString().includes(searchQuery) ||
        (s.operator && s.operator.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.payment_method && s.payment_method.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : salesData;

  const { sorted: sortedSales, toggleSort, SortIcon } = useSortable(filteredSales, 'created_at');

  const canAccessIA = currentPlan === 'ia' || (currentPlan === 'trial' && !isTrialExpired);
  const isPaid = currentPlan === 'pro' || currentPlan === 'ia';
  const showGate = currentPlan === 'trial' && isTrialExpired && !isPaid;

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let path = `/sales?limit=200`;
      if (dateFrom) path += `&date_from=${dateFrom}`;
      if (dateTo) path += `&date_to=${dateTo}`;
      if (sucursalId) path += `&sucursal_id=${sucursalId}`;
      const res = await apiGet(path);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSalesData(data);
        const ingresos = data.reduce((acc, s) => acc + (s.total || 0), 0);
        
        const metodos = {};
        const productos = {};
        let totalItems = 0;
        data.forEach(s => {
          metodos[s.payment_method] = (metodos[s.payment_method] || 0) + 1;
          if (s.items && Array.isArray(s.items)) s.items.forEach(i => {
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
          metodoUsado: bestMetodo === 'mercadopago' ? 'Mercado Pago' : bestMetodo === 'tarjeta' ? 'Tarjeta' : bestMetodo === 'transferencia' ? 'Transferencia' : (bestMetodo || 'Efectivo'), 
          pctEfectivo, 
          productoPopular: bestProducto, 
          pctProducto: bestProductoCount 
        });
      }
    } catch {
      setSalesData([]);
    }
    if (!silent) setLoading(false);
  }, [serverUrl, sucursalId, dateFrom, dateTo]);

  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setDate(lastMonth.getDate() - 30);
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(lastMonth.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchReports();
      const interval = setInterval(() => fetchReports(true), 15000);
      return () => clearInterval(interval);
    }
  }, [fetchReports, dateFrom, dateTo]);

  const renderReports = () => (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Reportes de Ventas</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Historial y analíticas de la caja</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, paddingLeft: '4px' }}>Fecha desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 16px', borderRadius: '8px', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '42px', fontWeight: 600 }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, paddingLeft: '4px' }}>Fecha hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 16px', borderRadius: '8px', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '42px', fontWeight: 600 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Total de Ventas</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px' }}>{summary.totalVentas}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total de ventas registradas del negocio.</div>
          <svg style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Ingresos Totales</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px' }}>{formatPesos(summary.ingresos)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ingresos totales registrados del negocio.</div>
          <svg style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Método de Pago Más Usado</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px' }}>{summary.metodoUsado}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{summary.pctEfectivo}% de las ventas</div>
          <svg style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Producto Más Popular</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary.productoPopular}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{summary.pctProducto} ventas</div>
          <svg style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--text-secondary)', opacity: 0.5 }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </div>
      </div>

      {canAccessIA ? (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <a href={`${serverUrl}/reports/sales?desde=${dateFrom}&hasta=${dateTo}${sucursalId ? `&sucursal_id=${sucursalId}` : ''}`}
            style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Exportar Ventas Excel
          </a>
          <a href={`${serverUrl}/reports/products`}
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '12px 24px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Exportar Productos Excel
          </a>
        </div>
      ) : (
        <div style={{ marginBottom: '24px', background: 'rgba(20,187,166,0.08)', border: '1px solid rgba(20,187,166,0.15)', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}><Icons.Sparkles /></span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flex: 1 }}>
            {currentPlan === 'pro'
              ? 'Actualizá a plan IA para exportar a Excel y acceder a reportes avanzados.'
              : 'Exportación a Excel disponible en plan IA.'}
          </span>
          <a href="/panel/plan" style={{ background: 'var(--gradient-primary)', color: 'white', textDecoration: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s' }}>Ver Planes</a>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {loading ? (
           <SkeletonTable rows={6} cols={8} />
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
                    <div style={{ position: 'relative' }}>
                      <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input type="text" placeholder="Buscar por ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px 8px 32px', borderRadius: '8px', outline: 'none', fontSize: '0.85rem', width: '250px' }} />
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
                      <tr style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID<SortIcon columnKey="id" /></th>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>Fecha<SortIcon columnKey="created_at" /></th>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('operator')}>Usuario<SortIcon columnKey="operator" /></th>
                        <th style={{ padding: '16px' }}>Productos</th>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('payment_method')}>Metodo de Pago<SortIcon columnKey="payment_method" /></th>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('total')}>Total<SortIcon columnKey="total" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSales.map((sale) => (
                        <tr key={sale.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{sale.id.toString().padStart(8, '0')}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem' }}>{new Date(sale.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem' }}>{sale.operator}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sale.items?.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'Varios'}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                              {sale.payment_method === 'efectivo' ? 'Efectivo' : sale.payment_method === 'transferencia' ? 'Transferencia' : sale.payment_method === 'tarjeta' ? 'Tarjeta' : sale.payment_method?.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatPesos(sale.total)}</td>
                        </tr>
                      ))}
                      {sortedSales.length === 0 && (
                        <tr><td colSpan="6" style={{ padding: 0 }}><EmptyState icon="Report" title="Sin ventas"
                          description="No hay ventas en el período seleccionado. Probá ajustando las fechas." /></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
        )}
      </div>
    </div>
  );

  const renderGate = () => (
    <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}><Icons.Sparkles /></div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Reportes IA</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 8px 0', fontSize: '1rem', lineHeight: 1.6 }}>
          Desbloqueá reportes avanzados, exportación a Excel, análisis predictivo y dashboards inteligentes con nuestro plan IA.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '24px 0', textAlign: 'left', background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
          {[
            { icon: <Icons.Chart />, text: 'Reportes detallados con filtros avanzados' },
            { icon: <Icons.Chart />, text: 'Exportación a Excel con un clic' },
            { icon: <Icons.Sparkles />, text: 'Análisis predictivo de ventas' },
            { icon: <Icons.Crown />, text: 'Producto más vendido por período' },
            { icon: <Icons.Clipboard />, text: 'Dashboard interactivo' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
              <span style={{ color: 'var(--accent-success)' }}>✓</span> {item.icon} {item.text}
            </div>
          ))}
        </div>
        {currentPlan === 'trial' && !isTrialExpired && trialDaysRemaining > 0 && (
          <div style={{ background: 'rgba(20,187,166,0.1)', border: '1px solid rgba(20,187,166,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Icons.Sparkles /> Tenés acceso completo durante tu período de prueba. {trialDaysRemaining > 0 && `Te quedan ${trialDaysRemaining} día${trialDaysRemaining !== 1 ? 's' : ''}`}{trialEndDateFormatted && ` (termina el ${trialEndDateFormatted}).`}
          </div>
        )}
        <a href="/panel/plan"
          style={{ display: 'inline-block', background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '14px 32px', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none', marginTop: 8 }}>
          Ver Planes
        </a>
      </div>
    </div>
  );

  if (showGate) return renderGate();

  return renderReports();
}

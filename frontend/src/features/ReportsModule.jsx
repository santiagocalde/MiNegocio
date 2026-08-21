import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost, SERVER_URL } from '../services/apiClient';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import useSortable from '../hooks/useSortable.jsx';
import { Icons } from '../components/ui/Icons';
import useIsMobile from '../hooks/useIsMobile';
import useModalExit from '../hooks/useModalExit';

function formatPesos(n) {
  return '$ ' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportsModule() {
  const { currentPlan, currentSucursalId, trialDaysRemaining, isTrialExpired, trialEndDateFormatted, auth, addToast } = usePanelContext();
  const isMobile = useIsMobile();
  const sucursalId = currentSucursalId;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [salesData, setSalesData] = useState([]);
  const [ganancias, setGanancias] = useState({ mensual: [], totales: { ingresos: 0, costo: 0, bruto: 0, gastos: 0, retiros: 0, ganancia: 0 } });
  const [summary, setSummary] = useState({ totalVentas: 0, ingresos: 0, metodoUsado: 'Efectivo', pctMetodo: 0, productoPopular: '...', pctProducto: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [estimada, setEstimada] = useState({ ventas: 0, tickets: 0, margen_pct: 35, ganancia_estimada: 0 });
  const [periodKey, setPeriodKey] = useState(null);

  const [menuSale, setMenuSale] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0 });
  const [methodModal, setMethodModal] = useState(null);
  const [methodPick, setMethodPick] = useState('efectivo');
  const [methodBusy, setMethodBusy] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelPin, setCancelPin] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const fmtLocal = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

  // Períodos rápidos (desde 1 semana; los días no muestran margen de ganancia)
  const PERIODS = [
    { key: 'semana', label: 'Esta semana', calc: () => { const d = new Date(); const day = (d.getDay() + 6) % 7; const ini = new Date(d); ini.setDate(d.getDate() - day); return [ini, d]; } },
    { key: 'semana_pasada', label: 'Semana pasada', calc: () => { const d = new Date(); const day = (d.getDay() + 6) % 7; const ini = new Date(d); ini.setDate(d.getDate() - day - 7); const fin = new Date(d); fin.setDate(d.getDate() - day - 1); return [ini, fin]; } },
    { key: '2semanas', label: 'Últimas 2 semanas', calc: () => { const d = new Date(); const ini = new Date(d); ini.setDate(d.getDate() - 13); return [ini, d]; } },
    { key: '3semanas', label: 'Últimas 3 semanas', calc: () => { const d = new Date(); const ini = new Date(d); ini.setDate(d.getDate() - 20); return [ini, d]; } },
    { key: 'mes', label: 'Este mes', calc: () => { const d = new Date(); return [new Date(d.getFullYear(), d.getMonth(), 1), d]; } },
    { key: 'mes_pasado', label: 'Mes pasado', calc: () => { const d = new Date(); const ini = new Date(d.getFullYear(), d.getMonth() - 1, 1); const fin = new Date(d.getFullYear(), d.getMonth(), 0); return [ini, fin]; } },
  ];

  const applyPeriod = (p) => {
    const [ini, fin] = p.calc();
    setDateFrom(fmtLocal(ini));
    setDateTo(fmtLocal(fin));
    setPeriodKey(p.key);
  };

  const periodLabel = PERIODS.find(p => p.key === periodKey)?.label || 'Período personalizado';

  const fetchEstimada = useCallback(async () => {
    try {
      let path = '/reports/estimada';
      if (dateFrom) path += `?desde=${dateFrom}`;
      if (dateTo) path += `&hasta=${dateTo}`;
      const res = await apiGet(path);
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.ventas === 'number') setEstimada(data);
    } catch { /* noop */ }
  }, [dateFrom, dateTo]);

  const filteredSales = searchQuery.trim()
    ? salesData.filter(s =>
        s.id?.toString().includes(searchQuery) ||
        (s.operator && s.operator.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.payment_method && s.payment_method.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : salesData;

  const { sorted: sortedSales, toggleSort, SortIcon } = useSortable(filteredSales, 'created_at');

  const canExport = currentPlan === 'pro' || currentPlan === 'ia' || (currentPlan === 'trial' && !isTrialExpired);
  const isPaid = currentPlan === 'pro' || currentPlan === 'ia';
  const showGate = currentPlan === 'trial' && isTrialExpired && !isPaid;

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let path = `/sales?limit=500`;
      if (dateFrom) path += `&date_from=${dateFrom}`;
      if (dateTo) path += `&date_to=${dateTo}`;
      if (sucursalId) path += `&sucursal_id=${sucursalId}`;
      const res = await apiGet(path);
      const data = await res.json();
      if (Array.isArray(data)) {
        // La tabla muestra TODAS las ventas (incluidas las anuladas, marcadas
        // visualmente) para no perder el rastro auditable. Pero los totales
        // del resumen (ingresos, método más usado, producto popular) deben
        // calcularse SOLO con ventas vigentes — si no, una venta anulada
        // sigue sumando plata que en realidad se revirtió.
        setSalesData(data);
        const activas = data.filter(s => !s.reverted);
        const ingresos = activas.reduce((acc, s) => acc + (s.total || 0), 0);

        const metodos = {};
        const productos = {};
        activas.forEach(s => {
          metodos[s.payment_method] = (metodos[s.payment_method] || 0) + 1;
          if (s.items && Array.isArray(s.items)) s.items.forEach(i => {
            productos[i.product_name] = (productos[i.product_name] || 0) + i.quantity;
          });
        });

        const bestMetodoEntries = Object.entries(metodos).sort((a,b)=>b[1]-a[1]);
        const bestMetodo = bestMetodoEntries[0]?.[0] || 'Efectivo';
        const bestMetodoCount = bestMetodoEntries[0]?.[1] || 0;
        const pctMetodo = activas.length > 0 ? Math.round((bestMetodoCount / activas.length) * 100) : 0;

        const bestProductoEntries = Object.entries(productos).sort((a,b)=>b[1]-a[1]);
        const bestProducto = bestProductoEntries[0]?.[0] || 'Varios';
        const bestProductoCount = bestProductoEntries[0]?.[1] || 0;

        const metodosLabel = { mercadopago: 'QR', tarjeta: 'Tarjeta', transferencia: 'Transferencia', efectivo: 'Efectivo', mixto: 'Pago Mixto' };
        setSummary({
          totalVentas: activas.length,
          ingresos,
          metodoUsado: metodosLabel[bestMetodo] || bestMetodo || 'Efectivo',
          pctMetodo,
          productoPopular: bestProducto,
          pctProducto: bestProductoCount
        });
      }
      setFetchError('');
    } catch(err) {
      console.error('Reports fetch error:', err);
      setFetchError(`Error al cargar: ${err?.message || 'desconocido'}`);
      setSalesData([]);
    }
    if (!silent) setLoading(false);
  }, [sucursalId, dateFrom, dateTo]);

  const fetchGanancias = useCallback(async (silent = false) => {
    try {
      let path = `/reports/ganancias`;
      if (dateFrom) path += `?desde=${dateFrom}`;
      if (dateTo) path += `${dateFrom ? '&' : '?'}hasta=${dateTo}`;
      const res = await apiGet(path);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.mensual)) setGanancias(data);
      }
    } catch(err) {
      console.error('Ganancias fetch error:', err);
    }
  }, [dateFrom, dateTo]);

  const METHOD_OPTIONS = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'tarjeta', label: 'Tarjeta' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'mercadopago', label: 'QR' },
  ];
  const METHOD_LABEL = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mercadopago: 'QR', split: 'Pago Mixto' };

  const menuItemStyle = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' };
  const ghostBtn = { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' };
  const primaryBtn = { background: 'var(--accent-primary)', color: 'var(--sheet)', border: '1px solid var(--accent-primary)', padding: '10px 18px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' };

  const openRowMenu = (e, sale) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuW = 215;
    const left = Math.min(rect.left, window.innerWidth - menuW - 12);
    const top = Math.min(rect.bottom + 4, window.innerHeight - 96);
    setMenuAnchor({ top, left });
    setMenuSale(menuSale && menuSale.id === sale.id ? null : sale);
  };

  const submitMethodChange = async () => {
    if (!methodModal) return;
    setMethodBusy(true);
    try {
      const res = await apiPost(`/sales/${methodModal.id}/payment-method`, { payment_method: methodPick });
      if (res.ok) {
        addToast?.('Método de pago actualizado.', 'success');
        setMethodModal(null);
        setMenuSale(null);
        fetchReports(true);
        fetchEstimada();
      } else {
        let msg = 'No se pudo actualizar el método de pago.';
        try { const d = await res.json(); if (d.detail) msg = d.detail; } catch { /* noop */ }
        addToast?.(msg, 'error');
      }
    } catch {
      addToast?.('Error de conexión. Reintentá.', 'error');
    }
    setMethodBusy(false);
  };

  const submitCancel = async () => {
    if (!cancelModal) return;
    setCancelBusy(true);
    try {
      const res = await apiPost(`/sales/${cancelModal.id}/revert?operator=${encodeURIComponent(auth?.currentOperator?.name || 'Sistema')}`, {
        supervisor_pin: cancelPin || undefined,
      });
      if (res.ok) {
        addToast?.('Venta anulada. El stock volvió al inventario.', 'success');
        setCancelModal(null);
        setCancelPin('');
        setMenuSale(null);
        fetchReports(true);
        fetchEstimada();
      } else {
        let msg = 'No se pudo anular la venta.';
        try { const d = await res.json(); if (d.detail) msg = d.detail; } catch { /* noop */ }
        addToast?.(msg, 'error');
      }
    } catch {
      addToast?.('Error de conexión. Reintentá.', 'error');
    }
    setCancelBusy(false);
  };

  useEffect(() => {
    if (dateFrom && dateTo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchGanancias();
    }
  }, [fetchGanancias, dateFrom, dateTo]);

  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setDate(lastMonth.getDate() - 30);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(lastMonth.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchReports();
      const interval = setInterval(() => { fetchReports(true); fetchEstimada(); }, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchReports, fetchEstimada, dateFrom, dateTo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEstimada();
  }, [fetchEstimada]);

  const exportFile = async (path, filename) => {
    try {
      const token = localStorage.getItem('saas_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      let res = await fetch(`${SERVER_URL}${path}`, { headers });
      if (res.status === 401 && token) {
        const refreshToken = localStorage.getItem('saas_refresh_token');
        if (refreshToken) {
          const rr = await fetch(`${SERVER_URL}/auth/refresh`, { method: 'POST', headers: { 'Authorization': `Bearer ${refreshToken}`, 'Content-Type': 'application/json' } });
          if (rr.ok) {
            const d = await rr.json();
            localStorage.setItem('saas_token', d.access_token);
            if (d.refresh_token) localStorage.setItem('saas_refresh_token', d.refresh_token);
            res = await fetch(`${SERVER_URL}${path}`, { headers: { 'Authorization': `Bearer ${d.access_token}` } });
          }
        }
      }
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFetchError('No se pudo exportar. Reintentá.');
    }
  };

  // Hooks incondicionales — renderReports/renderGate son funciones que
  // devuelven JSX pero se invocan condicionalmente al final del componente,
  // así que estos hooks NO pueden ir adentro de ellas.
  const methodExit = useModalExit(!!methodModal);
  const methodDataRef = useRef(null);
  if (methodModal) methodDataRef.current = methodModal;
  const methodData = methodModal || methodDataRef.current;
  const cancelExit = useModalExit(!!cancelModal);
  const cancelDataRef = useRef(null);
  if (cancelModal) cancelDataRef.current = cancelModal;
  const cancelData = cancelModal || cancelDataRef.current;

  const renderReports = () => (
    <div style={{ padding: isMobile ? '12px 14px' : '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden' }}>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-end', gap: isMobile ? '10px' : '12px', marginBottom: '18px', flexShrink: 0 }}>
        <div>
          <div className="ledger-label">Libro de ventas</div>
          <h1 className="ledger-title" style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', marginTop: 4 }}>Cómo venís</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: isMobile ? 1 : undefined }}>
            <label className="ledger-label">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ background: 'var(--sheet)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 10px', borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '42px', fontWeight: 600, width: '100%', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: isMobile ? 1 : undefined }}>
            <label className="ledger-label">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ background: 'var(--sheet)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0 10px', borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '42px', fontWeight: 600, width: '100%', boxSizing: 'border-box' }} />
          </div>

          <button onClick={() => fetchReports()} disabled={loading} title="Actualizar" style={{ height: '42px', padding: '0 16px', background: 'var(--accent-primary)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--sheet)', cursor: loading ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end' }}>
            Actualizar
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: 'var(--accent-danger)', fontSize: '0.9rem', flexShrink: 0 }}>
          ⚠️ {fetchError} — verificá tu conexión a internet.
        </div>
      )}

      {/* Períodos rápidos para el margen (semana a mes) */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', flexShrink: 0 }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => applyPeriod(p)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.15s',
              borderColor: periodKey === p.key ? 'var(--accent-primary)' : 'var(--border-color)',
              background: periodKey === p.key ? 'rgba(20,187,166,0.12)' : 'var(--bg-card)',
              color: periodKey === p.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* En mobile: 2 cards por fila, pero compactas y con font menor para no desbordar */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '8px' : '16px', marginBottom: '24px', flexShrink: 0 }}>
        <div className="ledger-sheet" style={{ padding: isMobile ? '10px' : '20px', position: 'relative', minWidth: 0 }}>
          <div className="ledger-label" style={{ marginBottom: isMobile ? '6px' : '12px', fontSize: isMobile ? '0.65rem' : undefined }}>Total Ventas</div>
          <div className="ledger-num" style={{ fontSize: isMobile ? '1.4rem' : '1.7rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{formatPesos(estimada.ventas)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: isMobile ? 'none' : undefined }}>{estimada.tickets} tickets en el período.</div>
        </div>

        <div className="ledger-sheet" style={{ padding: isMobile ? '10px' : '20px', position: 'relative', minWidth: 0 }}>
          <div className="ledger-label" style={{ marginBottom: isMobile ? '6px' : '12px', fontSize: isMobile ? '0.65rem' : undefined }}>Ingresos</div>
          <div className="ledger-num" style={{ fontSize: isMobile ? '1.1rem' : '1.7rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatPesos(estimada.ventas)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: isMobile ? 'none' : undefined }}>Ingresos totales del período.</div>
        </div>

        <div className="ledger-sheet" style={{ padding: isMobile ? '10px' : '20px', position: 'relative', minWidth: 0 }}>
          <div className="ledger-label" style={{ marginBottom: isMobile ? '6px' : '12px', fontSize: isMobile ? '0.65rem' : undefined }}>Pago más usado</div>
          <div style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.metodoUsado}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: isMobile ? 'none' : undefined }}>{summary.pctMetodo}% de las ventas</div>
        </div>

        <div className="ledger-sheet" style={{ padding: isMobile ? '10px' : '20px', position: 'relative', minWidth: 0 }}>
          <div className="ledger-label" style={{ marginBottom: isMobile ? '6px' : '12px', fontSize: isMobile ? '0.65rem' : undefined }}>Más popular</div>
          <div style={{ fontSize: isMobile ? '1rem' : '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.productoPopular}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{summary.pctProducto} ventas</div>
        </div>
      </div>

      {/* Ganancia estimada por margen configurable */}
      <div className="ledger-sheet" style={{ marginBottom: '20px', padding: isMobile ? '14px 16px' : '18px 24px', flexShrink: 0, border: '1px solid rgba(20,187,166,0.25)', background: 'linear-gradient(135deg, rgba(20,187,166,0.07), rgba(20,187,166,0.02) 60%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div className="ledger-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Margen estimado · {periodLabel}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Ventas {formatPesos(estimada.ventas)} × margen <strong style={{ color: 'var(--text-primary)' }}>{estimada.margen_pct}%</strong>
              <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-faint)' }}>(lo cambiás en Configuración → Margen de ganancia estimado)</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="ledger-num" style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 800, color: 'var(--accent-success)', fontVariantNumeric: 'tabular-nums' }}>
              {formatPesos(estimada.ganancia_estimada)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Tu ganancia estimada del período</div>
          </div>
        </div>
      </div>

      {ganancias.mensual.length > 0 && (
        <div className="ledger-sheet" style={{ marginBottom: '20px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                Ganancias Mensuales
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Ganancia neta = ventas - costo de mercadería - gastos del periodo.</p>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: ganancias.totales.ganancia >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
              {formatPesos(ganancias.totales.ganancia)}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px' }}>Mes</th>
                  <th style={{ padding: '12px 16px' }}>Ingresos</th>
                  <th style={{ padding: '12px 16px' }}>Costo</th>
                  <th style={{ padding: '12px 16px' }}>Gastos</th>
                  <th style={{ padding: '12px 16px' }}>Retiros</th>
                  <th style={{ padding: '12px 16px' }}>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {ganancias.mensual.map((m) => (
                  <tr key={m.mes} style={{ borderBottom: '1px solid var(--rule)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='var(--surface-veil)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{m.mes}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{formatPesos(m.ingresos)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatPesos(m.costo)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatPesos(m.gastos)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{formatPesos(m.retiros)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: m.ganancia >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {formatPesos(m.ganancia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canExport ? (
        <div style={{ display: 'flex', gap: '12px', marginBottom: isMobile ? '12px' : '24px', flexWrap: 'wrap' }}>
          <button onClick={() => exportFile(`/reports/sales?desde=${dateFrom}&hasta=${dateTo}${sucursalId ? `&sucursal_id=${sucursalId}` : ''}`, `ventas_${dateFrom}_${dateTo}.xlsx`)}
            style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Exportar Ventas Excel
          </button>
          <button onClick={() => exportFile('/reports/products', 'productos.xlsx')}
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '12px 24px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Exportar Productos Excel
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: '24px', background: 'rgba(20,187,166,0.08)', border: '1px solid rgba(20,187,166,0.15)', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}><Icons.Sparkles /></span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flex: 1 }}>
            Exportación a Excel disponible en plan Pro.
          </span>
          <a href="/panel/plan" style={{ background: 'var(--accent-primary)', color: 'var(--sheet)', textDecoration: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s' }}>Ver Planes</a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {loading ? (
           <SkeletonTable rows={6} cols={8} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
                
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
                      <input type="text" placeholder="Buscar por ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px 8px 32px', borderRadius: '8px', outline: 'none', fontSize: '0.85rem', width: isMobile ? '100%' : '250px', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
                      <tr style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID<SortIcon columnKey="id" /></th>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('timestamp')}>Fecha<SortIcon columnKey="timestamp" /></th>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('operator')}>Usuario<SortIcon columnKey="operator" /></th>
                        <th style={{ padding: '16px' }}>Productos</th>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('payment_method')}>Metodo de Pago<SortIcon columnKey="payment_method" /></th>
                        <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('total')}>Total<SortIcon columnKey="total" /></th>
                        <th style={{ padding: '16px', width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSales.map((sale) => (
                        <tr key={sale.id} style={{ borderBottom: '1px solid var(--rule)', transition: 'background 0.2s', opacity: sale.reverted ? 0.55 : 1 }} onMouseEnter={e => e.currentTarget.style.background='var(--surface-veil)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{(sale.id ?? '').toString().padStart(8, '0') || '---'}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem' }}>{sale.timestamp ? new Date(sale.timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem' }}>{sale.operator}</td>
                          <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sale.items?.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'Varios'}
                          </td>
                          <td style={{ padding: '16px' }}>
                            {sale.reverted ? (
                              <span style={{ background: 'var(--wash-danger)', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', padding: '3px 9px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 700 }}>
                                ANULADA
                              </span>
                            ) : (
                              <span style={{ background: 'var(--surface-veil)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '3px 9px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 600 }}>
                                {sale.payment_method === 'efectivo' ? 'Efectivo' : sale.payment_method === 'transferencia' ? 'Transferencia' : sale.payment_method === 'tarjeta' ? 'Tarjeta' : sale.payment_method?.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)', textDecoration: sale.reverted ? 'line-through' : 'none' }}>{formatPesos(sale.total)}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {!sale.reverted && (
                              <button onClick={(e) => openRowMenu(e, sale)} title="Acciones"
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}>
                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {sortedSales.length === 0 && (
                        <tr><td colSpan="7" style={{ padding: 0 }}><EmptyState icon="Report" title="Sin ventas"
                          description="No hay ventas en el período seleccionado. Probá ajustando las fechas." /></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
        )}
      </div>

      {menuSale && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setMenuSale(null)} />
          <div style={{ position: 'fixed', top: menuAnchor.top, left: menuAnchor.left, zIndex: 1000, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.35)', minWidth: 215, padding: 6 }}>
            <button onClick={() => { setMethodModal(menuSale); setMethodPick((menuSale.payment_method && METHOD_LABEL[menuSale.payment_method] && menuSale.payment_method !== 'split') ? menuSale.payment_method : 'efectivo'); setMenuSale(null); }}
              style={menuItemStyle}>
              Modificar método de pago
            </button>
            <button onClick={() => { setCancelModal(menuSale); setCancelPin(''); setMenuSale(null); }}
              style={{ ...menuItemStyle, color: 'var(--accent-danger)' }}>
              Cancelar venta
            </button>
          </div>
        </>,
        document.body
      )}

      {methodExit.rendered && methodData && (
        <div className={`modal-overlay${methodExit.closing ? ' closing' : ''}`} onClick={() => setMethodModal(null)}>
          <div className={`modal-content${methodExit.closing ? ' closing' : ''}`} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title" style={{ margin: '0 0 12px 0' }}>Modificar método de pago</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Venta #{String(methodData.id ?? '').padStart(8, '0')} · {formatPesos(methodData.total)} · {METHOD_LABEL[methodData.payment_method] || methodData.payment_method?.toUpperCase() || '—'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {METHOD_OPTIONS.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: `1px solid ${methodPick === opt.value ? 'var(--accent-primary)' : 'var(--border-color)'}`, cursor: 'pointer', background: methodPick === opt.value ? 'rgba(20,187,166,0.08)' : 'var(--bg-card)' }}>
                  <input type="radio" name="method" value={opt.value} checked={methodPick === opt.value} onChange={() => setMethodPick(opt.value)} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{opt.label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setMethodModal(null)} style={ghostBtn}>Cancelar</button>
              <button onClick={submitMethodChange} disabled={methodBusy} style={{ ...primaryBtn, opacity: methodBusy ? 0.6 : 1 }}>
                {methodBusy ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelExit.rendered && cancelData && (
        <div className={`modal-overlay${cancelExit.closing ? ' closing' : ''}`} onClick={() => setCancelModal(null)}>
          <div className={`modal-content${cancelExit.closing ? ' closing' : ''}`} style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title" style={{ margin: '0 0 12px 0' }}>Cancelar venta</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Vas a anular la venta #{String(cancelData.id ?? '').padStart(8, '0')} por <b style={{ color: 'var(--text-primary)' }}>{formatPesos(cancelData.total)}</b>.
              El stock vuelve al inventario y la venta se descuenta de los totales.
            </p>
            <input type="password" inputMode="numeric" maxLength={6} placeholder="PIN de administrador (solo si hay más de un usuario)"
              value={cancelPin} onChange={e => setCancelPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: 16 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setCancelModal(null); setCancelPin(''); }} style={ghostBtn}>No</button>
              <button onClick={submitCancel} disabled={cancelBusy} style={{ ...primaryBtn, background: 'var(--accent-danger)', borderColor: 'var(--accent-danger)', opacity: cancelBusy ? 0.6 : 1 }}>
                {cancelBusy ? 'Anulando...' : 'Sí, cancelar venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderGate = () => (
    <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', boxSizing: 'border-box' }}>
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
          style={{ display: 'inline-block', background: 'var(--accent-primary)', color: 'var(--sheet)', border: 'none', padding: '14px 32px', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none', marginTop: 8 }}>
          Ver Planes
        </a>
      </div>
    </div>
  );

  if (showGate) return renderGate();

  return renderReports();
}

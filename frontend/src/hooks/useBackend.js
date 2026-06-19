import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, SERVER_URL } from '../services/apiClient';

export default function useBackend(currentOperator, currentTurnId, currentSucursalId, addToast) {
  const [productsDB, setProductsDB] = useState([]);
  const [backendError, setBackendError] = useState(false);
  const [backendDetailedError, setBackendDetailedError] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);
  const [backendLastOk, setBackendLastOk] = useState(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [operators, setOperators] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [businessConfig, setBusinessConfig] = useState({});
  const [stockAlerts, setStockAlerts] = useState(null);
  const [showEgreso, setShowEgreso] = useState(false);
  const [egresoMonto, setEgresoMonto] = useState('');
  const [egresoMotivo, setEgresoMotivo] = useState('');
  const [egresoType, setEgresoType] = useState('gasto');
  const [showResumen, setShowResumen] = useState(false);
  const [resumenData, setResumenData] = useState(null);
  const [showDevolucionItems, setShowDevolucionItems] = useState(false);
  const [devolucionQtys, setDevolucionQtys] = useState({});
  const [isReverting, setIsReverting] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [showBackupRestore, setShowBackupRestore] = useState(false);
  const [backupList, setBackupList] = useState([]);
  const [restoring, setRestoring] = useState(false);
  const [mpQrData, setMpQrData] = useState(null);
  const [mpPaymentUrl, setMpPaymentUrl] = useState('');
  const [mpLoading, setMpLoading] = useState(false);
  const [mpPaymentStatus, setMpPaymentStatus] = useState('pending');
  const [mpIntentId, setMpIntentId] = useState('');
  const [expiryAlerts, setExpiryAlerts] = useState(null);
  const [showExpiryAlerts, setShowExpiryAlerts] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [sysLogs, setSysLogs] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showCierres, setShowCierres] = useState(false);
  const [cierresData, setCierresData] = useState([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showPriceCheck, setShowPriceCheck] = useState(false);
  const [priceCheckQuery, setPriceCheckQuery] = useState('');
  const [priceCheckResults, setPriceCheckResults] = useState([]);
  const [showDuplicateCodeModal, setShowDuplicateCodeModal] = useState(false);
  const [duplicateCodeMatches, setDuplicateCodeMatches] = useState([]);

  const fetchProductsDB = useCallback(() => {
    apiGet(`/products?limit=5000&sucursal_id=${currentSucursalId}`)
      .then(r => r.json())
      .then(data => setProductsDB(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [currentSucursalId]);

  const notifyTabs = useCallback((msg) => {
    try { new BroadcastChannel('minegocio-sync').postMessage(msg); } catch {}
  }, []);

  const handleUnpack = useCallback(async (productId) => {
    try {
      const res = await apiPost(`/products/${productId}/unpack?operator=${currentOperator?.name}`, {});
      const data = await res.json();
      addToast(`✅ Desempaquetado: ${data.message || 'OK'}`, 'success');
      fetchProductsDB();
    } catch { addToast('Error al desempaquetar', 'error'); }
  }, [currentOperator, addToast, fetchProductsDB]);

  const handleDevolucionItem = useCallback(async (productId, productName, lastSaleId, devolucionQtysLocal) => {
    try {
      const qty = parseFloat(devolucionQtysLocal?.[productId]) || 1;
      const res = await apiPatch(`/sales/${lastSaleId}/revert-item`, {
        product_id: productId,
        quantity: qty,
        operator: currentOperator?.name || 'Sistema',
      });
      if (res.ok) {
        addToast(`✅ ${productName} devuelto`, 'success');
        fetchProductsDB();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Error al devolver', 'error');
      }
    } catch { addToast('Error de conexión', 'error'); }
  }, [currentOperator, addToast, fetchProductsDB]);

  const handleDevolucion = useCallback(async (lastSaleId) => {
    if (!lastSaleId) return;
    setIsReverting(true);
    try {
      const res = await apiPatch(`/sales/${lastSaleId}/revert?operator=${currentOperator?.name || 'Sistema'}`, {});
      if (res.ok) {
        addToast('✅ Venta anulada completamente', 'success');
        fetchProductsDB();
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Error al anular', 'error');
      }
    } catch { addToast('Error de conexión', 'error'); }
    setIsReverting(false);
  }, [currentOperator, addToast, fetchProductsDB]);

  const handleManualSync = useCallback(async () => {
    const pendingStr = localStorage.getItem('minegocio_pending_sales');
    if (!pendingStr) { addToast('No hay pendientes', 'info'); return; }
    const pending = JSON.parse(pendingStr);
    if (pending.length === 0) { addToast('No hay pendientes', 'info'); return; }
    addToast(`Sincronizando ${pending.length} ventas...`, 'info');
    const batch = [...pending];
    const results = await Promise.allSettled(
      batch.map(item => apiPost(`/sales?idempotency_key=${item.idempotencyKey}`, item.payload))
    );
    const ok = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const remaining = results
      .map((r, i) => r.status === 'fulfilled' && r.value.ok ? null : batch[i])
      .filter(Boolean);
    localStorage.setItem('minegocio_pending_sales', JSON.stringify(remaining));
    setPendingSync(remaining.length);
    addToast(`${ok} sincronizadas, ${remaining.length} pendientes`, ok > 0 ? 'success' : 'error');
  }, [addToast]);

  const submitEgreso = useCallback(async () => {
    if (!egresoMonto || !egresoMotivo) return;
    try {
      const res = await apiPost('/egresos', {
        turn_id: currentTurnId,
        amount: parseFloat(egresoMonto),
        reason: egresoMotivo,
        type: egresoType,
        operator: currentOperator?.name || 'Sistema',
      });
      if (res.ok) {
        addToast(`✅ ${egresoType === 'gasto' ? 'Gasto' : 'Retiro'} registrado`, 'success');
        setShowEgreso(false);
        setEgresoMonto('');
        setEgresoMotivo('');
        setEgresoType('gasto');
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Error', 'error');
      }
    } catch { addToast('Error de conexión', 'error'); }
  }, [egresoMonto, egresoMotivo, egresoType, currentTurnId, currentOperator, addToast]);

  const handleBackup = useCallback(async () => {
    setBackupLoading(true);
    try {
      const res = await apiPost('/backup', {});
      if (res.ok) { addToast('✅ Backup creado', 'success'); }
      else { addToast('Error al hacer backup', 'error'); }
    } catch { addToast('Error de conexión', 'error'); }
    setBackupLoading(false);
  }, [addToast]);

  const getPendingData = useCallback(() => {
    try {
      const raw = localStorage.getItem('minegocio_pending_sales');
      const arr = raw ? JSON.parse(raw) : [];
      const total = arr.reduce((s, item) => s + (item.payload?.total || 0), 0);
      return { count: arr.length, total };
    } catch { return { count: 0, total: 0 }; }
  }, []);

  useEffect(() => {
    fetchProductsDB();
    apiGet('/config').then(r => r.json()).then(d => setBusinessConfig(d)).catch(() => {});
    apiGet('/operators').then(r => r.json()).then(d => setOperators(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet('/sucursales').then(r => r.json()).then(d => setSucursales(Array.isArray(d) ? d : [])).catch(() => {});
    // Item 13: SSE - Escuchar eventos en tiempo real
    const baseUrl = SERVER_URL.replace('/api', '');
    let retryDelay = 1000;
    let evtSource;

    const connectSSE = () => {
      if (evtSource) evtSource.close();
      evtSource = new EventSource(`${baseUrl}/api/events`);
      evtSource.addEventListener('product-changed', () => fetchProductsDB());
      evtSource.addEventListener('sale-created', () => {
        fetchProductsDB();
        apiGet(`/sales/today?sucursal_id=${currentSucursalId}`).then(r => r.json()).then(d => {
          setTodaySalesTotal((d.total_efectivo || 0) + (d.total_tarjeta || 0) + (d.total_transferencia || 0) + (d.total_mp || 0) + (d.total_fiado || 0));
          setResumenData(d);
        }).catch(() => {});
      });
      evtSource.onerror = () => {
        evtSource.close();
        clearTimeout(evtSource._reconnectTimer);
        evtSource._reconnectTimer = setTimeout(() => {
          fetchProductsDB();
          connectSSE();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
      evtSource.onopen = () => { retryDelay = 1000; };
    };
    connectSSE();

    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('minegocio-sync') : null;
    if (bc) {
      bc.onmessage = (e) => {
        if (e.data === 'products-changed') fetchProductsDB();
        if (e.data === 'config-changed') apiGet('/config').then(r => r.json()).then(d => setBusinessConfig(d)).catch(() => {});
        if (e.data === 'sale-made') {
          fetchProductsDB();
          apiGet(`/sales/today?sucursal_id=${currentSucursalId}`).then(r => r.json()).then(d => {
            setTodaySalesTotal((d.total_efectivo || 0) + (d.total_tarjeta || 0) + (d.total_transferencia || 0) + (d.total_mp || 0) + (d.total_fiado || 0));
            setResumenData(d);
          }).catch(() => {});
        }
      };
    }
    const handleFocus = () => { fetchProductsDB(); };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (evtSource) evtSource.close();
      if (bc) bc.close();
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchProductsDB, currentSucursalId]);

  useEffect(() => {
    const checkRealHealth = async () => {
      try {
        const res = await apiGet('/health');
        if (res.ok) {
          setBackendError(false);
          setBackendDetailedError(false);
          setBackendStatus({ status: 'ok' });
          setBackendLastOk(Date.now());
          try {
            const todayRes = await apiGet(`/sales/today?sucursal_id=${currentSucursalId}`);
            const todayData = await todayRes.json();
            setTodaySalesTotal((todayData.total_efectivo || 0) + (todayData.total_tarjeta || 0) + (todayData.total_transferencia || 0) + (todayData.total_mp || 0) + (todayData.total_fiado || 0));
            setResumenData(todayData);
          } catch (e) { console.error(e) }
        } else {
          setBackendError(true);
          setBackendStatus({ status: 'error', code: res.status });
        }
      } catch {
        setBackendError(true);
        setBackendStatus({ status: 'error', code: 0 });
      }
    };
    checkRealHealth();
    const interval = setInterval(checkRealHealth, 15000);
    return () => clearInterval(interval);
  }, [currentSucursalId]);

  useEffect(() => {
    const syncPending = async () => {
      try {
        const pendingStr = localStorage.getItem('minegocio_pending_sales');
        if (!pendingStr) { setPendingSync(0); return; }
        const pending = JSON.parse(pendingStr);
        if (pending.length === 0) { setPendingSync(0); return; }
        setPendingSync(pending.length);
        const batch = pending.slice(0, 10);
        const remaining = pending.slice(10);
        let synced = 0;
        const failedItems = [];
        for (const item of batch) {
          if ((item._retries || 0) > 5) {
            failedItems.push(item);
            continue;
          }
          try {
            const res = await apiPost(`/sales?idempotency_key=${item.idempotencyKey}`, item.payload);
            if (res.ok) { synced++; }
            else { item._retries = (item._retries || 0) + 1; failedItems.push(item); }
          } catch { item._retries = (item._retries || 0) + 1; failedItems.push(item); }
        }
        const newPending = [...remaining, ...failedItems];
        localStorage.setItem('minegocio_pending_sales', JSON.stringify(newPending));
        setPendingSync(newPending.length);
        if (synced > 0) { fetchProductsDB(); }
        if (newPending.length === 0 && synced > 0) {
          localStorage.removeItem('minegocio_inventario_cache');
        }
      } catch (e) { console.error(e) }
    };
    const interval = setInterval(syncPending, 10000);
    return () => clearInterval(interval);
  }, [fetchProductsDB]);

  // Operator restoration from localStorage is handled in useAuth

  return {
    productsDB, setProductsDB,
    fetchProductsDB,
    backendError, setBackendError,
    backendDetailedError, setBackendDetailedError,
    backendStatus, setBackendStatus,
    backendLastOk, setBackendLastOk,
    pendingSync, setPendingSync,
    todaySalesTotal, setTodaySalesTotal,
    operators, setOperators,
    sucursales, setSucursales,
    businessConfig, setBusinessConfig,
    stockAlerts, setStockAlerts,
    showEgreso, setShowEgreso,
    egresoMonto, setEgresoMonto,
    egresoMotivo, setEgresoMotivo,
    egresoType, setEgresoType,
    showResumen, setShowResumen,
    resumenData, setResumenData,
    showDevolucionItems, setShowDevolucionItems,
    devolucionQtys, setDevolucionQtys,
    isReverting, setIsReverting,
    backupLoading, setBackupLoading,
    showBackupRestore, setShowBackupRestore,
    backupList, setBackupList,
    restoring, setRestoring,
    mpQrData, setMpQrData,
    mpPaymentUrl, setMpPaymentUrl,
    mpLoading, setMpLoading,
    mpPaymentStatus, setMpPaymentStatus,
    mpIntentId, setMpIntentId,
    expiryAlerts, setExpiryAlerts,
    showExpiryAlerts, setShowExpiryAlerts,
    showLogs, setShowLogs,
    sysLogs, setSysLogs,
    showHelp, setShowHelp,
    showCierres, setShowCierres,
    cierresData, setCierresData,
    showPendingModal, setShowPendingModal,
    showPriceCheck, setShowPriceCheck,
    priceCheckQuery, setPriceCheckQuery,
    priceCheckResults, setPriceCheckResults,
    showDuplicateCodeModal, setShowDuplicateCodeModal,
    duplicateCodeMatches, setDuplicateCodeMatches,
    handleUnpack,
    handleDevolucionItem, handleDevolucion,
    handleManualSync,
    submitEgreso,
    handleBackup,
    getPendingData,
  };
}

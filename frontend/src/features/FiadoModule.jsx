import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost, apiDelete } from '../services/apiClient';
import { SkeletonCard } from '../components/ui/Skeleton';
import useIsMobile from '../hooks/useIsMobile';
import useModalExit, { overlayAnim, contentAnim } from '../hooks/useModalExit';

const Icons = {
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  User: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  ChevronDown: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>,
  Check: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  DollarSign: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

export default function FiadoModule() {
  const { addToast, currentPlan, auth, businessType } = usePanelContext();
  const operadorActual = auth?.currentOperator?.name || 'Cajero';
  const isMobile = useIsMobile();
  const [cobranza, setCobranza] = useState(null); // {nombre, telefono, texto, loading}
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [transactionsMap, setTransactionsMap] = useState({});
  const [loadingTransactions, setLoadingTransactions] = useState(new Set());
  const [abonoModal, setAbonoModal] = useState(null); // {id, name, balance}
  const [abonoAmount, setAbonoAmount] = useState('');
  const [cargarModal, setCargarModal] = useState(null); // {id, name, balance}
  const [cargarAmount, setCargarAmount] = useState('');
  const [cargarDesc, setCargarDesc] = useState('');
  const [cargarBusy, setCargarBusy] = useState(false);
  const [newClientModal, setNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [showObraForm, setShowObraForm] = useState(null); // {customer_id}
  const [newObraName, setNewObraName] = useState('');
  const [newObraAddress, setNewObraAddress] = useState('');
  const [customerObras, setCustomerObras] = useState({}); // {customer_id: [obras]}
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAmount, setNewClientAmount] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientDniCuit, setNewClientDniCuit] = useState('');
  const [menuFiado, setMenuFiado] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0 });
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/customers?solo_deudores=true');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (e) {
      console.error('Fiados: no se pudieron cargar los clientes:', e);
      setCustomers([]);
      addToast?.('No se pudieron cargar los fiados. Revisá la conexión.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchCustomers(); }, []);

  const loadTransactions = async (customerId) => {
    if (transactionsMap[customerId]) return;
    setLoadingTransactions(prev => new Set(prev).add(customerId));
    try {
      const res = await apiGet(`/customers/${customerId}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setTransactionsMap(prev => ({ ...prev, [customerId]: data }));
      }
    } catch (e) {
      console.error(`Fiados: no se pudieron cargar las transacciones del cliente ${customerId}:`, e);
    }
    setLoadingTransactions(prev => {
      const next = new Set(prev);
      next.delete(customerId);
      return next;
    });
  };

  const handleExpand = (c) => {
    if (expandedClient === c.id) {
      setExpandedClient(null);
    } else {
      setExpandedClient(c.id);
      loadTransactions(c.id);
    }
  };

  const handleAbonar = async () => {
    if (!abonoAmount || isNaN(abonoAmount) || Number(abonoAmount) <= 0) return;
    if (Number(abonoAmount) > abonoModal.balance) {
      addToast?.('El abono no puede superar la deuda.', 'error');
      return;
    }
    try {
      const res = await apiPost(`/customers/${abonoModal.id}/pay`, { amount: Number(abonoAmount), operator: operadorActual });
      if (res.ok) {
        addToast?.('Abono registrado exitosamente.', 'success');
        setAbonoModal(null);
        setAbonoAmount('');
        fetchCustomers();
        const tRes = await apiGet(`/customers/${abonoModal.id}/transactions`);
        if (tRes.ok) {
          const tData = await tRes.json();
          setTransactionsMap(prev => ({ ...prev, [abonoModal.id]: tData }));
        }
      } else {
        addToast?.('Error al registrar abono.', 'error');
      }
    } catch {
      addToast?.('Error de conexión.', 'error');
    }
  };

  const handleCargar = async () => {
    if (!cargarAmount || isNaN(cargarAmount) || Number(cargarAmount) <= 0) return;
    setCargarBusy(true);
    try {
      const res = await apiPost(`/customers/${cargarModal.id}/charge`, {
        amount: Number(cargarAmount),
        description: cargarDesc.trim(),
        operator: operadorActual,
      });
      if (res.ok) {
        addToast?.('Fiado cargado.', 'success');
        setCargarModal(null);
        setCargarAmount('');
        setCargarDesc('');
        fetchCustomers();
        // refrescar el historial si el cliente esta abierto
        const tRes = await apiGet(`/customers/${cargarModal.id}/transactions`);
        if (tRes.ok) {
          const tData = await tRes.json();
          setTransactionsMap(prev => ({ ...prev, [cargarModal.id]: tData }));
        }
      } else {
        addToast?.('No se pudo cargar el fiado.', 'error');
      }
    } catch {
      addToast?.('Error de conexión.', 'error');
    } finally {
      setCargarBusy(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const res = await apiPost('/customers', { name: newClientName, phone: newClientPhone, amount: Number(newClientAmount) || 0, operator: operadorActual, address: newClientAddress, email: newClientEmail, dni_cuit: newClientDniCuit });
      if (res.ok) {
        addToast?.('Cliente creado exitosamente.', 'success');
        setNewClientModal(false);
        setNewClientName('');
        setNewClientPhone('');
        setNewClientAmount('');
        setNewClientAddress('');
        setNewClientEmail('');
        setNewClientDniCuit('');
        setNewClientAmount('');
        fetchCustomers();
      } else {
        addToast?.('Error al crear cliente.', 'error');
      }
    } catch {
      addToast?.('Error de conexión al crear cliente.', 'error');
    }
  };

  const handleCreateObra = async (customerId) => {
    if (!newObraName.trim()) return;
    try {
      const res = await apiPost('/obras', { name: newObraName.trim(), address: newObraAddress, customer_id: customerId });
      if (res.ok) {
        addToast?.('Obra agregada.', 'success');
        setNewObraName(''); setNewObraAddress(''); setShowObraForm(null);
        const obrasRes = await apiGet('/customers/' + customerId + '/obras');
        if (obrasRes.ok) { const data = await obrasRes.json(); setCustomerObras(function(prev) { var next = {}; Object.assign(next, prev); next[customerId] = data; return next; }); }
      } else addToast?.('Error.', 'error');
    } catch { addToast?.('Error de conexión.', 'error'); }
  };

  const toggleObras = async (customerId) => {
    if (customerObras[customerId]) return;
    const res = await apiGet('/customers/' + customerId + '/obras');
    if (res.ok) { const data = await res.json(); setCustomerObras(function(prev) { var next = {}; Object.assign(next, prev); next[customerId] = data; return next; }); }
  };

  const openFiadoMenu = (e, c) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuW = 175;
    const left = Math.min(rect.left, window.innerWidth - menuW - 12);
    const top = Math.min(rect.bottom + 4, window.innerHeight - 80);
    setMenuAnchor({ top, left });
    setMenuFiado(menuFiado?.id === c.id ? null : c);
  };

  const handleDeleteFiado = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    const res = await apiDelete(`/customers/${deleteModal.id}`);
    if (res.ok) {
      addToast?.('Cliente eliminado.', 'success');
      setCustomers(cs => cs.filter(c => c.id !== deleteModal.id));
      if (expandedClient === deleteModal.id) setExpandedClient(null);
      setDeleteModal(null);
    } else { addToast?.('Error al eliminar cliente.', 'error'); }
    setDeleting(false);
  };

  const handleCobranzaIA = async (c) => {
    setCobranza({ nombre: c.name, telefono: c.phone, texto: '', loading: true });
    try {
      const res = await apiGet(`/ai/cobranza/${c.id}`);
      if (res.ok) {
        const d = await res.json();
        setCobranza({ nombre: c.name, telefono: d.telefono || c.phone, texto: d.texto || '', loading: false });
      } else {
        setCobranza(null);
        addToast?.('No se pudo generar el mensaje con IA.', 'error');
      }
    } catch {
      setCobranza(null);
      addToast?.('Error de conexión al generar el mensaje.', 'error');
    }
  };

  const enviarWhatsApp = () => {
    const tel = (cobranza?.telefono || '').replace(/[^0-9]/g, '');
    const texto = encodeURIComponent(cobranza?.texto || '');
    const url = tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
    window.open(url, '_blank');
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalDeuda = customers.reduce((acc, c) => acc + c.balance, 0);

  // Animación de entrada/salida de los modales de este módulo. Los que
  // llevan datos (objeto, no boolean) guardan el último valor en un ref
  // para poder seguir mostrando el contenido mientras se desvanecen.
  const cobranzaExit = useModalExit(!!cobranza);
  const cobranzaDataRef = useRef(null);
  if (cobranza) cobranzaDataRef.current = cobranza;
  const cobranzaData = cobranza || cobranzaDataRef.current;

  const abonoExit = useModalExit(!!abonoModal);
  const abonoDataRef = useRef(null);
  if (abonoModal) abonoDataRef.current = abonoModal;
  const abonoData = abonoModal || abonoDataRef.current;

  const cargarExit = useModalExit(!!cargarModal);
  const cargarDataRef = useRef(null);
  if (cargarModal) cargarDataRef.current = cargarModal;
  const cargarData = cargarModal || cargarDataRef.current;

  const deleteExit = useModalExit(!!deleteModal);
  const deleteDataRef = useRef(null);
  if (deleteModal) deleteDataRef.current = deleteModal;
  const deleteData = deleteModal || deleteDataRef.current;

  const newClientExit = useModalExit(newClientModal);

  return (
    <div style={{ padding: '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>

      {/* HEADER editorial */}
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div className="ledger-label">Cuaderno de fiados</div>
        <h1 className="ledger-title" style={{ fontSize: '1.6rem', marginTop: 4 }}>Quién te debe</h1>
      </div>

      {/* METRICAS — hoja reglada de dos columnas (deuda | clientes) */}
      <div className="ledger-sheet" style={{ display: 'flex', marginBottom: '18px', flexShrink: 0 }}>
        <div style={{ flex: 1, padding: '16px 20px' }}>
          <div className="ledger-label">Deuda total en la calle</div>
          <div className="ledger-num" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-warning)', marginTop: 4 }}>${totalDeuda.toLocaleString('es-AR')}</div>
        </div>
        <div className="ledger-vrule" />
        <div style={{ flex: 1, padding: '16px 20px' }}>
          <div className="ledger-label">Clientes con cuenta</div>
          <div className="ledger-num" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{customers.length}</div>
        </div>
      </div>

      {/* BUSCADOR Y NUEVO CLIENTE */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : 220 }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
          <input
            type="text"
            placeholder="Buscar cliente por nombre..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'var(--sheet)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '14px 16px 14px 46px', borderRadius: 'var(--radius-sm)', fontSize: '1rem', outline: 'none' }}
          />
        </div>
        <button
          onClick={() => setNewClientModal(true)}
          style={{ padding: isMobile ? '14px 24px' : '0 24px', width: isMobile ? '100%' : undefined, justifyContent: 'center', background: 'var(--accent-primary)', color: 'var(--sheet)', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'filter 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
        >
          <span style={{ fontSize: '1.2rem' }}>+</span> Nuevo Cliente
        </button>
      </div>

      {/* CUADERNO — hoja continua con renglones por cliente */}
      <div className="ledger-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {loading && <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}</div>}

        {!loading && filteredCustomers.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px' }}>
            No hay clientes con deuda activa o que coincidan con la búsqueda.
          </div>
        )}

        {!loading && filteredCustomers.map(c => {
          const isExpanded = expandedClient === c.id;
          const transactions = transactionsMap[c.id] || [];

          return (
            <div key={c.id} style={{ borderBottom: '1px solid var(--rule)', transition: 'background 0.15s', background: isExpanded ? 'var(--surface-veil)' : 'transparent' }}>
              <div
                onClick={() => handleExpand(c)}
                style={{ padding: '14px 18px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '12px' : 0, justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                  <div style={{ width: '38px', height: '38px', background: 'var(--surface-veil)', border: '1px solid var(--border-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    <Icons.User />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {c.name}
                      </div>
                      {c.created_at && (() => {
                        const days = Math.floor((Date.now() - new Date(c.created_at)) / 86400000);
                        const tone = days < 7
                          ? { bg: 'var(--wash-success)', fg: 'var(--accent-success)' }
                          : days < 30
                            ? { bg: 'var(--wash-warning)', fg: 'var(--accent-warning)' }
                            : { bg: 'var(--wash-danger)', fg: 'var(--accent-danger)' };
                        return (
                          <span title="Antigüedad de la cuenta (desde que se creó el cliente, no necesariamente desde la última venta fiada)" style={{ background: tone.bg, border: '1px solid var(--border-color)', color: tone.fg, padding: '2px 8px', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            {days === 0 ? 'Hoy' : days === 1 ? '1 día' : `${days} días`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '20px', flexWrap: 'wrap', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                  <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                    <div className="ledger-label">Saldo deudor</div>
                    <div className="ledger-num" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-warning)', marginTop: 2 }}>${(c.balance ?? 0).toLocaleString('es-AR')}</div>
                  </div>
                  {currentPlan === 'ia' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCobranzaIA(c); }}
                      title="Generar mensaje de cobranza con IA"
                      style={{ background: 'transparent', color: 'var(--accent-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 13px', fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      Cobrar con IA
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setCargarModal(c); }}
                    title="Sumar deuda a este cliente (fiado con descripción)"
                    style={{ background: 'transparent', color: 'var(--accent-warning)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 13px', fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-warning)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>+</span> Cargar fiado
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAbonoModal(c); }}
                    style={{ background: 'var(--accent-primary)', color: 'var(--sheet)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 15px', fontSize: '0.86rem', fontWeight: 800, cursor: 'pointer', transition: 'filter 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
                    onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    <Icons.DollarSign /> Recibir pago
                  </button>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                  </div>
                  <button onClick={(e) => openFiadoMenu(e, c)} title="Más opciones"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--rule-strong)', background: 'var(--bg-main)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 380, borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                        <th className="ledger-label" style={{ padding: '12px 24px', textAlign: 'left' }}>Fecha</th>
                        <th className="ledger-label" style={{ padding: '12px 24px', textAlign: 'left' }}>Descripción</th>
                        <th className="ledger-label" style={{ padding: '12px 24px', textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr><td colSpan="3" style={{ padding: '16px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {loadingTransactions.has(c.id) ? 'Cargando movimientos...' : 'Sin movimientos registrados'}
                        </td></tr>
                      ) : (
                        transactions.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                            <td className="ledger-num" style={{ padding: '13px 24px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {t.timestamp ? `${new Date(t.timestamp).toLocaleDateString('es-AR')} ${new Date(t.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : '---'}
                            </td>
                            <td style={{ padding: '13px 24px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                              {t.description}
                              {t.operator && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>por {t.operator}</div>}
                            </td>
                            <td className="ledger-num" style={{ padding: '13px 24px', fontWeight: 700, color: t.type === 'payment' ? 'var(--accent-success)' : 'var(--accent-danger)', textAlign: 'right' }}>
                              {t.type === 'payment' ? '−' : '+'}${t.amount.toLocaleString('es-AR')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    </table>

                  {/* Obras del cliente — solo corralón */}
                  {businessType === 'corralon' && <div style={{ borderTop: '1px solid var(--rule-strong)', padding: '16px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span className="ledger-label" style={{ fontSize: '0.8rem' }}>Obras</span>
                      <button onClick={() => { toggleObras(c.id); setShowObraForm(showObraForm?.customer_id === c.id ? null : { customer_id: c.id }); }}
                        style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                        + Agregar obra
                      </button>
                    </div>
                    {showObraForm?.customer_id === c.id && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <input value={newObraName} onChange={e => setNewObraName(e.target.value)} placeholder="Nombre de la obra" style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none' }} autoFocus />
                        <input value={newObraAddress} onChange={e => setNewObraAddress(e.target.value)} placeholder="Dirección" style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none' }} />
                        <button onClick={() => handleCreateObra(c.id)} disabled={!newObraName.trim()} className="lp-btn lp-btn--primary" style={{ padding: '6px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Guardar</button>
                      </div>
                    )}
                    {customerObras[c.id]?.length > 0 ? (
                      customerObras[c.id].map(o => (
                        <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.82rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--rule)' }}>
                          <span>{o.name}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{o.address || '—'}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Sin obras cargadas</div>
                    )}
                  </div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL COBRANZA IA */}
      {cobranzaExit.rendered && cobranzaData && (
        <div className={`modal-overlay${cobranzaExit.closing ? ' closing' : ''}`} onClick={() => setCobranza(null)}>
          <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ padding: '28px', width: '460px', maxWidth: '92vw', boxShadow: 'var(--shadow-lg)', ...contentAnim(cobranzaExit.closing) }}>
            <div className="ledger-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: 'var(--accent-primary)', color: 'var(--sheet)', padding: '1px 6px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 800 }}>IA</span> Cobranza
            </div>
            <h3 className="ledger-title" style={{ margin: '6px 0 4px', fontSize: '1.4rem' }}>Mensaje de cobranza</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
              Para <strong>{cobranzaData.nombre}</strong>. Escrito por IA, podés editarlo antes de enviar.
            </p>
            {cobranzaData.loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Generando el mensaje con IA…</div>
            ) : (
              <>
                <textarea
                  value={cobranzaData.texto}
                  onChange={e => setCobranza(prev => ({ ...prev, texto: e.target.value }))}
                  rows={5}
                  style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '14px', borderRadius: '12px', fontSize: '1rem', lineHeight: 1.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
                {!cobranzaData.telefono && (
                  <p style={{ color: 'var(--accent-warning)', fontSize: '0.82rem', margin: '8px 0 0' }}>
                    Este cliente no tiene teléfono cargado: se abrirá WhatsApp para que elijas el contacto.
                  </p>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button onClick={() => setCobranza(null)} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
                  <button onClick={enviarWhatsApp} style={{ flex: 2, padding: '14px', background: '#25D366', border: 'none', color: 'white', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    Enviar por WhatsApp
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL ABONO */}
      {abonoExit.rendered && abonoData && (
        <div className={`modal-overlay${abonoExit.closing ? ' closing' : ''}`} onClick={() => setAbonoModal(null)}>
          <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: 'var(--shadow-lg)', ...contentAnim(abonoExit.closing) }}>
            <h3 className="ledger-title" style={{ margin: '0 0 8px 0', fontSize: '1.5rem' }}>Recibir pago</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Cliente: <strong>{abonoData.name}</strong><br/>Deuda Total: <strong style={{color: 'var(--accent-warning)'}}>${(abonoData.balance ?? 0).toLocaleString('es-AR')}</strong></p>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Monto que entrega ($)</label>
              <input 
                type="number" 
                value={abonoAmount}
                onChange={e => setAbonoAmount(e.target.value)}
                autoFocus
                placeholder="Ej: 5000"
                style={{ width: '100%', background: 'var(--bg-main)', border: '2px solid var(--accent-primary)', color: 'var(--text-primary)', padding: '16px', borderRadius: '12px', fontSize: '1.5rem', fontFamily: 'var(--font-mono)', textAlign: 'center', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => setAbonoAmount(String(abonoData.balance))} style={{ flex: 1, padding: '9px', background: 'var(--surface-veil)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}>Saldar todo</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setAbonoModal(null)} style={{ flex: 1, padding: '15px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleAbonar} disabled={!abonoAmount} style={{ flex: 1, padding: '15px', background: 'var(--accent-primary)', border: 'none', color: 'var(--sheet)', borderRadius: 'var(--radius-sm)', fontWeight: 800, cursor: abonoAmount ? 'pointer' : 'not-allowed', opacity: abonoAmount ? 1 : 0.5 }}>Confirmar pago</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL CARGAR FIADO */}
      {cargarExit.rendered && cargarData && (
        <div className={`modal-overlay${cargarExit.closing ? ' closing' : ''}`} onClick={() => setCargarModal(null)}>
          <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: 'var(--shadow-lg)', ...contentAnim(cargarExit.closing) }}>
            <h3 className="ledger-title" style={{ margin: '0 0 8px 0', fontSize: '1.5rem' }}>Cargar fiado</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Cliente: <strong>{cargarData.name}</strong><br/>Deuda actual: <strong style={{ color: 'var(--accent-warning)' }}>${(cargarData.balance ?? 0).toLocaleString('es-AR')}</strong></p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>¿Cuánto se lleva? ($)</label>
              <input
                type="number"
                inputMode="numeric"
                value={cargarAmount}
                onChange={e => setCargarAmount(e.target.value)}
                autoFocus
                placeholder="Ej: 2800"
                style={{ width: '100%', background: 'var(--bg-main)', border: '2px solid var(--accent-warning)', color: 'var(--text-primary)', padding: '16px', borderRadius: '12px', fontSize: '1.5rem', fontFamily: 'var(--font-mono)', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>¿Qué se llevó? (opcional)</label>
              <input
                type="text"
                value={cargarDesc}
                onChange={e => setCargarDesc(e.target.value)}
                placeholder="Ej: dos pan y una coca"
                onKeyDown={e => { if (e.key === 'Enter' && cargarAmount && !cargarBusy) handleCargar(); }}
                style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setCargarModal(null)} style={{ flex: 1, padding: '15px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCargar} disabled={!cargarAmount || cargarBusy} style={{ flex: 1, padding: '15px', background: 'var(--accent-warning)', border: 'none', color: 'var(--sheet)', borderRadius: 'var(--radius-sm)', fontWeight: 800, cursor: (cargarAmount && !cargarBusy) ? 'pointer' : 'not-allowed', opacity: (cargarAmount && !cargarBusy) ? 1 : 0.5 }}>{cargarBusy ? 'Cargando…' : 'Cargar deuda'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PORTAL: menú 3 puntitos */}
      {menuFiado && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setMenuFiado(null)} />
          <div style={{ position: 'fixed', top: menuAnchor.top, left: menuAnchor.left, zIndex: 1000, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.35)', minWidth: 175, padding: 6 }}>
            <button onClick={() => { setDeleteModal(menuFiado); setMenuFiado(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', color: 'var(--accent-danger)', padding: '10px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              Eliminar cliente
            </button>
          </div>
        </>,
        document.body
      )}

      {/* MODAL: Confirmar eliminar cliente */}
      {deleteExit.rendered && deleteData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(11,19,43,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, ...overlayAnim(deleteExit.closing) }}
          onClick={() => setDeleteModal(null)}>
          <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ width: '100%', maxWidth: 400, padding: 28, boxShadow: 'var(--shadow-lg)', ...contentAnim(deleteExit.closing) }}>
            <h3 className="ledger-title" style={{ margin: '0 0 10px', fontSize: '1.3rem' }}>Eliminar cliente</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.5 }}>
              ¿Eliminás a <strong style={{ color: 'var(--text-primary)' }}>{deleteData.name}</strong>? Se borrarán sus transacciones y todo el historial de fiado. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteModal(null)} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDeleteFiado} disabled={deleting}
                style={{ flex: 1, padding: '14px', background: 'var(--accent-danger)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 800, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE */}
      {newClientExit.rendered && (
        <div className={`modal-overlay${newClientExit.closing ? ' closing' : ''}`} onClick={() => setNewClientModal(false)}>
          <div onClick={e => e.stopPropagation()} className="ledger-sheet" style={{ width: '400px', maxWidth: '90vw', padding: '28px', boxShadow: 'var(--shadow-lg)', ...contentAnim(newClientExit.closing) }}>
            <h3 className="ledger-title" style={{ margin: '0 0 8px 0', fontSize: '1.5rem' }}>Nuevo cliente</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>Registre un nuevo cliente en el sistema.</p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Nombre Completo *</label>
              <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none' }} autoFocus />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Teléfono (Opcional)</label>
              <input type="text" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Dirección (Opcional)</label>
              <input type="text" value={newClientAddress} onChange={e => setNewClientAddress(e.target.value)} placeholder="Ej: Av. Siempre Viva 742" style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Email (Opcional)</label>
                <input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="cliente@email.com" style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>DNI / CUIT (Opcional)</label>
                <input type="text" value={newClientDniCuit} onChange={e => setNewClientDniCuit(e.target.value)} placeholder="20-12345678-9" style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>¿Cuánto te debe? ($ opcional)</label>
              <input type="number" inputMode="numeric" value={newClientAmount} onChange={e => setNewClientAmount(e.target.value)} placeholder="Ej: 5000" style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
              <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Si lo dejás vacío, el cliente aparece cuando le cargues una venta fiada.</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setNewClientModal(false)} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCreateClient} disabled={!newClientName.trim()} style={{ flex: 1, padding: '14px', background: newClientName.trim() ? 'var(--accent-primary)' : 'var(--bg-hover)', color: newClientName.trim() ? 'var(--sheet)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 800, cursor: newClientName.trim() ? 'pointer' : 'not-allowed' }}>Crear cliente</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

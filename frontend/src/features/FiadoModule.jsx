import React, { useState, useEffect } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import { SkeletonCard } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

const Icons = {
  Search: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  User: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  ChevronDown: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>,
  Check: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>,
  DollarSign: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

export default function FiadoModule() {
  const { addToast } = usePanelContext();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [transactionsMap, setTransactionsMap] = useState({});
  const [abonoModal, setAbonoModal] = useState(null); // {id, name, balance}
  const [abonoAmount, setAbonoAmount] = useState('');
  const [newClientModal, setNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const loadTransactions = async (customerId) => {
    if (transactionsMap[customerId]) return;
    try {
      const res = await apiGet(`/customers/${customerId}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setTransactionsMap(prev => ({ ...prev, [customerId]: data }));
      }
    } catch { }
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
      const res = await apiPost(`/customers/${abonoModal.id}/pay`, { amount: Number(abonoAmount), operator: 'Cajero' });
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

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const res = await apiPost('/customers', { name: newClientName, phone: newClientPhone });
      if (res.ok) {
        addToast?.('Cliente creado exitosamente.', 'success');
        setNewClientModal(false);
        setNewClientName('');
        setNewClientPhone('');
        fetchCustomers();
      } else {
        addToast?.('Error al crear cliente.', 'error');
      }
    } catch {
      addToast?.('Error de conexión al crear cliente.', 'error');
    }
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalDeuda = customers.reduce((acc, c) => acc + c.balance, 0);

  return (
    <div style={{ padding: '22px 28px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Cuentas Corrientes</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Gestión de libretas y pagos parciales.</p>
        </div>
      </div>

      {/* METRICAS */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', flex: 1, position: 'relative', overflow: 'hidden' }}>
           <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Deuda Total en la Calle</div>
           <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-warning)', fontFamily: 'var(--font-mono)' }}>${totalDeuda.toLocaleString('es-AR')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', flex: 1, position: 'relative', overflow: 'hidden' }}>
           <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Clientes Fiados</div>
           <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{customers.length}</div>
        </div>
      </div>

      {/* BUSCADOR Y NUEVO CLIENTE */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
          <input 
            type="text" 
            placeholder="Buscar cliente por nombre..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '16px 16px 16px 48px', borderRadius: '12px', fontSize: '1rem', outline: 'none' }} 
          />
        </div>
        <button 
          onClick={() => setNewClientModal(true)}
          style={{ padding: '0 24px', background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 16px -4px rgba(20,187,166,0.3)' }}
        >
          <span style={{ fontSize: '1.2rem' }}>+</span> Nuevo Cliente
        </button>
      </div>

      {/* LISTA DE CLIENTES */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        
        {!loading && filteredCustomers.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            No hay clientes con deuda activa o que coincidan con la búsqueda.
          </div>
        )}

        {!loading && filteredCustomers.map(c => {
          const isExpanded = expandedClient === c.id;
          const transactions = transactionsMap[c.id] || [];

          return (
            <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.2s' }}>
              <div 
                onClick={() => handleExpand(c)}
                style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s', background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                  <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <Icons.User />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {c.name}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '2px' }}>Saldo Deudor</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-warning)' }}>${(c.balance ?? 0).toLocaleString('es-AR')}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAbonoModal(c); }}
                    style={{ background: 'var(--gradient-success)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Icons.DollarSign /> Entrega
                  </button>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '16px 24px' }}>Fecha</th>
                        <th style={{ padding: '16px 24px' }}>Descripción</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr><td colSpan="3" style={{ padding: '16px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando movimientos...</td></tr>
                      ) : (
                        transactions.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '16px 24px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                              {t.timestamp ? `${new Date(t.timestamp).toLocaleDateString('es-AR')} ${new Date(t.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : '---'}
                            </td>
                            <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t.description}</td>
                            <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: t.type === 'payment' ? 'var(--accent-success)' : 'var(--accent-danger)', textAlign: 'right' }}>
                              {t.type === 'payment' ? '-' : '+'}${t.amount.toLocaleString('es-AR')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL ABONO */}
      {abonoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11, 19, 43, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '24px', width: '400px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>Recibir Pago</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Cliente: <strong>{abonoModal.name}</strong><br/>Deuda Total: <strong style={{color: 'var(--accent-warning)'}}>${(abonoModal.balance ?? 0).toLocaleString('es-AR')}</strong></p>
            
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
                <button onClick={() => setAbonoAmount(String(abonoModal.balance))} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}>Saldar Todo</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setAbonoModal(null)} style={{ flex: 1, padding: '16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>Cancelar</button>
              <button onClick={handleAbonar} disabled={!abonoAmount} style={{ flex: 1, padding: '16px', background: 'var(--gradient-success)', border: 'none', color: 'white', borderRadius: '12px', fontWeight: 800, cursor: abonoAmount ? 'pointer' : 'not-allowed', transition: 'all 0.15s', opacity: abonoAmount ? 1 : 0.5 }}>Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL NUEVO CLIENTE */}
      {newClientModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', width: '400px', maxWidth: '90vw', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Nuevo Cliente</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>Registre un nuevo cliente en el sistema.</p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Nombre Completo *</label>
              <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none' }} autoFocus />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Teléfono (Opcional)</label>
              <input type="text" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '12px', fontSize: '1rem', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setNewClientModal(false)} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCreateClient} disabled={!newClientName.trim()} style={{ flex: 1, padding: '14px', background: newClientName.trim() ? 'var(--gradient-primary)' : 'var(--bg-hover)', color: newClientName.trim() ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: newClientName.trim() ? 'pointer' : 'not-allowed' }}>Crear Cliente</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

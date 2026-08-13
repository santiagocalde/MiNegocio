import { useState } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost, apiDelete } from '../services/apiClient';
import EmptyState from '../components/ui/EmptyState';
import useSortable from '../hooks/useSortable.jsx';

const Icons = {
  User: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Shield: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Plus: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
};

export default function UsuariosModule() {
  const { backend, addToast } = usePanelContext();
  const operators = backend.operators;
  const onOperatorsUpdate = backend.setOperators;
  const usuarios = Array.isArray(operators) ? operators : [];
  const { sorted: sortedUsuarios, toggleSort, SortIcon } = useSortable(usuarios, 'name');

  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({ name: '', pin: '', role: 'cashier' });

  // Permisos por módulo — defaults por rol y estado editable
  const ALL_MODULES = ['Mostrador','Presupuestos','Acopios','Lista de clientes','Cuentas corrientes','Notas de pedido','Depósito','Historial','Reportes','Configuración'];

  const ROLE_DEFAULT_PERMS = {
    cashier:  ['Mostrador','Presupuestos','Acopios','Lista de clientes','Cuentas corrientes'],
    logistica: ['Notas de pedido'],
    manager:  ['Mostrador','Presupuestos','Acopios','Lista de clientes','Cuentas corrientes','Notas de pedido','Depósito','Historial','Reportes'],
    admin:    [...ALL_MODULES],
    vendedor: ['Mostrador','Presupuestos','Acopios','Lista de clientes','Cuentas corrientes'],
    employee: ['Mostrador'],
  };

  const [customPerms, setCustomPerms] = useState(null); // null = usar defaults del rol

  // Cuando cambia el rol, resetear perms al default del nuevo rol
  const handleRoleChange = (newRole) => {
    setForm(f => ({ ...f, role: newRole }));
    setCustomPerms(null);
  };

  const activePerms = customPerms ?? (ROLE_DEFAULT_PERMS[form.role] || ROLE_DEFAULT_PERMS.cashier);

  const togglePerm = (mod) => {
    const current = customPerms ?? (ROLE_DEFAULT_PERMS[form.role] || ROLE_DEFAULT_PERMS.cashier);
    if (current.includes(mod)) {
      setCustomPerms(current.filter(m => m !== mod));
    } else {
      setCustomPerms([...current, mod]);
    }
  };

  // true si los perms actuales difieren del default del rol
  const permsAreCustomized = customPerms !== null;

  const [adminPin, setAdminPin] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }

  // Al pasar de 1 a 2 operadores vuelve a hacer falta el PIN para entrar. Como
  // el dueño venía entrando sin PIN, hay que pedirle que defina el suyo ahora,
  // si no quedaría afuera de su propia cuenta.
  const isFirstEmployee = editIndex === null && usuarios.length === 1 && usuarios[0]?.role === 'admin';

  const openNew = () => {
    setEditIndex(null);
    setForm({ name: '', pin: '', role: 'cashier' });
    setCustomPerms(null);
    setAdminPin('');
    setShowModal(true);
  };

  const openEdit = (sortedIdx) => {
    const u = sortedUsuarios[sortedIdx];
    const originalIdx = usuarios.findIndex(orig => orig.name === u.name && orig.role === u.role);
    setEditIndex(originalIdx >= 0 ? originalIdx : sortedIdx);
    setForm({ name: u.name, pin: '', role: u.role });
    // Si el usuario tiene permisos customizados, cargarlos; si no, null (default de rol)
    const savedPerms = u.permissions;
    setCustomPerms(Array.isArray(savedPerms) ? savedPerms : null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await apiDelete(`/operators/${deleteConfirm.id}`);
      if (res.ok) {
        if (addToast) addToast(`Usuario "${deleteConfirm.name}" eliminado.`, 'success');
        setDeleteConfirm(null);
        const fresh = await apiGet('/operators');
        if (fresh.ok) onOperatorsUpdate(await fresh.json());
      } else {
        if (addToast) addToast('No se pudo eliminar el usuario. Reintentá o revisá tu conexión.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin internet. Revisá tu conexión.', 'error');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || (editIndex === null && (!form.pin.trim() || form.pin.length < 4))) {
      if (addToast) addToast('Nombre y PIN de 4 dígitos son obligatorios.', 'error');
      return;
    }
    if (isFirstEmployee && (!adminPin || adminPin.length < 4)) {
      if (addToast) addToast('Definí tu PIN de dueño (4 dígitos) para poder seguir entrando.', 'error');
      return;
    }
    const target = editIndex !== null ? usuarios[editIndex] : null;
    try {
      let responses;
      // Permisos: si son customizados guardarlos; si coinciden con el default del rol, guardar null
      const defaultForRole = ROLE_DEFAULT_PERMS[form.role] || ROLE_DEFAULT_PERMS.cashier;
      const permsToSave = permsAreCustomized ? activePerms : null;

      if (editIndex !== null) {
        if (!target?.id) throw new Error('Operador invalido');
        const payload = { name: form.name.trim(), role: form.role, permissions: permsToSave };
        if (form.pin) payload.pin = form.pin;
        responses = [await apiPost(`/operators/${target.id}`, payload)];
      } else {
        if (isFirstEmployee) {
          const owner = usuarios[0];
          if (!owner?.id) throw new Error('Operador dueño invalido');
          const ownerRes = await apiPost(`/operators/${owner.id}`, { pin: adminPin });
          if (!ownerRes.ok) throw new Error('No se pudo guardar el PIN del dueño');
        }
        responses = [await apiPost('/operators', { name: form.name.trim(), pin: form.pin, role: form.role, permissions: permsToSave })];
      }
      if (responses.every(res => res.ok)) {
        if (addToast) addToast(editIndex !== null ? 'Usuario actualizado.' : 'Usuario creado.', 'success');
        setShowModal(false);
        const fresh = await apiGet('/operators');
        if (fresh.ok) onOperatorsUpdate(await fresh.json());
      } else {
        if (addToast) addToast('No se pudieron guardar los usuarios. Reintentá o revisá tu conexión.', 'error');
      }
    } catch {
      if (addToast) addToast('Sin internet. Revisá tu conexión.', 'error');
    }
  };

  return (
    <div style={{ padding: '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexShrink: 0 }}>
        <div>
          <div className="ledger-label">Quién atiende</div>
          <h1 className="ledger-title" style={{ fontSize: '1.6rem', marginTop: 4 }}>Usuarios</h1>
        </div>
        <button onClick={openNew} style={{ background: 'var(--accent-primary)', border: 'none', color: 'var(--sheet)', padding: '11px 20px', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'filter 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}>
           <Icons.Plus /> Nuevo usuario
        </button>
      </div>

      <div className="ledger-sheet" style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
            <tr style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('name')}>Nombre<SortIcon columnKey="name" /></th>
              <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('role')}>Rol<SortIcon columnKey="role" /></th>
              <th style={{ padding: '16px' }}>PIN de Acceso</th>
              <th style={{ padding: '16px', cursor: 'pointer' }} onClick={() => toggleSort('last_login')}>&Uacute;ltimo Acceso<SortIcon columnKey="last_login" /></th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsuarios.length === 0 ? (
              <tr><td colSpan="5"><EmptyState icon="Users" title="Sin usuarios"
                description="No hay operadores configurados. Creá el primer usuario para abrir turno." /></td></tr>
            ) : (
              sortedUsuarios.map((u, idx) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--rule)', color: 'var(--text-secondary)' }}>
                <td style={{ padding: '14px 16px', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <div style={{ width: '32px', height: '32px', background: 'var(--wash-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                     <Icons.User />
                   </div>
                   {u.name}
                </td>
                <td style={{ padding: '14px 16px' }}>
                    {u.role === 'admin' ? (
                      <span className="ledger-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--wash-primary)', border: '1px solid var(--border-color)', color: 'var(--accent-primary)', padding: '3px 8px', borderRadius: '3px', width: 'fit-content' }}><Icons.Shield /> Admin</span>
                    ) : (
                      <span className="ledger-label" style={{ background: 'var(--surface-veil)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '3px 8px', borderRadius: '3px', width: 'fit-content' }}>Cajero</span>
                    )}
                </td>
                <td style={{ padding: '16px', fontFamily: 'var(--font-mono)' }}>****</td>
                <td style={{ padding: '16px' }}>{u.last_login}</td>
                <td style={{ padding: '16px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => openEdit(idx)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s', fontSize: '0.8rem', fontWeight: 600 }}>Editar</button>
                  <button onClick={() => setDeleteConfirm({ id: u.id, name: u.name })} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--accent-danger)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center' }}><Icons.Trash /></button>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="ledger-sheet" style={{ padding: '32px', width: '380px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', textAlign: 'center' }}>Eliminar usuario</h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 24px 0' }}>
              ¿Eliminar a <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleDelete} style={{ background: 'var(--accent-danger)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="ledger-sheet" style={{ padding: '32px', width: '400px', maxWidth: '92vw', boxSizing: 'border-box', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 24px 0', color: 'var(--text-primary)' }}>
              {editIndex !== null ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            {isFirstEmployee && (
              <div style={{ marginBottom: '20px', padding: '14px 16px', background: 'rgba(20,187,166,0.08)', border: '1px solid rgba(20,187,166,0.25)', borderRadius: '10px' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '4px' }}>Vas a tener m&aacute;s de una persona</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '12px' }}>
                  Desde ahora se entra con PIN. Defin&iacute; tu PIN de due&ntilde;o para poder seguir entrando y autorizar anulaciones.
                </div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Tu PIN de due&ntilde;o (4 d&iacute;gitos)</label>
                <input type="password" maxLength={4} value={adminPin} onChange={e => setAdminPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="&bull;&bull;&bull;&bull;"
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Nombre</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>PIN (4 d&iacute;gitos)</label>
              <input type="password" maxLength={4} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
                placeholder={editIndex !== null ? 'Dejar vac&iacute;o para mantener' : '••••'}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: editIndex === null ? '16px' : '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Rol</label>
              <select value={form.role} onChange={e => handleRoleChange(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                <option value="cashier">Cajero</option>
                <option value="logistica">Logística (solo despacho)</option>
                <option value="manager">Encargado</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {/* Checklist de permisos — editable, disponible al crear y editar */}
            <div style={{ marginBottom: '24px', padding: '14px 16px', background: 'rgba(0,0,0,0.12)', border: `1px solid ${permsAreCustomized ? 'rgba(20,187,166,0.5)' : 'var(--border-color)'}`, borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Acceso a módulos {permsAreCustomized && <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>· personalizado</span>}
                </div>
                {permsAreCustomized && (
                  <button onClick={() => setCustomPerms(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
                    Restablecer rol
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                {ALL_MODULES.map(mod => {
                  const allowed = activePerms.includes(mod);
                  return (
                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83rem', cursor: 'pointer', color: allowed ? 'var(--text-primary)' : 'var(--text-secondary)', userSelect: 'none' }}>
                      <input type="checkbox" checked={allowed} onChange={() => togglePerm(mod)}
                        style={{ accentColor: 'var(--accent-primary)', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                      {mod}
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: 'var(--accent-primary)', border: 'none', color: 'var(--sheet)', padding: '10px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'filter 0.15s', fontWeight: 800 }}>
                {editIndex !== null ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
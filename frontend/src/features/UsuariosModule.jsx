import { useState } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPut, apiDelete } from '../services/apiClient';
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
  const [form, setForm] = useState({ name: '', pin: '', role: 'cajero' });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }

  const openNew = () => {
    setEditIndex(null);
    setForm({ name: '', pin: '', role: 'cajero' });
    setShowModal(true);
  };

  const openEdit = (sortedIdx) => {
    const u = sortedUsuarios[sortedIdx];
    const originalIdx = usuarios.findIndex(orig => orig.name === u.name && orig.role === u.role);
    setEditIndex(originalIdx >= 0 ? originalIdx : sortedIdx);
    setForm({ name: u.name, pin: '', role: u.role });
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
        if (addToast) addToast('Error al eliminar usuario.', 'error');
      }
    } catch {
      if (addToast) addToast('Error de conexión.', 'error');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.pin.trim() || form.pin.length < 4) {
      if (addToast) addToast('Nombre y PIN de 4 dígitos son obligatorios.', 'error');
      return;
    }
    let updatedList;
    if (editIndex !== null) {
      updatedList = usuarios.map((u, i) => i === editIndex ? { ...u, name: form.name.trim(), role: form.role, pin: form.pin || u.pin } : u);
    } else {
      updatedList = [...usuarios, { id: Date.now(), name: form.name.trim(), pin: form.pin, role: form.role, last_login: '' }];
    }
    try {
      const res = await apiPut('/operators', updatedList.map(u => ({ name: u.name, pin: u.pin?.toString(), role: u.role })));
      if (res.ok) {
        if (addToast) addToast(editIndex !== null ? 'Usuario actualizado.' : 'Usuario creado.', 'success');
        setShowModal(false);
        const fresh = await apiGet('/operators');
        if (fresh.ok) onOperatorsUpdate(await fresh.json());
      } else {
        if (addToast) addToast('Error al guardar usuarios.', 'error');
      }
    } catch {
      if (addToast) addToast('Error de conexión.', 'error');
    }
  };

  return (
    <div style={{ padding: '22px 28px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gesti&oacute;n de Usuarios</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Controla qui&eacute;n accede a la caja y qu&eacute; permisos tiene.</p>
        </div>
        <button onClick={openNew} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.15s' }}>
           <Icons.Plus /> Nuevo Usuario
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
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
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <div style={{ width: '32px', height: '32px', background: 'rgba(20,187,166, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                     <Icons.User />
                   </div>
                   {u.name}
                </td>
                <td style={{ padding: '16px' }}>
                    {u.role === 'admin' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(20,187,166, 0.15)', color: 'var(--accent-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, width: 'fit-content' }}><Icons.Shield /> Admin</span>
                    ) : (
                      <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, width: 'fit-content' }}>Cajero</span>
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
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '380px' }}>
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
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '400px', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 24px 0', color: 'var(--text-primary)' }}>
              {editIndex !== null ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
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
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>Rol</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                <option value="cajero">Cajero</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 700 }}>
                {editIndex !== null ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
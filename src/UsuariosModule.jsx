import React, { useState } from 'react';

const Icons = {
  User: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Shield: () => <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Plus: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
};

export default function UsuariosModule() {
  const [usuarios, setUsuarios] = useState([
    { id: 1, name: 'Admin Principal', role: 'admin', pin: '1234', last_login: 'Hace 2 horas' },
    { id: 2, name: 'Cajero Tarde', role: 'cajero', pin: '5678', last_login: 'Ayer' },
  ]);

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gestión de Usuarios</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Controla quién accede a la caja y qué permisos tiene.</p>
        </div>
        <button style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
           <Icons.Plus /> Nuevo Usuario
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
            <tr style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '16px' }}>Nombre</th>
              <th style={{ padding: '16px' }}>Rol</th>
              <th style={{ padding: '16px' }}>PIN de Acceso</th>
              <th style={{ padding: '16px' }}>Último Acceso</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <div style={{ width: '32px', height: '32px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                     <Icons.User />
                   </div>
                   {u.name}
                </td>
                <td style={{ padding: '16px' }}>
                   {u.role === 'admin' ? (
                     <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, width: 'fit-content' }}><Icons.Shield /> Admin</span>
                   ) : (
                     <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, width: 'fit-content' }}>Cajero</span>
                   )}
                </td>
                <td style={{ padding: '16px', fontFamily: 'var(--font-mono)' }}>****</td>
                <td style={{ padding: '16px' }}>{u.last_login}</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

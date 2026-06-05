import React, { useState } from 'react';

const Icons = {
  Truck: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14V6h8v8m-8 0a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-8-8h8m0 0l3 3v5h-3m-8-8H4v8h4" /></svg>,
  Plus: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
};

export default function ProveedoresModule() {
  const [proveedores, setProveedores] = useState([
    { id: 1, name: 'Coca Cola Femsa', contact: 'Juan Perez', phone: '+54 9 11 4444-5555', debt: 0 },
    { id: 2, name: 'Distribuidora Arcor', contact: 'Marta Lopez', phone: '+54 9 11 2222-3333', debt: 150000 },
  ]);

  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gestión de Proveedores</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Directorio de mayoristas, preventistas y cuentas corrientes.</p>
        </div>
        <button style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
           <Icons.Plus /> Nuevo Proveedor
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
           {proveedores.map(p => (
             <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.transform='translateX(4px)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                   <div style={{ width: '48px', height: '48px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                     <Icons.Truck />
                   </div>
                   <div style={{ flex: 1 }}>
                     <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</h3>
                     <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Contacto: {p.contact} • {p.phone}</p>
                   </div>
                   <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Deuda:</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: p.debt > 0 ? 'var(--accent-danger)' : 'var(--accent-success)', fontFamily: 'var(--font-mono)' }}>${p.debt.toLocaleString('es-AR')}</span>
                   </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                   <button onClick={(e) => { e.stopPropagation(); alert("Funcionalidad en desarrollo"); }} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Historial</button>
                   {p.debt > 0 && <button onClick={(e) => { e.stopPropagation(); alert("Funcionalidad en desarrollo"); }} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Abonar</button>}
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}

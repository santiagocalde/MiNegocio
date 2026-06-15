import React, { useState } from 'react';

export default function TopBar({ currentOperator, sucursales, currentSucursalId, setCurrentSucursalId, backendStatus, addToast, setShowHelp }) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [themeDark, setThemeDark] = useState(() => {
    const saved = localStorage.getItem('minegocio_theme');
    if (saved) return saved === 'dark';
    return !document.body.classList.contains('light-theme');
  });

  const toggleTheme = () => {
    const next = !themeDark;
    setThemeDark(next);
    if (next) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('minegocio_theme', 'dark');
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('minegocio_theme', 'light');
    }
  };

  const isCashier = currentOperator?.role === 'cashier' || currentOperator?.role === 'employee';

  return (
    <header className="topbar" style={{ padding: '16px 24px 0 24px', background: 'transparent', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="topbar-title">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Punto de Venta</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' }}>Sistema POS - {currentOperator?.name || 'Dueño'}</span>
        </div>

        {sucursales.length > 1 && !isCashier && (
          <select value={currentSucursalId} onChange={e => setCurrentSucursalId(parseInt(e.target.value))}
            style={{ marginLeft: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            {sucursales.map(s => <option key={s.id} value={s.id}>🏪 {s.name}</option>)}
          </select>
        )}
      </div>
      <div className="status-indicators" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button onClick={() => setShowHelp?.(true)} style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 16px', borderRadius: '8px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.05)'} onMouseLeave={e=>e.target.style.background='transparent'}>
          Ayuda
        </button>

        {backendStatus?.status === 'ok' ? (
          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, marginLeft: '8px' }}>
            <span style={{ background: '#10B981', boxShadow: '0 0 10px #10B981', marginRight: '8px', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
            Conectado
          </span>
        ) : (
          <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, marginLeft: '8px' }}>
            <span style={{ background: '#EF4444', boxShadow: '0 0 10px #EF4444', marginRight: '8px', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }}></span>
            Sin conexion
          </span>
        )}
      </div>

      {showTutorial && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowTutorial(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: '90%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 40, boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 32 }}>Como usar MiNegocio</h2>
            {[
              { num: 1, title: 'Busca un producto', desc: 'Escanea el codigo de barras o escribi el nombre en el buscador.' },
              { num: 2, title: 'Cobra la venta', desc: 'Selecciona efectivo, tarjeta o Mercado Pago. El vuelto se calcula solo.' },
              { num: 3, title: 'Cerra la caja al final del dia', desc: 'Desde el panel lateral, conta el efectivo y confirma con tu PIN.' }
            ].map(step => (
              <div key={step.num} style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>{step.num}</div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{step.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{step.desc}</div>
                </div>
              </div>
            ))}
            <button onClick={() => setShowTutorial(false)} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: 'var(--gradient-primary)', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: 8 }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

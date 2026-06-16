import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icons } from '../ui/Icons';
import Tooltip from '../ui/Tooltip';
import LogoPrincipal from '../../assets/images/MiNegocio_transparente_real.png';
import { usePanelContext } from '../../context/PanelContext';

const PLAN_WEIGHT = { trial: 1, simple: 1, pro: 2, ia: 3 };

const NAV_ITEMS = [
  {
    category: 'OPERACIÓN',
    items: [
      { label: 'Punto de Venta', path: '/panel/ventas', icon: 'ShoppingCart', roles: ['admin', 'manager', 'operator'] },
      { label: 'Compras', path: '/panel/compras', icon: 'Truck', roles: ['admin', 'manager'], minPlan: 'simple' },
      { label: 'Clientes', path: '/panel/clientes', icon: 'Book', roles: ['admin', 'manager', 'operator'] },
    ],
  },
  {
    category: 'CATÁLOGO',
    items: [
      { label: 'Inventario', path: '/panel/inventario', icon: 'Box', roles: ['admin', 'manager'] },
      { label: 'Catálogo Web', path: '/panel/catalogo-web', icon: 'Edit', roles: ['admin', 'manager'], minPlan: 'pro' },
      { label: 'Proveedores', path: '/panel/proveedores', icon: 'Truck', roles: ['admin', 'manager'], minPlan: 'simple' },
    ],
  },
  {
    category: 'ANÁLISIS',
    roles: ['admin'],
    items: [
      { label: 'Reportes', path: '/panel/reportes', icon: 'Chart' },
      { label: 'Promociones', path: '/panel/promociones', icon: 'Tag' },
      { label: 'Recomendaciones', path: '/panel/recomendaciones', icon: 'AI', minPlan: 'ia' },
    ],
  },
  {
    category: 'SISTEMA',
    roles: ['admin'],
    items: [
      { label: 'Auditoría', path: '/panel/auditoria', icon: 'Clipboard', minPlan: 'pro' },
      { label: 'Configuración', path: '/panel/configuracion', icon: 'Settings' },
      { label: 'Usuarios', path: '/panel/usuarios', icon: 'Users' },
    ],
  },
  {
    category: 'SOPORTE',
    items: [
      { label: 'Soporte', path: '/panel/soporte', icon: 'Help' },
      { label: 'Mi Plan', path: '/panel/plan', icon: 'Crown' },
    ],
  },
];

const ICON_MAP = {
  ShoppingCart: Icons.ShoppingCart,
  Truck: Icons.Truck,
  Book: Icons.Book,
  Box: Icons.Box,
  Edit: Icons.Edit,
  Users: Icons.Users,
  Lock: Icons.Lock,
  Chart: Icons.Chart,
  Tag: Icons.Tag,
  AI: Icons.Sparkles,
  Clipboard: Icons.Clipboard,
  Settings: Icons.Settings,
  Help: Icons.Help,
  Crown: Icons.Crown,
};

export default function Sidebar({
  currentOperator, pendingSync, setShowPendingModal,
  todaySalesTotal, setShowResumen, setShowEgreso, setIsClosingCaja, currentTurnId
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPlan, addToast } = usePanelContext();
  const currentPath = location.pathname;

  const role = currentOperator?.role || 'operator';

  const isActive = (path) => currentPath === path;

  return (
    <aside className="sidebar">
      <div className="brand" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', padding: '4px 0', borderBottom: 'none', boxShadow: 'none' }} onClick={() => navigate('/panel/ventas')}>
        <img src={LogoPrincipal} alt="MiNegocio" style={{ width: '90%', maxWidth: '190px', height: 'auto', objectFit: 'contain' }} />
      </div>

      <nav className="nav-menu" style={{ overflowY: 'auto', flex: 1 }}>
        {NAV_ITEMS.map((section) => {
          if (section.roles && !section.roles.includes(role)) return null;
          const items = section.items.filter(item => {
            if (item.roles && !item.roles.includes(role)) return false;
            return true;
          });

          if (items.length === 0) return null;

          return (
            <React.Fragment key={section.category}>
              <div className="nav-section-label">{section.category}</div>
              {items.map((item) => {
                const isLocked = item.minPlan && PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT[item.minPlan];
                return (
                  <div
                    key={item.path}
                    className={`nav-item ${isActive(item.path) && !isLocked ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                    style={{
                      ...(item.label === 'Punto de Venta' ? { fontSize: '0.9rem', padding: '10px 14px', marginBottom: '4px' } : {}),
                      opacity: isLocked ? 0.5 : 1,
                      cursor: isLocked ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {ICON_MAP[item.icon] ? React.createElement(ICON_MAP[item.icon], item.label === 'Punto de Venta' ? { style: { width: 22, height: 22 } } : {}) : <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.File /></span>}
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </nav>

      <div style={{ padding: '10px', borderTop: '1px solid var(--border-color)', background: 'var(--gradient-card)', backdropFilter: 'blur(8px)', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
            <Icons.Lock style={{ width: 14, height: 14 }} /> Mi Caja
          </span>
          {currentTurnId ? (
            <span style={{ background: 'var(--gradient-primary)', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Abierta</span>
          ) : (
            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-danger)', padding: '2px 6px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cerrada</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Vendido hoy</span>
            <span style={{ color: 'var(--accent-success)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
              ${(todaySalesTotal || 0).toLocaleString('es-AR')}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Operador</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.75rem' }}>{currentOperator?.name || 'Invitado'}</span>
          </div>
          {pendingSync > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
              <span style={{ color: 'var(--accent-warning)', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setShowPendingModal(true)}>Pendientes</span>
              <span style={{ color: 'var(--accent-warning)', fontWeight: 800, fontSize: '0.85rem' }}>{pendingSync}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
          <Tooltip text="Registrar salida de efectivo" block>
            <button onClick={() => setShowEgreso(true)} style={{ width: '100%', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--border-color)', color: 'var(--accent-warning)', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icons.DollarSign style={{ width: 14, height: 14 }} /> Registrar Egreso
            </button>
          </Tooltip>
          <Tooltip text="Ver ventas del día" block>
            <button onClick={() => setShowResumen(true)} style={{ width: '100%', background: 'rgba(20,187,166, 0.1)', border: '1px solid var(--border-color)', color: 'var(--accent-primary)', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icons.Chart style={{ width: 14, height: 14 }} /> Resumen del Día
            </button>
          </Tooltip>
          {currentTurnId ? (
            <Tooltip text="F2 - Cerrar turno y cuadrar caja" block>
              <button onClick={() => setIsClosingCaja(true)} style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--border-color)', color: 'var(--accent-danger)', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Icons.Lock style={{ width: 14, height: 14 }} /> Cerrar Turno
              </button>
            </Tooltip>
          ) : (
            <Tooltip text="Abrir caja para vender" block>
              <button onClick={() => { localStorage.setItem('minegocio_onboarding_pending', 'true'); window.location.reload(); }} style={{ width: '100%', background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '8px 10px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(20, 187, 166, 0.3)' }}>
                Abrir Caja
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}

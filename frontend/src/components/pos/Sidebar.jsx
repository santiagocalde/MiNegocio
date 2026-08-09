import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icons } from '../ui/Icons';
import Tooltip from '../ui/Tooltip';
import ThemeToggle from './ThemeToggle';
import LogoPrincipal from '../../assets/images/MiNegocio_transparente_real.png';
import { usePanelContext } from '../../context/PanelContext';
import { getBusinessFeatures } from '../../config/businessDefaults';
import useIsMobile from '../../hooks/useIsMobile';

const PLAN_WEIGHT = { trial: 1, simple: 1, pro: 2, ia: 3 };

const NAV_ITEMS = [
  {
    category: 'OPERACIÓN',
    items: [
      { label: 'Inicio', path: '/panel/inicio', icon: 'Home', roles: ['admin', 'manager', 'operator', 'vendedor'] },
      { label: 'Punto de Venta', short: 'Vender', path: '/panel/ventas', icon: 'ShoppingCart', roles: ['admin', 'manager', 'operator', 'vendedor'] },
      { label: 'Compras', path: '/panel/compras', icon: 'Truck', roles: ['admin', 'manager'], minPlan: 'simple', featureKey: 'compras' },
      { label: 'Fiados', path: '/panel/clientes', icon: 'Book', roles: ['admin', 'manager', 'operator', 'vendedor'], featureKey: 'fiados' },
    ],
  },
  {
    category: 'CATÁLOGO',
    items: [
      { label: 'Inventario', path: '/panel/inventario', icon: 'Box', roles: ['admin', 'manager', 'vendedor'] },
      { label: 'Catálogo Web', short: 'Catálogo', path: '/panel/catalogo-web', icon: 'Edit', roles: ['admin', 'manager'], minPlan: 'pro', featureKey: 'catalogo' },
      { label: 'Proveedores', path: '/panel/proveedores', icon: 'Truck', roles: ['admin', 'manager'], minPlan: 'simple', featureKey: 'proveedores' },
      { label: 'Etiquetas', path: '/panel/etiquetas', icon: 'Printer', roles: ['admin', 'manager', 'vendedor'] },
    ],
  },
  {
    category: 'CLIENTES',
    items: [
      { label: 'Lista de clientes', path: '/panel/lista-clientes', icon: 'Users', roles: ['admin', 'manager', 'operator', 'vendedor'] },
    ],
  },
  {
    category: 'ANÁLISIS',
    roles: ['admin'],
    items: [
      { label: 'Dashboard', path: '/panel/dashboard', icon: 'Chart', minPlan: 'pro' },
      { label: 'Reportes', path: '/panel/reportes', icon: 'Chart' },
      { label: 'Promociones', path: '/panel/promociones', icon: 'Tag', featureKey: 'promociones' },
      { label: 'Sugerencias IA', short: 'IA', path: '/panel/recomendaciones', icon: 'AI', minPlan: 'ia', featureKey: 'recomendaciones' },
    ],
  },
  {
    category: 'SISTEMA',
    roles: ['admin'],
    items: [
      { label: 'Historial', path: '/panel/auditoria', icon: 'Clipboard', minPlan: 'pro', featureKey: 'auditoria' },
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

const Home = () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z" /></svg>;

const ICON_MAP = {
  Home,
  ShoppingCart: Icons.ShoppingCart,
  Truck: Icons.Truck,
  Book: Icons.Book,
  Box: Icons.Box,
  Edit: Icons.Edit,
  Users: Icons.Users,
  Lock: Icons.Lock,
  Chart: Icons.Chart,
  Tag: Icons.Tag,
  Printer: Icons.Printer,
  AI: Icons.Sparkles,
  Clipboard: Icons.Clipboard,
  Settings: Icons.Settings,
  Help: Icons.Help,
  Crown: Icons.Crown,
};

export default function Sidebar({
  currentOperator, pendingSync, setShowPendingModal,
  todaySalesTotal, setShowResumen, setShowEgreso, setIsClosingCaja, currentTurnId, turnOpenedAt, initialCash
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPlan, businessType } = usePanelContext();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  // En mobile el sidebar arranca como riel de íconos (retraído); el usuario
  // puede expandirlo con el botón. En desktop queda expandido como siempre.
  // Se ajusta al cambiar de mobile↔desktop con el patrón de "estado derivado en
  // render" (sin effect) para no disparar renders en cascada.
  const [collapsed, setCollapsed] = useState(isMobile);
  const prevIsMobileRef = useRef(isMobile);
  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      prevIsMobileRef.current = isMobile;
      setCollapsed(isMobile);
    }
  }, [isMobile]);

  const role = currentOperator?.role || 'admin';

  const isActive = (path) => {
    const [pathname, qs] = path.split('?');
    if (qs) {
      // Si el item tiene query string, exigir que coincida el search también
      return currentPath === pathname && location.search === `?${qs}`;
    }
    // Si no tiene query string, solo activo cuando tampoco hay search
    return currentPath === pathname && !location.search;
  };

  const features = getBusinessFeatures(businessType);

  // Labels contextuales por rubro
  const corralonLabels = businessType === 'corralon' ? {
    'Inventario': 'Depósito',
    'Punto de Venta': 'Mostrador',
    'Fiados': 'Cuentas corrientes',
    'Compras': 'Proveedores',
  } : {};

  // Insertar items condicionales según rubro (dentro del componente, donde businessType existe)
  if (businessType === 'corralon') {
    // Reorganizar todo el sidebar para estructura de corralón
    const newStructure = [
      {
        category: 'ADMIN',
        roles: ['admin', 'manager'],
        items: [
          { label: 'Dashboard', path: '/panel/dashboard', icon: 'Chart', roles: ['admin'] },
          { label: 'Caja', path: '/panel/inicio', icon: 'Lock', roles: ['admin', 'manager'] },
          { label: 'Historial', path: '/panel/auditoria', icon: 'Clipboard', roles: ['admin', 'manager'], minPlan: 'pro', featureKey: 'auditoria' },
        ],
      },
      {
        category: 'VENTAS',
        items: [
          { label: 'Mostrador', path: '/panel/ventas', icon: 'ShoppingCart', roles: ['admin', 'manager', 'operator', 'vendedor'] },
          { label: 'Presupuestos', path: '/panel/presupuestos', icon: 'Clipboard', roles: ['admin', 'manager', 'vendedor'] },
          { label: 'Devoluciones', path: '/panel/devoluciones', icon: 'Edit', roles: ['admin', 'manager'] },
          { label: 'Acopios', path: '/panel/acopios', icon: 'Box', roles: ['admin', 'manager', 'vendedor'] },
        ],
      },
      {
        category: 'LOGÍSTICA',
        roles: ['admin', 'manager', 'logistica'],
        items: [
          { label: 'Notas de pedido', path: '/panel/remitos', icon: 'Truck', roles: ['admin', 'manager'] },
          { label: 'Despacho del día', path: '/panel/remitos?filter=today', icon: 'Clock', roles: ['admin', 'manager', 'logistica'] },
        ],
      },
      {
        category: 'CLIENTES',
        items: [
          { label: 'Lista de clientes', path: '/panel/lista-clientes', icon: 'Users', roles: ['admin', 'manager', 'operator', 'vendedor'] },
          { label: 'Cuentas corrientes', path: '/panel/clientes', icon: 'Book', roles: ['admin', 'manager', 'operator', 'vendedor'], featureKey: 'fiados' },
        ],
      },
      {
        category: 'STOCK',
        roles: ['admin', 'manager'],
        items: [
          { label: 'Depósito', path: '/panel/inventario', icon: 'Box' },
          { label: 'Compras', path: '/panel/compras', icon: 'Truck', minPlan: 'simple', featureKey: 'compras' },
        ],
      },
      {
        category: 'PROVEEDORES',
        roles: ['admin', 'manager'],
        items: [
          { label: 'Lista de proveedores', path: '/panel/proveedores', icon: 'Truck', minPlan: 'simple', featureKey: 'proveedores' },
          { label: 'Pedido a proveedor', path: '/panel/compras', icon: 'Edit' },
        ],
      },
      {
        category: 'SISTEMA',
        roles: ['admin'],
        items: [
          { label: 'Configuración', path: '/panel/configuracion', icon: 'Settings' },
          { label: 'Usuarios', path: '/panel/usuarios', icon: 'Users' },
        ],
      },
    ];
    // Reemplazar NAV_ITEMS completamente para corralón
    NAV_ITEMS.length = 0;
    NAV_ITEMS.push(...newStructure);
    // También mantener los labels contextuales
    corralonLabels['Punto de Venta'] = 'Mostrador';
    corralonLabels['Inventario'] = 'Depósito';
    corralonLabels['Fiados'] = 'Cuentas corrientes';
    corralonLabels['Compras'] = 'Compras';
  }

  return (
    <>
    {isMobile && !collapsed && <div className="sidebar-backdrop" onClick={() => setCollapsed(true)} />}
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '6px 8px', borderBottom: 'none', boxShadow: 'none' }}>
        <img className="sidebar-logo" src={LogoPrincipal} alt="MiNegocio" onClick={() => navigate('/panel/ventas')} style={{ maxWidth: '120px', width: '70%', height: 'auto', objectFit: 'contain', cursor: 'pointer' }} />
        <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expandir menú' : 'Contraer menú'} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, minWidth: 30, height: 30, fontSize: '1.1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <nav className="nav-menu" style={{ overflowY: 'auto', flex: 1 }}>
        <div data-tour="sidebar-nav">
        {NAV_ITEMS.map((section) => {
          if (section.roles && !section.roles.includes(role)) return null;
          const items = section.items.filter(item => {
            if (item.roles && !item.roles.includes(role)) return false;
            if (item.featureKey && !features[item.featureKey]) return false;
            return true;
          });

          if (items.length === 0) return null;

          return (
            <React.Fragment key={section.category}>
              <div className="nav-section-label">{section.category}</div>
              {items
                .filter((item) => !item.minPlan || PLAN_WEIGHT[currentPlan] >= PLAN_WEIGHT[item.minPlan])
                .map((item) => {
                const isLocked = item.minPlan && PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT[item.minPlan];
                return (
                  <div
                    key={item.path}
                    className={`nav-item ${isActive(item.path) && !isLocked ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                    title={item.label}
                    style={{
                      opacity: isLocked ? 0.5 : 1,
                      cursor: isLocked ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {ICON_MAP[item.icon] ? React.createElement(ICON_MAP[item.icon]) : <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.File /></span>}
                      <span className="nav-label">{isMobile && item.short ? item.short : (corralonLabels[item.label] || item.label)}</span>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
        </div>
      </nav>

      <div className="sidebar-footer" style={{ padding: '10px', borderTop: '1px solid var(--border-color)', background: 'var(--gradient-card)', backdropFilter: 'blur(8px)', marginTop: 'auto' }}>
        <div className="sidebar-caja-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
            <Icons.Lock style={{ width: 14, height: 14 }} /> Mi Caja
          </span>
          {currentTurnId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span style={{ background: 'var(--gradient-primary)', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Abierta</span>
              {turnOpenedAt && (() => {
                {/* eslint-disable-next-line react-hooks/purity */}
                const hours = Math.max(0, (Date.now() - new Date(turnOpenedAt).getTime()) / 3600000);
                const h = Math.floor(hours);
                const m = Math.floor((hours - h) * 60);
                return (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 500 }}>
                    {h > 0 ? `${h}h ${m}m` : `${m}m`}
                  </span>
                );
              })()}
            </div>
          ) : (
            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-danger)', padding: '2px 6px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cerrada</span>
          )}
        </div>

        <div className="sidebar-caja-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Vendido hoy</span>
            <span style={{ color: 'var(--accent-success)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
              ${(todaySalesTotal || 0).toLocaleString('es-AR')}
            </span>
          </div>
          {initialCash > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Caja inicial</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                ${(initialCash || 0).toLocaleString('es-AR')}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Operador</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 'var(--fs-sm)' }}>{currentOperator?.name || 'Invitado'}</span>
          </div>
          {pendingSync > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
              <span style={{ color: 'var(--accent-warning)', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setShowPendingModal(true)}>Pendientes</span>
              <span style={{ color: 'var(--accent-warning)', fontWeight: 800, fontSize: '0.85rem' }}>{pendingSync}</span>
            </div>
          )}
        </div>

        <div data-tour="sidebar-bottom" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
          <Tooltip text="Registrar salida de efectivo" block>
            <button onClick={() => setShowEgreso(true)} title="Registrar Egreso" style={{ width: '100%', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--border-color)', color: 'var(--accent-warning)', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icons.DollarSign style={{ width: 14, height: 14 }} /> <span className="btn-label">Egreso</span>
            </button>
          </Tooltip>
          <Tooltip text="Ver ventas del día" block>
            <button onClick={() => setShowResumen(true)} title="Resumen del Día" style={{ width: '100%', background: 'rgba(20,187,166, 0.1)', border: '1px solid var(--border-color)', color: 'var(--accent-primary)', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icons.Chart style={{ width: 14, height: 14 }} /> <span className="btn-label">Resumen</span>
            </button>
          </Tooltip>
          {currentTurnId ? (
            <Tooltip text="F2 - Cerrar turno y cuadrar caja" block>
              <button onClick={() => setIsClosingCaja(true)} title="Cerrar Turno" style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--border-color)', color: 'var(--accent-danger)', padding: '6px 10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Icons.Lock style={{ width: 14, height: 14 }} /> <span className="btn-label">Cerrar</span>
              </button>
            </Tooltip>
          ) : (
            <Tooltip text="Abrir caja para vender" block>
              <button onClick={() => { localStorage.setItem('minegocio_onboarding_pending', 'true'); window.location.reload(); }} title="Abrir Caja" style={{ width: '100%', background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '8px 10px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(20, 187, 166, 0.3)' }}>
                <Icons.Lock style={{ width: 14, height: 14 }} /> <span className="btn-label">Abrir Caja</span>
              </button>
            </Tooltip>
          )}
        </div>

        {/* Toggle de tema claro/oscuro */}
        <div style={{ marginTop: 8 }}>
          <ThemeToggle collapsed={collapsed} />
        </div>

        {/* Legal footer */}
        <div className="sidebar-legal" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: 12 }}>
          <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textDecoration: 'none', opacity: 0.6 }} onMouseEnter={e => e.target.style.opacity = '1'} onMouseLeave={e => e.target.style.opacity = '0.6'}>Términos</a>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.3 }}>·</span>
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textDecoration: 'none', opacity: 0.6 }} onMouseEnter={e => e.target.style.opacity = '1'} onMouseLeave={e => e.target.style.opacity = '0.6'}>Privacidad</a>
        </div>
      </div>
    </aside>
    </>
  );
}

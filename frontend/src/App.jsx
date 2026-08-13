import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PanelProvider, usePanelContext } from './context/PanelContext';
import PanelLayout from './layouts/PanelLayout';
import LandingPage from './pages/LandingPage';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { captureSource } from './utils/attribution';
import './index.css';
import './App.css';

// Atribución first-touch: registrar el canal de origen al cargar la app.
captureSource();

const InicioPage = lazy(() => import('./pages/InicioPage'));
const VentasPage = lazy(() => import('./pages/VentasPage'));
const PlanPage = lazy(() => import('./pages/PlanPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SoportePage = lazy(() => import('./pages/SoportePage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const NosotrosPage = lazy(() => import('./pages/NosotrosPage'));
const ContactoPage = lazy(() => import('./pages/ContactoPage'));
const SoportePublicoPage = lazy(() => import('./pages/SoportePublicoPage'));
const StockModule = lazy(() => import('./features/StockModule'));
const PurchasesModule = lazy(() => import('./features/PurchasesModule'));
const FiadoModule = lazy(() => import('./features/FiadoModule'));
const ProveedoresModule = lazy(() => import('./features/ProveedoresModule'));
const EtiquetasModule = lazy(() => import('./features/EtiquetasModule'));
const CatalogoModule = lazy(() => import('./features/CatalogoModule'));
const ReportsModule = lazy(() => import('./features/ReportsModule'));
const PromotionModule = lazy(() => import('./features/PromotionModule'));
const RecomendacionesModule = lazy(() => import('./features/RecomendacionesModule'));
const UsuariosModule = lazy(() => import('./features/UsuariosModule'));
const AuditModule = lazy(() => import('./features/AuditModule'));
const QuotesModule = lazy(() => import('./features/QuotesModule'));
const RemitosModule = lazy(() => import('./features/RemitosModule'));
const ObrasModule = lazy(() => import('./features/ObrasModule'));
const AcopiosModule = lazy(() => import('./features/AcopiosModule'));
const ClientesModule = lazy(() => import('./features/ClientesModule'));
const CreditNotesModule = lazy(() => import('./features/CreditNotesModule'));
const DashboardModule = lazy(() => import('./features/DashboardModule'));
const PreviewPage = lazy(() => import('./pages/PreviewPage'));
const PublicCatalog = lazy(() => import('./pages/PublicCatalog'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

function PanelSuspense({ children }) {
  return (
    <Suspense fallback={
      <div style={{ padding: 40, color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600 }}>
        Cargando...
      </div>
    }>
      {children}
    </Suspense>
  );
}

// Mapa de moduleKey → path de fallback (primer módulo disponible del operador)
const MODULE_PATH = {
  'Mostrador':          '/panel/ventas',
  'Presupuestos':       '/panel/presupuestos',
  'Acopios':            '/panel/acopios',
  'Lista de clientes':  '/panel/lista-clientes',
  'Cuentas corrientes': '/panel/clientes',
  'Notas de pedido':    '/panel/remitos',
  'Depósito':           '/panel/inventario',
  'Historial':          '/panel/auditoria',
  'Reportes':           '/panel/dashboard',
  'Configuración':      '/panel/configuracion',
};

/**
 * Protege una ruta por módulo o por rol. Sólo actúa cuando el operador tiene
 * permisos personalizados (permissions != null && length > 0); si usa los
 * defaults del rol el sidebar es la única barrera (nivel básico acordado).
 *
 * - adminOnly: sólo admin puede entrar. manager y resto son redirigidos.
 * - moduleKey: si el operador tiene perms custom y NO incluye esta clave,
 *   redirige a su primer módulo permitido (o /panel/ventas).
 */
function RoleGuard({ children, moduleKey, adminOnly }) {
  const { auth } = usePanelContext();
  const currentOperator = auth?.currentOperator;

  // Sin operador: PanelProvider ya maneja la autenticación.
  if (!currentOperator) return children;

  const role = currentOperator.role;
  const perms = currentOperator.permissions; // null | string[]
  const isPrivileged = role === 'admin' || role === 'manager';

  // Admin y manager pasan todo.
  if (isPrivileged) return children;

  // Rutas exclusivas de admin.
  if (adminOnly) {
    const fallback = Array.isArray(perms) && perms.length > 0
      ? (MODULE_PATH[perms[0]] || '/panel/ventas')
      : '/panel/ventas';
    return <Navigate to={fallback} replace />;
  }

  // Sin moduleKey o sin perms personalizados: la ruta es accesible.
  if (!moduleKey || !Array.isArray(perms) || perms.length === 0) return children;

  // Si el módulo está en los perms, OK.
  if (perms.includes(moduleKey)) return children;

  // No permitido: ir al primer módulo habilitado.
  const fallback = MODULE_PATH[perms[0]] || '/panel/ventas';
  return <Navigate to={fallback} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/nosotros" element={<PanelSuspense><NosotrosPage /></PanelSuspense>} />
        <Route path="/contacto" element={<PanelSuspense><ContactoPage /></PanelSuspense>} />
        <Route path="/soporte" element={<PanelSuspense><SoportePublicoPage /></PanelSuspense>} />
        <Route path="/register" element={<PanelSuspense><Onboarding /></PanelSuspense>} />
        <Route path="/login" element={<Navigate to="/" replace />} />

        <Route path="/panel" element={
          <ErrorBoundary>
            <PanelProvider>
              <PanelLayout />
            </PanelProvider>
          </ErrorBoundary>
        }>
          <Route index element={<Navigate to="inicio" replace />} />
          <Route path="inicio" element={<PanelSuspense><InicioPage /></PanelSuspense>} />
          <Route path="ventas" element={<RoleGuard moduleKey="Mostrador"><PanelSuspense><VentasPage /></PanelSuspense></RoleGuard>} />
          <Route path="inventario" element={<RoleGuard moduleKey="Depósito"><PanelSuspense><StockModule /></PanelSuspense></RoleGuard>} />
          <Route path="compras" element={<PanelSuspense><PurchasesModule /></PanelSuspense>} />
          <Route path="clientes" element={<RoleGuard moduleKey="Cuentas corrientes"><PanelSuspense><FiadoModule /></PanelSuspense></RoleGuard>} />
          <Route path="proveedores" element={<PanelSuspense><ProveedoresModule /></PanelSuspense>} />
          <Route path="etiquetas" element={<PanelSuspense><EtiquetasModule /></PanelSuspense>} />
          <Route path="catalogo-web" element={<PanelSuspense><CatalogoModule /></PanelSuspense>} />
          <Route path="reportes" element={<PanelSuspense><ReportsModule /></PanelSuspense>} />
          <Route path="promociones" element={<PanelSuspense><PromotionModule /></PanelSuspense>} />
          <Route path="recomendaciones" element={<PanelSuspense><RecomendacionesModule /></PanelSuspense>} />
          <Route path="usuarios" element={<RoleGuard adminOnly><PanelSuspense><UsuariosModule /></PanelSuspense></RoleGuard>} />
          <Route path="auditoria" element={<RoleGuard moduleKey="Historial"><PanelSuspense><AuditModule /></PanelSuspense></RoleGuard>} />
          <Route path="presupuestos" element={<RoleGuard moduleKey="Presupuestos"><PanelSuspense><QuotesModule /></PanelSuspense></RoleGuard>} />
          <Route path="remitos" element={<RoleGuard moduleKey="Notas de pedido"><PanelSuspense><RemitosModule /></PanelSuspense></RoleGuard>} />
          <Route path="obras" element={<PanelSuspense><ObrasModule /></PanelSuspense>} />
          <Route path="lista-clientes" element={<RoleGuard moduleKey="Lista de clientes"><PanelSuspense><ClientesModule /></PanelSuspense></RoleGuard>} />
          <Route path="acopios" element={<RoleGuard moduleKey="Acopios"><PanelSuspense><AcopiosModule /></PanelSuspense></RoleGuard>} />
          <Route path="devoluciones" element={<PanelSuspense><CreditNotesModule /></PanelSuspense>} />
          <Route path="dashboard" element={<RoleGuard moduleKey="Reportes"><PanelSuspense><DashboardModule /></PanelSuspense></RoleGuard>} />
          <Route path="configuracion" element={<RoleGuard adminOnly><PanelSuspense><ConfigPage /></PanelSuspense></RoleGuard>} />
          <Route path="soporte" element={<PanelSuspense><SoportePage /></PanelSuspense>} />
          <Route path="plan" element={<PanelSuspense><PlanPage /></PanelSuspense>} />
        </Route>

        <Route path="/admin" element={<PanelSuspense><AdminPage /></PanelSuspense>} />
    <Route path="/t/:slug" element={<PanelSuspense><PublicCatalog /></PanelSuspense>} />
        <Route path="/preview" element={<PanelSuspense><PreviewPage /></PanelSuspense>} />
        <Route path="/terminos" element={<PanelSuspense><TermsPage /></PanelSuspense>} />
        <Route path="/privacidad" element={<PanelSuspense><PrivacyPage /></PanelSuspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

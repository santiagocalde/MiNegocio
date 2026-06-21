import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PanelProvider } from './context/PanelContext';
import PanelLayout from './layouts/PanelLayout';
import LandingPage from './pages/LandingPage';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './index.css';
import './App.css';

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
const CatalogoModule = lazy(() => import('./features/CatalogoModule'));
const ReportsModule = lazy(() => import('./features/ReportsModule'));
const PromotionModule = lazy(() => import('./features/PromotionModule'));
const RecomendacionesModule = lazy(() => import('./features/RecomendacionesModule'));
const UsuariosModule = lazy(() => import('./features/UsuariosModule'));
const AuditModule = lazy(() => import('./features/AuditModule'));
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
          <Route path="ventas" element={<PanelSuspense><VentasPage /></PanelSuspense>} />
          <Route path="inventario" element={<PanelSuspense><StockModule /></PanelSuspense>} />
          <Route path="compras" element={<PanelSuspense><PurchasesModule /></PanelSuspense>} />
          <Route path="clientes" element={<PanelSuspense><FiadoModule /></PanelSuspense>} />
          <Route path="proveedores" element={<PanelSuspense><ProveedoresModule /></PanelSuspense>} />
          <Route path="catalogo-web" element={<PanelSuspense><CatalogoModule /></PanelSuspense>} />
          <Route path="reportes" element={<PanelSuspense><ReportsModule /></PanelSuspense>} />
          <Route path="promociones" element={<PanelSuspense><PromotionModule /></PanelSuspense>} />
          <Route path="recomendaciones" element={<PanelSuspense><RecomendacionesModule /></PanelSuspense>} />
          <Route path="usuarios" element={<PanelSuspense><UsuariosModule /></PanelSuspense>} />
          <Route path="auditoria" element={<PanelSuspense><AuditModule /></PanelSuspense>} />
          <Route path="configuracion" element={<PanelSuspense><ConfigPage /></PanelSuspense>} />
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

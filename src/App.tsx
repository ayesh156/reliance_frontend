import React, { useEffect } from 'react';
import './index.css';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TooltipProvider } from './components/ui/tooltip';
import { OfflineSentinel } from './components/common/OfflineSentinel';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AttributesPage } from './pages/AttributesPage';
import { useVersionCheck } from './hooks/useVersionCheck';
import { getFirstAllowedRoute } from './utils/navigation';

// Active Pages (Phase 1 & Phase 2)
import { Login } from './pages/Login';
import { Products } from './pages/Products';
import { ProductFormPage } from './pages/ProductFormPage';
import { Settings } from './pages/Settings';
import { RawMaterialShopsPage } from './pages/RawMaterialShopsPage';
import { RawMaterialItemsPage } from './pages/RawMaterialItemsPage';
import { CustomersPage } from './pages/CustomersPage';
import { QuickInvoicePage } from './pages/QuickInvoicePage';
import { InvoicesPage } from './pages/InvoicesPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderCreatePage } from './pages/OrderCreatePage';
import { BuyRawMaterialsPage } from './pages/BuyRawMaterialsPage';
import BuyRawMaterialFormPage from './pages/BuyRawMaterialFormPage';
import { CuttingListPage } from './pages/CuttingListPage';
import { LinePage } from './pages/LinePage';
import { WashPage } from './pages/WashPage';
import { ReportsPage } from './pages/ReportsPage';
import { Dashboard } from './pages/Dashboard';

// Luxury Fashion Storefront Suite (Chanel Haute Couture Style)
import { StorefrontLayout } from './components/storefront/StorefrontLayout';
import { HomePage } from './pages/storefront/HomePage';
import { ShopPage } from './pages/storefront/ShopPage';
import { AboutPage } from './pages/storefront/AboutPage';
import { ContactPage } from './pages/storefront/ContactPage';
import { ProductDetailPage } from './pages/storefront/ProductDetailPage';

function ThemedToastContainer() {
  const { resolvedTheme } = useTheme();
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      limit={3}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      style={{ zIndex: 999999 }}
    />
  );
}

const RouteLoadingFallback = () => (
  <div className="min-h-screen bg-[#f8f8f6] dark:bg-[#09090b] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="size-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Loading...</span>
    </div>
  </div>
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function SystemLandingRedirect() {
  const { user } = useAuth();
  return <Navigate to={getFirstAllowedRoute(user)} replace />;
}

function QuickInvoiceRouteWrapper() {
  const { user, hasPermission } = useAuth();
  if (user && user.role === 'STAFF' && !hasPermission('pos')) {
    return <Navigate to={getFirstAllowedRoute(user)} replace />;
  }
  return (
    <ProtectedRoute requiredPermission="pos">
      <AdminPage>
        <QuickInvoicePage />
      </AdminPage>
    </ProtectedRoute>
  );
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

export function App() {
  useVersionCheck();

  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <TooltipProvider delayDuration={150}>
          <OfflineSentinel />
          <ThemedToastContainer />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
            <ErrorBoundary>
              <React.Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
              {/* ── Public Luxury Storefront Routes - Zero Auth Required ── */}
              <Route
                path="/"
                element={
                  <StorefrontLayout>
                    <HomePage />
                  </StorefrontLayout>
                }
              />
              <Route
                path="/shop"
                element={
                  <StorefrontLayout>
                    <ShopPage />
                  </StorefrontLayout>
                }
              />
              <Route
                path="/about"
                element={
                  <StorefrontLayout>
                    <AboutPage />
                  </StorefrontLayout>
                }
              />
              <Route
                path="/contact"
                element={
                  <StorefrontLayout>
                    <ContactPage />
                  </StorefrontLayout>
                }
              />
              <Route
                path="/product/:id"
                element={
                  <StorefrontLayout>
                    <ProductDetailPage />
                  </StorefrontLayout>
                }
              />
              <Route
                path="/shop/product/:id"
                element={
                  <StorefrontLayout>
                    <ProductDetailPage />
                  </StorefrontLayout>
                }
              />

              {/* ── Auth Portal ── */}
              <Route path="/login" element={<Login />} />

              {/* ── Legacy Direct Navigation Shortcuts (Prevent Root Hijack) ── */}
              <Route path="/dashboard" element={<Navigate to="/system/invoices" replace />} />
              <Route path="/invoices" element={<Navigate to="/system/invoices" replace />} />
              <Route path="/products" element={<Navigate to="/system/products" replace />} />

              {/* ── Admin Back-Office (/system/*) ── */}
              {/* Default Dynamic Landing Page: Smart redirection based on user permissions */}
              <Route
                path="/system"
                element={<SystemLandingRedirect />}
              />
              <Route
                path="/system/dashboard"
                element={
                  <ProtectedRoute requiredRole={['ADMIN', 'STAFF', 'CASHIER']}>
                    <AdminPage>
                      <Dashboard />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/products"
                element={
                  <ProtectedRoute requiredPermission="products">
                    <AdminPage>
                      <Products />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/products/new"
                element={
                  <ProtectedRoute requiredPermission="products" requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <ProductFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/system/products/:id/edit"
                element={
                  <ProtectedRoute requiredPermission="products" requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <ProductFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/system/products/edit/:id"
                element={
                  <ProtectedRoute requiredPermission="products" requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <ProductFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/attributes"
                element={
                  <ProtectedRoute requiredPermission="products" requiredRole="STAFF">
                    <AdminPage>
                      <AttributesPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/customers"
                element={
                  <ProtectedRoute requiredPermission="customers">
                    <AdminPage>
                      <CustomersPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Quick Invoice / POS Cashier Terminal Route */}
              <Route
                path="/system/quick-invoice"
                element={<QuickInvoiceRouteWrapper />}
              />

              {/* Legacy Quick Checkout Alias (Preserves Existing Bookmarks & Links) */}
              <Route
                path="/system/quick-checkout"
                element={<QuickInvoiceRouteWrapper />}
              />

              {/* Invoices & Sales Ledger Management Route */}
              <Route
                path="/system/invoices"
                element={
                  <ProtectedRoute requiredPermission="invoices">
                    <AdminPage>
                      <InvoicesPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Presales Orders Management Route */}
              <Route
                path="/system/orders"
                element={
                  <ProtectedRoute requiredPermission="orders">
                    <AdminPage>
                      <OrdersPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Presales Order Creation Route */}
              <Route
                path="/system/orders/new"
                element={
                  <ProtectedRoute requiredPermission="orders">
                    <AdminPage>
                      <OrderCreatePage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Direct Root Shortcuts for Orders */}
              <Route path="/orders" element={<Navigate to="/system/orders" replace />} />
              <Route path="/orders/new" element={<Navigate to="/system/orders/new" replace />} />

              {/* Garment Cutting & Production Routes */}
              <Route
                path="/system/cutting"
                element={
                  <ProtectedRoute requiredPermission="cutting" requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <CuttingListPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/system/cutting/new"
                element={<Navigate to="/system/cutting" replace />}
              />
              <Route
                path="/system/cutting/edit/:id"
                element={<Navigate to="/system/cutting" replace />}
              />

              {/* Legacy /system/production Redirect & Aliasing (Preserves Existing Bookmarks & Links) */}
              <Route
                path="/system/production"
                element={<Navigate to="/system/cutting" replace />}
              />
              <Route
                path="/system/production/new"
                element={<Navigate to="/system/cutting" replace />}
              />
              <Route
                path="/system/production/edit/:id"
                element={<Navigate to="/system/cutting" replace />}
              />

              {/* Direct Root Shortcuts for Cutting */}
              <Route path="/cutting" element={<Navigate to="/system/cutting" replace />} />
              <Route path="/production" element={<Navigate to="/system/cutting" replace />} />

              {/* Direct Root Shortcuts for Sewing Line */}
              <Route path="/line" element={<Navigate to="/system/line" replace />} />

              {/* Sewing Line Stage Route */}
              <Route
                path="/system/line"
                element={
                  <ProtectedRoute requiredPermission="line" requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <LinePage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Direct Root Shortcuts for Wash */}
              <Route path="/wash" element={<Navigate to="/system/wash" replace />} />

              {/* Garment Wash Stage & Sellable Stock Sync */}
              <Route
                path="/system/wash"
                element={
                  <ProtectedRoute requiredPermission="wash" requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <WashPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Raw Material Stock Purchases Route */}
              <Route
                path="/system/buy-raw-materials"
                element={
                  <ProtectedRoute requiredPermission="materials" requiredRole="ADMIN">
                    <AdminPage>
                      <BuyRawMaterialsPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Dedicated New Stock Purchase Form Page */}
              <Route
                path="/system/buy-raw-materials/new"
                element={
                  <ProtectedRoute requiredPermission="materials" requiredRole="ADMIN">
                    <AdminPage>
                      <BuyRawMaterialFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Raw Material Suppliers Route with full /system path */}
              <Route
                path="/system/raw-material-shops"
                element={
                  <ProtectedRoute requiredPermission="materials" requiredRole="ADMIN">
                    <AdminPage>
                      <RawMaterialShopsPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Raw Material Inventory Items Directory Route */}
              <Route
                path="/system/raw-material-items"
                element={
                  <ProtectedRoute requiredPermission="materials" requiredRole="ADMIN">
                    <AdminPage>
                      <RawMaterialItemsPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Raw Material Purchase Order Edit Route */}
              <Route
                path="/system/buy-raw-materials/edit/:id"
                element={
                  <ProtectedRoute requiredPermission="materials" requiredRole="ADMIN">
                    <AdminPage>
                      <BuyRawMaterialFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Enterprise Reports & Analytics Route */}
              <Route
                path="/system/reports"
                element={
                  <ProtectedRoute requiredPermission="reports" requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <ReportsPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/materials"
                element={<Navigate to="/system/buy-raw-materials" replace />}
              />

              <Route
                path="/system/settings"
                element={
                  <ProtectedRoute requiredPermission="settings" requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <Settings />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Explicit Admin-Only User Management Route */}
              <Route
                path="/system/settings/users"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminPage>
                      <Settings />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* ── Catch-all Fallbacks ── */}
              {/* Unknown back-office subroutes redirect directly to the default landing page (/system/invoices) */}
              <Route path="/system/*" element={<SystemLandingRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </React.Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </NotificationProvider>
    </AuthProvider>
  </ThemeProvider>
  );
}

export default App;
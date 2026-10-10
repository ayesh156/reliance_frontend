import React, { useEffect } from 'react';
import './index.css';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TooltipProvider } from './components/ui/Tooltip';
import { AttributesPage } from './pages/AttributesPage';

// Active Pages (Phase 1 & Phase 2)
import { Login } from './pages/Login';
import { Products } from './pages/Products';
import { ProductFormPage } from './pages/ProductFormPage';
import { Settings } from './pages/Settings';
import { RawMaterialShopsPage } from './pages/RawMaterialShopsPage';
import { RawMaterialItemsPage } from './pages/RawMaterialItemsPage';
import { CustomersPage } from './pages/CustomersPage';
import { QuickCheckoutPage } from './pages/QuickCheckoutPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { BuyRawMaterialsPage } from './pages/BuyRawMaterialsPage';
import BuyRawMaterialFormPage from './pages/BuyRawMaterialFormPage';
import { ProductionListPage } from './pages/ProductionListPage';
import { ProductionFormPage } from './pages/ProductionFormPage';
import { ReportsPage } from './pages/ReportsPage';
import { Dashboard } from './pages/Dashboard';

// Luxury Fashion Storefront Suite (Chanel Haute Couture Style)
import { StorefrontLayout } from './components/storefront/StorefrontLayout';
import { HomePage } from './pages/storefront/HomePage';
import { ShopPage } from './pages/storefront/ShopPage';
import { AboutPage } from './pages/storefront/AboutPage';
import { ContactPage } from './pages/storefront/ContactPage';

function ThemedToastContainer() {
  const { resolvedTheme } = useTheme();
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider delayDuration={150}>
          <ThemedToastContainer />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
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

              {/* ── Auth Portal ── */}
              <Route path="/login" element={<Login />} />

              {/* ── Legacy Direct Navigation Shortcuts (Prevent Root Hijack) ── */}
              <Route path="/dashboard" element={<Navigate to="/system/dashboard" replace />} />
              <Route path="/products" element={<Navigate to="/system/products" replace />} />

              {/* ── Admin Back-Office (/system/*) ── */}
              <Route
                path="/system"
                element={<Navigate to="/system/products" replace />}
              />
              <Route
                path="/system/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminPage>
                      <Dashboard />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/products"
                element={
                  <ProtectedRoute>
                    <AdminPage>
                      <Products />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/products/new"
                element={
                  <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <ProductFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/system/products/:id/edit"
                element={
                  <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
                    <AdminPage>
                      <ProductFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/attributes"
                element={
                  <ProtectedRoute requiredRole="STAFF">
                    <AdminPage>
                      <AttributesPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/customers"
                element={
                  <ProtectedRoute>
                    <AdminPage>
                      <CustomersPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Quick Checkout Cashier Terminal Route */}
              <Route
                path="/system/quick-checkout"
                element={
                  <ProtectedRoute>
                    <AdminPage>
                      <QuickCheckoutPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Invoices & Sales Ledger Management Route */}
              <Route
                path="/system/invoices"
                element={
                  <ProtectedRoute>
                    <AdminPage>
                      <InvoicesPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Garment Production & Material Consumption Routes */}
              <Route
                path="/system/production"
                element={
                  <ProtectedRoute requiredRole="STAFF">
                    <AdminPage>
                      <ProductionListPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/production/new"
                element={
                  <ProtectedRoute requiredRole="STAFF">
                    <AdminPage>
                      <ProductionFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/production/edit/:id"
                element={
                  <ProtectedRoute requiredRole="STAFF">
                    <AdminPage>
                      <ProductionFormPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              {/* Raw Material Stock Purchases Route */}
              <Route
                path="/system/buy-raw-materials"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
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
                  <ProtectedRoute requiredRole="ADMIN">
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
                  <ProtectedRoute requiredRole="ADMIN">
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
                  <ProtectedRoute requiredRole="ADMIN">
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
                  <ProtectedRoute requiredRole="ADMIN">
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
                  <ProtectedRoute requiredRole={['ADMIN', 'STAFF', 'REP']}>
                    <AdminPage>
                      <ReportsPage />
                    </AdminPage>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/system/settings"
                element={
                  <ProtectedRoute requiredRole={['ADMIN', 'REP']}>
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
              <Route path="/system/*" element={<Navigate to="/system/products" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
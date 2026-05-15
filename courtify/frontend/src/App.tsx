import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './lib/auth';
import { CurrencyProvider } from './lib/currencyContext';
import { ToastProvider } from './components/ui/Toast';
import { RouteProgress } from './components/ui/RouteProgress';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Ledger } from './pages/Ledger';
import Loans from './pages/Loans';
import Savings from './pages/Savings';
import Metals from './pages/Metals';
import InvestmentLedger from './pages/InvestmentLedger';
import Calendar from './pages/Calendar';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

// ─── Viewport width warning ───────────────────────────────────────────────────
function ViewportWarning() {
  const { t } = useTranslation();
  return (
    <div className="fixed top-0 left-0 right-0 z-50 hidden max-[1279px]:flex items-center justify-center bg-brand-amber/90 text-black text-sm font-medium py-2 px-4 gap-2">
      <span>⚠️</span>
      <span>{t('common.viewport_warning')}</span>
    </div>
  );
}

// ─── Protected route wrapper ──────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// ─── App shell (layout + routes) ─────────────────────────────────────────────
function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 lg:ml-56 flex flex-col min-w-0">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="pt-14 min-h-screen" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── Root initializer (loads user on mount) ───────────────────────────────────
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { refreshUser } = useAuth();

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  return <>{children}</>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
        <ToastProvider>
        <AppInitializer>
          <RouteProgress />
          <Routes>
            {/* Public routes */}
            <Route
              path="/login"
              element={<Login />}
            />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Dashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ledger"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Ledger />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/investment"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <InvestmentLedger />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/savings"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Savings />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/metals"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Metals />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/loans"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Loans />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Calendar />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Analytics />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Settings />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppInitializer>
        </ToastProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

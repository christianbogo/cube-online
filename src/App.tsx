import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SolvesProvider } from './contexts/SolvesContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { GoalsProvider } from './contexts/GoalsContext';
import { SessionProvider } from './contexts/SessionContext';
import { ConfirmationProvider } from './contexts/ConfirmationContext';
import { LiveProvider } from './contexts/LiveContext';
import { Layout } from './components';
import Cube from './pages/Cube';
import Logs from './pages/Logs';
import Goals from './pages/Goals';
import Social from './pages/Social';
import Account from './pages/Account';
import Keybinds from './pages/Keybinds';
import Dev from './pages/Dev';
import Privacy from './pages/Privacy';
import Info from './pages/Info';
import Store from './pages/Store';
import WCACallback from './pages/WCACallback';
import type { ReactNode } from 'react';

const Arena = lazy(() => import('./pages/Arena'));

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
};

const GuestLockedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.isAnonymous) return <Navigate to="/" replace />;
  return children;
};

const ArenaRoute = () => (
  <Suspense fallback={null}>
    <Arena />
  </Suspense>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <SettingsProvider>
            <ConfirmationProvider>
              <SessionProvider>
                <SolvesProvider>
                  <LiveProvider>
                    <GoalsProvider>
                      <Routes>
                        <Route path="/" element={<Layout />}>
                          <Route index element={<Cube />} />
                          <Route path="arena" element={<ArenaRoute />} />
                          <Route path="arena/*" element={<ArenaRoute />} />
                          <Route path=":roomId" element={<ArenaRoute />} />
                          <Route path="logs" element={<GuestLockedRoute><Logs /></GuestLockedRoute>} />
                          <Route path="logs/:type/:id" element={<GuestLockedRoute><Logs /></GuestLockedRoute>} />
                          <Route path="store" element={<Store />} />
                          <Route path="data" element={<Navigate to="/logs" replace />} />
                          <Route path="data/*" element={<Navigate to="/logs" replace />} />
                          <Route path="stats" element={<Navigate to="/logs" replace />} />
                          <Route path="stats/*" element={<Navigate to="/logs" replace />} />
                          <Route path="records" element={<Navigate to="/goals" replace />} />
                          <Route path="goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
                          <Route path="social" element={<Social />} />
                          <Route path="social/:userId" element={<Social />} />
                          <Route path="account" element={<Account />} />
                          <Route path="keybinds" element={<GuestLockedRoute><Keybinds /></GuestLockedRoute>} />
                          <Route path="dev" element={<GuestLockedRoute><Dev /></GuestLockedRoute>} />
                          <Route path="privacy" element={<Privacy />} />
                          <Route path="info" element={<Info />} />
                          <Route path="callback" element={<WCACallback />} />
                        </Route>
                      </Routes>
                    </GoalsProvider>
                  </LiveProvider>
                </SolvesProvider>
              </SessionProvider>
            </ConfirmationProvider>
          </SettingsProvider>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
export default App;

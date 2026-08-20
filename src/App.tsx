import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SolvesProvider } from './contexts/SolvesContext';
import { GoalsProvider } from './contexts/GoalsContext';
import { SessionProvider } from './contexts/SessionContext';
import { ConfirmationProvider } from './contexts/ConfirmationContext';
import { LiveProvider } from './contexts/LiveContext';
import { Layout } from './components';
import Cube from './pages/Cube';
import Logs from './pages/Logs';
import Goals from './pages/Goals';
import Account from './pages/Account';
import Keybinds from './pages/Keybinds';
import Records from './pages/Records';
import Dev from './pages/Dev';
import type { ReactNode } from 'react';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ConfirmationProvider>
            <SessionProvider>
              <SolvesProvider>
                <LiveProvider>
                  <GoalsProvider>
                    <Routes>
                      <Route path="/" element={<Layout />}>
                        <Route index element={<Cube />} />
                        <Route path="logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
                        <Route path="logs/:type/:id" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
                        <Route path="data" element={<Navigate to="/logs" replace />} />
                        <Route path="data/*" element={<Navigate to="/logs" replace />} />
                        <Route path="stats" element={<Navigate to="/logs" replace />} />
                        <Route path="stats/*" element={<Navigate to="/logs" replace />} />
                        <Route path="records" element={<Records />} />
                        <Route path="goals" element={<Goals />} />
                        <Route path="account" element={<Account />} />
                        <Route path="keybinds" element={<Keybinds />} />
                        <Route path="dev" element={<Dev />} />
                      </Route>
                    </Routes>
                  </GoalsProvider>
                </LiveProvider>
              </SolvesProvider>
            </SessionProvider>
          </ConfirmationProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { EconomyProvider } from './contexts/EconomyContext';
import { SolvesProvider } from './contexts/SolvesContext';
import { SessionProvider } from './contexts/SessionContext';
import { ConfirmationProvider } from './contexts/ConfirmationContext';
import { Layout } from './components';
import Cube from './pages/Cube';
import Store from './pages/Store';
import Guide from './pages/Guide';
import Data from './pages/Data';
import Account from './pages/Account';
import Keybinds from './pages/Keybinds';
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
        <EconomyProvider>
          <SettingsProvider>
            <ConfirmationProvider>
              <SessionProvider>
                <SolvesProvider>
                  <Routes>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<Cube />} />
                      <Route path="store" element={<Store />} />
                      <Route path="guide" element={<Guide />} />
                      <Route path="info" element={<Guide />} />
                      <Route path="data" element={<ProtectedRoute><Data /></ProtectedRoute>} />
                      <Route path="data/:type/:id" element={<ProtectedRoute><Data /></ProtectedRoute>} />
                      <Route path="account" element={<Account />} />
                      <Route path="keybinds" element={<Keybinds />} />
                    </Route>
                  </Routes>
                </SolvesProvider>
              </SessionProvider>
            </ConfirmationProvider>
          </SettingsProvider>
        </EconomyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

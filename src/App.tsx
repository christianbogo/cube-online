import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SolvesProvider } from './contexts/SolvesContext';
import { SessionProvider } from './contexts/SessionContext';
import { ConfirmationProvider } from './contexts/ConfirmationContext';
import Layout from './components/Layout';
import Cube from './pages/Cube';
import Daily from './pages/Daily';
import Data from './pages/Data';
import Account from './pages/Account';
import About from './pages/About';
import Keybinds from './pages/Keybinds';
import { useAuth } from './contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null; // Or a spinner
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
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Cube />} />
                    <Route path="daily" element={<ProtectedRoute><Daily /></ProtectedRoute>} />
                    <Route path="data" element={<ProtectedRoute><Data /></ProtectedRoute>} />
                    <Route path="data/:type/:id" element={<ProtectedRoute><Data /></ProtectedRoute>} />
                    <Route path="about" element={<About />} />
                    <Route path="account" element={<Account />} />
                    <Route path="keybinds" element={<Keybinds />} />
                  </Route>
                </Routes>
              </SolvesProvider>
            </SessionProvider>
          </ConfirmationProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

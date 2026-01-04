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
                    <Route path="daily" element={<Daily />} />
                    <Route path="data" element={<Data />} />
                    <Route path="data/:type/:id" element={<Data />} />
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

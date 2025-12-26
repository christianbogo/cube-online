import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SolvesProvider } from './contexts/SolvesContext';
import Layout from './components/Layout';
import Cube from './pages/Cube';
import Daily from './pages/Daily';
import Shared from './pages/Shared';
import Data from './pages/Data';
import Account from './pages/Account';
import Featured from './pages/Featured';
import About from './pages/About';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <SolvesProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Cube />} />
                <Route path="daily" element={<Daily />} />
                <Route path="shared" element={<Shared />} />
                <Route path="data" element={<Data />} />
                <Route path="featured" element={<Featured />} />
                <Route path="about" element={<About />} />
                <Route path="account" element={<Account />} />
              </Route>
            </Routes>
          </SolvesProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

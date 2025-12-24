import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Cube from './pages/Cube';
import Daily from './pages/Daily';
import Live from './pages/Live';
import Shared from './pages/Shared';
import Data from './pages/Data';
import Account from './pages/Account';
import Featured from './pages/Featured';
import About from './pages/About';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Cube />} />
          <Route path="daily" element={<Daily />} />
          <Route path="live" element={<Live />} />
          <Route path="shared" element={<Shared />} />
          <Route path="data" element={<Data />} />
          <Route path="featured" element={<Featured />} />
          <Route path="about" element={<About />} />
          <Route path="account" element={<Account />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

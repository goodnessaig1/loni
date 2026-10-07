import { Routes, Route } from 'react-router';
import HomePage from './pages/HomePage';
import VerifyPage from './pages/VerifyPage';
import DriversPage from './pages/DriversPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/drivers" element={<DriversPage />} />
      <Route path="/verify" element={<VerifyPage />} />
    </Routes>
  );
}

export default App;

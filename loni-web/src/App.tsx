import { Routes, Route } from 'react-router';
import { ScrollToTop } from './components/layout/ScrollToTop';
import HomePage from './pages/HomePage';
import VerifyPage from './pages/VerifyPage';
import DriversPage from './pages/DriversPage';

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/verify" element={<VerifyPage />} />
      </Routes>
    </>
  );
}

export default App;

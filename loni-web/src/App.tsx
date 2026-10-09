import { Routes, Route } from 'react-router';
import { ScrollToTop } from './components/layout/ScrollToTop';
import HomePage from './pages/HomePage';
import VerifyPage from './pages/VerifyPage';
import DriversPage from './pages/DriversPage';
import NursesPage from './pages/NursesPage';
import PartnersPage from './pages/PartnersPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import DisclaimerPage from './pages/DisclaimerPage';

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/nurses" element={<NursesPage />} />
        <Route path="/partners" element={<PartnersPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/disclaimer" element={<DisclaimerPage />} />
        <Route path="/verify" element={<VerifyPage />} />
      </Routes>
    </>
  );
}

export default App;

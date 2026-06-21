import { Routes, Route, Navigate } from 'react-router';
import VerifyPage from './pages/VerifyPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/verify" replace />} />
      <Route path="/verify" element={<VerifyPage />} />
    </Routes>
  );
}

export default App;

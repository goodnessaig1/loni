import { Routes, Route } from 'react-router';
import HomePage from './pages/HomePage';
import VerifyPage from './pages/VerifyPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/verify" element={<VerifyPage />} />
    </Routes>
  );
}

export default App;

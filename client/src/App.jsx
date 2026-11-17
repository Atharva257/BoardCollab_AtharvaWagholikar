import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Protected from './components/Protected';
import AuthPage from './pages/AuthPage';
import Board from './pages/Board';
import Lobby from './pages/Lobby';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<Protected><Lobby /></Protected>} />
        <Route path="/r/:roomId" element={<Protected><Board /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

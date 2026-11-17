import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function Protected({ children }) {
  const token = useSelector((s) => s.auth.token);
  return token ? children : <Navigate to="/login" replace />;
}

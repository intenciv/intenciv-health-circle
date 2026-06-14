import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin   from './pages/AdminLogin.jsx';
import AdminLayout  from './pages/admin/AdminLayout.jsx';
import Dashboard    from './pages/admin/Dashboard.jsx';
import { tokens } from './services/api';

function RequireAdmin({ children }) {
  const user = tokens.getUser();
  if (!user || !tokens.getAccess() || user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/"            element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin"       element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index             element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}

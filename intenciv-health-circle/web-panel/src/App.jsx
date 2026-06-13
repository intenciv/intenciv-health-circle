import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login        from './pages/Login.jsx';
import AdminLogin   from './pages/AdminLogin.jsx';
import Reception    from './pages/Reception.jsx';
import AdminLayout  from './pages/admin/AdminLayout.jsx';
import Dashboard    from './pages/admin/Dashboard.jsx';
import Tiers        from './pages/admin/Tiers.jsx';
import Codes        from './pages/admin/Codes.jsx';
import Reports      from './pages/admin/Reports.jsx';
import Users        from './pages/admin/Users.jsx';
import { tokens } from './services/api';

function RequireRole({ role, children }) {
  const user = tokens.getUser();
  const loc = useLocation();
  if (!user || !tokens.getAccess()) {
    return <Navigate to={role === 'admin' ? '/admin/login' : '/login'} state={{ from: loc }} replace />;
  }
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/"            element={<Navigate to="/login" replace />} />
      <Route path="/login"       element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route path="/reception"   element={<RequireRole role="receptionist"><Reception /></RequireRole>} />

      <Route path="/admin"       element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
        <Route index             element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="tiers"      element={<Tiers />} />
        <Route path="codes"      element={<Codes />} />
        <Route path="reports"    element={<Reports />} />
        <Route path="users"      element={<Users />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin   from './pages/AdminLogin.jsx';
import AdminLayout  from './pages/admin/AdminLayout.jsx';
import Dashboard    from './pages/admin/Dashboard.jsx';
import Salespersons from './pages/admin/Salespersons.jsx';
import Plans        from './pages/admin/Plans.jsx';
import Cards        from './pages/admin/Cards.jsx';
import Offers       from './pages/admin/Offers.jsx';
import Reception    from './pages/admin/Reception.jsx';
import Reports      from './pages/admin/Reports.jsx';
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
        <Route index                  element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"       element={<Dashboard />} />
        <Route path="salespersons"    element={<Salespersons />} />
        <Route path="plans"           element={<Plans />} />
        <Route path="cards"           element={<Cards />} />
        <Route path="offers"          element={<Offers />} />
        <Route path="reception"       element={<Reception />} />
        <Route path="reports"         element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin            from './pages/AdminLogin.jsx';
import AdminLayout           from './pages/admin/AdminLayout.jsx';
import Dashboard              from './pages/admin/Dashboard.jsx';
import Salespersons           from './pages/admin/Salespersons.jsx';
import Plans                  from './pages/admin/Plans.jsx';
import Cards                  from './pages/admin/Cards.jsx';
import Offers                 from './pages/admin/Offers.jsx';
import Reception               from './pages/admin/Reception.jsx';
import Reports                from './pages/admin/Reports.jsx';
import ReceptionLogin         from './pages/ReceptionLogin.jsx';
import ReceptionDesk          from './pages/ReceptionDesk.jsx';
import SalespersonLogin       from './pages/SalespersonLogin.jsx';
import SalespersonLayout      from './pages/salesperson/SalespersonLayout.jsx';
import SalespersonDashboard   from './pages/salesperson/SalespersonDashboard.jsx';
import SalespersonCards       from './pages/salesperson/SalespersonCards.jsx';
import SalespersonActivate    from './pages/salesperson/SalespersonActivate.jsx';
import { tokens } from './services/api';

function RequireAdmin({ children }) {
  const user = tokens.getUser();
  if (!user || !tokens.getAccess() || user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
}

function RequireReception({ children }) {
  const user = tokens.getUser();
  if (!user || !tokens.getAccess() || !['reception', 'admin'].includes(user.role)) return <Navigate to="/reception/login" replace />;
  return children;
}

function RequireSalesperson({ children }) {
  const user = tokens.getUser();
  if (!user || !tokens.getAccess() || user.role !== 'salesperson') return <Navigate to="/salesperson/login" replace />;
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

      <Route path="/reception/login" element={<ReceptionLogin />} />
      <Route path="/reception/desk"  element={<RequireReception><ReceptionDesk /></RequireReception>} />

      <Route path="/salesperson/login" element={<SalespersonLogin />} />
      <Route path="/salesperson" element={<RequireSalesperson><SalespersonLayout /></RequireSalesperson>}>
        <Route index                element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"     element={<SalespersonDashboard />} />
        <Route path="cards"         element={<SalespersonCards />} />
        <Route path="activate/:cardId" element={<SalespersonActivate />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}

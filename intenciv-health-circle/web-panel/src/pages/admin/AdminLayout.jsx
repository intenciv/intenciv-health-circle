import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { tokens } from '../../services/api';
import logo from '../../../../frontend/assets/favicon.png';

const NAV = [
  { to: '/admin/dashboard',     label: 'Dashboard' },
  { to: '/admin/salespersons',  label: 'Salespersons' },
  { to: '/admin/plans',         label: 'Plans & Benefits' },
  { to: '/admin/cards',         label: 'Cards' },
  { to: '/admin/offers',        label: 'Offers' },
  { to: '/admin/reception',     label: 'Reception Desk' },
  { to: '/admin/reports',       label: 'Reports' },
];

export default function AdminLayout() {
  const user = tokens.getUser();
  const navigate = useNavigate();
  function logout() { tokens.clear(); navigate('/admin/login', { replace: true }); }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">IntenCiv Admin</div>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="logout">
          Signed in as<br />
          <strong style={{ color: '#fff' }}>{user?.full_name || user?.email}</strong>
        </div>
        <button className="secondary" onClick={logout} style={{ marginTop: 12 }}>Sign out</button>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}

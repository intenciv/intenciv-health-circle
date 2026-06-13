import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { tokens } from '../../services/api';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/tiers',     label: 'Tiers & Tests' },
  { to: '/admin/codes',     label: 'Activation Codes' },
  { to: '/admin/reports',   label: 'Reports' },
  { to: '/admin/users',     label: 'Users' },
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
          <strong style={{ color: '#fff' }}>{user?.full_name || user?.phone}</strong>
        </div>
        <button className="secondary" onClick={logout} style={{ marginTop: 12 }}>Sign out</button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

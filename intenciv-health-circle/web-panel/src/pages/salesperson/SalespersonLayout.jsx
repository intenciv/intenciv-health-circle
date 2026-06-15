import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { tokens } from '../../services/api';

export default function SalespersonLayout() {
  const navigate = useNavigate();
  const user = tokens.getUser();

  function logout() {
    tokens.clear();
    navigate('/salesperson/login', { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', background: 'var(--primary, #1a56db)', color: '#fff',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>IntenCiv Sales</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{user?.full_name || user?.phone}</div>
        </div>
        <button className="secondary" onClick={logout} style={{ height: 36 }}>Sign out</button>
      </header>

      <main style={{ flex: 1, padding: 16, paddingBottom: 84 }}>
        <Outlet />
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
      }}>
        <SalesNavLink to="/salesperson/dashboard" label="Dashboard" />
        <SalesNavLink to="/salesperson/cards"     label="My Cards" />
      </nav>
    </div>
  );
}

function SalesNavLink({ to, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        flex: 1, textAlign: 'center', padding: '14px 0',
        fontWeight: isActive ? 700 : 500,
        color: isActive ? 'var(--primary, #1a56db)' : '#64748b',
        textDecoration: 'none',
      })}
    >
      {label}
    </NavLink>
  );
}

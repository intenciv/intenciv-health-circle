import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { tokens } from '../../services/api';

const NAV = [
  { to: '/admin/dashboard',    label: 'Dashboard' },
  { to: '/admin/salespersons', label: 'Salespersons' },
  { to: '/admin/plans',        label: 'Plans & Benefits' },
  { to: '/admin/cards',        label: 'Cards' },
  { to: '/admin/offers',       label: 'Offers' },
  { to: '/admin/reception',    label: 'Reception Desk' },
  { to: '/admin/reports',      label: 'Reports' },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const user     = tokens.getUser();
  const navigate = useNavigate();

  function logout() { tokens.clear(); navigate('/admin/login', { replace: true }); }
  function close()  { setOpen(false); }

  return (
    <div className="shell">

      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" viewBox="0 0 24 24">
            <line x1="3" y1="6"  x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="brand-name">IntenCiv</span>
      </div>

      {/* ── Overlay (closes sidebar on tap outside) ── */}
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={close} />

      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── Sidebar ── */}
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="brand">
            <img
              src="/logo.png"
              alt="IntenCiv"
              style={{ width: '100%', maxWidth: 160, height: 'auto', display: 'block' }}
            />
            <span style={{
              fontSize: 11, color: 'rgba(255,255,255,0.55)',
              marginTop: 4, display: 'block', letterSpacing: '0.08em'
            }}>
              ADMIN PANEL
            </span>
          </div>

          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={close}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              {n.label}
            </NavLink>
          ))}

          <div className="spacer" />

          <div className="logout">
            Signed in as<br />
            <strong style={{ color: '#fff' }}>{user?.full_name || user?.email}</strong>
          </div>
          <button className="secondary" onClick={logout} style={{ marginTop: 12 }}>
            Sign out
          </button>
        </aside>

        {/* ── Page content ── */}
        <main className="main">
          <Outlet />
        </main>

      </div>
    </div>
  );
}

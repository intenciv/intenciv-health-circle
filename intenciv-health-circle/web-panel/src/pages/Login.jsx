import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';

// All three panel roles now sign in with the same shape: Employee ID
// (format INT0001, assigned in HRM Employee Master) + a password set
// directly by Admin — harmonized with HRM/IVS/CRM. Salesperson's separate
// 4-digit PIN (used to authorize each card activation in the field) is
// untouched by this — it's a different control from signing into the
// panel, not a login credential.
const ROLES = [
  {
    id: 'admin',
    label: 'Admin',
    endpoint: '/auth/admin/login',
    redirect: '/admin/dashboard',
    subtitle: 'Operations dashboard — tiers, codes, agents, reports.',
  },
  {
    id: 'salesperson',
    label: 'Salesperson',
    endpoint: '/auth/salesperson/login',
    redirect: '/salesperson/dashboard',
    subtitle: 'Card activation for field agents.',
  },
  {
    id: 'reception',
    label: 'Reception',
    endpoint: '/auth/reception/login',
    redirect: '/reception/desk',
    subtitle: 'Coupon lookup & availing desk.',
  },
];

export default function Login() {
  const [role, setRole]             = useState('admin');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const navigate = useNavigate();

  const selected = ROLES.find(r => r.id === role);

  function switchRole(r) {
    setRole(r);
    setError('');
    setEmployeeId(''); setPassword('');
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post(selected.endpoint, { employee_id: employeeId.trim(), password });
      tokens.setSession(data);
      navigate(selected.redirect, { replace: true });
    } catch (err) {
      const code = err.response?.data?.error;
      setError(code === 'invalid_credentials' ? 'Invalid Employee ID or password.' : 'Login failed. Please try again.');
    } finally { setLoading(false); }
  }

  const canSubmit = employeeId.length > 0 && password.length > 0;

  return (
    <div className="center-page">
      <form onSubmit={submit} className="login-card">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.png" alt="IntenCiv" style={{ width: 180, height: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Role Tabs */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 24,
          background: 'var(--surface-2, #f3f4f6)', borderRadius: 10, padding: 4,
        }}>
          {ROLES.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => switchRole(r.id)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.18s',
                background: role === r.id ? '#fff' : 'transparent',
                color: role === r.id ? 'var(--text-main, #111)' : 'var(--text-mid, #888)',
                boxShadow: role === r.id ? '0 1px 6px rgba(0,0,0,0.10)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <h1 style={{ marginTop: 0 }}>Sign In</h1>
        <p className="subtitle">{selected.subtitle}</p>

        {error && <div className="error-banner">{error}</div>}

        <label className="label">Employee ID</label>
        <input
          value={employeeId}
          onChange={e => setEmployeeId(e.target.value)}
          type="text"
          placeholder="INT0001"
          autoCapitalize="characters"
          autoFocus
          required
        />

        <div style={{ height: 12 }} />
        <label className="label">Password</label>
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
          required
        />

        <div style={{ height: 16 }} />
        <button type="submit" disabled={loading || !canSubmit} style={{ width: '100%', height: 48 }}>
          {loading ? 'Signing in…' : `Sign in as ${selected.label}`}
        </button>

      </form>
    </div>
  );
}

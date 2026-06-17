import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';

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
    subtitle: 'Manage your cards, activations and commissions.',
  },
  {
    id: 'reception',
    label: 'Reception',
    endpoint: '/auth/reception/login',
    redirect: '/reception/desk',
    subtitle: 'Patient check-in, card lookup and billing.',
  },
];

export default function Login() {
  const [role, setRole]         = useState('admin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const selected = ROLES.find(r => r.id === role);

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post(selected.endpoint, { email: email.trim(), password });
      tokens.setSession(data);
      navigate(selected.redirect, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error === 'invalid_credentials'
          ? 'Invalid email or password.'
          : 'Login failed. Please try again.'
      );
    } finally { setLoading(false); }
  }

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
              onClick={() => { setRole(r.id); setError(''); }}
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

        <label className="label">Email</label>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          type="email"
          placeholder="you@intenciv.com"
          autoFocus
          required
        />
        <div style={{ height: 12 }} />
        <label className="label">Password</label>
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          type="password"
          placeholder="••••••"
          required
        />
        <div style={{ height: 16 }} />
        <button type="submit" disabled={loading} style={{ width: '100%', height: 48 }}>
          {loading ? 'Signing in…' : `Sign in as ${selected.label}`}
        </button>

      </form>
    </div>
  );
}

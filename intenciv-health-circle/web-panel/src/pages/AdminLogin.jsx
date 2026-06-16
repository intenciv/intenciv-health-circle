import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';

export default function AdminLogin() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/admin/login', { email: email.trim(), password });
      tokens.setSession(data);
      navigate('/admin/dashboard', { replace: true });
    } catch (e) {
      setError(e.response?.data?.error === 'invalid_credentials' ? 'Invalid email or password.' : 'Login failed.');
    } finally { setLoading(false); }
  }

  return (
    <div className="center-page">
      <form onSubmit={submit} className="login-card">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src="/favicon.png"
            alt="IntenCiv"
            style={{ width: 200, height: 'auto', display: 'inline-block' }}
          />
        </div>

        <h1>IntenCiv Admin</h1>
        <p className="subtitle">Operations dashboard — tiers, codes, agents, reports.</p>
        {error && <div className="error-banner">{error}</div>}
        <label className="label">Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="intencivhealthcare@gmail.com" autoFocus />
        <div style={{ height: 12 }} />
        <label className="label">Password (6 digits)</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••" />
        <div style={{ height: 16 }} />
        <button type="submit" disabled={loading} style={{ width: '100%', height: 48 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ marginTop: 18, fontSize: 12, color: 'var(--text-mid)', textAlign: 'center' }}>
          Reception staff: use the admin password from inside the admin panel — there is no separate reception login.
        </p>
      </form>
    </div>
  );
}

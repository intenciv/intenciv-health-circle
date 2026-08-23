import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';

export default function AdminLogin() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/admin/login', { employee_id: employeeId.trim(), password });
      tokens.setSession(data);
      navigate('/admin/dashboard', { replace: true });
    } catch (e) {
      setError(e.response?.data?.error === 'invalid_credentials'
        ? 'Invalid Employee ID or password.'
        : 'Login failed.');
    } finally { setLoading(false); }
  }

  return (
    <div className="center-page">
      <form onSubmit={submit} className="login-card">

        {/* Company Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/logo.png"
            alt="IntenCiv"
            style={{
              width: 180,
              height: 'auto',
              display: 'inline-block',
              objectFit: 'contain'
            }}
          />
        </div>

        <h1>IntenCiv Admin</h1>
        <p className="subtitle">Operations dashboard — tiers, codes, agents, reports.</p>

        {error && <div className="error-banner">{error}</div>}

        <label className="label">Employee ID</label>
        <input
          value={employeeId}
          onChange={e => setEmployeeId(e.target.value)}
          type="text"
          placeholder="INT0001"
          autoCapitalize="characters"
          autoFocus
        />

        <div style={{ height: 12 }} />

        <label className="label">Password</label>
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
        />

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

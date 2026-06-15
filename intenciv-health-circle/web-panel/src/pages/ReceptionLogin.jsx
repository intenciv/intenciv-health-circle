import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';

export default function ReceptionLogin() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/reception/login', { email, password });
      tokens.setSession(data);
      navigate('/reception/desk', { replace: true });
    } catch (e) {
      setErr(e.response?.data?.error === 'invalid_credentials' ? 'Invalid email or password.' : 'Login failed.');
    } finally { setLoading(false); }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>IntenCiv Reception</h1>
        <p style={{ color: 'var(--text-mid)' }}>Coupon lookup &amp; availing desk.</p>
        {err && <div className="error-banner">{err}</div>}
        <form onSubmit={submit}>
          <label className="label">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          <label className="label">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 12, height: 48 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

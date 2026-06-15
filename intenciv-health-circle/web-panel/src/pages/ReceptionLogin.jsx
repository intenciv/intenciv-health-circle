import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';

export default function ReceptionLogin() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/reception/login', { email: email.trim(), password });
      tokens.setSession(data);
      navigate('/reception/desk', { replace: true });
    } catch (e) {
      setError(e.response?.data?.error === 'invalid_credentials' ? 'Invalid email or password.' : 'Login failed.');
    } finally { setLoading(false); }
  }

  return (
    <div className="center-page">
      <form onSubmit={submit} className="login-card">
        <h1>IntenCiv Reception</h1>
        <p className="subtitle">Coupon lookup &amp; availing desk.</p>
        {error && <div className="error-banner">{error}</div>}
        <label className="label">Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="contact@intenciv.in" autoFocus />
        <div style={{ height: 12 }} />
        <label className="label">Password</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••" />
        <div style={{ height: 16 }} />
        <button type="submit" disabled={loading} style={{ width: '100%', height: 48 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

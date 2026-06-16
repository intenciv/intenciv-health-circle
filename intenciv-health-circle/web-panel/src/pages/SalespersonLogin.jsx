import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';
import logo from '../../../frontend/assets/favicon.png';

export default function SalespersonLogin() {
  const [phone, setPhone] = useState('');
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/salesperson/login', { phone: phone.trim(), pin });
      tokens.setSession(data);
      navigate('/salesperson/dashboard', { replace: true });
    } catch (e) {
      setError(e.response?.data?.error === 'invalid_credentials' ? 'Invalid phone or PIN.' : 'Login failed.');
    } finally { setLoading(false); }
  }

  return (
    <div className="center-page">
      <form onSubmit={submit} className="login-card">
        <h1>IntenCiv Sales</h1>
        <p className="subtitle">Card activation for field agents.</p>
        {error && <div className="error-banner">{error}</div>}
        <label className="label">Mobile number</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="9876543210" autoFocus inputMode="numeric" />
        <div style={{ height: 12 }} />
        <label className="label">PIN (4 digits)</label>
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))} type="password" placeholder="••••" inputMode="numeric" />
        <div style={{ height: 16 }} />
        <button type="submit" disabled={loading || !phone || pin.length !== 4} style={{ width: '100%', height: 48 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

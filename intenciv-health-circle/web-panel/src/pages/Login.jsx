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
    fields: 'email_password',
  },
  {
    id: 'salesperson',
    label: 'Salesperson',
    endpoint: '/auth/salesperson/login',
    redirect: '/salesperson/dashboard',
    subtitle: 'Card activation for field agents.',
    fields: 'phone_pin',
  },
  {
    id: 'reception',
    label: 'Reception',
    endpoint: '/auth/reception/login',
    redirect: '/reception/desk',
    subtitle: 'Coupon lookup & availing desk.',
    fields: 'email_password',
  },
];

export default function Login() {
  const [role, setRole]       = useState('admin');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const selected = ROLES.find(r => r.id === role);

  function switchRole(r) {
    setRole(r);
    setError('');
    setEmail(''); setPassword('');
    setPhone(''); setPin('');
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const payload = selected.fields === 'phone_pin'
        ? { phone: phone.trim(), pin }
        : { email: email.trim(), password };
      const { data } = await api.post(selected.endpoint, payload);
      tokens.setSession(data);
      navigate(selected.redirect, { replace: true });
    } catch (err) {
      const code = err.response?.data?.error;
      setError(
        code === 'invalid_credentials'
          ? selected.fields === 'phone_pin'
            ? 'Invalid phone or PIN.'
            : 'Invalid email or password.'
          : 'Login failed. Please try again.'
      );
    } finally { setLoading(false); }
  }

  const isPhonePin = selected.fields === 'phone_pin';
  const canSubmit  = isPhonePin
    ? phone.length > 0 && pin.length === 4
    : email.length > 0 && password.length > 0;

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

        {/* Email + Password (Admin & Reception) */}
        {!isPhonePin && (
          <>
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
          </>
        )}

        {/* Phone + PIN (Salesperson) */}
        {isPhonePin && (
          <>
            <label className="label">Mobile Number</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              placeholder="9876543210"
              autoFocus
              inputMode="numeric"
              required
            />
            <div style={{ height: 12 }} />
            <label className="label">PIN (4 digits)</label>
            <input
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              type="password"
              placeholder="••••"
              inputMode="numeric"
              required
            />
          </>
        )}

        <div style={{ height: 16 }} />
        <button type="submit" disabled={loading || !canSubmit} style={{ width: '100%', height: 48 }}>
          {loading ? 'Signing in…' : `Sign in as ${selected.label}`}
        </button>

      </form>
    </div>
  );
}

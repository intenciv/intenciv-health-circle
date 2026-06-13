import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../services/api';

export default function Reception() {
  const [code, setCode]       = useState('');
  const [coupon, setCoupon]   = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast]     = useState('');
  const user = tokens.getUser();
  const navigate = useNavigate();

  function clearMessages() { setError(''); setToast(''); }

  async function lookup(e) {
    e?.preventDefault();
    clearMessages();
    if (!code.trim()) return;
    setLoading(true);
    setCoupon(null);
    try {
      const { data } = await api.get(`/reception/lookup/${encodeURIComponent(code.trim().toUpperCase())}`);
      setCoupon(data.coupon);
    } catch (e) {
      setError(e.response?.data?.error || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  async function avail() {
    clearMessages();
    setLoading(true);
    try {
      const { data } = await api.post(`/reception/avail/${encodeURIComponent(coupon.coupon_code)}`);
      setToast(`Coupon for ${data.test_name} marked as availed.`);
      setCoupon({ ...coupon, status: 'availed', availed_at: data.availed_at, availed_by_name: user?.full_name || 'You' });
    } catch (e) {
      setError(e.response?.data?.error || 'Availment failed');
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  function logout() {
    tokens.clear();
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div style={{ minHeight: '100vh', padding: 28 }}>
      <div className="between" style={{ marginBottom: 28 }}>
        <div>
          <h1>IntenCiv Reception</h1>
          <p style={{ color: 'var(--text-mid)' }}>Hello {user?.full_name || 'receptionist'} — look up a coupon code.</p>
        </div>
        <button className="secondary" onClick={logout}>Sign out</button>
      </div>

      <form onSubmit={lookup} className="search-hero">
        <h2 style={{ marginBottom: 12 }}>Enter coupon code</h2>
        <p style={{ color: 'var(--text-mid)', marginBottom: 20 }}>
          Ask the patient to read out the code on their IntenCiv Health Circle app.
        </p>
        <input
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. CBC-K72X"
        />
        <div style={{ height: 16 }} />
        <button type="submit" disabled={loading || !code.trim()} style={{ width: '100%', height: 48 }}>
          {loading ? 'Looking up…' : 'Look up coupon'}
        </button>
        {error && <div className="error-banner" style={{ marginTop: 16 }}>{error}</div>}
      </form>

      {coupon && (
        <div className="card result-card">
          <div className="between" style={{ marginBottom: 16 }}>
            <div className="test-name">{coupon.test_name}</div>
            <span className={`pill pill-${coupon.status}`}>{coupon.status.toUpperCase()}</span>
          </div>

          <div className="prices">
            <span className="mrp">₹{Number(coupon.original_price).toFixed(0)}</span>
            <span className="disc">₹{Number(coupon.discounted_price).toFixed(0)}</span>
            <span className="pill pill-cyan">{Number(coupon.discount_percent).toFixed(0)}% off</span>
          </div>

          <div className="info-row"><span>Coupon code</span>     <span className="mono">{coupon.coupon_code}</span></div>
          <div className="info-row"><span>Patient</span>          <span>{coupon.client_name || '—'}</span></div>
          <div className="info-row"><span>Patient phone</span>    <span>{coupon.client_phone}</span></div>
          <div className="info-row"><span>Booklet tier</span>     <span>{coupon.tier_name}</span></div>
          <div className="info-row"><span>Expires on</span>       <span>{new Date(coupon.expires_at).toLocaleDateString()}</span></div>

          {coupon.status === 'availed' && (
            <div className="info-row">
              <span>Availed</span>
              <span>{new Date(coupon.availed_at).toLocaleString()} by {coupon.availed_by_name || '—'}</span>
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            {coupon.status === 'active' && (
              <button onClick={() => setConfirm(true)} disabled={loading}>Mark as Availed</button>
            )}
            <button className="secondary" onClick={() => { setCoupon(null); setCode(''); }}>New lookup</button>
          </div>
        </div>
      )}

      {confirm && (
        <div className="dialog-backdrop" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Mark coupon as availed?</h3>
            <p style={{ color: 'var(--text-mid)', marginTop: 6 }}>
              The patient's app will instantly update. This cannot be undone.
            </p>
            <div className="actions">
              <button className="secondary" onClick={() => setConfirm(false)}>Cancel</button>
              <button onClick={avail} disabled={loading}>Yes, mark availed</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

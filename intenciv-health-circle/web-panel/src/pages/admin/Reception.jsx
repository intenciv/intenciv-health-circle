import { useState, useEffect } from 'react';
import { api, API_URL, tokens } from '../../services/api';

/**
 * Reception Desk (admin-only).
 * Step 1: admin re-enters their password (held in memory only, never localStorage).
 * Step 2: lookup a coupon code → see member + benefit + status.
 * Step 3: "Mark as Availed" with a confirmation dialog. Realtime push to customer.
 *
 * Every lookup/avail request sends the password in the `x-admin-password`
 * header per the backend contract — it's never persisted.
 */
export default function Reception() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockErr, setUnlockErr] = useState('');

  const [code, setCode]       = useState('');
  const [coupon, setCoupon]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast]     = useState('');

  async function unlock(e) {
    e?.preventDefault();
    setUnlockErr(''); setUnlocking(true);
    try {
      const { data } = await api.post('/admin/verify-password', { password });
      if (data.ok) setUnlocked(true);
      else setUnlockErr('Incorrect password.');
    } catch (_e) { setUnlockErr('Verification failed.'); }
    finally { setUnlocking(false); }
  }

  function clearMsg() { setErr(''); setToast(''); }

  async function lookup(e) {
    e?.preventDefault();
    clearMsg();
    if (!code.trim()) return;
    setLoading(true); setCoupon(null);
    try {
      const { data } = await fetch(`${API_URL}/admin/reception/lookup/${encodeURIComponent(code.trim().toUpperCase())}`, {
        headers: {
          Authorization: `Bearer ${tokens.getAccess()}`,
          'x-admin-password': password,
        },
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw { response: { data: j, status: r.status } };
        return { data: j };
      });
      setCoupon(data.coupon);
    } catch (e) {
      setErr(
        e.response?.data?.error === 'coupon_not_found' ? 'No coupon found for that code.'
      : e.response?.data?.error === 'admin_password_incorrect' ? 'Your password changed — please unlock again.'
      : 'Lookup failed.'
      );
      if (e.response?.data?.error === 'admin_password_incorrect') { setUnlocked(false); setPassword(''); }
    } finally { setLoading(false); }
  }

  async function avail() {
    clearMsg(); setLoading(true);
    try {
      const r = await fetch(`${API_URL}/admin/reception/avail/${encodeURIComponent(coupon.coupon_code)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.getAccess()}`,
          'x-admin-password': password,
        },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'avail_failed');
      setToast(`Marked "${j.benefit_name}" as used.`);
      setCoupon({ ...coupon, status: 'used', used_at: j.used_at, used_by_admin_name: tokens.getUser()?.full_name || 'Admin' });
    } catch (e) {
      setErr(e.message === 'coupon_already_used' ? 'Already used.' : e.message === 'coupon_expired' ? 'Expired.' : 'Failed to mark used.');
    } finally { setLoading(false); setConfirm(false); }
  }

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);

  if (!unlocked) {
    return (
      <div className="col" style={{ gap: 18 }}>
        <h1>Reception Desk</h1>
        <div className="card" style={{ maxWidth: 480 }}>
          <h3>Unlock</h3>
          <p style={{ color: 'var(--text-mid)', marginTop: 4 }}>
            Re-enter the admin password to access the reception desk. The password is verified on every lookup — it's never stored in the browser.
          </p>
          <form onSubmit={unlock} style={{ marginTop: 14 }}>
            <label className="label">Admin password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            {unlockErr && <div className="error-banner" style={{ marginTop: 10 }}>{unlockErr}</div>}
            <button type="submit" disabled={unlocking || !password} style={{ width: '100%', marginTop: 12, height: 48 }}>
              {unlocking ? 'Verifying…' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="between">
        <h1>Reception Desk</h1>
        <button className="secondary" onClick={() => { setUnlocked(false); setPassword(''); setCoupon(null); setCode(''); }}>Lock</button>
      </div>

      <form onSubmit={lookup} className="search-hero">
        <h2 style={{ marginBottom: 12 }}>Enter coupon code</h2>
        <p style={{ color: 'var(--text-mid)', marginBottom: 20 }}>Ask the patient to read out the code on their IntenCiv Health Circle app.</p>
        <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="IHC-CPN-00341-HC01" />
        <div style={{ height: 14 }} />
        <button type="submit" disabled={loading || !code.trim()} style={{ width: '100%', height: 48 }}>
          {loading ? 'Looking up…' : 'Look up coupon'}
        </button>
        {err && <div className="error-banner" style={{ marginTop: 14 }}>{err}</div>}
      </form>

      {coupon && (
        <div className="card result-card">
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="test-name">{coupon.benefit_name}</div>
            <span className={`pill pill-${coupon.status === 'unused' ? 'active' : coupon.status === 'used' ? 'availed' : 'expired'}`}>{coupon.status.toUpperCase()}</span>
          </div>
          <div className="info-row"><span>Coupon code</span>   <span className="mono">{coupon.coupon_code}</span></div>
          <div className="info-row"><span>Patient</span>       <span>{coupon.member_name || '—'}</span></div>
          <div className="info-row"><span>Patient phone</span> <span className="mono">{coupon.member_phone}</span></div>
          <div className="info-row"><span>Card number</span>   <span className="mono">{coupon.card_number}</span></div>
          <div className="info-row"><span>Plan</span>          <span>{coupon.plan_name}</span></div>
          <div className="info-row"><span>Expires on</span>    <span>{new Date(coupon.expires_at).toLocaleDateString()}</span></div>
          {coupon.status === 'used' && (
            <div className="info-row">
              <span>Used at</span>
              <span>{new Date(coupon.used_at).toLocaleString()} by {coupon.used_by_admin_name || '—'}</span>
            </div>
          )}
          <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            {coupon.status === 'unused' && <button onClick={() => setConfirm(true)} disabled={loading}>Mark as Availed</button>}
            <button className="secondary" onClick={() => { setCoupon(null); setCode(''); }}>New lookup</button>
          </div>
        </div>
      )}

      {confirm && (
        <div className="dialog-backdrop" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Mark coupon as used?</h3>
            <p style={{ color: 'var(--text-mid)', marginTop: 6 }}>
              This is irreversible. The patient's app will update instantly.
            </p>
            <div className="actions">
              <button className="secondary" onClick={() => setConfirm(false)}>Cancel</button>
              <button onClick={avail} disabled={loading}>Yes, mark used</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

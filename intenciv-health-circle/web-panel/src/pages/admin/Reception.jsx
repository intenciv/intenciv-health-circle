import { useState, useEffect } from 'react';
import { API_URL, tokens } from '../../services/api';

/**
 * Reception Desk (admin-only).
 * Step 1: admin re-enters their password (held in memory only, never localStorage).
 * Step 2: lookup a coupon code → see member + benefit + status + usage count.
 * Step 3: "Mark as Availed" with a confirmation dialog + optional service note.
 *         For multi-use coupons, shows usage dots (●●○) and remaining count.
 *         Realtime push to customer app via socket.
 *
 * Every lookup/avail request sends the password in the `x-admin-password`
 * header per the backend contract — it's never persisted.
 */

/* ── tiny helpers ────────────────────────────────────────────── */
function fmtDate(d)     { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDateTime(d) { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function isMultiUse(c)  { return (c?.max_uses ?? 1) > 1; }

/** ●●○ usage dot indicators */
function UsageDots({ current, max }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 11, height: 11, borderRadius: '50%',
            backgroundColor: i < current ? 'var(--primary)' : 'transparent',
            border: '2px solid var(--primary)',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function Reception() {
  /* unlock */
  const [password, setPassword]   = useState('');
  const [unlocked, setUnlocked]   = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockErr, setUnlockErr] = useState('');

  /* lookup */
  const [code, setCode]       = useState('');
  const [coupon, setCoupon]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  /* avail */
  const [confirm, setConfirm]         = useState(false);
  const [serviceNote, setServiceNote] = useState('');
  const [toast, setToast]             = useState('');

  /* ── unlock ──────────────────────────────────────────────── */
  async function unlock(e) {
    e?.preventDefault();
    setUnlockErr(''); setUnlocking(true);
    try {
      const r = await fetch(`${API_URL}/admin/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.getAccess()}` },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (j.ok) setUnlocked(true);
      else setUnlockErr('Incorrect password.');
    } catch (_e) { setUnlockErr('Verification failed.'); }
    finally { setUnlocking(false); }
  }

  function lock() {
    setUnlocked(false); setPassword('');
    setCoupon(null); setCode(''); setErr(''); setToast('');
  }

  /* ── lookup ──────────────────────────────────────────────── */
  async function lookup(e) {
    e?.preventDefault();
    setErr(''); setToast('');
    if (!code.trim()) return;
    setLoading(true); setCoupon(null);
    try {
      const r = await fetch(
        `${API_URL}/reception/lookup/${encodeURIComponent(code.trim().toUpperCase())}`,
        { headers: { Authorization: `Bearer ${tokens.getAccess()}`, 'x-admin-password': password } }
      );
      const j = await r.json();
      if (!r.ok) throw { code: j.error, status: r.status };
      setCoupon(j.coupon);
      setServiceNote('');
    } catch (e) {
      const c = e.code;
      setErr(
        c === 'coupon_not_found'          ? 'No coupon found for that code.'
      : c === 'admin_password_incorrect'  ? 'Your password changed — please unlock again.'
      : 'Lookup failed. Please try again.'
      );
      if (c === 'admin_password_incorrect') { setUnlocked(false); setPassword(''); }
    } finally { setLoading(false); }
  }

  /* ── avail ───────────────────────────────────────────────── */
  async function avail() {
    setErr(''); setLoading(true);
    try {
      const r = await fetch(
        `${API_URL}/reception/avail/${encodeURIComponent(coupon.coupon_code)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.getAccess()}`,
            'x-admin-password': password,
          },
          body: JSON.stringify({ service_note: serviceNote.trim() || undefined }),
        }
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'avail_failed');

      const newUses     = j.current_uses;
      const fullyUsed   = j.fully_used;
      const remaining   = j.remaining_uses;

      // Update coupon state with new usage counts + append to history
      setCoupon(prev => ({
        ...prev,
        status:        fullyUsed ? 'used' : 'unused',
        current_uses:  newUses,
        remaining_uses: remaining,
        used_at:       fullyUsed ? j.redeemed_at : prev.used_at,
        used_by_admin_name: tokens.getUser()?.full_name || 'Staff',
        redemption_history: [
          {
            id:               j.redemption_id,
            redeemed_at:      j.redeemed_at,
            service_note:     serviceNote.trim() || null,
            redeemed_by_name: tokens.getUser()?.full_name || 'Staff',
            status:           'success',
          },
          ...(prev.redemption_history || []),
        ],
      }));

      setToast(
        fullyUsed
          ? `"${j.benefit_name}" fully used — all ${j.max_uses} uses exhausted.`
          : `✓ Redeemed "${j.benefit_name}" — ${remaining} use${remaining !== 1 ? 's' : ''} remaining.`
      );
      setServiceNote('');
    } catch (e) {
      setErr(
        e.message === 'coupon_already_used' ? 'This coupon has already been fully used.'
      : e.message === 'coupon_expired'      ? 'This coupon has expired.'
      : 'Failed to mark as used. Please try again.'
      );
    } finally { setLoading(false); setConfirm(false); }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── unlock screen ───────────────────────────────────────── */
  if (!unlocked) {
    return (
      <div className="col" style={{ gap: 18 }}>
        <h1>Reception Desk</h1>
        <div className="card" style={{ maxWidth: 480 }}>
          <h3>Unlock</h3>
          <p style={{ color: 'var(--text-mid)', marginTop: 4 }}>
            Re-enter the admin password to access the reception desk.
            The password is verified on every lookup — it's never stored in the browser.
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

  /* ── main desk ───────────────────────────────────────────── */
  const multi     = isMultiUse(coupon);
  const remaining = coupon?.remaining_uses ?? (coupon ? (coupon.max_uses ?? 1) - (coupon.current_uses ?? 0) : 0);
  const canAvail  = coupon?.status === 'unused' && remaining > 0;
  const history   = coupon?.redemption_history || [];

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="between">
        <h1>Reception Desk</h1>
        <button className="secondary" onClick={lock}>Lock</button>
      </div>

      {/* ── lookup form ──────────────────────────────────────── */}
      <form onSubmit={lookup} className="search-hero">
        <h2 style={{ marginBottom: 12 }}>Enter coupon code</h2>
        <p style={{ color: 'var(--text-mid)', marginBottom: 20 }}>
          Ask the patient to read out the code on their IntenCiv Health Circle app.
        </p>
        <input
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="IHC-CPN-00001-HM01"
        />
        <div style={{ height: 14 }} />
        <button type="submit" disabled={loading || !code.trim()} style={{ width: '100%', height: 48 }}>
          {loading ? 'Looking up…' : 'Look up coupon'}
        </button>
        {err && <div className="error-banner" style={{ marginTop: 14 }}>{err}</div>}
      </form>

      {/* ── coupon result card ────────────────────────────────── */}
      {coupon && (
        <div className="card result-card">

          {/* header row */}
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="test-name">{coupon.benefit_name}</div>
            <span className={`pill pill-${coupon.status === 'unused' ? 'active' : coupon.status === 'used' ? 'availed' : 'expired'}`}>
              {coupon.status.toUpperCase()}
            </span>
          </div>

          {/* basic info */}
          <div className="info-row"><span>Coupon code</span>   <span className="mono">{coupon.coupon_code}</span></div>
          <div className="info-row"><span>Patient</span>       <span>{coupon.member_name || '—'}</span></div>
          <div className="info-row"><span>Patient phone</span> <span className="mono">{coupon.member_phone}</span></div>
          <div className="info-row"><span>Card number</span>   <span className="mono">{coupon.card_number}</span></div>
          <div className="info-row"><span>Plan</span>          <span>{coupon.plan_name}</span></div>
          <div className="info-row"><span>Expires on</span>    <span>{fmtDate(coupon.expires_at)}</span></div>

          {/* ── multi-use usage tracker ─────────────────────── */}
          {multi && (
            <div style={{
              margin: '16px 0',
              padding: '14px 16px',
              backgroundColor: 'var(--surface, #F0F7FF)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-dark, #1a202c)' }}>Usage tracker</span>
                <UsageDots current={coupon.current_uses ?? 0} max={coupon.max_uses ?? 1} />
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
                    {remaining}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-mid)' }}>remaining</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-dark, #1a202c)' }}>
                    {coupon.current_uses ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-mid)' }}>used so far</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-mid)' }}>
                    {coupon.max_uses ?? 1}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-mid)' }}>total allowed</div>
                </div>
              </div>
            </div>
          )}

          {/* single-use: show used_at if used */}
          {!multi && coupon.status === 'used' && (
            <div className="info-row">
              <span>Used at</span>
              <span>{fmtDateTime(coupon.used_at)} by {coupon.used_by_admin_name || '—'}</span>
            </div>
          )}

          {/* ── redemption history (multi-use) ──────────────── */}
          {multi && history.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-mid)', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Redemption history
              </div>
              {history.map((h, idx) => (
                <div key={h.id ?? idx} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 0', borderBottom: '1px solid var(--surface, #F0F7FF)',
                }}>
                  <span style={{
                    minWidth: 24, height: 24, borderRadius: '50%',
                    backgroundColor: 'var(--primary)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {history.length - idx}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDateTime(h.redeemed_at)}</div>
                    {h.service_note     && <div style={{ color: 'var(--text-mid)', fontSize: 12, marginTop: 2 }}>{h.service_note}</div>}
                    {h.redeemed_by_name && <div style={{ color: 'var(--text-mid)', fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>by {h.redeemed_by_name}</div>}
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10,
                    backgroundColor: h.status === 'success' ? 'rgba(56,161,105,0.12)' : 'rgba(229,62,62,0.10)',
                    color: h.status === 'success' ? '#38a169' : '#e53e3e',
                    fontSize: 11, fontWeight: 600,
                  }}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── action buttons ───────────────────────────────── */}
          <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            {canAvail && (
              <button onClick={() => setConfirm(true)} disabled={loading}>
                {multi ? `Redeem (${remaining} left)` : 'Mark as Availed'}
              </button>
            )}
            <button className="secondary" onClick={() => { setCoupon(null); setCode(''); setErr(''); }}>
              New lookup
            </button>
          </div>
        </div>
      )}

      {/* ── confirm dialog ────────────────────────────────────── */}
      {confirm && (
        <div className="dialog-backdrop" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>{multi ? 'Redeem one use of this coupon?' : 'Mark coupon as used?'}</h3>
            <p style={{ color: 'var(--text-mid)', marginTop: 6 }}>
              {multi
                ? `This will record redemption #${(coupon.current_uses ?? 0) + 1} of ${coupon.max_uses}. ${remaining - 1} use${remaining - 1 !== 1 ? 's' : ''} will remain after this. The patient's app will update instantly.`
                : 'This is irreversible. The patient\'s app will update instantly.'}
            </p>

            {/* optional service note */}
            <div style={{ marginTop: 14 }}>
              <label className="label">Service note <span style={{ color: 'var(--text-mid)', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="text"
                value={serviceNote}
                onChange={e => setServiceNote(e.target.value)}
                placeholder="e.g. Home collection – Sector 12, Noida"
                style={{ marginTop: 6 }}
                autoFocus
              />
            </div>

            <div className="actions" style={{ marginTop: 16 }}>
              <button className="secondary" onClick={() => setConfirm(false)}>Cancel</button>
              <button onClick={avail} disabled={loading}>
                {loading ? 'Processing…' : multi ? 'Yes, redeem' : 'Yes, mark used'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── toast ─────────────────────────────────────────────── */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

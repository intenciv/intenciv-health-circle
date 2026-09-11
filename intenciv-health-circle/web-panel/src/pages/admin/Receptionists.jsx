import { useEffect, useState } from 'react';
import { api } from '../../services/api';

// Mirrors Salespersons.jsx. Reception has no activation PIN — that control
// belongs to salespersons authorising card activations in the field — so the
// only credential here is Employee ID + password, which is exactly what
// /auth/reception/login checks.
const EMPLOYEE_ID_RE = /^INT\d{4}$/;
function isStrongPassword(s) {
  s = String(s || '');
  return s.length >= 8 && /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s);
}

export default function Receptionists() {
  const [list, setList]   = useState([]);
  const [err, setErr]     = useState('');
  const [open, setOpen]   = useState(null);
  const [draft, setDraft] = useState({ full_name: '', employee_id: '', email: '', phone: '', password: '', alsoSells: false, pin: '' });
  const [pwOpen, setPwOpen]           = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving]           = useState(false);

  async function load() {
    try { const { data } = await api.get('/admin/receptionists'); setList(data.receptionists); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load'); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setSaving(true); setErr('');
    try {
      await api.post('/admin/receptionists', {
        ...draft,
        roles: draft.alsoSells ? ['reception', 'salesperson'] : ['reception'],
        pin: draft.alsoSells ? draft.pin : undefined,
      });
      setOpen(null);
      setDraft({ full_name: '', employee_id: '', email: '', phone: '', password: '', alsoSells: false, pin: '' });
      load();
    }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  }
  async function update(r) {
    try {
      await api.put(`/admin/receptionists/${r.id}`, {
        full_name: r.full_name, employee_id: r.employee_id, email: r.email, phone: r.phone,
        roles: r.alsoSells ? ['reception', 'salesperson'] : ['reception'],
        pin: r.alsoSells && r.pin ? r.pin : undefined,
      });
      setOpen(null); load();
    }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }
  async function resetPassword() {
    if (!isStrongPassword(newPassword)) {
      setErr('Password must be at least 8 characters with one capital letter, one numeral, and one special character.');
      return;
    }
    try { await api.put(`/admin/receptionists/${pwOpen.id}`, { password: newPassword }); setPwOpen(null); setNewPassword(''); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to reset password'); }
  }
  async function toggle(r) {
    try { await api.put(`/admin/receptionists/${r.id}`, { is_active: !r.is_active }); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Toggle failed'); }
  }
  async function remove(r) {
    if (!confirm(`Remove ${r.full_name}? This deletes their login only.`)) return;
    try { await api.delete(`/admin/receptionists/${r.id}`); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Delete failed'); }
  }

  const missingId = list.filter(r => !r.employee_id).length;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="between">
        <h1>Reception</h1>
        <button onClick={() => setOpen('new')}>+ New</button>
      </div>
      {err && <div className="error-banner">{err}</div>}

      {missingId > 0 && (
        <div className="error-banner">
          {missingId === 1 ? 'One reception account has' : `${missingId} reception accounts have`} no
          Employee ID, so {missingId === 1 ? 'it' : 'they'} cannot sign in. Use Edit to assign one.
        </div>
      )}

      {/* ── Desktop table ── */}
      <table className="sp-table">
        <thead>
          <tr>
            <th>Name</th><th>Employee ID</th><th>Email</th><th>Phone</th>
            <th>Last login</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(r => (
            <tr key={r.id}>
              <td>{r.full_name}{(r.roles || []).includes('salesperson') && <span className="pill pill-active" style={{ marginLeft: 8 }}>Also sells</span>}</td>
              <td className="mono">{r.employee_id || '—'}</td>
              <td>{r.email || '—'}</td>
              <td className="mono">{r.phone || '—'}</td>
              <td>{r.last_login ? new Date(r.last_login).toLocaleString() : '—'}</td>
              <td>
                <span className={`pill ${r.is_active ? 'pill-active' : 'pill-expired'}`}>
                  {r.is_active ? 'Active' : 'Disabled'}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="secondary" onClick={() => setOpen({ ...r, alsoSells: (r.roles || []).includes('salesperson'), pin: '' })}>Edit</button>
                <button className="secondary" onClick={() => setPwOpen(r)}>Reset Password</button>
                <button className="secondary" onClick={() => toggle(r)}>{r.is_active ? 'Disable' : 'Enable'}</button>
                <button className="danger"    onClick={() => remove(r)}>Remove</button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-mid)' }}>No reception accounts yet.</td></tr>
          )}
        </tbody>
      </table>

      {/* ── Mobile cards ── */}
      <div className="sp-cards">
        {list.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-mid)' }}>No reception accounts yet.</p>
        )}
        {list.map(r => (
          <div key={r.id} className="sp-card">
            <div className="sp-card-header">
              <div>
                <div className="sp-card-name">{r.full_name}</div>
                <div className="sp-card-phone mono">{r.employee_id || '— no Employee ID —'}</div>
                <div className="sp-card-phone">{r.email || r.phone || '—'}</div>
              </div>
              <span className={`pill ${r.is_active ? 'pill-active' : 'pill-expired'}`}>
                {r.is_active ? 'Active' : 'Disabled'}
              </span>
            </div>

            {r.last_login && (
              <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 8 }}>
                Last login: {new Date(r.last_login).toLocaleString()}
              </div>
            )}

            <div className="sp-card-actions">
              <button className="secondary" onClick={() => setOpen({ ...r, alsoSells: (r.roles || []).includes('salesperson'), pin: '' })}>Edit</button>
              <button className="secondary" onClick={() => setPwOpen(r)}>Reset Password</button>
              <button className="secondary" onClick={() => toggle(r)}>{r.is_active ? 'Disable' : 'Enable'}</button>
              <button className="danger"    onClick={() => remove(r)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dialogs ── */}
      {open === 'new' && (
        <Dialog title="Add reception account" onClose={() => setOpen(null)} onSave={create} saving={saving}
          disabled={
            !draft.full_name
            || !EMPLOYEE_ID_RE.test((draft.employee_id || '').toUpperCase())
            || !isStrongPassword(draft.password)
            || (draft.alsoSells && !/^\d{4}$/.test(draft.pin))
          }>
          <label className="label">Full name</label>
          <input value={draft.full_name} onChange={e => setDraft({ ...draft, full_name: e.target.value })} />

          <label className="label">Employee ID <span style={{ color: 'var(--text-mid)', fontWeight: 400 }}>(this is what they sign in with)</span></label>
          <input
            value={draft.employee_id}
            onChange={e => setDraft({ ...draft, employee_id: e.target.value.toUpperCase() })}
            placeholder="INT0018"
            style={{ textTransform: 'uppercase' }}
          />

          <label className="label">Email <span style={{ color: 'var(--text-mid)', fontWeight: 400 }}>(optional, contact only — not used to sign in)</span></label>
          <input value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="name@intenciv.in" />

          <label className="label">Mobile number <span style={{ color: 'var(--text-mid)', fontWeight: 400 }}>(optional, contact only)</span></label>
          <input value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="+91 98765 43210" />

          <label className="label">Password (min 8 characters, 1 capital, 1 numeral, 1 special character)</label>
          <input value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} type="password" placeholder="••••••••" />

          <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <input type="checkbox" checked={draft.alsoSells} style={{ width: 'auto' }}
              onChange={e => setDraft({ ...draft, alsoSells: e.target.checked })} />
            Can also sell memberships
          </label>
          {draft.alsoSells && (
            <>
              <p style={{ color: 'var(--text-mid)', fontSize: 13, margin: '4px 0 8px' }}>
                They will be able to sign in through the Salesperson tab as well, using the same
                Employee ID and password. Selling needs a 4-digit PIN to authorise each activation.
              </p>
              <label className="label">4-digit activation PIN</label>
              <input value={draft.pin} maxLength={4} type="password"
                onChange={e => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
            </>
          )}
        </Dialog>
      )}

      {open && open !== 'new' && (
        <Dialog title="Edit reception account" onClose={() => setOpen(null)} onSave={() => update(open)}
          disabled={!EMPLOYEE_ID_RE.test((open.employee_id || '').toUpperCase())}>
          <label className="label">Full name</label>
          <input value={open.full_name || ''} onChange={e => setOpen({ ...open, full_name: e.target.value })} />

          <label className="label">Employee ID <span style={{ color: 'var(--text-mid)', fontWeight: 400 }}>(required — this is what they sign in with)</span></label>
          <input
            value={open.employee_id || ''}
            onChange={e => setOpen({ ...open, employee_id: e.target.value.toUpperCase() })}
            placeholder="INT0018"
            style={{ textTransform: 'uppercase' }}
          />

          <label className="label">Email <span style={{ color: 'var(--text-mid)', fontWeight: 400 }}>(optional, contact only)</span></label>
          <input value={open.email || ''} onChange={e => setOpen({ ...open, email: e.target.value })} />

          <label className="label">Mobile number <span style={{ color: 'var(--text-mid)', fontWeight: 400 }}>(optional, contact only)</span></label>
          <input value={open.phone || ''} onChange={e => setOpen({ ...open, phone: e.target.value })} />

          <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <input type="checkbox" checked={!!open.alsoSells} style={{ width: 'auto' }}
              onChange={e => setOpen({ ...open, alsoSells: e.target.checked })} />
            Can also sell memberships
          </label>
          {open.alsoSells && (
            <>
              <p style={{ color: 'var(--text-mid)', fontSize: 13, margin: '4px 0 8px' }}>
                Selling needs a 4-digit activation PIN. Leave blank to keep the one they already have.
              </p>
              <label className="label">4-digit activation PIN</label>
              <input value={open.pin || ''} maxLength={4} type="password"
                onChange={e => setOpen({ ...open, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
            </>
          )}
        </Dialog>
      )}

      {pwOpen && (
        <Dialog title={`Reset password — ${pwOpen.full_name}`}
          onClose={() => { setPwOpen(null); setNewPassword(''); }} onSave={resetPassword}
          disabled={!isStrongPassword(newPassword)}>
          <p style={{ color: 'var(--text-mid)', marginBottom: 12 }}>
            Share the new password with them — they sign in with their Employee ID and this password.
          </p>
          <label className="label">New password (min 8 chars, 1 capital, 1 numeral, 1 special character)</label>
          <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" />
        </Dialog>
      )}
    </div>
  );
}

function Dialog({ title, onClose, onSave, saving, disabled, children }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <div style={{ marginTop: 12 }}>{children}</div>
        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={onSave} disabled={saving || disabled}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

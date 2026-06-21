import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Salespersons() {
  const [list, setList]       = useState([]);
  const [err, setErr]         = useState('');
  const [open, setOpen]       = useState(null);
  const [draft, setDraft]     = useState({ full_name: '', phone: '', pin: '' });
  const [pinOpen, setPinOpen] = useState(null);
  const [newPin, setNewPin]   = useState('');
  const [saving, setSaving]   = useState(false);

  async function load() {
    try { const { data } = await api.get('/admin/salespersons'); setList(data.salespersons); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load'); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setSaving(true); setErr('');
    try { await api.post('/admin/salespersons', draft); setOpen(null); setDraft({ full_name: '', phone: '', pin: '' }); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  }
  async function update(sp) {
    try { await api.put(`/admin/salespersons/${sp.id}`, { full_name: sp.full_name, phone: sp.phone }); setOpen(null); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }
  async function resetPin() {
    if (!/^\d{4}$/.test(newPin)) { setErr('PIN must be 4 digits.'); return; }
    try { await api.put(`/admin/salespersons/${pinOpen.id}`, { pin: newPin }); setPinOpen(null); setNewPin(''); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to reset PIN'); }
  }
  async function toggle(sp) {
    try { await api.put(`/admin/salespersons/${sp.id}`, { is_active: !sp.is_active }); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Toggle failed'); }
  }
  async function remove(sp) {
    if (!confirm(`Remove ${sp.full_name}? Their card history stays intact.`)) return;
    try { await api.delete(`/admin/salespersons/${sp.id}`); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Delete failed'); }
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="between">
        <h1>Salespersons</h1>
        <button onClick={() => setOpen('new')}>+ New</button>
      </div>
      {err && <div className="error-banner">{err}</div>}

      {/* ── Desktop table ── */}
      <table className="sp-table">
        <thead>
          <tr><th>Name</th><th>Phone</th><th>Today</th><th>Week</th><th>Month</th><th>Total</th><th>Last login</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {list.map(s => (
            <tr key={s.id}>
              <td>{s.full_name}</td>
              <td className="mono">{s.phone}</td>
              <td>{s.today_count}</td>
              <td>{s.week_count}</td>
              <td>{s.month_count}</td>
              <td>{s.total_count}</td>
              <td>{s.last_login ? new Date(s.last_login).toLocaleString() : '—'}</td>
              <td><span className={`pill ${s.is_active ? 'pill-active' : 'pill-expired'}`}>{s.is_active ? 'Active' : 'Disabled'}</span></td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="secondary" onClick={() => setOpen({ ...s })}>Edit</button>
                <button className="secondary" onClick={() => setPinOpen(s)}>Reset PIN</button>
                <button className="secondary" onClick={() => toggle(s)}>{s.is_active ? 'Disable' : 'Enable'}</button>
                <button className="danger"    onClick={() => remove(s)}>Remove</button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-mid)' }}>No salespersons yet.</td></tr>
          )}
        </tbody>
      </table>

      {/* ── Mobile cards ── */}
      <div className="sp-cards">
        {list.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-mid)' }}>No salespersons yet.</p>
        )}
        {list.map(s => (
          <div key={s.id} className="sp-card">
            <div className="sp-card-header">
              <div>
                <div className="sp-card-name">{s.full_name}</div>
                <div className="sp-card-phone">{s.phone}</div>
              </div>
              <span className={`pill ${s.is_active ? 'pill-active' : 'pill-expired'}`}>
                {s.is_active ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="sp-card-stats">
              <div><span>{s.today_count}</span>Today</div>
              <div><span>{s.week_count}</span>Week</div>
              <div><span>{s.month_count}</span>Month</div>
              <div><span>{s.total_count}</span>Total</div>
            </div>

            {s.last_login && (
              <div style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 4 }}>
                Last login: {new Date(s.last_login).toLocaleString()}
              </div>
            )}

            <div className="sp-card-actions">
              <button className="secondary" onClick={() => setOpen({ ...s })}>Edit</button>
              <button className="secondary" onClick={() => setPinOpen(s)}>Reset PIN</button>
              <button className="secondary" onClick={() => toggle(s)}>{s.is_active ? 'Disable' : 'Enable'}</button>
              <button className="danger"    onClick={() => remove(s)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dialogs ── */}
      {open === 'new' && (
        <Dialog title="Add salesperson" onClose={() => setOpen(null)} onSave={create} saving={saving}
          disabled={!draft.full_name || !draft.phone || !/^\d{4}$/.test(draft.pin)}>
          <label className="label">Full name</label>
          <input value={draft.full_name} onChange={e => setDraft({ ...draft, full_name: e.target.value })} />
          <label className="label">Mobile number</label>
          <input value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="+91 98765 43210" />
          <label className="label">4-digit PIN (assigned by you — salespersons can't change it)</label>
          <input value={draft.pin} onChange={e => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} maxLength={4} />
        </Dialog>
      )}

      {open && open !== 'new' && (
        <Dialog title="Edit salesperson" onClose={() => setOpen(null)} onSave={() => update(open)}>
          <label className="label">Full name</label>
          <input value={open.full_name || ''} onChange={e => setOpen({ ...open, full_name: e.target.value })} />
          <label className="label">Mobile number</label>
          <input value={open.phone || ''} onChange={e => setOpen({ ...open, phone: e.target.value })} />
        </Dialog>
      )}

      {pinOpen && (
        <Dialog title={`Reset PIN — ${pinOpen.full_name}`}
          onClose={() => { setPinOpen(null); setNewPin(''); }} onSave={resetPin}
          disabled={!/^\d{4}$/.test(newPin)}>
          <p style={{ color: 'var(--text-mid)', marginBottom: 12 }}>
            Share the new PIN with the salesperson verbally. They will use it to sign in and to authorize each card activation.
          </p>
          <label className="label">New 4-digit PIN</label>
          <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} type="password" />
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

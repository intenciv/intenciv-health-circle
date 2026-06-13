import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Users() {
  const [users, setUsers]   = useState([]);
  const [err, setErr]       = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [draft, setDraft]   = useState({ full_name: '', phone: '', email: '', role: 'sales_agent' });
  const [saving, setSaving] = useState(false);
  const [filterRole, setFilterRole] = useState('');

  async function load() {
    try {
      const q = filterRole ? `?role=${filterRole}` : '';
      const { data } = await api.get(`/admin/users${q}`);
      setUsers(data.users);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load'); }
  }
  useEffect(() => { load(); }, [filterRole]);

  async function create() {
    setErr(''); setSaving(true);
    try {
      await api.post('/admin/users', draft);
      setOpenNew(false);
      setDraft({ full_name: '', phone: '', email: '', role: 'sales_agent' });
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function toggle(u) {
    try { await api.put(`/admin/users/${u.id}/toggle`); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Toggle failed'); }
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="between">
        <h1>Users</h1>
        <button onClick={() => setOpenNew(true)}>+ New user</button>
      </div>
      {err && <div className="error-banner">{err}</div>}

      <div className="row">
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ width: 220 }}>
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="sales_agent">Sales agent</option>
          <option value="receptionist">Receptionist</option>
          <option value="client">Client</option>
        </select>
      </div>

      <table>
        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.full_name || <span style={{ color: 'var(--text-mid)' }}>—</span>}</td>
              <td className="mono">{u.phone}</td>
              <td>{u.email || '—'}</td>
              <td><span className="pill pill-cyan">{u.role}</span></td>
              <td><span className={`pill ${u.is_active ? 'pill-active' : 'pill-expired'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
              <td>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
              <td>
                {u.role !== 'client' && (
                  <button className="secondary" onClick={() => toggle(u)}>{u.is_active ? 'Disable' : 'Enable'}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {openNew && (
        <div className="dialog-backdrop" onClick={() => setOpenNew(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Create user</h3>
            <div className="col" style={{ marginTop: 12 }}>
              <input placeholder="Full name" value={draft.full_name} onChange={e => setDraft({ ...draft, full_name: e.target.value })} />
              <input placeholder="Phone (+91…)" value={draft.phone}   onChange={e => setDraft({ ...draft, phone: e.target.value })} />
              <input placeholder="Email (optional)" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
              <select value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })}>
                <option value="sales_agent">Sales agent</option>
                <option value="receptionist">Receptionist</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="actions">
              <button className="secondary" onClick={() => setOpenNew(false)}>Cancel</button>
              <button onClick={create} disabled={saving || !draft.full_name || !draft.phone}>
                {saving ? 'Saving…' : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

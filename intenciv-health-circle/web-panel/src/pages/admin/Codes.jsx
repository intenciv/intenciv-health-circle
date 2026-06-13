import { useEffect, useState } from 'react';
import { api, API_URL, tokens } from '../../services/api';

export default function Codes() {
  const [codes, setCodes]   = useState([]);
  const [tiers, setTiers]   = useState([]);
  const [agents, setAgents] = useState([]);
  const [err, setErr]       = useState('');
  const [filter, setFilter] = useState({ tier_id: '', agent_id: '', status: '' });
  const [batch, setBatch]   = useState({ tier_id: '', agent_id: '', count: 10 });
  const [openBatch, setOpenBatch] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const params = new URLSearchParams();
      Object.entries(filter).forEach(([k, v]) => v && params.set(k, v));
      const { data } = await api.get(`/admin/activation-codes?${params}`);
      setCodes(data.codes);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load'); }
  }

  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    api.get('/admin/tiers').then(r => setTiers(r.data.tiers));
    api.get('/admin/users?role=sales_agent').then(r => setAgents(r.data.users));
  }, []);

  async function generate() {
    setErr(''); setSaving(true);
    try {
      await api.post('/admin/activation-codes', {
        tier_id: batch.tier_id,
        agent_id: batch.agent_id || null,
        count: Number(batch.count),
      });
      setOpenBatch(false);
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to generate'); }
    finally { setSaving(false); }
  }

  function exportCSV() {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => v && params.set(k, v));
    params.set('format', 'csv');
    const url = `${API_URL}/admin/activation-codes?${params}`;
    fetch(url, { headers: { Authorization: `Bearer ${tokens.getAccess()}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'activation_codes.csv';
        a.click();
      });
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="between">
        <h1>Activation Codes</h1>
        <div className="row" style={{ gap: 12 }}>
          <button className="secondary" onClick={exportCSV}>Export CSV</button>
          <button onClick={() => setOpenBatch(true)}>+ Generate batch</button>
        </div>
      </div>
      {err && <div className="error-banner">{err}</div>}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <select value={filter.tier_id} onChange={e => setFilter({ ...filter, tier_id: e.target.value })} style={{ width: 220 }}>
          <option value="">All tiers</option>
          {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filter.agent_id} onChange={e => setFilter({ ...filter, agent_id: e.target.value })} style={{ width: 220 }}>
          <option value="">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.phone}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} style={{ width: 180 }}>
          <option value="">All statuses</option>
          <option value="unused">Unused</option>
          <option value="used">Used</option>
        </select>
      </div>

      <table>
        <thead>
          <tr><th>Code</th><th>Tier</th><th>Assigned Agent</th><th>Status</th><th>Used At</th></tr>
        </thead>
        <tbody>
          {codes.map(c => (
            <tr key={c.id}>
              <td className="mono">{c.code}</td>
              <td>{c.tier_name}</td>
              <td>{c.agent_name || <span style={{ color: 'var(--text-mid)' }}>Unassigned</span>}</td>
              <td><span className={`pill ${c.is_used ? 'pill-availed' : 'pill-active'}`}>{c.is_used ? 'Used' : 'Available'}</span></td>
              <td>{c.used_at ? new Date(c.used_at).toLocaleString() : '—'}</td>
            </tr>
          ))}
          {codes.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-mid)' }}>No codes yet.</td></tr>}
        </tbody>
      </table>

      {openBatch && (
        <div className="dialog-backdrop" onClick={() => setOpenBatch(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Generate activation codes</h3>
            <div className="col" style={{ marginTop: 12 }}>
              <label className="label">Tier</label>
              <select value={batch.tier_id} onChange={e => setBatch({ ...batch, tier_id: e.target.value })}>
                <option value="">Select tier…</option>
                {tiers.map(t => <option key={t.id} value={t.id}>{t.name} — ₹{Number(t.price).toFixed(0)}</option>)}
              </select>
              <label className="label">Assign to agent (optional)</label>
              <select value={batch.agent_id} onChange={e => setBatch({ ...batch, agent_id: e.target.value })}>
                <option value="">Unassigned</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.phone}</option>)}
              </select>
              <label className="label">Count (1–1000)</label>
              <input type="number" min={1} max={1000} value={batch.count} onChange={e => setBatch({ ...batch, count: e.target.value })} />
            </div>
            <div className="actions">
              <button className="secondary" onClick={() => setOpenBatch(false)}>Cancel</button>
              <button onClick={generate} disabled={saving || !batch.tier_id}>{saving ? 'Generating…' : 'Generate'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

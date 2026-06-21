import { useEffect, useState } from 'react';
import { api, API_URL, tokens } from '../../services/api';

export default function Cards() {
  const [cards, setCards]   = useState([]);
  const [plans, setPlans]   = useState([]);
  const [sps, setSps]       = useState([]);
  const [filter, setFilter] = useState({ plan_id: '', salesperson_id: '', status: '' });
  const [openBatch, setOpenBatch]   = useState(false);
  const [batch, setBatch]           = useState({ plan_id: '', assign_to_salesperson_id: '', count: 50 });
  const [openAssign, setOpenAssign] = useState(null);
  const [assignSp, setAssignSp]     = useState('');
  const [err, setErr]     = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const p = new URLSearchParams();
      Object.entries(filter).forEach(([k, v]) => v && p.set(k, v));
      const { data } = await api.get(`/admin/cards?${p}`);
      setCards(data.cards);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to load'); }
  }
  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    api.get('/admin/plans').then(r => setPlans(r.data.plans));
    api.get('/admin/salespersons').then(r => setSps(r.data.salespersons));
  }, []);

  async function generate() {
    setSaving(true); setErr('');
    try {
      await api.post('/admin/cards/batch', {
        plan_id: batch.plan_id,
        assign_to_salesperson_id: batch.assign_to_salesperson_id || null,
        count: Number(batch.count),
      });
      setOpenBatch(false); load();
    } catch (e) { setErr(e.response?.data?.error || 'Generate failed'); }
    finally { setSaving(false); }
  }

  async function assign() {
    try {
      await api.put(`/admin/cards/${openAssign.id}/assign`, { salesperson_id: assignSp });
      setOpenAssign(null); setAssignSp(''); load();
    } catch (e) { setErr(e.response?.data?.error || 'Assign failed'); }
  }

  function exportCSV() {
    const p = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => v && p.set(k, v));
    p.set('format', 'csv');
    fetch(`${API_URL}/admin/cards?${p}`, { headers: { Authorization: `Bearer ${tokens.getAccess()}` } })
      .then(r => r.blob())
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cards.csv'; a.click(); });
  }

  const statusColor = s => s === 'active' ? 'pill-active' : s === 'expired' ? 'pill-expired' : 'pill-cyan';

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="between">
        <h1>Cards</h1>
        <div className="row" style={{ gap: 10 }}>
          <button className="secondary" onClick={exportCSV}>Export CSV</button>
          <button onClick={() => setOpenBatch(true)}>+ Batch</button>
        </div>
      </div>
      {err && <div className="error-banner">{err}</div>}

      {/* Filters */}
      <div className="row filter-row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <select value={filter.plan_id} onChange={e => setFilter({ ...filter, plan_id: e.target.value })} style={{ width: 220 }}>
          <option value="">All plans</option>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_corporate ? ' (Corp)' : ''}</option>)}
        </select>
        <select value={filter.salesperson_id} onChange={e => setFilter({ ...filter, salesperson_id: e.target.value })} style={{ width: 220 }}>
          <option value="">All salespersons</option>
          {sps.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} style={{ width: 180 }}>
          <option value="">All statuses</option>
          <option value="unused">Unused</option>
          <option value="assigned">Assigned</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Desktop table */}
      <table className="cards-table">
        <thead>
          <tr><th>Card #</th><th>Plan</th><th>Salesperson</th><th>Customer</th><th>Status</th><th>Activated</th><th>Expires</th><th>Amount</th><th></th></tr>
        </thead>
        <tbody>
          {cards.map(c => (
            <tr key={c.id}>
              <td className="mono">{c.card_number}</td>
              <td>{c.plan_name}</td>
              <td>{c.salesperson_name || <span style={{ color: 'var(--text-mid)' }}>Unassigned</span>}</td>
              <td>{c.customer_name ? <>{c.customer_name}<br /><span style={{ color: 'var(--text-mid)', fontSize: 12 }} className="mono">{c.customer_phone}</span></> : '—'}</td>
              <td><span className={`pill ${statusColor(c.status)}`}>{c.status.toUpperCase()}</span></td>
              <td>{c.activated_at ? new Date(c.activated_at).toLocaleDateString() : '—'}</td>
              <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
              <td>{c.amount_paid ? `₹${Number(c.amount_paid).toFixed(0)}` : '—'}</td>
              <td>{['unused', 'assigned'].includes(c.status) && <button className="secondary" onClick={() => setOpenAssign(c)}>Assign</button>}</td>
            </tr>
          ))}
          {cards.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-mid)' }}>No cards found.</td></tr>}
        </tbody>
      </table>

      {/* Mobile card list */}
      <div className="cards-list">
        {cards.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-mid)' }}>No cards found.</p>}
        {cards.map(c => (
          <div key={c.id} className="c-card">
            <div className="c-card-top">
              <div>
                <div className="c-card-num">{c.card_number}</div>
                <div className="c-card-plan">{c.plan_name}</div>
              </div>
              <span className={`pill ${statusColor(c.status)}`}>{c.status.toUpperCase()}</span>
            </div>
            <div className="c-card-rows">
              <div className="c-card-row"><span>Salesperson</span><span>{c.salesperson_name || 'Unassigned'}</span></div>
              {c.customer_name && <div className="c-card-row"><span>Customer</span><span>{c.customer_name}<br /><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.customer_phone}</span></span></div>}
              {c.activated_at  && <div className="c-card-row"><span>Activated</span><span>{new Date(c.activated_at).toLocaleDateString()}</span></div>}
              {c.expires_at    && <div className="c-card-row"><span>Expires</span><span>{new Date(c.expires_at).toLocaleDateString()}</span></div>}
              {c.amount_paid   && <div className="c-card-row"><span>Amount</span><span>₹{Number(c.amount_paid).toFixed(0)}</span></div>}
            </div>
            {['unused', 'assigned'].includes(c.status) && (
              <button className="secondary" onClick={() => setOpenAssign(c)} style={{ marginTop: 12, width: '100%' }}>Assign</button>
            )}
          </div>
        ))}
      </div>

      {/* Generate batch dialog */}
      {openBatch && (
        <div className="dialog-backdrop" onClick={() => setOpenBatch(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Generate card batch</h3>
            <p style={{ color: 'var(--text-mid)', marginBottom: 12 }}>Card numbers follow the format <span className="mono">IHC-YYYY-NNNNN</span>.</p>
            <label className="label">Plan</label>
            <select value={batch.plan_id} onChange={e => setBatch({ ...batch, plan_id: e.target.value })}>
              <option value="">Select plan…</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toFixed(0)}{p.is_corporate ? ' (Corp)' : ''}</option>)}
            </select>
            <label className="label">Assign to salesperson (optional)</label>
            <select value={batch.assign_to_salesperson_id} onChange={e => setBatch({ ...batch, assign_to_salesperson_id: e.target.value })}>
              <option value="">Unassigned</option>
              {sps.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <label className="label">Count (1–1000)</label>
            <input type="number" min={1} max={1000} value={batch.count} onChange={e => setBatch({ ...batch, count: e.target.value })} />
            <div className="actions">
              <button className="secondary" onClick={() => setOpenBatch(false)}>Cancel</button>
              <button onClick={generate} disabled={saving || !batch.plan_id}>{saving ? 'Generating…' : 'Generate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign dialog */}
      {openAssign && (
        <div className="dialog-backdrop" onClick={() => setOpenAssign(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Assign {openAssign.card_number}</h3>
            <label className="label">Salesperson</label>
            <select value={assignSp} onChange={e => setAssignSp(e.target.value)}>
              <option value="">Select…</option>
              {sps.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <div className="actions">
              <button className="secondary" onClick={() => setOpenAssign(null)}>Cancel</button>
              <button onClick={assign} disabled={!assignSp}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

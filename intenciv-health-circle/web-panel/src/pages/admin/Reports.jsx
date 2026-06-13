import { useEffect, useState } from 'react';
import { api, API_URL, tokens } from '../../services/api';

export default function Reports() {
  const [tiers, setTiers]   = useState([]);
  const [agents, setAgents] = useState([]);
  const [tab, setTab]       = useState('sales');
  const [filter, setFilter] = useState({ from: '', to: '', agent_id: '', tier_id: '', status: '', test: '' });
  const [rows, setRows]     = useState([]);
  const [err, setErr]       = useState('');

  useEffect(() => {
    api.get('/admin/tiers').then(r => setTiers(r.data.tiers));
    api.get('/admin/users?role=sales_agent').then(r => setAgents(r.data.users));
  }, []);

  async function run() {
    setErr('');
    try {
      const params = new URLSearchParams();
      Object.entries(filter).forEach(([k, v]) => v && params.set(k, v));
      const { data } = await api.get(`/admin/reports/${tab}?${params}`);
      setRows(data.rows);
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }

  function exportCSV() {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => v && params.set(k, v));
    params.set('format', 'csv');
    fetch(`${API_URL}/admin/reports/${tab}?${params}`, {
      headers: { Authorization: `Bearer ${tokens.getAccess()}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${tab}_report.csv`;
        a.click();
      });
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="between">
        <h1>Reports</h1>
        <button className="secondary" onClick={exportCSV} disabled={rows.length === 0}>Export CSV</button>
      </div>
      {err && <div className="error-banner">{err}</div>}

      <div className="row" style={{ gap: 8 }}>
        <button className={tab === 'sales'   ? '' : 'secondary'} onClick={() => { setTab('sales'); setRows([]); }}>Sales</button>
        <button className={tab === 'coupons' ? '' : 'secondary'} onClick={() => { setTab('coupons'); setRows([]); }}>Coupons</button>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div><label className="label">From</label><input type="date" value={filter.from} onChange={e => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label className="label">To</label><input type="date" value={filter.to} onChange={e => setFilter({ ...filter, to: e.target.value })} /></div>
        {tab === 'sales' && (
          <>
            <div style={{ minWidth: 200 }}>
              <label className="label">Agent</label>
              <select value={filter.agent_id} onChange={e => setFilter({ ...filter, agent_id: e.target.value })}>
                <option value="">All</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.phone}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 200 }}>
              <label className="label">Tier</label>
              <select value={filter.tier_id} onChange={e => setFilter({ ...filter, tier_id: e.target.value })}>
                <option value="">All</option>
                {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </>
        )}
        {tab === 'coupons' && (
          <>
            <div style={{ minWidth: 180 }}>
              <label className="label">Status</label>
              <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="availed">Availed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div style={{ minWidth: 220 }}>
              <label className="label">Test contains</label>
              <input value={filter.test} onChange={e => setFilter({ ...filter, test: e.target.value })} placeholder="e.g. Lipid" />
            </div>
          </>
        )}
        <div style={{ alignSelf: 'flex-end' }}><button onClick={run}>Run report</button></div>
      </div>

      <table>
        <thead>
          <tr>
            {rows[0] ? Object.keys(rows[0]).map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>) : <th>—</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{v === null || v === undefined ? '—' : String(v)}</td>)}</tr>
          ))}
          {rows.length === 0 && <tr><td style={{ textAlign: 'center', color: 'var(--text-mid)' }}>Run a report to see results.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

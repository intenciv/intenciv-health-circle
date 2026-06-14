import { useEffect, useState } from 'react';
import { api, API_URL, tokens } from '../../services/api';

const BENEFIT_CODES = ['HC', 'HM', 'VC', 'BG', 'SE', 'IC', 'MT', 'IS'];

export default function Reports() {
  const [tab, setTab]       = useState('sales');
  const [plans, setPlans]   = useState([]);
  const [sps, setSps]       = useState([]);
  const [filter, setFilter] = useState({ from: '', to: '', salesperson_id: '', plan_id: '', status: '', benefit_code: '' });
  const [rows, setRows]     = useState([]);
  const [err, setErr]       = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api.get('/admin/plans').then(r => setPlans(r.data.plans));
    api.get('/admin/salespersons').then(r => setSps(r.data.salespersons));
  }, []);

  async function run() {
    setErr(''); setRunning(true);
    try {
      const p = new URLSearchParams();
      Object.entries(filter).forEach(([k, v]) => v && p.set(k, v));
      const { data } = await api.get(`/admin/reports/${tab}?${p}`);
      setRows(data.rows);
    } catch (e) { setErr(e.response?.data?.error || 'Failed'); }
    finally { setRunning(false); }
  }

  function exportCSV() {
    const p = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => v && p.set(k, v));
    p.set('format', 'csv');
    fetch(`${API_URL}/admin/reports/${tab}?${p}`, {
      headers: { Authorization: `Bearer ${tokens.getAccess()}` },
    })
      .then(r => r.blob())
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${tab}_report.csv`; a.click(); });
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="between">
        <h1>Reports</h1>
        <button className="secondary" onClick={exportCSV} disabled={rows.length === 0}>Download CSV</button>
      </div>
      {err && <div className="error-banner">{err}</div>}

      <div className="row" style={{ gap: 8 }}>
        <button className={tab === 'sales'   ? '' : 'secondary'} onClick={() => { setTab('sales');   setRows([]); }}>Sales</button>
        <button className={tab === 'coupons' ? '' : 'secondary'} onClick={() => { setTab('coupons'); setRows([]); }}>Coupons</button>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label className="label">From</label><input type="date" value={filter.from} onChange={e => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><label className="label">To</label>  <input type="date" value={filter.to}   onChange={e => setFilter({ ...filter, to: e.target.value })} /></div>
        {tab === 'sales' && (
          <>
            <div style={{ minWidth: 200 }}>
              <label className="label">Salesperson</label>
              <select value={filter.salesperson_id} onChange={e => setFilter({ ...filter, salesperson_id: e.target.value })}>
                <option value="">All</option>
                {sps.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 200 }}>
              <label className="label">Plan</label>
              <select value={filter.plan_id} onChange={e => setFilter({ ...filter, plan_id: e.target.value })}>
                <option value="">All</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                <option value="unused">Unused</option>
                <option value="used">Used</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label className="label">Benefit</label>
              <select value={filter.benefit_code} onChange={e => setFilter({ ...filter, benefit_code: e.target.value })}>
                <option value="">All</option>
                {BENEFIT_CODES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </>
        )}
        <button onClick={run} disabled={running}>{running ? 'Running…' : 'Run report'}</button>
      </div>

      <div style={{ overflow: 'auto' }}>
        <table>
          <thead>
            <tr>{rows[0] ? Object.keys(rows[0]).map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>) : <th>—</th>}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{v === null || v === undefined ? '—' : String(v)}</td>)}</tr>
            ))}
            {rows.length === 0 && <tr><td style={{ textAlign: 'center', color: 'var(--text-mid)' }}>Run a report to see results.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState('');
  useEffect(() => {
    api.get('/admin/dashboard').then(r => setData(r.data)).catch(e => setErr(e.response?.data?.error || 'Failed'));
  }, []);
  return (
    <div className="col" style={{ gap: 24 }}>
      <h1>Overview</h1>
      {err && <div className="error-banner">{err}</div>}
      {!data ? <div className="card">Loading…</div> : (
        <>
          <div className="grid grid-4">
            <Kpi label="Cards sold today"   value={data.cards_today} />
            <Kpi label="Cards this month"   value={data.cards_this_month} />
            <Kpi label="Cards all-time"     value={data.cards_all_time} />
            <Kpi label="Active memberships" value={data.active_memberships} />
          </div>
          <div className="grid grid-3">
            <Kpi label="Expired memberships" value={data.expired_memberships} />
            <Kpi label="Revenue this month" value={`₹${Number(data.revenue_this_month).toLocaleString('en-IN')}`} />
            <Kpi label="Revenue all-time"   value={`₹${Number(data.revenue_all_time).toLocaleString('en-IN')}`} />
          </div>
          <h2 style={{ marginTop: 12 }}>Top salespersons</h2>
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Cards sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {data.top_salespersons.map(s => (
                <tr key={s.id}><td>{s.full_name || '—'}</td><td className="mono">{s.phone}</td><td>{s.cards_sold}</td><td>₹{Number(s.revenue).toLocaleString('en-IN')}</td></tr>
              ))}
            </tbody>
          </table>
                </>
      )}
    </div>
  );
}
function Kpi({ label, value }) { return <div className="kpi"><h4>{label}</h4><div className="value">{value}</div></div>; }

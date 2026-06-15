import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function SalespersonDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState('');

  useEffect(() => {
    api.get('/salesperson/dashboard').then(r => setData(r.data)).catch(e => setErr(e.response?.data?.error || 'Failed'));
  }, []);

  return (
    <div className="col" style={{ gap: 18 }}>
      <h1>Dashboard</h1>
      {err && <div className="error-banner">{err}</div>}
      {!data ? <div className="card">Loading…</div> : (
        <div className="grid grid-2">
          <Kpi label="Activated today"   value={data.today_count} />
          <Kpi label="Activated this month" value={data.month_count} />
          <Kpi label="Activated total"   value={data.total_count} />
          <Kpi label="Cards in hand"     value={data.unused_assigned} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }) {
  return <div className="kpi"><h4>{label}</h4><div className="value">{value}</div></div>;
}

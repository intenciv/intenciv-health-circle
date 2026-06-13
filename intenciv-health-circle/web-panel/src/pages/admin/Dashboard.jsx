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
            <Kpi label="Total Booklets"      value={data.total_booklets} />
            <Kpi label="Active Coupons"      value={data.active_coupons} />
            <Kpi label="Today's Activations" value={data.today_activations} />
            <Kpi label="Availed Coupons"     value={data.availed_coupons} />
          </div>
          <div className="grid grid-3">
            <Kpi label="Sales Agents"   value={data.agents_count} />
            <Kpi label="Receptionists"  value={data.receptionists_count} />
            <Kpi label="Clients"        value={data.clients_count} />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <h4>{label}</h4>
      <div className="value">{value}</div>
    </div>
  );
}

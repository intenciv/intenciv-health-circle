import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function SalespersonCards() {
  const [cards, setCards] = useState(null);
  const [err, setErr]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/salesperson/my-cards').then(r => setCards(r.data.cards)).catch(e => setErr(e.response?.data?.error || 'Failed'));
  }, []);

  const pending = (cards || []).filter(c => ['unused', 'assigned'].includes(c.status));
  const done    = (cards || []).filter(c => ['active', 'expired'].includes(c.status));

  return (
    <div className="col" style={{ gap: 18 }}>
      <h1>My Cards</h1>
      {err && <div className="error-banner">{err}</div>}
      {!cards ? <div className="card">Loading…</div> : (
        <>
          <h3>Pending activation ({pending.length})</h3>
          {pending.length === 0 && <div className="card">No cards pending activation.</div>}
          {pending.map(c => (
            <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="mono" style={{ fontWeight: 700 }}>{c.card_number}</div>
                <div style={{ color: 'var(--text-mid)', fontSize: 13 }}>{c.plan_name} · ₹{Number(c.plan_price).toLocaleString('en-IN')}</div>
              </div>
              <button onClick={() => navigate(`/salesperson/activate/${c.id}`)}>Activate</button>
            </div>
          ))}

          <h3 style={{ marginTop: 18 }}>Activated by me ({done.length})</h3>
          {done.length === 0 && <div className="card">No activations yet.</div>}
          {done.map(c => (
            <div key={c.id} className="card">
              <div className="between">
                <div className="mono" style={{ fontWeight: 700 }}>{c.card_number}</div>
                <span className={`pill pill-${c.status === 'active' ? 'active' : 'expired'}`}>{c.status.toUpperCase()}</span>
              </div>
              <div className="info-row"><span>Customer</span><span>{c.customer_name || '—'}</span></div>
              <div className="info-row"><span>Phone</span><span className="mono">{c.customer_phone}</span></div>
              <div className="info-row"><span>Activated</span><span>{c.activated_at ? new Date(c.activated_at).toLocaleDateString() : '—'}</span></div>
              <div className="info-row"><span>Expires</span><span>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</span></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

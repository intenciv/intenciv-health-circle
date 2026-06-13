import { useEffect, useState } from 'react';
import { api } from '../../services/api';

const emptyTest = { test_name: '', original_price: '', discounted_price: '' };

export default function Tiers() {
  const [tiers, setTiers]     = useState([]);
  const [err, setErr]         = useState('');
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft]     = useState({ name: '', price: '', description: '', validity_days: 365, tests: [ { ...emptyTest } ] });
  const [saving, setSaving]   = useState(false);

  async function load() {
    try { const { data } = await api.get('/admin/tiers'); setTiers(data.tiers); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load'); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setErr(''); setSaving(true);
    try {
      const payload = {
        name: draft.name,
        price: Number(draft.price),
        description: draft.description,
        validity_days: Number(draft.validity_days) || 365,
        tests: draft.tests.map(t => ({
          test_name: t.test_name,
          original_price: Number(t.original_price),
          discounted_price: Number(t.discounted_price),
        })),
      };
      await api.post('/admin/tiers', payload);
      setShowNew(false);
      setDraft({ name: '', price: '', description: '', validity_days: 365, tests: [ { ...emptyTest } ] });
      load();
    } catch (e) { setErr(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function toggleActive(t) {
    try { await api.put(`/admin/tiers/${t.id}`, { is_active: !t.is_active }); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Update failed'); }
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="between">
        <h1>Tiers & Tests</h1>
        <button onClick={() => setShowNew(true)}>+ New tier</button>
      </div>
      {err && <div className="error-banner">{err}</div>}

      <div className="grid grid-2">
        {tiers.map(t => (
          <div key={t.id} className="card">
            <div className="between">
              <h3>{t.name}</h3>
              <span className={`pill ${t.is_active ? 'pill-active' : 'pill-expired'}`}>{t.is_active ? 'Active' : 'Disabled'}</span>
            </div>
            <p style={{ color: 'var(--text-mid)', margin: '6px 0 12px' }}>{t.description}</p>
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="pill pill-cyan">₹{Number(t.price).toFixed(0)}</span>
              <span style={{ color: 'var(--text-mid)', fontSize: 13 }}>{t.tests.length} tests · {t.validity_days} days</span>
            </div>
            <ul style={{ paddingLeft: 18, color: 'var(--text-dark)' }}>
              {t.tests.map(tt => (
                <li key={tt.id} style={{ fontSize: 14, marginBottom: 4 }}>
                  {tt.test_name} — <span style={{ textDecoration: 'line-through', color: 'var(--text-mid)' }}>₹{Number(tt.original_price).toFixed(0)}</span>{' '}
                  <strong>₹{Number(tt.discounted_price).toFixed(0)}</strong>
                </li>
              ))}
            </ul>
            <button className="secondary" onClick={() => toggleActive(t)} style={{ marginTop: 12 }}>
              {t.is_active ? 'Disable tier' : 'Enable tier'}
            </button>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="dialog-backdrop" onClick={() => setShowNew(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h3>Create new tier</h3>
            <div className="col" style={{ marginTop: 12 }}>
              <input placeholder="Tier name (e.g. Premium)" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              <input placeholder="Price (₹)" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} />
              <input placeholder="Validity days" value={draft.validity_days} onChange={e => setDraft({ ...draft, validity_days: e.target.value })} />
              <textarea placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />

              <h3 style={{ marginTop: 8 }}>Tests</h3>
              {draft.tests.map((t, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <input placeholder="Test name" value={t.test_name} onChange={e => updateTest(draft, setDraft, i, 'test_name', e.target.value)} />
                  <input placeholder="MRP"  value={t.original_price}   onChange={e => updateTest(draft, setDraft, i, 'original_price', e.target.value)} />
                  <input placeholder="Disc" value={t.discounted_price} onChange={e => updateTest(draft, setDraft, i, 'discounted_price', e.target.value)} />
                  <button className="ghost" onClick={() => setDraft({ ...draft, tests: draft.tests.filter((_, idx) => idx !== i) })}>×</button>
                </div>
              ))}
              <button className="secondary" onClick={() => setDraft({ ...draft, tests: [...draft.tests, { ...emptyTest }] })}>+ Add test</button>
            </div>
            <div className="actions">
              <button className="secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button onClick={create} disabled={saving}>{saving ? 'Saving…' : 'Save tier'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function updateTest(draft, setDraft, i, key, value) {
  const tests = [...draft.tests];
  tests[i] = { ...tests[i], [key]: value };
  setDraft({ ...draft, tests });
}

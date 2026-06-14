import { useEffect, useState } from 'react';
import { api } from '../../services/api';

const BENEFIT_TYPES = [
  { v: 'free',    l: 'Free' },
  { v: 'percent', l: '% off' },
  { v: 'amount',  l: '₹ off' },
  { v: 'bogo',    l: 'BOGO' },
];
const emptyBenefit = () => ({ benefit_code: '', name: '', description: '', num_coupons: 1, discount_type: 'percent', discount_value: '', conditions: '' });

export default function Plans() {
  const [plans, setPlans]   = useState([]);
  const [err, setErr]       = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try { const { data } = await api.get('/admin/plans'); setPlans(data.plans); }
    catch (e) { setErr(e.response?.data?.error || 'Failed to load'); }
  }
  useEffect(() => { load(); }, []);

  function newPlan() {
    setEditing({
      _new: true, name: '', description: '', price: 999, validity_days: 365,
      is_corporate: false, corporate_client_name: '', min_card_quantity: 1, is_active: true,
      benefits: [emptyBenefit()],
    });
  }
  function clonePlan(p) { setEditing({ ...p, benefits: (p.benefits || []).map(b => ({ ...b })) }); }

  async function save() {
    setSaving(true); setErr('');
    try {
      const payload = {
        name: editing.name, description: editing.description, price: Number(editing.price),
        validity_days: Number(editing.validity_days),
        is_corporate: !!editing.is_corporate,
        corporate_client_name: editing.is_corporate ? editing.corporate_client_name : null,
        min_card_quantity: Number(editing.min_card_quantity) || 1,
        is_active: !!editing.is_active,
        benefits: editing.benefits.map(b => ({
          benefit_code: (b.benefit_code || '').toUpperCase(),
          name: b.name, description: b.description,
          num_coupons: Number(b.num_coupons) || 1,
          discount_type: b.discount_type || 'percent',
          discount_value: ['free', 'bogo'].includes(b.discount_type) ? null : Number(b.discount_value) || 0,
          conditions: b.conditions || null,
        })),
      };
      if (editing._new) await api.post('/admin/plans', payload);
      else              await api.put(`/admin/plans/${editing.id}`, payload);
      setEditing(null); load();
    } catch (e) { setErr(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="between">
        <h1>Plans &amp; Benefits</h1>
        <button onClick={newPlan}>+ New plan</button>
      </div>
      {err && <div className="error-banner">{err}</div>}

      <div className="grid grid-2">
        {plans.map(p => (
          <div key={p.id} className="card">
            <div className="between">
              <div>
                <h3>{p.name}</h3>
                {p.is_corporate && <span className="pill pill-cyan" style={{ marginTop: 4 }}>Corporate · {p.corporate_client_name || '—'}</span>}
              </div>
              <span className={`pill ${p.is_active ? 'pill-active' : 'pill-expired'}`}>{p.is_active ? 'Active' : 'Disabled'}</span>
            </div>
            <p style={{ color: 'var(--text-mid)', margin: '6px 0 12px' }}>{p.description}</p>
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="pill pill-cyan">₹{Number(p.price).toFixed(0)}</span>
              <span style={{ color: 'var(--text-mid)', fontSize: 13 }}>{p.benefits.length} benefits · {p.validity_days} days</span>
            </div>
            <ul style={{ paddingLeft: 18, color: 'var(--text-dark)', fontSize: 13 }}>
              {p.benefits.map(b => (
                <li key={b.id} style={{ marginBottom: 4 }}>
                  <span className="mono" style={{ color: 'var(--mid-blue)' }}>{b.benefit_code}</span> · {b.name} — <strong>×{b.num_coupons}</strong> ({b.discount_type === 'percent' ? `${b.discount_value}% off` : b.discount_type === 'amount' ? `₹${b.discount_value} off` : b.discount_type.toUpperCase()})
                </li>
              ))}
            </ul>
            <button className="secondary" onClick={() => clonePlan(p)} style={{ marginTop: 12 }}>Edit plan</button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="dialog-backdrop" onClick={() => setEditing(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, maxHeight: '90vh', overflow: 'auto' }}>
            <h3>{editing._new ? 'Create plan' : `Edit "${editing.name}"`}</h3>
            <div className="grid grid-2" style={{ marginTop: 12, gap: 12 }}>
              <div><label className="label">Plan name</label><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label className="label">Price (₹)</label><input type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} /></div>
              <div><label className="label">Validity (days)</label><input type="number" value={editing.validity_days} onChange={e => setEditing({ ...editing, validity_days: e.target.value })} /></div>
              <div><label className="label">Min quantity</label><input type="number" value={editing.min_card_quantity} onChange={e => setEditing({ ...editing, min_card_quantity: e.target.value })} /></div>
            </div>
            <label className="label">Description</label>
            <textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            <label className="row" style={{ gap: 8, marginTop: 12 }}>
              <input type="checkbox" checked={!!editing.is_corporate} onChange={e => setEditing({ ...editing, is_corporate: e.target.checked })} style={{ width: 18, height: 18 }} />
              <span>This is a corporate plan</span>
            </label>
            {editing.is_corporate && (
              <>
                <label className="label">Corporate client name</label>
                <input value={editing.corporate_client_name || ''} onChange={e => setEditing({ ...editing, corporate_client_name: e.target.value })} placeholder="e.g. Acme Corp." />
              </>
            )}

            <h3 style={{ marginTop: 18 }}>Benefits</h3>
            <p style={{ color: 'var(--text-mid)', fontSize: 12, marginBottom: 8 }}>
              Benefit code (2 letters) is used in coupon codes — e.g. HC, HM, VC, BG, SE, IC, MT, IS.
            </p>
            {editing.benefits.map((b, i) => (
              <div key={i} className="card" style={{ padding: 14, marginBottom: 10, background: 'var(--surface-blue)', boxShadow: 'none' }}>
                <div className="grid grid-2" style={{ gap: 8 }}>
                  <div><label className="label">Code</label><input maxLength={4} value={b.benefit_code} onChange={e => setBen(editing, setEditing, i, 'benefit_code', e.target.value.toUpperCase())} /></div>
                  <div><label className="label">Name</label><input value={b.name} onChange={e => setBen(editing, setEditing, i, 'name', e.target.value)} /></div>
                  <div><label className="label"># Coupons</label><input type="number" min={1} value={b.num_coupons} onChange={e => setBen(editing, setEditing, i, 'num_coupons', e.target.value)} /></div>
                  <div>
                    <label className="label">Discount type</label>
                    <select value={b.discount_type} onChange={e => setBen(editing, setEditing, i, 'discount_type', e.target.value)}>
                      {BENEFIT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                  {!['free', 'bogo'].includes(b.discount_type) && (
                    <div><label className="label">Discount value</label><input type="number" value={b.discount_value ?? ''} onChange={e => setBen(editing, setEditing, i, 'discount_value', e.target.value)} /></div>
                  )}
                </div>
                <label className="label">Description</label>
                <input value={b.description || ''} onChange={e => setBen(editing, setEditing, i, 'description', e.target.value)} />
                <label className="label">Terms / conditions</label>
                <textarea value={b.conditions || ''} onChange={e => setBen(editing, setEditing, i, 'conditions', e.target.value)} style={{ minHeight: 60 }} />
                <button className="ghost" onClick={() => setEditing({ ...editing, benefits: editing.benefits.filter((_, x) => x !== i) })} style={{ marginTop: 8 }}>Remove benefit</button>
              </div>
            ))}
            <button className="secondary" onClick={() => setEditing({ ...editing, benefits: [...editing.benefits, emptyBenefit()] })}>+ Add benefit</button>

            <div className="actions">
              <button className="secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button onClick={save} disabled={saving || !editing.name || !editing.price || editing.benefits.length === 0}>{saving ? 'Saving…' : 'Save plan'}</button>
            </div>
            <p style={{ color: 'var(--warning-amber)', fontSize: 12, marginTop: 8 }}>
              Changes apply to <strong>new cards only</strong>. Already-activated cards keep their existing coupons.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
function setBen(editing, setEditing, i, k, v) {
  const benefits = [...editing.benefits];
  benefits[i] = { ...benefits[i], [k]: v };
  setEditing({ ...editing, benefits });
}

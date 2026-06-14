import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export default function Offers() {
  const [list, setList] = useState([]);
  const [err, setErr]   = useState('');
  const [open, setOpen] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try { const { data } = await api.get('/admin/offers'); setList(data.offers); }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true); setErr('');
    try {
      const body = {
        title: open.title, subtitle: open.subtitle || null,
        image_url: open.image_url || null, link_url: open.link_url || null,
        sort_order: Number(open.sort_order || 0), is_active: !!open.is_active,
      };
      if (open._new) await api.post('/admin/offers', body);
      else           await api.put(`/admin/offers/${open.id}`, body);
      setOpen(null); load();
    } catch (e) { setErr(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }
  async function remove(o) {
    if (!confirm(`Remove offer "${o.title}"?`)) return;
    try { await api.delete(`/admin/offers/${o.id}`); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Delete failed'); }
  }

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="between">
        <h1>Home-screen Offers</h1>
        <button onClick={() => setOpen({ _new: true, title: '', subtitle: '', image_url: '', link_url: '', sort_order: 0, is_active: true })}>+ New offer</button>
      </div>
      {err && <div className="error-banner">{err}</div>}
      <p style={{ color: 'var(--text-mid)' }}>These banners appear on the customer mobile app home screen, horizontally scrollable.</p>

      <div className="grid grid-3">
        {list.map(o => (
          <div key={o.id} className="card">
            {o.image_url ? <img src={o.image_url} alt={o.title} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} /> : <div style={{ height: 140, background: 'var(--light-blue-bg)', borderRadius: 8, marginBottom: 10 }} />}
            <div className="between">
              <h3 style={{ fontSize: 16 }}>{o.title}</h3>
              <span className={`pill ${o.is_active ? 'pill-active' : 'pill-expired'}`}>{o.is_active ? 'Live' : 'Hidden'}</span>
            </div>
            {o.subtitle && <p style={{ color: 'var(--text-mid)', fontSize: 13, marginTop: 4 }}>{o.subtitle}</p>}
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              <button className="secondary" onClick={() => setOpen({ ...o })}>Edit</button>
              <button className="danger"    onClick={() => remove(o)}>Delete</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="card">No offers yet — create one above.</div>}
      </div>

      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>{open._new ? 'New offer' : 'Edit offer'}</h3>
            <label className="label">Title</label>
            <input value={open.title} onChange={e => setOpen({ ...open, title: e.target.value })} />
            <label className="label">Subtitle</label>
            <input value={open.subtitle || ''} onChange={e => setOpen({ ...open, subtitle: e.target.value })} />
            <label className="label">Image URL (1200×600 looks best)</label>
            <input value={open.image_url || ''} onChange={e => setOpen({ ...open, image_url: e.target.value })} placeholder="https://…" />
            <label className="label">Link URL (tap target)</label>
            <input value={open.link_url || ''} onChange={e => setOpen({ ...open, link_url: e.target.value })} placeholder="https://www.intenciv.in/…" />
            <label className="label">Sort order (lower shows first)</label>
            <input type="number" value={open.sort_order || 0} onChange={e => setOpen({ ...open, sort_order: e.target.value })} />
            <label className="row" style={{ gap: 8, marginTop: 12 }}>
              <input type="checkbox" checked={!!open.is_active} onChange={e => setOpen({ ...open, is_active: e.target.checked })} style={{ width: 18, height: 18 }} />
              <span>Visible to customers</span>
            </label>
            <div className="actions">
              <button className="secondary" onClick={() => setOpen(null)}>Cancel</button>
              <button onClick={save} disabled={saving || !open.title}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

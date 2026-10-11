import React, { useEffect, useState } from 'react';
import { SLOT_ICONS } from '@peps/shared';
import { api } from '../api.js';
import { PageHead } from './Overview.jsx';

const blank = () => ({ title: { en: '', fr: '' }, subtitle: { en: '', fr: '' }, code: '', symbol: '' });

// Rewards entered once and picked by any game. Each game sets its own probability.
export default function Library() {
  const [items, setItems] = useState(null); const [editing, setEditing] = useState(null); const [note, setNote] = useState(''); const [q, setQ] = useState('');
  const load = () => api.library().then(setItems);
  useEffect(() => { load(); }, []);
  const doImport = async () => { const r = await api.importLibrary(); setNote(r.created || r.linked ? `Imported ${r.created} reward${r.created === 1 ? '' : 's'} from your games and linked ${r.linked} game reward${r.linked === 1 ? '' : 's'} to them.` : 'Nothing to import — every game reward is already in the library.'); load(); };
  // games using it keep the reward as their own (same code and odds), so nothing breaks
  const remove = async (x) => {
    const names = [...new Set(x.games.map((g) => `${g.game} · ${g.store}`))];
    const used = x.used_in ? `\n\n${x.used_in} game${x.used_in === 1 ? ' uses' : 's use'} it (${names.slice(0, 3).join(', ')}${names.length > 3 ? `, +${names.length - 3} more` : ''}). ${x.used_in === 1 ? 'That game keeps it as its' : 'Those games keep it as their'} own reward with the same code and odds — remove it from a game in its Rewards tab.` : '';
    if (!confirm(`Delete "${x.title.en}" from the library?${used}`)) return false;
    try {
      const r = await api.deleteLibrary(x.id);
      setNote(`Deleted "${x.title.en}" from the library.${r?.games_unlinked ? ` ${r.games_unlinked} game reward${r.games_unlinked === 1 ? '' : 's'} kept as custom reward${r.games_unlinked === 1 ? '' : 's'}.` : ''}`);
      setEditing(null); load(); return true;
    } catch (e) { setNote(e.message); return false; }
  };
  const list = (items || []).filter((x) => !q || `${x.title.en} ${x.title.fr} ${x.code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Rewards library" sub="Enter each reward once, then add it to any game from the game's Rewards tab. Editing a reward here updates every game that uses it."
        actions={<><button className="ghost" onClick={doImport}>Import from my games</button><button className="primary" onClick={() => setEditing('new')}>+ New reward</button></>} />
      {note && <div className="alert info">{note}</div>}
      {editing === 'new' && <LibForm onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {items && items.length > 0 && (
        <div className="toolbar"><div className="search"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" /></svg>
          <input placeholder="Search rewards or codes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search rewards" /></div>
          <span className="muted push">{items.length} reward{items.length === 1 ? '' : 's'}</span></div>
      )}
      <div className="lib-grid">
        {list.map((x) => editing === x.id
          ? <LibForm key={x.id} item={x} onDelete={() => remove(x)} onCancel={() => setEditing(null)} onSaved={(r) => { setEditing(null); setNote(r?.games_updated ? `Saved — ${r.games_updated} game reward${r.games_updated === 1 ? '' : 's'} updated.` : 'Saved.'); load(); }} />
          : (
            <article key={x.id} className="card lib-card">
              <div className="lib-top">
                <span className="lib-icon" aria-hidden="true">{x.symbol || '🎁'}</span>
                <div className="lib-text"><b>{x.title.en}</b>{x.title.fr && <span className="muted small">{x.title.fr}</span>}</div>
              </div>
              {x.subtitle?.en && <p className="muted small">{x.subtitle.en}</p>}
              <div className="lib-meta"><code>{x.code}</code><span className="muted small">{x.used_in ? `Used in ${x.used_in} game${x.used_in === 1 ? '' : 's'}` : 'Not used yet'}</span></div>
              {x.used_in > 0 && <p className="muted small lib-games">{x.games.map((g) => `${g.game} · ${g.store}`).join(', ')}</p>}
              <div className="lib-actions"><button className="ghost small danger" onClick={() => remove(x)}>Delete</button><button className="ghost small" onClick={() => setEditing(x.id)}>Edit</button></div>
            </article>
          ))}
      </div>
      {items && !items.length && editing !== 'new' && (
        <div className="card empty-state"><b>No rewards in the library yet</b>
          <p className="muted">Create one, or import the rewards you've already set up in your games.</p>
          <div className="row"><button className="ghost" onClick={doImport}>Import from my games</button><button className="primary" onClick={() => setEditing('new')}>+ New reward</button></div></div>
      )}
    </>
  );
}

function LibForm({ item, onCancel, onSaved, onDelete }) {
  const [f, setF] = useState(item ? { title: { ...item.title }, subtitle: { en: '', fr: '', ...item.subtitle }, code: item.code, symbol: item.symbol || '' } : blank());
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const setL = (k, l) => (e) => setF({ ...f, [k]: { ...f[k], [l]: e.target.value } });
  async function save(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = item ? await api.updateLibrary(item.id, f) : await api.createLibrary(f); onSaved(r); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  return (
    <form className="card lib-form" onSubmit={save}>
      <h2>{item ? 'Edit reward' : 'New reward'}</h2>
      {item?.used_in > 0 && <div className="alert info">Changes apply to the {item.used_in} game{item.used_in === 1 ? '' : 's'} using this reward.</div>}
      <div className="form-grid">
        <label>Title (English)<input value={f.title.en} onChange={setL('title', 'en')} placeholder="Free Retatrutide" autoFocus /></label>
        <label>Title (French)<input value={f.title.fr} onChange={setL('title', 'fr')} placeholder="Retatrutide gratuit" /></label>
        <label>Subtitle (English) <input value={f.subtitle.en} onChange={setL('subtitle', 'en')} placeholder="One vial on us" /></label>
        <label>Subtitle (French)<input value={f.subtitle.fr} onChange={setL('subtitle', 'fr')} placeholder="Une fiole offerte" /></label>
        <label>Discount code<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="FREERETA" />
          <span className="help">Must already exist in your discount app.</span></label>
        <label>Slot machine icon<select value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })}>
          <option value="">Auto</option>{SLOT_ICONS.map((x) => <option key={x.key} value={x.glyph}>{x.glyph} {x.label}</option>)}</select>
          <span className="help">Used when this reward is on a slot machine.</span></label>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="form-actions">
        <button className="primary" disabled={busy}>{item ? 'Save changes' : 'Add to library'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        {item && <button type="button" className="danger push" onClick={onDelete}>Delete…</button>}
      </div>
    </form>
  );
}

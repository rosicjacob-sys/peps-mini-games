import React, { useEffect, useState } from 'react';
import { api, hasToken, logout, WIDGET_URL } from './api.js';
import { GAME_TYPES, CATEGORIES, categoryOf, themeFor } from '@peps/shared';
import GameEditor from './GameEditor.jsx';
import Overview, { PageHead } from './pages/Overview.jsx';
import Players from './pages/Players.jsx';
import Delivery from './pages/Delivery.jsx';
import Library from './pages/Library.jsx';
import { FiltersProvider, useFilters } from './filters.jsx';
import { fmtInt } from './format.js';

// tiny hash router: #/overview, #/players, #/delivery, #/games, #/games/<id>, #/stores, #/groups
const parse = () => { const [, name = 'overview', id] = location.hash.split('/'); return { name, id }; };
const NAV = [
  { key: 'overview', label: 'Overview', icon: 'M3 13h4v5H3zM8.5 8h4v10h-4zM14 3h4v15h-4z' },
  { key: 'players', label: 'Players', icon: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 18c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5' },
  { key: 'delivery', label: 'Email delivery', icon: 'M2.5 5h15v10h-15zM2.5 5.5 10 11l7.5-5.5' },
  { section: 'Setup' },
  { key: 'games', label: 'Games', icon: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM10 6v8M6 10h8' },
  { key: 'rewards', label: 'Rewards library', icon: 'M3 8h14v9H3zM2 5h16v3H2zM10 5v12M10 5c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1' },
  { key: 'stores', label: 'Stores', icon: 'M3 8l1.5-4.5h11L17 8M3 8v9h14V8M3 8h14M8 17v-5h4v5' },
  { key: 'groups', label: 'Store groups', icon: 'M3 5h6v5H3zM11 5h6v5h-6zM7 12h6v5H7z' },
];

function useTheme() {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('pg_theme') || 'system'; } catch { return 'system'; } });
  useEffect(() => {
    if (mode === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('pg_theme', mode); } catch {}
  }, [mode]);
  return [mode, setMode];
}

export default function App() {
  const [authed, setAuthed] = useState(hasToken());
  const [route, setRoute] = useState(parse());
  const [extra, setExtra] = useState({});
  const [mode, setMode] = useTheme();
  const [menu, setMenu] = useState(false);
  useEffect(() => { const h = () => { setRoute(parse()); setMenu(false); window.scrollTo(0, 0); }; addEventListener('hashchange', h); return () => removeEventListener('hashchange', h); }, []);
  const go = (name, more = {}) => { setExtra(more); location.hash = `#/${name}`; };
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const active = route.name === 'games' ? 'games' : route.name;
  return (
    <FiltersProvider>
      <div className="shell">
        <aside className={`sidebar ${menu ? 'open' : ''}`}>
          <div className="brand"><span className="logo" aria-hidden="true">♠</span><div><b>Mini Games</b><small>Admin</small></div>
            <button className="ghost icon menu-btn" aria-label="Menu" onClick={() => setMenu(!menu)}>☰</button></div>
          <nav>
            {NAV.map((n, i) => n.section ? <div key={i} className="nav-section">{n.section}</div> : (
              <a key={n.key} href={`#/${n.key}`} className={active === n.key ? 'on' : ''} aria-current={active === n.key ? 'page' : undefined}>
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d={n.icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>{n.label}
              </a>
            ))}
          </nav>
          <div className="side-foot">
            <div className="segmented small" role="group" aria-label="Theme">
              {[['light', 'Light'], ['system', 'Auto'], ['dark', 'Dark']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            <button className="link" onClick={logout}>Log out</button>
          </div>
        </aside>
        <main className="main">
          {route.name === 'overview' && <Overview go={go} />}
          {route.name === 'players' && <Players key={extra.reward_id || ''} initial={extra} clearInitial={() => setExtra({})} />}
          {route.name === 'delivery' && <Delivery />}
          {route.name === 'games' && !route.id && <Games open={(id) => (location.hash = `#/games/${id}`)} />}
          {route.name === 'games' && route.id && <GameEditor id={route.id} back={() => (location.hash = '#/games')} />}
          {route.name === 'stores' && <Stores />}
          {route.name === 'groups' && <Groups />}
          {route.name === 'rewards' && <Library />}
        </main>
      </div>
    </FiltersProvider>
  );
}

function Login({ onDone }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  return (
    <form className="login card" onSubmit={async (e) => { e.preventDefault(); try { await api.login(pw); onDone(); } catch { setErr('Wrong password'); } }}>
      <span className="logo big" aria-hidden="true">♠</span>
      <h1>Mini Games</h1><p className="muted">Sign in to the admin dashboard</p>
      <input type="password" autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="primary">Log in</button>
    </form>
  );
}

function Games({ open }) {
  const f = useFilters();
  const [games, setGames] = useState(null); const [stores, setStores] = useState([]);
  const [form, setForm] = useState({ store_id: '', type: 'wheel' }); const [err, setErr] = useState(''); const [q, setQ] = useState('');
  const load = () => { api.games().then(setGames); api.stores().then((s) => { setStores(s); setForm((x) => ({ ...x, store_id: x.store_id || s[0]?.id || '' })); }); };
  useEffect(load, []);
  async function create(e) {
    e.preventDefault(); setErr('');
    try { const g = await api.createGame({ ...form, name: GAME_TYPES[form.type].label }); f.reloadLists(); open(g.id); } catch (e2) { setErr(e2.message); }
  }
  async function toggle(g) {
    await api.updateGame(g.id, { ...g, status: g.status === 'active' ? 'paused' : 'active' }); load(); f.reloadLists();
  }
  const list = (games || []).filter((g) => !q || `${g.name} ${g.store_name} ${g.group_name || ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Games" sub="Every game on every store. Open one to edit rewards, odds, copy and look." />
      {stores.length === 0 && games && <div className="alert info">Create a store first (Stores), then add games to it.</div>}
      {stores.length > 0 && (
        <form className="card toolbar-card" onSubmit={create}>
          <label>Store<select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Game type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(CATEGORIES).map(([c, cat]) => (
              <optgroup key={c} label={`${cat.icon} ${cat.label.en}`}>
                {Object.entries(GAME_TYPES).filter(([, v]) => v.category === c).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </optgroup>
            ))}</select></label>
          <button className="primary">+ New game</button>{err && <span className="error">{err}</span>}
          <div className="search push"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" /></svg><input placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search games" /></div>
        </form>
      )}
      {Object.entries(CATEGORIES).map(([c, cat]) => {
        const inCat = list.filter((g) => categoryOf(g.type) === c);
        if (!inCat.length) return null;
        return (
          <section key={c} className="game-section">
            <h2 className="section-title"><span aria-hidden="true">{cat.icon}</span> {cat.label.en} games <span className="muted small">{cat.blurb}</span></h2>
            <div className="game-grid">
        {inCat.map((g) => {
          const th = themeFor(g.type, g.theme);
          return (
            <article key={g.id} className="game-card">
              <button className="gc-main" onClick={() => open(g.id)}>
                <span className="gc-swatch" style={th.grad ? { background: `linear-gradient(135deg, ${th.grad[0]}, ${th.grad[1]})`, borderColor: '#fff' } : { background: `radial-gradient(circle at 30% 30%, ${th.surface}, ${th.bg})`, borderColor: th.rim || th.border }}>
                  <span style={{ color: th.grad ? '#fff' : th.rim || th.accent }}>{GAME_TYPES[g.type]?.icon}</span>
                </span>
                <span className="gc-text">
                  <b>{g.name}</b>
                  <span className="muted small">{GAME_TYPES[g.type]?.label} · {th.label}</span>
                  <span className="small">{g.store_name}{g.group_name ? <span className="muted"> · {g.group_name}</span> : null}</span>
                </span>
              </button>
              <div className="gc-foot">
                <span><b>{fmtInt(g.play_count)}</b> <span className="muted small">plays all time</span></span>
                <label className="switch" title={g.status === 'active' ? 'Live on the store. Click to pause' : 'Paused. Click to make live'}>
                  <input type="checkbox" checked={g.status === 'active'} onChange={() => toggle(g)} />
                  <span className="track" /><span className="small">{g.status === 'active' ? 'Live' : 'Paused'}</span>
                </label>
              </div>
            </article>
          );
        })}
        {games && !list.length && <p className="muted">No games{q ? ' match' : ' yet'}.</p>}
      </div>
          </section>
        );
      })}
    </>
  );
}

function Stores() {
  const f = useFilters();
  const [stores, setStores] = useState(null); const [groups, setGroups] = useState([]);
  const [adding, setAdding] = useState(false);
  const load = () => { api.stores().then(setStores); api.groups().then(setGroups); f.reloadLists(); };
  useEffect(() => { load(); }, []);
  return (
    <>
      <PageHead title="Stores" sub="Your Shopify stores. Install each one once, then manage its games from Games."
        actions={!adding && <button className="primary" onClick={() => setAdding(true)}>+ Add store</button>} />
      {adding && <StoreForm groups={groups} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      <div className="store-list">
        {stores?.map((s) => <StoreCard key={s.id} s={s} groups={groups} reload={load} />)}
        {stores && !stores.length && !adding && (
          <div className="card empty-state"><b>No stores yet</b><p className="muted">Add your first store to get its install code.</p>
            <button className="primary" onClick={() => setAdding(true)}>+ Add store</button></div>
        )}
      </div>
    </>
  );
}

// Add / edit a store. "Allowed origins" is shown as the store's website address(es).
function StoreForm({ s, groups, onCancel, onSaved, onDelete }) {
  const [name, setName] = useState(s?.name || ''); const [groupId, setGroupId] = useState(s?.group_id || '');
  const [sites, setSites] = useState((s?.allowed_origins || []).join('\n')); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault(); if (!name.trim()) return setErr('Give the store a name.');
    const list = sites.split(/[\n,\s]+/).map((x) => x.trim()).filter(Boolean).map((x) => (/^https?:\/\//.test(x) ? x : `https://${x}`).replace(/\/+$/, ''));
    setBusy(true); setErr('');
    try { const body = { name: name.trim(), group_id: groupId || null, allowed_origins: list }; s ? await api.updateStore(s.id, body) : await api.createStore(body); onSaved(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  return (
    <form className="card store-form" onSubmit={save}>
      {!s && <h2>New store</h2>}
      <div className="form-grid">
        <label>Store name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lexar Canada" autoFocus={!s} /></label>
        <label>Store group<select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">No group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <span className="help">Code emails use the group's sender address. <a href="#/groups">Manage groups</a></span></label>
        <label className="span-2"><span>Store website <span className="optional">optional</span></span>
          <textarea rows="2" value={sites} onChange={(e) => setSites(e.target.value)} placeholder="https://lexarcanada.ca" />
          <span className="help">Only these addresses can load the games. This stops other sites copying your install code. Add one per line (include the www. version if your store uses it). Leave empty while testing.</span></label>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="form-actions">
        <button className="primary" disabled={busy}>{s ? 'Save changes' : 'Create store'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        {onDelete && <button type="button" className="danger push" onClick={onDelete}>Delete store…</button>}
      </div>
    </form>
  );
}

function StoreCard({ s, groups, reload }) {
  const [mode, setMode] = useState(null); // null | 'edit' | 'install'
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${WIDGET_URL}" data-store="${s.public_key}" data-locale="{{ request.locale.iso_code }}" charset="utf-8" defer></script>`;
  const copy = () => navigator.clipboard?.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  const del = async () => { if (confirm(`Delete "${s.name}"? Its ${s.game_count} game(s), rewards and play history will be removed. This cannot be undone.`)) { await api.deleteStore(s.id); reload(); } };
  return (
    <article className="card store-card">
      <div className="store-head">
        <div className="store-id">
          <span className="store-avatar" aria-hidden="true">{s.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h2>{s.name}</h2>
            <div className="store-meta">
              {s.group_name ? <span className="pill">{s.group_name}</span> : <span className="pill">No group</span>}
              <span>{s.game_count} game{s.game_count === 1 ? '' : 's'}</span>
              <span className="muted">{s.allowed_origins.length ? s.allowed_origins.join(', ') : 'Any website (not locked)'}</span>
            </div>
          </div>
        </div>
        <div className="store-actions">
          <button className={mode === 'install' ? 'primary' : ''} onClick={() => setMode(mode === 'install' ? null : 'install')}>Install on Shopify</button>
          <button className="ghost" onClick={() => setMode(mode === 'edit' ? null : 'edit')}>{mode === 'edit' ? 'Close' : 'Edit'}</button>
        </div>
      </div>
      {mode === 'install' && (
        <div className="install">
          <ol className="steps-list">
            <li><b>Copy the install code</b>
              <div className="snippet"><code>{snippet}</code><button className="primary small" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button></div></li>
            <li><b>Open the theme code in Shopify</b><span className="muted">Online Store → Themes → ⋯ (next to your theme) → Edit code</span></li>
            <li><b>Paste it into <code>layout/theme.liquid</code></b><span className="muted">just above the closing <code>&lt;/body&gt;</code> tag, then Save. Do this once: game changes made here go live automatically.</span></li>
          </ol>
        </div>
      )}
      {mode === 'edit' && <StoreForm s={s} groups={groups} onCancel={() => setMode(null)} onSaved={() => { setMode(null); reload(); }} onDelete={del} />}
    </article>
  );
}

// Store groups: Lexar, Can Peps, Peps USA… Each holds the default Resend sender for its stores' games.
function Groups() {
  const [groups, setGroups] = useState([]); const [name, setName] = useState('');
  const load = () => api.groups().then(setGroups); useEffect(() => { load(); }, []);
  return (
    <>
      <PageHead title="Store groups" sub="Group your stores (e.g. Lexar, Can Peps, Peps USA). A group's From address is used by every game in its stores unless the game sets its own. Each From domain must be verified in Resend." />
      <form className="card row" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await api.createGroup({ name }); setName(''); load(); }}>
        <label>Group name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lexar" /></label><button className="primary">+ Add group</button>
      </form>
      {groups.map((g) => <GroupCard key={g.id} g={g} reload={load} />)}
      {!groups.length && <p className="muted">No groups yet.</p>}
    </>
  );
}

function GroupCard({ g, reload }) {
  const [f, setF] = useState({ name: g.name, from_name: g.from_name, from_email: g.from_email, reply_to: g.reply_to }); const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="card">
      <div className="row">
        <label className="grow">Name<input value={f.name} onChange={set('name')} /></label>
        <span className="muted">{g.store_count} store{g.store_count === 1 ? '' : 's'}</span>
      </div>
      <h3>Default sender for code emails</h3>
      <div className="row">
        <label className="grow">From name<input value={f.from_name} onChange={set('from_name')} placeholder="Lexar Canada" /></label>
        <label className="grow">From email<input type="email" value={f.from_email} onChange={set('from_email')} placeholder="rewards@yourdomain.com" /></label>
        <label className="grow">Reply-to<input type="email" value={f.reply_to} onChange={set('reply_to')} /></label>
      </div>
      <div className="row">
        <button className="primary" onClick={async () => { await api.updateGroup(g.id, f); setMsg('Saved'); reload(); }}>Save</button>
        <button className="danger" onClick={async () => { if (confirm(`Delete group "${g.name}"? Its stores are kept and become ungrouped.`)) { await api.deleteGroup(g.id); reload(); } }}>Delete</button>
        <span className="good">{msg}</span>
      </div>
    </div>
  );
}

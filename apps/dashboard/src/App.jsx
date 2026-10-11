import React, { useEffect, useState } from 'react';
import { api, hasToken, logout, WIDGET_URL } from './api.js';
import { GAME_TYPES, themeFor } from '@peps/shared';
import GameEditor from './GameEditor.jsx';
import Overview, { PageHead } from './pages/Overview.jsx';
import Players from './pages/Players.jsx';
import Delivery from './pages/Delivery.jsx';
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
          <label>Game type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(GAME_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <button className="primary">+ New game</button>{err && <span className="error">{err}</span>}
          <div className="search push"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" /></svg><input placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search games" /></div>
        </form>
      )}
      <div className="game-grid">
        {list.map((g) => {
          const th = themeFor(g.type, g.theme);
          return (
            <article key={g.id} className="game-card">
              <button className="gc-main" onClick={() => open(g.id)}>
                <span className="gc-swatch" style={{ background: `radial-gradient(circle at 30% 30%, ${th.surface}, ${th.bg})`, borderColor: th.rim || th.border }}>
                  <span style={{ color: th.rim || th.accent }}>{GAME_TYPES[g.type]?.icon}</span>
                </span>
                <span className="gc-text">
                  <b>{g.name}</b>
                  <span className="muted small">{GAME_TYPES[g.type]?.label} · {th.label}</span>
                  <span className="small">{g.store_name}{g.group_name ? <span className="muted"> · {g.group_name}</span> : null}</span>
                </span>
              </button>
              <div className="gc-foot">
                <span><b>{fmtInt(g.play_count)}</b> <span className="muted small">plays all time</span></span>
                <label className="switch" title={g.status === 'active' ? 'Live on the store — click to pause' : 'Paused — click to make live'}>
                  <input type="checkbox" checked={g.status === 'active'} onChange={() => toggle(g)} />
                  <span className="track" /><span className="small">{g.status === 'active' ? 'Live' : 'Paused'}</span>
                </label>
              </div>
            </article>
          );
        })}
        {games && !list.length && <p className="muted">No games{q ? ' match' : ' yet'}.</p>}
      </div>
    </>
  );
}

function Stores() {
  const [stores, setStores] = useState([]); const [groups, setGroups] = useState([]); const [name, setName] = useState('');
  const load = () => { api.stores().then(setStores); api.groups().then(setGroups); }; useEffect(() => { load(); }, []);
  return (
    <>
      <PageHead title="Stores" sub="Each store gets a script snippet for its theme and belongs to a store group." />
      <form className="card row" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await api.createStore({ name, allowed_origins: [] }); setName(''); load(); }}>
        <label>Store name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lexar Canada" /></label><button className="primary">+ Add store</button>
      </form>
      {stores.map((s) => <StoreCard key={s.id} s={s} groups={groups} reload={load} />)}
    </>
  );
}

function StoreCard({ s, groups, reload }) {
  const [name, setName] = useState(s.name); const [origins, setOrigins] = useState(s.allowed_origins.join('\n')); const [groupId, setGroupId] = useState(s.group_id || ''); const [msg, setMsg] = useState('');
  const snippet = `<script src="${WIDGET_URL}" data-store="${s.public_key}" data-locale="{{ request.locale.iso_code }}" charset="utf-8" defer></script>`;
  return (
    <div className="card">
      <div className="row">
        <label className="grow">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Store group<select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">— none —</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      </div>
      <label>Allowed origins <span className="muted">(one per line, e.g. https://lexarcanada.ca — leave empty to allow any)</span>
        <textarea rows="2" value={origins} onChange={(e) => setOrigins(e.target.value)} /></label>
      <div className="row">
        <button className="primary" onClick={async () => { await api.updateStore(s.id, { name, allowed_origins: origins.split('\n'), group_id: groupId || null }); setMsg('Saved'); reload(); }}>Save</button>
        <button className="danger" onClick={async () => { if (confirm(`Delete ${s.name} and all its games, rewards and players?`)) { await api.deleteStore(s.id); reload(); } }}>Delete</button>
        <span className="muted">{msg}</span>
      </div>
      <p className="muted">Paste in <code>theme.liquid</code> just before <code>&lt;/body&gt;</code>:</p>
      <pre onClick={(e) => navigator.clipboard?.writeText(snippet)} title="Click to copy">{snippet}</pre>
    </div>
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

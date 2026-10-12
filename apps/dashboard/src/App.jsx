import React, { useEffect, useRef, useState } from 'react';
import { api, hasToken, logout, WIDGET_URL, BASE } from './api.js';
import { GAME_TYPES, CATEGORIES, categoryOf, gameTheme } from '@peps/shared';
import GameEditor from './GameEditor.jsx';
import IntroEditor from './IntroEditor.jsx';
import Overview, { PageHead } from './pages/Overview.jsx';
import Players from './pages/Players.jsx';
import Reminders from './pages/Reminders.jsx';
import Library from './pages/Library.jsx';
import { FiltersProvider, useFilters } from './filters.jsx';
import { fmtInt, fmtDateShort } from './format.js';

// tiny hash router: #/overview, #/players, #/delivery, #/games, #/games/<id>, #/preview/<id>, #/stores, #/groups
const parse = () => { const [, name = 'overview', id] = location.hash.split('/'); return { name, id }; };
const NAV = [
  { key: 'overview', label: 'Overview', icon: 'M3 13h4v5H3zM8.5 8h4v10h-4zM14 3h4v15h-4z' },
  { key: 'players', label: 'Players', icon: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 18c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5' },
  { key: 'delivery', label: 'Reminder emails', icon: 'M2.5 5h15v10h-15zM2.5 5.5 10 11l7.5-5.5' },
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
  // a page with unsaved changes can register a guard; leaving asks first and stays put on "cancel"
  const guard = useRef(null); const last = useRef(location.hash); const restoring = useRef(false);
  const setGuard = (fn) => { guard.current = fn; };
  useEffect(() => {
    const h = () => {
      if (restoring.current) { restoring.current = false; return; }
      if (guard.current && !guard.current()) { restoring.current = true; location.hash = last.current; return; }
      guard.current = null; last.current = location.hash;
      setRoute(parse()); setMenu(false); window.scrollTo(0, 0);
    };
    addEventListener('hashchange', h); return () => removeEventListener('hashchange', h);
  }, []);
  const go = (name, more = {}) => { setExtra(more); location.hash = `#/${name}`; };
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const active = route.name === 'preview' ? 'games' : route.name;
  const known = ['overview', 'players', 'delivery', 'games', 'preview', 'stores', 'groups', 'rewards'];
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
          {route.name === 'delivery' && <Reminders />}
          {route.name === 'games' && !route.id && <Games open={(id) => (location.hash = `#/games/${id}`)} />}
          {route.name === 'games' && route.id && <GameEditor id={route.id} back={() => (location.hash = '#/games')} setGuard={setGuard} />}
          {route.name === 'preview' && route.id && <Preview id={route.id} />}
          {route.name === 'stores' && <Stores />}
          {route.name === 'groups' && <Groups />}
          {route.name === 'rewards' && <Library />}
          {!known.includes(route.name) && <div className="card empty-state"><b>Page not found</b><p className="muted">There is nothing at {location.hash}.</p><a className="primary btn-link" href="#/overview">Go to Overview</a></div>}
        </main>
      </div>
    </FiltersProvider>
  );
}

function Login({ onDone }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  return (
    <form className="login card" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await api.login(pw); onDone(); } catch (e2) { setErr(e2.message === 'bad_password' ? 'Wrong password' : e2.message); } finally { setBusy(false); } }}>
      <span className="logo big" aria-hidden="true">♠</span>
      <h1>Mini Games</h1><p className="muted">Sign in to the admin dashboard</p>
      <input type="password" autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="primary" disabled={busy}>Log in</button>
    </form>
  );
}

// what still stops a game from being playable, in one line
function readiness(g) {
  const out = [];
  if (g.status === 'active' && !g.reward_count) out.push(['failed', 'No rewards: hidden on the stores']);
  if (!g.store_count) out.push(['failed', 'Its group has no stores']);
  if (g.status === 'paused') out.push(['paused', 'Paused']);
  return out;
}

function Games({ open }) {
  const f = useFilters();
  const [games, setGames] = useState(null); const [groups, setGroups] = useState([]); const [err, setErr] = useState('');
  const [form, setForm] = useState({ group_id: '', type: 'wheel' }); const [q, setQ] = useState(''); const [showArchived, setShowArchived] = useState(false);
  const load = () => Promise.all([api.games({ archived: 1 }), api.groups()]).then(([gs, grs]) => { setGames(gs); setGroups(grs); setForm((x) => ({ ...x, group_id: x.group_id || grs[0]?.id || '' })); setErr(''); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  async function create(e) {
    e.preventDefault(); setErr('');
    try { const g = await api.createGame({ ...form, name: GAME_TYPES[form.type].label }); f.reloadLists(); open(g.id); } catch (e2) { setErr(e2.message); }
  }
  async function toggle(g) {
    try { await api.updateGame(g.id, { ...g, status: g.status === 'active' ? 'paused' : 'active' }); load(); f.reloadLists(); } catch (e2) { setErr(e2.message); }
  }
  async function restore(g) { try { await api.restoreGame(g.id); load(); f.reloadLists(); } catch (e2) { setErr(e2.message); } }
  const all = (games || []).filter((g) => !q || `${g.name} ${g.group_name || ''}`.toLowerCase().includes(q.toLowerCase()));
  const list = all.filter((g) => !g.archived_at); const archived = all.filter((g) => g.archived_at);
  return (
    <>
      <PageHead title="Games" sub="Games are set up per store group: every store in the group shows them, so a new store needs no setup. Open a game to edit rewards, odds, copy and look." />
      {err && <div className="alert bad">{err}</div>}
      {groups.length === 0 && games && <div className="alert info">Create a store group first (<a href="#/groups">Store groups</a>), then add games to it.</div>}
      {groups.length > 0 && (
        <form className="card toolbar-card" onSubmit={create}>
          <label>Store group<select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.store_count} store{g.store_count === 1 ? '' : 's'})</option>)}</select></label>
          <label>Game type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(CATEGORIES).map(([c, cat]) => (
              <optgroup key={c} label={`${cat.icon} ${cat.label.en}`}>
                {Object.entries(GAME_TYPES).filter(([, v]) => v.category === c).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </optgroup>
            ))}</select></label>
          <button className="primary">+ New game</button>
          <div className="search push"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" /></svg><input placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search games" /></div>
        </form>
      )}
      {!games && !err && <div className="loading">Loading…</div>}
      {Object.entries(CATEGORIES).map(([c, cat]) => {
        const inCat = list.filter((g) => categoryOf(g.type) === c);
        if (!inCat.length) return null;
        return (
          <section key={c} className="game-section">
            <h2 className="section-title"><span aria-hidden="true">{cat.icon}</span> {cat.label.en} games <span className="muted small">{cat.blurb}</span></h2>
            <div className="game-grid">
              {inCat.map((g) => <GameCard key={g.id} g={g} open={open} toggle={toggle} />)}
            </div>
          </section>
        );
      })}
      {games && !list.length && <p className="muted">No games{q ? ' match' : ' yet'}.</p>}
      {archived.length > 0 && (
        <section className="game-section archived-section">
          <h2 className="section-title"><button className="link" onClick={() => setShowArchived(!showArchived)}>{showArchived ? '▾' : '▸'} Archived games ({archived.length})</button> <span className="muted small">Hidden on the stores; their plays stay in the reports.</span></h2>
          {showArchived && <div className="game-grid">{archived.map((g) => <GameCard key={g.id} g={g} open={open} restore={restore} />)}</div>}
        </section>
      )}
    </>
  );
}

function GameCard({ g, open, toggle, restore }) {
  const th = gameTheme(g);
  return (
    <article className={`game-card ${g.archived_at ? 'archived' : ''}`}>
      <button className="gc-main" onClick={() => open(g.id)}>
        <span className="gc-swatch" style={th.grad ? { background: `linear-gradient(135deg, ${th.grad[0]}, ${th.grad[1]})`, borderColor: '#fff' } : { background: `radial-gradient(circle at 30% 30%, ${th.surface}, ${th.bg})`, borderColor: th.rim || th.border }}>
          <span style={{ color: th.grad ? '#fff' : th.rim || th.accent }}>{GAME_TYPES[g.type]?.icon}</span>
        </span>
        <span className="gc-text">
          <b>{g.name}</b>
          <span className="muted small">{GAME_TYPES[g.type]?.label} · {th.label}</span>
          <span className="small">{g.group_name}<span className="muted"> · {g.store_count} store{g.store_count === 1 ? '' : 's'}</span></span>
          {!g.archived_at && readiness(g).map(([k, txt]) => <span key={txt} className={`pill ${k}`}>{txt}</span>)}
          {g.archived_at && <span className="pill">Archived {fmtDateShort(g.archived_at)}</span>}
        </span>
      </button>
      <div className="gc-foot">
        <span><b>{fmtInt(g.play_count)}</b> <span className="muted small">plays all time</span></span>
        {g.archived_at ? <button className="ghost small" onClick={() => restore(g)}>Restore</button> : (
          <label className="switch" title={g.status === 'active' ? 'Live on the store. Click to pause' : 'Paused. Click to make live'}>
            <input type="checkbox" checked={g.status === 'active'} onChange={() => toggle(g)} />
            <span className="track" /><span className="small">{g.status === 'active' ? 'Live' : 'Paused'}</span>
          </label>
        )}
      </div>
    </article>
  );
}

// The game as visitors see it, in the real widget, with a token that records nothing. The widget runs in an
// iframe so it can be thrown away on leaving, and the page behind it plays the part of the store's homepage.
function Preview({ id }) {
  const [game, setGame] = useState(null); const [token, setToken] = useState(''); const [err, setErr] = useState(''); const [n, setN] = useState(0);
  useEffect(() => { Promise.all([api.game(id), api.previewGame(id)]).then(([g, p]) => { setGame(g); setToken(p.token); }).catch((e) => setErr(e.message)); }, [id]);
  const doc = token ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;min-height:100vh;background:#f3f1ec;font-family:system-ui,sans-serif;color:#777;display:grid;place-items:center}p{max-width:420px;text-align:center;line-height:1.5;padding:0 20px}</style></head><body><p>This page stands in for the store's homepage. The popup opens the way it does for a first-time visitor; the floating button in the corner opens the game any time. Plays here are never recorded, and any email works.</p><script src="${WIDGET_URL}" data-preview="${token}" data-api="${BASE}" defer></script></body></html>` : '';
  return (
    <>
      <div className="page-head preview-head">
        <div><a className="link back" href={`#/games/${id}`}>← Back to {game ? game.name : 'the game'}</a><h1>Preview{game ? `: ${game.name}` : ''}</h1>
          <p className="muted">Exactly what visitors get, from the live widget. Nothing is recorded: play as often as you like with any email.{game?.status === 'paused' && ' The game is paused, so only this preview shows it.'}</p></div>
        <div className="page-actions"><button className="ghost" onClick={() => setN(n + 1)}>Start again</button></div>
      </div>
      {err && <div className="alert bad">{err}</div>}
      {doc ? <iframe key={n} className="preview-frame" title="Game preview" srcDoc={doc} /> : !err && <div className="loading">Loading…</div>}
    </>
  );
}

function Stores() {
  const f = useFilters();
  const [stores, setStores] = useState(null); const [groups, setGroups] = useState([]); const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false); const [showArchived, setShowArchived] = useState(false);
  const load = () => Promise.all([api.stores(), api.groups()]).then(([s, g]) => { setStores(s); setGroups(g); setErr(''); f.reloadLists(); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const live = (stores || []).filter((s) => !s.archived_at); const archived = (stores || []).filter((s) => s.archived_at);
  return (
    <>
      <PageHead title="Stores" sub="Your Shopify stores. A store shows the games of its store group, so adding a store needs no game setup: pick its group, add its website, paste the install line."
        actions={!adding && <button className="primary" onClick={() => setAdding(true)}>+ Add store</button>} />
      {err && <div className="alert bad">{err}</div>}
      {adding && <StoreForm groups={groups} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {!stores && !err && <div className="loading">Loading…</div>}
      <div className="store-list">
        {live.map((s) => <StoreCard key={s.id} s={s} groups={groups} reload={load} onError={setErr} />)}
        {stores && !live.length && !adding && (
          <div className="card empty-state"><b>No stores yet</b><p className="muted">Add your first store to get its install line.</p>
            <button className="primary" onClick={() => setAdding(true)}>+ Add store</button></div>
        )}
      </div>
      {archived.length > 0 && (
        <section className="archived-section">
          <h2 className="section-title"><button className="link" onClick={() => setShowArchived(!showArchived)}>{showArchived ? '▾' : '▸'} Archived stores ({archived.length})</button> <span className="muted small">They show no games; their plays stay in the reports.</span></h2>
          {showArchived && <div className="store-list">{archived.map((s) => <StoreCard key={s.id} s={s} groups={groups} reload={load} onError={setErr} />)}</div>}
        </section>
      )}
    </>
  );
}

// Add / edit a store. One website (the homepage) plus optional other addresses it answers at.
function StoreForm({ s, groups, onCancel, onSaved }) {
  const primary = s?.site_url || s?.allowed_origins?.[0] || '';
  const twin = (o) => { try { const u = new URL(o); return `${u.protocol}//${u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`}`; } catch { return ''; } };
  const [name, setName] = useState(s?.name || ''); const [groupId, setGroupId] = useState(s?.group_id || '');
  const [website, setWebsite] = useState(primary);
  const [aliases, setAliases] = useState((s?.allowed_origins || []).filter((o) => o !== primary && o !== twin(primary)).filter((o, i, a) => a.indexOf(twin(o)) === -1 || a.indexOf(twin(o)) > i).join('\n'));
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  // brand colours: detected from the website (auto) or picked by hand (manual)
  const [col, setCol] = useState({ mode: 'auto', main: '', second: '', ...(s?.colors || {}) }); const [detecting, setDetecting] = useState(false);
  const pick = (k) => (e) => setCol({ ...col, mode: 'manual', [k]: e.target.value });
  async function redetect() {
    setDetecting(true); setErr('');
    try { const r = await api.detectStoreColors(s.id); setCol({ mode: 'auto', main: '', second: '', ...r }); } catch (e2) { setErr(e2.message); } finally { setDetecting(false); }
  }
  async function save(e) {
    e.preventDefault(); if (!name.trim()) return setErr('Give the store a name.');
    setBusy(true); setErr('');
    const colors = col.mode === 'manual' && col.main ? { mode: 'manual', main: col.main, second: col.second || '' } : { mode: 'auto' };
    try { const body = { name: name.trim(), group_id: groupId || null, website: website.trim(), aliases: aliases.split(/[\n,\s]+/).map((x) => x.trim()).filter(Boolean), colors }; s ? await api.updateStore(s.id, body) : await api.createStore(body); onSaved(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  return (
    <form className="card store-form" onSubmit={save}>
      {!s && <h2>New store</h2>}
      <div className="form-grid">
        <label>Store name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lexar Canada" autoFocus={!s} /></label>
        <label>Store group<select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">No group (no games)</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <span className="help">The store shows its group's games and popup, and uses the group's sender address. <a href="#/groups">Manage groups</a></span></label>
        <label className="span-2"><span>Website</span>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://lexarcanada.ca" />
          <span className="help">The store's homepage. The install line recognises the store by it, the reminder email's "Play now" button opens it, and its brand colours are read from it. With or without www.: both are accepted.</span></label>
        <label className="span-2"><span>Also answers at <span className="optional">optional</span></span>
          <textarea rows="2" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="https://shop.lexarcanada.ca" />
          <span className="help">Other addresses this store is reached at (a second domain, a market subdomain), one per line. Each address can belong to one store.</span></label>
        {s && (
          <div className="span-2 brand-block">
            <span>Brand colours <span className="optional">for arcade games set to "Match my website"</span></span>
            <div className="brand-colours">
              <label className="inline">Main<input type="color" value={col.main || '#7b3ff2'} onChange={pick('main')} /></label>
              <label className="inline">Second<input type="color" value={col.second || col.main || '#7b3ff2'} onChange={pick('second')} /></label>
              <span className="muted small">{col.mode === 'manual' ? 'Set by hand.' : col.main ? `Detected from ${col.from || 'the website'}.` : col.error ? `Not detected: ${col.error}` : 'Not detected yet; they are read from the website automatically.'}</span>
              <button type="button" className="ghost small" disabled={detecting} onClick={redetect}>{detecting ? 'Reading the website…' : 'Detect again'}</button>
              {col.mode === 'manual' && <button type="button" className="link" onClick={() => setCol({ ...col, mode: 'auto' })}>Use the detected colours</button>}
            </div>
          </div>
        )}
      </div>
      {err && <p className="error">{err}</p>}
      <div className="form-actions">
        <button className="primary" disabled={busy}>{s ? 'Save changes' : 'Create store'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// The install line is the same for every store: the widget is recognised by the store's website.
const SHARED_LINE = `<script src="${WIDGET_URL}" data-locale="{{ request.locale.iso_code }}" charset="utf-8" defer></script>`;
function CopyLine({ line }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(line).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  return <div className="snippet"><code>{line}</code><button className="primary small" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button></div>;
}

// Install: the line, where it goes, then a live check of the store's website that lists what stops the games from
// showing, with the fix.
function InstallPanel({ s }) {
  const [r, setR] = useState(null); const [err, setErr] = useState(''); const [running, setRunning] = useState(false);
  // stores without a website listed need the store's own key in the line
  const keyed = `<script src="${WIDGET_URL}" data-store="${s.public_key}" data-locale="{{ request.locale.iso_code }}" charset="utf-8" defer></script>`;
  const run = () => { setR(null); setErr(''); setRunning(true); api.checkStore(s.id).then(setR).catch((e) => setErr(e.message)).finally(() => setRunning(false)); };
  useEffect(run, [s.id]);
  return (
    <div className="install">
      <ol className="steps-list">
        <li><b>Copy the install line</b>
          {s.allowed_origins.length ? <CopyLine line={SHARED_LINE} /> : (
            <><span className="muted">This store has no website listed, so it needs its own line (with its key). Or add its website (Edit) and use the shared line.</span><CopyLine line={keyed} /></>
          )}</li>
        <li><b>Paste it into <code>layout/theme.liquid</code></b><span className="muted">Shopify → Online Store → Themes → ⋯ (next to the live theme) → Edit code, just above the closing <code>&lt;/body&gt;</code> tag, then Save. Once per store: game changes made here go live by themselves.</span></li>
        <li><b>Check it</b>
          <div className="install-check">
            {running && <p className="muted">Opening {s.site_url || s.allowed_origins[0] || 'the website'}…</p>}
            {err && <p className="error">{err}</p>}
            {r && (
              <>
                <p className={r.ok ? 'good' : 'bad'}><b>{r.ok ? 'All good: the games show on this store.' : 'Something stops the games from showing:'}</b>{r.url && <span className="muted small"> ({r.url})</span>}</p>
                <ul className="check-list">
                  {r.checks.map((c, i) => <li key={i} className={c.ok ? 'ok' : 'no'}><span aria-hidden="true">{c.ok ? '✓' : '✕'}</span><div><b>{c.label}</b>{c.fix && <p className="muted small">{c.fix}</p>}</div></li>)}
                </ul>
                {r.ok && <p className="muted small">Still nothing on the site? Look for the button in the bottom-right corner, then reload the page with the cache cleared (Ctrl+Shift+R, or Cmd+Shift+R on a Mac): browsers keep the widget for up to 5 minutes.</p>}
              </>
            )}
            <div><button className="ghost small" disabled={running} onClick={run}>Check again</button></div>
          </div></li>
      </ol>
    </div>
  );
}

function StoreCard({ s, groups, reload, onError }) {
  const [mode, setMode] = useState(null); // null | 'edit' | 'install'
  const live = s.games.filter((g) => g.status === 'active');
  const archived = !!s.archived_at;
  const act = (fn) => fn().then(reload).catch((e) => onError(e.message));
  const archive = () => confirm(`Archive "${s.name}"? Its games stop showing on its website; its play history stays in the reports. You can restore it later.`) && act(() => api.archiveStore(s.id));
  const destroy = () => confirm(`Delete "${s.name}" permanently, with every play recorded on it? This cannot be undone.`) && act(() => api.deleteStore(s.id));
  return (
    <article className={`card store-card ${archived ? 'archived' : ''}`}>
      <div className="store-head">
        <div className="store-id">
          <span className="store-avatar" aria-hidden="true">{s.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h2>{s.name}</h2>
            <div className="store-meta">
              {archived && <span className="pill">Archived {fmtDateShort(s.archived_at)}</span>}
              {s.group_name ? <span className="pill">{s.group_name}</span> : <span className="pill failed">No group: no games show</span>}
              <span className="muted">{s.site_url || s.allowed_origins[0] || 'No website listed'}{s.allowed_origins.length > 2 && <span className="small"> +{s.allowed_origins.length - 2} more</span>}</span>
              {s.colors?.main && <span className="brand-colours" title="Brand colours (for arcade games set to match the website)"><i className="sw" style={{ background: s.colors.main }} />{s.colors.second && <i className="sw" style={{ background: s.colors.second }} />}</span>}
            </div>
            {!archived && (
              <div className="store-games">
                {s.group_name && (live.length
                  ? <><span className="muted small">Shows {live.length} game{live.length === 1 ? '' : 's'} from {s.group_name}:</span> {live.map((g) => <span key={g.id} className={`pill ${g.rewards ? '' : 'failed'}`} title={g.rewards ? '' : 'No rewards yet, so it is hidden on the site'}>{GAME_TYPES[g.type]?.icon} {g.name}{g.rewards ? '' : ' (no rewards: hidden)'}</span>)}</>
                  : <span className="muted small">{s.group_name} has no live games yet. Add them on the <a href="#/games">Games</a> page.</span>)}
              </div>
            )}
          </div>
        </div>
        <div className="store-actions">
          {archived ? <><button onClick={() => act(() => api.restoreStore(s.id))}>Restore</button><button className="danger" onClick={destroy}>Delete permanently…</button></> : (
            <>
              <button className={mode === 'install' ? 'primary' : ''} onClick={() => setMode(mode === 'install' ? null : 'install')}>Install & check</button>
              <button className="ghost" onClick={() => setMode(mode === 'edit' ? null : 'edit')}>{mode === 'edit' ? 'Close' : 'Edit'}</button>
            </>
          )}
        </div>
      </div>
      {mode === 'install' && <InstallPanel s={s} />}
      {mode === 'edit' && (
        <>
          <StoreForm s={s} groups={groups} onCancel={() => setMode(null)} onSaved={() => { setMode(null); reload(); }} />
          <div className="store-form danger-zone"><span className="muted small">Done with this store? Archiving hides it and keeps its history.</span><button type="button" className="danger" onClick={archive}>Archive store…</button></div>
        </>
      )}
    </article>
  );
}

// Store groups: Lexar, Can Peps, Peps USA… Each holds the default sender for its games' reminder emails and the
// "Play to Win" popup its stores show.
function Groups() {
  const [groups, setGroups] = useState(null); const [name, setName] = useState(''); const [err, setErr] = useState('');
  const load = () => api.groups().then((g) => { setGroups(g); setErr(''); }).catch((e) => setErr(e.message)); useEffect(() => { load(); }, []);
  return (
    <>
      <PageHead title="Store groups" sub="Group your stores (e.g. Lexar, Can Peps, Peps USA). Games and the 'Play to Win' popup are set up per group: every store in a group shows them. A group's From address is used by its games' reminder emails unless a game sets its own." />
      {err && <div className="alert bad">{err}</div>}
      <form className="card row" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; try { await api.createGroup({ name }); setName(''); load(); } catch (e2) { setErr(e2.message); } }}>
        <label>Group name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lexar" /></label><button className="primary">+ Add group</button>
      </form>
      {groups?.map((g) => <GroupCard key={g.id} g={g} reload={load} />)}
      {!groups && !err && <div className="loading">Loading…</div>}
      {groups && !groups.length && <p className="muted">No groups yet.</p>}
    </>
  );
}

function GroupCard({ g, reload }) {
  const [f, setF] = useState({ name: g.name, from_name: g.from_name, from_email: g.from_email, reply_to: g.reply_to, intro: g.intro || {} });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [tab, setTab] = useState('sender'); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify({ name: g.name, from_name: g.from_name, from_email: g.from_email, reply_to: g.reply_to, intro: g.intro || {} });
  async function save() { setBusy(true); setErr(''); setMsg(''); try { await api.updateGroup(g.id, f); setMsg('Saved'); reload(); setTimeout(() => setMsg(''), 2500); } catch (e) { setErr(e.message); } finally { setBusy(false); } }
  return (
    <div className="card">
      <div className="row">
        <label className="grow">Name<input value={f.name} onChange={set('name')} /></label>
        <span className="muted">{g.store_count} store{g.store_count === 1 ? '' : 's'} · {g.game_count} game{g.game_count === 1 ? '' : 's'}</span>
      </div>
      <div className="tabs small">
        <button className={tab === 'sender' ? 'on' : ''} onClick={() => setTab('sender')}>Reminder email sender</button>
        <button className={tab === 'intro' ? 'on' : ''} onClick={() => setTab('intro')}>"Play to Win" popup{f.intro?.enabled === false && <span className="muted small"> (off)</span>}</button>
      </div>
      {tab === 'sender' && (
        <>
          <p className="muted small">Default sender for the weekly reminder emails of this group's games (a game can set its own). The From domain must be verified in Resend.</p>
          <div className="row">
            <label className="grow">From name<input value={f.from_name} onChange={set('from_name')} placeholder="Lexar Canada" /></label>
            <label className="grow">From email<input type="email" value={f.from_email} onChange={set('from_email')} placeholder="rewards@yourdomain.com" /></label>
            <label className="grow">Reply-to<input type="email" value={f.reply_to} onChange={set('reply_to')} /></label>
          </div>
        </>
      )}
      {tab === 'intro' && <IntroEditor value={f.intro} onChange={(v) => setF({ ...f, intro: v })} />}
      <div className="row savebar-inline">
        <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="danger" onClick={async () => { if (confirm(`Delete group "${g.name}"? Its stores are kept and become ungrouped (they show no games until they join another group).`)) { try { await api.deleteGroup(g.id); reload(); } catch (e) { setErr(e.message); } } }}>Delete</button>
        {dirty && !msg && <span className="unsaved">● Unsaved changes</span>}
        <span className="good">{msg}</span><span className="error">{err}</span>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { api, hasToken, logout, WIDGET_URL } from './api.js';
import { GAME_TYPES } from '@peps/shared';
import GameEditor from './GameEditor.jsx';

export default function App() {
  const [authed, setAuthed] = useState(hasToken());
  const [view, setView] = useState({ name: 'games' });
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <div className="app">
      <header>
        <strong>🎲 Mini Games</strong>
        <nav>
          <button className={view.name === 'games' || view.name === 'game' ? 'on' : ''} onClick={() => setView({ name: 'games' })}>Games</button>
          <button className={view.name === 'stores' ? 'on' : ''} onClick={() => setView({ name: 'stores' })}>Stores</button>
        </nav>
        <button className="link" onClick={logout}>Log out</button>
      </header>
      <main>
        {view.name === 'games' && <Games open={(id) => setView({ name: 'game', id })} />}
        {view.name === 'game' && <GameEditor id={view.id} back={() => setView({ name: 'games' })} />}
        {view.name === 'stores' && <Stores />}
      </main>
    </div>
  );
}

function Login({ onDone }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  return (
    <form className="login card" onSubmit={async (e) => { e.preventDefault(); try { await api.login(pw); onDone(); } catch { setErr('Wrong password'); } }}>
      <h1>Mini Games Dashboard</h1>
      <input type="password" autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="primary">Log in</button>
    </form>
  );
}

function Games({ open }) {
  const [games, setGames] = useState(null); const [stores, setStores] = useState([]);
  const [form, setForm] = useState({ store_id: '', type: 'wheel' }); const [err, setErr] = useState('');
  const load = () => { api.games().then(setGames); api.stores().then((s) => { setStores(s); setForm((f) => ({ ...f, store_id: f.store_id || s[0]?.id || '' })); }); };
  useEffect(load, []);
  async function create(e) {
    e.preventDefault(); setErr('');
    try { const g = await api.createGame({ ...form, name: GAME_TYPES[form.type].label }); open(g.id); } catch (e2) { setErr(e2.message); }
  }
  return (
    <>
      <h1>Games</h1>
      {stores.length === 0 && games && <p className="card">Create a store first (Stores tab), then add games to it.</p>}
      {stores.length > 0 && (
        <form className="card row" onSubmit={create}>
          <label>Store<select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Game<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(GAME_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <button className="primary">+ New game</button>{err && <span className="error">{err}</span>}
        </form>
      )}
      <table className="card">
        <thead><tr><th>Game</th><th>Store</th><th>Status</th><th className="num">Plays</th></tr></thead>
        <tbody>
          {(games || []).map((g) => (
            <tr key={g.id} className="click" onClick={() => open(g.id)}>
              <td>{g.name} <span className="muted">· {GAME_TYPES[g.type]?.label}</span></td><td>{g.store_name}</td>
              <td><span className={`pill ${g.status}`}>{g.status}</span></td><td className="num">{g.play_count}</td>
            </tr>
          ))}
          {games?.length === 0 && <tr><td colSpan="4" className="muted">No games yet.</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function Stores() {
  const [stores, setStores] = useState([]); const [name, setName] = useState('');
  const load = () => api.stores().then(setStores); useEffect(() => { load(); }, []);
  return (
    <>
      <h1>Stores</h1>
      <form className="card row" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await api.createStore({ name, allowed_origins: [] }); setName(''); load(); }}>
        <label>Store name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lexar Canada" /></label><button className="primary">+ Add store</button>
      </form>
      {stores.map((s) => <StoreCard key={s.id} s={s} reload={load} />)}
    </>
  );
}

function StoreCard({ s, reload }) {
  const [name, setName] = useState(s.name); const [origins, setOrigins] = useState(s.allowed_origins.join('\n')); const [msg, setMsg] = useState('');
  const snippet = `<script src="${WIDGET_URL}" data-store="${s.public_key}" data-locale="{{ request.locale.iso_code }}" charset="utf-8" defer></script>`;
  return (
    <div className="card">
      <div className="row"><label className="grow">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label></div>
      <label>Allowed origins <span className="muted">(one per line, e.g. https://lexarcanada.ca — leave empty to allow any)</span>
        <textarea rows="2" value={origins} onChange={(e) => setOrigins(e.target.value)} /></label>
      <div className="row">
        <button className="primary" onClick={async () => { await api.updateStore(s.id, { name, allowed_origins: origins.split('\n') }); setMsg('Saved'); reload(); }}>Save</button>
        <button className="danger" onClick={async () => { if (confirm(`Delete ${s.name} and all its games, rewards and players?`)) { await api.deleteStore(s.id); reload(); } }}>Delete</button>
        <span className="muted">{msg}</span>
      </div>
      <p className="muted">Paste in <code>theme.liquid</code> just before <code>&lt;/body&gt;</code>:</p>
      <pre onClick={(e) => navigator.clipboard?.writeText(snippet)} title="Click to copy">{snippet}</pre>
    </div>
  );
}

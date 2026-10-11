import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { GAME_TYPES, THEMES, themeFor, t } from '@peps/shared';

const TABS = ['Rewards', 'Players', 'Appearance', 'Texts & Email'];
const blankReward = () => ({ title: { en: '', fr: '' }, subtitle: { en: '', fr: '' }, code: '', probability: 0, active: true });

export default function GameEditor({ id, back }) {
  const [game, setGame] = useState(null); const [tab, setTab] = useState('Rewards');
  const load = () => api.game(id).then(setGame); useEffect(() => { load(); }, [id]);
  if (!game) return <p>Loading…</p>;
  return (
    <>
      <button className="link" onClick={back}>← All games</button>
      <h1>{game.name} <span className="muted">· {game.store_name} · {GAME_TYPES[game.type]?.label}</span></h1>
      <div className="tabs">{TABS.map((x) => <button key={x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>
      {tab === 'Rewards' && <Rewards game={game} reload={load} />}
      {tab === 'Players' && <Players game={game} />}
      {tab === 'Appearance' && <Settings game={game} reload={load} section="appearance" />}
      {tab === 'Texts & Email' && <Settings game={game} reload={load} section="texts" back={back} />}
    </>
  );
}

const Loc = ({ label, value, onChange, ph, rows }) => (
  <div className="loc">
    {['en', 'fr'].map((l) => (
      <label key={l}>{label} <span className="tag">{l.toUpperCase()}</span>
        {rows ? <textarea rows={rows} value={value?.[l] || ''} placeholder={ph} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />
          : <input value={value?.[l] || ''} placeholder={ph} onChange={(e) => onChange({ ...value, [l]: e.target.value })} />}
      </label>
    ))}
  </div>
);

function Rewards({ game, reload }) {
  const [rows, setRows] = useState(game.rewards.map((r) => ({ ...r, probability: Number(r.probability) })));
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const total = useMemo(() => rows.filter((r) => r.active).reduce((s, r) => s + (Number(r.probability) || 0), 0), [rows]);
  const set = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const ok = Math.abs(total - 100) < 0.01;
  function equalise() {
    const n = rows.filter((r) => r.active).length;
    if (!n) return;
    const cents = Math.floor(10000 / n); const extra = 10000 - cents * n; let seen = 0; // leftover cents go to the first rewards
    setRows(rows.map((r) => (r.active ? { ...r, probability: (cents + (seen++ < extra ? 1 : 0)) / 100 } : r)));
  }
  async function save() {
    setErr(''); setMsg('');
    try { const saved = await api.saveRewards(game.id, rows); setRows(saved.map((r) => ({ ...r, probability: Number(r.probability) }))); setMsg('Saved — live on the store now.'); reload(); } catch (e) { setErr(e.message); }
  }
  return (
    <>
      <p className="muted">Each play, the server picks {game.rewards_per_play} reward{game.rewards_per_play > 1 ? 's' : ''} using these probabilities. Active rewards must add up to 100%. Codes must already exist in your discount app.</p>
      {rows.map((r, i) => (
        <div key={r.id || i} className={`card reward-row ${r.active ? '' : 'off'}`}>
          <Loc label="Title" value={r.title} onChange={(v) => set(i, { title: v })} ph="Free Reta" />
          <Loc label="Subtitle" value={r.subtitle} onChange={(v) => set(i, { subtitle: v })} ph="One vial on us" />
          <div className="row">
            <label>Code<input value={r.code} onChange={(e) => set(i, { code: e.target.value })} placeholder="FREERETA" /></label>
            <label>Probability %<input className="num-in" type="number" min="0" max="100" step="0.5" value={r.probability} onChange={(e) => set(i, { probability: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} /> Active</label>
            <button className="danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </div>
      ))}
      <div className="row sticky">
        <button onClick={() => setRows([...rows, blankReward()])}>+ Add reward</button>
        <button onClick={equalise}>Split evenly</button>
        <strong className={ok ? 'good' : 'bad'}>Total: {total.toFixed(2)}%</strong>
        <button className="primary" disabled={!ok && rows.some((r) => r.active)} onClick={save}>Save rewards</button>
        <span className="good">{msg}</span><span className="error">{err}</span>
      </div>
    </>
  );
}

function Players({ game }) {
  const [stats, setStats] = useState(null); const [filter, setFilter] = useState(null); const [plays, setPlays] = useState([]);
  useEffect(() => { api.stats(game.id).then(setStats); }, [game.id]);
  useEffect(() => { api.plays(game.id, filter?.id).then(setPlays); }, [game.id, filter]);
  if (!stats) return <p>Loading…</p>;
  const max = Math.max(1, ...stats.tally.map((x) => x.won));
  return (
    <>
      <div className="stats">
        <div className="card stat"><b>{stats.plays}</b><span>Total plays</span></div>
        <div className="card stat"><b>{stats.players}</b><span>Unique emails</span></div>
        <div className="card stat"><b>{stats.plays_7d}</b><span>Plays, last 7 days</span></div>
        <div className="card stat"><b className={stats.email_failed ? 'bad' : ''}>{stats.email_failed}</b><span>Emails not delivered</span></div>
      </div>
      <h3>Rewards won</h3>
      <table className="card">
        <thead><tr><th>Reward</th><th>Code</th><th className="num">Won</th><th></th><th></th></tr></thead>
        <tbody>
          {stats.tally.map((r) => (
            <tr key={r.reward_id || r.code} className={filter?.id === r.reward_id ? 'sel' : ''}>
              <td>{t(r.title, 'en')}</td><td><code>{r.code}</code></td>
              <td className="num">{r.won}</td><td className="barcell"><div className="bar" style={{ width: `${(r.won / max) * 100}%` }} /></td>
              <td className="num"><button className="link" onClick={() => setFilter(filter?.id === r.reward_id ? null : { id: r.reward_id, title: t(r.title, 'en') })}>{filter?.id === r.reward_id ? 'Show all' : 'Show emails'}</button></td>
            </tr>
          ))}
          {!stats.tally.length && <tr><td colSpan="5" className="muted">No plays yet.</td></tr>}
        </tbody>
      </table>
      <div className="row between"><h3>{filter ? `Emails — ${filter.title}` : 'Recent plays'}</h3>
        <button className="primary" onClick={() => api.download(game.id, filter?.id)}>Export CSV{filter ? ` (${filter.title})` : ''}</button></div>
      <table className="card">
        <thead><tr><th>Email</th><th>Reward</th><th>Code</th><th>Played (ET)</th><th>Email</th></tr></thead>
        <tbody>
          {plays.map((p) => (
            <tr key={p.id + p.code}><td>{p.email}</td><td>{t(p.title, 'en')}</td><td><code>{p.code}</code></td>
              <td>{new Date(p.created_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</td>
              <td><span className={`pill ${p.email_status}`}>{p.email_status}</span></td></tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Showing up to 100 most recent. The CSV contains everything.</p>
    </>
  );
}

function Settings({ game, reload, section, back }) {
  const [g, setG] = useState({ ...game, texts: { heading: {}, subheading: {}, privacy: {}, triggerLabel: {}, privacyUrl: '', ...game.texts } });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const fixed = GAME_TYPES[g.type]?.fixedTheme;
  const setT = (k, v) => setG({ ...g, texts: { ...g.texts, [k]: v } });
  async function save() {
    setErr(''); setMsg('');
    try { await api.updateGame(g.id, g); setMsg('Saved'); reload(); } catch (e) { setErr(e.message); }
  }
  const th = themeFor(g.type, g.theme);
  return (
    <div className="card form">
      {section === 'appearance' && (
        <>
          <div className="row">
            <label>Status<select value={g.status} onChange={(e) => setG({ ...g, status: e.target.value })}><option value="active">Active (visible on store)</option><option value="paused">Paused (hidden)</option></select></label>
            <label>Rewards per play<input className="num-in" type="number" min="1" max="5" value={g.rewards_per_play} onChange={(e) => setG({ ...g, rewards_per_play: e.target.value })} /></label>
            <label className="grow">Internal name<input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></label>
          </div>
          <h3>Colour theme</h3>
          {fixed ? <p className="muted">Blackjack keeps its signature purple theme.</p> : (
            <>
              <div className="themes">
                {Object.entries(THEMES).filter(([, v]) => !v.locked).map(([k, v]) => (
                  <button key={k} className={`swatch ${g.theme === k ? 'on' : ''}`} onClick={() => setG({ ...g, theme: k })} style={{ background: v.bg, color: v.text, borderColor: v.border }}>
                    <i style={{ background: v.accent }} /><i style={{ background: v.slices[1] }} /><span>{v.label}</span>
                  </button>
                ))}
              </div>
              <div className="row">
                <label>Brand accent colour <span className="muted">(optional — buttons & pointer)</span>
                  <input type="color" value={g.brand_accent || th.accent} onChange={(e) => setG({ ...g, brand_accent: e.target.value })} /></label>
                {g.brand_accent && <button className="link" onClick={() => setG({ ...g, brand_accent: null })}>Reset to neutral</button>}
              </div>
            </>
          )}
          <div className="preview" style={{ background: th.bg, color: th.text, borderColor: th.border }}>
            <b>Preview</b>
            <div className="chip" style={{ background: (!fixed && g.brand_accent) || th.accent, color: th.accentText }}>Play & Win</div>
            <div className="chip" style={{ background: th.surface, border: `1px solid ${th.border}`, color: th.text }}>Free Reta</div>
          </div>
        </>
      )}
      {section === 'texts' && (
        <>
          <h3>Game text</h3>
          <Loc label="Button label" value={g.texts.triggerLabel} onChange={(v) => setT('triggerLabel', v)} ph="Play & Win" />
          <Loc label="Heading" value={g.texts.heading} onChange={(v) => setT('heading', v)} ph="Spin to win" />
          <Loc label="Sub-heading" value={g.texts.subheading} onChange={(v) => setT('subheading', v)} ph="Enter your email to play" />
          <Loc label="Privacy notice" rows="3" value={g.texts.privacy} onChange={(v) => setT('privacy', v)} ph="We'll email your code to this address." />
          <label>Privacy policy URL<input value={g.texts.privacyUrl} onChange={(e) => setT('privacyUrl', e.target.value)} placeholder="https://…/policies/privacy-policy" /></label>
          <h3>Code email (sent via Resend)</h3>
          <div className="row">
            <label className="grow">From name<input value={g.from_name} onChange={(e) => setG({ ...g, from_name: e.target.value })} placeholder="Lexar Canada" /></label>
            <label className="grow">From email<input type="email" value={g.from_email} onChange={(e) => setG({ ...g, from_email: e.target.value })} placeholder="rewards@yourdomain.com" /></label>
            <label className="grow">Reply-to<input type="email" value={g.reply_to} onChange={(e) => setG({ ...g, reply_to: e.target.value })} /></label>
          </div>
          <p className="muted">The from-address domain must be verified in your Resend account.</p>
          <Loc label="Email subject" value={g.email_subject} onChange={(v) => setG({ ...g, email_subject: v })} ph="Your reward code" />
          <p className="muted">Every code email states the code is single-use and expires Sunday 11:59 PM ET; players can play once per week (resets Monday 12:00 AM ET).</p>
        </>
      )}
      <div className="row">
        <button className="primary" onClick={save}>Save</button><span className="good">{msg}</span><span className="error">{err}</span>
        {back && <button className="danger push" onClick={async () => { if (confirm('Delete this game with all its rewards and plays?')) { await api.deleteGame(g.id); back(); } }}>Delete game</button>}
      </div>
    </div>
  );
}

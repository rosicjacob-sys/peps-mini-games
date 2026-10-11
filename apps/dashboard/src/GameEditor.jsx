import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import Overview from './pages/Overview.jsx';
import { GAME_TYPES, THEMES, SLOT_ICONS, INTRO_DEFAULTS, UI, themeFor, t, singleReward } from '@peps/shared';
import { pokerTiers, COLORS } from '@peps/shared/cards.js';

const TABS = ['Stats', 'Rewards', 'Intro popup', 'Appearance', 'Texts & Email'];
const blankReward = () => ({ title: { en: '', fr: '' }, subtitle: { en: '', fr: '' }, code: '', probability: 0, active: true });

export default function GameEditor({ id, back }) {
  const [game, setGame] = useState(null); const [tab, setTab] = useState('Stats');
  const load = () => api.game(id).then(setGame); useEffect(() => { load(); }, [id]);
  const scope = useMemo(() => ({ game_id: id, group_id: '', store_id: '' }), [id]);
  if (!game) return <p>Loading…</p>;
  return (
    <>
      <button className="link back" onClick={back}>← All games</button>
      <div className="page-head"><div><h1>{game.name}</h1><p className="muted">{GAME_TYPES[game.type]?.label} · {game.store_name}{game.group_name ? ` · ${game.group_name}` : ''} · <span className={`pill ${game.status}`}>{game.status === 'active' ? 'Live' : 'Paused'}</span></p></div></div>
      <div className="tabs">{TABS.map((x) => <button key={x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>
      {tab === 'Rewards' && <Rewards game={game} reload={load} />}
      {tab === 'Stats' && <Overview scope={scope} />}
      {tab === 'Intro popup' && <Settings game={game} reload={load} section="intro" />}
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
  const [library, setLibrary] = useState([]); const [picking, setPicking] = useState(false);
  useEffect(() => { api.library().then(setLibrary); }, []);
  const inGame = new Set(rows.map((r) => r.library_id).filter(Boolean));
  const addFromLibrary = (items) => { setRows([...rows, ...items.map((l) => ({ library_id: l.id, title: l.title, subtitle: l.subtitle, code: l.code, symbol: l.symbol, probability: 0, active: true }))]); setPicking(false); };
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [lose, setLose] = useState(Number(game.lose_percent) || 0);   // chance a play wins nothing
  const total = useMemo(() => rows.filter((r) => r.active).reduce((s, r) => s + (Number(r.probability) || 0), 0) + (Number(lose) || 0), [rows, lose]);
  const set = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // poker: which hand each reward is paid on; color game: which colour each active reward sits on
  const tiers = game.type === 'poker' ? pokerTiers(rows.map((r, i) => ({ ...r, id: r.id || `new${i}`, sort: i }))) : {};
  const colorOf = (i) => { if (game.type !== 'color' || !rows[i].active) return null; const k = rows.slice(0, i).filter((r) => r.active).length; return COLORS[k] || null; };
  const ok = Math.abs(total - 100) < 0.01;
  function equalise() {
    const n = rows.filter((r) => r.active).length;
    if (!n) return;
    const pool = Math.round((100 - (Number(lose) || 0)) * 100);            // what's left after the lose chance, in cents
    const cents = Math.floor(pool / n); const extra = pool - cents * n; let seen = 0; // leftover cents go to the first rewards
    setRows(rows.map((r) => (r.active ? { ...r, probability: (cents + (seen++ < extra ? 1 : 0)) / 100 } : r)));
  }
  async function save() {
    setErr(''); setMsg('');
    try { const saved = await api.saveRewards(game.id, rows, Number(lose) || 0); setRows(saved.map((r) => ({ ...r, probability: Number(r.probability) }))); setMsg('Saved — live on the store now.'); reload(); } catch (e) { setErr(e.message); }
  }
  return (
    <>
      <p className="muted">Each play, the server picks {singleReward(game.type) ? 1 : game.rewards_per_play} reward{game.type === 'wheel' && game.rewards_per_play > 1 ? 's' : ''} using these probabilities.{game.type === 'slots' && ' All three reels stop on the winning reward\'s symbol.'}{game.type === 'poker' && ' Each reward is paid on a poker hand: the more likely the reward, the weaker the hand.'}{game.type === 'color' && ' Each active reward sits on one of six colours, in this order.'}{['lucky9', 'baccarat'].includes(game.type) && ' The player wins the hand, then spins a wheel; these probabilities decide where it lands.'}{game.type === 'blackjack' && ' The player wins a warm-up hand, then spins a wheel; these probabilities decide where the wheel lands.'} Active rewards must add up to 100%. Codes must already exist in your discount app.</p>
      {rows.map((r, i) => (
        <div key={r.id || i} className={`card reward-row ${r.active ? '' : 'off'} ${r.library_id ? 'linked' : ''}`}>
          {r.library_id ? (
            <div className="linked-head">
              <span className="lib-icon" aria-hidden="true">{r.symbol || '🎁'}</span>
              <div className="lib-text"><b>{t(r.title, 'en')}</b><span className="muted small">{[t(r.title, 'fr'), t(r.subtitle, 'en')].filter(Boolean).join(' · ')}</span></div>
              <code>{r.code}</code>
              <span className="pill">Library</span>
              <a className="small" href="#/rewards">Edit in library</a>
              <button className="link small" onClick={() => set(i, { library_id: null })} title="Keep a separate copy you can edit just for this game">Make custom</button>
            </div>
          ) : (
            <>
              <Loc label="Title" value={r.title} onChange={(v) => set(i, { title: v })} ph="Free Reta" />
              <Loc label="Subtitle" value={r.subtitle} onChange={(v) => set(i, { subtitle: v })} ph="One vial on us" />
            </>
          )}
          <div className="row">
            {!r.library_id && <label>Code<input value={r.code} onChange={(e) => set(i, { code: e.target.value })} placeholder="FREERETA" /></label>}
            <label>Probability %<input className="num-in" type="number" min="0" max="100" step="0.5" value={r.probability} onChange={(e) => set(i, { probability: e.target.value })} /></label>
            {game.type === 'slots' && !r.library_id && (
              <label>Reel icon<select value={r.symbol || ''} onChange={(e) => set(i, { symbol: e.target.value || null })}>
                <option value="">Auto</option>{SLOT_ICONS.map((x) => <option key={x.key} value={x.glyph}>{x.glyph} {x.label}</option>)}</select></label>
            )}
            {game.type === 'poker' && r.active && <span className="pill">Paid on: {UI.en.poker.hands[tiers[r.id || `new${i}`]]}</span>}
            {colorOf(i) && <span className="pill"><i className="dot" style={{ background: colorOf(i).hex }} />{colorOf(i).key}</span>}
            {game.type === 'color' && r.active && !colorOf(i) && <span className="pill failed">no colour left (max 6)</span>}
            <label className="check"><input type="checkbox" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} /> Active</label>
            <button className="danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </div>
      ))}
      {!rows.length && <div className="card empty-state"><b>No rewards in this game yet</b><p className="muted">Add rewards from your library, then set how likely each one is.</p>
        <button className="primary" onClick={() => setPicking(true)}>+ Add from library</button></div>}
      {picking && <LibraryPicker library={library} inGame={inGame} onAdd={addFromLibrary} onClose={() => setPicking(false)} />}
      <div className="card reward-row lose-row">
        <div className="row">
          <div className="grow"><b>No reward — the player loses</b>
            <p className="muted small">The chance a play wins nothing. They see a loss in the game (dealer or banker wins, no match, no winning hand, or "Try again" on the wheel), then "Try again next week" with a note about weekly promotions. No email is sent. Set 0 so everyone wins.</p></div>
          <label>Probability %<input className="num-in" type="number" min="0" max="100" step="0.5" value={lose} onChange={(e) => setLose(e.target.value)} /></label>
        </div>
      </div>
      <div className="row sticky">
        <button className="primary-outline" onClick={() => setPicking(true)}>+ Add from library</button>
        <button onClick={() => setRows([...rows, blankReward()])}>+ Custom reward</button>
        <button onClick={equalise}>Split evenly</button>
        <strong className={ok ? 'good' : 'bad'}>Total: {total.toFixed(2)}%</strong>
        <button className="primary" disabled={!ok && rows.some((r) => r.active)} onClick={save}>Save rewards</button>
        <span className="good">{msg}</span><span className="error">{err}</span>
      </div>
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
            {g.type === 'wheel' && <label>Rewards per play<input className="num-in" type="number" min="1" max="5" value={g.rewards_per_play} onChange={(e) => setG({ ...g, rewards_per_play: e.target.value })} /></label>}
            <label className="grow">Internal name<input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></label>
          </div>
          <h3>Casino theme</h3>
          {fixed ? <p className="muted">Blackjack keeps its signature purple-and-gold theme.</p> : (
            <>
              <div className="themes">
                {Object.entries(THEMES).filter(([, v]) => !v.locked).map(([k, v]) => (
                  <button key={k} className={`swatch ${g.theme === k ? 'on' : ''}`} onClick={() => setG({ ...g, theme: k })} style={{ background: v.bg, color: v.text, borderColor: v.border }}>
                    <i style={{ background: v.accent }} /><i style={{ background: v.slices[1] }} /><span>{v.label}</span>
                  </button>
                ))}
              </div>
              <div className="row">
                <label>Brand accent colour <span className="muted">(optional — replaces the gold on buttons)</span>
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
      {section === 'intro' && <IntroEditor g={g} setT={setT} />}
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
          <p className="muted">
            {game.effective_sender?.source === 'game' && <>Sending as <b>{game.effective_sender.from_name} &lt;{game.effective_sender.from_email}&gt;</b> (set on this game).</>}
            {game.effective_sender?.source === 'group' && <>Blank — sending as <b>{game.effective_sender.from_name} &lt;{game.effective_sender.from_email}&gt;</b>, the default of store group "{game.group_name}". Fill these in to override.</>}
            {game.effective_sender?.source === 'none' && <b className="bad">No sender set — code emails will not be sent. Set one here or on the store group.</b>}
            {' '}The from-address domain must be verified in your Resend account.
          </p>
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

const L = (en, fr) => ({ en, fr });
const copyDefaults = () => ({
  enabled: true, image: '',
  heading: L(INTRO_DEFAULTS.en.heading, INTRO_DEFAULTS.fr.heading),
  description: L(INTRO_DEFAULTS.en.description, INTRO_DEFAULTS.fr.description),
  steps: INTRO_DEFAULTS.en.steps.map((x, i) => L(x, INTRO_DEFAULTS.fr.steps[i])),
  note: L(INTRO_DEFAULTS.en.note, INTRO_DEFAULTS.fr.note),
  playLabel: L(INTRO_DEFAULTS.en.playLabel, INTRO_DEFAULTS.fr.playLabel),
  declineLabel: L(INTRO_DEFAULTS.en.declineLabel, INTRO_DEFAULTS.fr.declineLabel),
});

// The "Play to Win" popup visitors see on the homepage right after age verification.
function IntroEditor({ g, setT }) {
  const intro = { enabled: true, image: '', steps: [], ...(g.texts.intro || {}) };
  const set = (patch) => setT('intro', { ...intro, ...patch });
  const ph = (k, l) => INTRO_DEFAULTS[l][k];
  const setStep = (i, v) => set({ steps: intro.steps.map((x, j) => (j === i ? v : x)) });
  return (
    <>
      <div className="row">
        <label className="check"><input type="checkbox" checked={intro.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Show the popup on the homepage</label>
        <button onClick={() => set(copyDefaults())}>Fill with suggested copy</button>
      </div>
      <p className="muted">Shown on the homepage only, every visit, right after the age verification closes. Visitors can pick English or French in the popup. Blank fields use the suggested copy shown in grey.</p>
      <Loc label="Heading" value={intro.heading} onChange={(v) => set({ heading: v })} ph={ph('heading', 'en')} />
      <Loc label="Description" rows="3" value={intro.description} onChange={(v) => set({ description: v })} ph={ph('description', 'en')} />
      <h3>How to win (steps)</h3>
      {intro.steps.map((st, i) => (
        <div key={i} className="row">
          <div className="loc grow">
            {['en', 'fr'].map((l) => <label key={l}>Step {i + 1} <span className="tag">{l.toUpperCase()}</span><input value={st[l] || ''} onChange={(e) => setStep(i, { ...st, [l]: e.target.value })} /></label>)}
          </div>
          <button className="danger" onClick={() => set({ steps: intro.steps.filter((_, j) => j !== i) })}>Remove</button>
        </div>
      ))}
      {intro.steps.length < 6 && <button onClick={() => set({ steps: [...intro.steps, L('', '')] })}>+ Add step</button>}
      {!intro.steps.length && <p className="muted">No steps set — the 3 suggested steps are shown.</p>}
      <Loc label="Small print" rows="2" value={intro.note} onChange={(v) => set({ note: v })} ph={ph('note', 'en')} />
      <div className="row"><Loc label="Play button" value={intro.playLabel} onChange={(v) => set({ playLabel: v })} ph={ph('playLabel', 'en')} /></div>
      <Loc label="Decline button" value={intro.declineLabel} onChange={(v) => set({ declineLabel: v })} ph={ph('declineLabel', 'en')} />
      <label>Image URL <span className="muted">(optional, https only)</span><input value={intro.image || ''} onChange={(e) => set({ image: e.target.value })} placeholder="https://…" /></label>
    </>
  );
}

// pick several library rewards at once; ones already in the game are greyed out
function LibraryPicker({ library, inGame, onAdd, onClose }) {
  const [sel, setSel] = useState(new Set()); const [q, setQ] = useState('');
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const list = library.filter((x) => !q || `${x.title.en} ${x.code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label="Add rewards from library">
        <header className="drawer-head"><div><p className="muted small">Rewards library</p><h2>Add rewards to this game</h2></div><button className="ghost icon" onClick={onClose} aria-label="Close">✕</button></header>
        {!library.length ? (
          <div className="empty-state"><p className="muted">Your library is empty.</p><a className="small" href="#/rewards">Open the Rewards library</a></div>
        ) : (
          <>
            <div className="search"><input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search library" /></div>
            <div className="pick-list">
              {list.map((x) => { const used = inGame.has(x.id); return (
                <label key={x.id} className={`pick-row ${used ? 'used' : ''} ${sel.has(x.id) ? 'on' : ''}`}>
                  <input type="checkbox" disabled={used} checked={sel.has(x.id)} onChange={() => toggle(x.id)} />
                  <span className="lib-icon" aria-hidden="true">{x.symbol || '🎁'}</span>
                  <span className="lib-text"><b>{x.title.en}</b><span className="muted small">{x.title.fr}</span></span>
                  <code>{x.code}</code>{used && <span className="pill">in game</span>}
                </label>); })}
            </div>
            <div className="form-actions"><button className="primary" disabled={!sel.size} onClick={() => onAdd(library.filter((x) => sel.has(x.id)))}>Add {sel.size || ''} reward{sel.size === 1 ? '' : 's'}</button>
              <button className="ghost" onClick={onClose}>Cancel</button><a className="small push" href="#/rewards">Manage library</a></div>
          </>
        )}
      </aside>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import Overview from './pages/Overview.jsx';
import { GAME_TYPES, THEMES, CATEGORIES, UI, themeFor, gameTheme, themeCategory, categoryOf, t, singleReward } from '@peps/shared';
import { pokerTiers, COLORS } from '@peps/shared/cards.js';
import { Loc } from './IntroEditor.jsx';
import { fmtDateShort } from './format.js';

const TABS = ['General', 'Rewards', 'Look & sound', 'Texts', 'Reminder email', 'Stats'];

// everything the editor can change, as one draft: saving writes the game and (when they changed) its rewards
const draftOf = (game) => ({
  name: game.name, status: game.status, theme: game.theme, brand_accent: game.brand_accent, rewards_per_play: game.rewards_per_play,
  texts: { heading: {}, subheading: {}, privacy: {}, triggerLabel: {}, privacyUrl: '', ...game.texts },
  from_name: game.from_name, from_email: game.from_email, reply_to: game.reply_to, email_subject: game.email_subject || {},
  rewards: game.rewards.map((r) => ({ ...r, probability: Number(r.probability) })), lose_percent: Number(game.lose_percent) || 0,
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function GameEditor({ id, back, setGuard }) {
  const [game, setGame] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null); const saved = useRef(null);
  const [tab, setTab] = useState(null);
  const load = () => api.game(id).then((g) => { setGame(g); const d = draftOf(g); saved.current = d; setDraft(d); setTab((x) => x || (g.rewards.length ? 'Stats' : 'Rewards')); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);
  const dirty = !!draft && !same(draft, saved.current);
  // leaving with unsaved changes asks first (sidebar links, the back link, the browser's close button)
  useEffect(() => { setGuard?.(() => !dirty || confirm('You have unsaved changes on this game. Leave without saving?')); return () => setGuard?.(null); }, [dirty]);
  useEffect(() => { if (!dirty) return undefined; const h = (e) => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', h); return () => removeEventListener('beforeunload', h); }, [dirty]);
  const scope = useMemo(() => ({ game_id: id, group_id: '', store_id: '' }), [id]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setT = (k, v) => setDraft((d) => ({ ...d, texts: { ...d.texts, [k]: v } }));
  const total = draft ? draft.rewards.filter((r) => r.active).reduce((s, r) => s + (Number(r.probability) || 0), 0) + (Number(draft.lose_percent) || 0) : 0;
  const rewardsOk = !draft || !draft.rewards.some((r) => r.active) ? true : Math.abs(total - 100) < 0.01;

  async function save() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const prev = saved.current;
      if (!same(draft.rewards, prev.rewards) || draft.lose_percent !== prev.lose_percent) await api.saveRewards(id, draft.rewards, Number(draft.lose_percent) || 0);
      await api.updateGame(id, { ...game, ...draft });
      await load(); setMsg('Saved. Live on the stores now.');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function archive() {
    if (!confirm(`Archive "${draft.name}"? It disappears from the stores and the Games page; its plays stay in the reports. You can restore it later.`)) return;
    try { await api.archiveGame(id); back(); } catch (e) { setErr(e.message); }
  }
  async function restore() { try { await api.restoreGame(id); load(); } catch (e) { setErr(e.message); } }
  async function destroy() {
    if (!confirm(`Delete "${draft.name}" permanently, with every play it ever recorded? This cannot be undone.`)) return;
    try { await api.deleteGame(id); back(); } catch (e) { setErr(e.message); }
  }

  if (err && !game) return <><button className="link back" onClick={back}>← All games</button><div className="alert bad">{err}</div></>;
  if (!game || !draft) return <p className="loading">Loading…</p>;
  const archived = !!game.archived_at;
  return (
    <>
      <button className="link back" onClick={back}>← All games</button>
      <div className="page-head">
        <div><h1>{draft.name}</h1><p className="muted">{GAME_TYPES[game.type]?.label} · group <b>{game.group_name}</b>, shown on {game.store_names?.length ? game.store_names.join(', ') : 'no stores yet'} · {archived ? <span className="pill failed">Archived</span> : <span className={`pill ${draft.status}`}>{draft.status === 'active' ? 'Live' : 'Paused'}</span>}</p></div>
        <div className="page-actions"><a className="ghost btn-link" href={`#/preview/${id}`}>▶ Preview</a></div>
      </div>
      {archived && <div className="alert info">This game is archived: it is hidden on the stores and its settings are read-only. <button className="link" onClick={restore}>Restore it</button> to edit it or make it live again.</div>}
      <div className="tabs">{TABS.map((x) => <button key={x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{x}{x === 'Rewards' && !draft.rewards.some((r) => r.active) && <span className="tab-dot" title="No rewards yet" />}</button>)}</div>
      {tab === 'Stats' ? <Overview scope={scope} /> : (
        <fieldset className="card form" disabled={archived && tab !== 'General'}>
          {tab === 'General' && (
            <>
              <div className="row">
                <label className="grow">Name <span className="muted">(for you; visitors see the heading from the Texts tab)</span><input disabled={archived} value={draft.name} onChange={(e) => set({ name: e.target.value })} /></label>
                <label>Status<select disabled={archived} value={draft.status} onChange={(e) => set({ status: e.target.value })}><option value="active">Live (visible on the stores)</option><option value="paused">Paused (hidden)</option></select></label>
                {game.type === 'wheel' && <label>Rewards per play<input disabled={archived} className="num-in" type="number" min="1" max="5" value={draft.rewards_per_play} onChange={(e) => set({ rewards_per_play: e.target.value })} /></label>}
              </div>
              <p className="muted small">Type: {GAME_TYPES[game.type]?.label} ({CATEGORIES[categoryOf(game.type)].label.en}). Store group: <b>{game.group_name}</b>, so it shows on {game.store_names?.length ? game.store_names.join(', ') : 'no stores yet'}. Created {fmtDateShort(game.created_at)}.</p>
              <h3>Archive</h3>
              <p className="muted small">Archiving hides the game everywhere but keeps its plays in the reports. Pause it instead if you only need it off for a while.</p>
              <div className="row">
                {!archived ? <button className="danger" onClick={archive}>Archive game…</button>
                  : <><button onClick={restore}>Restore game</button><button className="danger" onClick={destroy}>Delete permanently…</button></>}
              </div>
            </>
          )}
          {tab === 'Rewards' && <Rewards game={game} draft={draft} set={set} total={total} ok={rewardsOk} />}
          {tab === 'Look & sound' && <Look game={game} draft={draft} set={set} setT={setT} />}
          {tab === 'Texts' && (
            <>
              <h3>Game text</h3>
              <p className="muted small">The heading is the game's name to visitors (in the picker and above the email step). Blank: the type's name, "{GAME_TYPES[game.type]?.label}".</p>
              <Loc label="Heading" value={draft.texts.heading} onChange={(v) => setT('heading', v)} ph={GAME_TYPES[game.type]?.label} />
              <Loc label="Sub-heading" value={draft.texts.subheading} onChange={(v) => setT('subheading', v)} ph="Enter your email to play" />
              <Loc label="Floating button label" value={draft.texts.triggerLabel} onChange={(v) => setT('triggerLabel', v)} ph="Play & Win" />
              <Loc label="Privacy notice" rows="3" value={draft.texts.privacy} onChange={(v) => setT('privacy', v)} ph="We'll use this email to send you a reminder when you can play again. Unsubscribe anytime." />
              <label>Privacy policy URL<input value={draft.texts.privacyUrl} onChange={(e) => setT('privacyUrl', e.target.value)} placeholder="https://…/policies/privacy-policy" /></label>
              <p className="muted small">The "Play to Win" popup is set per store group, on the <a href="#/groups">Store groups</a> page.</p>
            </>
          )}
          {tab === 'Reminder email' && (
            <>
              <h3>Weekly reminder email (sent via Resend)</h3>
              <p className="muted">Codes are shown on screen only. After each Monday 12:00 AM ET reset, players who played the week before get one email inviting them to play again (with an unsubscribe link). One play per email per week across all stores of the group.</p>
              <label className="check"><input type="checkbox" checked={draft.texts.reminder?.enabled !== false} onChange={(e) => setT('reminder', { ...(draft.texts.reminder || {}), enabled: e.target.checked })} /> Send the weekly reminder to this game's players</label>
              <div className="row">
                <label className="grow">From name<input value={draft.from_name} onChange={(e) => set({ from_name: e.target.value })} placeholder="Lexar Canada" /></label>
                <label className="grow">From email<input type="email" value={draft.from_email} onChange={(e) => set({ from_email: e.target.value })} placeholder="rewards@yourdomain.com" /></label>
                <label className="grow">Reply-to<input type="email" value={draft.reply_to} onChange={(e) => set({ reply_to: e.target.value })} /></label>
              </div>
              <p className="muted">
                {game.effective_sender?.source === 'game' && <>Sending as <b>{game.effective_sender.from_name} &lt;{game.effective_sender.from_email}&gt;</b> (set on this game).</>}
                {game.effective_sender?.source === 'group' && <>Blank, so sending as <b>{game.effective_sender.from_name} &lt;{game.effective_sender.from_email}&gt;</b>, the default of store group "{game.group_name}". Fill these in to override.</>}
                {game.effective_sender?.source === 'none' && <b className="bad">No sender set: reminder emails will not be sent. Set one here or on the store group.</b>}
                {' '}The from-address domain must be verified in your Resend account.
              </p>
              <Loc label="Email subject" value={draft.email_subject} onChange={(v) => set({ email_subject: v })} ph="A new week, a new chance to win!" />
              <ReminderPreview gameId={id} />
            </>
          )}
        </fieldset>
      )}
      {tab !== 'Stats' && !archived && (
        <div className="row sticky savebar">
          <span className={dirty ? 'unsaved' : 'muted'}>{dirty ? '● Unsaved changes' : 'All changes saved'}</span>
          {tab === 'Rewards' && draft.rewards.some((r) => r.active) && <strong className={rewardsOk ? 'good' : 'bad'}>Total: {total.toFixed(2)}%</strong>}
          <button className="primary" disabled={busy || !dirty || !rewardsOk} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          <span className="good">{msg}</span><span className="error">{err}</span>
        </div>
      )}
    </>
  );
}

function Rewards({ game, draft, set, total, ok }) {
  const rows = draft.rewards; const lose = draft.lose_percent;
  const setRows = (r) => set({ rewards: r });
  const [library, setLibrary] = useState([]); const [picking, setPicking] = useState(false); const [libErr, setLibErr] = useState('');
  useEffect(() => { api.library().then(setLibrary).catch((e) => setLibErr(e.message)); }, []);
  const inGame = new Set(rows.map((r) => r.library_id).filter(Boolean));
  const addFromLibrary = (items) => { setRows([...rows, ...items.map((l) => ({ library_id: l.id, title: l.title, subtitle: l.subtitle, code: l.code, symbol: l.symbol, probability: 0, active: true }))]); setPicking(false); };
  const setRow = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // poker: which hand each reward is paid on; color game: which colour each active reward sits on
  const tiers = game.type === 'poker' ? pokerTiers(rows.map((r, i) => ({ ...r, id: r.id || `new${i}`, sort: i }))) : {};
  const colorOf = (i) => { if (game.type !== 'color' || !rows[i].active) return null; const k = rows.slice(0, i).filter((r) => r.active).length; return COLORS[k] || null; };
  function equalise() {
    const n = rows.filter((r) => r.active).length;
    if (!n) return;
    const pool = Math.round((100 - (Number(lose) || 0)) * 100);            // what's left after the lose chance, in cents
    const cents = Math.floor(pool / n); const extra = pool - cents * n; let seen = 0; // leftover cents go to the first rewards
    setRows(rows.map((r) => (r.active ? { ...r, probability: (cents + (seen++ < extra ? 1 : 0)) / 100 } : r)));
  }
  return (
    <>
      <p className="muted">Each play, the server picks {singleReward(game.type) ? 1 : draft.rewards_per_play} reward{game.type === 'wheel' && draft.rewards_per_play > 1 ? 's' : ''} using these probabilities.{game.type === 'slots' && ' All three reels stop on the winning reward\'s symbol.'}{game.type === 'poker' && ' Each reward is paid on a poker hand: the more likely the reward, the weaker the hand.'}{game.type === 'color' && ' Each active reward sits on one of six colours, in this order.'}{['lucky9', 'baccarat'].includes(game.type) && ' The player wins the hand, then spins a wheel; these probabilities decide where it lands.'}{game.type === 'blackjack' && ' The player wins a warm-up hand, then spins a wheel; these probabilities decide where the wheel lands.'}{game.type === 'scratch' && ' The card has 6 spots showing reward icons; three matching icons win that reward. Pick each reward\'s icon in the library.'}{game.type === 'gifts' && ' The player picks one of three boxes; it holds the reward chosen here, and the other boxes show what else was possible.'}{game.type === 'spin' && ' A bright arcade prize wheel: the server picks one reward with these probabilities and the wheel lands on it.'}{game.type === 'plinko' && ' The ball always lands in a slot for the reward chosen here. Rewards (and "Try again" if the player can lose) share the 9 slots, shown by their library icon.'} Active rewards plus "No reward" must add up to 100%. Codes must already exist in your discount app.</p>
      {libErr && <div className="alert bad">{libErr}</div>}
      {rows.map((r, i) => (
        <div key={r.id || `new${i}`} className={`card reward-row linked ${r.active ? '' : 'off'}`}>
          <div className="linked-head">
            <span className="lib-icon" aria-hidden="true">{r.symbol || library.find((l) => l.id === r.library_id)?.symbol || '🎁'}</span>
            <div className="lib-text"><b>{t(r.title, 'en')}</b><span className="muted small">{[t(r.title, 'fr'), t(r.subtitle, 'en')].filter(Boolean).join(' · ')}</span></div>
            <code>{r.code}</code>
            <a className="small" href="#/rewards">Edit in library</a>
          </div>
          <div className="row">
            <label>Probability %<input className="num-in" type="number" min="0" max="100" step="0.5" value={r.probability} onChange={(e) => setRow(i, { probability: e.target.value })} /></label>
            {game.type === 'poker' && r.active && <span className="pill">Paid on: {UI.en.poker.hands[tiers[r.id || `new${i}`]]}</span>}
            {colorOf(i) && <span className="pill"><i className="dot" style={{ background: colorOf(i).hex }} />{colorOf(i).key}</span>}
            {game.type === 'color' && r.active && !colorOf(i) && <span className="pill failed">no colour left (max 6)</span>}
            <label className="check"><input type="checkbox" checked={r.active} onChange={(e) => setRow(i, { active: e.target.checked })} /> Active</label>
            <button className="danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </div>
      ))}
      {!rows.length && <div className="card empty-state"><b>No rewards in this game yet</b><p className="muted">Add rewards from your library, then set how likely each one is. Until it has an active reward the game stays hidden on the stores.</p>
        <button className="primary" onClick={() => setPicking(true)}>+ Add from library</button></div>}
      {picking && <LibraryPicker library={library} inGame={inGame} onAdd={addFromLibrary} onClose={() => setPicking(false)} />}
      <div className="card reward-row lose-row">
        <div className="row">
          <div className="grow"><b>No reward: the player loses</b>
            <p className="muted small">The chance a play wins nothing. They see a loss in the game (dealer or banker wins, no match, no winning hand, or "Try again" on the wheel), then "Try again next week". Set 0 so everyone wins.</p></div>
          <label>Probability %<input className="num-in" type="number" min="0" max="100" step="0.5" value={lose} onChange={(e) => set({ lose_percent: e.target.value })} /></label>
        </div>
      </div>
      <div className="row">
        <button className="primary-outline" onClick={() => setPicking(true)}>+ Add from library</button>
        <button onClick={equalise}>Split evenly</button>
        {rows.some((r) => r.active) && <strong className={ok ? 'good' : 'bad'}>Total: {total.toFixed(2)}%{!ok && ' (must be 100%)'}</strong>}
      </div>
    </>
  );
}

// theme / website colours, brand accent, sound
function Look({ game, draft, set, setT }) {
  const fixed = GAME_TYPES[game.type]?.fixedTheme;
  const cat = categoryOf(game.type);
  const g = { ...game, ...draft };
  const th = gameTheme(g);
  const colors = { mode: 'theme', ...draft.texts.colors };
  const site = cat === 'arcade' && colors.mode === 'site';
  return (
    <>
      <h3>{cat === 'arcade' ? 'Colours' : `${CATEGORIES[cat].label.en} theme`}</h3>
      {cat === 'arcade' && (
        <div className="segmented colour-mode" role="radiogroup" aria-label="Colours">
          <button type="button" role="radio" aria-checked={!site} className={!site ? 'on' : ''} onClick={() => setT('colors', { ...colors, mode: 'theme' })}>Arcade palette</button>
          <button type="button" role="radio" aria-checked={site} className={site ? 'on' : ''} onClick={() => setT('colors', { ...colors, mode: 'site' })}>Match my website</button>
        </div>
      )}
      {site && <><p className="muted small">Each store shows this game in its own website colours, read automatically from its homepage. Text shades are adjusted so everything stays readable.</p><StoreColours game={g} stores={game.stores} /></>}
      {fixed ? <p className="muted">Blackjack keeps its signature purple-and-gold theme.</p> : (
        <>
          {site && <p className="muted small fallback-label">Fallback palette, for stores whose colours aren't known yet:</p>}
          <div className="themes">
            {Object.entries(THEMES).filter(([k, v]) => !v.locked && themeCategory(k) === cat).map(([k, v]) => (
              <button type="button" key={k} className={`swatch ${themeFor(game.type, draft.theme) === v ? 'on' : ''}`} onClick={() => set({ theme: k })}
                style={v.grad ? { background: `linear-gradient(135deg, ${v.grad[0]}, ${v.grad[1]})`, color: '#fff', borderColor: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.35)' } : { background: v.bg, color: v.text, borderColor: v.border }}>
                <i style={{ background: v.accent }} /><i style={{ background: v.grad ? v.bg : v.slices[1] }} /><span>{v.label}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <label>Brand accent colour <span className="muted">(optional, replaces the {cat === 'arcade' ? 'button colour' : 'gold on buttons'})</span>
              <input type="color" value={draft.brand_accent || th.accent} onChange={(e) => set({ brand_accent: e.target.value })} /></label>
            {draft.brand_accent && <button type="button" className="link" onClick={() => set({ brand_accent: null })}>Reset to neutral</button>}
          </div>
        </>
      )}
      <div className="preview" style={{ background: th.grad ? `linear-gradient(135deg, ${th.grad[0]}, ${th.grad[1]})` : th.bg, color: th.grad ? th.onGrad || '#fff' : th.text, borderColor: th.border }}>
        <b>Preview</b>
        <div className="chip" style={{ background: (!fixed && draft.brand_accent) || th.accent, color: th.accentText }}>Play & Win</div>
        <div className="chip" style={{ background: th.surface, border: `1px solid ${th.border}`, color: th.text }}>Free Reta</div>
        <a className="small push" href={`#/preview/${game.id}`}>Open the real game ▶</a>
      </div>
      <SoundEditor value={draft.texts.sound} onChange={(v) => setT('sound', v)} />
    </>
  );
}

// Sound effects and background music. Players can always mute from the game window (remembered on their device).
function SoundEditor({ value, onChange }) {
  const s = { sfx: true, music: 'builtin', musicUrl: '', ...value };
  const set = (patch) => onChange({ ...s, ...patch });
  return (
    <>
      <h3>Sound</h3>
      <p className="muted small">Sounds start only after the player opens the game, and they can mute them with the speaker button in the game window.</p>
      <div className="row">
        <label className="check"><input type="checkbox" checked={s.sfx} onChange={(e) => set({ sfx: e.target.checked })} /> Sound effects (wheel ticks, card deals, chips, fanfares)</label>
      </div>
      <div className="row">
        <label>Background music<select value={s.music} onChange={(e) => set({ music: e.target.value })}>
          <option value="builtin">Built-in (lounge jazz for casino games, a bouncy tune for arcade games)</option><option value="custom">My own music file</option><option value="off">Off</option></select></label>
        {s.music === 'custom' && (
          <label className="grow">Music file URL (MP3)<input type="url" value={s.musicUrl} onChange={(e) => set({ musicUrl: e.target.value })} placeholder="https://cdn.shopify.com/s/files/…/casino-lounge.mp3" />
            <span className="help">Upload the file to Shopify (Content → Files) and paste its link. It loops quietly while the game is open.</span></label>
        )}
      </div>
    </>
  );
}

// what this game's reminder email looks like (as saved), in English or French
function ReminderPreview({ gameId }) {
  const [locale, setLocale] = useState(null); const [p, setP] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { if (!locale) return; setP(null); setErr(''); api.previewReminder(gameId, locale).then(setP).catch((e) => setErr(e.message)); }, [locale, gameId]);
  return (
    <div className="reminder-preview">
      <div className="row"><span className="muted">Preview the email (as saved):</span>
        <button type="button" className={locale === 'en' ? 'primary small' : 'ghost small'} onClick={() => setLocale(locale === 'en' ? null : 'en')}>English</button>
        <button type="button" className={locale === 'fr' ? 'primary small' : 'ghost small'} onClick={() => setLocale(locale === 'fr' ? null : 'fr')}>French</button></div>
      {err && <p className="error">{err}</p>}
      {locale && p && (
        <>
          <p className="small"><b>Subject:</b> {p.subject}{!p.play_url && <span className="bad"> · No store website set: the email has no "Play now" button. Add it on the Stores page.</span>}</p>
          <iframe title="Reminder email preview" className="email-frame" srcDoc={p.html} sandbox="" />
        </>
      )}
    </div>
  );
}

// Arcade "Match my website": every store in the group shows the game in its own website colours
// (detected automatically from each store's homepage; changed on the Stores page).
function StoreColours({ game, stores }) {
  if (!stores?.length) return <p className="muted small">This group has no stores yet.</p>;
  return (
    <div className="store-colours">
      {stores.map((s) => {
        const c = s.colors || {}; const th = gameTheme(game, c);
        const has = /^#[0-9a-f]{6}$/i.test(c.main || '');
        return (
          <div key={s.id} className="store-colour">
            <span className="sc-band" style={{ background: `linear-gradient(135deg, ${th.grad[0]}, ${th.grad[1]})`, color: th.onGrad || '#fff' }}>{s.name}</span>
            <span className="muted small">{has ? (c.mode === 'manual' ? 'Colours set by hand' : `Detected from ${c.from || 'its website'}`) : c.error ? `Could not read its website, using the palette below` : 'Not detected yet (add its website on Stores), using the palette below'}</span>
          </div>
        );
      })}
      <a className="small" href="#/stores">Change a store's colours on the Stores page</a>
    </div>
  );
}

// pick several library rewards at once; ones already in the game are greyed out
function LibraryPicker({ library, inGame, onAdd, onClose }) {
  const [sel, setSel] = useState(new Set()); const [q, setQ] = useState('');
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const list = library.filter((x) => !q || `${x.title.en} ${x.code}`.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label="Add rewards from library">
        <header className="drawer-head"><div><p className="muted small">Rewards library</p><h2>Add rewards to this game</h2></div><button type="button" className="ghost icon" onClick={onClose} aria-label="Close">✕</button></header>
        {!library.length ? (
          <div className="empty-state"><p className="muted">Your library is empty.</p><a className="small" href="#/rewards">Open the Rewards library</a></div>
        ) : (
          <>
            <div className="search"><input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search library" autoFocus /></div>
            <div className="pick-list">
              {list.map((x) => { const used = inGame.has(x.id); return (
                <label key={x.id} className={`pick-row ${used ? 'used' : ''} ${sel.has(x.id) ? 'on' : ''}`}>
                  <input type="checkbox" disabled={used} checked={sel.has(x.id)} onChange={() => toggle(x.id)} />
                  <span className="lib-icon" aria-hidden="true">{x.symbol || '🎁'}</span>
                  <span className="lib-text"><b>{x.title.en}</b><span className="muted small">{x.title.fr}</span></span>
                  <code>{x.code}</code>{used && <span className="pill">in game</span>}
                </label>); })}
            </div>
            <div className="form-actions"><button type="button" className="primary" disabled={!sel.size} onClick={() => onAdd(library.filter((x) => sel.has(x.id)))}>Add {sel.size || ''} reward{sel.size === 1 ? '' : 's'}</button>
              <button type="button" className="ghost" onClick={onClose}>Cancel</button><a className="small push" href="#/rewards">Manage library</a></div>
          </>
        )}
      </aside>
    </div>
  );
}

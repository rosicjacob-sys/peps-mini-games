import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UI, INTRO_DEFAULTS, LOCALES, pickLocale, t, gameTheme, GAME_TYPES, METALS, CATEGORIES, POPS, categoryOf } from '@peps/shared';
import Wheel from './games/Wheel.jsx';
import Blackjack from './games/Blackjack.jsx';
import Slots from './games/Slots.jsx';
import ColorGame from './games/ColorGame.jsx';
import Lucky9 from './games/Lucky9.jsx';
import Baccarat from './games/Baccarat.jsx';
import Poker from './games/Poker.jsx';
import ScratchCard from './games/ScratchCard.jsx';
import GiftBoxes from './games/GiftBoxes.jsx';
import Plinko from './games/Plinko.jsx';
import Confetti from './Confetti.jsx';
import { sound } from './sound.js';

// Stages a play goes through before the result screen. Blackjack is a warm-up hand, then the wheel decides the reward.
const GAMES = { wheel: [Wheel], blackjack: [Blackjack, Wheel], slots: [Slots], color: [ColorGame], lucky9: [Lucky9, Wheel], baccarat: [Baccarat, Wheel], poker: [Poker],
  scratch: [ScratchCard], gifts: [GiftBoxes], plinko: [Plinko], spin: [Wheel] };

function cssVars(game) {
  const th = gameTheme(game, game.site);
  const accent = (!GAME_TYPES[game.type]?.fixedTheme && game.brandAccent) || th.accent;
  const rim = th.rim || accent;
  return {
    '--bg': th.bg, '--surface': th.surface, '--text': th.text, '--muted': th.muted,
    '--accent': accent, '--accent-text': game.brandAccent && !GAME_TYPES[game.type]?.fixedTheme ? '#fff' : th.accentText, '--border': th.border,
    '--rim': rim, '--rim-text': th.rimText || th.accentText,
    // the trigger's spade: gold on a coloured button, button-text colour when the button itself is gold
    '--suit': accent.toLowerCase() === String(rim).toLowerCase() ? (th.accentText || '#1f1a0a') : rim,
    // headline fill: the theme's polished metal (gold, copper or silver), else the flat rim colour
    '--marquee': METALS[th.marquee] || `linear-gradient(${rim},${rim})`,
    // arcade: the header gradient and the bright pieces
    ...(th.grad ? { '--grad1': th.grad[0], '--grad2': th.grad[1], '--on-grad': th.onGrad || '#fff' } : {}),
    ...Object.fromEntries((th.pops || POPS).flatMap((p, i) => [[`--pop${i + 1}`, p.bg], [`--pop${i + 1}-fg`, p.fg]])),
  };
}

const DEFAULT_GATE = '[id*="age-gate"],[class*="age-gate"],[data-age-gate]';
const store_ = (fn) => { try { return fn(); } catch { return null; } };

// Language: the visitor's choice (toggle) wins, then the page / script setting.
function initialLocale(raw) {
  const saved = store_(() => localStorage.getItem('pg_locale'));
  return LOCALES.includes(saved) ? saved : pickLocale(raw);
}

// The intro only shows on the homepage (/, or a language/market root like /fr, /en-ca).
const isHome = () => /^\/(?:[a-z]{2}(?:-[a-z]{2})?)?\/?$/i.test(location.pathname);

// this browser played one of the group's games this week (one play per email per week, across all of its stores)
const PLAYED = (storeKey) => `pg_played_${storeKey}`;
const playedUntil = (storeKey) => { const v = store_(() => localStorage.getItem(PLAYED(storeKey))); return v && Date.now() < new Date(v).getTime() ? v : null; };
const markPlayed = (storeKey, until) => store_(() => until && localStorage.setItem(PLAYED(storeKey), until));

// the visitor-facing name of a game: its heading, else its type ("Prize Wheel"); never the admin's internal name
const gameTitle = (g, locale) => t(g.texts?.heading, locale) || GAME_TYPES[g.type]?.label || g.name;

// Is the store's age verification on screen? Either an element matching `sel` (data-age-selector, or a name like
// "age-gate"), or any fixed popup in the middle of the screen that talks about age (most age-check apps and themes
// look like that, whatever they are called). Our own windows are skipped, so a gate under them still counts.
const AGE_TEXT = /\b(?:18|19|21)\b|\bage\b|âge|\bverif|vérif|older|majeur|legal/i;
// names like age-gate, ageVerification, av_age_check (not "page" or "image")
const AGE_NAME = /age[-_]?(?:gate|verif|check|confirm|popup|modal)|(?:^|[\s_-])age(?:[\s_-]|$)|verif/i;
function bySelector(sel) {
  let els = [];
  try { els = document.querySelectorAll(sel); } catch { return false; }
  for (const el of els) {
    if (el.hidden || el.getAttribute('data-open') === 'false') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    return true;
  }
  return false;
}
function ageOverlay() {
  const w = innerWidth, h = innerHeight;
  for (const [x, y] of [[w / 2, h / 2], [w / 2, h * 0.35], [w / 2, h * 0.65]]) {
    // the topmost thing at that spot, ignoring our own windows
    const hit = (document.elementsFromPoint?.(x, y) || []).find((e) => !e.closest('[data-peps-games]'));
    for (let el = hit; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      if (el.tagName === 'IFRAME') { if (AGE_NAME.test(`${el.id} ${el.title} ${el.src}`)) return true; continue; }
      // a popup is short; a fixed wrapper around the whole page is not
      const text = (el.textContent || '').trim();
      if (text.length < 1500 && (AGE_TEXT.test(text) || AGE_NAME.test(`${el.id} ${el.getAttribute('class') || ''}`))) return true;
    }
  }
  return false;
}
const gateBlocking = (sel) => bySelector(sel) || ageOverlay();

// Where the visitor is with the age verification: 'blocked' (on screen, or the visitor was denied so it never
// closes), 'clear' (just closed, or there is none) and 'ready' once it has stayed closed for 5 s. The game button and
// popup wait for 'ready'; if a slow age-check app shows up later, they hide again until it is answered.
const INTRO_DELAY = 5000;   // the game button and popup show 5 s after the visitor confirms their age
const GATE_TICK = 250;
function useAgeGate(sel, skip) {
  const [state, setState] = useState(skip ? 'ready' : 'blocked');
  useEffect(() => {
    if (skip) return undefined;
    let since = null;
    const tick = () => {
      const now = Date.now();
      if (gateBlocking(sel)) since = null; else if (since === null) since = now;
      const quiet = since === null ? -1 : now - since;
      setState(quiet >= INTRO_DELAY ? 'ready' : quiet >= 2 * GATE_TICK ? 'clear' : 'blocked');
    };
    tick(); const id = setInterval(tick, GATE_TICK);
    return () => clearInterval(id);
  }, [sel, skip]);
  return state;
}

// Dialog behaviour for a modal: Escape closes it, Tab stays inside it, and the element that had focus (the
// floating button) gets it back when it closes. Works inside the shadow root.
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
function useDialog(ref, onClose) {
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const root = el.getRootNode();
    const before = root.activeElement || document.activeElement;
    const first = el.querySelector('[autofocus]') || el.querySelector(FOCUSABLE);
    (first || el).focus({ preventScroll: true });
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const cur = root.activeElement; const i = items.indexOf(cur);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === items.length - 1)) { e.preventDefault(); items[0].focus(); }
    };
    el.addEventListener('keydown', key);
    return () => { el.removeEventListener('keydown', key); if (before && before.isConnected && typeof before.focus === 'function') before.focus({ preventScroll: true }); };
  }, []);
}

function LangToggle({ locale, setLocale }) {
  return (
    <div className="lang" role="group" aria-label="Language">
      {LOCALES.map((l) => <button key={l} className={l === locale ? 'on' : ''} aria-pressed={l === locale} onClick={() => setLocale(l)}>{l.toUpperCase()}</button>)}
    </div>
  );
}

export default function Widget({ store, api, locale: rawLocale, gameType, ageSelector, introPages, preview }) {
  const [locale, setLocaleState] = useState(() => initialLocale(rawLocale));
  const setLocale = (l) => { setLocaleState(l); store_(() => localStorage.setItem('pg_locale', l)); };
  const ui = UI[locale];
  const [games, setGames] = useState(null);
  const [introCfg, setIntroCfg] = useState({});
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  // the Play & Win button is a pill at the top of the page and shrinks to a round icon once the visitor scrolls down
  const [mini, setMini] = useState(false);
  useEffect(() => {
    if (preview) return undefined;
    const onScroll = () => setMini(window.scrollY > 40);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // the age verification: the game button and popup wait until it has been answered (5 s after)
  const gate = useAgeGate(ageSelector || DEFAULT_GATE, !!preview);
  const [game, setGame] = useState(null);
  const [played, setPlayed] = useState(() => (preview ? null : playedUntil(store)));

  // The store's live games (paused ones are never listed) and its group's popup. Loaded with the page and again
  // every time the game window opens, so a game paused in the dashboard disappears even from a page that was open.
  const query = preview ? `preview=${encodeURIComponent(preview)}` : `key=${encodeURIComponent(store)}`;
  const loadGames = (refresh) => fetch(`${api}/api/public/config?${query}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? `no store is set up for ${location.origin} (add it to the store's websites)` : `HTTP ${r.status}`))))
    .then((d) => {
      // each game carries this store's website colours (used by arcade games set to match the site)
      const list = d.games.filter((g) => GAMES[g.type] && (!gameType || g.type === gameType)).map((g) => ({ ...g, site: d.site }));
      // a hint in the browser console when nothing shows (shop owners and support look there first)
      if (!refresh && !list.length) console.info('[peps-games] no live games with rewards for this store');
      setGames(list); setIntroCfg(d.intro || {});
      setGame((cur) => (list.length === 1 ? list[0] : cur && list.find((g) => g.id === cur.id)) || null);
    })
    .catch((e) => { if (!refresh) { console.warn(`[peps-games] games not loaded from ${api}: ${e.message}`); setGames([]); } });
  useEffect(() => { loadGames(false); }, [store, api, gameType, preview]);

  const current = game || games?.[0];
  // sounds follow the game on screen; music plays only while the game window is open
  useEffect(() => { if (current) sound.configure(current.texts?.sound, categoryOf(current.type)); }, [current?.id]);
  useEffect(() => { sound.music(open); return () => sound.music(false); }, [open]);
  const openGame = () => { sound.unlock(); setOpen(true); loadGames(true); };
  // closing forgets the chosen game when the store has several, so "Play & Win" opens the picker again
  const close = () => { setOpen(false); if (games?.length > 1) setGame(null); };
  const onPlayed = (until) => { if (preview) return; markPlayed(store, until); setPlayed(until); };

  // Arriving from a reminder email (?pg_play=1): open the game as soon as the age verification is answered.
  const fromReminder = useMemo(() => store_(() => new URLSearchParams(location.search).has('pg_play')), []);
  const done = useRef({ reminder: false, intro: false });
  useEffect(() => {
    if (!current || !fromReminder || gate === 'blocked' || done.current.reminder) return;
    done.current.reminder = true;
    store_(() => { const u = new URL(location.href); u.searchParams.delete('pg_play'); history.replaceState(history.state, '', u); });
    setOpen(true);
  }, [current?.id, gate]);

  // Intro popup (the store group's): homepage only, every visit (once per browser session), 5 s after age
  // verification. A preview from the dashboard always shows it, straight away.
  useEffect(() => {
    if (!current || fromReminder || gate !== 'ready' || done.current.intro) return;
    done.current.intro = true;
    if (introCfg.enabled === false) return;
    if (!preview) {
      if (introPages !== 'all' && !isHome()) return;
      if (store_(() => sessionStorage.getItem('pg_intro_done')) || played) return;
    }
    setIntro(true);
  }, [current?.id, gate]);

  const finishIntro = (play) => {
    if (!preview) store_(() => sessionStorage.setItem('pg_intro_done', '1'));
    setIntro(false);
    if (play) openGame();
  };

  if (!games?.length) return null;
  // after a play the button says when to come back (always the next Monday); a different email can still play
  const label = played ? ui.comeBackMonday : t(current.texts?.triggerLabel, locale) || ui.play;
  const arcade = categoryOf(current.type) === 'arcade';
  // the picker lists games by family when the store has both
  const families = Object.keys(CATEGORIES).map((c) => [c, games.filter((g) => categoryOf(g.type) === c)]).filter(([, l]) => l.length);

  return (
    <div style={cssVars(current)} className={arcade ? 'pg-arcade' : 'pg-casino'}>
      {(gate === 'ready' || open) && (
        <button className={`trigger ${played ? 'played' : ''} ${mini ? 'mini' : ''}`} onClick={openGame} aria-label={label} title={mini ? label : undefined}>
          <span className="trigger-suit" aria-hidden="true">{played ? '✓' : arcade ? '🎁' : '♠'}</span><span className="trigger-label" aria-hidden="true">{label}</span>
        </button>
      )}
      {intro && gate === 'ready' && !open && <Intro cfg={introCfg} arcade={arcade} locale={locale} setLocale={setLocale} onPlay={() => finishIntro(true)} onDecline={() => finishIntro(false)} />}
      {open && (
        <Modal onClose={close} preview={preview} locale={locale}>
          <LangToggle locale={locale} setLocale={setLocale} />
          <SoundToggle locale={locale} />
          <button className="close" aria-label={ui.close} onClick={close}>×</button>
          {game ? <Play key={game.id} game={game} arcade={arcade} api={api} store={store} preview={preview} locale={locale} onClose={close} onPlayed={onPlayed} onBack={games.length > 1 ? () => setGame(null) : null} onUnavailable={() => loadGames(true)} /> : (
            <div className="picker">
              <Head arcade={arcade} title={ui.choose} />
              {families.map(([c, list]) => (
                <React.Fragment key={c}>
                  {families.length > 1 && <p className="pick-cat"><span aria-hidden="true">{CATEGORIES[c].icon}</span> {t(CATEGORIES[c].label, locale)}</p>}
                  {list.map((g) => {
                    const title = gameTitle(g, locale); const kind = GAME_TYPES[g.type]?.label;
                    return (
                      <button key={g.id} className={`pick pick-${c}`} onClick={() => { sound.play(categoryOf(g.type) === 'arcade' ? 'boing' : 'chip'); setGame(g); }}>
                        <span className="pick-ico" aria-hidden="true">{GAME_TYPES[g.type]?.icon}</span>
                        <span className="pick-txt">{title}{kind && kind !== title && <small>{kind}</small>}</span>
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// The game window: a modal dialog (Escape closes, focus stays inside). In a dashboard preview it says so.
function Modal({ children, onClose, preview, locale, className = '' }) {
  const ref = useRef(null);
  useDialog(ref, onClose);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" tabIndex={-1}>
        {preview && <div className="preview-tag">{UI[locale].preview}</div>}
        {children}
      </div>
    </div>
  );
}

// Mute / unmute all game sounds and music; the choice is remembered on this device.
function SoundToggle({ locale }) {
  const [muted, setMuted] = useState(sound.muted());
  useEffect(() => sound.subscribe(setMuted), []);
  const label = muted ? UI[locale].soundOn : UI[locale].soundOff;
  return (
    <button className="sound-toggle" aria-label={label} title={label} aria-pressed={!muted} onClick={() => sound.setMuted(!muted)}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}</svg>
    </button>
  );
}

// Screen heading. Casino: twinkling marquee bulbs over a gold title (and card suits).
// Arcade: a bright gradient banner across the top of the window with floating sparkles.
function Head({ arcade, title, suits, bulbs = true, className = '', id }) {
  if (arcade) return (
    <div className="arcade-head">
      <i className="spark s1" aria-hidden="true">✦</i><i className="spark s2" aria-hidden="true">●</i><i className="spark s3" aria-hidden="true">★</i><i className="spark s4" aria-hidden="true">✿</i><i className="spark s5" aria-hidden="true">✦</i>
      <h2 id={id} className={`arcade-title ${className}`}>{title}</h2>
    </div>
  );
  return (
    <>
      {bulbs && <Bulbs />}
      <h2 id={id} className={`marquee ${className}`}>{title}</h2>
      {suits && <div className="suits" aria-hidden="true"><span>♠</span><span>♥</span><span>♦</span><span>♣</span></div>}
    </>
  );
}

// A row of twinkling marquee bulbs.
const Bulbs = () => <div className="bulbs" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 3) * 0.33}s` }} />)}</div>;

// "Play to Win" popup. Copy comes from the store group in the dashboard; blank fields fall back to the defaults.
function Intro({ cfg, arcade, locale, setLocale, onPlay, onDecline }) {
  const d = INTRO_DEFAULTS[locale];
  const pick = (k) => t(cfg[k], locale) || d[k];
  const steps = (cfg.steps || []).map((x) => t(x, locale)).filter(Boolean);
  const list = steps.length ? steps : d.steps;
  const ref = useRef(null);
  useDialog(ref, onDecline);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onDecline()}>
      <div ref={ref} className="modal intro" role="dialog" aria-modal="true" aria-labelledby="pg-intro-title" tabIndex={-1}>
        <LangToggle locale={locale} setLocale={setLocale} />
        <button className="close" aria-label={UI[locale].close} onClick={onDecline}>×</button>
        {cfg.image && <img className="intro-img" src={cfg.image} alt="" />}
        <Head arcade={arcade} id="pg-intro-title" title={pick('heading')} suits />
        <p className="intro-desc">{pick('description')}</p>
        <ol className="steps">{list.map((x, i) => <li key={i}><span>{i + 1}</span>{x}</li>)}</ol>
        <button className="btn play" onClick={onPlay} autoFocus>{pick('playLabel')}</button>
        <button className="btn ghost" onClick={onDecline}>{pick('declineLabel')}</button>
        <p className="fine">{pick('note')}</p>
      </div>
    </div>
  );
}

function Play({ game, arcade, api, store, preview, locale, onClose, onPlayed, onBack, onUnavailable }) {
  const ui = UI[locale];
  const stages = GAMES[game.type];
  const [stage, setStage] = useState(0);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);   // server response - the outcome is already decided
  const [done, setDone] = useState(false);       // game animation finished
  const heading = gameTitle(game, locale);
  const sub = t(game.texts?.subheading, locale);
  const privacy = t(game.texts?.privacy, locale);
  // every new screen (email, game, result) starts at the top of the window
  const top = useRef(null);
  useEffect(() => { top.current?.closest('.modal')?.scrollTo(0, 0); }, [stage, done, !!result]);
  useEffect(() => { if (done && result && !result.lost) sound.play('congrats'); }, [done]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError(ui.invalidEmail);
    setBusy(true); sound.unlock(); sound.play('chip');
    try {
      const res = await fetch(`${api}/api/public/play`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: store, gameId: game.id, email: email.trim(), locale, ...(preview ? { preview } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setResult(data); if (!data.test && !data.preview) onPlayed(data.nextPlayAt || data.expiresAt); }
      else if (data.error === 'already_played') {
        onPlayed(data.nextPlayAt);
        const when = data.nextPlayText || new Date(data.nextPlayAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
        setError(`${ui.already} ${data.email || email.trim()}. ${ui.onePer} ${ui.comeBack} ${when}${ui.orOther}.`);
      }
      else if (data.error === 'invalid_email') setError(ui.invalidEmail);
      // paused (or removed) in the dashboard while the window was open
      else if (data.error === 'game_unavailable') { setError(ui.paused); onUnavailable?.(); }
      else setError(ui.error);
    } catch { setError(ui.error); }
    setBusy(false);
  }

  if (!result) {
    return (
      <form ref={top} className="screen gate" onSubmit={submit}>
        {onBack && !arcade && <button type="button" className="back-link" onClick={onBack}>← {ui.otherGames}</button>}
        <Head arcade={arcade} title={heading} suits />
        {onBack && arcade && <button type="button" className="back-link" onClick={onBack}>← {ui.otherGames}</button>}
        {sub && <p className="muted">{sub}</p>}
        <label className="field">
          <span>{ui.emailLabel}</span>
          <input type="email" required autoComplete="email" inputMode="email" value={email} placeholder={ui.emailPlaceholder} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn play" disabled={busy}>{busy ? ui.sending : ui.start}</button>
        {(privacy || game.texts?.privacyUrl) && (
          <p className="fine">{privacy} {game.texts?.privacyUrl && <a href={game.texts.privacyUrl} target="_blank" rel="noopener noreferrer">{locale === 'fr' ? 'Politique de confidentialité' : 'Privacy policy'}</a>}</p>
        )}
      </form>
    );
  }

  if (!done) {
    const Stage = stages[stage];
    const next = () => (!result.lost && stage + 1 < stages.length ? setStage(stage + 1) : setDone(true));
    // a wheel that follows another stage gets its own heading
    return <div ref={top} className="screen"><Head arcade={arcade} bulbs={false} title={stage > 0 ? ui.spinHeading : heading} /><Stage key={stage} game={game} result={result} locale={locale} onDone={next} /></div>;
  }

  if (result.lost) return (
    <div ref={top} className="screen result lose">
      <Head arcade={arcade} title={ui.lose.title} />
      <div className="lose-card">
        <p className="lose-when">{ui.lose.retry} <b>{result.nextPlayText}</b>.</p>
        {game.reminders !== false && <p>✉️ {ui.lose.promo}</p>}
      </div>
      <button className="btn ghost" onClick={onClose}>{ui.close}</button>
    </div>
  );

  return (
    <div ref={top} className="screen result">
      <Confetti />
      <Head arcade={arcade} className="congrats" title={ui.congrats} />
      <p className="muted won">{result.rewards.length > 1 ? ui.yourRewards : ui.yourReward}</p>
      {result.rewards.map((r) => <RewardCard key={r.id} r={r} locale={locale} />)}
      <p className="redeem">🛒 {ui.redeem}</p>
      <p className="fine strong">{ui.limited}</p>
      <button className="btn ghost" onClick={onClose}>{ui.close}</button>
    </div>
  );
}

function RewardCard({ r, locale }) {
  const ui = UI[locale];
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(r.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); };
  return (
    <div className="reward">
      <div className="reward-title">{t(r.title, locale)}</div>
      {t(r.subtitle, locale) && <div className="muted">{t(r.subtitle, locale)}</div>}
      <div className="code-label">{ui.code}</div>
      <div className="code-row"><code>{r.code}</code><button className="copy" onClick={copy}>{copied ? ui.copied : ui.copy}</button></div>
    </div>
  );
}

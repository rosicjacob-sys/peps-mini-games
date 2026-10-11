import React, { useEffect, useMemo, useState } from 'react';
import { UI, INTRO_DEFAULTS, LOCALES, pickLocale, t, themeFor, GAME_TYPES, METALS } from '@peps/shared';
import Wheel from './games/Wheel.jsx';
import Blackjack from './games/Blackjack.jsx';
import Slots from './games/Slots.jsx';
import ColorGame from './games/ColorGame.jsx';
import Lucky9 from './games/Lucky9.jsx';
import Baccarat from './games/Baccarat.jsx';
import Poker from './games/Poker.jsx';
import Confetti from './Confetti.jsx';
import { sound } from './sound.js';

// Stages a play goes through before the result screen. Blackjack is a warm-up hand, then the wheel decides the reward.
const GAMES = { wheel: [Wheel], blackjack: [Blackjack, Wheel], slots: [Slots], color: [ColorGame], lucky9: [Lucky9, Wheel], baccarat: [Baccarat, Wheel], poker: [Poker] };

function cssVars(game) {
  const th = themeFor(game.type, game.theme);
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

const playedUntil = (gameId) => store_(() => localStorage.getItem(`pg_played_${gameId}`));
const playedThisWeek = (gameId) => { const v = playedUntil(gameId); return !!v && Date.now() < new Date(v).getTime(); };

function gateBlocking(sel) {
  let els = [];
  try { els = document.querySelectorAll(sel); } catch { return false; }
  for (const el of els) {
    if (el.hidden || el.getAttribute('data-open') === 'false') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    return true;
  }
  return false;
}

// Calls `cb` once the age-verification dialog is gone. While it is open (or the visitor was denied,
// so it never closes) the intro never appears.
function whenAgeGateClear(sel, cb) {
  let clear = 0;
  const id = setInterval(() => {
    clear = gateBlocking(sel) ? 0 : clear + 1;
    if (clear >= 2) { clearInterval(id); cb(); }
  }, 200);
  return () => clearInterval(id);
}

function LangToggle({ locale, setLocale }) {
  return (
    <div className="lang" role="group" aria-label="Language">
      {LOCALES.map((l) => <button key={l} className={l === locale ? 'on' : ''} aria-pressed={l === locale} onClick={() => setLocale(l)}>{l.toUpperCase()}</button>)}
    </div>
  );
}

export default function Widget({ store, api, locale: rawLocale, gameType, ageSelector, introPages }) {
  const [locale, setLocaleState] = useState(() => initialLocale(rawLocale));
  const setLocale = (l) => { setLocaleState(l); store_(() => localStorage.setItem('pg_locale', l)); };
  const ui = UI[locale];
  const [games, setGames] = useState(null);
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  const [game, setGame] = useState(null);

  useEffect(() => {
    fetch(`${api}/api/public/config?key=${encodeURIComponent(store)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const list = d.games.filter((g) => GAMES[g.type] && (!gameType || g.type === gameType));
        setGames(list);
        if (list.length === 1) setGame(list[0]);
      })
      .catch(() => setGames([]));
  }, [store, api, gameType]);

  const current = game || games?.[0];
  // sounds follow the game on screen; music plays only while the game window is open
  useEffect(() => { if (current) sound.configure(current.texts?.sound); }, [current?.id]);
  useEffect(() => { sound.music(open); return () => sound.music(false); }, [open]);
  const openGame = () => { sound.unlock(); setOpen(true); };
  // closing forgets the chosen game when the store has several, so "Play & Win" opens the picker again
  const close = () => { setOpen(false); if (games?.length > 1) setGame(null); };

  // Intro popup: homepage only, every visit (once per browser session), straight after age verification.
  useEffect(() => {
    if (!current) return;
    if (current.texts?.intro?.enabled === false) return;
    if (introPages !== 'all' && !isHome()) return;
    if (store_(() => sessionStorage.getItem('pg_intro_done')) || playedThisWeek(current.id)) return;
    return whenAgeGateClear(ageSelector || DEFAULT_GATE, () => setIntro(true));
  }, [current?.id]);

  const finishIntro = (play) => {
    store_(() => sessionStorage.setItem('pg_intro_done', '1'));
    setIntro(false);
    if (play) openGame();
  };

  if (!games?.length) return null;
  const label = t(current.texts?.triggerLabel, locale) || ui.play;

  return (
    <div style={cssVars(current)}>
      <button className="trigger" onClick={openGame}><span className="trigger-suit" aria-hidden="true">♠</span>{label}</button>
      {intro && !open && <Intro game={current} locale={locale} setLocale={setLocale} onPlay={() => finishIntro(true)} onDecline={() => finishIntro(false)} />}
      {open && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <LangToggle locale={locale} setLocale={setLocale} />
            <SoundToggle locale={locale} />
            <button className="close" aria-label={ui.close} onClick={close}>×</button>
            {game ? <Play key={game.id} game={game} api={api} store={store} locale={locale} onClose={close} onBack={games.length > 1 ? () => setGame(null) : null} /> : (
              <div className="picker">
                <Bulbs />
                <h2 className="marquee">{ui.choose}</h2>
                {games.map((g) => (
                  <button key={g.id} className="pick" onClick={() => { sound.play('chip'); setGame(g); }}>
                    <span className="pick-ico" aria-hidden="true">{GAME_TYPES[g.type]?.icon}</span>
                    <span className="pick-txt">{t(g.texts?.heading, locale) || g.name}<small>{GAME_TYPES[g.type]?.label}</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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

// A row of twinkling marquee bulbs.
const Bulbs = () => <div className="bulbs" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 3) * 0.33}s` }} />)}</div>;

// "Play to Win" popup. Copy comes from the dashboard; blank fields fall back to the defaults.
function Intro({ game, locale, setLocale, onPlay, onDecline }) {
  const cfg = game.texts?.intro || {};
  const d = INTRO_DEFAULTS[locale];
  const pick = (k) => t(cfg[k], locale) || d[k];
  const steps = (cfg.steps || []).map((x) => t(x, locale)).filter(Boolean);
  const list = steps.length ? steps : d.steps;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pg-intro-title" onClick={(e) => e.target === e.currentTarget && onDecline()}>
      <div className="modal intro">
        <LangToggle locale={locale} setLocale={setLocale} />
        <button className="close" aria-label={UI[locale].close} onClick={onDecline}>×</button>
        {cfg.image && <img className="intro-img" src={cfg.image} alt="" />}
        <Bulbs />
        <h2 id="pg-intro-title" className="marquee">{pick('heading')}</h2>
        <div className="suits" aria-hidden="true"><span>♠</span><span>♥</span><span>♦</span><span>♣</span></div>
        <p className="intro-desc">{pick('description')}</p>
        <ol className="steps">{list.map((x, i) => <li key={i}><span>{i + 1}</span>{x}</li>)}</ol>
        <button className="btn play" onClick={onPlay} autoFocus>{pick('playLabel')}</button>
        <button className="btn ghost" onClick={onDecline}>{pick('declineLabel')}</button>
        <p className="fine">{pick('note')}</p>
      </div>
    </div>
  );
}

function Play({ game, api, store, locale, onClose, onBack }) {
  const ui = UI[locale];
  const stages = GAMES[game.type];
  const [stage, setStage] = useState(0);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);   // server response - the outcome is already decided
  const [done, setDone] = useState(false);       // game animation finished
  const heading = t(game.texts?.heading, locale) || game.name;
  const sub = t(game.texts?.subheading, locale);
  const privacy = t(game.texts?.privacy, locale);
  useEffect(() => { if (done && result && !result.lost) sound.play('congrats'); }, [done]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError(ui.invalidEmail);
    setBusy(true); sound.unlock(); sound.play('chip');
    try {
      const res = await fetch(`${api}/api/public/play`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: store, gameId: game.id, email: email.trim(), locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setResult(data); if (!data.test) try { localStorage.setItem(`pg_played_${game.id}`, data.nextPlayAt || data.expiresAt); } catch {} }
      else if (data.error === 'already_played') { try { localStorage.setItem(`pg_played_${game.id}`, data.nextPlayAt); } catch {} setError(`${ui.already} ${ui.comeBack} ${new Date(data.nextPlayAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}.`); }
      else if (data.error === 'invalid_email') setError(ui.invalidEmail);
      else setError(ui.error);
    } catch { setError(ui.error); }
    setBusy(false);
  }

  if (!result) {
    return (
      <form className="screen gate" onSubmit={submit}>
        {onBack && <button type="button" className="back-link" onClick={onBack}>← {ui.otherGames}</button>}
        <Bulbs />
        <h2 className="marquee">{heading}</h2>
        <div className="suits" aria-hidden="true"><span>♠</span><span>♥</span><span>♦</span><span>♣</span></div>
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
    return <div className="screen"><h2 className="marquee">{stage > 0 ? ui.spinHeading : heading}</h2><Stage key={stage} game={game} result={result} locale={locale} onDone={next} /></div>;
  }

  if (result.lost) return (
    <div className="screen result lose">
      <Bulbs />
      <h2 className="marquee">{ui.lose.title}</h2>
      <div className="lose-card">
        <p className="lose-when">{ui.lose.retry} <b>{result.nextPlayText}</b>.</p>
        <p>✉️ {ui.lose.promo}</p>
      </div>
      <button className="btn ghost" onClick={onClose}>{ui.close}</button>
    </div>
  );

  return (
    <div className="screen result">
      <Confetti />
      <Bulbs />
      <h2 className="congrats marquee">{ui.congrats}</h2>
      <p className="muted won">{result.rewards.length > 1 ? ui.yourRewards : ui.yourReward}</p>
      {result.rewards.map((r) => <RewardCard key={r.id} r={r} locale={locale} />)}
      <p className="redeem">🛒 {ui.redeem}</p>
      <p className="fine strong">{ui.limited}</p>
      <p className="fine">{ui.emailed} {result.email}</p>
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

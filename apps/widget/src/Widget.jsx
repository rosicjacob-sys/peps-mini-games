import React, { useEffect, useMemo, useState } from 'react';
import { UI, pickLocale, t, themeFor, GAME_TYPES } from '@peps/shared';
import Wheel from './games/Wheel.jsx';
import Blackjack from './games/Blackjack.jsx';

const GAMES = { wheel: Wheel, blackjack: Blackjack };

function cssVars(game) {
  const th = themeFor(game.type, game.theme);
  const accent = (!GAME_TYPES[game.type]?.fixedTheme && game.brandAccent) || th.accent;
  return {
    '--bg': th.bg, '--surface': th.surface, '--text': th.text, '--muted': th.muted,
    '--accent': accent, '--accent-text': game.brandAccent && !GAME_TYPES[game.type]?.fixedTheme ? '#fff' : th.accentText, '--border': th.border,
  };
}

export default function Widget({ store, api, locale: rawLocale, gameType }) {
  const locale = pickLocale(rawLocale);
  const ui = UI[locale];
  const [games, setGames] = useState(null);
  const [open, setOpen] = useState(false);
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

  if (!games?.length) return null;
  const current = game || games[0];
  const label = t(current.texts?.triggerLabel, locale) || ui.play;

  return (
    <div style={cssVars(current)}>
      <button className="trigger" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <button className="close" aria-label={ui.close} onClick={() => setOpen(false)}>×</button>
            {game ? <Play key={game.id} game={game} api={api} store={store} locale={locale} onClose={() => setOpen(false)} /> : (
              <div className="picker">
                {games.map((g) => (
                  <button key={g.id} className="btn" onClick={() => setGame(g)}>{t(g.texts?.heading, locale) || g.name}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Play({ game, api, store, locale, onClose }) {
  const ui = UI[locale];
  const Game = GAMES[game.type];
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);   // server response — the outcome is already decided
  const [done, setDone] = useState(false);       // game animation finished
  const heading = t(game.texts?.heading, locale) || game.name;
  const sub = t(game.texts?.subheading, locale);
  const privacy = t(game.texts?.privacy, locale);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError(ui.invalidEmail);
    setBusy(true);
    try {
      const res = await fetch(`${api}/api/public/play`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: store, gameId: game.id, email: email.trim(), locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setResult(data);
      else if (data.error === 'already_played') setError(`${ui.already} ${ui.comeBack} ${new Date(data.nextPlayAt).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}.`);
      else if (data.error === 'invalid_email') setError(ui.invalidEmail);
      else setError(ui.error);
    } catch { setError(ui.error); }
    setBusy(false);
  }

  if (!result) {
    return (
      <form className="screen" onSubmit={submit}>
        <h2>{heading}</h2>
        {sub && <p className="muted">{sub}</p>}
        <label className="field">
          <span>{ui.emailLabel}</span>
          <input type="email" required autoComplete="email" inputMode="email" value={email} placeholder={ui.emailPlaceholder} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? ui.sending : ui.start}</button>
        {(privacy || game.texts?.privacyUrl) && (
          <p className="fine">{privacy} {game.texts?.privacyUrl && <a href={game.texts.privacyUrl} target="_blank" rel="noopener noreferrer">{locale === 'fr' ? 'Politique de confidentialité' : 'Privacy policy'}</a>}</p>
        )}
      </form>
    );
  }

  if (!done) return <div className="screen"><h2>{heading}</h2><Game game={game} result={result} locale={locale} onDone={() => setDone(true)} /></div>;

  return (
    <div className="screen result">
      <h2>{result.rewards.length > 1 ? ui.yourRewards : ui.yourReward}</h2>
      {result.rewards.map((r) => <RewardCard key={r.id} r={r} locale={locale} />)}
      <p className="fine strong">{ui.oneUse} {result.expiresText}.</p>
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

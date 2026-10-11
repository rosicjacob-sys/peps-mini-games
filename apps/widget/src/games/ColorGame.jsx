import React, { useEffect, useRef, useState } from 'react';
import { UI, t } from '@peps/shared';
import { COLORS } from '@peps/shared/cards.js';
import { sound } from '../sound.js';

// Perya colour game: each reward sits on a colour; three dice roll; two or three of one colour wins that prize.
export default function ColorGame({ game, result, locale, onDone }) {
  const ui = UI[locale].color;
  const dice = result.script.dice;
  const [faces, setFaces] = useState([0, 1, 2]);
  const [rolling, setRolling] = useState(false); const [settled, setSettled] = useState(0); const [done, setDone] = useState(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach((id) => { if (typeof id === 'function') id(); else { clearTimeout(id); clearInterval(id); } }), []);
  const win = dice.find((d, i, a) => a.indexOf(d) !== a.lastIndexOf(d));

  function roll() {
    if (rolling || done) return;
    setRolling(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const stops = reduce ? [200, 300, 400] : [1300, 1900, 2500];
    const settledRef = { current: 0 };
    const rattle = sound.loop('dice'); timers.current.push(rattle);
    const iv = setInterval(() => setFaces((f) => f.map((x, i) => (i < settledRef.current ? x : Math.floor(Math.random() * COLORS.length)))), 90);
    timers.current.push(iv);
    stops.forEach((ms, i) => timers.current.push(setTimeout(() => {
      settledRef.current = i + 1; setSettled(i + 1); setFaces((f) => f.map((x, k) => (k <= i ? dice[k] : x)));
      sound.play('diceStop');
      if (i === 2) { clearInterval(iv); rattle(); setTimeout(() => sound.play(win === undefined ? 'lose' : 'win'), 250); setRolling(false); setDone(true); timers.current.push(setTimeout(onDone, 1500)); }
    }, ms)));
  }

  return (
    <div className="colorgame">
      <p className="muted">{ui.board}</p>
      <div className="cg-board">
        {COLORS.map((c, i) => {
          const r = game.rewards[i];
          return (
            <div key={c.key} className={`cg-cell ${!r ? 'empty' : ''} ${done && i === win ? 'won' : ''}`} style={{ '--cg': c.hex }}>
              <span className="cg-swatch" aria-hidden="true" />
              <span className="cg-label">{r ? t(r.title, locale) : '-'}</span>
            </div>
          );
        })}
      </div>
      <div className="cg-dice" aria-live="polite">
        {faces.map((f, i) => (
          <div key={i} className={`die ${rolling && i >= settled ? 'rolling' : ''} ${done && f === win ? 'match' : ''}`} style={{ '--cg': COLORS[f].hex }} aria-label={COLORS[f].key}>
            <span className="pip" /><span className="pip" /><span className="pip" />
          </div>
        ))}
      </div>
      {done && (win === undefined ? <div className="bj-result loss">{ui.noMatch}</div> : <div className="bj-result win">{ui.match}</div>)}
      <button className="btn play" disabled={rolling || done} onClick={roll}>{rolling ? ui.rolling : ui.roll}</button>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { UI, t, symbolFor } from '@peps/shared';
import { sound } from '../sound.js';

const ROW = 84;            // px per tile
const STRIP = 26;          // symbols per reel strip
const TARGET_AT = 22;      // where the winning symbol sits in each strip
const STOP = [2200, 2900, 3600]; // ms each reel takes — staggered stops
const PULL = 200;                // reels start as the lever comes down
const LOCK = 0.93;               // share of a reel's time spent spinning; the rest is the settle back onto the line

// The server already chose the reward; all three reels stop on its symbol.
export default function Slots({ game, result, locale, onDone }) {
  const ui = UI[locale];
  // Reels show the rewards themselves; three matching tiles = that reward.
  const tiles = game.rewards.map((r, i) => ({ id: r.id, icon: symbolFor(r, i), title: t(r.title, locale) }));
  const lost = !!result.lost;
  const win = lost ? null : tiles.find((x) => x.id === result.rewards[0].id) || tiles[0];
  // Decoys are the other rewards; never put the winner right next to the pay line on a losing row.
  const others = lost ? tiles : tiles.filter((x) => x.id !== win.id);
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  // decoys: on a win, mostly other rewards and never the winner right next to the pay line; on a loss, any tile
  const pick = (i) => (lost ? rnd(tiles) : others.length && (Math.abs(i - TARGET_AT) === 1 || Math.random() < 0.75) ? rnd(others) : win);
  // a loss: the pay line shows tiles that never all match
  const loseLine = useRef((() => { const a = tiles[Math.floor(Math.random() * tiles.length)]; const rest = tiles.filter((x) => x.id !== a.id); const b = rest.length ? rest[Math.floor(Math.random() * rest.length)] : a; const c = tiles[Math.floor(Math.random() * tiles.length)]; return [a, b, c]; })()).current;
  const strips = useRef([0, 1, 2].map((reel) => Array.from({ length: STRIP }, (_, i) => (i === TARGET_AT ? (lost ? loseLine[reel] : win) : pick(i))))).current;
  const [spinning, setSpinning] = useState(false);
  const [went, setWent] = useState(false);
  const done = useRef(false);
  const timer = useRef(); const sfx = useRef([]); const stripRefs = useRef([]);
  const stopSfx = () => { sfx.current.forEach((f) => (typeof f === 'function' ? f() : clearTimeout(f))); sfx.current = []; };
  useEffect(() => () => { clearTimeout(timer.current); stopSfx(); }, []);

  function go() {
    if (spinning || went) return;
    setSpinning(true); setWent(true);
    // lever clunk, reels clatter, each reel thunks as it stops
    sound.play('lever');
    sfx.current.push(setTimeout(() => sfx.current.push(sound.loop('reels')), PULL));
    STOP.forEach((ms, r) => sfx.current.push(setTimeout(() => { sound.play('reelStop'); if (r === 2) stopSfx(); }, PULL + ms * LOCK)));
    // each reel: a small kick back, a smooth run up to speed and a long slow-down that carries just past the
    // pay line, then settles back onto it
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const end = -(TARGET_AT - 1) * ROW;
    stripRefs.current.forEach((el, r) => {
      if (!el) return;
      const a = el.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(14px)', offset: 0.05, easing: 'cubic-bezier(.45,.05,.2,1)' },
        { transform: `translateY(${end - 16}px)`, offset: LOCK, easing: 'cubic-bezier(.3,.6,.4,1)' },
        { transform: `translateY(${end}px)` },
      ], { duration: reduce ? 600 : STOP[r], delay: reduce ? 0 : PULL, fill: 'forwards' });
      if (r === 2) a.onfinish = finish;
    });
    // transitionend can be skipped (background tab, reduced motion) — never leave the player stuck.
    timer.current = setTimeout(finish, PULL + STOP[2] + 700);
  }
  function finish() {
    if (done.current) return;
    done.current = true; clearTimeout(timer.current);
    setSpinning(false); stopSfx();
    sound.play(lost ? 'lose' : 'win');
    setTimeout(onDone, 800);
  }

  const Tile = ({ x }) => (
    <div className="sym">
      <span className="sym-ico" aria-hidden="true">{x.icon}</span>
      <span className="sym-txt" style={{ fontSize: x.title.length > 18 ? 10 : x.title.length > 12 ? 11 : 12 }}>{x.title}</span>
    </div>
  );

  return (
    <div className="slots">
      <p className="muted slots-hint">{ui.matchThree}</p>
      <div className="cabinet">
        <div className="slots-window" aria-live="polite">
          <div className="slots-line" aria-hidden="true" />
          {strips.map((strip, r) => (
            <div className="reel" key={r}>
              <div className="reel-strip" ref={(el) => { stripRefs.current[r] = el; }}>
                {strip.map((x, i) => <Tile key={i} x={x} />)}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className={`lever ${went ? 'pulled' : ''}`} aria-label={ui.spin} disabled={spinning || went} onClick={go}>
          <span className="lever-knob" /><span className="lever-rod" /><span className="lever-base" />
        </button>
      </div>
      <button className="btn play" disabled={spinning || went} onClick={go}>{spinning ? ui.spinning : ui.spin}</button>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { UI, t, symbolFor } from '@peps/shared';

const ROW = 84;            // px per tile
const STRIP = 26;          // symbols per reel strip
const TARGET_AT = 22;      // where the winning symbol sits in each strip
const STOP = [2200, 2900, 3600]; // ms each reel takes — staggered stops

// The server already chose the reward; all three reels stop on its symbol.
export default function Slots({ game, result, locale, onDone }) {
  const ui = UI[locale];
  // Reels show the rewards themselves; three matching tiles = that reward.
  const tiles = game.rewards.map((r, i) => ({ id: r.id, icon: symbolFor(r, i), title: t(r.title, locale) }));
  const win = tiles.find((x) => x.id === result.rewards[0].id) || tiles[0];
  // Decoys are the other rewards; never put the winner right next to the pay line on a losing row.
  const others = tiles.filter((x) => x.id !== win.id);
  const pick = (i) => (others.length && Math.abs(i - TARGET_AT) === 1 ? others[Math.floor(Math.random() * others.length)] : (others.length && Math.random() < 0.75 ? others[Math.floor(Math.random() * others.length)] : win));
  const strips = useRef([0, 1, 2].map(() => Array.from({ length: STRIP }, (_, i) => (i === TARGET_AT ? win : pick(i))))).current;
  const [spinning, setSpinning] = useState(false);
  const [went, setWent] = useState(false);
  const done = useRef(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  function go() {
    if (spinning || went) return;
    setSpinning(true); setWent(true);
    // transitionend can be skipped (background tab, reduced motion) — never leave the player stuck.
    timer.current = setTimeout(finish, STOP[2] + 500);
  }
  function finish() {
    if (done.current) return;
    done.current = true; clearTimeout(timer.current);
    setSpinning(false);
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
              <div className="reel-strip" onTransitionEnd={r === 2 ? finish : undefined}
                style={{ transform: `translateY(${went ? -(TARGET_AT - 1) * ROW : 0}px)`, transition: went ? `transform ${STOP[r]}ms cubic-bezier(.2,.7,.15,1)` : 'none' }}>
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

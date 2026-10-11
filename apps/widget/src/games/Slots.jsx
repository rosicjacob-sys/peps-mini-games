import React, { useEffect, useRef, useState } from 'react';
import { UI, SLOT_SYMBOLS, symbolFor } from '@peps/shared';

const ROW = 76;            // px per symbol
const STRIP = 26;          // symbols per reel strip
const TARGET_AT = 22;      // where the winning symbol sits in each strip
const STOP = [2200, 2900, 3600]; // ms each reel takes — staggered stops

// The server already chose the reward; all three reels stop on its symbol.
export default function Slots({ game, result, locale, onDone }) {
  const ui = UI[locale];
  const symbols = game.rewards.map((r, i) => symbolFor(r, i));
  const winIndex = Math.max(0, game.rewards.findIndex((r) => r.id === result.rewards[0].id));
  const win = symbols[winIndex];
  // Pool for decoys: this game's symbols, topped up so a single-reward game still looks like a slot machine.
  const pool = useRef([...new Set([...symbols, ...SLOT_SYMBOLS])].slice(0, Math.max(symbols.length, 5))).current;
  const strips = useRef([0, 1, 2].map(() => Array.from({ length: STRIP }, (_, i) => (i === TARGET_AT ? win : pool[Math.floor(Math.random() * pool.length)])))).current;
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

  return (
    <div className="slots">
      <div className="slots-window" aria-live="polite">
        <div className="slots-line" aria-hidden="true" />
        {strips.map((strip, r) => (
          <div className="reel" key={r}>
            <div className="reel-strip" onTransitionEnd={r === 2 ? finish : undefined}
              style={{ transform: `translateY(${went ? -(TARGET_AT - 1) * ROW : 0}px)`, transition: went ? `transform ${STOP[r]}ms cubic-bezier(.2,.7,.15,1)` : 'none' }}>
              {strip.map((s, i) => <div className="sym" key={i}>{s}</div>)}
            </div>
          </div>
        ))}
      </div>
      <button className="btn" disabled={spinning || went} onClick={go}>{spinning ? ui.spinning : ui.spin}</button>
    </div>
  );
}

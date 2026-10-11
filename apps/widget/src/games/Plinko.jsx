import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UI, t, symbolFor } from '@peps/shared';
import { sound } from '../sound.js';

const W = 320, ROWS = 8, SLOTS = ROWS + 1, COL = W / SLOTS;
const TOP = 46, GAP = 29, PEG = 4, BALL = 8;
const SLOT_Y = TOP + (ROWS - 1) * GAP + 26, SLOT_H = 56, H = SLOT_Y + SLOT_H + 4;
const LOSE = '__lose';
const pegX = (row, j) => W / 2 + (j - row / 2) * COL;
const pegY = (row) => TOP + row * GAP;

// Which item sits in each of the 9 slots. With up to 5 items the board is symmetric (item 0 in the middle,
// then outwards); with more, items go left to right so every one of them has a slot.
function layout(items) {
  if (items.length <= 5) return Array.from({ length: SLOTS }, (_, i) => items[Math.abs(i - ROWS / 2) % items.length]);
  return Array.from({ length: SLOTS }, (_, i) => items[i % items.length]);
}

// The server already decided. Pick a slot holding that prize, then a random path of left/right bounces that ends there.
function planPath(slots, targetId) {
  const options = slots.map((s, i) => (s.id === targetId ? i : -1)).filter((i) => i >= 0);
  const end = options[Math.floor(Math.random() * options.length)] ?? Math.floor(SLOTS / 2);
  const moves = Array.from({ length: ROWS }, (_, i) => (i < end ? 1 : 0)).sort(() => Math.random() - 0.5);
  return { end, moves };
}

export default function Plinko({ game, result, locale, onDone }) {
  const ui = UI[locale].plinko;
  const items = useMemo(() => [
    ...game.rewards.map((r, i) => ({ id: r.id, icon: symbolFor(r, i), title: t(r.title, locale) })),
    ...(game.canLose ? [{ id: LOSE, icon: '✖', title: ui.lose }] : []),
  ], [game, locale]);
  const slots = useMemo(() => layout(items), [items]);
  const target = result.lost ? LOSE : result.rewards[0].id;
  const ball = useRef(null); const pegs = useRef({}); const raf = useRef(0); const timers = useRef([]);
  const [state, setState] = useState('ready');     // ready | dropping | landed
  const [landed, setLanded] = useState(-1);
  useEffect(() => () => { cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); }, []);

  function drop() {
    if (state !== 'ready') return;
    setState('dropping'); sound.play('boing');
    const { end, moves } = planPath(slots, target);
    // waypoints: where the ball touches each peg (on top of it), then the slot floor
    const pts = [[W / 2, 10]]; let k = 0;
    for (let r = 0; r < ROWS; r++) { pts.push([pegX(r, k), pegY(r) - PEG - BALL + 1, r, k]); k += moves[r]; }
    pts.push([W / 2 + (end - ROWS / 2) * COL, SLOT_Y + SLOT_H - BALL - 6]);
    const seg = (i) => (i === 0 ? 420 : i === pts.length - 2 ? 360 : 205 + Math.random() * 40);
    let i = 0, t0 = performance.now(), d = seg(0);
    const frame = (now) => {
      let u = (now - t0) / d;
      while (u >= 1 && i < pts.length - 2) {
        i++; t0 += d; d = seg(i); u = (now - t0) / d;
        const [, , row, j] = pts[i];
        sound.play('peg', row);
        const el = pegs.current[`${row}-${j}`]; if (el) { el.classList.remove('hit'); void el.getBBox(); el.classList.add('hit'); }
      }
      if (u >= 1) { u = 1; }
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      // sideways it eases out; downwards it hops a little off the peg, then falls (gravity)
      const x = x0 + (x1 - x0) * (1 - (1 - u) * (1 - u));
      const y = i === 0 ? y0 + (y1 - y0) * u * u : y0 + (y1 - y0) * (1.35 * u * u - 0.35 * u);
      ball.current?.setAttribute('transform', `translate(${x} ${y})`);
      if (u < 1 || i < pts.length - 2) { raf.current = requestAnimationFrame(frame); return; }
      setLanded(end); setState('landed'); sound.play('drop');
      timers.current.push(setTimeout(() => sound.play(result.lost ? 'lose' : 'win'), 250));
      timers.current.push(setTimeout(onDone, 2200));
    };
    raf.current = requestAnimationFrame(frame);
  }

  const used = items.filter((x) => slots.some((s) => s.id === x.id));
  return (
    <div className="plinko">
      <p className="muted">{ui.hint}</p>
      <div className="plinko-board">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Plinko">
          <defs>
            <radialGradient id="pl-ball" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#fff" /><stop offset="35%" stopColor="var(--accent)" /><stop offset="100%" stopColor="color-mix(in srgb, var(--accent) 55%, #000)" /></radialGradient>
          </defs>
          {Array.from({ length: ROWS }, (_, r) => Array.from({ length: r + 1 }, (_, j) => (
            <circle key={`${r}-${j}`} ref={(el) => { pegs.current[`${r}-${j}`] = el; }} className="peg" cx={pegX(r, j)} cy={pegY(r)} r={PEG} />
          )))}
          {slots.map((s, i) => {
            const n = items.indexOf(s); const c = s.id === LOSE ? 'plose' : `p${(n % 6) + 1}`;
            return (
              <g key={i} className={`pslot ${c} ${landed === i ? 'won' : ''}`}>
                <rect x={i * COL + 2} y={SLOT_Y} width={COL - 4} height={SLOT_H} rx="8" />
                <text x={i * COL + COL / 2} y={SLOT_Y + SLOT_H / 2 + 1} textAnchor="middle" dominantBaseline="middle">{s.icon}</text>
              </g>
            );
          })}
          <g ref={ball} className="ball" transform={`translate(${W / 2} 10)`}>
            <circle r={BALL} fill="url(#pl-ball)" stroke="rgba(0,0,0,.25)" strokeWidth="1" />
          </g>
        </svg>
      </div>
      <ul className="plinko-key" aria-label={ui.key}>
        {used.map((x) => {
          const n = items.indexOf(x);
          return <li key={x.id} className={`${x.id === LOSE ? 'plose' : `p${(n % 6) + 1}`} ${landed >= 0 && slots[landed].id === x.id ? 'won' : ''}`}><span aria-hidden="true">{x.icon}</span>{x.title}</li>;
        })}
      </ul>
      {state === 'landed'
        ? <div className={`bj-result ${result.lost ? 'loss' : 'win'}`} role="status">{result.lost ? ui.lose : items.find((x) => x.id === target)?.title}</div>
        : <button className="btn play" disabled={state !== 'ready'} onClick={drop}>{state === 'ready' ? ui.drop : ui.dropping}</button>}
    </div>
  );
}

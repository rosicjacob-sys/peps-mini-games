import React, { useEffect, useRef, useState } from 'react';
import { UI, t, themeFor, categoryOf, POPS } from '@peps/shared';
import { sound } from '../sound.js';

const R = 150;
const WINDUP = 300, SPIN = 4700;   // ms: a 5 s spin from tap to stop
const polar = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [R + r * Math.cos(a), R + r * Math.sin(a)]; };
const CHAR = 0.63;          // bold sans glyph width ≈ 0.63 × font size (capitals are wide)
const AVAIL = R * 0.6;      // radial room for a label, clear of the hub and the rim

// Wrap a label onto up to `maxLines` lines, shrinking the font from 14 to 9 until it fits; ellipsize as a last resort.
function layoutLabel(text, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const wrap = (max) => {
    const lines = [];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if (cur !== undefined && (cur + ' ' + w).length <= max) lines[lines.length - 1] = cur + ' ' + w;
      else lines.push(w);
    }
    return lines;
  };
  for (let f = 14; f >= 9; f -= 0.5) {
    const max = Math.floor(AVAIL / (CHAR * f));
    const lines = wrap(max);
    if (lines.length <= maxLines && lines.every((l) => l.length <= max)) return { lines, f };
  }
  const max = Math.floor(AVAIL / (CHAR * 9));
  const lines = wrap(max).slice(0, maxLines).map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l));
  if (lines.length === maxLines && wrap(max).length > maxLines) lines[maxLines - 1] = lines[maxLines - 1].replace(/…?$/, '…');
  return { lines, f: 9 };
}

// The server already chose the reward(s) in `result`; the wheel only animates to them.
// With several rewards per play the player spins once per reward.
export default function Wheel({ game, result, locale, onDone }) {
  const ui = UI[locale];
  const th = themeFor(game.type, game.theme);
  // the arcade wheel (Lucky Spin): candy-bright slices with readable labels, white rim
  const arcade = categoryOf(game.type) === 'arcade';
  // a standalone wheel that can lose gets a "Try again" slice; a lost play spins once onto it
  const LOSE = '__lose';
  const slices = ['wheel', 'spin'].includes(game.type) && game.canLose ? [...game.rewards, { id: LOSE, title: { en: ui.lose.slice, fr: ui.lose.slice }, lose: true }] : game.rewards;
  const targets = result.lost ? [LOSE] : result.rewards.map((r) => r.id);
  const n = slices.length;
  const step = 360 / n;
  const maxLines = n <= 4 ? 3 : 2;
  const [turn, setTurn] = useState({ rot: 0, tr: 'none' });   // rotation and the transition that gets it there
  const [spinning, setSpinning] = useState(false);
  const phase = useRef('idle');
  const [spin, setSpin] = useState(0);
  const [wonId, setWonId] = useState(null);
  const rotRef = useRef(0);
  const spinningRef = useRef(false);
  const timer = useRef();
  const svgRef = useRef(null); const raf = useRef(0);

  useEffect(() => () => { clearTimeout(timer.current); cancelAnimationFrame(raf.current); }, []);

  // tick each time a rim peg passes the pointer, following the wheel's real (slowing) rotation
  function ticks(pegs) {
    let last = null, total = 0, lastPeg = 0;
    const frame = () => {
      const el = svgRef.current; if (!el || !spinningRef.current) return;
      const tr = getComputedStyle(el).transform;
      if (tr && tr !== 'none') {
        const m = new DOMMatrixReadOnly(tr); const a = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        if (last !== null) { let d = a - last; if (d < -180) d += 360; if (d > 180) d -= 360; total += d; }
        last = a;
        const peg = Math.floor(total / (360 / pegs));
        if (peg !== lastPeg) { lastPeg = peg; sound.play('tick'); }
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  }

  function go() {
    if (spinning) return;
    const target = slices.findIndex((r) => r.id === targets[spin]);
    // Land on a random point inside the slice (not dead centre) for a natural look.
    const within = (Math.random() - 0.5) * step * 0.6;
    const landing = 360 - (target * step + step / 2 + within);
    const from = rotRef.current;
    const next = Math.ceil(from / 360) * 360 + 360 * 6 + landing;
    rotRef.current = next;
    setSpinning(true);
    spinningRef.current = true;
    // a short pull back, then the spin: quick to speed, a long smooth slow-down
    phase.current = 'windup';
    setTurn({ rot: from - 14, tr: `transform ${WINDUP}ms cubic-bezier(.3,0,.4,1)` });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      phase.current = 'spin';
      setTurn({ rot: next, tr: `transform ${SPIN}ms cubic-bezier(.2,.62,.12,1)` });
      // transitionend can be skipped (background tab, reduced motion) - never leave the player stuck.
      timer.current = setTimeout(ended, SPIN + 400);
    }, WINDUP);
    ticks(pegs);
  }

  function ended() {
    if (!spinningRef.current || phase.current !== 'spin') return;
    phase.current = 'idle';
    spinningRef.current = false;
    clearTimeout(timer.current);
    setSpinning(false);
    cancelAnimationFrame(raf.current);
    sound.play(targets[spin] === LOSE ? 'lose' : 'ding');
    setWonId(targets[spin]);
    if (spin + 1 >= targets.length) setTimeout(onDone, 1400);
    else setSpin(spin + 1);
  }

  const rim = arcade ? '#ffffff' : th.rim || th.accent;
  const tones = arcade ? POPS.map((p) => p.bg) : th.wheel || th.slices;
  const pegs = Math.max(16, n * 4);

  return (
    <div className="wheel-wrap">
      <svg className="pointer" viewBox="0 0 40 52" aria-hidden="true">
        <path d="M20,50 L4,10 Q20,-6 36,10 Z" fill={rim} stroke="rgba(0,0,0,.45)" strokeWidth="1.5" />
        <circle cx="20" cy="13" r="6" fill="#b01818" stroke="rgba(0,0,0,.4)" strokeWidth="1" />
        <circle cx="18" cy="11" r="2.2" fill="rgba(255,255,255,.7)" />
      </svg>
      <div className="wheel-box">
        <div className="wheel-shadow" aria-hidden="true" />
        {/* only the slices turn (a cheap GPU rotation); rim, bulbs, gloss and hub are a still frame on top */}
        <div className="wheel-clip">
          <svg ref={svgRef} viewBox={`0 0 ${R * 2} ${R * 2}`} className="wheel wheel-spin" role="img" aria-label="Prize wheel"
            style={{ transform: `rotate(${turn.rot}deg)`, transition: turn.tr }}
            onTransitionEnd={ended}>
        {slices.map((r, i) => {
          const a0 = i * step, a1 = (i + 1) * step;
          const [x0, y0] = polar(a0, R - 7), [x1, y1] = polar(a1, R - 7);
          const k = (n % tones.length === 1 && i === n - 1) ? 1 : i % tones.length;
          const fill = arcade && r.lose ? '#ece8f2' : tones[k];
          const ink = !arcade ? th.text : r.lose ? '#4a4458' : POPS[k].fg;
          const mid = a0 + step / 2;
          const [tx, ty] = polar(mid, R * 0.57);
          const { lines, f } = layoutLabel(t(r.title, locale), maxLines);
          return (
            <g key={r.id} className={r.id === wonId ? 'slice won' : 'slice'}>
              {n === 1 ? <circle cx={R} cy={R} r={R - 7} fill={fill} stroke={rim} strokeWidth="1.5" />
                : <path d={`M${R},${R} L${x0},${y0} A${R - 7},${R - 7} 0 ${step > 180 ? 1 : 0} 1 ${x1},${y1} Z`} fill={fill} stroke={rim} strokeWidth="2.5" />}
              <text x={tx} y={ty} fill={ink} fontSize={f} fontWeight="800" letterSpacing=".06em" style={{ textTransform: 'uppercase' }} textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${mid - 90} ${tx} ${ty})`}>
                {lines.map((l, j) => <tspan key={j} x={tx} dy={j === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em'}>{l}</tspan>)}
              </text>
            </g>
          );
        })}
          </svg>
        </div>
        <svg viewBox={`0 0 ${R * 2} ${R * 2}`} className={`wheel wheel-frame ${spinning ? 'spinning' : ''}`} aria-hidden="true">
        <defs>
          <radialGradient id="pg-gloss" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#fff" stopOpacity=".22" /><stop offset="60%" stopColor="#fff" stopOpacity="0" /></radialGradient>
          <radialGradient id="pg-edge" cx="50%" cy="50%" r="50%"><stop offset="80%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity=".35" /></radialGradient>
          <radialGradient id="pg-hub" cx="40%" cy="35%" r="70%"><stop offset="0%" stopColor="#fff" stopOpacity=".35" /><stop offset="100%" stopColor="#000" stopOpacity=".25" /></radialGradient>
        </defs>
        <circle cx={R} cy={R} r={R - 7} fill="url(#pg-gloss)" pointerEvents="none" />
        <circle cx={R} cy={R} r={R - 7} fill="url(#pg-edge)" pointerEvents="none" />
        {/* bevelled rim: dark outer, gold band, inner highlight */}
        <circle cx={R} cy={R} r={R - 1} fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="2" />
        <circle cx={R} cy={R} r={R - 5} fill="none" stroke={rim} strokeWidth="9" />
        <circle cx={R} cy={R} r={R - 9.5} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
        <circle cx={R} cy={R} r={R - 1.5} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
        {/* marquee bulbs on the rim - they chase while the wheel spins */}
        {Array.from({ length: pegs }, (_, i) => { const [px, py] = polar((360 / pegs) * i, R - 5); return (
          <g key={i} className="bulb" style={{ animationDelay: `${(i % 3) * 0.2}s` }}>
            <circle cx={px} cy={py} r="3.6" fill="#fff7d6" stroke="rgba(0,0,0,.35)" strokeWidth=".8" />
            <circle cx={px - 1} cy={py - 1} r="1.3" fill="#fff" />
          </g>); })}
        {/* hub: gold bevel with a star */}
        <circle cx={R} cy={R} r="30" fill="rgba(0,0,0,.4)" transform="translate(0 2)" />
        <circle cx={R} cy={R} r="29" fill={rim} stroke="rgba(0,0,0,.5)" strokeWidth="1.5" />
        <circle cx={R} cy={R} r="23" fill="var(--accent)" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
        <circle cx={R} cy={R} r="23" fill="url(#pg-hub)" />
        <text x={R} y={R + 1} fill={arcade ? th.rim : rim} fontSize="24" textAnchor="middle" dominantBaseline="middle" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.6))' }}>★</text>
        </svg>
      </div>
      <button className="btn" disabled={spinning} onClick={go}>{spinning ? ui.spinning : targets.length > 1 ? `${ui.spin} (${spin + 1}/${targets.length})` : ui.spin}</button>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { UI, t, themeFor } from '@peps/shared';

const R = 150;
const polar = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [R + r * Math.cos(a), R + r * Math.sin(a)]; };
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// The server already chose the reward(s) in `result`; the wheel only animates to them.
// With several rewards per play the player spins once per reward.
export default function Wheel({ game, result, locale, onDone }) {
  const ui = UI[locale];
  const th = themeFor(game.type, game.theme);
  const n = game.rewards.length;
  const step = 360 / n;
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spin, setSpin] = useState(0);
  const rotRef = useRef(0);
  const spinningRef = useRef(false);
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  function go() {
    if (spinning) return;
    const target = game.rewards.findIndex((r) => r.id === result.rewards[spin].id);
    // Land on a random point inside the slice (not dead centre) for a natural look.
    const within = (Math.random() - 0.5) * step * 0.6;
    const landing = 360 - (target * step + step / 2 + within);
    const base = Math.ceil(rotRef.current / 360) * 360;
    const next = base + 360 * 6 + landing;
    rotRef.current = next;
    setRot(next);
    setSpinning(true);
    spinningRef.current = true;
    // transitionend can be skipped (background tab, reduced motion) — never leave the player stuck.
    clearTimeout(timer.current);
    timer.current = setTimeout(ended, 5400);
  }

  function ended() {
    if (!spinningRef.current) return;
    spinningRef.current = false;
    clearTimeout(timer.current);
    setSpinning(false);
    if (spin + 1 >= result.rewards.length) setTimeout(onDone, 700);
    else setSpin(spin + 1);
  }

  return (
    <div className="wheel-wrap">
      <div className="pointer" aria-hidden="true" />
      <svg viewBox={`0 0 ${R * 2} ${R * 2}`} className="wheel" role="img" aria-label="Prize wheel"
        style={{ transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 5s cubic-bezier(.12,.6,.1,1)' : 'none' }}
        onTransitionEnd={ended}>
        {game.rewards.map((r, i) => {
          const a0 = i * step, a1 = (i + 1) * step;
          const [x0, y0] = polar(a0, R - 4), [x1, y1] = polar(a1, R - 4);
          const fill = n % 2 && i === n - 1 ? th.border : th.slices[i % 2];
          const mid = a0 + step / 2;
          const [tx, ty] = polar(mid, R * 0.62);
          return (
            <g key={r.id}>
              <path d={`M${R},${R} L${x0},${y0} A${R - 4},${R - 4} 0 ${step > 180 ? 1 : 0} 1 ${x1},${y1} Z`} fill={fill} stroke={th.border} strokeWidth="1.5" />
              <text x={tx} y={ty} fill={th.text} fontSize={n > 6 ? 11 : 13} fontWeight="700" textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${mid - 90 + (mid > 180 ? 180 : 0)} ${tx} ${ty})`}>
                {clip(t(r.title, locale), n > 6 ? 14 : 18)}
              </text>
            </g>
          );
        })}
        <circle cx={R} cy={R} r="22" fill="var(--accent)" stroke={th.border} strokeWidth="2" />
      </svg>
      <button className="btn" disabled={spinning} onClick={go}>{spinning ? ui.spinning : result.rewards.length > 1 ? `${ui.spin} (${spin + 1}/${result.rewards.length})` : ui.spin}</button>
    </div>
  );
}

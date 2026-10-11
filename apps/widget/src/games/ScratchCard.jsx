import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UI, t, symbolFor } from '@peps/shared';
import { sound } from '../sound.js';

const SPOTS = 6;
const DECOYS = ['🎈', '🍭', '🌈', '🍩', '🎵', '🧁'];
const BRUSH = 30;        // scratch width, css px
const CLEAR_AT = 0.5;    // share of foil scratched off before the rest falls away
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// The server already decided. A win puts three of the won reward on the card; everything else appears at most twice,
// so the only three-of-a-kind is the prize. A loss never has three of anything (pairs make it a near miss).
function buildSpots(tiles, winId) {
  const win = tiles.find((x) => x.id === winId);
  const spots = win ? [win, win, win] : [];
  const pool = [...shuffle(tiles.filter((x) => x.id !== winId)), ...shuffle(DECOYS.map((icon, i) => ({ id: `decoy${i}`, icon, title: '' })))];
  for (const x of pool) {
    if (spots.length >= SPOTS) break;
    const n = Math.min(SPOTS - spots.length, spots.length <= 3 && Math.random() < 0.6 ? 2 : 1);
    for (let i = 0; i < n; i++) spots.push(x);
  }
  return shuffle(spots);
}

function paintFoil(cv, ui) {
  const ctx = cv.getContext('2d'); const { width: w, height: h } = cv;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#b9c0cc'); g.addColorStop(0.35, '#eef1f5'); g.addColorStop(0.55, '#a9b1be'); g.addColorStop(0.8, '#e4e8ee'); g.addColorStop(1, '#9aa3b1');
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // fine diagonal grain + sparkles
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
  for (let x = -h; x < w; x += 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
  const s = w / 320;
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `${14 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 14; i++) ctx.fillText('✦', ((i * 97) % 100) / 100 * w, ((i * 61) % 100) / 100 * h);
  ctx.fillStyle = 'rgba(60,66,80,.55)'; ctx.font = `700 ${22 * s}px Fredoka, system-ui, sans-serif`;
  ctx.fillText(ui.foil, w / 2, h / 2);
}

export default function ScratchCard({ game, result, locale, onDone }) {
  const ui = UI[locale].scratch;
  const tiles = game.rewards.map((r, i) => ({ id: r.id, icon: symbolFor(r, i), title: t(r.title, locale) }));
  const winId = result.lost ? null : result.rewards[0].id;
  const spots = useRef(buildSpots(tiles, winId)).current;
  const cv = useRef(null); const last = useRef(null); const moves = useRef(0); const lastSfx = useRef(0); const timers = useRef([]);
  const [started, setStarted] = useState(false); const [revealed, setRevealed] = useState(false);
  const label = { foil: locale === 'fr' ? '✨ GRATTEZ ICI ✨' : '✨ SCRATCH HERE ✨' };
  useEffect(() => () => timers.current.forEach((x) => (typeof x === 'number' ? clearTimeout(x) : cancelAnimationFrame(x.raf))), []);

  useLayoutEffect(() => {
    const c = cv.current; if (!c) return;
    const r = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    paintFoil(c, label);
  }, []);

  const pos = (e) => { const r = cv.current.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.current.width / r.width), (e.clientY - r.top) * (cv.current.height / r.height)]; };
  function scrape(a, b) {
    const ctx = cv.current.getContext('2d'); const k = cv.current.width / cv.current.getBoundingClientRect().width;
    ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = BRUSH * k;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    const now = performance.now(); if (now - lastSfx.current > 70) { lastSfx.current = now; sound.play('scratch'); }
    if (++moves.current % 10 === 0 && cleared() > CLEAR_AT) reveal();
  }
  // share of the foil already scratched off (sampled on a coarse grid)
  function cleared() {
    const c = cv.current; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let gone = 0, n = 0; const step = 8;
    for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) { n++; if (d[(y * c.width + x) * 4 + 3] < 60) gone++; }
    return gone / n;
  }
  function reveal() {
    if (revealed || timers.current.done) return; timers.current.done = true;
    setRevealed(true);
    timers.current.push(setTimeout(() => sound.play(winId ? 'win' : 'lose'), 350));
    timers.current.push(setTimeout(onDone, 2300));
  }
  const down = (e) => { if (revealed) return; e.preventDefault(); cv.current.setPointerCapture?.(e.pointerId); setStarted(true); last.current = pos(e); scrape(last.current, last.current); };
  const move = (e) => { if (!last.current || revealed) return; const p = pos(e); scrape(last.current, p); last.current = p; };
  const up = () => { if (!last.current) return; last.current = null; if (cleared() > CLEAR_AT) reveal(); };

  // "Scratch it for me": a zig-zag of strokes across the card, then the rest falls away
  function auto() {
    if (revealed || timers.current.auto) return; timers.current.auto = true; setStarted(true);
    const c = cv.current; const W = c.width, H = c.height; const rows = 5; const t0 = performance.now(); const dur = 1500;
    const at = (f) => { const seg = f * rows; const i = Math.min(rows - 1, Math.floor(seg)); const u = seg - i; const y = (i + 0.5) / rows * H; const x = (i % 2 ? 1 - u : u) * W; return [x, y]; };
    let prev = at(0); const job = { raf: 0 }; timers.current.push(job);
    const step = (now) => { const f = Math.min(1, (now - t0) / dur); const p = at(f); scrape(prev, p); prev = p; if (f < 1 && !timers.current.done) job.raf = requestAnimationFrame(step); else reveal(); };
    job.raf = requestAnimationFrame(step);
  }

  const matched = (x) => revealed && winId && x.id === winId;
  return (
    <div className="scratch">
      <div className="ticket">
        <div className="ticket-head"><b>{ui.title}</b><span>{ui.hint}</span></div>
        <div className="scratch-area">
          <div className="spots">
            {spots.map((x, i) => (
              <div key={i} className={`spot ${matched(x) ? 'match' : ''} ${revealed && !matched(x) ? 'dim' : ''}`} style={{ '--i': i }}>
                <span className="spot-ico" aria-hidden="true">{x.icon}</span>
                {x.title && <span className="spot-txt">{x.title}</span>}
              </div>
            ))}
          </div>
          <canvas ref={cv} className={`foil ${revealed ? 'gone' : ''}`} aria-label={label.foil}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
        </div>
      </div>
      {revealed
        ? <div className={`bj-result ${winId ? 'win' : 'loss'}`} role="status">{winId ? ui.win : ui.lose}</div>
        : <button className="btn play" onClick={auto} disabled={!!timers.current.auto}>{ui.auto}</button>}
    </div>
  );
}

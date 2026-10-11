import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { sound } from '../sound.js';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const FLY = 520, FLIP = 260;
const EASE = 'cubic-bezier(.22,.7,.25,1)';
// back overlay: shown, then gone halfway through the flip (when the card is edge-on)
const backFrames = (at) => [{ opacity: 1 }, { opacity: 1, offset: at }, { opacity: 0, offset: at }, { opacity: 0 }];

// where a card sits on the table, ignoring any animation transform (offsets add up to the felt)
function tablePos(el) {
  const felt = el.closest('.deal-zone'); let x = 0, y = 0;
  for (let n = el; n && n !== felt; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return [x, y];
}

// A playing card; `hidden` shows the back. Shared by every card game.
// On mount it is dealt: it slides face down off the table's deck (`.deal-zone .deck`) to its place after `delay` ms,
// and a face-up card flips over as it lands. When `hidden` turns false it flips face up.
export function Card({ c, hidden, delay = 0, hi }) {
  const ref = useRef(null); const up = !hidden && !!c; const wasUp = useRef(up);
  useLayoutEffect(() => {
    // swish as it leaves the deck, a snap as it turns over
    const timers = [setTimeout(() => sound.play('card'), delay)];
    if (up) timers.push(setTimeout(() => sound.play('flip'), delay + FLY + FLIP / 2));
    const stop = () => timers.forEach(clearTimeout);
    const el = ref.current; const top = el?.closest('.deal-zone')?.querySelector('.deck .deck-top');
    if (!el || !top || reduced()) return stop;
    const a = top.getBoundingClientRect(), b = el.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const s = top.offsetWidth / el.offsetWidth;
    const from = `translate(${dx}px, ${dy}px) rotate(-7deg) scale(${s})`;
    // halfway: lifted a little off the felt (slightly bigger, gently turning), for a soft arc rather than a straight slide
    const arc = `translate(${dx * 0.42}px, ${dy * 0.42 - 10}px) rotate(-3deg) scale(${(s + 1.08) / 2})`;
    const opts = { delay, easing: EASE, fill: 'backwards' };
    if (!up) { el.animate([{ transform: from }, { transform: arc, offset: 0.4 }, { transform: 'translate(0, 0) scale(1.03)', offset: 0.85 }, { transform: 'none' }], { ...opts, duration: FLY }); return stop; }
    const total = FLY + FLIP, land = FLY / total, mid = (FLY + FLIP / 2) / total;
    el.animate([
      { transform: from },
      { transform: arc, offset: land * 0.4 },
      { transform: 'scale(1.05)', offset: land },
      { transform: 'scale(0.02, 1.06)', offset: mid, easing: 'ease-out' },
      { transform: 'none' },
    ], { ...opts, duration: total });
    el.querySelector('.cback')?.animate(backFrames(mid), { ...opts, duration: total, easing: 'linear' });
    return stop;
  }, []);
  useLayoutEffect(() => {
    if (!wasUp.current && up) sound.play('flip');
    if (!wasUp.current && up && ref.current && !reduced()) {
      ref.current.animate([{ transform: 'none' }, { transform: 'scale(0.02, 1.06)', easing: 'ease-out' }, { transform: 'none' }], { duration: FLIP * 1.4, easing: 'ease-in' });
      ref.current.querySelector('.cback')?.animate(backFrames(0.5), { duration: FLIP * 1.4 });
    }
    wasUp.current = up;
  }, [up]);
  // when a card joins the hand the row re-centres: glide the cards already there instead of letting them jump
  const pos = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const now = tablePos(el), was = pos.current; pos.current = now;
    if (!was || reduced()) return;
    const dx = was[0] - now[0], dy = was[1] - now[1];
    if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 380, easing: EASE, composite: 'add' });
  });
  if (!up) return <div ref={ref} className="bj-card back" />;
  const red = c.s === '♥' || c.s === '♦';
  return (
    <div ref={ref} className={`bj-card ${red ? 'red' : ''} ${hi ? 'hi' : ''}`}>
      <span className="ci tl">{c.r}<i>{c.s}</i></span>
      <span className="cs">{c.s}</span>
      <span className="ci br">{c.r}<i>{c.s}</i></span>
      <span className="cback" aria-hidden="true" />
    </div>
  );
}
// A deck of cards on the table; every card is dealt from it. Card-sized, with visible thickness.
export const Deck = ({ className = '' }) => <div className={`deck ${className}`} aria-hidden="true"><i className="deck-body" /><i className="deck-top" /></div>;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Standard deal order for two hands: first card each, then second card each (≈350 ms apart).
export const DEAL = [0, 350, 700, 1050];
export const DEAL_DONE = DEAL[3] + FLY + FLIP + 100;
// time for one extra card (a hit or a third card) to land and flip
export const CARD_MS = FLY + FLIP + 150;
// How many of a hand's `n` cards have landed: a new card counts once it has flown in and flipped, so scores never run ahead of the cards.
export function useLanded(n) {
  const [v, setV] = useState(n);
  useEffect(() => { if (n <= v) { setV(n); return undefined; } const id = setTimeout(() => setV(n), CARD_MS); return () => clearTimeout(id); }, [n]);
  return Math.min(v, n);
}

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const FLY = 440, FLIP = 260;
// back overlay: shown, then gone halfway through the flip (when the card is edge-on)
const backFrames = (at) => [{ opacity: 1 }, { opacity: 1, offset: at }, { opacity: 0, offset: at }, { opacity: 0 }];

// A playing card; `hidden` shows the back. Shared by every card game.
// On mount it is dealt: it slides face down off the table's deck (`.deal-zone .deck`) to its place after `delay` ms,
// and a face-up card flips over as it lands. When `hidden` turns false it flips face up.
export function Card({ c, hidden, delay = 0, hi }) {
  const ref = useRef(null); const up = !hidden && !!c; const wasUp = useRef(up);
  useLayoutEffect(() => {
    const el = ref.current; const top = el?.closest('.deal-zone')?.querySelector('.deck .deck-top');
    if (!el || !top || reduced()) return;
    const a = top.getBoundingClientRect(), b = el.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const from = `translate(${dx}px, ${dy}px) rotate(-7deg) scale(${top.offsetWidth / el.offsetWidth})`;
    const opts = { delay, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' };
    if (!up) { el.animate([{ transform: from }, { transform: 'translate(0, 0) scale(1.05)', offset: 0.85 }, { transform: 'none' }], { ...opts, duration: FLY }); return; }
    const total = FLY + FLIP, land = FLY / total, mid = (FLY + FLIP / 2) / total;
    el.animate([
      { transform: from },
      { transform: 'scale(1.06)', offset: land },
      { transform: 'scale(0.02, 1.06)', offset: mid, easing: 'ease-out' },
      { transform: 'none' },
    ], { ...opts, duration: total });
    el.querySelector('.cback')?.animate(backFrames(mid), { ...opts, duration: total, easing: 'linear' });
  }, []);
  useLayoutEffect(() => {
    if (!wasUp.current && up && ref.current && !reduced()) {
      ref.current.animate([{ transform: 'none' }, { transform: 'scale(0.02, 1.06)', easing: 'ease-out' }, { transform: 'none' }], { duration: FLIP * 1.4, easing: 'ease-in' });
      ref.current.querySelector('.cback')?.animate(backFrames(0.5), { duration: FLIP * 1.4 });
    }
    wasUp.current = up;
  }, [up]);
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

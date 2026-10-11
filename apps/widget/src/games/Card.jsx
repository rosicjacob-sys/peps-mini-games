import React, { useLayoutEffect, useRef } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A playing card; `hidden` shows the back. Shared by every card game.
// On mount it is dealt: it flies from the table's deck (`.deal-zone .deck`) to its place, after `delay` ms.
// When `hidden` turns false it flips face up.
export function Card({ c, hidden, delay = 0, hi }) {
  const ref = useRef(null); const wasHidden = useRef(hidden || !c);
  useLayoutEffect(() => {
    const el = ref.current; const deck = el?.closest('.deal-zone')?.querySelector('.deck');
    if (!el || !deck || reduced()) return;
    const a = deck.getBoundingClientRect(), b = el.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    el.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(-28deg) scale(.62)`, opacity: 0.6 },
      { transform: 'translate(0, 0) rotate(4deg) scale(1.04)', opacity: 1, offset: 0.82 },
      { transform: 'none', opacity: 1 },
    ], { duration: 520, delay, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
  }, []);
  useLayoutEffect(() => {
    const shown = !hidden && !!c;
    if (wasHidden.current && shown && ref.current && !reduced()) {
      ref.current.animate([{ transform: 'rotateY(90deg) scale(1.05)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
    }
    wasHidden.current = !shown;
  }, [hidden, c]);
  if (hidden || !c) return <div ref={ref} className="bj-card back" />;
  const red = c.s === '♥' || c.s === '♦';
  return (
    <div ref={ref} className={`bj-card ${red ? 'red' : ''} ${hi ? 'hi' : ''}`}>
      <span className="ci tl">{c.r}<i>{c.s}</i></span>
      <span className="cs">{c.s}</span>
      <span className="ci br">{c.r}<i>{c.s}</i></span>
    </div>
  );
}
// The dealer's shoe; cards are dealt from it.
export const Deck = ({ className = '' }) => <div className={`bj-shoe deck ${className}`} aria-hidden="true"><i /><i /><i /></div>;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Standard deal order for two hands: first card each, then second card each (≈350 ms apart).
export const DEAL = [0, 350, 700, 1050];
export const DEAL_DONE = 1500;

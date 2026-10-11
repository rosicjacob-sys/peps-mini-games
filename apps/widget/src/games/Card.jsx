import React from 'react';

// A playing card; `hidden` shows the back. Shared by every card game.
export function Card({ c, hidden, delay = 0, hi }) {
  if (hidden || !c) return <div className="bj-card back" style={{ animationDelay: `${delay}ms` }} />;
  const red = c.s === '♥' || c.s === '♦';
  return (
    <div className={`bj-card ${red ? 'red' : ''} ${hi ? 'hi' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <span className="ci tl">{c.r}<i>{c.s}</i></span>
      <span className="cs">{c.s}</span>
      <span className="ci br">{c.r}<i>{c.s}</i></span>
    </div>
  );
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

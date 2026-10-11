import React, { useEffect, useRef, useState } from 'react';
import { UI, t } from '@peps/shared';
import { HANDS } from '@peps/shared/cards.js';
import { Card, Deck, wait } from './Card.jsx';

// Five-card poker, no draw: the paytable maps each hand to a reward (rarer reward → better hand). DEAL sends five
// cards face down from the deck, then they flip one by one; a loss shows no winning hand.
export default function Poker({ game, result, locale, onDone }) {
  const ui = UI[locale]; const p = ui.poker; const s = result.script;
  const [dealt, setDealt] = useState(false); const [flipped, setFlipped] = useState(0); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);
  const table = [...game.rewards].filter((r) => r.hand).sort((a, b) => HANDS.indexOf(b.hand) - HANDS.indexOf(a.hand));
  const lost = s.hand === 'high';

  async function deal() {
    if (busy || done) return; setBusy(true); setDealt(true);
    await wait(5 * 180 + 500);
    for (let i = 1; i <= 5; i++) { if (!alive.current) return; setFlipped(i); await wait(i === 4 ? 950 : 520); }
    if (!alive.current) return; setBusy(false); setDone(true);
    setTimeout(() => alive.current && onDone(), 1900);
  }

  return (
    <div className="poker">
      <div className="paytable" aria-label={p.paytable}>
        <div className="pt-head">{p.paytable}</div>
        {table.map((r) => (
          <div key={r.id} className={`pt-row ${done && r.hand === s.hand ? 'won' : ''}`}>
            <span>{p.hands[r.hand]}</span><b>{t(r.title, locale)}</b>
          </div>
        ))}
      </div>
      <div className="table-rail"><div className="table-felt poker-felt deal-zone">
        <Deck />
        <div className="bj-cards">
          {dealt ? s.cards.map((c, i) => <Card key={i} c={i < flipped ? c : null} hidden={i >= flipped} delay={i * 180} hi={done && !lost} />)
            : Array.from({ length: 5 }, (_, i) => <div key={i} className="card-slot" />)}
        </div>
        {done && <div className={`hand-name ${lost ? 'lost' : ''}`}>{p.hands[s.hand]}</div>}
      </div></div>
      <button className="btn play" disabled={busy || done} onClick={deal}>{busy ? p.dealing : p.deal}</button>
    </div>
  );
}

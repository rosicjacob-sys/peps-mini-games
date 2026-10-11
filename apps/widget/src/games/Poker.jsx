import React, { useEffect, useRef, useState } from 'react';
import { UI, t } from '@peps/shared';
import { HANDS } from '@peps/shared/cards.js';
import { Card, wait } from './Card.jsx';

// Five-card poker, no draw: the paytable maps each hand to a reward (rarer reward → better hand); the five cards
// flip one by one and the hand shown is the one for the reward won.
export default function Poker({ game, result, locale, onDone }) {
  const ui = UI[locale]; const p = ui.poker; const s = result.script;
  const [flipped, setFlipped] = useState(0); const [dealing, setDealing] = useState(false); const [done, setDone] = useState(false);
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);
  const table = [...game.rewards].filter((r) => r.hand).sort((a, b) => HANDS.indexOf(b.hand) - HANDS.indexOf(a.hand));

  async function deal() {
    if (dealing || done) return; setDealing(true);
    for (let i = 1; i <= 5; i++) { await wait(i === 5 ? 900 : 550); if (!alive.current) return; setFlipped(i); }
    await wait(500); if (!alive.current) return; setDealing(false); setDone(true);
    setTimeout(() => alive.current && onDone(), 1700);
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
      <div className="table-rail"><div className="table-felt poker-felt">
        <div className="bj-cards">{s.cards.map((c, i) => <Card key={i} c={c} hidden={i >= flipped} hi={done} />)}</div>
        {done && <div className="hand-name">{p.hands[s.hand]}</div>}
      </div></div>
      <button className="btn play" disabled={dealing || done} onClick={deal}>{dealing ? p.dealing : p.deal}</button>
    </div>
  );
}

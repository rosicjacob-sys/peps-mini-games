import React, { useEffect, useRef, useState } from 'react';
import { UI } from '@peps/shared';
import { points, baccaratResolve } from '@peps/shared/cards.js';
import { Card, wait } from './Card.jsx';

// Baccarat: the player bets Player, Banker or Tie; the hand is dealt with the standard third-card rules and the
// server has a deal ready for every bet, so the bet always wins. Then the wheel decides the reward.
export default function Baccarat({ result, locale, onDone }) {
  const ui = UI[locale]; const b = ui.bac;
  const [bet, setBet] = useState(null); const [shown, setShown] = useState({ player: [], banker: [] }); const [done, setDone] = useState(false);
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);

  async function place(k) {
    if (bet) return; setBet(k);
    const r = baccaratResolve(result.script.deals[k]);
    const order = [['player', 0], ['banker', 0], ['player', 1], ['banker', 1]];
    if (r.player[2]) order.push(['player', 2]); if (r.banker[2]) order.push(['banker', 2]);
    for (const [side, i] of order) { await wait(650); if (!alive.current) return; setShown((s) => ({ ...s, [side]: r[side].slice(0, i + 1) })); }
    await wait(700); if (alive.current) setDone(true);
  }

  const Side = ({ k }) => (
    <div className={`bac-side ${done && bet === k ? 'won' : ''}`}>
      <div className="bj-label">{b[k]} {shown[k].length >= 2 ? <b>{points(shown[k])}</b> : null}</div>
      <div className="bj-cards">{shown[k].length ? shown[k].map((c, i) => <Card key={i} c={c} />) : <><Card hidden /><Card hidden /></>}</div>
    </div>
  );

  return (
    <div className="bj">
      <div className="table-rail"><div className="table-felt">
        <div className="bac-hands"><Side k="player" /><Side k="banker" /></div>
        <div className="bac-bets">
          {['player', 'tie', 'banker'].map((k) => (
            <button key={k} className={`bet-spot ${bet === k ? 'on' : ''}`} disabled={!!bet} onClick={() => place(k)}>
              <b>{b[k]}</b><small>{b.pays[k]}</small>{bet === k && <span className="bet-chip" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div></div>
      {!bet && <p className="muted center">{b.pick}</p>}
      {done && (
        <>
          <div className="bj-result win">{b.wins[bet]} {b.yourBet}</div>
          <button className="btn play" onClick={onDone}>{ui.bjNext}</button>
        </>
      )}
    </div>
  );
}

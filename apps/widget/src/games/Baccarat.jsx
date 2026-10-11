import React, { useEffect, useRef, useState } from 'react';
import { UI } from '@peps/shared';
import { points, baccaratResolve } from '@peps/shared/cards.js';
import { Card, Deck, wait } from './Card.jsx';

// Baccarat: the player bets Player, Banker or Tie; the hand is dealt with the standard third-card rules from the
// server's deal for that bet (built to win or to lose, as the odds decided). A win goes on to the wheel.
export default function Baccarat({ result, locale, onDone }) {
  const ui = UI[locale]; const b = ui.bac;
  const [bet, setBet] = useState(null); const [shown, setShown] = useState({ player: [], banker: [] }); const [winner, setWinner] = useState(null);
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);

  async function place(k) {
    if (bet) return; setBet(k);
    const r = baccaratResolve(result.script.deals[k]);
    const order = [['player', 0], ['banker', 0], ['player', 1], ['banker', 1]];
    if (r.player[2]) order.push(['player', 2]); if (r.banker[2]) order.push(['banker', 2]);
    await wait(300);
    for (const [side, i] of order) { if (!alive.current) return; setShown((s) => ({ ...s, [side]: r[side].slice(0, i + 1) })); await wait(i === 2 ? 900 : 650); }
    await wait(400); if (alive.current) setWinner(r.winner);
  }
  const won = winner && winner === bet;

  const Side = ({ k }) => (
    <div className={`bac-side ${winner === k ? 'won' : ''}`}>
      <div className="bj-label">{b[k]} {shown[k].length >= 2 ? <b>{points(shown[k])}</b> : null}</div>
      <div className="bj-cards">
        {shown[k].map((c, i) => <Card key={i} c={c} />)}
        {Array.from({ length: Math.max(0, 2 - shown[k].length) }, (_, i) => <div key={`slot${i}`} className="card-slot" />)}
      </div>
    </div>
  );

  return (
    <div className="bj">
      <div className="table-rail"><div className="table-felt deal-zone">
        <Deck className="top-center" />
        <div className="bac-hands"><Side k="player" /><Side k="banker" /></div>
        <div className="bac-bets">
          {['player', 'tie', 'banker'].map((k) => (
            <button key={k} className={`bet-spot ${bet === k ? 'on' : ''}`} disabled={!!bet} onClick={() => place(k)}>
              <b>{b[k]}</b>{bet === k && <span className="bet-chip" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div></div>
      {!bet && <p className="muted center">{b.pick}</p>}
      {winner && (
        <>
          <div className={`bj-result ${won ? 'win' : 'loss'}`}>{b.wins[winner]} {won ? b.yourBet : b.betLoses}</div>
          <button className="btn play" onClick={onDone}>{won ? ui.bjNext : ui.lose.cont}</button>
        </>
      )}
    </div>
  );
}

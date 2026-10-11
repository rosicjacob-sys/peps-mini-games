import React, { useEffect, useRef, useState } from 'react';
import { UI } from '@peps/shared';
import { points, baccaratResolve } from '@peps/shared/cards.js';
import { Card, Deck, wait, DEAL, DEAL_DONE, CARD_MS, useLanded } from './Card.jsx';

// Baccarat: the player bets Player, Banker or Tie; the hand is dealt with the standard third-card rules from the
// server's deal for that bet (built to win or to lose, as the odds decided). A win goes on to the wheel.
export default function Baccarat({ result, locale, onDone }) {
  const ui = UI[locale]; const b = ui.bac;
  const [bet, setBet] = useState(null); const [round, setRound] = useState(null); const [n, setN] = useState({ player: 0, banker: 0 });
  const [ready, setReady] = useState(false); const [winner, setWinner] = useState(null);
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);
  const landed = { player: useLanded(n.player), banker: useLanded(n.banker) };

  // Deal like Lucky 9: player, banker, player, banker from the deck, then any third cards one at a time.
  async function place(k) {
    if (bet) return; setBet(k);
    const r = baccaratResolve(result.script.deals[k]); setRound(r);
    await wait(250); if (!alive.current) return;
    setN({ player: 2, banker: 2 });
    await wait(DEAL_DONE); if (!alive.current) return; setReady(true);
    for (const side of ['player', 'banker']) {
      if (!r[side][2]) continue;
      await wait(700); if (!alive.current) return; setN((x) => ({ ...x, [side]: 3 })); await wait(CARD_MS);
    }
    await wait(500); if (alive.current) setWinner(r.winner);
  }
  const won = winner && winner === bet;
  // the first two cards of each hand go out in DEAL order: player 0, banker 0, player 1, banker 1
  const delayFor = (k, i) => (i < 2 ? DEAL[i * 2 + (k === 'banker' ? 1 : 0)] : 0);

  // a plain render function, not a component, so cards are not re-mounted (and re-dealt) on every update
  const side = (k) => (
    <div key={k} className={`bac-side ${winner === k ? 'won' : ''}`}>
      <div className="bj-label">{b[k]} {ready ? <b>{points(round[k].slice(0, landed[k]))}</b> : null}</div>
      <div className="bj-cards">
        {round ? round[k].slice(0, n[k]).map((c, i) => <Card key={i} c={c} delay={delayFor(k, i)} />) : null}
        {Array.from({ length: Math.max(0, 2 - n[k]) }, (_, i) => <div key={`slot${i}`} className="card-slot" />)}
      </div>
    </div>
  );

  return (
    <div className="bj">
      <div className="table-rail"><div className="table-felt deal-zone">
        <Deck className="top-center" />
        <div className="bac-hands">{side('player')}{side('banker')}</div>
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

import React, { useEffect, useRef, useState } from 'react';
import { UI } from '@peps/shared';
import { points, lucky9Round, lucky9Natural9 } from '@peps/shared/cards.js';
import { Card, Deck, wait, DEAL, DEAL_DONE } from './Card.jsx';

// Lucky 9: closest to 9 wins. The player may draw a third card unless they hold a natural 9; the banker draws on
// 0–5 and never finishes on 9. The deal is built so the server's result (win or loss) holds either way.
export default function Lucky9({ result, locale, onDone }) {
  const ui = UI[locale]; const l = ui.l9; const s = result.script;
  const nat9 = lucky9Natural9(s.player);
  const [phase, setPhase] = useState('player'); const [drew, setDrew] = useState(false); const [ready, setReady] = useState(false);
  const [banker, setBanker] = useState(s.banker.slice(0, 2)); const [reveal, setReveal] = useState(false); const [outcome, setOutcome] = useState(null);
  const alive = useRef(true);
  useEffect(() => { const id = setTimeout(() => setReady(true), DEAL_DONE); return () => { alive.current = false; clearTimeout(id); }; }, []);
  const player = drew ? [...s.player, s.draw] : s.player;

  async function finish(d) {
    setPhase('banker'); const round = lucky9Round(s, d);
    await wait(500); if (!alive.current) return; setReveal(true);
    if (round.banker.length > 2) { await wait(900); if (!alive.current) return; setBanker(round.banker); }
    await wait(700); if (!alive.current) return; setOutcome(round.outcome); setPhase('done');
  }
  useEffect(() => { if (nat9) { const id = setTimeout(() => finish(false), DEAL_DONE + 600); return () => clearTimeout(id); } }, []);
  const win = outcome === 'win';

  return (
    <div className="bj">
      <div className="table-rail"><div className="table-felt deal-zone">
        <Deck />
        <div className="bj-row"><div className="bj-label">{l.banker} {reveal ? <b>{points(banker)}</b> : null}</div>
          <div className="bj-cards">
            <Card key="b0" c={banker[0]} delay={DEAL[1]} />
            <Card key="b1" c={reveal ? banker[1] : null} hidden={!reveal} delay={DEAL[3]} />
            {reveal && banker[2] && <Card key="b2" c={banker[2]} />}
          </div></div>
        <div className="felt-mark">{l.closest}</div>
        <div className="bj-row"><div className="bj-cards">{player.map((c, i) => <Card key={`p${i}`} c={c} delay={i === 0 ? DEAL[0] : i === 1 ? DEAL[2] : 0} />)}</div>
          <div className="bj-label">{l.you} <b>{points(player)}</b></div></div>
      </div></div>
      {phase === 'done' ? (
        <>
          <div className={`bj-result ${win ? 'win' : 'loss'}`}>{win ? (nat9 ? l.natural : l.win) : l.bankerWins}</div>
          <button className="btn play" onClick={onDone}>{win ? ui.bjNext : ui.lose.cont}</button>
        </>
      ) : (
        <div className="bj-actions">
          <button className="btn" disabled={!ready || phase !== 'player' || nat9} onClick={() => { setDrew(true); setTimeout(() => finish(true), 800); }}>{l.draw}</button>
          <button className="btn ghost" disabled={!ready || phase !== 'player' || nat9} onClick={() => finish(false)}>{l.stand}</button>
        </div>
      )}
    </div>
  );
}

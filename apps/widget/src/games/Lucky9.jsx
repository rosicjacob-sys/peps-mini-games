import React, { useEffect, useRef, useState } from 'react';
import { UI } from '@peps/shared';
import { points, lucky9Round, lucky9Natural } from '@peps/shared/cards.js';
import { Card, wait } from './Card.jsx';

// Lucky 9: closest to 9 wins. The player draws or stands; the banker draws on 0–5. The deal is built so the
// player wins either way, then the wheel decides the reward.
export default function Lucky9({ result, locale, onDone }) {
  const ui = UI[locale]; const l = ui.l9; const s = result.script;
  const natural = lucky9Natural(s.player);
  const [phase, setPhase] = useState('player'); const [drew, setDrew] = useState(false);
  const [banker, setBanker] = useState(s.banker.slice(0, 2)); const [reveal, setReveal] = useState(false);
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);
  const player = drew ? [...s.player, s.draw] : s.player;

  async function finish(d) {
    setPhase('banker'); const round = lucky9Round(s, d);  // banker stays on two cards after a player natural
    await wait(500); if (!alive.current) return; setReveal(true);
    if (round.banker.length > 2) { await wait(800); if (!alive.current) return; setBanker(round.banker); }
    await wait(600); if (alive.current) setPhase('done');
  }
  useEffect(() => { if (natural) { const id = setTimeout(() => finish(false), 900); return () => clearTimeout(id); } }, []);

  return (
    <div className="bj">
      <div className="table-rail"><div className="table-felt">
        <div className="bj-row"><div className="bj-label">{l.banker} {reveal ? <b>{points(banker)}</b> : null}</div>
          <div className="bj-cards"><Card c={banker[0]} />{reveal ? banker.slice(1).map((c, i) => <Card key={i} c={c} />) : <Card hidden />}</div></div>
        <div className="felt-mark">{l.closest}</div>
        <div className="bj-row"><div className="bj-cards">{player.map((c, i) => <Card key={i} c={c} delay={i < 2 ? i * 120 : 0} />)}</div>
          <div className="bj-label">{l.you} <b>{points(player)}</b></div></div>
      </div></div>
      {phase === 'done' ? (
        <>
          <div className="bj-result win">{natural ? `${l.natural} ${points(s.player)}!` : l.win}</div>
          <button className="btn play" onClick={onDone}>{ui.bjNext}</button>
        </>
      ) : (
        <div className="bj-actions">
          <button className="btn" disabled={phase !== 'player' || natural} onClick={() => { setDrew(true); setTimeout(() => finish(true), 700); }}>{l.draw}</button>
          <button className="btn ghost" disabled={phase !== 'player' || natural} onClick={() => finish(false)}>{l.stand}</button>
        </div>
      )}
    </div>
  );
}

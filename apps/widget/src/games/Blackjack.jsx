import React, { useEffect, useRef, useState } from 'react';
import { UI } from '@peps/shared';
import { handValue, canHit, playRound, isBlackjack } from '@peps/shared/blackjack.js';
import { Card, Deck, DEAL, DEAL_DONE } from './Card.jsx';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Table dressing: the dealer's shoe (top right) and a chip stack (bottom left).
const Chips = () => <div className="bj-chips" aria-hidden="true"><i /><i /><i /></div>;
const ArcText = ({ text }) => (
  <svg className="bj-arc" viewBox="0 0 360 100" aria-hidden="true">
    <defs><path id="bj-arc-path" d="M6,94 A230,230 0 0 1 354,94" /></defs>
    <text><textPath href="#bj-arc-path" startOffset="50%" textAnchor="middle">{text}</textPath></text>
  </svg>
);

// The server dealt a script that ends in the decided result whatever the player picks.
// Here the player just chooses hit/stand; the dealer plays out from the server's cards.
export default function Blackjack({ result, locale, onDone }) {
  const ui = UI[locale];
  const script = result.script;
  const [hits, setHits] = useState(0);
  const [phase, setPhase] = useState('player');    // player | dealer | done
  const [dealer, setDealer] = useState([script.dealerUp]);
  const [hole, setHole] = useState(false);          // hole card face-up?
  const [outcome, setOutcome] = useState(null);
  const [bust, setBust] = useState(false);
  const [ready, setReady] = useState(false);       // buttons wait for the deal to finish
  const alive = useRef(true);
  useEffect(() => { const id = setTimeout(() => setReady(true), DEAL_DONE); return () => { alive.current = false; clearTimeout(id); }; }, []);

  const player = [...script.player, ...script.playerDraws.slice(0, hits)];
  const pv = handValue(player);

  async function finish(h) {
    setPhase('dealer');
    const round = playRound(script, h);
    await wait(500);
    setDealer(round.dealer.slice(0, 2)); setHole(true);
    for (let i = 2; i < round.dealer.length; i++) { await wait(850); if (!alive.current) return; setDealer(round.dealer.slice(0, i + 1)); }
    await wait(600); if (!alive.current) return;
    setBust(!!round.bust);
    // `script.target` is what the server decided; the engine guarantees round.outcome === target.
    setOutcome(script.target); setPhase('done');
  }

  // naturals resolve themselves
  useEffect(() => { if (isBlackjack(script.player)) { const id = setTimeout(() => finish(0), DEAL_DONE + 600); return () => clearTimeout(id); } }, []);

  function hit() {
    if (phase !== 'player' || !canHit(script, hits)) return;
    const h = hits + 1; setHits(h);
    const v = handValue([...script.player, ...script.playerDraws.slice(0, h)]);
    if (v >= 21) setTimeout(() => finish(h), 700);
  }

  const natural = isBlackjack(script.player);

  return (
    <div className="bj">
      <div className="bj-table">
        <div className="bj-felt deal-zone">
        <Deck />
        <Chips />
        <div className="bj-row">
          <div className="bj-label">{ui.dealer} {hole ? <b>{handValue(dealer)}</b> : null}</div>
          <div className="bj-cards">
            <Card key="d0" c={dealer[0]} delay={DEAL[1]} />
            <Card key="d1" c={hole ? dealer[1] : null} hidden={!hole} delay={DEAL[3]} />
            {hole && dealer.slice(2).map((c, i) => <Card key={`d${i + 2}`} c={c} />)}
          </div>
        </div>
        <ArcText text={locale === 'fr' ? 'LE CROUPIER RESTE À 17' : 'DEALER STANDS ON 17'} />
        <div className="bj-row">
          <div className="bj-cards">{player.map((c, i) => <Card key={`p${i}`} c={c} delay={i === 0 ? DEAL[0] : i === 1 ? DEAL[2] : 0} />)}</div>
          <div className="bj-label">{ui.you} <b>{pv}</b>{bust || pv > 21 ? ` — ${ui.bust}` : ''}</div>
        </div>
        </div>
      </div>
      {phase === 'done' ? (
        <>
          <div className={`bj-result ${outcome}`}>{ui.bjResult[outcome]}</div>
          <button className="btn play" onClick={onDone}>{outcome === 'loss' ? ui.lose.cont : ui.bjNext}</button>
        </>
      ) : (
        <div className="bj-actions">
          <button className="btn" disabled={!ready || phase !== 'player' || natural || !canHit(script, hits)} onClick={hit}>{ui.hit}</button>
          <button className="btn ghost" disabled={!ready || phase !== 'player' || natural} onClick={() => finish(hits)}>{ui.stand}</button>
        </div>
      )}
    </div>
  );
}

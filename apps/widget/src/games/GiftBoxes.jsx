import React, { useEffect, useRef, useState } from 'react';
import { UI, t, symbolFor } from '@peps/shared';
import { sound } from '../sound.js';

const BOXES = 3;
const LOSE = '__lose';
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// Three wrapped boxes. The server already decided the prize; whichever box the player picks holds it.
// The other boxes then open to show other rewards from the game ("what you could have had").
export default function GiftBoxes({ game, result, locale, onDone }) {
  const ui = UI[locale].gifts;
  const prizes = game.rewards.map((r, i) => ({ id: r.id, icon: symbolFor(r, i), title: t(r.title, locale) }));
  const won = result.lost ? { id: LOSE, icon: '💨', title: ui.lose } : prizes.find((x) => x.id === result.rewards[0].id) || prizes[0];
  const [picked, setPicked] = useState(null);
  const [phase, setPhase] = useState('idle');       // idle | shake | open | all
  const [contents, setContents] = useState([]);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms, fn) => timers.current.push(setTimeout(fn, ms));

  function pick(i) {
    if (picked !== null) return;
    // the picked box holds the prize; the others hold other rewards (repeating only when there aren't enough)
    const others = shuffle(prizes.filter((x) => x.id !== won.id));
    const fill = Array.from({ length: BOXES - 1 }, (_, k) => others[k % Math.max(1, others.length)] || won);
    const box = []; let k = 0;
    for (let j = 0; j < BOXES; j++) box.push(j === i ? won : fill[k++]);
    setContents(box); setPicked(i); setPhase('shake'); sound.play('shake');
    later(750, () => { setPhase('open'); sound.play('pop'); });
    later(1150, () => sound.play(result.lost ? 'lose' : 'win'));
    later(2100, () => setPhase('all'));
    later(3900, onDone);
  }

  return (
    <div className="gifts">
      <p className="gifts-hint">{picked === null ? ui.hint : phase === 'all' ? ui.others : ' '}</p>
      <div className="gift-row">
        {Array.from({ length: BOXES }, (_, i) => {
          const mine = picked === i; const open = (mine && (phase === 'open' || phase === 'all')) || (!mine && phase === 'all');
          const c = contents[i];
          return (
            <button key={i} type="button" className={`gift ${mine ? 'mine' : ''} ${mine && phase === 'shake' ? 'shake' : ''} ${open ? 'open' : ''} ${picked !== null && !mine ? 'other' : ''}`}
              style={{ '--c': `var(--pop${[1, 4, 5][i]})`, '--r': `var(--pop${[2, 2, 2][i]})`, '--d': `${i * 0.25}s` }}
              disabled={picked !== null} onClick={() => pick(i)} aria-label={`${ui.pick} ${i + 1}`}>
              {open && c && (
                <span className={`prize ${c.id === LOSE ? 'empty' : ''}`}>
                  <span className="prize-ico" aria-hidden="true">{c.icon}</span>
                  <span className="prize-txt">{c.title}</span>
                </span>
              )}
              {mine && open && <span className="burst" aria-hidden="true">{Array.from({ length: 10 }, (_, k) => <i key={k} style={{ '--a': `${k * 36}deg` }} />)}</span>}
              <span className="gift-lid"><span className="gift-bow" /></span>
              <span className="gift-body" />
            </button>
          );
        })}
      </div>
      {picked === null
        ? <p className="gifts-pick">{ui.pick}</p>
        : (phase === 'open' || phase === 'all') && <div className={`bj-result ${result.lost ? 'loss' : 'win'}`} role="status">{result.lost ? ui.lose : ui.win}</div>}
    </div>
  );
}

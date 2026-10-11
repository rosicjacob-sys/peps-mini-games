// Card-game engines shared by the server (builds a deal for the decided outcome) and the widget (plays it).
// The reward is always decided first from the odds; these deals only make the table show a matching story.

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const deck = () => SUITS.flatMap((s) => RANKS.map((r) => ({ r, s })));
const shuffle = (a, rand) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- Lucky 9 / Baccarat point values: A = 1, 2–9 face value, 10/J/Q/K = 0; hand = sum mod 10
export const pointValue = (c) => (c.r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(c.r) ? 0 : Number(c.r));
export const points = (cards) => cards.reduce((s, c) => s + pointValue(c), 0) % 10;

// ---------- Lucky 9: the player may draw a third card unless they hold a natural 9 (which ends the round);
// the banker draws on 0–5 and never finishes on 9. A deal is used only if it ends in the target result
// ('win' | 'loss') whether the player draws or stands.
export const lucky9Natural9 = (cards) => cards.length === 2 && points(cards) === 9;
export const lucky9CanDraw = (player) => !lucky9Natural9(player);
export function lucky9Banker(banker) { return points(banker.slice(0, 2)) <= 5 ? banker.slice(0, 3) : banker.slice(0, 2); }
export function lucky9Round(script, drew) {
  const nat = lucky9Natural9(script.player);
  const player = drew && !nat ? [...script.player, script.draw] : script.player;
  const banker = nat ? script.banker.slice(0, 2) : lucky9Banker(script.banker);
  const p = points(player), b = points(banker);
  return { player, banker, p, b, outcome: p > b ? 'win' : p === b ? 'tie' : 'loss' };
}
export function buildLucky9(target = 'win', rand = Math.random) {
  if (typeof target === 'function') { rand = target; target = 'win'; }
  for (let i = 0; i < 20000; i++) {
    const d = shuffle(deck(), rand);
    const s = { player: [d[0], d[2]], banker: [d[1], d[3], d[5]], draw: d[4], target };
    const a = lucky9Round(s, false), b = lucky9Round(s, true);
    if (a.outcome === target && b.outcome === target && a.b !== 9 && b.b !== 9 && points(s.banker.slice(0, 2)) !== 9) return s;
  }
  throw new Error(`could not build a lucky 9 ${target} deal`);
}

// ---------- Baccarat with the standard third-card rules. Shoe order: P1 B1 P2 B2, then third cards as needed.
export function baccaratResolve(shoe) {
  const player = [shoe[0], shoe[2]], banker = [shoe[1], shoe[3]]; let i = 4;
  const p2 = points(player), b2 = points(banker);
  if (p2 < 8 && b2 < 8) {
    let pThird = null;
    if (p2 <= 5) { pThird = shoe[i++]; player.push(pThird); }
    const b = points(banker);
    let bankerDraws;
    if (pThird === null) bankerDraws = b <= 5;
    else {
      const t = pointValue(pThird);
      bankerDraws = b <= 2 || (b === 3 && t !== 8) || (b === 4 && t >= 2 && t <= 7) || (b === 5 && t >= 4 && t <= 7) || (b === 6 && (t === 6 || t === 7));
    }
    if (bankerDraws) banker.push(shoe[i++]);
  }
  const p = points(player), b = points(banker);
  return { player, banker, p, b, winner: p > b ? 'player' : b > p ? 'banker' : 'tie' };
}
// One deal per possible bet: won by that bet ('win'), or lost by it ('loss' — the other side wins; a Player or
// Banker bet never loses to a tie). The banker never finishes on 9.
export function buildBaccarat(target = 'win', rand = Math.random) {
  if (typeof target === 'function') { rand = target; target = 'win'; }
  const ok = (bet, w) => (target === 'win' ? w === bet : bet === 'tie' ? w !== 'tie' : w === (bet === 'player' ? 'banker' : 'player'));
  const deals = {};
  for (const bet of ['player', 'banker', 'tie']) {
    for (let i = 0; i < 40000 && !deals[bet]; i++) {
      const shoe = shuffle(deck(), rand).slice(0, 6); const r = baccaratResolve(shoe);
      if (ok(bet, r.winner) && r.b !== 9) deals[bet] = shoe;
    }
    if (!deals[bet]) throw new Error(`could not build a baccarat ${target} deal for ${bet}`);
  }
  return { deals, target };
}

// ---------- Poker (5 cards, no draw). Every hand pays: rarer rewards get better hands.
export const HANDS = ['pair', 'two_pair', 'three', 'straight', 'flush', 'full_house', 'four', 'straight_flush'];
const rv = (r) => RANKS.indexOf(r) + 1; // A = 1 … K = 13
export function evaluate(cards) {
  const counts = {}; cards.forEach((c) => (counts[c.r] = (counts[c.r] || 0) + 1));
  const groups = Object.values(counts).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const vals = [...new Set(cards.map((c) => rv(c.r)))].sort((a, b) => a - b);
  const straight = vals.length === 5 && (vals[4] - vals[0] === 4 || vals.join() === '1,10,11,12,13');
  if (straight && flush) return 'straight_flush';
  if (groups[0] === 4) return 'four';
  if (groups[0] === 3 && groups[1] === 2) return 'full_house';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (groups[0] === 3) return 'three';
  if (groups[0] === 2 && groups[1] === 2) return 'two_pair';
  if (groups[0] === 2) return 'pair';
  return 'high';
}
export function buildPokerHand(target, rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const ranks = () => shuffle(RANKS, rand);
  for (let n = 0; n < 2000; n++) {
    let cards;
    const rs = ranks(); const suits = () => shuffle(SUITS, rand);
    const of = (r, k) => suits().slice(0, k).map((s) => ({ r, s }));
    const singles = (list) => list.map((r) => ({ r, s: pick(SUITS) }));
    if (target === 'high') cards = singles(rs.slice(0, 5));
    else if (target === 'pair') cards = [...of(rs[0], 2), ...singles(rs.slice(1, 4))];
    else if (target === 'two_pair') cards = [...of(rs[0], 2), ...of(rs[1], 2), ...singles([rs[2]])];
    else if (target === 'three') cards = [...of(rs[0], 3), ...singles(rs.slice(1, 3))];
    else if (target === 'full_house') cards = [...of(rs[0], 3), ...of(rs[1], 2)];
    else if (target === 'four') cards = [...of(rs[0], 4), ...singles([rs[1]])];
    else if (target === 'flush') { const s = pick(SUITS); cards = rs.slice(0, 5).map((r) => ({ r, s })); }
    else {
      const start = Math.floor(rand() * 10); // A-2-3-4-5 … 10-J-Q-K-A
      const run = [0, 1, 2, 3, 4].map((k) => RANKS[(start + k) % 13]);
      const s = pick(SUITS);
      cards = run.map((r) => ({ r, s: target === 'straight_flush' ? s : pick(SUITS) }));
    }
    if (evaluate(cards) === target) return shuffle(cards, rand);
  }
  throw new Error(`could not build a ${target}`);
}
// Map a game's rewards to hands: most likely reward → weakest hand, rarest → strongest.
export function pokerTiers(rewards) {
  const act = rewards.filter((r) => r.active !== false).sort((a, b) => Number(b.probability) - Number(a.probability) || (a.sort ?? 0) - (b.sort ?? 0));
  const n = act.length; const map = {};
  act.forEach((r, i) => { map[r.id] = HANDS[n <= 1 ? 0 : Math.round((i * (HANDS.length - 1)) / (n - 1))]; });
  return map;
}

// ---------- Color Game: three dice; the winning reward's colour shows on two or three of them.
export const COLORS = [
  { key: 'yellow', hex: '#f5c518' }, { key: 'red', hex: '#d62828' }, { key: 'blue', hex: '#1f6feb' },
  { key: 'green', hex: '#2a9d3f' }, { key: 'pink', hex: '#e85d9e' }, { key: 'white', hex: '#f4f1ea' },
];
export const COLOR_MAX = COLORS.length;
export function colorDice(winIndex, nRewards, rand = Math.random) {
  if (winIndex < 0) return shuffle([...Array(COLOR_MAX).keys()], rand).slice(0, 3); // a loss: no colour twice
  const three = rand() < 0.3;
  const others = shuffle([...Array(COLOR_MAX).keys()].filter((i) => i !== winIndex), rand);
  const dice = three ? [winIndex, winIndex, winIndex] : [winIndex, winIndex, others[0]];
  return shuffle(dice, rand);
}

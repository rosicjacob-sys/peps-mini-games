// Blackjack engine shared by the server (builds + verifies scripts) and the widget (plays them).
//
// The server decides the outcome first (from reward odds). It then builds a "script" so that the hand
// really ends that way WHATEVER the player does with hit/stand:
//   script = { target, player:[c,c], playerDraws:[c...], dealerUp:c, dealerPlans:[[hole, ...draws], ...] }
// dealerPlans[k] is what the dealer holds/draws if the player stands after k hits.

export const OUTCOMES = ['blackjack', 'win', 'push', 'loss'];
const SUITS = ['♠', '♥', '♦', '♣'];
const FACES = ['10', 'J', 'Q', 'K'];

export const cardValue = (c) => (c.r === 'A' ? 11 : FACES.includes(c.r) ? 10 : Number(c.r));

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += cardValue(c); if (c.r === 'A') aces++; }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}
export const isBlackjack = (cards) => cards.length === 2 && handValue(cards) === 21;

// How many hits the player may take (stops at 21, bust, or when the script has no more cards).
export const canHit = (script, hits) => hits < script.playerDraws.length && handValue([...script.player, ...script.playerDraws.slice(0, hits)]) < 21;

// Resolve a round where the player stands after `hits` hits.
export function playRound(script, hits) {
  const player = [...script.player, ...script.playerDraws.slice(0, hits)];
  const plan = script.dealerPlans[Math.min(hits, script.dealerPlans.length - 1)];
  const dealer = [script.dealerUp, plan[0]];
  const pv = handValue(player);
  if (pv > 21) return { player, dealer, outcome: 'loss', bust: true };
  if (isBlackjack(player)) return { player, dealer, outcome: isBlackjack(dealer) ? 'push' : 'blackjack' };
  if (isBlackjack(dealer)) return { player, dealer, outcome: 'loss' };
  let i = 1;
  while (handValue(dealer) < 17 && i < plan.length) dealer.push(plan[i++]);
  const dv = handValue(dealer);
  const outcome = dv > 21 || pv > dv ? 'win' : pv === dv ? 'push' : 'loss';
  return { player, dealer, outcome };
}

// ---- script builder (server side) ----

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const card = (value, rand) => ({ r: value === 11 ? 'A' : value === 10 ? pick(FACES, rand) : String(value), s: pick(SUITS, rand) });
const between = (lo, hi, rand) => lo + Math.floor(rand() * (hi - lo + 1));

// Player draws that never push a hard hand past 21.
function safeDraws(total, rand) {
  const out = []; let remain = 21 - total;
  while (remain >= 2 && out.length < 5) { const v = between(2, Math.min(10, remain), rand); out.push(v); remain -= v; }
  return out;
}

// Dealer cards (after the up card) that follow the rules (hit below 17) and finish on exactly `final`.
function dealerSequence(up, final, rand) {
  const walk = (total, seq) => {
    if (total >= 17) return total === final ? seq : null;
    const vals = [2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => rand() - 0.5);
    for (const v of vals) { const r = walk(total + v, [...seq, v]); if (r) return r; }
    return null;
  };
  for (let n = 0; n < 6; n++) { // random first card for variety, DFS for the rest
    const h = between(2, 10, rand);
    if (up + h === 21) continue;
    const r = walk(up + h, [h]);
    if (r) return r;
  }
  return null;
}
const dealerBust = (up, rand) => {
  for (let n = 0; n < 50; n++) {
    const h = between(7, 10, rand), total = up + h;
    if (total >= 12 && total <= 16) { const need = 22 - total; return [h, between(need, 10, rand)]; }
  }
  return [10, 10];
};

function build(target, rand) {
  const hard = () => { const a = between(2, 10, rand); return [a, between(2, 10, rand)]; };
  if (target === 'blackjack') {
    const up = between(6, 10, rand), final = between(17, 20, rand), hole = final - up;
    const pair = rand() < 0.5 ? [11, 10] : [10, 11];
    return { player: pair, playerDraws: [], up, plans: [[hole]] };
  }
  if (target === 'win') {
    let p; do p = hard(); while (p[0] + p[1] > 16 || p[0] + p[1] < 9);
    const draws = safeDraws(p[0] + p[1], rand), up = between(4, 6, rand);
    return { player: p, playerDraws: draws, up, plans: [...Array(draws.length + 1)].map(() => dealerBust(up, rand)) };
  }
  if (target === 'push') {
    let p; do p = hard(); while (p[0] + p[1] < 17 || p[0] + p[1] > 20);
    const draws = safeDraws(p[0] + p[1], rand), up = between(2, 10, rand);
    const plans = []; let t = p[0] + p[1];
    for (let k = 0; k <= draws.length; k++) { plans.push(dealerSequence(up, t, rand)); t += draws[k] || 0; }
    return { player: p, playerDraws: draws, up, plans };
  }
  // loss: dealer finishes above every non-bust player total; hitting may bust
  let p; do p = hard(); while (p[0] + p[1] < 12 || p[0] + p[1] > 16);
  const draws = []; let t = p[0] + p[1]; const totals = [t];
  while (t < 21 && draws.length < 5) { const v = between(2, 10, rand); draws.push(v); t += v; if (t <= 21) totals.push(t); }
  const maxT = Math.max(...totals);
  if (maxT >= 20) return { plans: [null] };              // the dealer never reaches 21, so they can't beat 20 — retry
  const final = between(Math.max(17, maxT + 1), 20, rand), up = between(2, 10, rand);
  const seq = dealerSequence(up, final, rand);
  return { player: p, playerDraws: draws, up, plans: [...Array(draws.length + 1)].map(() => seq) };
}

export function buildScript(target, rand = Math.random) {
  if (!OUTCOMES.includes(target)) target = 'win';
  for (let attempt = 0; attempt < 200; attempt++) {
    const b = build(target, rand);
    if (b.plans.some((x) => !x)) continue;
    const script = {
      target,
      player: b.player.map((v) => card(v, rand)),
      playerDraws: b.playerDraws.map((v) => card(v, rand)),
      dealerUp: card(b.up, rand),
      dealerPlans: b.plans.map((pl) => pl.map((v) => card(v, rand))),
    };
    if (verifyScript(script)) return script;
  }
  throw new Error(`could not build a blackjack script for ${target}`);
}

// True when every possible player path (0..n hits) ends in the target outcome — and the dealer never shows 21.
export function verifyScript(script) {
  for (let k = 0; k <= script.playerDraws.length; k++) {
    if (k > 0 && !canHit(script, k - 1)) break;
    const r = playRound(script, k);
    if (r.outcome !== script.target || handValue(r.dealer) === 21) return false;
  }
  return true;
}

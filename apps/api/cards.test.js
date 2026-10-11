import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLucky9, lucky9Round, lucky9Natural, buildBaccarat, baccaratResolve, buildPokerHand, evaluate, HANDS, pokerTiers, colorDice, points } from '@peps/shared/cards.js';

test('lucky 9: player wins whether they draw or stand', () => {
  for (let i = 0; i < 2000; i++) {
    const s = buildLucky9();
    assert.equal(lucky9Round(s, false).outcome, 'win');
    assert.equal(lucky9Round(s, true).outcome, 'win');
    if (lucky9Natural(s.player)) assert.equal(lucky9Round(s, true).banker.length, 2);
  }
});
test('baccarat: every bet has a deal it wins, under the third-card rules', () => {
  for (let i = 0; i < 500; i++) {
    const { deals } = buildBaccarat();
    for (const bet of ['player', 'banker', 'tie']) assert.equal(baccaratResolve(deals[bet]).winner, bet);
  }
});
test('baccarat rules: naturals stand, player draws on 0-5', () => {
  const c = (r) => ({ r, s: '♠' });
  assert.equal(baccaratResolve([c('9'), c('K'), c('K'), c('5'), c('2'), c('3')]).player.length, 2); // player natural 9
  const r = baccaratResolve([c('2'), c('K'), c('2'), c('7'), c('3'), c('4')]);                  // P=4 draws, B=7 stands
  assert.equal(r.player.length, 3); assert.equal(r.banker.length, 2); assert.equal(points(r.player), 7);
});
test('poker: every hand category builds and evaluates correctly', () => {
  for (const h of HANDS) for (let i = 0; i < 300; i++) assert.equal(evaluate(buildPokerHand(h)), h);
});
test('poker tiers: rarer reward gets the stronger hand', () => {
  const t = pokerTiers([{ id: 'a', probability: 50 }, { id: 'b', probability: 30 }, { id: 'c', probability: 15 }, { id: 'd', probability: 5 }]);
  assert.deepEqual([t.a, t.b, t.c, t.d].map((h) => HANDS.indexOf(h)), [0, 2, 5, 7]);
});
test('color game: winning colour shows on at least two dice, no other colour does', () => {
  for (let i = 0; i < 2000; i++) {
    const w = i % 6; const d = colorDice(w, 6);
    assert.ok(d.filter((x) => x === w).length >= 2);
    for (const x of d) if (x !== w) assert.equal(d.filter((y) => y === x).length, 1);
  }
});

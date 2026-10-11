import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLucky9, lucky9Round, lucky9Natural9, buildBaccarat, baccaratResolve, buildPokerHand, evaluate, HANDS, pokerTiers, colorDice, points } from '@peps/shared/cards.js';

test('lucky 9: target result whether the player draws or stands; banker never on 9', () => {
  for (const target of ['win', 'loss']) for (let i = 0; i < 1500; i++) {
    const s = buildLucky9(target);
    for (const drew of [false, true]) { const r = lucky9Round(s, drew); assert.equal(r.outcome, target); assert.notEqual(r.b, 9); }
    if (lucky9Natural9(s.player)) assert.equal(lucky9Round(s, true).banker.length, 2);
  }
});
test('lucky 9 rules: natural 8 may still draw; banker draws on 0-5 only', () => {
  const c = (r) => ({ r, s: '♠' });
  const s = { player: [c('3'), c('5')], banker: [c('2'), c('2'), c('4')], draw: c('A') };
  assert.equal(lucky9Round(s, true).player.length, 3);              // natural 8 drew
  assert.equal(lucky9Round(s, false).banker.length, 3);             // banker 4 draws
  assert.equal(lucky9Round({ ...s, banker: [c('3'), c('3'), c('2')] }, false).banker.length, 2); // banker 6 stands
});
test('baccarat: win and loss deals for every bet; banker never on 9', () => {
  for (let i = 0; i < 300; i++) {
    const w = buildBaccarat('win'), l = buildBaccarat('loss');
    for (const bet of ['player', 'banker', 'tie']) {
      const rw = baccaratResolve(w.deals[bet]), rl = baccaratResolve(l.deals[bet]);
      assert.equal(rw.winner, bet); assert.notEqual(rl.winner, bet); assert.notEqual(rw.b, 9); assert.notEqual(rl.b, 9);
      if (bet !== 'tie') assert.notEqual(rl.winner, 'tie');
    }
  }
});
test('baccarat rules: naturals stand, player draws on 0-5', () => {
  const c = (r) => ({ r, s: '♠' });
  assert.equal(baccaratResolve([c('9'), c('K'), c('K'), c('5'), c('2'), c('3')]).player.length, 2); // player natural 9
  const r = baccaratResolve([c('2'), c('K'), c('2'), c('7'), c('3'), c('4')]);                  // P=4 draws, B=7 stands
  assert.equal(r.player.length, 3); assert.equal(r.banker.length, 2); assert.equal(points(r.player), 7);
});
test('poker: every hand category builds and evaluates correctly', () => {
  for (const h of [...HANDS, 'high']) for (let i = 0; i < 300; i++) assert.equal(evaluate(buildPokerHand(h)), h);
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
  for (let i = 0; i < 500; i++) assert.equal(new Set(colorDice(-1, 6)).size, 3); // a loss: three different colours
});

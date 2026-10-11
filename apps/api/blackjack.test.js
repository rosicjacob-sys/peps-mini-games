import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScript, verifyScript, playRound, canHit, OUTCOMES, handValue } from '@peps/shared/blackjack.js';

for (const target of OUTCOMES) {
  test(`${target}: every hit/stand path ends in ${target}`, () => {
    for (let i = 0; i < 3000; i++) {
      const s = buildScript(target);
      assert.ok(verifyScript(s), JSON.stringify(s));
      // dealer never plays illegally: stands on 17+, never draws unused cards
      for (let k = 0; k <= s.playerDraws.length; k++) {
        if (k > 0 && !canHit(s, k - 1)) break;
        const r = playRound(s, k);
        assert.equal(r.outcome, target);
        if (r.dealer.length > 2) assert.ok(handValue(r.dealer.slice(0, -1)) < 17);
      }
    }
  });
}

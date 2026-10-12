import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
process.env.JWT_SECRET ||= 'test';
const { normalizeEmail, pickRewards, weekInfo, siteOrigin, originVariants, isUuid } = await import('./src/lib.js');
const { cspBlocks } = await import('./src/admin.js');

test('normalizeEmail: one identity per person (case, gmail dots, +tags), invalid addresses rejected', () => {
  assert.equal(normalizeEmail(' John.Doe+promo@Gmail.com ').norm, 'johndoe@gmail.com');
  assert.equal(normalizeEmail('john.doe@googlemail.com').norm, 'johndoe@gmail.com');
  assert.equal(normalizeEmail('a.b+x@shop.ca').norm, 'a.b@shop.ca');          // dots stay for non-gmail, tags go
  assert.equal(normalizeEmail('A.B@Shop.CA').email, 'a.b@shop.ca');
  for (const bad of ['', 'nope', 'a@b', 'a@b.c', 'a b@c.com', null, 'x'.repeat(250) + '@a.com']) assert.equal(normalizeEmail(bad), null, String(bad));
});

test('pickRewards: weights honoured, inactive and zero-probability skipped, several picks are distinct', () => {
  const rewards = [{ id: 'a', probability: 90, active: true }, { id: 'b', probability: 10, active: true }, { id: 'off', probability: 100, active: false }, { id: 'zero', probability: 0, active: true }];
  const n = 5000; const counts = {};
  for (let i = 0; i < n; i++) { const [r] = pickRewards(rewards, 1); counts[r.id] = (counts[r.id] || 0) + 1; }
  assert.ok(!counts.off && !counts.zero, 'inactive / zero never picked');
  assert.ok(counts.a / n > 0.85 && counts.a / n < 0.95, `a picked ${counts.a / n}`);
  for (let i = 0; i < 200; i++) { const ids = pickRewards(rewards, 3).map((r) => r.id); assert.equal(new Set(ids).size, ids.length); assert.deepEqual([...ids].sort(), ['a', 'b']); }
  // a deterministic roll lands where the weights say
  assert.equal(pickRewards(rewards, 1, () => 0.95)[0].id, 'b');
  assert.equal(pickRewards(rewards, 1, () => 0.1)[0].id, 'a');
});

test('weekInfo: weeks run Monday 00:00 to Sunday 23:59:59 Eastern', () => {
  const sun = DateTime.fromISO('2026-10-18T23:30:00', { zone: 'America/Toronto' });   // a Sunday evening
  const w = weekInfo(sun);
  assert.equal(w.weekKey, '2026-10-12'); assert.equal(w.prevWeekKey, '2026-10-05');
  assert.equal(DateTime.fromISO(w.nextPlayAt).setZone('America/Toronto').toFormat('cccc HH:mm'), 'Monday 00:00');
  assert.equal(DateTime.fromISO(w.expiresAt).setZone('America/Toronto').toFormat('cccc HH:mm:ss'), 'Sunday 23:59:59');
  // just after midnight Monday is a new week, even though it is still Sunday in UTC
  assert.equal(weekInfo(DateTime.fromISO('2026-10-19T00:00:01', { zone: 'America/Toronto' })).weekKey, '2026-10-19');
});

test('siteOrigin / originVariants: a typed website becomes an origin, with and without www.', () => {
  assert.equal(siteOrigin('Shop.com/some/page?x=1'), 'https://shop.com');
  assert.equal(siteOrigin('http://www.shop.com/'), 'http://www.shop.com');
  assert.equal(siteOrigin('ftp://x.com'), null); assert.equal(siteOrigin(''), null); assert.equal(siteOrigin('not a url'), null);
  assert.deepEqual(originVariants('https://shop.com'), ['https://shop.com', 'https://www.shop.com']);
  assert.deepEqual(originVariants('https://www.shop.com'), ['https://www.shop.com', 'https://shop.com']);
  assert.deepEqual(originVariants('http://localhost:5174'), ['http://localhost:5174']);
  assert.ok(isUuid('6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d') && !isUuid('nope') && !isUuid(''));
});

test('cspBlocks: a Content-Security-Policy that leaves out the widget or the API is reported', () => {
  const pairs = [['script-src', 'https://games-widget.onrender.com/widget.js'], ['connect-src', 'https://games-api.onrender.com']];
  assert.deepEqual(cspBlocks('', pairs), []);
  assert.deepEqual(cspBlocks("default-src 'self' https:", pairs), []);
  assert.deepEqual(cspBlocks("default-src 'self' *.onrender.com", pairs), []);
  assert.deepEqual(cspBlocks("default-src 'self'", pairs), ['https://games-widget.onrender.com (script-src)', 'https://games-api.onrender.com (connect-src)']);
  assert.deepEqual(cspBlocks("script-src 'self' https://games-widget.onrender.com; connect-src 'self'", pairs), ['https://games-api.onrender.com (connect-src)']);
});

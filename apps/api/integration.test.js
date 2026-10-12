// End-to-end against a real Postgres: the public and admin HTTP API as the widget and the dashboard use them.
// Needs TEST_DATABASE_URL (a database this test may wipe). Skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';

const url = process.env.TEST_DATABASE_URL;
if (!url) test('integration (set TEST_DATABASE_URL to run)', { skip: true }, () => {});
else {
  process.env.DATABASE_URL = url; process.env.JWT_SECRET = 'test-secret'; process.env.DASHBOARD_PASSWORD = 'pw';
  process.env.DASHBOARD_ORIGIN = 'http://dashboard.test'; process.env.LOGIN_RATE_LIMIT = '5'; process.env.CONFIG_CACHE_MS = '60000';
  const { migrate, pool, q } = await import('./src/db.js');
  const { createApp } = await import('./src/app.js');
  await migrate();
  await q('TRUNCATE plays, play_rewards, reminders, unsubscribes, rewards, games, stores, store_groups, reward_library CASCADE');
  const server = createApp().listen(0); const base = `http://127.0.0.1:${server.address().port}`;
  test.after(() => { server.close(); pool.end(); });

  const call = async (path, { method = 'GET', body, token, origin } = {}) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const { body: { token } } = await call('/api/admin/login', { method: 'POST', body: { password: 'pw' } });
  const admin = (path, o = {}) => call(path, { ...o, token });
  const play = (origin, gameId, email, extra = {}) => call('/api/public/play', { method: 'POST', origin, body: { key: '', gameId, email, locale: 'en', ...extra } });

  const ids = {};
  test('setup: group, two stores (www. variants kept), library reward, wheel game', async () => {
    ids.group = (await admin('/api/admin/groups', { method: 'POST', body: { name: 'Lexar', from_email: 'r@lexar.test' } })).body.id;
    const a = await admin('/api/admin/stores', { method: 'POST', body: { name: 'A', group_id: ids.group, website: 'www.a.test' } });
    assert.deepEqual(a.body.allowed_origins, ['https://www.a.test', 'https://a.test']); assert.equal(a.body.site_url, 'https://www.a.test'); ids.a = a.body.id;
    ids.b = (await admin('/api/admin/stores', { method: 'POST', body: { name: 'B', group_id: ids.group, website: 'https://b.test', aliases: ['shop.b.test'] } })).body.id;
    assert.equal((await admin('/api/admin/stores', { method: 'POST', body: { name: 'Dup', website: 'https://a.test' } })).status, 400, 'a website belongs to one store');
    ids.lib = (await admin('/api/admin/library', { method: 'POST', body: { title: { en: '10% off' }, code: 'TEN' } })).body.id;
    const g = await admin('/api/admin/games', { method: 'POST', body: { group_id: ids.group, type: 'wheel', theme: 'emerald' } });
    assert.equal(g.status, 201); assert.equal(g.body.theme, 'emerald', 'the theme an admin picks is kept'); ids.game = g.body.id;
    const rw = await admin(`/api/admin/games/${ids.game}/rewards`, { method: 'PUT', body: { lose_percent: 0, rewards: [{ library_id: ids.lib, probability: 100 }] } });
    assert.equal(rw.status, 200);
    assert.equal((await admin(`/api/admin/games/${ids.game}/rewards`, { method: 'PUT', body: { lose_percent: 50, rewards: [{ library_id: ids.lib, probability: 30 }] } })).status, 400, 'must add up to 100');
    assert.equal((await admin('/api/admin/games/not-a-uuid')).status, 404);
  });

  test('config: found by the page origin (either spelling), with the group popup; unknown origins get nothing', async () => {
    for (const o of ['https://a.test', 'https://www.a.test', 'https://shop.b.test']) { const r = await call('/api/public/config?key=', { origin: o }); assert.equal(r.status, 200, o); assert.equal(r.body.games.length, 1); assert.ok('intro' in r.body); }
    assert.equal((await call('/api/public/config?key=', { origin: 'https://other.test' })).status, 404);
    assert.equal((await call('/api/public/config?key=')).status, 404, 'no origin, no key');
  });

  test('play: one play per email per week across the whole store group', async () => {
    const first = await play('https://a.test', ids.game, 'Jane.Doe@gmail.com');
    assert.equal(first.status, 200); assert.equal(first.body.rewards[0].code, 'TEN');
    const again = await play('https://b.test', ids.game, 'janedoe+x@gmail.com');
    assert.equal(again.status, 409); assert.equal(again.body.error, 'already_played'); assert.ok(again.body.nextPlayText);
    assert.equal((await play('https://a.test', ids.game, 'other@x.com')).status, 200);
    assert.equal((await play('https://a.test', ids.game, 'bad-email')).status, 400);
    assert.equal((await play('https://other.test', ids.game, 'z@x.com')).status, 404);
  });

  test('reports: rewards and by-game are per game across stores, with the right play counts', async () => {
    const o = (await admin('/api/admin/reports/overview?from=all')).body;
    assert.equal(o.kpis.plays, 2); assert.equal(o.kpis.players, 2);
    assert.equal(o.rewards.length, 1); assert.equal(o.rewards[0].won, 2); assert.equal(o.rewards[0].game_plays, 2); assert.equal(o.rewards[0].probability, 100);
    assert.equal(o.by.game.length, 1); assert.equal(o.by.game[0].plays, 2);
    const onlyA = (await admin(`/api/admin/reports/overview?from=all&store_id=${ids.a}`)).body;
    assert.equal(onlyA.kpis.plays, 2); assert.equal((await admin(`/api/admin/reports/overview?from=all&store_id=${ids.b}`)).body.kpis.plays, 0);
    const players = (await admin('/api/admin/players?from=all')).body;
    assert.equal(players.total, 2);
  });

  test('preview: the dashboard token shows the game and records nothing', async () => {
    const { body: { token: pv } } = await admin(`/api/admin/games/${ids.game}/preview`, { method: 'POST' });
    const cfg = await call(`/api/public/config?preview=${pv}`); assert.equal(cfg.status, 200); assert.equal(cfg.body.preview, true); assert.equal(cfg.body.games.length, 1);
    const p = await call('/api/public/play', { method: 'POST', body: { preview: pv, gameId: ids.game, email: 'anything', locale: 'fr' } });
    assert.equal(p.status, 200); assert.equal(p.body.preview, true); assert.equal(p.body.rewards[0].code, 'TEN');
    assert.equal((await admin('/api/admin/reports/overview?from=all')).body.kpis.plays, 2, 'no play recorded');
    assert.equal((await call('/api/public/config?preview=garbage')).status, 404);
  });

  test('admin saves are live at once (config cache cleared); archive hides, delete needs archive', async () => {
    const g = (await admin(`/api/admin/games/${ids.game}`)).body;
    await admin(`/api/admin/games/${ids.game}`, { method: 'PUT', body: { ...g, status: 'paused' } });
    assert.equal((await call('/api/public/config?key=', { origin: 'https://a.test' })).body.games.length, 0, 'paused game gone immediately');
    await admin(`/api/admin/games/${ids.game}`, { method: 'PUT', body: { ...g, status: 'active' } });
    assert.equal((await call('/api/public/config?key=', { origin: 'https://a.test' })).body.games.length, 1);
    assert.equal((await admin(`/api/admin/games/${ids.game}`, { method: 'DELETE' })).status, 409);
    assert.equal((await admin(`/api/admin/games/${ids.game}/archive`, { method: 'POST' })).status, 200);
    assert.equal((await call('/api/public/config?key=', { origin: 'https://a.test' })).body.games.length, 0, 'archived game gone');
    assert.equal((await admin('/api/admin/games')).body.length, 0); assert.equal((await admin('/api/admin/games?archived=1')).body.length, 1);
    assert.equal((await admin('/api/admin/reports/overview?from=all')).body.kpis.plays, 2, 'its plays are still reported');
    assert.equal((await admin(`/api/admin/stores/${ids.a}/archive`, { method: 'POST' })).status, 200);
    assert.equal((await call('/api/public/config?key=', { origin: 'https://a.test' })).status, 404, 'an archived store answers to nobody');
    assert.equal((await admin(`/api/admin/games/${ids.game}`, { method: 'DELETE' })).status, 204);
  });

  test('login: wrong passwords are throttled', async () => {
    let last;
    for (let i = 0; i < 6; i++) last = await call('/api/admin/login', { method: 'POST', body: { password: 'wrong' } });
    assert.equal(last.status, 429);
  });
}

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { GAME_TYPES, THEMES, SLOT_SYMBOLS, DEFAULT_THEME, singleReward } from '@peps/shared';
import { q, pool } from './db.js';

export const adminRouter = Router();

const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

adminRouter.post('/login', (req, res) => {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw || !safeEq(req.body?.password ?? '', pw)) return res.status(401).json({ error: 'bad_password' });
  res.json({ token: jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '7d' }) });
});

adminRouter.use((req, res, next) => {
  try { jwt.verify((req.get('authorization') || '').replace(/^Bearer /, ''), process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'unauthorized' }); }
});

import { resolveSender } from './email.js';
import { registerReports } from './reports.js';

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const loc = (v, max = 300) => ({ en: String(v?.en ?? '').slice(0, max), fr: String(v?.fr ?? '').slice(0, max) });

function cleanIntro(i = {}) {
  return {
    enabled: i.enabled !== false,
    heading: loc(i.heading), description: loc(i.description, 600), note: loc(i.note, 400),
    steps: (Array.isArray(i.steps) ? i.steps : []).slice(0, 6).map((x) => loc(x, 200)).filter((x) => x.en || x.fr),
    playLabel: loc(i.playLabel, 60), declineLabel: loc(i.declineLabel, 60),
    image: /^https:\/\//.test(i.image || '') ? String(i.image).slice(0, 500) : '',
  };
}

// ---- store groups
const groupFields = (b) => [String(b.name || '').trim().slice(0, 80) || 'Untitled group', String(b.from_name || '').slice(0, 120), String(b.from_email || '').trim().slice(0, 254), String(b.reply_to || '').trim().slice(0, 254)];
adminRouter.get('/groups', wrap(async (_req, res) => {
  const { rows } = await q(`SELECT g.*, (SELECT count(*)::int FROM stores s WHERE s.group_id = g.id) AS store_count FROM store_groups g ORDER BY g.sort, g.created_at`);
  res.json(rows);
}));
adminRouter.post('/groups', wrap(async (req, res) => {
  const { rows } = await q('INSERT INTO store_groups (name, from_name, from_email, reply_to) VALUES ($1,$2,$3,$4) RETURNING *', groupFields(req.body));
  res.status(201).json(rows[0]);
}));
adminRouter.put('/groups/:id', wrap(async (req, res) => {
  const { rows } = await q('UPDATE store_groups SET name=$2, from_name=$3, from_email=$4, reply_to=$5 WHERE id=$1 RETURNING *', [req.params.id, ...groupFields(req.body)]);
  rows[0] ? res.json(rows[0]) : res.sendStatus(404);
}));
// Deleting a group keeps its stores (they become ungrouped).
adminRouter.delete('/groups/:id', wrap(async (req, res) => { await q('DELETE FROM store_groups WHERE id = $1', [req.params.id]); res.sendStatus(204); }));

// ---- stores
adminRouter.get('/stores', wrap(async (_req, res) => {
  const { rows } = await q(`SELECT s.*, sg.name AS group_name, (SELECT count(*)::int FROM games g WHERE g.store_id = s.id) AS game_count FROM stores s LEFT JOIN store_groups sg ON sg.id = s.group_id ORDER BY sg.sort, sg.name NULLS LAST, s.created_at`);
  res.json(rows);
}));
adminRouter.post('/stores', wrap(async (req, res) => {
  const origins = (req.body.allowed_origins || []).map((o) => String(o).trim().replace(/\/$/, '')).filter(Boolean);
  const { rows } = await q('INSERT INTO stores (name, allowed_origins, group_id) VALUES ($1,$2,$3) RETURNING *', [String(req.body.name || '').trim() || 'Untitled store', origins, req.body.group_id || null]);
  res.status(201).json(rows[0]);
}));
adminRouter.put('/stores/:id', wrap(async (req, res) => {
  const origins = (req.body.allowed_origins || []).map((o) => String(o).trim().replace(/\/$/, '')).filter(Boolean);
  const { rows } = await q('UPDATE stores SET name = $2, allowed_origins = $3, group_id = $4 WHERE id = $1 RETURNING *', [req.params.id, String(req.body.name || '').trim(), origins, req.body.group_id || null]);
  rows[0] ? res.json(rows[0]) : res.sendStatus(404);
}));
adminRouter.delete('/stores/:id', wrap(async (req, res) => { await q('DELETE FROM stores WHERE id = $1', [req.params.id]); res.sendStatus(204); }));

// ---- games
adminRouter.get('/games', wrap(async (req, res) => {
  const { rows } = await q(`
    SELECT g.*, s.name AS store_name, s.public_key, sg.id AS group_id, sg.name AS group_name,
      (SELECT count(*)::int FROM plays p WHERE p.game_id = g.id AND NOT p.is_test) AS play_count
    FROM games g JOIN stores s ON s.id = g.store_id LEFT JOIN store_groups sg ON sg.id = s.group_id
    WHERE ($1::uuid IS NULL OR g.store_id = $1) ORDER BY sg.sort, sg.name NULLS LAST, s.name, g.created_at`, [req.query.store_id || null]);
  res.json(rows);
}));
adminRouter.get('/games/:id', wrap(async (req, res) => {
  const { rows: [g] } = await q(`SELECT g.*, s.public_key, s.name AS store_name, sg.name AS group_name,
      sg.from_name AS group_from_name, sg.from_email AS group_from_email, sg.reply_to AS group_reply_to
    FROM games g JOIN stores s ON s.id = g.store_id LEFT JOIN store_groups sg ON sg.id = s.group_id WHERE g.id = $1`, [req.params.id]);
  if (!g) return res.sendStatus(404);
  const { rows: rewards } = await q('SELECT * FROM rewards WHERE game_id = $1 ORDER BY sort, id', [g.id]);
  res.json({ ...g, rewards, effective_sender: resolveSender(g) });
}));

// sound settings: effects on/off; music built-in, off, or a custom https file
const cleanSound = (s = {}) => {
  const url = /^https:\/\/\S+$/i.test(String(s.musicUrl || '').trim()) ? String(s.musicUrl).trim().slice(0, 500) : '';
  const music = s.music === 'off' ? 'off' : s.music === 'custom' && url ? 'custom' : 'builtin';
  return { sfx: s.sfx !== false, music, musicUrl: url };
};
function gameFields(b) {
  if (!GAME_TYPES[b.type]) throw Object.assign(new Error('bad_type'), { status: 400 });
  const fixed = GAME_TYPES[b.type].fixedTheme;
  const theme = fixed || (THEMES[b.theme] && !THEMES[b.theme].locked ? b.theme : (GAME_TYPES[b.type].defaultTheme || DEFAULT_THEME));
  const brand = /^#[0-9a-f]{6}$/i.test(b.brand_accent || '') && !fixed ? b.brand_accent : null;
  const tx = b.texts || {};
  return {
    type: b.type, name: String(b.name || GAME_TYPES[b.type].label).slice(0, 80),
    status: b.status === 'paused' ? 'paused' : 'active', theme, brand,
    per: singleReward(b.type) ? 1 : Math.min(5, Math.max(1, parseInt(b.rewards_per_play, 10) || 1)),
    texts: { heading: loc(tx.heading), subheading: loc(tx.subheading), privacy: loc(tx.privacy), triggerLabel: loc(tx.triggerLabel), privacyUrl: String(tx.privacyUrl || '').slice(0, 300), intro: cleanIntro(tx.intro), sound: cleanSound(tx.sound) },
    from_name: String(b.from_name || '').slice(0, 120), from_email: String(b.from_email || '').trim().slice(0, 254), reply_to: String(b.reply_to || '').trim().slice(0, 254),
    subject: loc(b.email_subject),
  };
}
adminRouter.post('/games', wrap(async (req, res) => {
  const f = gameFields(req.body);
  const { rows } = await q(`INSERT INTO games (store_id,type,name,status,theme,brand_accent,rewards_per_play,texts,from_name,from_email,reply_to,email_subject)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [req.body.store_id, f.type, f.name, f.status, f.theme, f.brand, f.per, f.texts, f.from_name, f.from_email, f.reply_to, f.subject]);
  res.status(201).json(rows[0]);
}));
adminRouter.put('/games/:id', wrap(async (req, res) => {
  const f = gameFields(req.body);
  const { rows } = await q(`UPDATE games SET name=$2,status=$3,theme=$4,brand_accent=$5,rewards_per_play=$6,texts=$7,from_name=$8,from_email=$9,reply_to=$10,email_subject=$11 WHERE id=$1 RETURNING *`,
    [req.params.id, f.name, f.status, f.theme, f.brand, f.per, f.texts, f.from_name, f.from_email, f.reply_to, f.subject]);
  rows[0] ? res.json(rows[0]) : res.sendStatus(404);
}));
adminRouter.delete('/games/:id', wrap(async (req, res) => { await q('DELETE FROM games WHERE id = $1', [req.params.id]); res.sendStatus(204); }));

// ---- rewards: replace the whole list. Active probabilities must total 100.
adminRouter.put('/games/:id/rewards', wrap(async (req, res) => {
  const list = Array.isArray(req.body.rewards) ? req.body.rewards : [];
  const { rows: [g] } = await q('SELECT type FROM games WHERE id = $1', [req.params.id]);
  if (!g) return res.sendStatus(404);
  const libIds = list.map((r) => r.library_id).filter((x) => /^[0-9a-f-]{36}$/i.test(x || ''));
  const { rows: libRows } = libIds.length ? await q('SELECT * FROM reward_library WHERE id = ANY($1::uuid[])', [libIds]) : { rows: [] };
  const lib = new Map(libRows.map((x) => [x.id, x]));
  const clean = list.map((r, i) => (lib.has(r.library_id) ? { ...r, ...pickLib(lib.get(r.library_id), r) } : r)).map((r, i) => ({
    library_id: lib.has(r.library_id) ? r.library_id : null,
    symbol: g.type === 'slots' && SLOT_SYMBOLS.includes(r.symbol) ? r.symbol : null,
    outcome: null, // legacy column: blackjack no longer maps a reward to a hand result
    id: r.id || null, title: loc(r.title), subtitle: loc(r.subtitle), code: String(r.code || '').trim().slice(0, 80),
    probability: Math.max(0, Math.min(100, Number(r.probability) || 0)), active: r.active !== false, sort: i,
  }));
  if (clean.some((r) => !r.library_id)) return res.status(400).json({ error: 'Rewards come from the rewards library — add them with "+ Add from library".' });
  const max = GAME_TYPES[g.type]?.maxRewards;
  if (max && clean.filter((r) => r.active).length > max) return res.status(400).json({ error: `${GAME_TYPES[g.type].label} has ${max} colours, so it can have at most ${max} active rewards.` });
  const lose = Math.max(0, Math.min(100, Number(req.body.lose_percent) || 0));
  const total = clean.filter((r) => r.active).reduce((s, r) => s + r.probability, 0) + lose;
  if ((clean.some((r) => r.active) || lose) && Math.abs(total - 100) > 0.01) return res.status(400).json({ error: `Active rewards plus "No reward" must add up to 100% (currently ${total.toFixed(2)}%).` });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE games SET lose_percent = $2 WHERE id = $1', [req.params.id, lose]);
    const keep = clean.filter((r) => r.id).map((r) => r.id);
    await client.query('DELETE FROM rewards WHERE game_id = $1 AND NOT (id = ANY($2::uuid[]))', [req.params.id, keep]);
    for (const r of clean) {
      if (r.id) await client.query('UPDATE rewards SET title=$3,subtitle=$4,code=$5,probability=$6,active=$7,sort=$8,outcome=$9,symbol=$10,library_id=$11 WHERE id=$1 AND game_id=$2', [r.id, req.params.id, r.title, r.subtitle, r.code, r.probability, r.active, r.sort, r.outcome, r.symbol, r.library_id]);
      else await client.query('INSERT INTO rewards (game_id,title,subtitle,code,probability,active,sort,outcome,symbol,library_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [req.params.id, r.title, r.subtitle, r.code, r.probability, r.active, r.sort, r.outcome, r.symbol, r.library_id]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  const { rows } = await q('SELECT * FROM rewards WHERE game_id = $1 ORDER BY sort, id', [req.params.id]);
  res.json(rows);
}));

// ---- rewards library
const pickLib = (l, r = {}) => ({ title: l.title, subtitle: l.subtitle, code: l.code, symbol: l.symbol || r.symbol || null });
const libFields = (b) => {
  const f = { title: loc(b.title), subtitle: loc(b.subtitle), code: String(b.code || '').trim().slice(0, 80), symbol: SLOT_SYMBOLS.includes(b.symbol) ? b.symbol : null };
  if (!f.title.en || !f.code) throw Object.assign(new Error('A library reward needs an English title and a code.'), { status: 400 });
  return f;
};
adminRouter.get('/library', wrap(async (_req, res) => {
  const { rows } = await q(`SELECT l.*, count(r.id)::int AS used_in,
      coalesce(json_agg(json_build_object('game_id', g.id, 'game', g.name, 'store', s.name)) FILTER (WHERE r.id IS NOT NULL), '[]') AS games
    FROM reward_library l LEFT JOIN rewards r ON r.library_id = l.id LEFT JOIN games g ON g.id = r.game_id LEFT JOIN stores s ON s.id = g.store_id
    GROUP BY l.id ORDER BY l.title->>'en'`);
  res.json(rows);
}));
adminRouter.post('/library', wrap(async (req, res) => {
  const f = libFields(req.body);
  const { rows } = await q('INSERT INTO reward_library (title, subtitle, code, symbol) VALUES ($1,$2,$3,$4) RETURNING *', [f.title, f.subtitle, f.code, f.symbol]);
  res.status(201).json(rows[0]);
}));
// editing a library reward updates every game that uses it
adminRouter.put('/library/:id', wrap(async (req, res) => {
  const f = libFields(req.body);
  const { rows } = await q('UPDATE reward_library SET title=$2, subtitle=$3, code=$4, symbol=$5 WHERE id=$1 RETURNING *', [req.params.id, f.title, f.subtitle, f.code, f.symbol]);
  if (!rows[0]) return res.sendStatus(404);
  const { rowCount } = await q(`UPDATE rewards r SET title=$2, subtitle=$3, code=$4,
      symbol = CASE WHEN g.type = 'slots' AND $5::text IS NOT NULL THEN $5 ELSE r.symbol END
    FROM games g WHERE g.id = r.game_id AND r.library_id = $1`, [req.params.id, f.title, f.subtitle, f.code, f.symbol]);
  res.json({ ...rows[0], games_updated: rowCount });
}));
// Deleting a library reward removes it from every game using it; in each game its odds move to "No reward",
// so the game still adds up to 100%.
adminRouter.delete('/library/:id', wrap(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: used } = await client.query(`SELECT game_id, sum(probability) FILTER (WHERE active) AS freed FROM rewards WHERE library_id = $1 GROUP BY game_id`, [req.params.id]);
    for (const u of used) await client.query('UPDATE games SET lose_percent = LEAST(100, lose_percent + $2) WHERE id = $1', [u.game_id, Number(u.freed) || 0]);
    await client.query('DELETE FROM rewards WHERE library_id = $1', [req.params.id]);
    const { rowCount } = await client.query('DELETE FROM reward_library WHERE id = $1', [req.params.id]);
    if (!rowCount) { await client.query('ROLLBACK'); return res.sendStatus(404); }
    await client.query('COMMIT');
    res.json({ games_updated: used.length });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));
// Games take rewards only from the library. Any reward typed straight into a game (from before the library existed)
// becomes a library entry (same code + English title = one entry) and is linked to it. Runs at startup.
export async function linkCustomRewards() {
  const client = await pool.connect(); let created = 0, linked = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT DISTINCT ON (code, title->>'en') code, title, subtitle, symbol FROM rewards WHERE library_id IS NULL ORDER BY code, title->>'en', sort`);
    for (const r of rows) {
      let { rows: [l] } = await client.query(`SELECT id FROM reward_library WHERE code = $1 AND title->>'en' = $2`, [r.code, r.title.en]);
      if (!l) { ({ rows: [l] } = await client.query('INSERT INTO reward_library (title, subtitle, code, symbol) VALUES ($1,$2,$3,$4) RETURNING id', [r.title, r.subtitle, r.code, r.symbol])); created++; }
      const u = await client.query(`UPDATE rewards SET library_id = $1 WHERE library_id IS NULL AND code = $2 AND title->>'en' = $3`, [l.id, r.code, r.title.en]); linked += u.rowCount;
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  return { created, linked };
}

// ---- stats: players, rewards tally
adminRouter.get('/games/:id/stats', wrap(async (req, res) => {
  const id = req.params.id;
  const [{ rows: [t] }, { rows: tally }, { rows: byDay }] = await Promise.all([
    q(`SELECT count(*)::int AS plays, count(DISTINCT email_norm)::int AS players,
         count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS plays_7d,
         count(*) FILTER (WHERE email_status = 'failed')::int AS email_failed FROM plays WHERE game_id = $1 AND NOT is_test`, [id]),
    q(`SELECT pr.reward_id, (array_agg(pr.title ORDER BY p.created_at DESC))[1] AS title, (array_agg(pr.code ORDER BY p.created_at DESC))[1] AS code,
         count(*)::int AS won, count(DISTINCT p.email_norm)::int AS players
       FROM play_rewards pr JOIN plays p ON p.id = pr.play_id WHERE pr.game_id = $1 AND NOT p.is_test
       GROUP BY pr.reward_id ORDER BY won DESC`, [id]),
    q(`SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'America/Toronto'), 'YYYY-MM-DD') AS day, count(*)::int AS plays
       FROM plays WHERE game_id = $1 AND NOT is_test AND created_at >= now() - interval '30 days' GROUP BY 1 ORDER BY 1`, [id]),
  ]);
  res.json({ ...t, tally, byDay });
}));

// Who won what. Optional ?reward_id= filter.
adminRouter.get('/games/:id/plays', wrap(async (req, res) => {
  const { rows } = await q(`
    SELECT p.id, p.email, p.created_at, p.email_status, p.locale, pr.reward_id, pr.title, pr.code
    FROM plays p JOIN play_rewards pr ON pr.play_id = p.id
    WHERE p.game_id = $1 AND NOT p.is_test AND ($2::uuid IS NULL OR pr.reward_id = $2)
    ORDER BY p.created_at DESC LIMIT $3 OFFSET $4`,
    [req.params.id, req.query.reward_id || null, Math.min(500, parseInt(req.query.limit, 10) || 100), parseInt(req.query.offset, 10) || 0]);
  res.json(rows);
}));

const csvCell = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// CSV export of emails (+ rewards). ?reward_id= to limit to one reward. Use game id "all" for every game.
adminRouter.get('/games/:id/export.csv', wrap(async (req, res) => {
  const all = req.params.id === 'all';
  const { rows } = await q(`
    SELECT p.email, p.locale, p.created_at, g.name AS game, s.name AS store, sg.name AS store_group, pr.title, pr.code
    FROM plays p JOIN play_rewards pr ON pr.play_id = p.id JOIN games g ON g.id = p.game_id JOIN stores s ON s.id = g.store_id
    LEFT JOIN store_groups sg ON sg.id = s.group_id
    WHERE NOT p.is_test AND ($1::boolean OR p.game_id = $2::uuid) AND ($3::uuid IS NULL OR pr.reward_id = $3)
    ORDER BY p.created_at DESC`, [all, all ? null : req.params.id, req.query.reward_id || null]);
  const head = 'email,store_group,store,game,reward,code,language,played_at';
  const body = rows.map((r) => [r.email, r.store_group, r.store, r.game, r.title?.en, r.code, r.locale, r.created_at.toISOString()].map(csvCell).join(','));
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="players.csv"').send([head, ...body].join('\n'));
}));

registerReports(adminRouter, wrap, csvCell);

adminRouter.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'server_error' });
});

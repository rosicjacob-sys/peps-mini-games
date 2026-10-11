import { Router } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pickLocale, GAME_TYPES } from '@peps/shared';
import { buildScript } from '@peps/shared/blackjack.js';
import { q, pool } from './db.js';
import { weekInfo, normalizeEmail, pickRewards, hashIp, formatExpiry, secureRandom } from './lib.js';
import { buildEmail, sendEmail } from './email.js';

export const publicRouter = Router();
publicRouter.use(cors({ origin: true }));

const playLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

async function storeByKey(key, origin) {
  const { rows } = await q('SELECT * FROM stores WHERE public_key = $1', [String(key || '')]);
  const store = rows[0];
  if (!store) return null;
  if (store.allowed_origins.length && origin && !store.allowed_origins.includes(origin)) return null;
  return store;
}

const publicGame = (g, rewards) => ({
  id: g.id, type: g.type, name: g.name, theme: g.theme, brandAccent: g.brand_accent,
  rewardsPerPlay: g.rewards_per_play, texts: g.texts,
  // titles only — never codes or probabilities
  rewards: rewards.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, symbol: r.symbol })),
});

// Active games for a store.
publicRouter.get('/config', async (req, res) => {
  const store = await storeByKey(req.query.key, req.get('origin'));
  if (!store) return res.status(404).json({ error: 'unknown_store' });
  const { rows: games } = await q("SELECT * FROM games WHERE store_id = $1 AND status = 'active' ORDER BY created_at", [store.id]);
  const out = [];
  for (const g of games) {
    const { rows: rewards } = await q('SELECT id, title, subtitle, symbol FROM rewards WHERE game_id = $1 AND active ORDER BY sort, id', [g.id]);
    if (rewards.length) out.push(publicGame(g, rewards));
  }
  res.set('Cache-Control', 'public, max-age=60').json({ games: out });
});

// One play per email per game per ET week. The server rolls the outcome; the widget only animates it.
publicRouter.post('/play', playLimiter, async (req, res) => {
  const { key, gameId } = req.body || {};
  const locale = pickLocale(req.body?.locale);
  const store = await storeByKey(key, req.get('origin'));
  if (!store) return res.status(404).json({ error: 'unknown_store' });
  const mail = normalizeEmail(req.body?.email);
  if (!mail) return res.status(400).json({ error: 'invalid_email' });

  const { rows: [game] } = await q("SELECT * FROM games WHERE id = $1 AND store_id = $2 AND status = 'active'", [gameId, store.id]);
  if (!game || !GAME_TYPES[game.type]) return res.status(404).json({ error: 'game_unavailable' });
  const { rows: rewards } = await q('SELECT * FROM rewards WHERE game_id = $1 AND active ORDER BY sort, id', [game.id]);
  // blackjack (one hand) and slots (one payline) always award exactly one reward
  const picks = pickRewards(rewards, ['blackjack', 'slots'].includes(game.type) ? 1 : game.rewards_per_play);
  if (!picks.length) return res.status(409).json({ error: 'game_unavailable' });

  const week = weekInfo();
  const client = await pool.connect();
  let playId;
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO plays (game_id, email, email_norm, week_key, locale, ip_hash)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (game_id, email_norm, week_key) DO NOTHING RETURNING id`,
      [game.id, mail.email, mail.norm, week.weekKey, locale, hashIp(req.ip)]);
    if (!ins.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'already_played', nextPlayAt: week.nextPlayAt }); }
    playId = ins.rows[0].id;
    for (const r of picks) {
      await client.query('INSERT INTO play_rewards (play_id, game_id, reward_id, title, subtitle, code) VALUES ($1,$2,$3,$4,$5,$6)',
        [playId, game.id, r.id, JSON.stringify(r.title), JSON.stringify(r.subtitle || {}), r.code]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e); return res.status(500).json({ error: 'server_error' });
  } finally { client.release(); }

  // Email is sent after responding so the player is never blocked by Resend.
  const content = buildEmail({ game, rewards: picks, locale, expiresAt: week.expiresAt });
  sendEmail({ game, to: mail.email, mail: content })
    .then((ok) => q('UPDATE plays SET email_status = $2 WHERE id = $1', [playId, ok ? 'sent' : 'failed']))
    .catch((e) => { console.error(e); return q("UPDATE plays SET email_status = 'failed' WHERE id = $1", [playId]); });

  res.json({
    email: mail.email,
    rewards: picks.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, symbol: r.symbol, code: r.code })),
    // the hand is dealt so it ends in this reward's configured result, whatever the player does
    ...(game.type === 'blackjack' ? { script: buildScript(picks[0].outcome || 'win', secureRandom) } : {}),
    expiresAt: week.expiresAt,
    expiresText: formatExpiry(week.expiresAt, locale),
  });
});

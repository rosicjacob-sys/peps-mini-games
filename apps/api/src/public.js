import { Router } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pickLocale, GAME_TYPES } from '@peps/shared';
import { buildScript } from '@peps/shared/blackjack.js';
import { buildLucky9, buildBaccarat, buildPokerHand, pokerTiers, colorDice } from '@peps/shared/cards.js';
import { singleReward } from '@peps/shared';
import { q, pool } from './db.js';
import { weekInfo, normalizeEmail, pickRewards, hashIp, formatExpiry, secureRandom, isTestEmail } from './lib.js';
import crypto from 'node:crypto';
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

const publicGame = (g, rewards) => { const tiers = g.type === 'poker' ? pokerTiers(rewards) : null; return {
  id: g.id, type: g.type, name: g.name, theme: g.theme, brandAccent: g.brand_accent,
  rewardsPerPlay: g.rewards_per_play, texts: g.texts,
  // titles only — never codes or probabilities
  rewards: rewards.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, symbol: r.symbol, ...(tiers ? { hand: tiers[r.id] } : {}) })),
}; };

// Active games for a store.
publicRouter.get('/config', async (req, res) => {
  const store = await storeByKey(req.query.key, req.get('origin'));
  if (!store) return res.status(404).json({ error: 'unknown_store' });
  const { rows: games } = await q("SELECT * FROM games WHERE store_id = $1 AND status = 'active' ORDER BY created_at", [store.id]);
  const out = [];
  for (const g of games) {
    const { rows: rewards } = await q('SELECT id, title, subtitle, symbol, probability, sort FROM rewards WHERE game_id = $1 AND active ORDER BY sort, id', [g.id]);
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

  const { rows: [game] } = await q(`SELECT g.*, sg.from_name AS group_from_name, sg.from_email AS group_from_email, sg.reply_to AS group_reply_to
    FROM games g JOIN stores s ON s.id = g.store_id LEFT JOIN store_groups sg ON sg.id = s.group_id
    WHERE g.id = $1 AND g.store_id = $2 AND g.status = 'active'`, [gameId, store.id]);
  if (!game || !GAME_TYPES[game.type]) return res.status(404).json({ error: 'game_unavailable' });
  const { rows: rewards } = await q('SELECT * FROM rewards WHERE game_id = $1 AND active ORDER BY sort, id', [game.id]);
  // every game except the wheel shows one outcome, so it awards exactly one reward
  const picks = pickRewards(rewards, singleReward(game.type) ? 1 : game.rewards_per_play);
  if (!picks.length) return res.status(409).json({ error: 'game_unavailable' });

  const week = weekInfo();
  const test = isTestEmail(mail.norm);
  // a test email gets a unique week key so the one-play-per-week constraint never blocks it
  const weekKey = test ? `${week.weekKey}/test-${crypto.randomUUID()}` : week.weekKey;
  const client = await pool.connect();
  let playId;
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO plays (game_id, email, email_norm, week_key, locale, ip_hash, is_test)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (game_id, email_norm, week_key) DO NOTHING RETURNING id`,
      [game.id, mail.email, mail.norm, weekKey, locale, hashIp(req.ip), test]);
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
    .then((r) => q('UPDATE plays SET email_status = $2, email_error = $3, last_email_at = now() WHERE id = $1', [playId, r.ok ? 'sent' : 'failed', r.ok ? null : r.error]))
    .catch((e) => { console.error(e); return q("UPDATE plays SET email_status = 'failed', email_error = $2, last_email_at = now() WHERE id = $1", [playId, String(e.message || e).slice(0, 300)]); });

  res.json({
    email: mail.email,
    ...(test ? { test: true } : {}),
    rewards: picks.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, symbol: r.symbol, code: r.code })),
    // blackjack: the hand is a warm-up the player always wins (a natural 21 one time in five); the wheel
    // that follows decides the reward, so the reward odds are the only thing that matters
    ...(game.type === 'blackjack' ? { script: buildScript(secureRandom() < 0.2 ? 'blackjack' : 'win', secureRandom) } : {}),
    ...(game.type === 'lucky9' ? { script: buildLucky9(secureRandom) } : {}),
    ...(game.type === 'baccarat' ? { script: buildBaccarat(secureRandom) } : {}),
    // poker: the hand shown is the one the paytable maps to the reward won
    ...(game.type === 'poker' ? { script: { hand: pokerTiers(rewards)[picks[0].id], cards: buildPokerHand(pokerTiers(rewards)[picks[0].id], secureRandom) } } : {}),
    // color game: dice for the winning reward's colour (its position on the board)
    ...(game.type === 'color' ? { script: { dice: colorDice(rewards.findIndex((r) => r.id === picks[0].id), rewards.length, secureRandom) } } : {}),
    expiresAt: week.expiresAt,
    expiresText: formatExpiry(week.expiresAt, locale),
  });
});

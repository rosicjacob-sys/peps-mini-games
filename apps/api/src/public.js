import express, { Router } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { pickLocale, GAME_TYPES } from '@peps/shared';
import { buildScript } from '@peps/shared/blackjack.js';
import { buildLucky9, buildBaccarat, buildPokerHand, pokerTiers, colorDice } from '@peps/shared/cards.js';
import { singleReward } from '@peps/shared';
import { q, pool } from './db.js';
import { weekInfo, normalizeEmail, pickRewards, hashIp, formatDate, secureRandom, isTestEmail, isUuid } from './lib.js';
import crypto from 'node:crypto';
import { unsubToken } from './reminders.js';
import { detectStoreColors } from './colors.js';
import { isHex } from '@peps/shared';

export const publicRouter = Router();
publicRouter.use(cors({ origin: true }));

// per-IP plays per minute (PLAY_RATE_LIMIT to change)
const playLimiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.PLAY_RATE_LIMIT) || 20, standardHeaders: true, legacyHeaders: false });

// The store a request is for. With a key (data-store on the install line), that store, if the page's website is
// allowed. Without one (the shared install line), the store whose allowed websites include the page's website.
// Archived stores answer to nobody.
async function storeByKey(key, origin) {
  if (!key) {
    if (!origin) return null;
    const { rows } = await q('SELECT * FROM stores WHERE $1 = ANY(allowed_origins) AND archived_at IS NULL ORDER BY created_at LIMIT 1', [String(origin).replace(/\/$/, '').toLowerCase()]);
    return rows[0] || null;
  }
  const { rows } = await q('SELECT * FROM stores WHERE public_key = $1 AND archived_at IS NULL', [String(key)]);
  const store = rows[0];
  if (!store) return null;
  if (store.allowed_origins.length && origin && !store.allowed_origins.includes(String(origin).toLowerCase())) return null;
  return store;
}

const publicGame = (g, rewards) => { const tiers = g.type === 'poker' ? pokerTiers(rewards) : null; return {
  id: g.id, type: g.type, name: g.name, theme: g.theme, brandAccent: g.brand_accent,
  rewardsPerPlay: g.rewards_per_play, texts: g.texts, canLose: Number(g.lose_percent) > 0,
  // whether this game's players get the weekly "play again" email (the widget's loss screen mentions it)
  reminders: g.texts?.reminder?.enabled !== false,
  // titles only - never codes or probabilities
  rewards: rewards.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, symbol: r.symbol, ...(tiers ? { hand: tiers[r.id] } : {}) })),
}; };

// a store's website colours, for arcade games set to "Match my website"
const siteColors = (store) => { const c = store?.colors || {}; return isHex(c.main) ? { main: c.main, second: isHex(c.second) ? c.second : '' } : null; };

// ---- preview: the dashboard opens a game in the widget with a short-lived token; nothing is recorded
export const previewToken = (gameId) => jwt.sign({ preview: gameId }, process.env.JWT_SECRET, { expiresIn: '2h' });
const previewGameId = (token) => { try { const p = jwt.verify(String(token || ''), process.env.JWT_SECRET); return isUuid(p.preview) ? p.preview : null; } catch { return null; } };

// The config a store's visitors get (its group's live games with rewards, the group's popup, the store's colours).
// Cached for CONFIG_TTL per store: every page view on every store asks for it. Admin saves clear the cache, so a
// change in the dashboard is live on the next page load; the TTL is only the backstop.
const CONFIG_TTL = Number(process.env.CONFIG_CACHE_MS) || 30_000;
const configCache = new Map();
export const clearConfigCache = () => configCache.clear();
async function buildConfig(store) {
  const { rows: [grp] } = await q('SELECT intro FROM store_groups WHERE id = $1', [store.group_id]);
  const { rows: games } = await q("SELECT * FROM games WHERE group_id = $1 AND status = 'active' AND archived_at IS NULL ORDER BY created_at", [store.group_id]);
  const out = [];
  for (const g of games) {
    const { rows: rewards } = await q('SELECT id, title, subtitle, symbol, probability, sort FROM rewards WHERE game_id = $1 AND active ORDER BY sort, id', [g.id]);
    if (rewards.length) out.push(publicGame(g, rewards));
  }
  return { games: out, intro: grp?.intro || {}, site: siteColors(store) };
}

// Active games for a store.
publicRouter.get('/config', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  const pv = req.query.preview && previewGameId(req.query.preview);
  if (pv) {
    // a game being previewed from the dashboard: shown even when paused or without rewards, in its group's first store's colours
    const { rows: [g] } = await q('SELECT * FROM games WHERE id = $1', [pv]);
    if (!g) return res.status(404).json({ error: 'unknown_game' });
    const { rows: rewards } = await q('SELECT id, title, subtitle, symbol, probability, sort FROM rewards WHERE game_id = $1 AND active ORDER BY sort, id', [g.id]);
    const { rows: [grp] } = await q('SELECT intro FROM store_groups WHERE id = $1', [g.group_id]);
    const { rows: [store] } = await q('SELECT * FROM stores WHERE group_id = $1 AND archived_at IS NULL ORDER BY created_at LIMIT 1', [g.group_id]);
    return res.json({ games: [publicGame(g, rewards)], intro: grp?.intro || {}, site: siteColors(store), preview: true });
  }
  const store = await storeByKey(req.query.key, req.get('origin'));
  if (!store) return res.status(404).json({ error: 'unknown_store' });
  let hit = configCache.get(store.id);
  if (!hit || Date.now() - hit.at > CONFIG_TTL) { hit = { at: Date.now(), body: await buildConfig(store) }; configCache.set(store.id, hit); }
  // the store's own website colours not read yet: read them now in the background (at most once a day), the next visitor gets them
  const c = store.colors || {};
  const hasSite = store.site_url || store.allowed_origins.length;
  if (!hit.body.site && hasSite && c.mode !== 'manual' && (!c.tried_at || Date.now() - Date.parse(c.tried_at) > 864e5)) detectStoreColors(store.id).catch(() => {});
  res.json(hit.body);
});

// The story each game tells for the decided outcome (cards dealt, dice, poker hand). The reward is already picked.
function script(game, rewards, picks, lost) {
  switch (game.type) {
    // blackjack: the hand is a warm-up the player always wins (a natural 21 one time in five); the wheel that
    // follows decides the reward. A loss is lost in the game itself.
    case 'blackjack': return { script: buildScript(lost ? 'loss' : secureRandom() < 0.2 ? 'blackjack' : 'win', secureRandom) };
    case 'lucky9': return { script: buildLucky9(lost ? 'loss' : 'win', secureRandom) };
    case 'baccarat': return { script: buildBaccarat(lost ? 'loss' : 'win', secureRandom) };
    // poker: the hand shown is the one the paytable maps to the reward won ('high' = no winning hand)
    case 'poker': { const hand = lost ? 'high' : pokerTiers(rewards)[picks[0].id]; return { script: { hand, cards: buildPokerHand(hand, secureRandom) } }; }
    // color game: dice for the winning reward's colour (its position on the board); a loss shows three colours
    case 'color': return { script: { dice: colorDice(lost ? -1 : rewards.findIndex((r) => r.id === picks[0].id), rewards.length, secureRandom) } };
    default: return {};
  }
}

// Roll a play: does it win nothing, and if not, which reward(s)?
function roll(game, rewards) {
  const lost = secureRandom() * 100 < Number(game.lose_percent || 0);
  // every game except the wheel shows one outcome, so it awards exactly one reward
  const picks = lost ? [] : pickRewards(rewards, singleReward(game.type) ? 1 : game.rewards_per_play);
  return { lost, picks };
}
const rewardOut = (r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, symbol: r.symbol, code: r.code });

// One play per email per store group per ET week. The server rolls the outcome; the widget only animates it.
publicRouter.post('/play', playLimiter, async (req, res) => {
  const { key, gameId, preview } = req.body || {};
  const locale = pickLocale(req.body?.locale);
  const week = weekInfo();

  // preview from the dashboard: roll and answer, record nothing
  const pv = preview && previewGameId(preview);
  if (pv) {
    const { rows: [game] } = await q('SELECT * FROM games WHERE id = $1 AND id = $2', [gameId, pv]);
    if (!game || !GAME_TYPES[game.type]) return res.status(404).json({ error: 'game_unavailable' });
    const { rows: rewards } = await q('SELECT * FROM rewards WHERE game_id = $1 AND active ORDER BY sort, id', [game.id]);
    const { lost, picks } = roll(game, rewards);
    if (!lost && !picks.length) return res.status(409).json({ error: 'game_unavailable' });
    return res.json({ preview: true, email: String(req.body?.email || ''), ...(lost ? { lost: true, nextPlayAt: week.nextPlayAt, nextPlayText: formatDate(week.nextPlayAt, locale) } : {}),
      rewards: picks.map(rewardOut), ...script(game, rewards, picks, lost), expiresAt: week.expiresAt });
  }

  const store = await storeByKey(key, req.get('origin'));
  if (!store) return res.status(404).json({ error: 'unknown_store' });
  const mail = normalizeEmail(req.body?.email);
  if (!mail) return res.status(400).json({ error: 'invalid_email' });

  const { rows: [game] } = await q(`SELECT g.* FROM games g WHERE g.id = $1 AND g.group_id = $2 AND g.status = 'active' AND g.archived_at IS NULL`, [isUuid(gameId) ? gameId : null, store.group_id]);
  if (!game || !GAME_TYPES[game.type]) return res.status(404).json({ error: 'game_unavailable' });
  const { rows: rewards } = await q('SELECT * FROM rewards WHERE game_id = $1 AND active ORDER BY sort, id', [game.id]);
  const { lost, picks } = roll(game, rewards);
  if (!lost && !picks.length) return res.status(409).json({ error: 'game_unavailable' });

  const test = isTestEmail(mail.norm);
  // a test email gets a unique week key so the one-play-per-week rule never blocks it
  const weekKey = test ? `${week.weekKey}/test-${crypto.randomUUID()}` : week.weekKey;
  const already = () => res.status(409).json({ error: 'already_played', email: mail.email, nextPlayAt: week.nextPlayAt, nextPlayText: formatDate(week.nextPlayAt, locale) });
  const client = await pool.connect();
  let playId;
  try {
    await client.query('BEGIN');
    // one play per email per week across every store of the group (another email can play again).
    // The lock makes two simultaneous plays with the same email wait for each other.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${store.group_id}|${mail.norm}|${weekKey}`]);
    const { rowCount: played } = await client.query(
      `SELECT 1 FROM plays p JOIN stores s ON s.id = p.store_id WHERE s.group_id = $1 AND p.email_norm = $2 AND p.week_key = $3 LIMIT 1`,
      [store.group_id, mail.norm, weekKey]);
    if (played) { await client.query('ROLLBACK'); return already(); }
    const ins = await client.query(
      `INSERT INTO plays (game_id, store_id, email, email_norm, week_key, locale, ip_hash, is_test, email_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [game.id, store.id, mail.email, mail.norm, weekKey, locale, hashIp(req.ip), test, 'skipped']);
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

  // Codes are shown on screen only (no code email). Players hear from us again in the weekly reminder.
  res.json({
    email: mail.email,
    ...(test ? { test: true } : {}),
    ...(lost ? { lost: true, nextPlayAt: week.nextPlayAt, nextPlayText: formatDate(week.nextPlayAt, locale) } : {}),
    rewards: picks.map(rewardOut),
    ...script(game, rewards, picks, lost),
    expiresAt: week.expiresAt,
  });
});

// Unsubscribe from a store's weekly reminders. GET from the email's link; POST from mail apps' one-click button.
const UNSUB_PAGE = (ok) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? 'Unsubscribed' : 'Link not valid'}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f6;color:#111827;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="background:#fff;border-radius:16px;padding:32px 28px;max-width:440px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.08)">
${ok ? `<h1 style="margin:0 0 10px;font-size:22px">You are unsubscribed</h1><p style="margin:0;line-height:1.5">You will not get weekly game reminders from this store any more.</p>
<hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0"><h2 style="margin:0 0 8px;font-size:18px">Vous êtes désabonné</h2><p style="margin:0;line-height:1.5">Vous ne recevrez plus les rappels de jeu hebdomadaires de cette boutique.</p>`
    : `<h1 style="margin:0 0 10px;font-size:22px">This link is not valid</h1><p style="margin:0">Ce lien n’est pas valide.</p>`}
</div></body></html>`;
async function unsubscribe(req, res) {
  const { s, e, t } = { ...req.query, ...(req.body || {}) };
  const ok = isUuid(s) && e && t && crypto.timingSafeEqual(Buffer.from(String(t).padEnd(32).slice(0, 32)), Buffer.from(unsubToken(s, String(e))));
  if (ok) {
    await q('INSERT INTO unsubscribes (store_id, email_norm) VALUES ($1, $2) ON CONFLICT DO NOTHING', [s, String(e)]).catch(() => {});
    await q(`UPDATE reminders SET status = 'skipped', error = 'Unsubscribed' WHERE store_id = $1 AND email_norm = $2 AND status IN ('pending', 'failed')`, [s, String(e)]).catch(() => {});
  }
  res.status(ok ? 200 : 400).type('html').send(UNSUB_PAGE(ok));
}
publicRouter.get('/unsubscribe', unsubscribe);
publicRouter.post('/unsubscribe', express.urlencoded({ extended: false }), unsubscribe);

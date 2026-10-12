// Weekly "play again" reminders. After the Monday 00:00 ET reset, everyone who played one of a store's games the
// week before gets one email inviting them back (one per store + email + week). Skipped: test emails, people who
// unsubscribed, people who already played again this week, and games with reminders switched off.
// The job runs every 15 minutes, so a reminder still goes out if the API was asleep at midnight; a unique key
// and an advisory lock mean nobody gets the same reminder twice.
import crypto from 'node:crypto';
import { q, pool } from './db.js';
import { weekInfo } from './lib.js';
import { buildReminder, sendEmail } from './email.js';

const LOCK = 74219031;      // pg advisory lock id for the job
const GAP_MS = 600;         // one email at a time, under Resend's default rate limit
const MAX_ATTEMPTS = 3;     // failed reminders are retried on later runs, up to this many tries
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const unsubToken = (storeId, norm) => crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev').update(`unsub|${storeId}|${norm}`).digest('base64url').slice(0, 32);
const apiBase = () => (process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
export const unsubUrl = (storeId, norm) => (apiBase() ? `${apiBase()}/api/public/unsubscribe?s=${storeId}&e=${encodeURIComponent(norm)}&t=${unsubToken(storeId, norm)}` : null);
// the store's site, with ?pg_play=1 so the widget opens the game straight away
export function playUrl(store) {
  const base = store.site_url || store.allowed_origins?.[0];
  if (!base) return null;
  try { const u = new URL(base); u.searchParams.set('pg_play', '1'); return u.toString(); } catch { return null; }
}

const GAME_SQL = `SELECT g.*, s.name AS store_name, s.site_url, s.allowed_origins,
    sg.from_name AS group_from_name, sg.from_email AS group_from_email, sg.reply_to AS group_reply_to
  FROM games g JOIN stores s ON s.id = g.store_id LEFT JOIN store_groups sg ON sg.id = s.group_id WHERE g.id = $1`;

export async function reminderFor(gameId, locale, storeId, norm) {
  const { rows: [game] } = await q(GAME_SQL, [gameId]);
  if (!game) return null;
  return { game, mail: buildReminder({ game, locale, playUrl: playUrl(game), unsubUrl: norm ? unsubUrl(storeId, norm) : null }) };
}

// send one queued reminder (re-checking that it is still wanted) and record the outcome
export async function deliver(rem) {
  const skip = async (why) => { await q(`UPDATE reminders SET status = 'skipped', error = $2 WHERE id = $1`, [rem.id, why]); return { ok: false, skipped: true, error: why }; };
  const { rows: [why] } = await q(`SELECT
      EXISTS (SELECT 1 FROM unsubscribes u WHERE u.store_id = $1 AND u.email_norm = $2) AS unsub,
      EXISTS (SELECT 1 FROM plays p JOIN games g ON g.id = p.game_id WHERE g.store_id = $1 AND p.email_norm = $2 AND p.week_key = $3) AS played`,
    [rem.store_id, rem.email_norm, rem.week_key]);
  if (why.unsub) return skip('Unsubscribed');
  if (why.played) return skip('Already played again this week');
  const built = rem.game_id && await reminderFor(rem.game_id, rem.locale, rem.store_id, rem.email_norm);
  if (!built) return skip('The game was deleted');
  const link = unsubUrl(rem.store_id, rem.email_norm);
  const r = await sendEmail({ game: built.game, to: rem.email, mail: built.mail, headers: link ? { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined });
  await q(`UPDATE reminders SET status = $2, error = $3, attempts = attempts + 1, sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END WHERE id = $1`,
    [rem.id, r.ok ? 'sent' : 'failed', r.ok ? null : r.error]);
  return r;
}

// queue: one reminder per store + email that played last week (their latest game there decides sender and look)
async function queue(db, w) {
  const ins = await db.query(`INSERT INTO reminders (store_id, game_id, email, email_norm, locale, week_key)
    SELECT DISTINCT ON (g.store_id, p.email_norm) g.store_id, p.game_id, p.email, p.email_norm, p.locale, $2
    FROM plays p JOIN games g ON g.id = p.game_id
    WHERE p.week_key = $1 AND NOT p.is_test
      AND coalesce((g.texts->'reminder'->>'enabled')::boolean, true)
      AND EXISTS (SELECT 1 FROM games a WHERE a.store_id = g.store_id AND a.status = 'active')
      AND NOT EXISTS (SELECT 1 FROM unsubscribes u WHERE u.store_id = g.store_id AND u.email_norm = p.email_norm)
    ORDER BY g.store_id, p.email_norm, p.created_at DESC
    ON CONFLICT (store_id, email_norm, week_key) DO NOTHING`, [w.prevWeekKey, w.weekKey]);
  return ins.rowCount;
}

// Queue this week's reminders and send everything due. `onQueued` lets the dashboard answer before the slow part.
export async function runReminders({ onQueued } = {}) {
  const client = await pool.connect();
  let locked = false;
  try {
    ({ rows: [{ ok: locked }] } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK]));
    if (!locked) { const r = { running: true, queued: 0, due: 0, sent: 0, failed: 0, skipped: 0 }; onQueued?.(r); return r; }
    const w = weekInfo();
    const queued = await queue(client, w);
    const { rows: due } = await client.query(`SELECT * FROM reminders WHERE week_key = $1
      AND (status = 'pending' OR (status = 'failed' AND attempts < $2)) ORDER BY created_at, id LIMIT 1000`, [w.weekKey, MAX_ATTEMPTS]);
    const out = { queued, due: due.length, sent: 0, failed: 0, skipped: 0 };
    onQueued?.({ ...out });
    for (const rem of due) {
      const r = await deliver(rem).catch((e) => ({ ok: false, error: String(e.message || e) }));
      if (r.ok) out.sent++; else if (r.skipped) out.skipped++; else out.failed++;
      // pause only after a real call to Resend (setup errors fail instantly)
      if (r.ok || /^Resend /.test(r.error || '')) await sleep(GAP_MS);
    }
    return out;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => {});
    client.release();
  }
}

// every 15 minutes (and shortly after start); REMINDERS=off disables it
export function scheduleReminders() {
  if (process.env.REMINDERS === 'off') return console.log('[reminders] off (REMINDERS=off)');
  const tick = () => runReminders()
    .then((r) => { if (r.queued || r.sent || r.failed) console.log('[reminders]', JSON.stringify(r)); })
    .catch((e) => console.error('[reminders]', e));
  setTimeout(tick, 30_000);
  setInterval(tick, 15 * 60_000);
}

import { DateTime } from 'luxon';
import crypto from 'node:crypto';

const ZONE = 'America/Toronto'; // "ET"

// Play weeks run Monday 00:00 -> Sunday 23:59:59 ET.
export function weekInfo(now = DateTime.now()) {
  const et = now.setZone(ZONE);
  const start = et.startOf('week'); // luxon weeks start Monday
  const end = start.plus({ weeks: 1 });
  return {
    weekKey: start.toISODate(),
    prevWeekKey: start.minus({ weeks: 1 }).toISODate(),
    expiresAt: end.minus({ seconds: 1 }).toISO(),       // Sunday 23:59:59 ET
    nextPlayAt: end.toISO(),                            // Monday 00:00 ET
  };
}

export function formatDate(iso, locale) {
  return DateTime.fromISO(iso).setZone(ZONE).setLocale(locale === 'fr' ? 'fr-CA' : 'en-CA')
    .toLocaleString({ weekday: 'long', month: 'long', day: 'numeric' });
}

export function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 254) return null;
  let [local, domain] = e.split('@');
  local = local.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') { local = local.replace(/\./g, ''); domain = 'gmail.com'; }
  return { email: e, norm: `${local}@${domain}` };
}

// Weighted pick of `count` distinct rewards. Probabilities are renormalised after each draw.
export function pickRewards(rewards, count = 1, rand = secureRandom) {
  const pool = rewards.filter((r) => r.active && Number(r.probability) > 0).map((r) => ({ r, w: Number(r.probability) }));
  const out = [];
  while (out.length < count && pool.length) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let roll = rand() * total;
    let idx = pool.findIndex((x) => (roll -= x.w) < 0);
    if (idx === -1) idx = pool.length - 1;
    out.push(pool[idx].r);
    pool.splice(idx, 1);
  }
  return out;
}

export function secureRandom() {
  return crypto.randomInt(0, 2 ** 32) / 2 ** 32;
}

export const hashIp = (ip) => crypto.createHash('sha256').update(`${ip}|${process.env.JWT_SECRET || ''}`).digest('hex').slice(0, 32);

// Internal test emails: unlimited plays, and their plays are kept out of stats and exports.
// Override with TEST_EMAILS="a@x.com,b@y.com" on the API.
const DEFAULT_TEST_EMAILS = ['mosada.jerome.d@gmail.com', 'vantatechca@gmail.com', 'rosicjacob@gmail.com'];
const TEST_EMAILS = new Set(
  (process.env.TEST_EMAILS ? process.env.TEST_EMAILS.split(',') : DEFAULT_TEST_EMAILS)
    .map((e) => normalizeEmail(e)?.norm).filter(Boolean),
);
export const isTestEmail = (norm) => TEST_EMAILS.has(norm);

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => UUID.test(String(v || ''));

// A website typed by an admin -> its origin ("https://www.shop.com"), or null. "shop.com" gets https://.
export function siteOrigin(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  // "shop.com" gets https://; any other scheme (ftp:, javascript:) is refused
  try { const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`); return /^https?:$/.test(u.protocol) ? u.origin.toLowerCase() : null; } catch { return null; }
}
// Visitors land on either "shop.com" or "www.shop.com", so a store answers to both spellings of each website.
export function originVariants(origin) {
  const u = new URL(origin);
  const twin = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`;
  // no twin for bare hosts (localhost) or IPs
  if (!u.hostname.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return [origin];
  return [origin, `${u.protocol}//${twin}${u.port ? `:${u.port}` : ''}`];
}

// Each store's own brand colours, read from its homepage. Arcade games set to "Match my website" use the colours of
// the store they are shown on (games are shared by a store group, so this has to be per store).
// Detected automatically when a store is saved with a website, at startup for stores not yet detected, and when the
// widget loads for a store that still has none; an admin can override them (mode 'manual') or re-detect.
import { q } from './db.js';

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, '0')).join('')}`;
// a brand colour: saturated, not near-white or near-black
function colourful(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return sat > 0.25 && l > 0.12 && l < 0.88;
}
const storeUrl = (s) => s.site_url || s.allowed_origins?.[0] || null;

// the colours a page uses most: theme-color meta first, then theme CSS colour variables, then any colour in the page
export async function detectSiteColors(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (peps-games colour check)' }, redirect: 'follow' });
  const html = (await r.text()).slice(0, 3_000_000);
  const counts = new Map(); const add = (hex, w = 1) => { hex = hex.toLowerCase(); if (colourful(hex)) counts.set(hex, (counts.get(hex) || 0) + w); };
  const meta = html.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["'](#[0-9a-f]{6})/i)?.[1];
  if (meta) add(meta, 50);
  for (const m of html.matchAll(/--[\w-]*colou?r[\w-]*\s*:\s*(#[0-9a-f]{6})\b/gi)) add(m[1], 5);
  for (const m of html.matchAll(/--[\w-]*colou?r[\w-]*\s*:\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\b/gi)) add(toHex(m[1], m[2], m[3]), 5);
  for (const m of html.matchAll(/#([0-9a-f]{6})\b/gi)) add(`#${m[1]}`);
  for (const m of html.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi)) add(toHex(m[1], m[2], m[3]));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex]) => hex);
}

// detect a store's colours and save them (main = the most used, second = the next one, if any);
// a manual choice is left alone unless `force`
export async function detectStoreColors(storeId, { force = false } = {}) {
  const { rows: [s] } = await q('SELECT * FROM stores WHERE id = $1', [storeId]);
  if (!s) return null;
  const url = storeUrl(s);
  const tried = { ...(s.colors || {}), tried_at: new Date().toISOString() };
  if (!url) return { error: 'This store has no website listed.' };
  if (tried.mode === 'manual' && !force) return { ...tried, skipped: 'manual' };
  try {
    const found = await detectSiteColors(url);
    const colors = found.length ? { mode: 'auto', main: found[0], second: found[1] || '', found, from: url, detected_at: tried.tried_at, tried_at: tried.tried_at } : { ...tried, found: [], from: url, mode: 'auto' };
    await q('UPDATE stores SET colors = $2 WHERE id = $1', [storeId, colors]);
    return colors;
  } catch (e) {
    await q('UPDATE stores SET colors = $2 WHERE id = $1', [storeId, { ...tried, error: String(e.message || e).slice(0, 200) }]);
    return { ...tried, error: `Could not open ${url} (${e.name === 'TimeoutError' ? 'timed out' : e.message}).` };
  }
}

// stores with a website but no colours yet; at most one try a day each (startup and widget loads call this)
export async function detectMissingColors() {
  const { rows } = await q(`SELECT id FROM stores WHERE (site_url IS NOT NULL OR cardinality(allowed_origins) > 0)
    AND coalesce(colors->>'mode', 'auto') = 'auto' AND colors->>'main' IS NULL
    AND (colors->>'tried_at' IS NULL OR (colors->>'tried_at')::timestamptz < now() - interval '1 day')`);
  for (const r of rows) await detectStoreColors(r.id).catch(() => {});
  return rows.length;
}

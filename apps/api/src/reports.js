// Reporting: overview KPIs and charts, players directory, email delivery, filtered exports.
// Every report takes the same filters: from/to (ET calendar dates, inclusive), group_id, store_id, game_id.
// Test-email plays are always excluded.
import { DateTime } from 'luxon';
import { q } from './db.js';
import { buildEmail, sendEmail } from './email.js';
import { normalizeEmail } from './lib.js';

const ZONE = 'America/Toronto';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const BASE = `FROM plays p JOIN games g ON g.id = p.game_id JOIN stores s ON s.id = g.store_id LEFT JOIN store_groups sg ON sg.id = s.group_id`;
const ET = `'${ZONE}'`;
const dayStart = (n) => `($${n}::date::timestamp AT TIME ZONE ${ET})`;
const dayEnd = (n) => `(($${n}::date + 1)::timestamp AT TIME ZONE ${ET})`;

export function parseRange(qs) {
  const today = DateTime.now().setZone(ZONE).startOf('day');
  let to = DAY.test(qs.to || '') ? DateTime.fromISO(qs.to, { zone: ZONE }) : today;
  let from = DAY.test(qs.from || '') ? DateTime.fromISO(qs.from, { zone: ZONE }) : to.minus({ days: 29 });
  if (from > to) [from, to] = [to, from];
  const days = Math.round(to.diff(from, 'days').days) + 1;
  const prevTo = from.minus({ days: 1 });
  const prevFrom = prevTo.minus({ days: days - 1 });
  return { from: from.toISODate(), to: to.toISODate(), days, prevFrom: prevFrom.toISODate(), prevTo: prevTo.toISODate() };
}

// WHERE fragments for the non-date filters. `params` is mutated.
function scope(qs, params, { withTest = false } = {}) {
  const w = withTest ? [] : ['NOT p.is_test'];
  if (UUID.test(qs.group_id || '')) { params.push(qs.group_id); w.push(`s.group_id = $${params.length}`); }
  if (qs.group_id === 'none') w.push('s.group_id IS NULL');
  if (UUID.test(qs.store_id || '')) { params.push(qs.store_id); w.push(`g.store_id = $${params.length}`); }
  if (UUID.test(qs.game_id || '')) { params.push(qs.game_id); w.push(`p.game_id = $${params.length}`); }
  return w;
}
function inRange(params, from, to) {
  params.push(from); const a = params.length; params.push(to); const b = params.length;
  return `p.created_at >= ${dayStart(a)} AND p.created_at < ${dayEnd(b)}`;
}
const where = (parts) => (parts.length ? `WHERE ${parts.join(' AND ')}` : '');

async function kpis(qs, from, to) {
  const params = []; const w = scope(qs, params); const sc = [...w]; const scParams = [...params];
  w.push(inRange(params, from, to));
  const { rows: [k] } = await q(`SELECT count(*)::int AS plays, count(DISTINCT p.email_norm)::int AS players,
      count(*) FILTER (WHERE p.email_status = 'sent')::int AS sent, count(*) FILTER (WHERE p.email_status = 'failed')::int AS failed,
      count(*) FILTER (WHERE p.email_status = 'pending')::int AS pending, count(*) FILTER (WHERE p.locale = 'fr')::int AS fr
    ${BASE} ${where(w)}`, params);
  // a "new" player's first ever play (within these group/store/game filters) falls in the period
  const nParams = [...scParams]; const nRange = inRange(nParams, from, to).replaceAll('p.created_at', 'f.first_at');
  const { rows: [n] } = await q(`SELECT count(*)::int AS new_players FROM (
      SELECT p.email_norm, min(p.created_at) AS first_at ${BASE} ${where(sc)} GROUP BY p.email_norm) f WHERE ${nRange}`, nParams);
  return { ...k, new_players: n.new_players, returning_players: Math.max(0, k.players - n.new_players) };
}

// from=all → the first play date within the group/store/game filters
async function resolve(qs) {
  if (qs.from !== 'all') return qs;
  const params = []; const w = scope(qs, params);
  const { rows: [m] } = await q(`SELECT to_char(min(p.created_at AT TIME ZONE ${ET}), 'YYYY-MM-DD') AS d ${BASE} ${where(w)}`, params);
  return { ...qs, from: m.d || DateTime.now().setZone(ZONE).toISODate() };
}

export function registerReports(router, wrap, csvCell) {
  // ---------- overview
  router.get('/reports/overview', wrap(async (req, res) => {
    const qs = await resolve(req.query); const r = parseRange(qs);
    const weekly = r.days > 120;
    const bucket = weekly ? 'week' : 'day';
    const [cur, prev] = await Promise.all([kpis(qs, r.from, r.to), kpis(qs, r.prevFrom, r.prevTo)]);

    const P = () => { const params = []; const w = scope(qs, params); w.push(inRange(params, r.from, r.to)); return { params, w }; };

    const sp = []; const wp = scope(qs, sp); wp.push(inRange(sp, r.prevFrom, r.prevTo));
    const prevSeries = q(`SELECT to_char(date_trunc('${bucket}', p.created_at AT TIME ZONE ${ET}), 'YYYY-MM-DD') AS d, count(*)::int AS plays
      ${BASE} ${where(wp)} GROUP BY 1`, sp);

    const s1 = P();
    const series = q(`SELECT to_char(date_trunc('${bucket}', p.created_at AT TIME ZONE ${ET}), 'YYYY-MM-DD') AS d,
        count(*)::int AS plays, count(DISTINCT p.email_norm)::int AS players
      ${BASE} ${where(s1.w)} GROUP BY 1 ORDER BY 1`, s1.params);

    const nParams = []; const nScope = scope(qs, nParams); const nRange = inRange(nParams, r.from, r.to).replaceAll('p.created_at', 'f.first_at');
    const newSeries = q(`SELECT to_char(date_trunc('${bucket}', f.first_at AT TIME ZONE ${ET}), 'YYYY-MM-DD') AS d, count(*)::int AS n FROM (
        SELECT p.email_norm, min(p.created_at) AS first_at ${BASE} ${where(nScope)} GROUP BY p.email_norm) f WHERE ${nRange} GROUP BY 1`, nParams);

    const s2 = P();
    const rewards = q(`SELECT pr.reward_id, (array_agg(pr.title ORDER BY p.created_at DESC))[1] AS title, (array_agg(pr.code ORDER BY p.created_at DESC))[1] AS code,
        g.id AS game_id, g.name AS game, g.type, s.name AS store, count(*)::int AS won, count(DISTINCT p.email_norm)::int AS players,
        max(r.probability)::float AS probability, bool_or(r.active) AS active
      ${BASE} JOIN play_rewards pr ON pr.play_id = p.id LEFT JOIN rewards r ON r.id = pr.reward_id
      ${where(s2.w)} GROUP BY pr.reward_id, g.id, g.name, g.type, s.name ORDER BY won DESC`, s2.params);

    const gp = P();
    const gamePlays = q(`SELECT p.game_id, count(*)::int AS n ${BASE} ${where(gp.w)} GROUP BY 1`, gp.params);

    const by = (expr, extra = '') => { const x = P(); return q(`SELECT ${expr} AS key, ${extra} count(*)::int AS plays, count(DISTINCT p.email_norm)::int AS players
        ${BASE} ${where(x.w)} GROUP BY 1${extra ? ', 2' : ''} ORDER BY plays DESC`, x.params); };
    const byGroup = by(`coalesce(sg.name, 'Ungrouped')`);
    const byStore = by('s.name');
    const byGame = (() => { const x = P(); return q(`SELECT g.name AS key, s.name AS store, g.type, count(*)::int AS plays, count(DISTINCT p.email_norm)::int AS players
        ${BASE} ${where(x.w)} GROUP BY 1, 2, 3 ORDER BY plays DESC`, x.params); })();
    const byType = by('g.type');
    const byLocale = by('p.locale');

    const s3 = P();
    const heat = q(`SELECT extract(isodow FROM p.created_at AT TIME ZONE ${ET})::int AS dow, extract(hour FROM p.created_at AT TIME ZONE ${ET})::int AS h, count(*)::int AS n
      ${BASE} ${where(s3.w)} GROUP BY 1, 2`, s3.params);

    const s4 = P();
    const recent = q(`SELECT p.id, p.email, p.locale, p.created_at, p.email_status, g.name AS game, g.type, s.name AS store,
        (SELECT json_agg(json_build_object('title', pr.title, 'code', pr.code)) FROM play_rewards pr WHERE pr.play_id = p.id) AS rewards
      ${BASE} ${where(s4.w)} ORDER BY p.created_at DESC LIMIT 12`, s4.params);

    const [sr, nr, rw, bg, bs, bgm, bt, bl, ht, rc, gpl, ps] = await Promise.all([series, newSeries, rewards, byGroup, byStore, byGame, byType, byLocale, heat, recent, gamePlays, prevSeries]);
    const gpm = new Map(gpl.rows.map((x) => [x.game_id, x.n]));
    for (const x of rw.rows) x.game_plays = gpm.get(x.game_id) || 0;

    // fill empty buckets so the time axis is continuous
    const map = new Map(sr.rows.map((x) => [x.d, x])); const nmap = new Map(nr.rows.map((x) => [x.d, x.n]));
    const out = []; let d = DateTime.fromISO(r.from, { zone: ZONE }); if (weekly) d = d.startOf('week');
    const end = DateTime.fromISO(r.to, { zone: ZONE });
    while (d <= end) { const k = d.toISODate(); const v = map.get(k); const nw = nmap.get(k) || 0; out.push({ d: k, plays: v?.plays || 0, players: v?.players || 0, new_players: nw, returning: Math.max(0, (v?.players || 0) - nw) }); d = d.plus(weekly ? { weeks: 1 } : { days: 1 }); }
    // previous period, aligned by position (bucket i of the previous range sits under bucket i of this one)
    const pmap = new Map(ps.rows.map((x) => [x.d, x.plays]));
    let pd = DateTime.fromISO(r.prevFrom, { zone: ZONE }); if (weekly) pd = pd.startOf('week');
    for (const row of out) { const k = pd.toISODate(); row.prev_d = k; row.prev_plays = pmap.get(k) || 0; pd = pd.plus(weekly ? { weeks: 1 } : { days: 1 }); }
    const todayKey = DateTime.now().setZone(ZONE).toISODate(); const last = out[out.length - 1]; if (last && !weekly && last.d === todayKey) last.partial = true;

    res.json({ range: r, bucket, kpis: cur, prev, series: out, rewards: rw.rows, by: { group: bg.rows, store: bs.rows, game: bgm.rows, type: bt.rows, locale: bl.rows }, heatmap: ht.rows, recent: rc.rows });
  }));

  // ---------- players directory
  const SORTS = { last: 'last_at DESC', first: 'first_at DESC', plays: 'plays DESC, last_at DESC', email: 'email ASC' };
  function playersQuery(qs, { limit, offset }) {
    const r = parseRange(qs); const params = []; const w = scope(qs, params); w.push(inRange(params, r.from, r.to));
    const search = String(qs.search || '').trim().toLowerCase();
    if (search) { params.push(`%${search}%`); w.push(`(p.email_norm LIKE $${params.length} OR lower(p.email) LIKE $${params.length})`); }
    if (UUID.test(qs.reward_id || '')) { params.push(qs.reward_id); w.push(`EXISTS (SELECT 1 FROM play_rewards x WHERE x.play_id = p.id AND x.reward_id = $${params.length})`); }
    const sort = SORTS[qs.sort] || SORTS.last;
    const lim = limit ? `LIMIT ${limit} OFFSET ${offset || 0}` : '';
    return { sql: `SELECT p.email_norm, (array_agg(p.email ORDER BY p.created_at DESC))[1] AS email, count(DISTINCT p.id)::int AS plays,
        count(pr.id)::int AS rewards, min(p.created_at) AS first_at, max(p.created_at) AS last_at,
        array_agg(DISTINCT s.name) AS stores, array_agg(DISTINCT coalesce(sg.name, 'Ungrouped')) AS groups,
        (array_agg(p.locale ORDER BY p.created_at DESC))[1] AS locale,
        (array_agg(pr.title ORDER BY p.created_at DESC))[1] AS last_reward,
        count(DISTINCT p.id) FILTER (WHERE p.email_status = 'failed')::int AS failed,
        count(*) OVER ()::int AS total
      ${BASE} LEFT JOIN play_rewards pr ON pr.play_id = p.id ${where(w)} GROUP BY p.email_norm ORDER BY ${sort} ${lim}`, params };
  }
  router.get('/players', wrap(async (req, res) => {
    const page = Math.max(0, parseInt(req.query.page, 10) || 0);
    const { sql, params } = playersQuery(await resolve(req.query), { limit: 50, offset: page * 50 });
    const { rows } = await q(sql, params);
    res.json({ total: rows[0]?.total || 0, page, pageSize: 50, rows });
  }));
  router.get('/players.csv', wrap(async (req, res) => {
    const { sql, params } = playersQuery(await resolve(req.query), {});
    const { rows } = await q(sql, params);
    const head = 'email,plays,rewards,first_played,last_played,stores,groups,language,last_reward';
    const body = rows.map((x) => [x.email, x.plays, x.rewards, x.first_at.toISOString(), x.last_at.toISOString(), x.stores.join(' | '), x.groups.join(' | '), x.locale, x.last_reward?.en].map(csvCell).join(','));
    res.type('text/csv').set('Content-Disposition', 'attachment; filename="players.csv"').send([head, ...body].join('\n'));
  }));
  // one player's full history (all time, every store; test plays flagged)
  router.get('/players/:email', wrap(async (req, res) => {
    const norm = normalizeEmail(req.params.email)?.norm || String(req.params.email).toLowerCase();
    const { rows } = await q(`SELECT p.id, p.email, p.locale, p.created_at, p.email_status, p.email_error, p.email_attempts, p.is_test,
        g.name AS game, g.type, s.name AS store, sg.name AS store_group,
        (SELECT json_agg(json_build_object('title', pr.title, 'code', pr.code)) FROM play_rewards pr WHERE pr.play_id = p.id) AS rewards
      ${BASE} WHERE p.email_norm = $1 ORDER BY p.created_at DESC`, [norm]);
    res.json({ email_norm: norm, plays: rows });
  }));

  // ---------- email delivery
  router.get('/deliveries', wrap(async (req, res) => {
    const qs = await resolve(req.query); const r = parseRange(qs); const params = []; const w = scope(qs, params); w.push(inRange(params, r.from, r.to));
    if (['sent', 'failed', 'pending'].includes(qs.status)) { params.push(qs.status); w.push(`p.email_status = $${params.length}`); }
    const page = Math.max(0, parseInt(qs.page, 10) || 0);
    const [{ rows }, { rows: [c] }] = await Promise.all([
      q(`SELECT p.id, p.email, p.locale, p.created_at, p.email_status, p.email_error, p.email_attempts, p.last_email_at, g.name AS game, s.name AS store,
          (SELECT json_agg(json_build_object('title', pr.title, 'code', pr.code)) FROM play_rewards pr WHERE pr.play_id = p.id) AS rewards,
          count(*) OVER ()::int AS total
        ${BASE} ${where(w)} ORDER BY p.created_at DESC LIMIT 50 OFFSET ${page * 50}`, params),
      (() => { const p2 = []; const w2 = scope(qs, p2); w2.push(inRange(p2, r.from, r.to));
        return q(`SELECT count(*) FILTER (WHERE p.email_status = 'sent')::int AS sent, count(*) FILTER (WHERE p.email_status = 'failed')::int AS failed,
          count(*) FILTER (WHERE p.email_status = 'pending')::int AS pending ${BASE} ${where(w2)}`, p2); })(),
    ]);
    res.json({ counts: c, total: rows[0]?.total || 0, page, pageSize: 50, rows });
  }));

  // re-send a play's code email (same codes, same expiry as the original play week)
  router.post('/plays/:id/resend', wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) return res.sendStatus(404);
    const { rows: [p] } = await q(`SELECT p.*, g.id AS gid FROM plays p JOIN games g ON g.id = p.game_id WHERE p.id = $1`, [req.params.id]);
    if (!p) return res.sendStatus(404);
    const { rows: [game] } = await q(`SELECT g.*, sg.from_name AS group_from_name, sg.from_email AS group_from_email, sg.reply_to AS group_reply_to
      FROM games g JOIN stores s ON s.id = g.store_id LEFT JOIN store_groups sg ON sg.id = s.group_id WHERE g.id = $1`, [p.game_id]);
    const { rows: rewards } = await q('SELECT title, subtitle, code FROM play_rewards WHERE play_id = $1', [p.id]);
    const weekStart = DateTime.fromISO(String(p.week_key).slice(0, 10), { zone: ZONE }).startOf('day');
    const expiresAt = weekStart.plus({ weeks: 1 }).minus({ seconds: 1 }).toISO();
    const mail = buildEmail({ game, rewards, locale: p.locale, expiresAt });
    const r = await sendEmail({ game, to: p.email, mail });
    await q(`UPDATE plays SET email_status = $2, email_error = $3, email_attempts = email_attempts + 1, last_email_at = now() WHERE id = $1`, [p.id, r.ok ? 'sent' : 'failed', r.ok ? null : r.error]);
    res.json({ ok: r.ok, error: r.error || null });
  }));

  // ---------- filtered plays export (one row per reward won)
  router.get('/reports/plays.csv', wrap(async (req, res) => {
    const qs = await resolve(req.query); const r = parseRange(qs); const params = []; const w = scope(qs, params); w.push(inRange(params, r.from, r.to));
    if (UUID.test(qs.reward_id || '')) { params.push(qs.reward_id); w.push(`pr.reward_id = $${params.length}`); }
    const { rows } = await q(`SELECT p.email, p.locale, p.created_at, p.email_status, g.name AS game, g.type, s.name AS store, sg.name AS store_group, pr.title, pr.code
      ${BASE} JOIN play_rewards pr ON pr.play_id = p.id ${where(w)} ORDER BY p.created_at DESC`, params);
    const head = 'email,store_group,store,game,game_type,reward,code,language,email_status,played_at_et';
    const body = rows.map((x) => [x.email, x.store_group, x.store, x.game, x.type, x.title?.en, x.code, x.locale, x.email_status,
      DateTime.fromJSDate(x.created_at).setZone(ZONE).toFormat('yyyy-LL-dd HH:mm')].map(csvCell).join(','));
    res.type('text/csv').set('Content-Disposition', `attachment; filename="plays_${r.from}_${r.to}.csv"`).send([head, ...body].join('\n'));
  }));
}

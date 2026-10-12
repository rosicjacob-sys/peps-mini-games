import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useFilters, FilterBar } from '../filters.jsx';
import { LineChart, StackedColumns, Heatmap, BarList, StatTile, ChartCard, Legend, DataTable } from '../charts.jsx';
import { fmtInt, fmt1, pct, change, tr, fmtDateTime, DOW_LONG, hourLabel, fmtDay } from '../format.js';

const S1 = 'var(--s1)', S2 = 'var(--s2)';
const MIN_FOR_PATTERNS = 30;   // plays needed before "busiest time" style findings mean anything

// Plain-language findings from the same numbers the charts show.
function insights(o, allTime) {
  const out = []; const k = o.kpis, p = o.prev;
  const ch = change(k.plays, p.plays);
  if (!allTime && ch && ch.ratio !== null && ch.dir !== 'flat') out.push({ tone: ch.dir === 'up' ? 'good' : 'bad', text: `Plays are ${ch.dir} ${pct(Math.abs(ch.ratio))} vs the previous ${o.range.days} days (${fmtInt(k.plays)} vs ${fmtInt(p.plays)}).` });
  if (k.players) out.push({ tone: 'info', text: `${pct(k.returning_players / k.players)} of players were returning players; ${fmtInt(k.new_players)} played for the first time.` });
  if (k.plays >= MIN_FOR_PATTERNS) {
    const top = [...o.heatmap].sort((a, b) => b.n - a.n)[0];
    if (top) out.push({ tone: 'info', text: `Busiest time: ${DOW_LONG[top.dow - 1]}, ${hourLabel(top.h)}–${hourLabel((top.h + 1) % 24)} ET (${fmtInt(top.n)} plays).` });
    const dows = Array(7).fill(0); o.heatmap.forEach((c) => (dows[c.dow - 1] += c.n));
    const b = dows.indexOf(Math.max(...dows)); out.push({ tone: 'info', text: `${DOW_LONG[b]} bring the most plays (${pct(dows[b] / k.plays)} of the week).` });
  }
  const g = o.by.group[0]; if (g && o.by.group.length > 1) out.push({ tone: 'info', text: `${g.key} drives ${pct(g.plays / k.plays)} of plays.` });
  const odd = oddsChecks(o.rewards)[0];
  if (odd) out.push({ tone: 'warn', text: `${tr(odd.title)} (${odd.game} · ${odd.group}) is landing ${pct(odd.actual, 1)} vs ${pct(odd.set, 1)} set. Check the odds.` });
  if (k.failed) out.push({ tone: 'bad', text: `${fmtInt(k.failed)} reminder email${k.failed === 1 ? '' : 's'} failed to send. See Reminder emails.`, link: 'delivery' });
  const lostN = o.rewards.filter((r) => r.lost).reduce((a, r) => a + r.won, 0);
  if (lostN && k.plays) out.push({ tone: 'info', text: `${pct(lostN / k.plays)} of plays won nothing (${fmtInt(lostN)}).` });
  if (k.fr) out.push({ tone: 'info', text: `French: ${pct(k.fr / k.plays)} of plays.` });
  return out;
}
// rewards whose actual share is far from the set probability, with enough plays to mean something
function oddsChecks(rewards) {
  return rewards.filter((r) => r.game_plays >= 50 && r.probability != null && r.active).map((r) => ({ ...r, actual: r.won / r.game_plays, set: r.probability / 100 }))
    .filter((r) => { const se = Math.sqrt((r.set * (1 - r.set)) / r.game_plays); return Math.abs(r.actual - r.set) >= Math.max(0.03, 3 * se); })
    .sort((a, b) => Math.abs(b.actual - b.set) - Math.abs(a.actual - a.set));
}

export default function Overview({ scope, go }) {
  const f = useFilters();
  const params = useMemo(() => ({ ...f.params, ...(scope || {}) }), [f.params, scope]);
  const [o, setO] = useState(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  useEffect(() => { setLoading(true); api.overview(params).then((d) => { setO(d); setErr(''); }).catch((e) => setErr(e.message)).finally(() => setLoading(false)); }, [JSON.stringify(params)]);
  const exportBtn = <button className="ghost" onClick={() => api.download('/reports/plays.csv', params, `plays_${params.from}_${params.to}.csv`).catch((e) => setErr(e.message))}>Export plays CSV</button>;

  return (
    <>
      {!scope && <PageHead title="Overview" sub="How the mini games are performing across your stores." actions={exportBtn} />}
      {!scope && <SetupChecklist />}
      <FilterBar lockGame={!!scope} extra={scope ? exportBtn : null} />
      {err && <div className="alert bad">{err}</div>}
      {!o ? (!err && <div className="loading">Loading…</div>) : (
        <div className={`stack ${loading ? 'refetch' : ''}`}>
          <Kpis o={o} allTime={f.allTime} />
          <div className="grid g-2-1">
            <ChartCard title="Plays over time" sub={f.allTime ? `${o.bucket === 'week' ? 'Weekly' : 'Daily'} plays since the first play` : `${o.bucket === 'week' ? 'Weekly' : 'Daily'} plays, with the previous ${o.range.days} days for comparison`}
              table={{ columns: [{ key: 'd', label: o.bucket === 'week' ? 'Week of' : 'Day', render: (r) => fmtDay(r.d, { weekday: 'short', month: 'short', day: 'numeric' }) }, { key: 'plays', label: 'Plays', num: true }, { key: 'players', label: 'Unique players', num: true }, ...(f.allTime ? [] : [{ key: 'prev_plays', label: 'Previous period', num: true }])], rows: o.series }}>
              {!f.allTime && <Legend items={[{ key: 'p', label: 'This period', color: S1 }, { key: 'q', label: 'Previous period', color: 'var(--prev)' }]} />}
              <LineChart data={o.series} bucket={o.bucket} series={[{ key: 'plays', label: 'Plays', color: S1 }, ...(f.allTime ? [] : [{ key: 'prev_plays', label: 'Previous', color: 'var(--prev)', dim: true, dateKey: 'prev_d' }])]} />
            </ChartCard>
            <section className="card">
              <header className="card-head"><div><h2>Insights</h2><p className="muted small">What stands out in this range</p></div></header>
              <ul className="insights">
                {insights(o, f.allTime).map((x, i) => (
                  <li key={i} className={`tone-${x.tone}`}><span className="ic" aria-hidden="true">{{ good: '▲', bad: '!', warn: '!', info: '•' }[x.tone]}</span>
                    <span>{x.text}{x.link && go && <> <button className="link" onClick={() => go(x.link)}>Open</button></>}</span></li>
                ))}
                {!o.kpis.plays && <li className="tone-info"><span className="ic">•</span><span>No plays in this range yet.</span></li>}
                {o.kpis.plays > 0 && o.kpis.plays < MIN_FOR_PATTERNS && <li className="tone-info"><span className="ic">•</span><span>Time-of-day and weekday patterns appear once there are {MIN_FOR_PATTERNS} plays in the range.</span></li>}
              </ul>
            </section>
          </div>
          <div className="grid g-2">
            <ChartCard title="New vs returning players" sub="Unique players per period, split by whether it was their first play"
              table={{ columns: [{ key: 'd', label: 'Period', render: (r) => fmtDay(r.d) }, { key: 'new_players', label: 'New', num: true }, { key: 'returning', label: 'Returning', num: true }], rows: o.series }}>
              <Legend kind="rect" items={[{ key: 'n', label: 'New', color: S1 }, { key: 'r', label: 'Returning', color: S2 }]} />
              <StackedColumns data={o.series} bucket={o.bucket} series={[{ key: 'new_players', label: 'New', color: S1 }, { key: 'returning', label: 'Returning', color: S2 }]} />
            </ChartCard>
            <ChartCard title="When people play" sub="Plays by weekday and hour, Eastern Time"
              table={{ columns: [{ key: 'dow', label: 'Day', render: (r) => DOW_LONG[r.dow - 1] }, { key: 'h', label: 'Hour', render: (r) => hourLabel(r.h) }, { key: 'n', label: 'Plays', num: true }], rows: [...o.heatmap].sort((a, b) => b.n - a.n) }}>
              <Heatmap cells={o.heatmap} />
            </ChartCard>
          </div>
          <Rewards o={o} go={go} />
          <div className="grid g-3">
            {!scope && <ChartCard title="By store group" table={tableOf(o.by.group, 'Group')}><BarList rows={rows(o.by.group, o.kpis.plays)} /></ChartCard>}
            {!scope && <ChartCard title="By store" table={tableOf(o.by.store, 'Store')}><BarList rows={rows(o.by.store, o.kpis.plays)} /></ChartCard>}
            {!scope && <ChartCard title="By game" sub="Across every store that shows it" table={{ columns: [{ key: 'key', label: 'Game' }, { key: 'group', label: 'Group' }, { key: 'plays', label: 'Plays', num: true }, { key: 'players', label: 'Players', num: true }], rows: o.by.game }}>
              <BarList rows={o.by.game.map((r) => ({ key: r.game_id, label: r.key, sub: r.group, value: r.plays, note: o.kpis.plays ? pct(r.plays / o.kpis.plays) : '' }))} /></ChartCard>}
          </div>
          <div className="grid g-1-2">
            <section className="card">
              <header className="card-head"><div><h2>Language</h2><p className="muted small">Language players chose</p></div></header>
              <LanguageSplit rows={o.by.locale} total={o.kpis.plays} />
            </section>
            <section className="card">
              <header className="card-head"><div><h2>Latest plays</h2></div>{go && <button className="ghost small" onClick={() => go('players')}>All players</button>}</header>
              <DataTable columns={[
                { key: 'created_at', label: 'When (ET)', render: (r) => <span className="nowrap">{fmtDateTime(r.created_at)}</span> },
                { key: 'email', label: 'Email' },
                { key: 'reward', label: 'Reward', render: (r) => (r.rewards || []).map((x) => tr(x.title)).join(', ') || <span className="muted">No reward</span> },
                { key: 'game', label: 'Game', render: (r) => <span className="muted">{r.game} · {r.store}</span> },
              ]} rows={o.recent} />
            </section>
          </div>
        </div>
      )}
    </>
  );
}

export const PageHead = ({ title, sub, actions }) => (
  <div className="page-head"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
);
const rows = (list, total, sub) => list.map((r) => ({ key: r.key, label: r.key, sub: sub ? sub(r) : `${fmtInt(r.players)} players`, value: r.plays, note: total ? pct(r.plays / total) : '' }));
const tableOf = (list, label) => ({ columns: [{ key: 'key', label }, { key: 'plays', label: 'Plays', num: true }, { key: 'players', label: 'Players', num: true }], rows: list });

function Kpis({ o, allTime }) {
  const k = o.kpis, p = o.prev, s = o.series;
  const sent = (a) => a.sent + a.failed;
  const rate = (a) => (sent(a) ? a.sent / sent(a) : null);
  const per = (a) => (a.players ? a.plays / a.players : 0);
  const ret = (a) => (a.players ? a.returning_players / a.players : 0);
  // "vs previous period" means nothing for All time (there is no period before the first play)
  const d = (cur, prev) => (allTime ? undefined : change(cur, prev));
  return (
    <div className="kpis">
      <StatTile label="Plays" value={fmtInt(k.plays)} delta={d(k.plays, p.plays)} spark={s.map((x) => x.plays)} />
      <StatTile label="Unique players" value={fmtInt(k.players)} delta={d(k.players, p.players)} spark={s.map((x) => x.players)} hint="Distinct emails that played in the range" />
      <StatTile label="New players" value={fmtInt(k.new_players)} delta={d(k.new_players, p.new_players)} spark={s.map((x) => x.new_players)} hint="Their first play ever (within the filters) is in this range" />
      <StatTile label="Returning players" value={pct(ret(k))} delta={d(ret(k), ret(p))} spark={s.map((x) => (x.players ? x.returning / x.players : 0))} hint="Share of players who had played before" />
      <StatTile label="Plays per player" value={fmt1(per(k))} delta={d(per(k), per(p))} hint="Plays ÷ unique players" />
      <StatTile label="Reminders delivered" value={rate(k) == null ? '–' : pct(rate(k), 1)} delta={rate(k) == null || rate(p) == null ? undefined : d(rate(k), rate(p))} hint="Weekly reminder emails sent ÷ (sent + failed)"
        foot={sent(k) ? `${fmtInt(k.sent)} sent · ${fmtInt(k.failed)} failed${k.pending ? ` · ${fmtInt(k.pending)} pending` : ''}` : 'No reminder emails in this range'} />
    </div>
  );
}

function Rewards({ o, go }) {
  const byGame = new Map();
  for (const r of o.rewards) { const key = r.game_id; if (!byGame.has(key)) byGame.set(key, { game: r.game, group: r.group, type: r.type, plays: r.game_plays, rows: [] }); byGame.get(key).rows.push(r); }
  const flags = new Set(oddsChecks(o.rewards).map((r) => r.reward_id));
  const tableRows = o.rewards.map((r) => ({ ...r, actual: r.game_plays ? r.won / r.game_plays : 0 }));
  return (
    <ChartCard title="Rewards won" sub="Share of each game's plays that landed on the reward, across every store that shows the game. The tick marks the probability you set."
      table={{ columns: [
        { key: 'title', label: 'Reward', render: (r) => tr(r.title) }, { key: 'code', label: 'Code', render: (r) => <code>{r.code}</code> },
        { key: 'game', label: 'Game', render: (r) => `${r.game} · ${r.group}` }, { key: 'won', label: 'Won', num: true },
        { key: 'actual', label: 'Actual', num: true, render: (r) => pct(r.actual, 1) }, { key: 'probability', label: 'Set', num: true, render: (r) => (r.probability == null ? '-' : `${r.probability}%`) },
      ], rows: tableRows }}>
      {!o.rewards.length && <p className="muted empty">No rewards won in this range.</p>}
      <div className="reward-games">
        {[...byGame.values()].map((g) => (
          <div key={g.game + g.group} className="reward-game">
            <div className="rg-head"><b>{g.game}</b><span className="muted"> · {g.group} · {fmtInt(g.plays)} plays</span></div>
            <BarList format={(v) => pct(v, 1)} onSelect={go ? (r) => !String(r.key).startsWith('lost:') && go('players', { reward_id: r.key }) : undefined}
              rows={g.rows.map((r) => ({ key: r.reward_id, label: tr(r.title), sub: r.lost ? `${fmtInt(r.won)} plays won nothing` : `${fmtInt(r.won)} won · ${r.code}`, color: r.lost ? 'var(--prev)' : undefined, value: g.plays ? r.won / g.plays : 0, target: r.probability != null ? r.probability / 100 : null,
                note: flags.has(r.reward_id) ? '⚠ check odds' : r.probability != null ? `set ${r.probability}%` : 'removed' }))} />
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function LanguageSplit({ rows, total }) {
  const get = (k) => rows.find((r) => r.key === k)?.plays || 0;
  const en = get('en'), fr = get('fr'); const t = total || 1;
  if (!total) return <p className="muted empty">No plays in this range.</p>;
  return (
    <div className="split">
      <div className="split-bar" role="img" aria-label={`English ${pct(en / t)}, French ${pct(fr / t)}`}>
        <span style={{ width: `${(en / t) * 100}%`, background: 'var(--s1)' }} /><span style={{ width: `${(fr / t) * 100}%`, background: 'var(--s2)' }} />
      </div>
      <div className="split-legend">
        <div><i className="key rect" style={{ background: 'var(--s1)' }} /><b>{pct(en / t)}</b> English <span className="muted">· {fmtInt(en)}</span></div>
        <div><i className="key rect" style={{ background: 'var(--s2)' }} /><b>{pct(fr / t)}</b> French <span className="muted">· {fmtInt(fr)}</span></div>
      </div>
    </div>
  );
}

// What is still missing before a visitor can play. Shown until every step is done.
function SetupChecklist() {
  const f = useFilters(); const { groups, stores, games, loaded } = f.lists;
  const [library, setLibrary] = useState(null);
  useEffect(() => { api.library().then(setLibrary).catch(() => setLibrary([])); }, []);
  if (!loaded || library === null) return null;
  const liveStores = stores.filter((s) => !s.archived_at); const liveGames = games.filter((g) => !g.archived_at);
  const steps = [
    { ok: groups.length > 0, label: 'Create a store group', href: '#/groups', why: 'Games and the popup are set up per group.' },
    { ok: liveStores.some((s) => s.allowed_origins?.length), label: 'Add a store with its website', href: '#/stores', why: 'The install line recognises the store by its website.' },
    { ok: library.length > 0, label: 'Add a reward to the library', href: '#/rewards', why: 'A discount code with a title in English and French.' },
    { ok: liveGames.some((g) => g.status === 'active' && g.reward_count > 0), label: 'Create a game and give it rewards', href: '#/games', why: 'A live game with at least one active reward is shown on the stores.' },
    { ok: groups.some((g) => g.from_email) || liveGames.some((g) => g.from_email), label: 'Set the reminder email sender', href: '#/groups', why: 'On the store group (or per game). The domain must be verified in Resend.' },
  ];
  if (steps.every((s) => s.ok)) return null;
  return (
    <section className="card checklist">
      <header className="card-head"><div><h2>Set up in {steps.length} steps</h2><p className="muted small">{steps.filter((s) => s.ok).length} of {steps.length} done. Then paste the install line on each store (Stores → Install &amp; check).</p></div></header>
      <ol className="check-steps">
        {steps.map((s) => <li key={s.label} className={s.ok ? 'ok' : ''}><span aria-hidden="true">{s.ok ? '✓' : ''}</span><div><a href={s.href}><b>{s.label}</b></a><p className="muted small">{s.why}</p></div></li>)}
      </ol>
    </section>
  );
}

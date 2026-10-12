import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useFilters, FilterBar } from '../filters.jsx';
import { PageHead } from './Overview.jsx';
import { fmtInt, fmtDateShort, fmtDateTime, tr, typeLabel } from '../format.js';

const SORTS = [['last', 'Last played'], ['plays', 'Most plays'], ['first', 'Newest players'], ['email', 'Email A–Z']];

export default function Players({ initial = {}, clearInitial }) {
  const f = useFilters();
  const [search, setSearch] = useState(''); const [q, setQ] = useState('');
  const [sort, setSort] = useState('last'); const [page, setPage] = useState(0);
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(null); const [err, setErr] = useState('');
  const [rewardId, setRewardId] = useState(initial.reward_id || '');
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  const params = useMemo(() => ({ ...f.params, search: q, sort, page, reward_id: rewardId }), [f.params, q, sort, page, rewardId]);
  useEffect(() => { setLoading(true); api.players(params).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)).finally(() => setLoading(false)); }, [JSON.stringify(params)]);
  useEffect(() => setPage(0), [JSON.stringify(f.params)]);
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <>
      <PageHead title="Players" sub="Everyone who played, with what they won. Test emails are excluded."
        actions={<button className="ghost" onClick={() => api.download('/players.csv', params, 'players.csv').catch((e) => setErr(e.message))}>Export players CSV</button>} />
      <FilterBar />
      {err && <div className="alert bad">{err}</div>}
      <div className="toolbar">
        <div className="search"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" /></svg>
          <input placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search players" /></div>
        <select className="fb-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {rewardId && <span className="chip-filter">Filtered to one reward <button className="link" onClick={() => { setRewardId(''); clearInitial?.(); }}>✕</button></span>}
        <span className="muted push">{data ? `${fmtInt(data.total)} player${data.total === 1 ? '' : 's'}` : ''}</span>
      </div>
      <section className={`card flush ${loading ? 'refetch' : ''}`}>
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Email</th><th className="num">Plays</th><th>Last reward</th><th>Stores</th><th>Lang</th><th>First played</th><th>Last played</th></tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.email_norm} className="click" onClick={() => setOpen(r.email)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(r.email)}>
                <td><b>{r.email}</b></td>
                <td className="num">{fmtInt(r.plays)}</td>
                <td>{r.last_reward ? tr(r.last_reward) : <span className="muted">No reward</span>}</td>
                <td className="muted">{r.stores.join(', ')}</td>
                <td><span className="pill">{r.locale.toUpperCase()}</span></td>
                <td className="muted nowrap">{fmtDateShort(r.first_at)}</td>
                <td className="nowrap">{fmtDateShort(r.last_at)}</td>
              </tr>
            ))}
            {data && !data.rows.length && <tr><td colSpan="7" className="muted empty">No players match.</td></tr>}
            {!data && !err && <tr><td colSpan="7" className="muted empty">Loading…</td></tr>}
          </tbody>
        </table></div>
        {pages > 1 && (
          <div className="pager"><button className="ghost small" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
            <span className="muted">Page {page + 1} of {pages}</span>
            <button className="ghost small" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next →</button></div>
        )}
      </section>
      {open && <PlayerDrawer email={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function PlayerDrawer({ email, onClose }) {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.player(email).then(setD).catch((e) => setErr(e.message)); const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [email]);
  const real = d?.plays.filter((p) => !p.is_test) || [];
  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label={`Player ${email}`}>
        <header className="drawer-head"><div><p className="muted small">Player</p><h2>{email}</h2></div><button className="ghost icon" onClick={onClose} aria-label="Close">✕</button></header>
        {err && <p className="error">{err}</p>}
        {!d && !err ? <div className="loading">Loading…</div> : d && (
          <>
            <div className="mini-kpis">
              <div><b>{fmtInt(real.length)}</b><span>plays</span></div>
              <div><b>{real.length ? fmtDateShort(real[real.length - 1].created_at) : '-'}</b><span>first played</span></div>
              <div><b>{new Set(real.map((p) => p.store)).size}</b><span>stores</span></div>
            </div>
            <ol className="timeline">
              {d.plays.map((p) => (
                <li key={p.id}>
                  <div className="tl-when">{fmtDateTime(p.created_at)}</div>
                  <div className="tl-body">
                    <div><b>{p.rewards ? p.rewards.map((x) => tr(x.title)).join(', ') : 'No reward (lost)'}</b> {(p.rewards || []).map((x) => <code key={x.code}>{x.code}</code>)}</div>
                    <div className="muted small">{p.game} ({typeLabel(p.type)}) · {p.store}{p.store_group ? ` · ${p.store_group}` : ''} · {p.locale.toUpperCase()}</div>
                    {p.is_test && <div className="tl-status"><span className="pill">test</span></div>}
                  </div>
                </li>
              ))}
            </ol>
            <h3 className="drawer-sub">Reminder emails</h3>
            {d.reminders?.length ? (
              <ul className="rem-list">
                {d.reminders.map((r) => (
                  <li key={r.id}><span className={`pill ${r.status}`}>{{ sent: '✓ sent', failed: '✕ failed', pending: '… pending', skipped: '– skipped' }[r.status]}</span>
                    <span>{r.store} · week of {new Date(`${r.week_key}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}{r.sent_at ? ` · sent ${fmtDateTime(r.sent_at)}` : ''}</span>
                    {r.error && <span className="muted small">{r.error}</span>}</li>
                ))}
              </ul>
            ) : <p className="muted small">None yet. Players get one after the Monday reset following a week they played.</p>}
            {d.reminders?.some((r) => r.unsubscribed) && <p className="muted small">Unsubscribed from: {[...new Set(d.reminders.filter((r) => r.unsubscribed).map((r) => r.store))].join(', ')}</p>}
          </>
        )}
      </aside>
    </div>
  );
}

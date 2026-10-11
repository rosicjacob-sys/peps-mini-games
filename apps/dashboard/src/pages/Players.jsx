import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useFilters, FilterBar } from '../filters.jsx';
import { PageHead } from './Overview.jsx';
import { fmtInt, fmtDateShort, fmtDateTime, tr, TYPE_LABEL } from '../format.js';

const SORTS = [['last', 'Last played'], ['plays', 'Most plays'], ['first', 'Newest players'], ['email', 'Email A–Z']];

export default function Players({ initial = {}, clearInitial }) {
  const f = useFilters();
  const [search, setSearch] = useState(''); const [q, setQ] = useState('');
  const [sort, setSort] = useState('last'); const [page, setPage] = useState(0);
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(null);
  const [rewardId, setRewardId] = useState(initial.reward_id || '');
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  const params = useMemo(() => ({ ...f.params, search: q, sort, page, reward_id: rewardId }), [f.params, q, sort, page, rewardId]);
  useEffect(() => { setLoading(true); api.players(params).then(setData).finally(() => setLoading(false)); }, [JSON.stringify(params)]);
  useEffect(() => setPage(0), [JSON.stringify(f.params)]);
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <>
      <PageHead title="Players" sub="Everyone who played, with what they won. Test emails are excluded."
        actions={<button className="ghost" onClick={() => api.download('/players.csv', params, 'players.csv')}>Export players CSV</button>} />
      <FilterBar />
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
                <td><b>{r.email}</b>{r.failed > 0 && <span className="pill failed" title="A code email to this player failed">✕ email</span>}</td>
                <td className="num">{fmtInt(r.plays)}</td>
                <td>{tr(r.last_reward)}</td>
                <td className="muted">{r.stores.join(', ')}</td>
                <td><span className="pill">{r.locale.toUpperCase()}</span></td>
                <td className="muted nowrap">{fmtDateShort(r.first_at)}</td>
                <td className="nowrap">{fmtDateShort(r.last_at)}</td>
              </tr>
            ))}
            {data && !data.rows.length && <tr><td colSpan="7" className="muted empty">No players match.</td></tr>}
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
  const [d, setD] = useState(null); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = () => api.player(email).then(setD);
  useEffect(() => { load(); const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [email]);
  const resend = async (id) => { setBusy(id); setMsg(''); try { const r = await api.resend(id); setMsg(r.ok ? 'Email sent.' : `Still failing: ${r.error}`); await load(); } finally { setBusy(''); } };
  const real = d?.plays.filter((p) => !p.is_test) || [];
  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label={`Player ${email}`}>
        <header className="drawer-head"><div><p className="muted small">Player</p><h2>{email}</h2></div><button className="ghost icon" onClick={onClose} aria-label="Close">✕</button></header>
        {!d ? <div className="loading">Loading…</div> : (
          <>
            <div className="mini-kpis">
              <div><b>{fmtInt(real.length)}</b><span>plays</span></div>
              <div><b>{real.length ? fmtDateShort(real[real.length - 1].created_at) : '—'}</b><span>first played</span></div>
              <div><b>{new Set(real.map((p) => p.store)).size}</b><span>stores</span></div>
            </div>
            {msg && <div className="alert info">{msg}</div>}
            <ol className="timeline">
              {d.plays.map((p) => (
                <li key={p.id}>
                  <div className="tl-when">{fmtDateTime(p.created_at)}</div>
                  <div className="tl-body">
                    <div><b>{(p.rewards || []).map((x) => tr(x.title)).join(', ')}</b> {(p.rewards || []).map((x) => <code key={x.code}>{x.code}</code>)}</div>
                    <div className="muted small">{TYPE_LABEL[p.type]} · {p.store}{p.store_group ? ` · ${p.store_group}` : ''} · {p.locale.toUpperCase()}</div>
                    <div className="tl-status">
                      <span className={`pill ${p.email_status}`}>{{ sent: '✓ email sent', failed: '✕ email failed', pending: '… pending' }[p.email_status]}</span>
                      {p.is_test && <span className="pill">test</span>}
                      {p.email_status !== 'sent' && <button className="ghost small" disabled={busy === p.id} onClick={() => resend(p.id)}>{busy === p.id ? 'Sending…' : 'Resend code'}</button>}
                    </div>
                    {p.email_error && <div className="muted small">{p.email_error}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </aside>
    </div>
  );
}

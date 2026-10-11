import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useFilters, FilterBar } from '../filters.jsx';
import { PageHead } from './Overview.jsx';
import { Meter } from '../charts.jsx';
import { fmtInt, fmtDateTime, tr } from '../format.js';

const TABS = [['failed', 'Failed'], ['pending', 'Pending'], ['sent', 'Sent'], ['', 'All']];

export default function Delivery() {
  const f = useFilters();
  const [status, setStatus] = useState('failed'); const [page, setPage] = useState(0);
  const [d, setD] = useState(null); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({}); const [note, setNote] = useState('');
  const params = useMemo(() => ({ ...f.params, status, page }), [f.params, status, page]);
  const load = () => { setLoading(true); return api.deliveries(params).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [JSON.stringify(params)]);
  useEffect(() => setPage(0), [JSON.stringify(f.params), status]);
  const resend = async (ids) => {
    setNote(''); const res = { ok: 0, fail: 0, last: '' };
    for (const id of ids) {
      setBusy((b) => ({ ...b, [id]: true }));
      try { const r = await api.resend(id); r.ok ? res.ok++ : (res.fail++, (res.last = r.error)); } catch (e) { res.fail++; res.last = e.message; }
      setBusy((b) => ({ ...b, [id]: false }));
    }
    setNote(`${res.ok} sent${res.fail ? `, ${res.fail} still failing (${res.last})` : ''}.`); load();
  };
  const c = d?.counts || { sent: 0, failed: 0, pending: 0 };
  const pages = d ? Math.ceil(d.total / d.pageSize) : 0;
  const failedOnPage = d?.rows.filter((r) => r.email_status !== 'sent').map((r) => r.id) || [];

  return (
    <>
      <PageHead title="Email delivery" sub="Every code email sent through Resend, with the reason when one fails." />
      <FilterBar />
      <div className="grid g-4">
        <div className="tile"><div className="tile-label">Sent</div><div className="tile-value">{fmtInt(c.sent)}</div></div>
        <div className="tile"><div className="tile-label">Failed</div><div className="tile-value">{fmtInt(c.failed)}</div>{c.failed > 0 && <span className="status critical"><span aria-hidden="true">✕</span> needs a resend</span>}</div>
        <div className="tile"><div className="tile-label">Pending</div><div className="tile-value">{fmtInt(c.pending)}</div></div>
        <div className="tile"><div className="tile-label">Delivery rate</div><Meter value={c.sent + c.failed ? c.sent / (c.sent + c.failed) : 1} /></div>
      </div>
      <div className="toolbar">
        <div className="segmented" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}{k && <span className="count">{fmtInt(c[k])}</span>}</button>)}
        </div>
        {failedOnPage.length > 0 && <button className="primary push" onClick={() => resend(failedOnPage)}>Resend {failedOnPage.length} on this page</button>}
      </div>
      {note && <div className="alert info">{note}</div>}
      <section className={`card flush ${loading ? 'refetch' : ''}`}>
        <div className="table-wrap"><table className="data">
          <thead><tr><th>When (ET)</th><th>Email</th><th>Reward</th><th>Game · store</th><th>Status</th><th>Reason</th><th className="num">Tries</th><th /></tr></thead>
          <tbody>
            {d?.rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{fmtDateTime(r.created_at)}</td>
                <td><b>{r.email}</b></td>
                <td>{(r.rewards || []).map((x) => tr(x.title)).join(', ')} {(r.rewards || []).map((x) => <code key={x.code}>{x.code}</code>)}</td>
                <td className="muted">{r.game} · {r.store}</td>
                <td><span className={`pill ${r.email_status}`}>{{ sent: '✓ sent', failed: '✕ failed', pending: '… pending' }[r.email_status]}</span></td>
                <td className="reason">{r.email_error || <span className="muted">-</span>}</td>
                <td className="num">{r.email_attempts}</td>
                <td>{r.email_status !== 'sent' && <button className="ghost small" disabled={busy[r.id]} onClick={() => resend([r.id])}>{busy[r.id] ? 'Sending…' : 'Resend'}</button>}</td>
              </tr>
            ))}
            {d && !d.rows.length && <tr><td colSpan="8" className="muted empty">{status === 'failed' ? 'No failed emails in this range. 🎉' : 'Nothing here.'}</td></tr>}
          </tbody>
        </table></div>
        {pages > 1 && <div className="pager"><button className="ghost small" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button><span className="muted">Page {page + 1} of {pages}</span><button className="ghost small" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next →</button></div>}
      </section>
    </>
  );
}

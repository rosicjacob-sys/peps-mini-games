import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useFilters, FilterBar } from '../filters.jsx';
import { PageHead } from './Overview.jsx';
import { Meter } from '../charts.jsx';
import { fmtInt, fmtDateTime } from '../format.js';

const TABS = [['', 'All'], ['sent', 'Sent'], ['failed', 'Failed'], ['pending', 'Pending'], ['skipped', 'Skipped']];
const PILL = { sent: '✓ sent', failed: '✕ failed', pending: '… pending', skipped: '– skipped' };
const weekLabel = (k) => new Date(`${k}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

// Weekly "play again" emails: after the Monday reset, everyone who played a store's games the week before gets one.
export default function Reminders() {
  const f = useFilters();
  const [status, setStatus] = useState(''); const [page, setPage] = useState(0);
  const [d, setD] = useState(null); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({}); const [note, setNote] = useState(''); const [running, setRunning] = useState(false); const [err, setErr] = useState('');
  const params = useMemo(() => ({ ...f.params, status, page }), [f.params, status, page]);
  const load = () => { setLoading(true); return api.reminders(params).then((x) => { setD(x); setErr(''); }).catch((e) => setErr(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [JSON.stringify(params)]);
  useEffect(() => setPage(0), [JSON.stringify(f.params), status]);
  // while a run is sending in the background, refresh every few seconds
  useEffect(() => { if (!running) return undefined; const id = setInterval(load, 4000); const stop = setTimeout(() => setRunning(false), 60000); return () => { clearInterval(id); clearTimeout(stop); }; }, [running]);

  async function runNow() {
    setNote('');
    try {
      const r = await api.runReminders();
      if (r.running) setNote('Reminders are already being sent. This page refreshes as they go out.');
      else setNote(r.due ? `${fmtInt(r.queued)} new reminder${r.queued === 1 ? '' : 's'} queued; sending ${fmtInt(r.due)} now (about one every second).` : 'Nothing to send: everyone due this week has their reminder.');
      setRunning(true); load();
    } catch (e) { setNote(e.message); }
  }
  async function resend(id) {
    setBusy((b) => ({ ...b, [id]: true }));
    try { const r = await api.resendReminder(id); setNote(r.ok ? 'Sent.' : `Not sent: ${r.error}`); } catch (e) { setNote(e.message); }
    setBusy((b) => ({ ...b, [id]: false })); load();
  }
  const c = d?.counts || { sent: 0, failed: 0, pending: 0, skipped: 0, unsubscribed: 0 };
  const pages = d ? Math.ceil(d.total / d.pageSize) : 0;

  return (
    <>
      <PageHead title="Reminder emails" sub="Every Monday after the 12:00 AM ET reset, everyone who played a store's games the week before gets one email inviting them to play again. Codes are shown on screen only; no code emails are sent."
        actions={<button className="primary" onClick={runNow}>Send due reminders now</button>} />
      <FilterBar />
      {err && <div className="alert bad">{err}</div>}
      <div className="grid g-4">
        <div className="tile"><div className="tile-label">Sent</div><div className="tile-value">{fmtInt(c.sent)}</div></div>
        <div className="tile"><div className="tile-label">Failed</div><div className="tile-value">{fmtInt(c.failed)}</div>{c.failed > 0 && <span className="status critical"><span aria-hidden="true">✕</span> see the reason below</span>}</div>
        <div className="tile"><div className="tile-label">Unsubscribed</div><div className="tile-value">{fmtInt(c.unsubscribed)}</div><span className="muted small">in this date range</span></div>
        <div className="tile"><div className="tile-label">Delivery rate</div>{c.sent + c.failed ? <Meter value={c.sent / (c.sent + c.failed)} /> : <div className="tile-value muted">–</div>}{!(c.sent + c.failed) && <span className="muted small">no emails sent in this range</span>}</div>
      </div>
      <div className="alert info small">Who gets one: players from the previous week, one email per store. Skipped: test emails, anyone who unsubscribed (every email has a link), and anyone who already played again that week. Failed sends are retried automatically up to 3 times. Switch reminders off per game in its <b>Texts &amp; Email</b> tab.</div>
      <div className="toolbar">
        <div className="segmented" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}{k && <span className="count">{fmtInt(c[k])}</span>}</button>)}
        </div>
      </div>
      {note && <div className="alert info">{note}</div>}
      <section className={`card flush ${loading ? 'refetch' : ''}`}>
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Queued (ET)</th><th>Email</th><th>Store · last game</th><th>For week of</th><th>Language</th><th>Status</th><th>Reason</th><th className="num">Tries</th><th /></tr></thead>
          <tbody>
            {d?.rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{fmtDateTime(r.created_at)}</td>
                <td><b>{r.email}</b></td>
                <td className="muted">{r.store}{r.game ? ` · ${r.game}` : ''}</td>
                <td className="nowrap">{weekLabel(r.week_key)}</td>
                <td>{r.locale.toUpperCase()}</td>
                <td><span className={`pill ${r.status}`}>{PILL[r.status]}</span></td>
                <td className="reason">{r.error || <span className="muted">-</span>}</td>
                <td className="num">{r.attempts}</td>
                <td>{['failed', 'pending'].includes(r.status) && <button className="ghost small" disabled={busy[r.id]} onClick={() => resend(r.id)}>{busy[r.id] ? 'Sending…' : 'Send'}</button>}</td>
              </tr>
            ))}
            {!d && !err && <tr><td colSpan="9" className="muted empty">Loading…</td></tr>}
            {d && !d.rows.length && <tr><td colSpan="9" className="muted empty">{status === 'failed' ? 'No failed reminders in this range. 🎉' : 'No reminders in this range yet. They go out after each Monday reset.'}</td></tr>}
          </tbody>
        </table></div>
        {pages > 1 && <div className="pager"><button className="ghost small" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button><span className="muted">Page {page + 1} of {pages}</span><button className="ghost small" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next →</button></div>}
      </section>
    </>
  );
}

// Hand-rolled SVG charts. Spec: thin marks (2px lines, ≤24px columns, 4px rounded data-ends),
// hairline solid grid, 2px surface gaps/rings, crosshair tooltip on lines, per-mark tooltip on
// columns and cells, a legend for ≥2 series, and a table view on every chart card.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { fmtInt, compact, fmtDay, DOW, hourLabel, pct } from './format.js';

function useWidth() {
  const ref = useRef(null); const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  return [ref, w];
}
function niceMax(v) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v)); const m = v / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 4 ? 4 : m <= 5 ? 5 : 10;
  const max = n * p; return max < 4 ? 4 : max;
}
const xTickIdx = (n, want = 6) => { if (n <= want) return [...Array(n).keys()]; const step = (n - 1) / (want - 1); return [...Array(want)].map((_, i) => Math.round(i * step)); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function Tooltip({ x, y, w, children }) {
  const left = x > w - 180 ? x - 12 : x + 12;
  return <div className="tip" style={{ left, top: y, transform: x > w - 180 ? 'translate(-100%, -50%)' : 'translate(0, -50%)' }} role="status">{children}</div>;
}
const TipRow = ({ color, value, label, kind = 'line' }) => (
  <div className="tip-row"><span className={`key ${kind}`} style={{ background: color }} /><b>{value}</b><span>{label}</span></div>
);

export function Legend({ items, kind = 'line' }) {
  return <div className="legend">{items.map((s) => <span key={s.key}><i className={`key ${kind}`} style={{ background: s.color }} />{s.label}</span>)}</div>;
}

// ---- line chart (time series), crosshair + one tooltip listing every series
export function LineChart({ data, series, height = 260, bucket = 'day' }) {
  const [ref, w] = useWidth(); const [hi, setHi] = useState(null);
  const m = { l: 44, r: 16, t: 12, b: 28 }; const iw = Math.max(0, w - m.l - m.r); const ih = height - m.t - m.b;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key]))));
  const x = (i) => m.l + (data.length <= 1 ? iw / 2 : (i * iw) / (data.length - 1));
  const y = (v) => m.t + ih - (v / max) * ih;
  const line = (k) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
  const pickIdx = (clientX) => { const r = ref.current.getBoundingClientRect(); return clamp(Math.round(((clientX - r.left - m.l) / (iw || 1)) * (data.length - 1)), 0, data.length - 1); };
  const label = (d) => (bucket === 'week' ? `Week of ${fmtDay(d)}` : fmtDay(d, { weekday: 'short', month: 'short', day: 'numeric' }));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} tabIndex={0} role="img" aria-label={`${series.map((s) => s.label).join(' and ')} over time`}
          onPointerMove={(e) => setHi(pickIdx(e.clientX))} onPointerLeave={() => setHi(null)} onBlur={() => setHi(null)}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') setHi((h) => clamp((h ?? -1) + 1, 0, data.length - 1)); if (e.key === 'ArrowLeft') setHi((h) => clamp((h ?? data.length) - 1, 0, data.length - 1)); }}>
          {[0, 1, 2, 3, 4].map((i) => { const v = (max * i) / 4; return (
            <g key={i}><line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} className={i ? 'grid' : 'base'} /><text x={m.l - 8} y={y(v)} className="tick" textAnchor="end" dominantBaseline="middle">{compact(v)}</text></g>); })}
          {xTickIdx(data.length).map((i) => <text key={i} x={x(i)} y={height - 8} className="tick" textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>{fmtDay(data[i].d)}</text>)}
          <path d={`${line(series[0].key)}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={series[0].color} opacity=".1" />
          {[...series].reverse().map((s) => <path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth={s.dim ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" />)}
          {hi != null && (
            <g>
              <line x1={x(hi)} x2={x(hi)} y1={m.t} y2={m.t + ih} className="crosshair" />
              {series.map((s) => <circle key={s.key} cx={x(hi)} cy={y(data[hi][s.key])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
            </g>
          )}
        </svg>
      )}
      {hi != null && w > 0 && (
        <Tooltip x={x(hi)} y={m.t + ih / 2} w={w}>
          <div className="tip-head">{label(data[hi].d)}{data[hi].partial ? ' (so far)' : ''}</div>
          {series.map((s) => <TipRow key={s.key} color={s.color} value={fmtInt(data[hi][s.key])} label={s.dateKey ? `${s.label} · ${fmtDay(data[hi][s.dateKey])}` : s.label} />)}
        </Tooltip>
      )}
    </div>
  );
}

// ---- stacked columns (part-to-whole over time), per-column tooltip
const topRounded = (x, y, w, h, r) => { r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
export function StackedColumns({ data, series, height = 240, bucket = 'day' }) {
  const [ref, w] = useWidth(); const [hi, setHi] = useState(null);
  const m = { l: 44, r: 12, t: 12, b: 28 }; const iw = Math.max(0, w - m.l - m.r); const ih = height - m.t - m.b;
  const total = (d) => series.reduce((a, s) => a + d[s.key], 0);
  const max = niceMax(Math.max(0, ...data.map(total)));
  const band = iw / Math.max(1, data.length); const cw = Math.max(2, Math.min(24, band * 0.7));
  const y = (v) => m.t + ih - (v / max) * ih;
  const label = (d) => (bucket === 'week' ? `Week of ${fmtDay(d)}` : fmtDay(d, { weekday: 'short', month: 'short', day: 'numeric' }));
  return (
    <div className="chart" ref={ref} style={{ height }} onPointerLeave={() => setHi(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={`${series.map((s) => s.label).join(' and ')} per ${bucket}`}>
          {[0, 1, 2, 3, 4].map((i) => { const v = (max * i) / 4; return (
            <g key={i}><line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} className={i ? 'grid' : 'base'} /><text x={m.l - 8} y={y(v)} className="tick" textAnchor="end" dominantBaseline="middle">{compact(v)}</text></g>); })}
          {data.map((d, i) => {
            const cx = m.l + band * i + (band - cw) / 2; let acc = 0; const t = total(d);
            const segs = series.map((s, si) => {
              const v = d[s.key]; if (!v) return null;
              const y0 = y(acc), y1 = y(acc + v); acc += v;
              const isTop = acc === t; const gap = si > 0 && acc - v > 0 ? 2 : 0;
              const h = Math.max(0, y0 - y1 - gap);
              return isTop ? <path key={s.key} d={topRounded(cx, y1, cw, h, 4)} fill={s.color} /> : <rect key={s.key} x={cx} y={y1} width={cw} height={h} fill={s.color} />;
            });
            return (
              <g key={d.d} className={hi === i ? 'col hi' : 'col'}>
                {segs}
                <rect x={m.l + band * i} y={m.t} width={band} height={ih} fill="transparent" tabIndex={-1}
                  onPointerEnter={() => setHi(i)} onFocus={() => setHi(i)} />
              </g>
            );
          })}
          {xTickIdx(data.length).map((i) => <text key={i} x={m.l + band * i + band / 2} y={height - 8} className="tick" textAnchor="middle">{fmtDay(data[i].d)}</text>)}
        </svg>
      )}
      {hi != null && w > 0 && (
        <Tooltip x={m.l + band * hi + band / 2} y={m.t + ih / 2} w={w}>
          <div className="tip-head">{label(data[hi].d)}</div>
          {[...series].reverse().map((s) => <TipRow key={s.key} kind="rect" color={s.color} value={fmtInt(data[hi][s.key])} label={s.label} />)}
          <div className="tip-foot">{fmtInt(total(data[hi]))} total</div>
        </Tooltip>
      )}
    </div>
  );
}

// ---- weekday × hour heatmap (sequential, one hue), per-cell tooltip
export function Heatmap({ cells }) {
  const [ref, w] = useWidth(); const [hi, setHi] = useState(null);
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const c of cells) grid[c.dow - 1][c.h] += c.n;
  const max = Math.max(1, ...grid.flat());
  const level = (n) => (n === 0 ? 0 : Math.min(6, Math.ceil((n / max) * 6)));
  const lw = 34, top = 4, gap = 2; const cell = Math.max(6, (w - lw) / 24 - gap); const h = top + 7 * (cell + gap) + 22;
  return (
    <div className="chart" ref={ref} style={{ height: h + 30 }} onPointerLeave={() => setHi(null)}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Plays by weekday and hour (ET)">
          {grid.map((row, r) => (
            <g key={r}>
              <text x={0} y={top + r * (cell + gap) + cell / 2} className="tick" dominantBaseline="middle">{DOW[r]}</text>
              {row.map((n, c) => (
                <rect key={c} x={lw + c * (cell + gap)} y={top + r * (cell + gap)} width={cell} height={cell} rx="2"
                  className={`heat l${level(n)} ${hi && hi.r === r && hi.c === c ? 'hi' : ''}`}
                  onPointerEnter={() => setHi({ r, c, n })} />
              ))}
            </g>
          ))}
          {[0, 3, 6, 9, 12, 15, 18, 21].map((c) => <text key={c} x={lw + c * (cell + gap)} y={h - 6} className="tick">{hourLabel(c).replace(' ', '').toLowerCase()}</text>)}
        </svg>
      )}
      {w > 0 && (
        <div className="heat-legend"><span className="muted">Fewer</span>{[0, 1, 2, 3, 4, 5, 6].map((l) => <i key={l} className={`heat l${l}`} />)}<span className="muted">More</span></div>
      )}
      {hi && <Tooltip x={lw + hi.c * (cell + gap) + cell / 2} y={top + hi.r * (cell + gap) + cell / 2} w={w}>
        <div className="tip-head">{DOW[hi.r]} · {hourLabel(hi.c)}–{hourLabel((hi.c + 1) % 24)}</div>
        <TipRow kind="rect" color="var(--seq-5)" value={fmtInt(hi.n)} label="plays" />
      </Tooltip>}
    </div>
  );
}

// ---- horizontal bar list (one series → one colour), value at the tip, optional target tick
export function BarList({ rows, format = fmtInt, onSelect, empty = 'No data in this range.' }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.value, r.target || 0)));
  if (!rows.length) return <p className="muted empty">{empty}</p>;
  return (
    <div className="barlist">
      {rows.map((r) => (
        <div key={r.key} className={`bl-row ${onSelect ? 'click' : ''}`} onClick={onSelect ? () => onSelect(r) : undefined} tabIndex={onSelect ? 0 : undefined}
          onKeyDown={onSelect ? (e) => e.key === 'Enter' && onSelect(r) : undefined}>
          <div className="bl-label"><span>{r.label}</span>{r.sub && <small>{r.sub}</small>}</div>
          <div className="bl-track">
            <span className="bl-bar" style={{ width: `${(r.value / max) * 100}%`, background: r.color || 'var(--s1)' }} />
            {r.target != null && <span className="bl-target" style={{ left: `${(r.target / max) * 100}%` }} title={`Set: ${format(r.target)}`} />}
          </div>
          <div className="bl-val">{format(r.value)}{r.note && <small>{r.note}</small>}</div>
        </div>
      ))}
    </div>
  );
}

// ---- sparkline: de-emphasis line, current point in the accent
export function Sparkline({ values, height = 32 }) {
  const [ref, w] = useWidth();
  const max = Math.max(1, ...values); const n = values.length;
  const x = (i) => (n <= 1 ? w / 2 : 2 + (i * (w - 4)) / (n - 1)); const y = (v) => height - 3 - (v / max) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <div ref={ref} className="spark" style={{ height }} aria-hidden="true">
      {w > 0 && n > 1 && <svg width={w} height={height}><path d={d} fill="none" stroke="var(--spark)" strokeWidth="1.5" strokeLinejoin="round" /><circle cx={x(n - 1)} cy={y(values[n - 1])} r="3" fill="var(--s1)" stroke="var(--surface)" strokeWidth="1.5" /></svg>}
    </div>
  );
}

// ---- stat tile: label · value · delta vs previous period · sparkline
export function StatTile({ label, value, delta, goodUp = true, spark, hint, prevLabel = 'vs previous period' }) {
  let cls = 'flat', icon = '–', txt = 'No change';
  if (delta && delta.ratio === null) { cls = goodUp ? 'good' : 'bad'; icon = '▲'; txt = 'New'; }
  else if (delta && delta.dir !== 'flat') { const good = (delta.dir === 'up') === goodUp; cls = good ? 'good' : 'bad'; icon = delta.dir === 'up' ? '▲' : '▼'; txt = pct(Math.abs(delta.ratio), Math.abs(delta.ratio) < 0.1 ? 1 : 0); }
  return (
    <div className="tile">
      <div className="tile-label">{label}{hint && <span className="hint" title={hint} aria-label={hint}>?</span>}</div>
      <div className="tile-value">{value}</div>
      <div className="tile-foot">
        {delta !== undefined && <span className={`delta ${cls}`}><span aria-hidden="true">{icon}</span> {txt}</span>}
        {delta !== undefined && <span className="muted small">{prevLabel}</span>}
      </div>
      {spark && <Sparkline values={spark} />}
    </div>
  );
}

// ---- meter (single ratio against a limit); status fill + icon + label, never colour alone
export function Meter({ value, label, good = 0.97, warn = 0.9 }) {
  const st = value >= good ? ['good', '✓', 'Healthy'] : value >= warn ? ['warning', '!', 'Watch'] : ['critical', '✕', 'Needs attention'];
  return (
    <div className="meter">
      <div className="meter-head"><b>{pct(value, 1)}</b><span className={`status ${st[0]}`}><span aria-hidden="true">{st[1]}</span> {st[2]}</span></div>
      <div className={`meter-track ${st[0]}`}><span style={{ width: `${Math.min(100, value * 100)}%` }} /></div>
      {label && <div className="muted small">{label}</div>}
    </div>
  );
}

// ---- card with title, actions and a chart/table toggle (every chart has a table twin)
export function ChartCard({ title, sub, table, actions, children, className = '' }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`card chart-card ${className}`}>
      <header className="card-head">
        <div><h2>{title}</h2>{sub && <p className="muted small">{sub}</p>}</div>
        <div className="card-actions">
          {actions}
          {table && <button className="ghost small" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>{asTable ? 'Chart' : 'Table'}</button>}
        </div>
      </header>
      {asTable && table ? <DataTable {...table} /> : children}
    </section>
  );
}
export function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap"><table className="data">
      <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

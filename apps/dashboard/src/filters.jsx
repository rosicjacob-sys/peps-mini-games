import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { todayET, addDays, dowOf, fmtRange, TYPE_LABEL } from './format.js';

// Date presets - all ET calendar days, inclusive.
export const PRESETS = [
  { key: 'today', label: 'Today', range: (t) => [t, t] },
  { key: 'yesterday', label: 'Yesterday', range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { key: '7d', label: 'Last 7 days', range: (t) => [addDays(t, -6), t] },
  { key: '30d', label: 'Last 30 days', range: (t) => [addDays(t, -29), t] },
  { key: '90d', label: 'Last 90 days', range: (t) => [addDays(t, -89), t] },
  { key: 'week', label: 'This week (Mon–Sun)', range: (t) => [addDays(t, -dowOf(t)), t] },
  { key: 'lastweek', label: 'Last week', range: (t) => { const m = addDays(t, -dowOf(t) - 7); return [m, addDays(m, 6)]; } },
  { key: 'month', label: 'This month', range: (t) => [`${t.slice(0, 8)}01`, t] },
  { key: 'lastmonth', label: 'Last month', range: (t) => { const end = addDays(`${t.slice(0, 8)}01`, -1); return [`${end.slice(0, 8)}01`, end]; } },
  { key: 'all', label: 'All time', range: (t) => ['all', t] },
];

const Ctx = createContext(null);
const KEY = 'pg_filters';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export function FiltersProvider({ children }) {
  const saved = load();
  const [preset, setPreset] = useState(saved.preset || '30d');
  const [custom, setCustom] = useState(saved.custom || { from: addDays(todayET(), -29), to: todayET() });
  const [dims, setDims] = useState({ group_id: saved.group_id || '', store_id: saved.store_id || '', game_id: saved.game_id || '' });
  const [lists, setLists] = useState({ groups: [], stores: [], games: [] });
  const reloadLists = () => Promise.all([api.groups(), api.stores(), api.games()]).then(([groups, stores, games]) => setLists({ groups, stores, games }));
  useEffect(() => { reloadLists(); }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ preset, custom, ...dims })); } catch {} }, [preset, custom, dims]);

  const value = useMemo(() => {
    const t = todayET();
    const [from, to] = preset === 'custom' ? [custom.from, custom.to] : PRESETS.find((p) => p.key === preset).range(t);
    return { preset, setPreset, custom, setCustom, dims, setDims, lists, reloadLists, params: { from, to, ...dims } };
  }, [preset, custom, dims, lists]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useFilters = () => useContext(Ctx);

// One row above everything it scopes: date range first, then group → store → game.
export function FilterBar({ lockGame, extra }) {
  const f = useFilters();
  const { groups, stores, games } = f.lists;
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => { const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h); }, []);
  const storeOpts = stores.filter((s) => !f.dims.group_id || (f.dims.group_id === 'none' ? !s.group_id : s.group_id === f.dims.group_id));
  const gameOpts = games.filter((g) => (f.dims.store_id ? g.store_id === f.dims.store_id : storeOpts.some((s) => s.id === g.store_id)));
  const label = f.preset === 'custom' ? fmtRange(f.params.from, f.params.to) : PRESETS.find((p) => p.key === f.preset).label;
  const set = (k, v) => {
    const d = { ...f.dims, [k]: v };
    if (k === 'group_id') { d.store_id = ''; d.game_id = ''; }
    if (k === 'store_id') d.game_id = '';
    f.setDims(d);
  };
  const active = f.dims.group_id || f.dims.store_id || f.dims.game_id;
  return (
    <div className="filterbar">
      <div className="daterange" ref={ref}>
        <button className="fb-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" /></svg>
          {label}<span className="caret" aria-hidden="true">▾</span>
        </button>
        {open && (
          <div className="menu" role="listbox">
            {PRESETS.map((p) => (
              <button key={p.key} role="option" aria-selected={f.preset === p.key} className="menu-row" onClick={() => { f.setPreset(p.key); setOpen(false); }}>
                <span className="check">{f.preset === p.key ? '✓' : ''}</span>{p.label}
              </button>
            ))}
            <div className="menu-foot">
              <span className="muted">Custom range (ET)</span>
              <div className="row tight">
                <input type="date" value={f.custom.from} max={f.custom.to} onChange={(e) => f.setCustom({ ...f.custom, from: e.target.value })} />
                <input type="date" value={f.custom.to} min={f.custom.from} onChange={(e) => f.setCustom({ ...f.custom, to: e.target.value })} />
              </div>
              <button className="primary small" onClick={() => { f.setPreset('custom'); setOpen(false); }}>Apply custom range</button>
            </div>
          </div>
        )}
      </div>
      {!lockGame && (
        <>
          <select className="fb-select" aria-label="Store group" value={f.dims.group_id} onChange={(e) => set('group_id', e.target.value)}>
            <option value="">All store groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            {stores.some((s) => !s.group_id) && <option value="none">Ungrouped</option>}
          </select>
          <select className="fb-select" aria-label="Store" value={f.dims.store_id} onChange={(e) => set('store_id', e.target.value)}>
            <option value="">All stores</option>
            {storeOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="fb-select" aria-label="Game" value={f.dims.game_id} onChange={(e) => set('game_id', e.target.value)}>
            <option value="">All games</option>
            {gameOpts.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.store_name}</option>)}
          </select>
          {active && <button className="link" onClick={() => f.setDims({ group_id: '', store_id: '', game_id: '' })}>Clear filters</button>}
        </>
      )}
      <span className="fb-range muted">{f.params.from === 'all' ? 'All time' : fmtRange(f.params.from, f.params.to)} · ET</span>
      <div className="fb-extra">{extra}</div>
    </div>
  );
}
export { TYPE_LABEL };

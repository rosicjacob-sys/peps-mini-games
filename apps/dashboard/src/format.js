// Number/date formatting shared by every page. Dates are ET calendar days ("YYYY-MM-DD").
import { GAME_TYPES } from '@peps/shared';

const ZONE = 'America/Toronto';
const nf = new Intl.NumberFormat('en-CA');
const cf = new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtInt = (n) => nf.format(Math.round(n || 0));
export const compact = (n) => (Math.abs(n) >= 1000 ? cf.format(n) : fmtInt(n));
export const pct = (x, d = 0) => `${(Number.isFinite(x) ? x * 100 : 0).toFixed(d)}%`;
export const fmt1 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

export const todayET = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const asDate = (s) => new Date(`${s}T12:00:00Z`);
export const addDays = (s, n) => { const d = asDate(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dowOf = (s) => (asDate(s).getUTCDay() + 6) % 7; // 0 = Monday
export const fmtDay = (s, o = { month: 'short', day: 'numeric' }) => asDate(s).toLocaleDateString('en-CA', { timeZone: 'UTC', ...o });
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-CA', { timeZone: ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtDateShort = (iso) => { const d = new Date(iso); const sameYear = d.getFullYear() === new Date().getFullYear(); return d.toLocaleDateString('en-CA', { timeZone: ZONE, month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }); };
export const fmtRange = (from, to) => (from === to ? fmtDay(from, { month: 'short', day: 'numeric', year: 'numeric' }) : `${fmtDay(from)} – ${fmtDay(to, { month: 'short', day: 'numeric', year: 'numeric' })}`);
export const hourLabel = (h) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DOW_LONG = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

// change vs the previous period: { ratio, dir: 'up'|'down'|'flat' } (null when there is no base)
export function change(cur, prev) {
  if (!prev) return cur ? { ratio: null, dir: 'up' } : null;
  const r = (cur - prev) / prev;
  return { ratio: r, dir: Math.abs(r) < 0.005 ? 'flat' : r > 0 ? 'up' : 'down' };
}
export const tr = (v) => (v && typeof v === 'object' ? v.en || v.fr || '' : v || '');
// the label of a game type ("Prize Wheel"), from the shared list so every type is covered
export const typeLabel = (type) => GAME_TYPES[type]?.label || type || '';

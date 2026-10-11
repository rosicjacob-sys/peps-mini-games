const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const WIDGET_URL = import.meta.env.VITE_WIDGET_URL || BASE.replace('-api', '-widget') + '/widget.js';

let token = localStorage.getItem('pg_token') || '';
export const hasToken = () => !!token;
export function logout() { token = ''; localStorage.removeItem('pg_token'); location.reload(); }

const qs = (o = {}) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}/api/admin${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && path !== '/login') return logout();
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: async (password) => { const { token: t } = await req('/login', { method: 'POST', body: { password } }); token = t; localStorage.setItem('pg_token', t); },
  groups: () => req('/groups'),
  createGroup: (b) => req('/groups', { method: 'POST', body: b }),
  updateGroup: (id, b) => req(`/groups/${id}`, { method: 'PUT', body: b }),
  deleteGroup: (id) => req(`/groups/${id}`, { method: 'DELETE' }),
  stores: () => req('/stores'),
  createStore: (b) => req('/stores', { method: 'POST', body: b }),
  updateStore: (id, b) => req(`/stores/${id}`, { method: 'PUT', body: b }),
  deleteStore: (id) => req(`/stores/${id}`, { method: 'DELETE' }),
  games: () => req('/games'),
  game: (id) => req(`/games/${id}`),
  createGame: (b) => req('/games', { method: 'POST', body: b }),
  updateGame: (id, b) => req(`/games/${id}`, { method: 'PUT', body: b }),
  deleteGame: (id) => req(`/games/${id}`, { method: 'DELETE' }),
  saveRewards: (id, rewards, lose_percent = 0) => req(`/games/${id}/rewards`, { method: 'PUT', body: { rewards, lose_percent } }),
  // reports — every call takes the global filters { from, to, group_id, store_id, game_id }
  overview: (f) => req(`/reports/overview?${qs(f)}`),
  players: (f) => req(`/players?${qs(f)}`),
  player: (email) => req(`/players/${encodeURIComponent(email)}`),
  deliveries: (f) => req(`/deliveries?${qs(f)}`),
  resend: (id) => req(`/plays/${id}/resend`, { method: 'POST' }),
  async download(path, f, filename) {
    const res = await fetch(`${BASE}/api/admin${path}?${qs(f)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Export failed');
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

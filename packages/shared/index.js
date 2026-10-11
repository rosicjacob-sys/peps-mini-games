// Shared between api, dashboard and widget.

export const LOCALES = ['en', 'fr'];

export const GAME_TYPES = {
  blackjack: { label: 'Blackjack', fixedTheme: 'casino-purple' },
  wheel: { label: 'Prize Wheel' },
  slots: { label: 'Slot Machine' },
};

// Neutral palettes — accents are greys/whites so they sit well next to a
// store's gold, blue, red, green or pink branding. `brandAccent` on a game can
// override `accent` if a client wants their colour in the mix.
export const THEMES = {
  'ivory':    { label: 'Ivory',    bg: '#FAF8F4', surface: '#FFFFFF', text: '#1F1F1F', muted: '#6B6B6B', accent: '#2B2B2B', accentText: '#FFFFFF', border: '#E4E0D8', slices: ['#FFFFFF', '#EFEBE3'] },
  'pearl':    { label: 'Pearl',    bg: '#F3F4F6', surface: '#FFFFFF', text: '#111827', muted: '#6B7280', accent: '#374151', accentText: '#FFFFFF', border: '#E5E7EB', slices: ['#FFFFFF', '#E5E7EB'] },
  'stone':    { label: 'Stone',    bg: '#E7E5E4', surface: '#F5F5F4', text: '#1C1917', muted: '#78716C', accent: '#44403C', accentText: '#FFFFFF', border: '#D6D3D1', slices: ['#F5F5F4', '#D6D3D1'] },
  'silver':   { label: 'Silver',   bg: '#D1D5DB', surface: '#F3F4F6', text: '#111827', muted: '#4B5563', accent: '#1F2937', accentText: '#FFFFFF', border: '#9CA3AF', slices: ['#F3F4F6', '#CBD0D8'] },
  'graphite': { label: 'Graphite', bg: '#2A2A2D', surface: '#37373B', text: '#F4F4F5', muted: '#A1A1AA', accent: '#E4E4E7', accentText: '#18181B', border: '#4A4A50', slices: ['#3F3F45', '#2F2F34'] },
  'midnight': { label: 'Midnight', bg: '#0F1115', surface: '#1A1D23', text: '#F5F5F5', muted: '#9AA0AA', accent: '#F5F5F5', accentText: '#0F1115', border: '#2B3038', slices: ['#22262D', '#171A20'] },
  'casino-purple': { label: 'Casino Purple', bg: '#14081F', surface: '#1F0F33', text: '#FFFFFF', muted: '#C4B5FD', accent: '#6B21D8', accentText: '#FFFFFF', border: '#3B1B66', slices: ['#2A1347', '#1F0F33'], locked: true },
};

export const DEFAULT_THEME = 'pearl';

export function themeFor(type, themeKey) {
  const fixed = GAME_TYPES[type]?.fixedTheme;
  return THEMES[fixed || themeKey] || THEMES[DEFAULT_THEME];
}

// Strings shown by the widget and in emails. Anything per-game is editable in the dashboard;
// these are the defaults and the UI chrome.
export const UI = {
  en: {
    play: 'Play & Win', emailLabel: 'Your email', emailPlaceholder: 'you@example.com',
    start: 'Play now', sending: 'Please wait…', invalidEmail: 'Please enter a valid email address.',
    spin: 'SPIN', spinning: 'Spinning…', yourReward: 'You won!', yourRewards: 'You won!',
    code: 'Your code', copy: 'Copy', copied: 'Copied!',
    oneUse: 'Single use. Expires', emailed: 'We also emailed this code to', close: 'Close',
    already: 'You already played this week.', comeBack: 'Come back on', error: 'Something went wrong. Please try again.',
    paused: 'This game is not available right now.',
  },
  fr: {
    play: 'Jouer et gagner', emailLabel: 'Votre courriel', emailPlaceholder: 'vous@exemple.com',
    start: 'Jouer', sending: 'Veuillez patienter…', invalidEmail: 'Veuillez entrer une adresse courriel valide.',
    spin: 'TOURNER', spinning: 'Rotation…', yourReward: 'Vous avez gagné!', yourRewards: 'Vous avez gagné!',
    code: 'Votre code', copy: 'Copier', copied: 'Copié!',
    oneUse: 'Usage unique. Expire le', emailed: 'Nous avons aussi envoyé ce code à', close: 'Fermer',
    already: 'Vous avez déjà joué cette semaine.', comeBack: 'Revenez le', error: 'Une erreur est survenue. Veuillez réessayer.',
    paused: "Ce jeu n'est pas disponible pour le moment.",
  },
};

export function pickLocale(v) {
  const l = String(v || '').toLowerCase().slice(0, 2);
  return LOCALES.includes(l) ? l : 'en';
}

// {en:'..', fr:'..'} -> string for a locale, falling back to en.
export function t(obj, locale) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[locale] || obj.en || '';
}

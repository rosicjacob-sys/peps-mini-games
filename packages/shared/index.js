// Shared between api, dashboard and widget.

export const LOCALES = ['en', 'fr'];

export const GAME_TYPES = {
  blackjack: { label: 'Blackjack', icon: '♠', fixedTheme: 'casino-purple' },
  wheel: { label: 'Prize Wheel', icon: '🎡', defaultTheme: 'burgundy' },
  slots: { label: 'Slot Machine', icon: '🎰', defaultTheme: 'emerald' },
  color: { label: 'Color Game', icon: '🎲', defaultTheme: 'crimson', maxRewards: 6 },
  lucky9: { label: 'Lucky 9', icon: '9', defaultTheme: 'emerald' },
  baccarat: { label: 'Baccarat', icon: '♦', defaultTheme: 'black-gold' },
  poker: { label: 'Poker', icon: '♣', defaultTheme: 'royal-blue' },
};
// every type except the wheel awards exactly one reward per play
export const singleReward = (type) => type !== 'wheel';

// Casino palettes. Every theme carries gold trim (rim); the accent is the button colour.
// `brandAccent` on a game can still override `accent` if a client wants their colour on the buttons.
export const THEMES = {
  'emerald':  { label: 'Emerald felt',  bg: '#0B3D2E', surface: '#0F4D3A', text: '#FFF8E7', muted: '#A7D7C3', accent: '#D6B24A', accentText: '#1f1a0a', border: '#8C6D1F', slices: ['#0F5C44', '#083B2C'], wheel: ['#146B50', '#141414', '#0F5C44', '#2A2A2A'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold' },
  'burgundy': { label: 'Burgundy',      bg: '#3B0A12', surface: '#4A0F19', text: '#FFF4E6', muted: '#E6B8BF', accent: '#D6B24A', accentText: '#1f1a0a', border: '#8C6D1F', slices: ['#5E1420', '#3B0A12'], wheel: ['#7A1B2A', '#141414', '#A32434', '#2A2A2A'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold' },
  'black-gold': { label: 'Black & gold', bg: '#0D0D0F', surface: '#17171B', text: '#FFF8E7', muted: '#B5B5BD', accent: '#D6B24A', accentText: '#1f1a0a', border: '#8C6D1F', slices: ['#1F1F24', '#121215'], wheel: ['#2A2A30', '#101012', '#3A3A42', '#1B1B1F'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold' },
  'royal-blue': { label: 'Royal blue',  bg: '#0B1F4D', surface: '#102A66', text: '#FFF8E7', muted: '#A9BBE6', accent: '#D6B24A', accentText: '#1f1a0a', border: '#8C6D1F', slices: ['#143A8A', '#0B1F4D'], wheel: ['#1C4AA8', '#141414', '#143A8A', '#2A2A2A'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold' },
  'crimson':  { label: 'Crimson',       bg: '#5A0E0E', surface: '#6E1414', text: '#FFF4E6', muted: '#F0B9B9', accent: '#D6B24A', accentText: '#1f1a0a', border: '#8C6D1F', slices: ['#8A1C1C', '#5A0E0E'], wheel: ['#A32424', '#141414', '#8A1C1C', '#2A2A2A'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold' },
  'casino-purple': { label: 'Casino purple', bg: '#14081F', surface: '#1F0F33', text: '#FFFFFF', muted: '#C4B5FD', accent: '#6B21D8', accentText: '#FFFFFF', border: '#8C6D1F', slices: ['#2A1347', '#1F0F33'], wheel: ['#6D28D9', '#141414', '#8B5CF6', '#2A2A2A'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold', locked: true },
};

// Slot machine tile icons, picked per reward in the dashboard. A reward without one gets an icon by its position.
export const SLOT_ICONS = [
  { key: 'diamond', label: 'Diamond', glyph: '💎' },
  { key: 'star', label: 'Star', glyph: '⭐' },
  { key: 'lightning', label: 'Lightning', glyph: '⚡' },
  { key: 'cherry', label: 'Cherry', glyph: '🍒' },
  { key: 'lemon', label: 'Lemon', glyph: '🍋' },
  { key: 'grapes', label: 'Grapes', glyph: '🍇' },
  { key: 'watermelon', label: 'Watermelon', glyph: '🍉' },
  { key: 'orange', label: 'Orange', glyph: '🍊' },
  { key: 'strawberry', label: 'Strawberry', glyph: '🍓' },
  { key: 'seven', label: 'Lucky 7', glyph: '7️⃣' },
  { key: 'bell', label: 'Bell', glyph: '🔔' },
  { key: 'clover', label: 'Clover', glyph: '🍀' },
  { key: 'crown', label: 'Crown', glyph: '👑' },
];
export const SLOT_SYMBOLS = SLOT_ICONS.map((i) => i.glyph);
export const symbolFor = (reward, index) => reward.symbol || SLOT_SYMBOLS[index % SLOT_SYMBOLS.length];

export const DEFAULT_THEME = 'emerald';

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
    spin: 'SPIN', spinning: 'Spinning…', yourReward: 'You won!', yourRewards: 'You won!', congrats: 'Congratulations!',
    code: 'Your code', copy: 'Copy', copied: 'Copied!',
    oneUse: 'Single use. Expires', emailed: 'We also emailed this code to', close: 'Close',
    redeem: 'Enter this code in your cart to apply your reward.', spinHeading: 'Spin your reward',
    choose: 'Choose your game', gateHeading: 'Enter to play', otherGames: 'Other games', matchThree: 'Match three to win',
    already: 'You already played this week.', comeBack: 'Come back on', error: 'Something went wrong. Please try again.',
    paused: 'This game is not available right now.',
    hit: 'Hit', stand: 'Stand', dealer: 'Dealer', you: 'You', bust: 'Bust!',
    bjResult: { blackjack: 'Blackjack!', win: 'You win!', push: 'Push', loss: 'Dealer wins' }, bjNext: 'Spin for your reward',
    color: { roll: 'ROLL THE DICE', rolling: 'Rolling…', board: 'Match two or three dice to win that prize', match: 'Your colour!' },
    l9: { draw: 'Draw', stand: 'Stand', banker: 'Banker', you: 'You', natural: 'Natural', win: 'You win!', closest: 'Closest to 9 wins' },
    bac: { pick: 'Place your bet', player: 'Player', banker: 'Banker', tie: 'Tie', pays: { player: 'pays 1:1', banker: 'pays 0.95:1', tie: 'pays 8:1' }, wins: { player: 'Player wins!', banker: 'Banker wins!', tie: 'It’s a tie!' }, yourBet: 'Your bet wins!' },
    poker: { deal: 'DEAL', dealing: 'Dealing…', paytable: 'Paytable', hands: { pair: 'Pair', two_pair: 'Two Pair', three: 'Three of a Kind', straight: 'Straight', flush: 'Flush', full_house: 'Full House', four: 'Four of a Kind', straight_flush: 'Straight Flush' } },
  },
  fr: {
    play: 'Jouer et gagner', emailLabel: 'Votre courriel', emailPlaceholder: 'vous@exemple.com',
    start: 'Jouer', sending: 'Veuillez patienter…', invalidEmail: 'Veuillez entrer une adresse courriel valide.',
    spin: 'TOURNER', spinning: 'Rotation…', yourReward: 'Vous avez gagné!', yourRewards: 'Vous avez gagné!', congrats: 'Félicitations!',
    code: 'Votre code', copy: 'Copier', copied: 'Copié!',
    oneUse: 'Usage unique. Expire le', emailed: 'Nous avons aussi envoyé ce code à', close: 'Fermer',
    redeem: 'Entrez ce code dans votre panier pour appliquer votre récompense.', spinHeading: 'Tournez pour votre récompense',
    choose: 'Choisissez votre jeu', gateHeading: 'Entrez pour jouer', otherGames: 'Autres jeux', matchThree: 'Alignez-en trois pour gagner',
    already: 'Vous avez déjà joué cette semaine.', comeBack: 'Revenez le', error: 'Une erreur est survenue. Veuillez réessayer.',
    paused: "Ce jeu n'est pas disponible pour le moment.",
    hit: 'Carte', stand: 'Rester', dealer: 'Croupier', you: 'Vous', bust: 'Dépassé!',
    bjResult: { blackjack: 'Blackjack!', win: 'Vous gagnez!', push: 'Égalité', loss: 'Le croupier gagne' }, bjNext: 'Tourner pour ma récompense',
    color: { roll: 'LANCER LES DÉS', rolling: 'Lancer…', board: 'Deux ou trois dés de la même couleur gagnent ce prix', match: 'Votre couleur!' },
    l9: { draw: 'Tirer', stand: 'Rester', banker: 'Banquier', you: 'Vous', natural: 'Naturel', win: 'Vous gagnez!', closest: 'Le plus proche de 9 gagne' },
    bac: { pick: 'Placez votre mise', player: 'Joueur', banker: 'Banquier', tie: 'Égalité', pays: { player: 'paie 1:1', banker: 'paie 0,95:1', tie: 'paie 8:1' }, wins: { player: 'Le joueur gagne!', banker: 'Le banquier gagne!', tie: 'Égalité!' }, yourBet: 'Votre mise gagne!' },
    poker: { deal: 'DISTRIBUER', dealing: 'Distribution…', paytable: 'Table des gains', hands: { pair: 'Paire', two_pair: 'Deux paires', three: 'Brelan', straight: 'Quinte', flush: 'Couleur', full_house: 'Main pleine', four: 'Carré', straight_flush: 'Quinte flush' } },
  },
};

// Default copy for the "Play to Win" intro popup. Every field is editable per game in the dashboard.
export const INTRO_DEFAULTS = {
  en: {
    heading: 'Play to Win!',
    description: 'Play a quick game for a chance to win exclusive discount codes, free gifts and other exciting rewards.',
    steps: ['Enter your email address', 'Play the game', "Get your reward code instantly — we'll email it to you too"],
    note: 'Everyone who plays gets a reward. Codes are single-use and expire every Sunday at 11:59 PM ET. One play per week.',
    playLabel: 'Play now', declineLabel: 'No thanks',
  },
  fr: {
    heading: 'Jouez pour gagner!',
    description: 'Jouez à un jeu rapide pour courir la chance de gagner des codes de réduction exclusifs, des cadeaux gratuits et d’autres récompenses intéressantes.',
    steps: ['Entrez votre adresse courriel', 'Jouez au jeu', 'Recevez votre code tout de suite — nous vous l’envoyons aussi par courriel'],
    note: 'Tous les participants reçoivent une récompense. Les codes sont à usage unique et expirent chaque dimanche à 23 h 59 (HE). Une partie par semaine.',
    playLabel: 'Jouer maintenant', declineLabel: 'Non merci',
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

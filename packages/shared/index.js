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
  'teal':     { label: 'Midnight teal', bg: '#062B30', surface: '#0A3A41', text: '#FFF8E7', muted: '#9ED3D6', accent: '#D6B24A', accentText: '#1f1a0a', border: '#8C6D1F', slices: ['#0E5A63', '#062B30'], wheel: ['#0F6670', '#141414', '#0B4F57', '#2A2A2A'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold' },
  'copper':   { label: 'Copper & onyx', bg: '#120C0A', surface: '#1E1410', text: '#FFF4EA', muted: '#D9B9A5', accent: '#D08A5C', accentText: '#1f1209', border: '#7A4527', slices: ['#3A2116', '#1E1410'], wheel: ['#8A4426', '#141414', '#A85A34', '#2A2A2A'], rim: '#D08A5C', rimText: '#1f1209', marquee: 'copper' },
  'platinum': { label: 'Platinum VIP',  bg: '#0F1319', surface: '#181E27', text: '#F5F7FA', muted: '#AEB7C5', accent: '#C9CFD8', accentText: '#14171C', border: '#6B7280', slices: ['#2A3240', '#181E27'], wheel: ['#33405A', '#121418', '#4A5873', '#22262E'], rim: '#C9CFD8', rimText: '#14171C', marquee: 'silver' },
  'casino-purple': { label: 'Casino purple', bg: '#14081F', surface: '#1F0F33', text: '#FFFFFF', muted: '#C4B5FD', accent: '#6B21D8', accentText: '#FFFFFF', border: '#8C6D1F', slices: ['#2A1347', '#1F0F33'], wheel: ['#6D28D9', '#141414', '#8B5CF6', '#2A2A2A'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold', locked: true },
};

// polished-metal fills for headline text, by the theme's `marquee` metal
export const METALS = {
  gold: 'linear-gradient(180deg,#fff6c8 0%,#f1d57a 35%,#b8891f 55%,#ffe79a 80%,#d6b24a 100%)',
  copper: 'linear-gradient(180deg,#ffe6d4 0%,#f2ad80 35%,#9a4c24 55%,#ffcaa3 80%,#cf8456 100%)',
  silver: 'linear-gradient(180deg,#ffffff 0%,#e4e8ee 35%,#8a93a2 55%,#f5f7fa 80%,#bcc3cf 100%)',
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
    limited: 'Claim it soon: this offer is only available for a very limited time.', emailed: 'We also emailed this code to', close: 'Close', soundOn: 'Turn sound on', soundOff: 'Turn sound off',
    redeem: 'Enter this code in your cart to apply your reward.', spinHeading: 'Spin your reward',
    lose: { title: 'Not this time', retry: 'Try again on', promo: 'In the meantime, keep an eye on your inbox. We send new promotions every week.', cont: 'Continue', slice: 'Try again' },
    noMatch: 'No match',
    choose: 'Choose your game', gateHeading: 'Enter to play', otherGames: 'Other games', matchThree: 'Match three to win',
    already: 'You already played this week using', onePer: 'You can only play once per email each week.', comeBack: 'Come back on', error: 'Something went wrong. Please try again.',
    paused: 'This game is not available right now.',
    hit: 'Hit', stand: 'Stand', dealer: 'Dealer', you: 'You', bust: 'Bust!',
    bjResult: { blackjack: 'Blackjack!', win: 'You win!', push: 'Push', loss: 'Dealer wins' }, bjNext: 'Spin for your reward',
    color: { roll: 'ROLL THE DICE', rolling: 'Rolling…', board: 'Match two or three dice to win that prize', match: 'Your colour!', noMatch: 'No match this time' },
    l9: { draw: 'Draw', stand: 'Stand', banker: 'Banker', you: 'You', natural: 'Natural 9!', win: 'You win!', bankerWins: 'Banker wins', closest: 'Closest to 9 wins' },
    bac: { pick: 'Place your bet', player: 'Player', banker: 'Banker', tie: 'Tie', wins: { player: 'Player wins!', banker: 'Banker wins!', tie: 'It’s a tie!' }, yourBet: 'Your bet wins!', betLoses: 'Your bet loses.' },
    poker: { deal: 'DEAL', dealing: 'Dealing…', paytable: 'Paytable', hands: { high: 'No winning hand', pair: 'Pair', two_pair: 'Two Pair', three: 'Three of a Kind', straight: 'Straight', flush: 'Flush', full_house: 'Full House', four: 'Four of a Kind', straight_flush: 'Straight Flush' } },
  },
  fr: {
    play: 'Jouer et gagner', emailLabel: 'Votre courriel', emailPlaceholder: 'vous@exemple.com',
    start: 'Jouer', sending: 'Veuillez patienter…', invalidEmail: 'Veuillez entrer une adresse courriel valide.',
    spin: 'TOURNER', spinning: 'Rotation…', yourReward: 'Vous avez gagné!', yourRewards: 'Vous avez gagné!', congrats: 'Félicitations!',
    code: 'Votre code', copy: 'Copier', copied: 'Copié!',
    limited: 'Profitez-en vite : cette offre n’est disponible que pour une durée très limitée.', emailed: 'Nous avons aussi envoyé ce code à', close: 'Fermer', soundOn: 'Activer le son', soundOff: 'Couper le son',
    redeem: 'Entrez ce code dans votre panier pour appliquer votre récompense.', spinHeading: 'Tournez pour votre récompense',
    lose: { title: 'Pas cette fois', retry: 'Réessayez le', promo: 'D’ici là, surveillez votre boîte de réception. Nous envoyons de nouvelles promotions chaque semaine.', cont: 'Continuer', slice: 'Réessayez' },
    noMatch: 'Pas de correspondance',
    choose: 'Choisissez votre jeu', gateHeading: 'Entrez pour jouer', otherGames: 'Autres jeux', matchThree: 'Alignez-en trois pour gagner',
    already: 'Vous avez déjà joué cette semaine avec', onePer: 'Chaque adresse courriel ne peut jouer qu’une fois par semaine.', comeBack: 'Revenez le', error: 'Une erreur est survenue. Veuillez réessayer.',
    paused: "Ce jeu n'est pas disponible pour le moment.",
    hit: 'Carte', stand: 'Rester', dealer: 'Croupier', you: 'Vous', bust: 'Dépassé!',
    bjResult: { blackjack: 'Blackjack!', win: 'Vous gagnez!', push: 'Égalité', loss: 'Le croupier gagne' }, bjNext: 'Tourner pour ma récompense',
    color: { roll: 'LANCER LES DÉS', rolling: 'Lancer…', board: 'Deux ou trois dés de la même couleur gagnent ce prix', match: 'Votre couleur!', noMatch: 'Pas de correspondance' },
    l9: { draw: 'Tirer', stand: 'Rester', banker: 'Banquier', you: 'Vous', natural: '9 naturel!', win: 'Vous gagnez!', bankerWins: 'Le banquier gagne', closest: 'Le plus proche de 9 gagne' },
    bac: { pick: 'Placez votre mise', player: 'Joueur', banker: 'Banquier', tie: 'Égalité', wins: { player: 'Le joueur gagne!', banker: 'Le banquier gagne!', tie: 'Égalité!' }, yourBet: 'Votre mise gagne!', betLoses: 'Votre mise perd.' },
    poker: { deal: 'DISTRIBUER', dealing: 'Distribution…', paytable: 'Table des gains', hands: { high: 'Aucune main gagnante', pair: 'Paire', two_pair: 'Deux paires', three: 'Brelan', straight: 'Quinte', flush: 'Couleur', full_house: 'Main pleine', four: 'Carré', straight_flush: 'Quinte flush' } },
  },
};

// Default copy for the "Play to Win" intro popup. Every field is editable per game in the dashboard.
export const INTRO_DEFAULTS = {
  en: {
    heading: 'Play to Win!',
    description: 'Play a quick game for a chance to win exclusive discount codes, free gifts and other exciting rewards.',
    steps: ['Enter your email address', 'Play the game', "Get your reward code instantly. We'll email it to you too"],
    note: 'Rewards are only available for a very limited time. One play per email each week.',
    playLabel: 'Play now', declineLabel: 'No thanks',
  },
  fr: {
    heading: 'Jouez pour gagner!',
    description: 'Jouez à un jeu rapide pour courir la chance de gagner des codes de réduction exclusifs, des cadeaux gratuits et d’autres récompenses intéressantes.',
    steps: ['Entrez votre adresse courriel', 'Jouez au jeu', 'Recevez votre code tout de suite. Nous vous l’envoyons aussi par courriel'],
    note: 'Les récompenses ne sont offertes que pour une durée très limitée. Une partie par adresse courriel chaque semaine.',
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

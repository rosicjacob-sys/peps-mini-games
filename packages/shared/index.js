// Shared between api, dashboard and widget.

export const LOCALES = ['en', 'fr'];

// Two families of games with their own look: Casino (felt, gold, Tuscan type) and Arcade (bright, bouncy, playful).
export const CATEGORIES = {
  casino: { label: { en: 'Casino', fr: 'Casino' }, icon: '♠', blurb: 'Felt tables, gold trim and a Tuscan casino font.' },
  arcade: { label: { en: 'Arcade', fr: 'Arcade' }, icon: '🎈', blurb: 'Bright colours, bouncy animations and a playful rounded font.' },
};

export const GAME_TYPES = {
  blackjack: { label: 'Blackjack', icon: '♠', category: 'casino', fixedTheme: 'casino-purple' },
  wheel: { label: 'Prize Wheel', icon: '🎡', category: 'casino', defaultTheme: 'burgundy' },
  slots: { label: 'Slot Machine', icon: '🎰', category: 'casino', defaultTheme: 'emerald' },
  color: { label: 'Color Game', icon: '🎲', category: 'casino', defaultTheme: 'crimson', maxRewards: 6 },
  lucky9: { label: 'Lucky 9', icon: '9', category: 'casino', defaultTheme: 'emerald' },
  baccarat: { label: 'Baccarat', icon: '♦', category: 'casino', defaultTheme: 'black-gold' },
  poker: { label: 'Poker', icon: '♣', category: 'casino', defaultTheme: 'royal-blue' },
  scratch: { label: 'Scratch Card', icon: '🪙', category: 'arcade', defaultTheme: 'candy' },
  gifts: { label: 'Mystery Gift Boxes', icon: '🎁', category: 'arcade', defaultTheme: 'sunshine' },
  plinko: { label: 'Plinko', icon: '🔮', category: 'arcade', defaultTheme: 'ocean', maxRewards: 8 },
  spin: { label: 'Lucky Spin', icon: '🌈', category: 'arcade', defaultTheme: 'candy' },
};
export const categoryOf = (type) => GAME_TYPES[type]?.category || 'casino';
// game types that show each reward as an icon (picked per reward in the library)
export const ICON_TYPES = ['slots', 'scratch', 'gifts', 'plinko'];
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
  // Arcade: a light page with a bright gradient header; `pops` are the confetti-bright colours for boxes, slots and tiles
  'candy':    { category: 'arcade', label: 'Candy',    bg: '#FFF4FA', surface: '#FFFFFF', text: '#2B1640', muted: '#6B5480', accent: '#FFC93C', accentText: '#3A2400', border: '#F3D3E6', rim: '#7B3FF2', rimText: '#FFFFFF', grad: ['#F0347A', '#7B3FF2'] },
  'ocean':    { category: 'arcade', label: 'Ocean',    bg: '#F0F8FF', surface: '#FFFFFF', text: '#0B2545', muted: '#4A6280', accent: '#FFC93C', accentText: '#3A2400', border: '#CFE4F7', rim: '#2350D8', rimText: '#FFFFFF', grad: ['#0B8FD6', '#2350D8'] },
  'sunshine': { category: 'arcade', label: 'Sunshine', bg: '#FFF8EC', surface: '#FFFFFF', text: '#3A1A0A', muted: '#7A5440', accent: '#FFE066', accentText: '#3A1A0A', border: '#F6DFC2', rim: '#D92B57', rimText: '#FFFFFF', grad: ['#EE7314', '#D92B57'] },
  'lime':     { category: 'arcade', label: 'Lime',     bg: '#F1FFF7', surface: '#FFFFFF', text: '#08321F', muted: '#3F6B57', accent: '#7B3FF2', accentText: '#FFFFFF', border: '#CDEBDC', rim: '#0B6E4C', rimText: '#FFFFFF', grad: ['#169E6E', '#0B6E4C'] },
  'casino-purple': { label: 'Casino purple', bg: '#14081F', surface: '#1F0F33', text: '#FFFFFF', muted: '#C4B5FD', accent: '#6B21D8', accentText: '#FFFFFF', border: '#8C6D1F', slices: ['#2A1347', '#1F0F33'], wheel: ['#6D28D9', '#141414', '#8B5CF6', '#2A2A2A'], rim: '#D6B24A', rimText: '#1f1a0a', marquee: 'gold', locked: true },
};

// polished-metal fills for headline text, by the theme's `marquee` metal
// bright pieces for arcade games (gift boxes, Plinko slots, scratch tiles), each with a readable label colour
export const POPS = [
  { bg: '#FF4D8D', fg: '#2B1640' }, { bg: '#FFC93C', fg: '#3A2400' }, { bg: '#3DDC97', fg: '#08321F' },
  { bg: '#1FB6FF', fg: '#0B2545' }, { bg: '#7B3FF2', fg: '#FFFFFF' }, { bg: '#FF8A3D', fg: '#3A1A0A' },
];
export const themeCategory = (key) => THEMES[key]?.category || 'casino';

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

// ---- "Match my website" colours for arcade games: one or two brand colours become the banner gradient, with
// readable shades worked out automatically (outlines dark enough on white, banner text dark if the colour is light)
const HEX = /^#[0-9a-f]{6}$/i;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mixHex = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return hexOf(x.map((v, i) => v + (y[i] - v) * t)); };
export const luminance = (h) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = rgbOf(h).map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const darkenTo = (h, against, min) => { let c = h; for (let k = 0; k < 20 && contrast(c, against) < min; k++) c = mixHex(c, '#000000', 0.12); return c; };
export const isHex = (v) => HEX.test(String(v || ''));
export function siteTheme(th, colors) {
  const main = colors.main.toLowerCase();
  const second = isHex(colors.second) ? colors.second.toLowerCase() : mixHex(main, '#000000', 0.28);
  const ink = '#1f1a2e';
  // white text on the banner when it reads well enough on both ends of the gradient, otherwise dark text
  const onGrad = Math.min(contrast('#ffffff', main), contrast('#ffffff', second)) >= 2.6 ? '#ffffff' : ink;
  // game pieces (wheel slices, gift boxes, Plinko slots): shades of the two colours, each with a readable label colour
  const pops = [main, mixHex(second, '#ffffff', 0.55), second, mixHex(main, '#ffffff', 0.55), mixHex(main, '#000000', 0.3), mixHex(second, '#ffffff', 0.3)]
    .map((bg) => ({ bg, fg: contrast(bg, '#ffffff') >= 4.5 ? '#ffffff' : ink }));
  return { ...th, label: 'My website colours', grad: [main, second], onGrad, pops,
    rim: darkenTo(second, '#ffffff', 4.5), bg: mixHex(main, '#ffffff', 0.94), border: mixHex(main, '#ffffff', 0.8), text: ink, muted: '#5b5670' };
}
// the theme a game actually shows: its palette, or its website colours when an arcade game is set to match them
export function gameTheme(game) {
  const th = themeFor(game.type, game.theme);
  const c = game.texts?.colors;
  return categoryOf(game.type) === 'arcade' && c?.mode === 'site' && isHex(c.main) ? siteTheme(th, c) : th;
}

export function themeFor(type, themeKey) {
  const g = GAME_TYPES[type] || {};
  const ok = (k) => THEMES[k] && themeCategory(k) === (g.category || 'casino');
  return THEMES[g.fixedTheme] || (ok(themeKey) && THEMES[themeKey]) || THEMES[g.defaultTheme] || THEMES[DEFAULT_THEME];
}

// Strings shown by the widget and in emails. Anything per-game is editable in the dashboard;
// these are the defaults and the UI chrome.
export const UI = {
  en: {
    play: 'Play & Win', emailLabel: 'Your email', emailPlaceholder: 'you@example.com',
    start: 'Play now', sending: 'Please wait…', invalidEmail: 'Please enter a valid email address.',
    spin: 'SPIN', spinning: 'Spinning…', yourReward: 'You won!', yourRewards: 'You won!', congrats: 'Congratulations!',
    code: 'Your code', copy: 'Copy', copied: 'Copied!',
    limited: 'Claim it soon: this offer is only available for a very limited time.', close: 'Close', soundOn: 'Turn sound on', soundOff: 'Turn sound off',
    redeem: 'Enter this code in your cart to apply your reward.', spinHeading: 'Spin your reward',
    lose: { title: 'Not this time', retry: 'Try again on', promo: 'In the meantime, keep an eye on your inbox. We send new promotions every week.', cont: 'Continue', slice: 'Try again' },
    noMatch: 'No match',
    choose: 'Choose your game', gateHeading: 'Enter to play', otherGames: 'Other games', matchThree: 'Match three to win',
    already: 'You already played this week using', onePer: 'You can only play once per email each week.', comeBack: 'Come back on', orOther: ', or use a different email', error: 'Something went wrong. Please try again.',
    paused: 'This game is not available right now.',
    hit: 'Hit', stand: 'Stand', dealer: 'Dealer', you: 'You', bust: 'Bust!',
    bjResult: { blackjack: 'Blackjack!', win: 'You win!', push: 'Push', loss: 'Dealer wins' }, bjNext: 'Spin for your reward',
    color: { roll: 'ROLL THE DICE', rolling: 'Rolling…', board: 'Match two or three dice to win that prize', match: 'Your colour!', noMatch: 'No match this time' },
    l9: { draw: 'Draw', stand: 'Stand', banker: 'Banker', you: 'You', natural: 'Natural 9!', win: 'You win!', bankerWins: 'Banker wins', closest: 'Closest to 9 wins' },
    bac: { pick: 'Place your bet', player: 'Player', banker: 'Banker', tie: 'Tie', wins: { player: 'Player wins!', banker: 'Banker wins!', tie: 'It’s a tie!' }, yourBet: 'Your bet wins!', betLoses: 'Your bet loses.' },
    scratch: { title: 'Match 3 to win!', hint: 'Scratch the silver to reveal your prizes', auto: 'Scratch it for me', win: 'Three of a kind!', lose: 'No match this time' },
    gifts: { pick: 'Pick a box!', hint: 'One of these boxes is yours. Which one?', win: 'Surprise!', lose: 'Empty! So close…', others: 'The other boxes had' },
    plinko: { drop: 'DROP THE BALL', dropping: 'Bouncing…', hint: 'Where the ball lands is what you win', key: 'Prizes', lose: 'Try again' },
    poker: { deal: 'DEAL', dealing: 'Dealing…', paytable: 'Paytable', hands: { high: 'No winning hand', pair: 'Pair', two_pair: 'Two Pair', three: 'Three of a Kind', straight: 'Straight', flush: 'Flush', full_house: 'Full House', four: 'Four of a Kind', straight_flush: 'Straight Flush' } },
  },
  fr: {
    play: 'Jouer et gagner', emailLabel: 'Votre courriel', emailPlaceholder: 'vous@exemple.com',
    start: 'Jouer', sending: 'Veuillez patienter…', invalidEmail: 'Veuillez entrer une adresse courriel valide.',
    spin: 'TOURNER', spinning: 'Rotation…', yourReward: 'Vous avez gagné!', yourRewards: 'Vous avez gagné!', congrats: 'Félicitations!',
    code: 'Votre code', copy: 'Copier', copied: 'Copié!',
    limited: 'Profitez-en vite : cette offre n’est disponible que pour une durée très limitée.', close: 'Fermer', soundOn: 'Activer le son', soundOff: 'Couper le son',
    redeem: 'Entrez ce code dans votre panier pour appliquer votre récompense.', spinHeading: 'Tournez pour votre récompense',
    lose: { title: 'Pas cette fois', retry: 'Réessayez le', promo: 'D’ici là, surveillez votre boîte de réception. Nous envoyons de nouvelles promotions chaque semaine.', cont: 'Continuer', slice: 'Réessayez' },
    noMatch: 'Pas de correspondance',
    choose: 'Choisissez votre jeu', gateHeading: 'Entrez pour jouer', otherGames: 'Autres jeux', matchThree: 'Alignez-en trois pour gagner',
    already: 'Vous avez déjà joué cette semaine avec', onePer: 'Chaque adresse courriel ne peut jouer qu’une fois par semaine.', comeBack: 'Revenez le', orOther: ' ou utilisez une autre adresse courriel', error: 'Une erreur est survenue. Veuillez réessayer.',
    paused: "Ce jeu n'est pas disponible pour le moment.",
    hit: 'Carte', stand: 'Rester', dealer: 'Croupier', you: 'Vous', bust: 'Dépassé!',
    bjResult: { blackjack: 'Blackjack!', win: 'Vous gagnez!', push: 'Égalité', loss: 'Le croupier gagne' }, bjNext: 'Tourner pour ma récompense',
    color: { roll: 'LANCER LES DÉS', rolling: 'Lancer…', board: 'Deux ou trois dés de la même couleur gagnent ce prix', match: 'Votre couleur!', noMatch: 'Pas de correspondance' },
    l9: { draw: 'Tirer', stand: 'Rester', banker: 'Banquier', you: 'Vous', natural: '9 naturel!', win: 'Vous gagnez!', bankerWins: 'Le banquier gagne', closest: 'Le plus proche de 9 gagne' },
    bac: { pick: 'Placez votre mise', player: 'Joueur', banker: 'Banquier', tie: 'Égalité', wins: { player: 'Le joueur gagne!', banker: 'Le banquier gagne!', tie: 'Égalité!' }, yourBet: 'Votre mise gagne!', betLoses: 'Votre mise perd.' },
    scratch: { title: 'Trois pareils pour gagner!', hint: 'Grattez l’argent pour découvrir vos prix', auto: 'Gratter pour moi', win: 'Trois pareils!', lose: 'Pas de correspondance cette fois' },
    gifts: { pick: 'Choisissez une boîte!', hint: 'Une de ces boîtes est pour vous. Laquelle?', win: 'Surprise!', lose: 'Vide! Presque…', others: 'Les autres boîtes contenaient' },
    plinko: { drop: 'LÂCHER LA BILLE', dropping: 'Ça rebondit…', hint: 'Là où la bille tombe, c’est ce que vous gagnez', key: 'Prix', lose: 'Réessayez' },
    poker: { deal: 'DISTRIBUER', dealing: 'Distribution…', paytable: 'Table des gains', hands: { high: 'Aucune main gagnante', pair: 'Paire', two_pair: 'Deux paires', three: 'Brelan', straight: 'Quinte', flush: 'Couleur', full_house: 'Main pleine', four: 'Carré', straight_flush: 'Quinte flush' } },
  },
};

// Default copy for the "Play to Win" intro popup. Every field is editable per game in the dashboard.
export const INTRO_DEFAULTS = {
  en: {
    heading: 'Play to Win!',
    description: 'Play a quick game for a chance to win exclusive discount codes, free gifts and other exciting rewards.',
    steps: ['Enter your email address', 'Play the game', 'Get your reward code instantly'],
    note: 'Rewards are only available for a very limited time. One play per email each week.',
    playLabel: 'Play now', declineLabel: 'No thanks',
  },
  fr: {
    heading: 'Jouez pour gagner!',
    description: 'Jouez à un jeu rapide pour courir la chance de gagner des codes de réduction exclusifs, des cadeaux gratuits et d’autres récompenses intéressantes.',
    steps: ['Entrez votre adresse courriel', 'Jouez au jeu', 'Recevez votre code tout de suite'],
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

// Game sounds, made live with the Web Audio API: no audio files, nothing to license, nothing to download.
// Effects (wheel ticks, card swishes, chips, reels, dice, scratching, gift boxes, Plinko pegs, fanfares) and two
// built-in loops: lounge jazz for casino games, a bouncy tune for arcade games.
// A game can swap the loop for its own music file (texts.sound.musicUrl). The visitor's mute choice is remembered.

const KEY = 'pg_sound';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
let muted = read() === 'off';
let ctx = null, out = null, fxBus = null, musicBus = null, noiseBuf = null;
let cfg = { sfx: true, music: 'builtin', musicUrl: '', style: 'casino' };
let musicOn = false, track = null, el = null;
const subs = new Set();

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  out = ctx.createDynamicsCompressor(); out.threshold.value = -14; out.ratio.value = 4; out.connect(ctx.destination);
  fxBus = ctx.createGain(); fxBus.gain.value = 1.1; fxBus.connect(out);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(out);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ctx.suspend(); el?.pause(); } else if (musicOn || !muted) { ctx.resume(); if (musicOn && !muted) el?.play().catch(() => {}); }
  });
  return ctx;
}
const fxOk = () => !muted && cfg.sfx !== false && init() && ctx.state !== 'closed';

// ---- building blocks
function tone({ f, f2, type = 'sine', at = 0, a = 0.004, d = 0.2, v = 0.2, dest = fxBus, lp }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  let node = o;
  if (lp) { const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = lp; o.connect(flt); node = flt; }
  node.connect(g); g.connect(dest); o.start(t); o.stop(t + a + d + 0.05);
}
function noise({ at = 0, a = 0.003, d = 0.1, v = 0.2, type = 'bandpass', f = 2000, f2, q = 1, dest = fxBus }) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, t);
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  s.connect(flt); flt.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
}
const jitter = (x, p = 0.06) => x * (1 + (Math.random() - 0.5) * p);
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// ---- effects
const FX = {
  // a card sliding off the deck
  card() { noise({ d: 0.16, v: 0.32, f: jitter(3200), f2: 900, q: 0.7, a: 0.012 }); noise({ at: 0.13, d: 0.05, v: 0.18, type: 'lowpass', f: 500 }); },
  // a card turned face up
  flip() { noise({ d: 0.04, v: 0.22, type: 'highpass', f: 2500 }); tone({ f: jitter(900), type: 'triangle', d: 0.03, v: 0.06 }); },
  // a peg passing the wheel's pointer
  tick() { tone({ f: jitter(1500, 0.15), type: 'triangle', d: 0.03, v: 0.16 }); noise({ d: 0.015, v: 0.12, type: 'highpass', f: 4500 }); },
  // casino chips clinking
  chip() { [0, 0.07].forEach((at, k) => [2380, 3510, 4860].forEach((f) => tone({ f: jitter(f, 0.04), at, a: 0.001, d: 0.16, v: k ? 0.035 : 0.05 }))); noise({ d: 0.03, v: 0.1, type: 'highpass', f: 5000 }); },
  // slot lever: ratchet then a heavy clunk
  lever() { for (let i = 0; i < 5; i++) noise({ at: i * 0.045, d: 0.02, v: 0.18, f: 2600, q: 3 }); tone({ f: 140, f2: 55, at: 0.24, d: 0.22, v: 0.45 }); noise({ at: 0.24, d: 0.06, v: 0.2, type: 'lowpass', f: 700 }); },
  // one reel locking into place
  reelStop() { tone({ f: 190, f2: 80, d: 0.12, v: 0.4 }); noise({ d: 0.04, v: 0.22, f: 1800, q: 2 }); },
  // a die landing
  diceStop() { tone({ f: 160, f2: 70, d: 0.09, v: 0.35 }); noise({ d: 0.03, v: 0.2, f: 2400, q: 1.5 }); },
  // a bright bell: the wheel landing
  ding() { [1568, 2352, 3136].forEach((f, i) => tone({ f, a: 0.002, d: 0.9 - i * 0.2, v: 0.12 / (i + 1) })); },
  // a hand won: quick rising arpeggio
  win() { [72, 76, 79, 84].forEach((m, i) => { tone({ f: hz(m), type: 'triangle', at: i * 0.085, d: 0.32, v: 0.16 }); tone({ f: hz(m + 12), at: i * 0.085, d: 0.2, v: 0.04 }); }); },
  // a gentle "not this time": two falling notes
  lose() { tone({ f: hz(67), f2: hz(66), type: 'triangle', d: 0.32, v: 0.14, lp: 1800 }); tone({ f: hz(63), f2: hz(58), type: 'triangle', at: 0.3, d: 0.6, v: 0.13, lp: 1500 }); },
  // congratulations: brassy fanfare, a held chord and sparkles
  congrats() {
    duck(2.6);
    noise({ d: 0.12, v: 0.3, f: 1400, q: 0.6 });                                   // confetti pop
    [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36]].forEach(([m, at]) => tone({ f: hz(m), type: 'sawtooth', at, d: 0.2, v: 0.09, lp: 2600 }));
    [72, 76, 79, 84].forEach((m) => { tone({ f: hz(m), type: 'sawtooth', at: 0.5, a: 0.02, d: 1.3, v: 0.06, lp: 2200 }); tone({ f: hz(m), type: 'triangle', at: 0.5, a: 0.02, d: 1.4, v: 0.06 }); });
    for (let i = 0; i < 16; i++) tone({ f: 1800 + Math.random() * 2600, at: 0.55 + i * 0.08 + Math.random() * 0.05, a: 0.001, d: 0.25, v: 0.035 });
  },
};

// arcade effects
Object.assign(FX, {
  // a coin scraping the silver off a scratch card
  scratch() { noise({ d: 0.07, v: 0.1, f: jitter(3800, 0.3), q: 1.2, a: 0.01 }); },
  // a gift box rattling
  shake() { for (let i = 0; i < 6; i++) { noise({ at: i * 0.07, d: 0.04, v: 0.16, f: 900 + Math.random() * 700, q: 2 }); tone({ f: jitter(220, 0.2), type: 'triangle', at: i * 0.07, d: 0.05, v: 0.08 }); } },
  // the lid popping off
  pop() { tone({ f: 380, f2: 1100, type: 'sine', d: 0.09, v: 0.3 }); noise({ d: 0.05, v: 0.18, type: 'highpass', f: 2500 }); for (let i = 0; i < 8; i++) tone({ f: 1600 + Math.random() * 2400, at: 0.08 + i * 0.045, a: 0.001, d: 0.18, v: 0.035 }); },
  // the Plinko ball hitting a peg: a bright plink, a little higher as it falls
  peg(row = 0) { const m = 76 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)] + (row % 2 ? 12 : 0); tone({ f: hz(m), type: 'triangle', a: 0.002, d: 0.16, v: 0.13 }); tone({ f: hz(m + 19), a: 0.001, d: 0.06, v: 0.03 }); },
  // the ball dropping into its slot
  drop() { tone({ f: 260, f2: 120, d: 0.16, v: 0.35 }); noise({ d: 0.05, v: 0.14, type: 'lowpass', f: 900 }); },
  // a tap on a playful button
  boing() { tone({ f: 300, f2: 620, type: 'sine', d: 0.12, v: 0.18 }); },
});

// continuous sounds; each returns a stop function
const LOOPS = {
  // spinning reels: a fast clatter
  reels() { let i = 0; const id = setInterval(() => { if (fxOk()) { tone({ f: jitter(1100, 0.2), type: 'square', d: 0.018, v: 0.035, lp: 2500 }); if (i++ % 2) noise({ d: 0.03, v: 0.05, f: 900, q: 1 }); } }, 55); return () => clearInterval(id); },
  // dice rattling in a cup
  dice() { let alive = true; const go = () => { if (!alive) return; if (fxOk()) noise({ d: 0.025, v: 0.16 + Math.random() * 0.1, f: 1500 + Math.random() * 2000, q: 2 }); setTimeout(go, 35 + Math.random() * 70); }; go(); return () => { alive = false; }; },
};

function duck(sec) {
  if (!ctx || !musicBus) return;
  const t = ctx.currentTime, g = musicBus.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.1, t + 0.15); g.linearRampToValueAtTime(0.32, t + sec);
}

// ---- built-in music: a laid-back lounge-jazz loop (Rhodes chords, walking bass, brushed ride, sparse vibes)
const BPM = 96, BEAT = 60 / BPM, SW = (2 / 3) * BEAT;   // swung eighth: the "and" lands two-thirds through the beat
const SONG = [
  { root: 38, chord: [53, 57, 60, 64], scale: [62, 64, 65, 67, 69, 72, 74] },   // Dm9
  { root: 43, chord: [53, 59, 64, 69], scale: [62, 64, 65, 67, 71, 74, 76] },   // G13
  { root: 36, chord: [52, 55, 59, 62], scale: [60, 62, 64, 67, 69, 71, 72] },   // Cmaj9
  { root: 45, chord: [55, 61, 64, 70], scale: [61, 64, 67, 69, 70, 73, 76] },   // A7b9
  { root: 38, chord: [53, 57, 60, 64], scale: [62, 64, 65, 69, 72, 74, 77] },   // Dm9
  { root: 43, chord: [53, 59, 62, 65], scale: [62, 65, 67, 71, 74, 77, 79] },   // G7
  { root: 40, chord: [50, 55, 59, 62], scale: [64, 67, 69, 71, 74, 76, 79] },   // Em7
  { root: 45, chord: [55, 61, 64, 67], scale: [61, 64, 67, 69, 73, 76, 79] },   // A7
];
function rhodes(m, t, d, v) {
  [[1, v], [2, v * 0.18], [3.01, v * 0.05]].forEach(([mul, vol]) => {
    const o = ctx.createOscillator(); o.frequency.value = hz(m) * mul;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + d + 0.05);
  });
}
function bass(m, t) {
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.025); g.gain.exponentialRampToValueAtTime(0.045, t + BEAT * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.98);
  o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + BEAT);
}
function ride(t, v) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random() * 0.5); s.stop(t + 0.2);
}
function vibes(m, t) {
  [[1, 0.1], [4, 0.012]].forEach(([mul, vol]) => {
    const o = ctx.createOscillator(); o.frequency.value = hz(m) * mul;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 1.2);
  });
}
function playBar(bar, t) {
  const c = SONG[bar % SONG.length], next = SONG[(bar + 1) % SONG.length];
  // walking bass: root, chord tone, fifth, chromatic approach to the next root
  [c.root, c.root + (bar % 2 ? 4 : 3), c.root + 7, next.root + (Math.random() < 0.5 ? 1 : -1)].forEach((m, i) => bass(m, t + i * BEAT));
  // Rhodes comping: on 1, and a short push on the "and" of 2
  c.chord.forEach((m) => rhodes(m, t + 0.01, BEAT * 1.6, 0.06));
  c.chord.forEach((m) => rhodes(m, t + BEAT + SW, BEAT * 0.8, 0.04));
  if (bar % 2) c.chord.forEach((m) => rhodes(m, t + 3 * BEAT + SW, BEAT * 0.6, 0.035));
  // ride: ding, ding-a, ding, ding-a
  [0, 1, 1 + 2 / 3, 2, 3, 3 + 2 / 3].forEach((b, i) => ride(t + b * BEAT, i % 3 === 0 ? 0.09 : 0.06));
  // vibes: a few notes from the bar's scale, with rests
  let at = Math.floor(Math.random() * 2) * BEAT, prev = 3;
  while (at < 4 * BEAT - 0.1) {
    if (Math.random() < 0.55) { prev = Math.max(0, Math.min(c.scale.length - 1, prev + Math.round((Math.random() - 0.5) * 4))); vibes(c.scale[prev], t + at); }
    at += Math.random() < 0.6 ? SW : BEAT;
  }
}
// ---- built-in arcade music: a sunny, bouncy loop (I-V-vi-IV), marimba chords, hopping bass, claps and a hook
const ABPM = 128, AB = 60 / ABPM;
const ASONG = [
  { root: 48, chord: [60, 64, 67], hook: [72, 76, 79, 76, 74, 72, 74, 76] },   // C
  { root: 43, chord: [59, 62, 67], hook: [74, 79, 78, 79, 74, 71, 74, 79] },   // G
  { root: 45, chord: [60, 64, 69], hook: [76, 72, 69, 72, 76, 79, 76, 72] },   // Am
  { root: 41, chord: [60, 65, 69], hook: [77, 76, 74, 72, 74, 72, 69, 72] },   // F
];
function marimba(m, t, v, d = 0.35) {
  [[1, v], [4, v * 0.25], [10, v * 0.05]].forEach(([mul, vol]) => {
    const o = ctx.createOscillator(); o.frequency.value = hz(m) * mul;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d / mul ** 0.3);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + d + 0.05);
  });
}
function hop(m, t) {
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz(m);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(250, t + 0.18);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + AB * 0.45);
  o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + AB * 0.5);
}
function hit(t, f, q, v, d) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(flt); flt.connect(g); g.connect(musicBus); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
}
function playArcadeBar(bar, t) {
  const c = ASONG[bar % ASONG.length];
  // bass hops root / octave on the eighths
  for (let i = 0; i < 8; i++) hop(c.root + (i % 2 ? 12 : 0), t + i * AB / 2);
  // marimba chords on the off-beats
  [0.5, 1.5, 2.5, 3.5].forEach((b) => c.chord.forEach((m) => marimba(m, t + b * AB, 0.035, 0.25)));
  // claps on 2 and 4, shaker on every eighth
  [1, 3].forEach((b) => { hit(t + b * AB, 1500, 0.8, 0.12, 0.12); hit(t + b * AB + 0.012, 2200, 1, 0.06, 0.08); });
  for (let i = 0; i < 8; i++) hit(t + i * AB / 2, 8000, 0.7, i % 2 ? 0.03 : 0.018, 0.04);
  // the hook: on bars 3-4 of every 8, a few notes dropped so it breathes
  const lead = Math.floor(bar / 4) % 2 === 1;
  c.hook.forEach((m, i) => { if (lead || i % 2 === 0 || Math.random() < 0.3) marimba(m, t + i * AB / 2, lead ? 0.07 : 0.05, 0.4); });
}
function builtinTrack(style) {
  const arcade = style === 'arcade';
  const len = arcade ? 4 * AB : 4 * BEAT, play = arcade ? playArcadeBar : playBar;
  let bar = 0, next = ctx.currentTime + 0.1, stopped = false;
  const tick = () => { if (stopped) return; while (next < ctx.currentTime + 0.6) { play(bar++, next); next += len; } };
  tick(); const id = setInterval(tick, 200);
  return () => { stopped = true; clearInterval(id); };
}

function applyMusic() {
  const want = musicOn && !muted && cfg.music !== 'off';
  const custom = cfg.music === 'custom' && cfg.musicUrl;
  if (!want) { track?.(); track = null; el?.pause(); return; }
  if (custom) {
    track?.(); track = null;
    if (!el || el.dataset.src !== cfg.musicUrl) { el?.pause(); el = new Audio(cfg.musicUrl); el.dataset.src = cfg.musicUrl; el.loop = true; el.volume = 0.35; }
    el.play().catch(() => {});
  } else {
    el?.pause();
    if (!track && init()) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(0.0001, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 1.5); track = builtinTrack(cfg.style); }
  }
}

export const sound = {
  // call from a click/tap: browsers only allow audio after the visitor interacts
  unlock() { if (init() && ctx.state === 'suspended') ctx.resume(); },
  // `style` picks the built-in loop: 'casino' (lounge jazz) or 'arcade' (bouncy)
  configure(s = {}, style = 'casino') {
    const was = cfg; cfg = { sfx: s.sfx !== false, music: ['off', 'custom'].includes(s.music) ? s.music : 'builtin', musicUrl: s.musicUrl || '', style };
    if (was.music !== cfg.music || was.musicUrl !== cfg.musicUrl || was.style !== cfg.style) { track?.(); track = null; applyMusic(); }
  },
  play(name, ...args) { try { if (fxOk() && FX[name]) FX[name](...args); } catch { /* sound is never worth an error */ } },
  loop(name) { try { return LOOPS[name] ? LOOPS[name]() : () => {}; } catch { return () => {}; } },
  music(on) { musicOn = on; applyMusic(); },
  muted: () => muted,
  setMuted(m) { muted = m; try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch {} if (!m) this.unlock(); applyMusic(); subs.forEach((f) => f(m)); },
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
};

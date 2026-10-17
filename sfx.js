// sfx.js — every sound effect, synthesised. Call sfx('hit'), sfx('mobAttack', 'bite'), etc.
// Add a new sound by adding a function to SOUNDS.

import { ctx, note, noiseBurst, mtof, audioRunning } from './audio.js';
import { settings } from './state.js';

const rnd = (a, b) => a + Math.random() * (b - a);

const SOUNDS = {
  // ---- interface ----
  blip(t) { note({ type: 'square', f: 660, f2: 880, t, dur: 0.05, vol: 0.1, r: 0.03 }); },
  text(t) { note({ type: 'square', f: rnd(330, 480), t, dur: 0.02, vol: 0.03, a: 0.002, d: 0.01, r: 0.01 }); },
  select(t) {
    note({ type: 'square', f: 523, t, dur: 0.06, vol: 0.11, r: 0.03 });
    note({ type: 'square', f: 784, t: t + 0.07, dur: 0.1, vol: 0.11, r: 0.06 });
  },
  back(t) {
    note({ type: 'square', f: 523, t, dur: 0.06, vol: 0.1, r: 0.03 });
    note({ type: 'square', f: 330, t: t + 0.07, dur: 0.1, vol: 0.1, r: 0.06 });
  },
  menu(t) { note({ type: 'triangle', f: 440, f2: 700, t, dur: 0.09, vol: 0.16, r: 0.05 }); },
  save(t) {
    note({ type: 'triangle', f: 880, t, dur: 0.09, vol: 0.18, r: 0.08, send: 0.3 });
    note({ type: 'triangle', f: 1318, t: t + 0.1, dur: 0.22, vol: 0.18, r: 0.2, send: 0.4 });
  },
  read(t) {
    note({ type: 'triangle', f: 500, t, dur: 0.05, vol: 0.14 });
    note({ type: 'triangle', f: 650, t: t + 0.06, dur: 0.07, vol: 0.14 });
  },

  // ---- exploring ----
  step(t) { noiseBurst({ t, dur: 0.05, vol: 0.05, f: rnd(1700, 2400), q: 0.8 }); },
  stepTall(t) {
    noiseBurst({ t, dur: 0.12, vol: 0.1, f: rnd(2600, 3200), f2: 1100, q: 0.7 });
    noiseBurst({ t: t + 0.055, dur: 0.08, vol: 0.05, f: 3400, f2: 1800, q: 0.7 });
  },
  bump(t) { note({ type: 'triangle', f: 120, f2: 70, t, dur: 0.07, vol: 0.14, r: 0.04 }); },
  rest(t) {
    const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
    scale.forEach((m, i) => {
      note({ type: 'triangle', f: mtof(m), t: t + i * 0.09, dur: 0.12, vol: 0.14, s: 0.2, d: 0.2, r: 0.5, send: 0.55 });
      note({ type: 'sine', f: mtof(m + 12), t: t + i * 0.09, dur: 0.05, vol: 0.04, r: 0.3, send: 0.5 });
    });
  },
  crackle(t) {
    for (let i = 0; i < 9; i++) {
      noiseBurst({ t: t + rnd(0, 1.6), dur: rnd(0.012, 0.04), vol: rnd(0.03, 0.08), type: 'highpass', f: rnd(2500, 5500), q: 0.5 });
    }
  },

  // ---- battle start ----
  encounter(t) {
    for (let i = 0; i < 11; i++) {
      note({ type: 'square', f: 300 * Math.pow(2, i / 6), t: t + i * 0.045, dur: 0.05, vol: 0.1, r: 0.02 });
    }
    noiseBurst({ t, dur: 0.55, vol: 0.12, type: 'highpass', f: 1500, f2: 6000, q: 0.4 });
    note({ type: 'sine', f: 90, f2: 35, t: t + 0.5, dur: 0.5, vol: 0.4, r: 0.1 });
    note({ type: 'square', f: 988, t: t + 0.52, dur: 0.07, vol: 0.12, r: 0.04 });
    note({ type: 'square', f: 1318, t: t + 0.6, dur: 0.12, vol: 0.12, r: 0.08 });
  },

  // ---- dice ----
  diceRoll(t) {
    const clicks = 13;
    for (let i = 0; i < clicks; i++) {
      const at = t + 1.0 * Math.pow(i / clicks, 0.68);
      noiseBurst({ t: at, dur: 0.028, vol: 0.12 - i * 0.005, type: 'highpass', f: rnd(2500, 5200), q: 0.6 });
      note({ type: 'triangle', f: rnd(600, 1300), t: at, dur: 0.03, vol: 0.05, r: 0.02 });
    }
  },
  diceLand(t) {
    note({ type: 'sine', f: 150, f2: 58, t, dur: 0.12, vol: 0.26, r: 0.06 });
    noiseBurst({ t, dur: 0.07, vol: 0.18, type: 'lowpass', f: 1400, f2: 300 });
    note({ type: 'triangle', f: 1100, t: t + 0.02, dur: 0.04, vol: 0.06 });
  },

  // ---- attacks ----
  swing(t) { noiseBurst({ t, dur: 0.2, vol: 0.2, f: 500, f2: 2600, q: 2.2 }); },
  hit(t) {
    noiseBurst({ t, dur: 0.15, vol: 0.34, type: 'lowpass', f: 2200, f2: 220 });
    note({ type: 'sine', f: 210, f2: 50, t, dur: 0.17, vol: 0.4, r: 0.05 });
    note({ type: 'square', f: 330, f2: 110, t, dur: 0.07, vol: 0.09, r: 0.03 });
  },
  crit(t) {
    SOUNDS.hit(t);
    noiseBurst({ t, dur: 0.5, vol: 0.2, type: 'highpass', f: 3500, f2: 900, send: 0.4 });
    note({ type: 'sine', f: 95, f2: 28, t, dur: 0.55, vol: 0.5, r: 0.15 });
    [1568, 2093, 2637].forEach((f, i) => {
      note({ type: 'sine', f, t: t + 0.02 + i * 0.04, dur: 0.25, vol: 0.1, s: 0.3, d: 0.35, r: 0.6, send: 0.55 });
    });
  },
  miss(t) {
    noiseBurst({ t, dur: 0.24, vol: 0.1, f: 950, f2: 280, q: 1.2 });
    note({ type: 'triangle', f: 240, f2: 150, t: t + 0.12, dur: 0.16, vol: 0.06, r: 0.05 });
  },
  lucky(t) {
    [1046, 1318, 1760].forEach((f, i) => {
      note({ type: 'sine', f, t: t + i * 0.07, dur: 0.07, vol: 0.12, r: 0.25, send: 0.45 });
    });
  },
  mobAttack(t, kind = 'bite') {
    if (kind === 'squish') {
      note({ type: 'sine', f: 280, f2: 90, t, dur: 0.24, vol: 0.32, vibrato: 60, r: 0.08 });
      noiseBurst({ t: t + 0.1, dur: 0.12, vol: 0.12, type: 'lowpass', f: 900, f2: 200 });
    } else if (kind === 'spore') {
      noiseBurst({ t, dur: 0.36, vol: 0.22, f: 1100, f2: 2600, q: 1.1 });
      note({ type: 'sine', f: 300, f2: 180, t, dur: 0.3, vol: 0.12, vibrato: 30 });
    } else if (kind === 'club') {
      noiseBurst({ t, dur: 0.16, vol: 0.2, type: 'lowpass', f: 900, f2: 200 });
      note({ type: 'square', f: 160, f2: 60, t: t + 0.05, dur: 0.2, vol: 0.2, r: 0.05 });
    } else {
      noiseBurst({ t, dur: 0.06, vol: 0.22, f: 1900, q: 1.5 });
      noiseBurst({ t: t + 0.09, dur: 0.07, vol: 0.2, f: 1600, q: 1.5 });
      note({ type: 'sawtooth', f: 320, f2: 140, t, dur: 0.14, vol: 0.12, filter: { type: 'lowpass', freq: 900 } });
    }
  },
  hurt(t) {
    note({ type: 'sawtooth', f: 240, f2: 100, t, dur: 0.26, vol: 0.2, filter: { type: 'lowpass', freq: 1100 }, r: 0.08 });
    noiseBurst({ t, dur: 0.18, vol: 0.2, type: 'lowpass', f: 1600, f2: 200 });
  },
  enemyDown(t) {
    noiseBurst({ t, dur: 0.7, vol: 0.26, type: 'lowpass', f: 3200, f2: 160 });
    note({ type: 'sine', f: 620, f2: 60, t, dur: 0.55, vol: 0.22, r: 0.1 });
    [1318, 1760, 2349].forEach((f, i) => {
      note({ type: 'sine', f, t: t + 0.25 + i * 0.07, dur: 0.06, vol: 0.09, r: 0.3, send: 0.5 });
    });
  },
  levelup(t) {
    const run = [72, 76, 79, 84, 88, 91, 96];
    run.forEach((m, i) => {
      note({ type: 'square', f: mtof(m), t: t + i * 0.075, dur: 0.1, vol: 0.1, r: 0.12, send: 0.35 });
      note({ type: 'triangle', f: mtof(m - 12), t: t + i * 0.075, dur: 0.12, vol: 0.12, r: 0.2 });
    });
    [96, 100, 103].forEach((m) => note({ type: 'sine', f: mtof(m), t: t + 0.6, dur: 0.5, vol: 0.07, s: 0.3, r: 0.9, send: 0.6 }));
  },

  // ---- cutscene ----
  fall(t) {
    note({ type: 'sine', f: 2400, f2: 180, t, dur: 2.4, vol: 0.12, s: 1, d: 2.4, r: 0.2, send: 0.2 });
    noiseBurst({ t, dur: 2.4, vol: 0.18, type: 'bandpass', f: 400, f2: 3800, q: 0.6, a: 1.2 });
  },
  rumble(t) {
    noiseBurst({ t, dur: 2.2, vol: 0.4, type: 'lowpass', f: 140, f2: 70, q: 0.5, a: 0.8 });
    note({ type: 'sine', f: 42, t, dur: 2.2, vol: 0.34, a: 0.8, r: 0.5 });
  },
  crack(t) {
    noiseBurst({ t, dur: 0.07, vol: 0.3, type: 'highpass', f: 3000, q: 0.5 });
    note({ type: 'triangle', f: rnd(1800, 2800), f2: 600, t, dur: 0.12, vol: 0.08, send: 0.4 });
  },
  shatter(t) {
    noiseBurst({ t, dur: 1.9, vol: 0.4, type: 'highpass', f: 4500, f2: 700, q: 0.4, send: 0.6 });
    noiseBurst({ t, dur: 1.7, vol: 0.5, type: 'lowpass', f: 900, f2: 70, q: 0.5 });
    note({ type: 'sine', f: 75, f2: 24, t, dur: 1.5, vol: 0.65, r: 0.3 });
    for (let i = 0; i < 18; i++) {
      note({ type: 'sine', f: rnd(1800, 5200), t: t + rnd(0.05, 1.5), dur: 0.12, vol: rnd(0.03, 0.08), s: 0.2, r: 0.35, send: 0.6 });
    }
  },
  dawn(t) {
    [48, 55, 60, 64, 67, 72].forEach((m, i) => {
      note({ type: 'sawtooth', f: mtof(m), t: t + i * 0.12, dur: 2.6, vol: 0.05, a: 1.4, d: 0.5, s: 0.9, r: 1.6, send: 0.6, filter: { type: 'lowpass', freq: 1200 } });
    });
  },
  chime(t, n = 0) {
    const m = [84, 88, 91, 96][n % 4];
    note({ type: 'sine', f: mtof(m), t, dur: 0.1, vol: 0.12, s: 0.2, d: 0.6, r: 0.9, send: 0.7 });
  },
};

export function sfx(name, arg) {
  if (!settings.sfx || !ctx || !audioRunning()) return;
  const fn = SOUNDS[name];
  if (!fn) return;
  try {
    fn(ctx.currentTime + 0.012, arg);
  } catch (e) {
    console.warn('sfx failed', name, e);
  }
}

export const SFX_NAMES = Object.keys(SOUNDS);

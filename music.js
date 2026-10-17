// music.js — a tiny tracker. Songs are built from a few helpers (chord progressions → bass / arp / pad
// lines, plus hand-written melodies) and played by a look-ahead scheduler on the Web Audio clock.
//
// To add a song: write a progression + melody in SONGS, then playMusic('yourSong').
//   Notation:  "G4:4 B4:2 -:2"  = note name : length in 16th-note steps  ( - is a rest )
//   16 steps = one bar of 4/4.

import { ctx, note, noiseBurst, mtof, musicBus, pulseWave, audioRunning } from './audio.js';

// ───────────────────────── composition kit ─────────────────────────
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

function chordInfo(sym, oct) {
  const m = /^([A-G][#b]?)(m?)(7?)$/.exec(sym);
  if (!m) throw new Error(`bad chord: ${sym}`);
  const root = midi(m[1] + oct);
  const tones = [root, root + (m[2] ? 3 : 4), root + 7];
  if (m[3]) tones.push(root + 10);
  return { root, tones };
}

// "G4:4 B4:2 -:2" → events
export function mel(str) {
  const ev = [];
  let s = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [name, d = '1'] = tok.split(':');
    const dur = Number(d);
    if (name !== '-') ev.push({ s, d: dur, n: midi(name), v: 1 });
    s += dur;
  }
  return { ev, len: s };
}

// drum string: one character per 16th step.  k kick · s snare · h hat · o open hat · T tom · r rim · c shaker
function drums(str) {
  const ev = [];
  const chars = str.replace(/\s+/g, '');
  [...chars].forEach((c, s) => { if (c !== '.') ev.push({ s, d: 1, c }); });
  return { ev, len: chars.length };
}

const BASS = {
  oompah: [[0, 3, 0], [4, 3, 7], [8, 3, 0], [12, 3, 7]],
  half: [[0, 7, 0], [8, 4, 7], [12, 4, 12]],
  drive: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i * 2, 2, i % 4 === 2 ? 12 : 0]),
  whole: [[0, 16, 0]],
};
function bassLine(chords, style, oct = 2) {
  const ev = [];
  chords.forEach((c, b) => {
    const { root } = chordInfo(c, oct);
    BASS[style].forEach(([o, d, iv]) => ev.push({ s: b * 16 + o, d, n: root + iv, v: 1 }));
  });
  return { ev, len: chords.length * 16 };
}

const ARP = {
  eighths: [0, 1, 2, 3, 2, 1, 0, 1].map((idx, i) => [i * 2, 2, idx]),
  sixteenths: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1].map((idx, i) => [i, 1, idx]),
};
function arpLine(chords, style, oct = 4) {
  const ev = [];
  chords.forEach((c, b) => {
    const { tones } = chordInfo(c, oct);
    const ext = [tones[0], tones[1], tones[2], tones[0] + 12, tones[1] + 12, tones[2] + 12];
    ARP[style].forEach(([o, d, idx]) => ev.push({ s: b * 16 + o, d, n: ext[idx], v: 0.9 }));
  });
  return { ev, len: chords.length * 16 };
}

function padLine(chords, oct = 3) {
  const ev = [];
  chords.forEach((c, b) => {
    chordInfo(c, oct).tones.forEach((n) => ev.push({ s: b * 16, d: 16, n, v: 1 }));
  });
  return { ev, len: chords.length * 16 };
}

// A one-off chord (all tones at once) starting at step s, lasting d steps.
function chordAt(sym, oct, s, d) {
  return chordInfo(sym, oct).tones.map((n) => ({ s, d, n, v: 1 }));
}

const track = (inst, vol, pat) => ({ inst, vol, ev: pat.ev, len: pat.len });
const bars = (...b) => mel(b.join(' '));

// ───────────────────────── instruments ─────────────────────────
const INST = {
  lead(t, e, sd, vol, bus) {
    const dur = e.d * sd;
    note({ type: 'square', f: mtof(e.n), t, dur: dur * 0.92, vol: 0.12 * vol * e.v, a: 0.008, d: 0.07, s: 0.65, r: 0.08,
      dest: bus, send: 0.18, filter: { type: 'lowpass', freq: 3800 }, vibrato: dur > 0.4 ? 7 : 0 });
  },
  pulse(t, e, sd, vol, bus) {
    note({ wave: pulseWave(0.25), f: mtof(e.n), t, dur: e.d * sd * 0.8, vol: 0.075 * vol * e.v, a: 0.004, d: 0.05, s: 0.4, r: 0.04, dest: bus });
  },
  harp(t, e, sd, vol, bus) {
    const f = mtof(e.n);
    note({ type: 'triangle', f, t, dur: 0.06, vol: 0.2 * vol * e.v, a: 0.003, d: 0.28, s: 0.0001, r: 0.2, dest: bus, send: 0.3 });
    note({ type: 'sine', f: f * 2, t, dur: 0.04, vol: 0.05 * vol * e.v, a: 0.002, d: 0.15, s: 0.0001, r: 0.1, dest: bus, send: 0.3 });
  },
  bass(t, e, sd, vol, bus) {
    note({ type: 'triangle', f: mtof(e.n), t, dur: e.d * sd * 0.9, vol: 0.34 * vol * e.v, a: 0.005, d: 0.12, s: 0.6, r: 0.05, dest: bus });
  },
  bassSaw(t, e, sd, vol, bus) {
    note({ type: 'sawtooth', f: mtof(e.n), t, dur: e.d * sd * 0.8, vol: 0.17 * vol * e.v, a: 0.004, d: 0.08, s: 0.5, r: 0.03,
      dest: bus, filter: { type: 'lowpass', freq: 650, q: 1.2 } });
    note({ type: 'sine', f: mtof(e.n), t, dur: e.d * sd * 0.8, vol: 0.2 * vol * e.v, a: 0.004, d: 0.08, s: 0.6, r: 0.03, dest: bus });
  },
  pad(t, e, sd, vol, bus) {
    const dur = e.d * sd;
    [-7, 7].forEach((det) => {
      note({ type: 'sawtooth', f: mtof(e.n), t, dur, vol: 0.05 * vol, a: 0.45, d: 0.4, s: 0.9, r: 0.9, dest: bus, send: 0.45, detune: det,
        filter: { type: 'lowpass', freq: 1150 } });
    });
  },
  strings(t, e, sd, vol, bus) {
    const dur = e.d * sd;
    [-6, 6].forEach((det) => {
      note({ type: 'sawtooth', f: mtof(e.n), t, dur: dur * 0.97, vol: 0.075 * vol * e.v, a: 0.07, d: 0.2, s: 0.85, r: 0.25, dest: bus, send: 0.3,
        detune: det, filter: { type: 'lowpass', freq: 2300 }, vibrato: dur > 0.5 ? 9 : 0 });
    });
  },
  brass(t, e, sd, vol, bus) {
    const dur = e.d * sd;
    [-5, 5].forEach((det) => {
      note({ type: 'sawtooth', f: mtof(e.n), t, dur: dur * 0.95, vol: 0.09 * vol * e.v, a: 0.015, d: 0.1, s: 0.8, r: 0.15, dest: bus, send: 0.25,
        detune: det, filter: { type: 'lowpass', freq: 2600, freq2: 1800 } });
    });
  },
  bell(t, e, sd, vol, bus) {
    const f = mtof(e.n);
    note({ type: 'sine', f, t, dur: 0.1, vol: 0.14 * vol * e.v, a: 0.004, d: 1.2, s: 0.0001, r: 0.6, dest: bus, send: 0.75 });
    note({ type: 'sine', f: f * 2.76, t, dur: 0.05, vol: 0.04 * vol * e.v, a: 0.002, d: 0.4, s: 0.0001, r: 0.3, dest: bus, send: 0.6 });
    note({ type: 'triangle', f: f * 0.5, t, dur: 0.08, vol: 0.05 * vol * e.v, a: 0.004, d: 0.5, s: 0.0001, r: 0.3, dest: bus, send: 0.5 });
  },
  sub(t, e, sd, vol, bus) {
    note({ type: 'sine', f: mtof(e.n), t, dur: e.d * sd, vol: 0.2 * vol, a: 1.2, d: 1.0, s: 0.9, r: 1.5, dest: bus, send: 0.2 });
  },
  drums(t, e, sd, vol, bus) {
    const v = vol;
    switch (e.c) {
      case 'k': note({ type: 'sine', f: 150, f2: 45, t, dur: 0.13, vol: 0.5 * v, a: 0.002, d: 0.12, s: 0.0001, r: 0.05, dest: bus }); break;
      case 's':
        noiseBurst({ t, dur: 0.14, vol: 0.2 * v, type: 'bandpass', f: 1900, q: 0.8, dest: bus });
        note({ type: 'triangle', f: 190, f2: 120, t, dur: 0.07, vol: 0.12 * v, a: 0.002, d: 0.06, s: 0.0001, dest: bus });
        break;
      case 'h': noiseBurst({ t, dur: 0.035, vol: 0.075 * v, type: 'highpass', f: 7500, q: 0.4, dest: bus }); break;
      case 'o': noiseBurst({ t, dur: 0.16, vol: 0.07 * v, type: 'highpass', f: 6800, q: 0.4, dest: bus }); break;
      case 'T': note({ type: 'sine', f: 120, f2: 62, t, dur: 0.28, vol: 0.4 * v, a: 0.004, d: 0.25, s: 0.0001, r: 0.1, dest: bus, send: 0.35 }); break;
      case 'r': note({ type: 'square', f: 1250, t, dur: 0.02, vol: 0.05 * v, a: 0.001, d: 0.02, s: 0.0001, dest: bus }); break;
      case 'c': noiseBurst({ t, dur: 0.05, vol: 0.05 * v, type: 'highpass', f: 5200, q: 0.4, dest: bus }); break;
      default: break;
    }
  },
};

// ───────────────────────── the songs ─────────────────────────
const SONGS = {};

function buildSongs() {
  // ── Intro cutscene: mysterious, D minor, 66 bpm ──
  {
    const ch = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'A', 'A'];
    SONGS.intro = {
      bpm: 66,
      tracks: [
        track('pad', 1, padLine(ch, 3)),
        track('sub', 1, bassLine(ch, 'whole', 2)),
        track('bell', 1, bars(
          'D5:4 -:2 F5:2 A5:4 -:4',
          'Bb4:4 -:2 D5:2 F5:4 -:4',
          'G4:4 -:2 Bb4:2 D5:4 -:4',
          'A4:4 -:2 C#5:2 E5:4 -:4',
          'D5:4 F5:2 A5:2 D6:8',
          'Bb5:4 A5:2 F5:2 D5:8',
          'E5:4 C#5:2 A4:2 E5:4 -:4',
          'A4:8 -:8',
        )),
      ],
    };
  }

  // ── Title: heroic, C major, 84 bpm ──
  {
    const ch = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C'];
    SONGS.title = {
      bpm: 84,
      tracks: [
        track('strings', 1, bars(
          'G4:6 E4:2 G4:4 C5:4', 'B4:6 G4:2 B4:4 D5:4', 'C5:6 A4:2 C5:4 E5:4', 'A4:4 C5:4 F5:8',
          'E5:6 G5:2 E5:4 C5:4', 'D5:6 B4:2 G4:4 B4:4', 'A4:4 C5:4 A4:4 F4:4', 'G4:8 B4:4 D5:4',
          'E5:8 C5:4 E5:4', 'F5:6 E5:2 C5:4 A4:4', 'E5:4 G5:4 C6:8', 'B5:6 A5:2 G5:4 D5:4',
          'C5:4 E5:4 A5:8', 'A5:6 G5:2 F5:4 C5:4', 'D5:4 G5:4 B5:4 D6:4', 'C6:12 -:4',
        )),
        track('harp', 0.8, arpLine(ch, 'eighths', 3)),
        track('pad', 0.7, padLine(ch, 3)),
        track('bass', 0.9, bassLine(ch, 'half', 2)),
        track('drums', 0.8, drums('T.......T.c.c.c.')),
      ],
    };
  }

  // ── Field: pastoral, G major, 108 bpm ──
  {
    const ch = ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D', 'C', 'G', 'Am', 'D', 'C', 'D', 'Em', 'D'];
    SONGS.field = {
      bpm: 108,
      tracks: [
        track('lead', 1, bars(
          'B4:4 D5:2 B4:2 G4:4 A4:2 B4:2', 'G4:4 B4:2 G4:2 E4:4 G4:4', 'E5:4 G5:2 E5:2 C5:4 E5:2 D5:2', 'C5:4 B4:2 A4:2 F#4:4 A4:4',
          'B4:4 D5:2 B4:2 G4:4 A4:2 B4:2', 'G4:4 B4:2 E5:2 D5:8', 'C5:4 B4:2 A4:2 C5:4 E5:4', 'D5:6 C5:2 B4:4 A4:4',
          'G4:2 C5:2 E5:4 G5:4 E5:2 C5:2', 'B4:2 D5:2 G5:4 D5:4 B4:2 D5:2', 'E5:4 C5:2 A4:2 C5:4 E5:4', 'F#5:4 D5:2 A4:2 D5:8',
          'E5:4 G5:2 E5:2 C5:4 D5:2 E5:2', 'F#5:4 A5:2 F#5:2 D5:4 C5:4', 'B4:4 E5:2 G5:2 F#5:4 E5:4', 'D5:8 C5:2 B4:2 A4:4',
        )),
        track('harp', 0.75, arpLine(ch, 'eighths', 3)),
        track('bass', 0.9, bassLine(ch, 'oompah', 2)),
        track('drums', 0.7, drums('k.c.r.c.k.c.r.c.')),
      ],
    };
  }

  // ── Battle: urgent, A minor, 152 bpm ──
  {
    const ch = ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E', 'Dm', 'Dm', 'Am', 'Am', 'F', 'G', 'E', 'E'];
    SONGS.battle = {
      bpm: 152,
      tracks: [
        track('lead', 1.05, bars(
          'A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:2 E5:2', 'A4:2 C5:2 E5:2 A5:2 B5:4 A5:4',
          'F4:2 A4:2 C5:2 F5:2 E5:2 C5:2 A4:2 C5:2', 'G4:2 B4:2 D5:2 G5:2 F5:2 D5:2 B4:2 D5:2',
          'E5:4 E5:2 D5:2 C5:4 B4:2 C5:2', 'A5:6 G5:2 E5:8',
          'F5:4 E5:2 D5:2 C5:4 A4:4', 'G#4:2 B4:2 E5:2 G#5:2 B5:4 E5:4',
          'D5:4 F5:2 A5:2 G5:4 F5:2 E5:2', 'D5:4 F5:2 D5:2 A4:4 D5:4',
          'C5:4 E5:2 A5:2 G5:4 E5:4', 'E5:2 D5:2 C5:2 B4:2 A4:8',
          'A5:4 G5:2 F5:2 E5:4 F5:4', 'D5:4 G5:4 B5:8',
          'G#5:4 E5:4 B4:4 G#4:4', 'G#4:2 B4:2 E5:2 G#5:2 B5:8',
        )),
        track('pulse', 0.8, arpLine(ch, 'sixteenths', 3)),
        track('bassSaw', 1, bassLine(ch, 'drive', 2)),
        track('drums', 1, drums('k.h.s.h.k.hks.hh')),
      ],
    };
  }

  // ── Victory jingle (one-shot) ──
  {
    SONGS.victory = {
      bpm: 138, loop: false,
      tracks: [
        track('brass', 1, mel('G4:2 G4:2 G4:2 C5:6 E5:2 G5:2 E5:2 G5:2 C6:12')),
        track('strings', 0.8, { len: 32, ev: [...chordAt('C', 4, 0, 12), ...chordAt('G', 3, 12, 8), ...chordAt('C', 4, 20, 12)] }),
        track('bass', 1, mel('C2:6 -:2 C2:4 G2:4 C2:16')),
        track('drums', 1, drums('T.T.T.T.T.T.T.TTk.......T.......')),
      ],
    };
  }

  // ── Game over jingle (one-shot) ──
  {
    SONGS.gameover = {
      bpm: 66, loop: false,
      tracks: [
        track('lead', 0.9, mel('E5:6 D5:2 C5:4 B4:4 A4:16')),
        track('pad', 1, padLine(['Am', 'Am'], 3)),
        track('sub', 1, bassLine(['Am', 'Am'], 'whole', 2)),
      ],
    };
  }

  for (const s of Object.values(SONGS)) s.length = Math.max(...s.tracks.map((t) => t.len));
}
buildSongs();

// ───────────────────────── player ─────────────────────────
function slotsFor(tr) {
  const slots = Array.from({ length: tr.len }, () => null);
  for (const e of tr.ev) (slots[e.s] ||= []).push(e);
  return slots;
}

class SongPlayer {
  constructor(name, { loop = true, onEnd = null } = {}) {
    this.name = name;
    this.song = SONGS[name];
    this.loop = loop && this.song.loop !== false;
    this.onEnd = onEnd;
    this.stepDur = 60 / this.song.bpm / 4;
    this.step = 0;
    this.alive = true;
    this.slots = this.song.tracks.map(slotsFor);
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(musicBus);
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), 30);
  }

  fadeIn(sec, vol = 1) {
    const t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(sec > 0 ? 0.0001 : vol, t);
    if (sec > 0) this.out.gain.linearRampToValueAtTime(vol, t + sec);
  }

  fadeOut(sec = 0.6) {
    if (!this.alive) return;
    this.alive = false;
    clearInterval(this.timer);
    const t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
    this.out.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.02, sec));
    setTimeout(() => { try { this.out.disconnect(); } catch { /* ignore */ } }, sec * 1000 + 2500);
  }

  resync() { this.nextTime = Math.max(this.nextTime, ctx.currentTime + 0.06); }

  tick() {
    if (!this.alive) return;
    if (!audioRunning()) { this.resync(); return; }
    while (this.nextTime < ctx.currentTime + 0.14) {
      this.playStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += this.stepDur;
      if (this.step >= this.song.length) {
        if (this.loop) { this.step = 0; } else { this.finish(); return; }
      }
    }
  }

  playStep(step, t) {
    this.song.tracks.forEach((tr, i) => {
      const list = this.slots[i][step % tr.len];
      if (!list) return;
      const fn = INST[tr.inst];
      for (const e of list) fn(t, e, this.stepDur, tr.vol ?? 1, this.out);
    });
  }

  finish() {
    this.alive = false;
    clearInterval(this.timer);
    const wait = Math.max(0, this.nextTime - ctx.currentTime) * 1000 + 700;
    setTimeout(() => {
      try { this.out.disconnect(); } catch { /* ignore */ }
      if (this.onEnd) this.onEnd();
    }, wait);
  }
}

let current = null;

export function playMusic(name, { fade = 0.9, vol = 1 } = {}) {
  if (!ctx || !SONGS[name]) return null;
  if (current && current.name === name && current.alive) return current;
  if (current) current.fadeOut(Math.min(fade, 0.8));
  current = new SongPlayer(name, { loop: true });
  current.fadeIn(fade, vol);
  return current;
}

export function stopMusic(fade = 0.7) {
  if (current) { current.fadeOut(fade); current = null; }
}

// One-shot fanfares. Resolves when the jingle has finished.
export function playJingle(name) {
  if (!ctx || !SONGS[name]) return Promise.resolve();
  stopMusic(0.15);
  return new Promise((resolve) => {
    const p = new SongPlayer(name, { loop: false, onEnd: resolve });
    p.fadeIn(0, 1);
    current = p;
    // never hang the game if audio is locked / suspended
    setTimeout(resolve, (p.song.length * p.stepDur + 1.5) * 1000);
  });
}

export const currentSong = () => (current && current.alive ? current.name : null);
export function resyncMusic() { if (current && current.alive) current.resync(); }
export const SONG_NAMES = Object.keys(SONGS);
export const __songs = SONGS; // exposed for tests

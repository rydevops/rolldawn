// audio.js — the Web Audio engine: context, mixer buses, reverb, iOS unlock, and two synth primitives
// (note + noiseBurst) that both the sound effects and the music are built from.
// There are no audio files in this game — every sound is synthesised live.

import { settings } from './state.js';

export let ctx = null;
export let musicBus = null;
export let sfxBus = null;
export let reverbSend = null;

let noiseBuf = null;
const waves = new Map();

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeImpulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function initAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch {
    return null;
  }

  // iOS: let sound play even when the ringer switch is on silent (Safari 16.4+).
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }

  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 18;
  comp.ratio.value = 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(ctx.destination);

  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);

  // one shared reverb — pads, bells and big hits send into it
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(1.9, 2.6);
  reverbSend = ctx.createGain();
  const wet = ctx.createGain();
  wet.gain.value = 0.42;
  reverbSend.connect(convolver);
  convolver.connect(wet);
  wet.connect(master);

  // white-noise source buffer shared by every noise effect
  const nlen = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;

  applyVolumes();
  return ctx;
}

// Must be called from inside a user gesture (tap / click / key).
export async function unlock() {
  if (!initAudio()) return false;
  try { await ctx.resume(); } catch { /* ignore */ }
  try {
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch { /* ignore */ }
  return ctx.state === 'running';
}

export function audioRunning() { return !!ctx && ctx.state === 'running'; }
export async function resumeAudio() { if (ctx && ctx.state !== 'running') { try { await ctx.resume(); } catch { /* ignore */ } } }
export async function suspendAudio() { if (ctx && ctx.state === 'running') { try { await ctx.suspend(); } catch { /* ignore */ } } }

export function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  musicBus.gain.setTargetAtTime(settings.music ? 0.62 : 0, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx ? 0.9 : 0, t, 0.02);
}

// Pulse waves (12.5% / 25% duty) give the classic chiptune bite.
export function pulseWave(duty) {
  let w = waves.get(duty);
  if (w) return w;
  const N = 48;
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) {
    const k = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    real[n] = k * Math.cos(n * Math.PI * duty);
    imag[n] = k * Math.sin(n * Math.PI * duty);
  }
  w = ctx.createPeriodicWave(real, imag);
  waves.set(duty, w);
  return w;
}

// One oscillator voice with an ADSR envelope, optional filter / vibrato / reverb send.
export function note(o) {
  if (!ctx) return;
  const {
    type = 'square', f = 440, f2 = null, t = ctx.currentTime, dur = 0.2, vol = 0.2,
    a = 0.005, d = 0.06, s = 0.7, r = 0.08, dest = sfxBus, send = 0,
    filter = null, vibrato = 0, wave = null, detune = 0,
  } = o;

  const osc = ctx.createOscillator();
  if (wave) osc.setPeriodicWave(wave); else osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + Math.max(0.01, dur));
  if (detune) osc.detune.value = detune;

  const g = ctx.createGain();
  const sus = Math.max(0.0001, vol * s);
  const hold = t + Math.max(a + d, dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(sus, t + a + d);
  g.gain.setValueAtTime(sus, hold);
  g.gain.exponentialRampToValueAtTime(0.0001, hold + r);

  let tail = osc;
  if (filter) {
    const bq = ctx.createBiquadFilter();
    bq.type = filter.type || 'lowpass';
    bq.frequency.setValueAtTime(filter.freq, t);
    if (filter.freq2) bq.frequency.exponentialRampToValueAtTime(filter.freq2, t + Math.max(0.02, dur));
    bq.Q.value = filter.q || 0.7;
    osc.connect(bq);
    tail = bq;
  }
  tail.connect(g);
  g.connect(dest);
  if (send) {
    const sg = ctx.createGain();
    sg.gain.value = send;
    g.connect(sg);
    sg.connect(reverbSend);
  }

  let lfo = null;
  if (vibrato) {
    lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(vibrato, t + Math.min(0.25, dur * 0.6));
    lfo.connect(lg);
    lg.connect(osc.detune);
    lfo.start(t);
    lfo.stop(hold + r + 0.05);
  }

  osc.start(t);
  osc.stop(hold + r + 0.05);
}

// A shaped burst of filtered noise — footsteps, swords, hi-hats, crashes.
export function noiseBurst(o) {
  if (!ctx || !noiseBuf) return;
  const {
    t = ctx.currentTime, dur = 0.1, vol = 0.2, type = 'bandpass', f = 1500, f2 = null,
    q = 1, a = 0.002, dest = sfxBus, send = 0,
  } = o;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const bq = ctx.createBiquadFilter();
  bq.type = type;
  bq.frequency.setValueAtTime(f, t);
  if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t + dur);
  bq.Q.value = q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01));

  src.connect(bq);
  bq.connect(g);
  g.connect(dest);
  if (send) {
    const sg = ctx.createGain();
    sg.gain.value = send;
    g.connect(sg);
    sg.connect(reverbSend);
  }
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

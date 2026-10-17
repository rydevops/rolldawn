// intro.js — the opening cutscene (~32 s). One long painted shot, scripted by a single clock `t`:
//   night sky → the Prime Die glows & cracks → it falls and shatters → shards scatter → sunrise → Wren.
// Music, sound cues and captions are fired from the EVENTS list at the bottom of this file.

import { $, clamp, lerp, ease, mulberry32, pixelScale, fitCanvas } from './util.js';
import { Pix } from './pix.js';
import * as S from './scenery.js';
import { sfx } from './sfx.js';
import { playMusic } from './music.js';
import { showScreen, typeText } from './ui.js';
import { go } from './scenes.js';
import { fadeTo } from './transitions.js';
import { CUTSCENE_CAPTIONS } from './story.js';
import { sprites } from './sprites.js';

const T = { dieIn: 4.2, spinStop: 8.6, crack: 11.4, horizon: 14.8, fall: 15.9, impact: 18.4, dawn: 20.2, sun: 23.4, hero: 27.0, end: 31.8 };

// ───────────── art built once ─────────────
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
let faces = null;
let shardCvs = null;
let heroUp = null;

function makeFace(v) {
  const N = 32;
  const p = new Pix(N, N);
  p.rect(0, 0, N, N, '#f3ead6');
  p.rect(0, 0, N, 3, '#fffaf0'); p.rect(0, 0, 3, N, '#fffaf0');
  p.rect(0, N - 4, N, 4, '#d9ccae'); p.rect(N - 4, 0, 4, N, '#d9ccae');
  p.rect(0, 0, N, 2, '#e0b04a'); p.rect(0, N - 2, N, 2, '#b9852a');
  p.rect(0, 0, 2, N, '#e0b04a'); p.rect(N - 2, 0, 2, N, '#b9852a');
  [[0, 0], [1, 0], [0, 1], [N - 1, 0], [N - 2, 0], [N - 1, 1], [0, N - 1], [1, N - 1], [0, N - 2], [N - 1, N - 1], [N - 2, N - 1], [N - 1, N - 2]]
    .forEach(([x, y]) => p.clear(x, y));
  const pos = [9, 16, 23];
  for (const i of PIPS[v]) {
    const cx = pos[i % 3], cy = pos[(i / 3) | 0];
    p.ellipse(cx, cy, 3.4, 3.4, '#3fb6d0');
    p.ellipse(cx, cy, 2.4, 2.4, '#8ff3ff');
    p.set(cx - 1, cy - 1, '#ffffff');
  }
  return p.toCanvas();
}

function fillTri(p, [a, b, c], color) {
  const minX = Math.floor(Math.min(a[0], b[0], c[0])), maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1])), maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const sign = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const pt = [x + 0.5, y + 0.5];
      const d1 = sign(pt, a, b), d2 = sign(pt, b, c), d3 = sign(pt, c, a);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) p.set(x, y, color);
    }
  }
}

function makeShard(i) {
  const r = mulberry32(900 + i * 17);
  const p = new Pix(14, 14);
  const pts = [[1 + r() * 3, 1 + r() * 4], [10 + r() * 3, 2 + r() * 4], [3 + r() * 8, 10 + r() * 3]];
  fillTri(p, pts, '#f3ead6');
  const edge = [];
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
    if (p.solid(x, y) && (!p.solid(x - 1, y) || !p.solid(x + 1, y) || !p.solid(x, y - 1) || !p.solid(x, y + 1))) edge.push([x, y]);
  }
  edge.forEach(([x, y]) => p.set(x, y, '#d9a93f'));
  const cx = Math.round((pts[0][0] + pts[1][0] + pts[2][0]) / 3), cy = Math.round((pts[0][1] + pts[1][1] + pts[2][1]) / 3);
  p.set(cx, cy, '#8ff3ff'); p.set(cx + 1, cy, '#3fb6d0');
  return p.toCanvas();
}

const rngC = mulberry32(4455);
const CRACKS = Array.from({ length: 11 }, (_, i) => {
  let a = i * ((Math.PI * 2) / 11) + rngC() * 0.5, x = 0, y = 0;
  const pts = [[0, 0]];
  for (let s = 0; s < 8; s++) { a += (rngC() - 0.5) * 0.9; const l = 2 + rngC() * 3.2; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
  return pts;
});

function build() {
  if (faces) return;
  faces = [0, 1, 2, 3, 4, 5, 6].map((v) => (v ? makeFace(v) : null));
  shardCvs = Array.from({ length: 6 }, (_, i) => makeShard(i));
  heroUp = sprites().hero.up.idle.toCanvas();
}

// ───────────── state ─────────────
let canvas = null;
let scale = 4;
let t = 0;
let angle = 0;
let shakeAmp = 0;
let flashA = 0;
let finished = false;
let events = [];
let particles = [];
let shards = [];
let ringT = -1;
let skipHandler = null;
let rng = mulberry32(1);

function spawnEmbers(x, y, n, colors, spread = 10, up = 0) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y, vx: (rng() - 0.5) * spread * 2, vy: (rng() - 0.5) * spread - up, grav: 12,
      life: 0.5 + rng() * 0.7, max: 1.1, color: colors[(rng() * colors.length) | 0], size: rng() < 0.2 ? 2 : 1,
    });
  }
}

function lineRects(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// the cube: the front face squeezes while the next face swings round beside it
function drawDie(ctx, cx, cy, size, ang, tilt, alpha, glow) {
  if (glow > 0) {
    const R = size * 2.1;
    const g = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, R);
    g.addColorStop(0, `rgba(255,238,170,${Math.min(1, 0.55 * glow)})`);
    g.addColorStop(0.5, `rgba(143,243,255,${Math.min(1, 0.2 * glow)})`);
    g.addColorStop(1, 'rgba(143,243,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.floor(cx - R), Math.floor(cy - R), Math.ceil(R * 2), Math.ceil(R * 2));
  }
  const seq = [1, 3, 6, 4];
  const q = Math.PI / 2;
  const f = Math.floor(ang / q);
  const phi = ang - f * q;
  const fw = Math.cos(phi) * size, sw = Math.sin(phi) * size;
  const x0 = -(fw + sw) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.rotate(tilt);
  ctx.drawImage(faces[seq[f % 4]], x0, -size / 2, Math.max(0.5, fw), size);
  if (sw > 0.4) {
    ctx.drawImage(faces[seq[(f + 1) % 4]], x0 + fw, -size / 2, sw, size);
    ctx.fillStyle = 'rgba(20,16,70,0.33)';
    ctx.fillRect(x0 + fw, -size / 2, sw, size);
  }
  ctx.fillStyle = `rgba(20,16,70,${0.28 * (1 - Math.cos(phi))})`;
  ctx.fillRect(x0, -size / 2, Math.max(0.5, fw), size);
  ctx.restore();
}

function drawCracks(ctx, cx, cy, size, prog) {
  if (prog <= 0) return;
  const k = size / 32;
  ctx.fillStyle = '#ffffff';
  CRACKS.forEach((pts, i) => {
    const count = Math.floor(prog * 8 - (i % 3) * 0.6);
    for (let s = 0; s < Math.min(count, pts.length - 1); s++) {
      lineRects(ctx, cx + pts[s][0] * k * 1.4, cy + pts[s][1] * k * 1.4, cx + pts[s + 1][0] * k * 1.4, cy + pts[s + 1][1] * k * 1.4);
    }
  });
  ctx.globalAlpha = 0.5 * prog;
  ctx.fillStyle = '#8ff3ff';
  CRACKS.forEach((pts, i) => {
    const count = Math.floor(prog * 8 - (i % 3) * 0.6);
    for (let s = 0; s < Math.min(count, pts.length - 1); s++) {
      ctx.fillRect(Math.round(cx + pts[s][0] * k * 1.4) + 1, Math.round(cy + pts[s][1] * k * 1.4), 1, 1);
    }
  });
  ctx.globalAlpha = 1;
}

// ───────────── the shot ─────────────
function draw(dt) {
  if (!canvas || finished) return;
  const sizeKey = `${canvas.clientWidth}x${canvas.clientHeight}`;
  if (draw.key !== sizeKey) { draw.key = sizeKey; scale = pixelScale(canvas.clientWidth, canvas.clientHeight, { target: 100, tall: 120, min: 3, max: 8 }); }
  const { ctx, w, h } = fitCanvas(canvas, scale);

  // timeline-driven values
  const hyStart = h * 1.12, hyFinal = Math.round(h * 0.62);
  const hy = t < T.horizon ? hyStart : lerp(hyStart, hyFinal, ease.outCubic(clamp((t - T.horizon) / 3.2, 0, 1)));
  const k = ease.inOutQuad(clamp((t - T.dawn) / 6.8, 0, 1)) * 0.8;
  const pal = S.palette(k);

  // spin: gentle, then it decelerates to a stop before the cracks begin
  const t0 = T.spinStop, D = 2.4;
  if (t < t0) angle = 0.5 * t;
  else if (t < t0 + D) { const s = (t - t0) / D; angle = 0.5 * t0 + (0.5 * D / 3) * (1 - Math.pow(1 - s, 3)); }
  else if (t < T.fall) angle = 0.5 * t0 + 0.5 * D / 3;
  else { const tau = t - T.fall; angle = 0.5 * t0 + 0.5 * D / 3 + 1.2 * tau + 2.6 * tau * tau; }

  // camera shake
  const shk = shakeAmp > 0.05 ? shakeAmp : 0;
  const rumble = t > 10.6 && t < T.impact ? 0.35 + clamp((t - 10.6) / 5.2, 0, 1) * 1.1 : 0;
  const amp = Math.max(shk, rumble);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (amp > 0) ctx.translate(Math.round((Math.random() - 0.5) * amp * 2), Math.round((Math.random() - 0.5) * amp * 2));

  S.drawSky(ctx, w + 8, h + 8, hy, pal);
  const starScroll = -(hyStart - hy) * 0.5 + t * 0.7;
  S.drawStars(ctx, w, h, t, clamp(1 - k * 2.4, 0, 1) * clamp(t / 1.4, 0, 1), starScroll);
  S.drawAurora(ctx, w, h, t, clamp((t - 1) / 2, 0, 1) * clamp(1 - (t - 11) / 3.5, 0, 1) * 0.9);
  if (k > 0.12) S.drawClouds(ctx, w, hy, t, pal, clamp(k * 1.2, 0, 0.55));

  // sunrise (behind the hills)
  if (t > T.sun - 0.5) {
    const sp = ease.outCubic(clamp((t - T.sun) / 5.8, 0, 1));
    S.drawSun(ctx, Math.round(w * 0.64), Math.round(lerp(hyFinal + 16, hyFinal - 5, sp)), 11);
  }

  // the Prime Die
  const cx = w / 2;
  const base = clamp(w * 0.32, 22, 44);
  if (t >= T.dieIn && t < T.impact) {
    const appear = ease.outBack(clamp((t - T.dieIn) / 1.8, 0, 1));
    let cy = h * 0.33 + Math.sin(t * 1.1) * 2.2;
    let size = base * appear;
    let tilt = Math.sin(t * 0.7) * 0.07;
    let dx = 0;
    const crackP = clamp((t - T.crack) / 4.3, 0, 1);
    let glow = (0.55 + 0.2 * Math.sin(t * 2.2)) * clamp(appear, 0, 1) + crackP * 0.9;
    if (t >= T.crack && t < T.fall) dx = (Math.random() - 0.5) * crackP * 2.6;
    if (t >= T.fall) {
      const p = clamp((t - T.fall) / (T.impact - T.fall), 0, 1);
      const yEnd = hyFinal + 3;
      cy = lerp(h * 0.33, yEnd, ease.inCubic(p));
      size *= 1 + 0.45 * p;
      tilt += p * 0.7;
      glow += p * 0.6;
      spawnEmbers(cx, cy - size * 0.2, 3, ['#ffd23f', '#ff9a2e', '#8ff3ff', '#ffffff'], 7, 6);
    }
    drawDie(ctx, cx + dx, cy, size, angle, tilt, clamp(appear, 0, 1), glow);
    if (t >= T.crack && t < T.fall) drawCracks(ctx, cx + dx, cy, size, crackP);
    if (t >= T.crack && t < T.fall && Math.random() < crackP * 0.5) spawnEmbers(cx + dx, cy, 1, ['#8ff3ff', '#ffffff'], 6, 2);
  }

  // landed glints on the far hills (five shards… and one around Wren's neck)
  if (t > T.impact + 3.5 && hy < h) {
    const a = clamp((t - T.impact - 3.5) / 2, 0, 1);
    [0.12, 0.3, 0.55, 0.78, 0.92].forEach((fx, i) => {
      const x = Math.round(w * fx), y = S.ridge(0, x, hy) - 1;
      const tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * 3 + i * 1.7));
      ctx.globalAlpha = a * tw;
      ctx.fillStyle = '#8ff3ff';
      ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
      ctx.globalAlpha = 1;
    });
  }

  if (hy < h + 14) {
    S.drawHills(ctx, w, h, hy, pal);
    S.drawGrass(ctx, w, h, hy, pal, t);
    if (t > T.hero) S.drawHeroOnHill(ctx, w, h, hy, ease.outCubic(clamp((t - T.hero) / 2.2, 0, 1)), t);
  }

  // shards, embers, shockwave
  for (const s of shards) {
    s.life -= dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 62 * dt; s.rot += s.vr * dt;
    if (s.life > 0) {
      spawnEmbers(s.x, s.y, 1, ['#8ff3ff', '#ffd23f', '#ffffff'], 3);
      ctx.save();
      ctx.globalAlpha = clamp(s.life / 0.8, 0, 1);
      ctx.translate(Math.round(s.x), Math.round(s.y));
      ctx.rotate(s.rot);
      ctx.drawImage(shardCvs[s.i], -7, -7);
      ctx.restore();
    }
  }
  shards = shards.filter((s) => s.life > 0);

  for (const p of particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
    ctx.globalAlpha = clamp(p.life / (p.max * 0.5), 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  particles = particles.filter((p) => p.life > 0);
  if (particles.length > 420) particles.splice(0, particles.length - 420);

  if (ringT >= 0) {
    ringT += dt;
    const p = ringT / 1.5;
    if (p < 1) {
      ctx.strokeStyle = `rgba(255,246,200,${1 - p})`;
      ctx.lineWidth = 2 + (1 - p) * 2;
      ctx.beginPath();
      ctx.ellipse(w / 2, hyFinal + 2, p * w * 0.85, p * w * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else ringT = -1;
  }
  ctx.restore();

  if (flashA > 0) {
    ctx.fillStyle = `rgba(255,250,235,${flashA})`;
    ctx.fillRect(0, 0, w, h);
    flashA = Math.max(0, flashA - dt * 0.8);
  }
  shakeAmp = Math.max(0, shakeAmp - dt * 4.2);

  // fade in from black at the very start
  if (t < 3) {
    ctx.fillStyle = `rgba(0,0,0,${1 - t / 3})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// ───────────── script ─────────────
function impact() {
  const w = canvas.width, h = canvas.height;
  const hyFinal = Math.round(h * 0.62);
  sfx('shatter');
  flashA = 1;
  shakeAmp = 7;
  ringT = 0;
  shards = Array.from({ length: 6 }, (_, i) => {
    const a = (-165 + i * 30 + (Math.random() - 0.5) * 12) * (Math.PI / 180);
    const sp = 60 + Math.random() * 60;
    return { i, x: w / 2, y: hyFinal, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24, rot: 0, vr: (Math.random() - 0.5) * 12, life: 3.4 };
  });
  for (let i = 0; i < 70; i++) {
    particles.push({
      x: w / 2 + (Math.random() - 0.5) * 8, y: hyFinal + Math.random() * 4,
      vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 50, grav: 40, life: 0.8 + Math.random() * 1.2, max: 1.6,
      color: ['#ffd23f', '#ff9a2e', '#fff6d6', '#8ff3ff', '#b49a7a'][i % 5], size: Math.random() < 0.3 ? 2 : 1,
    });
  }
}

function buildEvents() {
  const ev = [
    { at: T.dieIn, fn: () => sfx('chime', 2) },
    { at: T.dieIn + 0.5, fn: () => sfx('chime', 3) },
    { at: 10.6, fn: () => sfx('rumble') },
    ...[12.2, 13.0, 13.8, 14.5, 15.1, 15.5, 15.8].map((at) => ({ at, fn: () => sfx('crack') })),
    { at: T.fall, fn: () => sfx('fall') },
    { at: T.impact, fn: impact },
    { at: 22.0, fn: () => sfx('dawn') },
    { at: 25.4, fn: () => sfx('chime', 0) },
    { at: 26.6, fn: () => sfx('chime', 1) },
    { at: 27.8, fn: () => sfx('chime', 2) },
    { at: T.end, fn: () => finish(false) },
  ];
  CUTSCENE_CAPTIONS.forEach((c, i) => {
    ev.push({ at: c.at, fn: () => showCaption(c.text) });
    const next = CUTSCENE_CAPTIONS[i + 1];
    if (next) ev.push({ at: next.at - 0.7, fn: hideCaption });
  });
  return ev.sort((a, b) => a.at - b.at).map((e) => ({ ...e, done: false }));
}

function showCaption(text) {
  const n = $('#intro-caption');
  n.style.transition = 'none';
  n.style.opacity = '1';
  typeText(n, text, { speed: 34, blip: false, skip: $('#intro-caption') });
}
function hideCaption() {
  const n = $('#intro-caption');
  n.style.transition = 'opacity 0.6s';
  n.style.opacity = '0';
}

async function finish(skipped) {
  if (finished) return;
  finished = true;
  if (skipped) await fadeTo(true, 400);
  await go('title', { from: 'intro', skipped });
}

// ───────────── scene hooks ─────────────
function update(dt) {
  if (finished) return;
  t += dt;
  for (const e of events) {
    if (!e.done && t >= e.at) { e.done = true; e.fn(); }
  }
}

function enter() {
  build();
  canvas = $('#intro-canvas');
  t = 0; angle = 0; shakeAmp = 0; flashA = 0; ringT = -1; finished = false;
  particles = []; shards = []; draw.key = '';
  rng = mulberry32(99);
  events = buildEvents();
  $('#intro-caption').textContent = '';
  $('#intro-caption').style.opacity = '0';
  $('#fade').style.transitionDuration = '0ms';
  $('#fade').classList.remove('on');
  showScreen('screen-intro');
  playMusic('intro', { fade: 3 });
  const btn = $('#intro-skip');
  skipHandler = () => { sfx('back'); finish(true); };
  btn.addEventListener('click', skipHandler);
}

function exit() {
  $('#intro-skip').removeEventListener('click', skipHandler);
  hideCaption();
}

export default { enter, exit, update, draw };

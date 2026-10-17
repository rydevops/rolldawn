// battlefx.js — the canvas half of a battle: painted backdrop, the two combatants, slashes, sparks and
// the dissolve effects. battle.js drives it (what happens); this file only knows how it *looks*.

import { Pix, mix } from './pix.js';
import { pixelScale, fitCanvas, mulberry32 } from './util.js';
import { sprites, mobSprite } from './sprites.js';
import { tileArt } from './tiles.js';

const THEMES = {
  1: { top: '#69bfee', bottom: '#d3f0ff', sun: '#fff3b0', hillA: '#9bd8a4', hillB: '#7cc88a', ground: '#5eb34a', cloud: '#ffffff' },
  2: { top: '#69bfee', bottom: '#d3f0ff', sun: '#fff3b0', hillA: '#9bd8a4', hillB: '#7cc88a', ground: '#5eb34a', cloud: '#ffffff' },
  3: { top: '#f29a55', bottom: '#ffe5a6', sun: '#fff6cf', hillA: '#9ec78a', hillB: '#7fb070', ground: '#58a443', cloud: '#fff1d6' },
  4: { top: '#4a3a8a', bottom: '#ff9f80', sun: '#ffe2b0', hillA: '#7a7fa8', hillB: '#5f7a8a', ground: '#4a8a48', cloud: '#ffc9c0' },
};

let canvas = null;
let stageEl = null;
let ctx = null;
let bs = 5;            // pixel scale
let lw = 80, lh = 120; // logical size
let theme = THEMES[1];
let bg = null;         // pre-painted backdrop canvas
let clock = 0;

let heroImgs = null;
let mobImg = null;
let mobFlash = null;
let heroFlash = null;
let heroFlashRed = null;
let grassTiles = null;
const cache = new Map();

export const hero = { ox: 0, oy: 0, alpha: 1, flash: 0, red: false, pose: 'idle', rot: 0, hidden: false };
export const mob = { ox: 0, oy: 0, alpha: 1, flash: 0, sy: 1, hidden: false, dead: false, id: 'slime' };

const particles = [];
const effects = [];

const sil = (pix, color) => {
  let c = cache.get(pix);
  if (!c) { c = {}; cache.set(pix, c); }
  if (!c[color]) c[color] = pix.silhouette(color).toCanvas();
  return c[color];
};
const img = (pix) => {
  let c = cache.get(pix);
  if (!c) { c = {}; cache.set(pix, c); }
  if (!c.img) c.img = pix.toCanvas();
  return c.img;
};

// ── layout (logical px) ──
export function layout() {
  return {
    hero: { x: Math.round(lw * 0.27), y: Math.round(lh * 0.8) },
    mob: { x: Math.round(lw * 0.7), y: Math.round(lh * 0.47) },
    horizon: Math.round(lh * 0.36),
  };
}

export function toCss(lx, ly) {
  return { x: lx * (canvas.clientWidth / canvas.width), y: ly * (canvas.clientHeight / canvas.height) };
}
export const scaleNow = () => bs;

export function spriteSize() {
  return {
    hero: { w: img(sprites().heroBattle.idle).width, h: img(sprites().heroBattle.idle).height },
    mob: { w: mobImg.width, h: mobImg.height },
  };
}

// ── backdrop ──
function paintBackdrop() {
  const L = layout();
  const p = new Pix(lw, lh);
  const hy = L.horizon;
  const rng = mulberry32(31337);

  // sky bands
  const bands = 8;
  for (let b = 0; b < bands; b++) {
    const y0 = Math.floor((hy * b) / bands), y1 = Math.floor((hy * (b + 1)) / bands);
    p.rect(0, y0, lw, y1 - y0 + 1, mix(theme.top, theme.bottom, b / (bands - 1)));
  }
  // sun with a stepped glow
  const sx = Math.round(lw * 0.82), sy = Math.round(hy * 0.42);
  p.ellipse(sx, sy, 8, 8, mix(theme.bottom, theme.sun, 0.35));
  p.ellipse(sx, sy, 6, 6, mix(theme.bottom, theme.sun, 0.7));
  p.ellipse(sx, sy, 4, 4, theme.sun);

  // two rows of rolling hills
  for (let x = 0; x < lw; x++) {
    const h1 = hy - 5 - Math.round(3.2 * Math.sin(x / 8.5) + 2 * Math.sin(x / 4.1 + 1));
    p.rect(x, h1, 1, hy - h1 + 2, theme.hillA);
    const h2 = hy - 1 - Math.round(2.2 * Math.sin(x / 6.3 + 2) + 1.4 * Math.sin(x / 3 + 4));
    p.rect(x, h2, 1, hy - h2 + 2, theme.hillB);
  }
  // little far-off trees
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(rng() * lw), y = hy - 3 - Math.floor(rng() * 2);
    p.ellipse(x, y, 2, 2, mix(theme.hillB, '#1f5e3c', 0.45));
  }

  // ground with perspective stripes
  p.rect(0, hy + 1, lw, lh - hy, theme.ground);
  for (let y = hy + 1; y < lh; y++) {
    const stripe = Math.floor((y - hy) / (3 + (y - hy) / 14));
    if (stripe % 2 === 0) p.rect(0, y, lw, 1, mix(theme.ground, '#ffffff', 0.06));
  }
  for (let i = 0; i < lw * lh * 0.018; i++) {
    const x = Math.floor(rng() * lw), y = hy + 2 + Math.floor(rng() * (lh - hy - 2));
    p.set(x, y, mix(theme.ground, '#1f5e3c', 0.35));
    if (rng() < 0.4) p.set(x + 1, y - 1, mix(theme.ground, '#ffffff', 0.25));
  }
  // stray flowers
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rng() * lw), y = hy + 4 + Math.floor(rng() * (lh - hy - 6));
    p.set(x, y, ['#ffffff', '#ffd23f', '#ff9fc2'][i % 3]);
  }

  // platforms (where the fighters stand)
  const plat = (cx, cy, rx, ry) => {
    p.ellipse(cx, cy + 1, rx + 1, ry + 1, mix(theme.ground, '#1f3d1a', 0.5));
    p.ellipse(cx, cy, rx, ry, mix(theme.ground, '#ffffff', 0.12));
    p.ellipse(cx, cy - 0.5, rx - 3, ry - 1, mix(theme.ground, '#ffffff', 0.2));
  };
  plat(L.mob.x, L.mob.y, 15, 3.6);
  plat(L.hero.x, L.hero.y, 16, 4);
  bg = p.toCanvas();
}

// ── setup / resize ──
export function setup(canvasEl, stage, mobId, zone) {
  canvas = canvasEl;
  stageEl = stage;
  theme = THEMES[zone] || THEMES[1];
  const S = sprites();
  heroImgs = { idle: img(S.heroBattle.idle), attack: img(S.heroBattle.attack) };
  heroFlash = { idle: sil(S.heroBattle.idle, '#ffffff'), attack: sil(S.heroBattle.attack, '#ffffff') };
  heroFlashRed = { idle: sil(S.heroBattle.idle, '#ff3b3b'), attack: sil(S.heroBattle.attack, '#ff3b3b') };
  const mp = mobSprite(mobId);
  mobImg = img(mp);
  mobFlash = sil(mp, '#ffffff');
  grassTiles = tileArt().tall.map(img);
  Object.assign(hero, { ox: 0, oy: 0, alpha: 1, flash: 0, red: false, pose: 'idle', rot: 0, hidden: false });
  Object.assign(mob, { ox: 0, oy: 0, alpha: 1, flash: 0, sy: 1, hidden: false, dead: false, id: mobId });
  particles.length = 0;
  effects.length = 0;
  bg = null;
  lw = 0;
}

function ensureSize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const want = pixelScale(w, h, { target: 76, tall: 90, min: 3, max: 8 });
  if (want !== bs || !bg || Math.ceil(w / bs) !== lw || Math.ceil(h / bs) !== lh) {
    bs = want;
    const r = fitCanvas(canvas, bs);
    lw = r.w;
    lh = r.h;
    paintBackdrop();
  }
  return true;
}

// ── helpers other modules use ──
export function spark(x, y, { n = 10, color = '#ffffff', speed = 40, grav = 90, size = 1, life = 0.5, up = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, grav, size,
      life: life * (0.6 + Math.random() * 0.6), max: life,
      color: Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color,
    });
  }
}

export function star(x, y, color = '#fff6a8') {
  effects.push({ type: 'star', x, y, t: 0, dur: 0.6 + Math.random() * 0.4, color, vy: -14 - Math.random() * 14 });
}

export function slash(x, y, { crit = false, dir = 1 } = {}) {
  effects.push({ type: 'slash', x, y, t: 0, dur: crit ? 0.34 : 0.26, crit, dir });
}

export function tween(ms, fn, ease = (t) => t) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      fn(ease(t), t);
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

// ── drawing ──
function drawSprite(g, image, flashImage, x, feetY, { sx = 1, sy = 1, alpha = 1, rot = 0, flash = 0 } = {}) {
  const w = image.width * sx, h = image.height * sy;
  g.save();
  g.globalAlpha = alpha;
  g.translate(Math.round(x), Math.round(feetY));
  if (rot) g.rotate(rot);
  g.drawImage(image, -Math.round(w / 2), -Math.round(h), Math.round(w), Math.round(h));
  if (flash > 0 && flashImage) {
    g.globalAlpha = alpha * flash;
    g.drawImage(flashImage, -Math.round(w / 2), -Math.round(h), Math.round(w), Math.round(h));
  }
  g.restore();
}

function drawClouds(g) {
  const L = layout();
  g.fillStyle = theme.cloud;
  g.globalAlpha = 0.85;
  const shapes = [[[3, 3, 12, 3], [0, 4, 18, 3], [5, 1, 7, 3]], [[2, 2, 9, 2], [0, 3, 12, 2], [3, 0, 5, 3]]];
  for (let i = 0; i < 4; i++) {
    const s = shapes[i % 2];
    const x = ((clock * (2.2 + i * 0.6) + i * 38) % (lw + 40)) - 24;
    const y = 3 + ((i * 7) % Math.max(6, L.horizon - 10));
    for (const [rx, ry, rw, rh] of s) g.fillRect(Math.round(x + rx), y + ry, rw, rh);
  }
  g.globalAlpha = 1;
}

function drawFx(g, dt) {
  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    g.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
    g.fillStyle = p.color;
    g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  g.globalAlpha = 1;

  // slashes + stars
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const p = e.t / e.dur;
    if (p >= 1) { effects.splice(i, 1); continue; }
    if (e.type === 'slash') {
      const R = e.crit ? 20 : 14;
      const steps = 22;
      for (let k = 0; k <= steps; k++) {
        const f = k / steps;
        if (f > Math.min(1, p * 1.6)) break;
        const trail = Math.min(1, p * 1.6) - f;
        if (trail > 0.7) continue;
        const a = -1.15 + f * 2.3;
        const x = e.x + e.dir * R * (0.5 - Math.cos(a));
        const y = e.y + Math.sin(a) * R;
        const size = e.crit ? 3 : 2;
        g.globalAlpha = Math.max(0, 1 - trail * 1.3) * (1 - Math.max(0, p - 0.7) / 0.3);
        g.fillStyle = e.crit ? (k % 2 ? '#fff6a8' : '#ffd23f') : '#ffffff';
        g.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
      }
      g.globalAlpha = 1;
    } else if (e.type === 'star') {
      const y = e.y + e.vy * e.t;
      g.globalAlpha = 1 - p;
      g.fillStyle = e.color;
      const x = Math.round(e.x), yy = Math.round(y);
      g.fillRect(x, yy - 1, 1, 3);
      g.fillRect(x - 1, yy, 3, 1);
      g.globalAlpha = 1;
    }
  }
}

export function draw(dt) {
  if (!canvas || !ensureSize()) return;
  clock += dt;
  const g = ctx = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const L = layout();

  g.drawImage(bg, 0, 0);
  drawClouds(g);

  // mob
  if (!mob.hidden) {
    let sx = 1, sy = mob.sy, bob = 0;
    if (!mob.dead) {
      if (mob.id === 'slime') { sy *= 1 + Math.sin(clock * 3.2) * 0.07; sx = 1 - Math.sin(clock * 3.2) * 0.05; }
      else if (mob.id === 'sporeling') { bob = Math.abs(Math.sin(clock * 2.6)) * -2; }
      else { bob = Math.round(Math.sin(clock * 2.2 + 1) * 1); }
    }
    drawSprite(g, mobImg, mobFlash, L.mob.x + mob.ox, L.mob.y + mob.oy + bob + 2, { sx, sy, alpha: mob.alpha, flash: mob.flash });
  }

  // hero
  if (!hero.hidden) {
    const idleBob = hero.pose === 'idle' ? Math.round(Math.sin(clock * 2.4) * 0.8) : 0;
    const key = hero.pose === 'attack' ? 'attack' : 'idle';
    const fl = hero.red ? heroFlashRed[key] : heroFlash[key];
    drawSprite(g, heroImgs[key], fl, L.hero.x + hero.ox + (key === 'attack' ? 0 : 0), L.hero.y + hero.oy + idleBob + 2,
      { alpha: hero.alpha, flash: hero.flash, rot: hero.rot });
  }

  drawFx(g, dt);

  // waving grass strip along the very bottom
  const gf = Math.floor(clock * 5);
  for (let x = -4, i = 0; x < lw; x += 15, i++) g.drawImage(grassTiles[(gf + i * 2) & 3], x, lh - 12);

  // theme-wide white flash handled by CSS overlay; nothing else to draw
}

export function stopDrawing() { canvas = null; }

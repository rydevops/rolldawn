// scenery.js — the painted sky / hills / sun that backs the intro, title and save-slot screens.
// k = time of day: 0 night · 0.5 dawn · 1 bright morning.  All drawing is crisp low-res canvas work.

import { mix } from './pix.js';
import { fitCanvas, pixelScale, mulberry32 } from './util.js';
import { sprites } from './sprites.js';

const KEYS = {
  night: { top: '#04030e', mid: '#0b0a26', bot: '#1d1745', far: '#16143e', midh: '#0f0d2e', near: '#08071c', grass: '#0b0b26', blade: '#14143a' },
  dawn: { top: '#2f2468', mid: '#9a4f8c', bot: '#ffa070', far: '#74508a', midh: '#523d70', near: '#352c58', grass: '#3c4b52', blade: '#5a6a5a' },
  day: { top: '#5fb4ee', mid: '#a9dcf7', bot: '#fff1c8', far: '#86cf92', midh: '#62b873', near: '#3f9a52', grass: '#4fae4a', blade: '#7fd35a' },
};

export function palette(k) {
  const [a, b, t] = k < 0.5 ? [KEYS.night, KEYS.dawn, k / 0.5] : [KEYS.dawn, KEYS.day, (k - 0.5) / 0.5];
  const o = {};
  for (const key of Object.keys(a)) o[key] = mix(a[key], b[key], t);
  return o;
}

// ── stars ──
const rngS = mulberry32(2026);
const STARS = Array.from({ length: 130 }, () => ({
  x: rngS(), y: rngS(), layer: 0.3 + rngS() * 0.9, ph: rngS() * 10, big: rngS() < 0.12,
  c: ['#ffffff', '#fff4c8', '#cfe4ff'][(rngS() * 3) | 0],
}));

export function drawSky(ctx, w, h, hy, pal) {
  const bands = 16;
  const span = Math.max(hy, 40);
  for (let b = 0; b < bands; b++) {
    const f = b / (bands - 1);
    const col = f < 0.5 ? mix(pal.top, pal.mid, f / 0.5) : mix(pal.mid, pal.bot, (f - 0.5) / 0.5);
    const y0 = Math.floor((span * b) / bands), y1 = Math.floor((span * (b + 1)) / bands);
    if (y0 > h) break;
    ctx.fillStyle = col;
    ctx.fillRect(0, y0, w, y1 - y0 + 1);
  }
  if (hy < h) { ctx.fillStyle = pal.bot; ctx.fillRect(0, Math.max(0, hy), w, h - hy); }
}

export function drawStars(ctx, w, h, t, alpha, scroll = 0) {
  if (alpha <= 0.01) return;
  for (const s of STARS) {
    const tw = 0.55 + 0.45 * Math.sin(t * (1.2 + s.layer) + s.ph);
    const x = Math.floor(s.x * w);
    let y = (s.y * h + scroll * s.layer) % h;
    if (y < 0) y += h;
    ctx.globalAlpha = alpha * tw;
    ctx.fillStyle = s.c;
    ctx.fillRect(x, Math.floor(y), s.big ? 2 : 1, s.big ? 2 : 1);
    if (s.big && tw > 0.85) { ctx.fillRect(x - 1, Math.floor(y), 4, 1); ctx.fillRect(x, Math.floor(y) - 1, 1, 4); }
  }
  ctx.globalAlpha = 1;
}

export function drawAurora(ctx, w, h, t, alpha) {
  if (alpha <= 0.01) return;
  for (let band = 0; band < 3; band++) {
    const base = h * (0.16 + band * 0.07);
    for (let x = 0; x < w; x++) {
      const y = base + Math.sin(x * 0.07 + t * (0.5 + band * 0.2) + band) * 7 + Math.sin(x * 0.03 - t * 0.3) * 5;
      for (let k = 0; k < 4; k++) {
        ctx.globalAlpha = alpha * (0.2 - k * 0.04);
        ctx.fillStyle = band === 1 ? '#7a6cff' : band === 2 ? '#41e0c0' : '#3fe08a';
        ctx.fillRect(x, Math.floor(y + k * 3), 1, 3);
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function drawSun(ctx, cx, cy, r) {
  const rings = [[r + 7, '#ffd9a0', 0.16], [r + 4, '#ffe3b0', 0.25], [r + 2, '#fff0c8', 0.4]];
  for (const [rr, col, a] of rings) {
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff6d6';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill();
}

const treeRng = mulberry32(77);
const TREES = Array.from({ length: 46 }, () => ({ x: treeRng(), layer: treeRng() < 0.6 ? 0 : 1, s: 2 + ((treeRng() * 3) | 0) }));

export function ridge(layer, x, hy) {
  if (layer === 0) return hy - 9 - Math.round(4 * Math.sin(x / 11 + 0.5) + 2.5 * Math.sin(x / 4.6 + 2));
  if (layer === 1) return hy - 3 - Math.round(3.4 * Math.sin(x / 8 + 2.4) + 2 * Math.sin(x / 3.3 + 1));
  return hy + 8 - Math.round(2.4 * Math.sin(x / 13 + 4) + 1.5 * Math.sin(x / 5 + 0.2));
}

export function drawHills(ctx, w, h, hy, pal) {
  const cols = [pal.far, pal.midh, pal.near];
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = cols[layer];
    for (let x = 0; x < w; x++) {
      const y = ridge(layer, x, hy);
      ctx.fillRect(x, y, 1, h - y);
    }
    if (layer < 2) {
      ctx.fillStyle = mix(cols[layer], '#000000', 0.22);
      for (const tr of TREES) {
        if (tr.layer !== layer) continue;
        const x = Math.floor(tr.x * w);
        const y = ridge(layer, x, hy);
        ctx.fillRect(x - 1, y - tr.s, 3, tr.s + 1);
        ctx.fillRect(x, y - tr.s - 1, 1, 1);
      }
    }
  }
}

export function drawGrass(ctx, w, h, hy, pal, t) {
  const top = ridge(2, w / 2, hy) + 6;
  ctx.fillStyle = pal.grass;
  ctx.fillRect(0, top + 4, w, h - top);
  for (let x = 0; x < w; x += 2) {
    const hh = 5 + ((x * 7) % 5) + ((x * 3) % 3);
    const sway = Math.round(Math.sin(t * 2.1 + x * 0.35) * 1.4);
    const base = top + 6 + ((x * 11) % 9);
    ctx.fillStyle = pal.blade;
    ctx.fillRect(x + sway, base - hh, 1, hh);
    ctx.fillStyle = pal.grass;
    ctx.fillRect(x + 1 + (sway > 0 ? 1 : 0), base - hh + 2, 1, hh - 2);
  }
}

export function drawClouds(ctx, w, hy, t, pal, alpha = 0.55) {
  ctx.fillStyle = mix(pal.bot, '#ffffff', 0.5);
  ctx.globalAlpha = alpha;
  const shapes = [[[3, 3, 14, 3], [0, 4, 20, 3], [6, 1, 8, 3]], [[2, 2, 10, 2], [0, 3, 14, 2], [4, 0, 6, 3]]];
  for (let i = 0; i < 5; i++) {
    const s = shapes[i % 2];
    const x = ((t * (1.4 + i * 0.5) + i * 47) % (w + 50)) - 30;
    const y = 6 + ((i * 17) % Math.max(10, Math.floor(hy * 0.5)));
    for (const [rx, ry, rw, rh] of s) ctx.fillRect(Math.round(x + rx), y + ry, rw, rh);
  }
  ctx.globalAlpha = 1;
}

let heroCv = null;
export function drawHeroOnHill(ctx, w, h, hy, alpha, t) {
  if (!heroCv) heroCv = sprites().hero.up.idle.toCanvas();
  const x = Math.round(w / 2 - 8);
  const feet = ridge(2, w / 2, hy) + 15;
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x + 8, feet, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.drawImage(heroCv, x, feet - 16 + Math.round(Math.sin(t * 1.6) * 0.5));
  ctx.globalAlpha = 1;
}

// ───────────── a self-running dawn scene (title + slots) ─────────────
export class DawnScene {
  constructor(canvas, { k = 0.8, dim = 0, hero = true } = {}) {
    this.canvas = canvas;
    this.k = k;
    this.dim = dim;
    this.hero = hero;
    this.t = 0;
    this.scale = 4;
    this.last = '';
    const r = mulberry32(5150);
    this.birds = Array.from({ length: 4 }, (_, i) => ({ x: r() * 1.2, y: 0.12 + r() * 0.18, s: 5 + r() * 4, ph: r() * 6 + i }));
    this.motes = Array.from({ length: 26 }, () => ({ x: r(), y: r(), s: 2 + r() * 4, ph: r() * 6 }));
  }

  draw(dt) {
    this.t += dt;
    const size = `${this.canvas.clientWidth}x${this.canvas.clientHeight}`;
    if (size !== this.last) {
      this.last = size;
      this.scale = pixelScale(this.canvas.clientWidth, this.canvas.clientHeight, { target: 100, tall: 120, min: 3, max: 8 });
    }
    const { ctx, w, h } = fitCanvas(this.canvas, this.scale);
    const t = this.t;
    const pal = palette(this.k);
    const hy = Math.round(h * 0.62);

    drawSky(ctx, w, h, hy, pal);
    drawClouds(ctx, w, hy, t, pal);
    drawSun(ctx, Math.round(w * 0.64), hy - 5, 11);

    // birds
    ctx.fillStyle = '#2a1f45';
    for (const b of this.birds) {
      const x = ((b.x * w + t * b.s) % (w + 20)) - 10;
      const y = Math.round(b.y * hy + Math.sin(t + b.ph) * 2);
      const up = Math.sin(t * 8 + b.ph) > 0;
      ctx.fillRect(x, y + (up ? 0 : 1), 2, 1);
      ctx.fillRect(x + 2, y + (up ? 1 : 0), 1, 1);
      ctx.fillRect(x + 3, y + (up ? 0 : 1), 2, 1);
    }

    drawHills(ctx, w, h, hy, pal);
    drawGrass(ctx, w, h, hy, pal, t);
    if (this.hero) drawHeroOnHill(ctx, w, h, hy, 1, t);

    // drifting golden motes
    ctx.fillStyle = '#fff3b0';
    for (const m of this.motes) {
      const x = (m.x * w + Math.sin(t * 0.6 + m.ph) * 6 + t * 1.5) % w;
      const y = h - ((m.y * h + t * m.s) % h);
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + m.ph);
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    ctx.globalAlpha = 1;

    if (this.dim > 0) {
      ctx.fillStyle = `rgba(10, 6, 30, ${this.dim})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

// tiles.js — world art: grass, tall grass, paths, water, trees, props. All painted in code.
// Each builder returns Pix buffers (16×16). maprender.js stitches them into the map.

import { Pix } from './pix.js';
import { mulberry32 } from './util.js';

export const G = {
  base: '#5eb34a', dark: '#4c9c3f', deep: '#3f8636', light: '#74c85a', hi: '#9be07a',
};

// Draw a 1px dark edge *inside* a shape (keeps the tile at 16×16).
function innerOutline(p, color) {
  const mark = [];
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (!p.solid(x, y)) continue;
      if (!p.solid(x - 1, y) || !p.solid(x + 1, y) || !p.solid(x, y - 1) || !p.solid(x, y + 1)) mark.push([x, y]);
    }
  }
  mark.forEach(([x, y]) => p.set(x, y, color));
  return p;
}

// ───────── ground ─────────
export function grassTile(variant) {
  const r = mulberry32(1000 + variant * 77);
  const p = new Pix(16, 16).rect(0, 0, 16, 16, G.base);
  for (let i = 0; i < 16; i++) p.set((r() * 16) | 0, (r() * 16) | 0, G.dark);
  for (let i = 0; i < 9; i++) p.set((r() * 16) | 0, (r() * 16) | 0, G.light);
  for (let i = 0; i < 2 + (variant % 2); i++) {
    const x = 2 + ((r() * 12) | 0), y = 3 + ((r() * 11) | 0);
    p.set(x, y, G.hi); p.set(x - 1, y - 1, G.light); p.set(x + 1, y - 1, G.light);
  }
  return p;
}

const PATH = { base: '#c9a265', dark: '#b58b4f', light: '#ddb97d', pebble: '#9e7a47' };

// mask bits: 1=N 2=E 4=S 8=W  → "that neighbour is NOT path" (grass blends in on that side)
export function pathTile(mask, variant = 0) {
  const r = mulberry32(900 + mask * 31 + variant * 7);
  const p = new Pix(16, 16).rect(0, 0, 16, 16, PATH.base);
  for (let i = 0; i < 14; i++) p.set((r() * 16) | 0, (r() * 16) | 0, PATH.dark);
  for (let i = 0; i < 9; i++) p.set((r() * 16) | 0, (r() * 16) | 0, PATH.light);
  for (let i = 0; i < 2; i++) {
    const x = (r() * 14) | 0, y = (r() * 14) | 0;
    p.set(x, y, PATH.pebble); p.set(x + 1, y, PATH.pebble);
  }
  const cols = [G.base, G.dark, G.light, G.base];
  const fringe = (side) => {
    for (let i = 0; i < 16; i++) {
      const d = 1 + (r() < 0.55 ? 1 : 0) + (r() < 0.18 ? 1 : 0);
      for (let k = 0; k < d; k++) {
        const [x, y] = side === 'N' ? [i, k] : side === 'S' ? [i, 15 - k] : side === 'W' ? [k, i] : [15 - k, i];
        p.set(x, y, cols[(r() * cols.length) | 0]);
      }
    }
  };
  if (mask & 1) fringe('N');
  if (mask & 2) fringe('E');
  if (mask & 4) fringe('S');
  if (mask & 8) fringe('W');
  return p;
}

const WATER = { base: '#3f82c9', dark: '#3370b2', light: '#7db8ea', foam: '#c9e9f7', sand: '#dcc78d' };

// mask bits as pathTile: neighbour is LAND on that side → draw a sandy shore
export function waterTile(frame, mask = 0) {
  const p = new Pix(16, 16).rect(0, 0, 16, 16, WATER.base);
  const r = mulberry32(555);
  for (let i = 0; i < 6; i++) {
    const x = (r() * 12) | 0, y = (r() * 14) | 0;
    const off = (frame * 2 + i) % 5;
    p.rect(x + (off % 3), y, 3, 1, WATER.light);
    p.rect(x + 1 + (off % 2), y + 1, 2, 1, WATER.dark);
  }
  const shore = (side) => {
    for (let i = 0; i < 16; i++) {
      const put = (k, c) => {
        const [x, y] = side === 'N' ? [i, k] : side === 'S' ? [i, 15 - k] : side === 'W' ? [k, i] : [15 - k, i];
        p.set(x, y, c);
      };
      put(0, WATER.sand); put(1, WATER.sand);
      if (i % 4 !== frame % 4) put(2, WATER.foam);
    }
  };
  if (mask & 1) shore('N');
  if (mask & 2) shore('E');
  if (mask & 4) shore('S');
  if (mask & 8) shore('W');
  return p;
}

// ───────── tall grass (animated) ─────────
export function tallGrassFrames() {
  const rows = [
    { y: 8, n: 6, c: ['#26692f', '#2f7d3a', '#3f9a47'], h: [4, 6] },
    { y: 12, n: 6, c: ['#2f7d3a', '#3fa046', '#5dc255'], h: [5, 7] },
    { y: 15, n: 6, c: ['#3fa046', '#5dc255', '#8fe36c'], h: [5, 8] },
  ];
  const r = mulberry32(4242);
  const blades = [];
  rows.forEach((row, ri) => {
    for (let i = 0; i < row.n; i++) {
      blades.push({
        x: Math.round((i + 0.5) * (16 / row.n) + (r() - 0.5) * 2),
        y: row.y + ((r() * 2) | 0),
        h: row.h[0] + ((r() * (row.h[1] - row.h[0] + 1)) | 0),
        phase: r(), c: row.c, ri,
      });
    }
  });
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const p = new Pix(16, 16).rect(0, 0, 16, 16, '#3a8a3a');
    const r2 = mulberry32(77);
    for (let i = 0; i < 18; i++) p.set((r2() * 16) | 0, (r2() * 16) | 0, '#2d7433');
    for (const b of blades) {
      const sway = Math.round(Math.sin((f / 4 + b.phase) * Math.PI * 2) * 1.4);
      for (let k = 0; k < b.h; k++) {
        const t = k / b.h;
        const x = b.x + Math.round(sway * t * t * 1.6);
        const y = b.y - k;
        const col = t < 0.34 ? b.c[0] : t < 0.75 ? b.c[1] : b.c[2];
        p.set(x, y, col);
        if (t < 0.65) p.set(x + 1, y, col);
      }
    }
    frames.push(p);
  }
  return frames;
}

// the few blades drawn in front of the hero's legs while standing in tall grass
export function grassOverlayFrames() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const p = new Pix(16, 8);
    const bl = [[1, 7, 5], [4, 7, 6], [7, 7, 5], [10, 7, 6], [13, 7, 5]];
    bl.forEach(([x, y, h], i) => {
      const sway = f ? (i % 2 ? 1 : -1) : (i % 2 ? -1 : 1);
      for (let k = 0; k < h; k++) {
        const t = k / h;
        const xx = x + (t > 0.5 ? sway : 0);
        const col = t < 0.4 ? '#3fa046' : t < 0.8 ? '#5dc255' : '#9bee74';
        p.set(xx, y - k, col); p.set(xx + 1, y - k, col);
      }
    });
    frames.push(p);
  }
  return frames;
}

// ───────── scenery (transparent background; drawn over grass) ─────────
export function treeTile(variant) {
  const p = new Pix(16, 16);
  p.ellipse(8, 14.8, 5.5, 1.3, '#00000033');
  p.rect(7, 10, 3, 5, '#7a4f2a'); p.rect(9, 10, 1, 5, '#5e3b1a'); p.rect(6, 14, 5, 1, '#5e3b1a');
  if (variant % 3 === 2) {
    // dark pine
    const cols = ['#1f5e3c', '#277a4a', '#3a9a5c'];
    [[2, 7, 6], [5, 9, 7], [8, 10, 7]].forEach(([top, hw, y], i) => {
      for (let yy = 0; yy < y - top + 2; yy++) {
        const half = Math.min(hw, 1 + Math.floor(yy * (hw / (y - top + 2))));
        p.rect(8 - half, top + i * 2 + yy - 1, half * 2, 1, cols[i]);
      }
    });
    p.rect(7, 1, 2, 2, cols[2]);
    return innerOutline(p, '#123a26');
  }
  p.ellipse(8, 6.6, 7.2, 6.2, '#2d7a38');
  p.ellipse(7.6, 5.6, 6.1, 5.1, variant % 3 ? '#3f9d48' : '#4aa84a');
  p.ellipse(6, 3.9, 3, 2.3, '#74d062');
  for (let x = 2; x < 14; x++) if (p.solid(x, 11)) p.set(x, 11, '#25682f');
  p.set(10, 7, '#25682f'); p.set(4, 8, '#25682f'); p.set(11, 4, '#58b653');
  return innerOutline(p, '#173d22');
}

export function bushTile() {
  const p = new Pix(16, 16);
  p.ellipse(8, 14.6, 6, 1.3, '#00000033');
  p.ellipse(8, 10.5, 6.2, 4.4, '#2f8a3c');
  p.ellipse(7.2, 9.6, 5, 3.4, '#43a84d');
  p.ellipse(5.5, 8.4, 2.4, 1.6, '#76d468');
  [[10, 10], [6, 12], [12, 12]].forEach(([x, y]) => p.set(x, y, '#e63946'));
  return innerOutline(p, '#173d22');
}

export function rockTile() {
  const p = new Pix(16, 16);
  p.ellipse(8, 14.6, 6.5, 1.3, '#00000033');
  p.ellipse(8, 10.5, 6.4, 4.6, '#8c95a4');
  p.ellipse(6.5, 8.8, 4, 2.6, '#b9c1cd');
  p.rect(10, 11, 4, 2, '#6d7584');
  p.line(8, 8, 9, 12, '#5d6573');
  [[4, 12], [5, 13], [11, 8]].forEach(([x, y]) => p.set(x, y, '#6ba04a'));
  return innerOutline(p, '#2a2f3a');
}

const FLOWERS = {
  1: ['#ffffff', '#ffd23f'],
  2: ['#ffd23f', '#e08a00'],
  3: ['#ff9fc2', '#ffe38a'],
  4: ['#8fb8ff', '#ffffff'],
};
export function flowerTile(type, variant = 0) {
  const r = mulberry32(300 + type * 13 + variant * 29);
  const p = new Pix(16, 16);
  const [petal, center] = FLOWERS[type];
  const n = 2 + (variant % 2);
  for (let i = 0; i < n; i++) {
    const x = 2 + ((r() * 11) | 0), y = 3 + ((r() * 10) | 0);
    p.set(x, y + 1, '#3f8636'); p.set(x, y + 2, '#3f8636');
    p.set(x - 1, y, petal); p.set(x + 1, y, petal); p.set(x, y - 1, petal); p.set(x, y + 1, petal);
    p.set(x, y, center);
  }
  return p;
}

export function fenceTile() {
  const p = new Pix(16, 16);
  p.rect(0, 6, 16, 2, '#b07d44'); p.rect(0, 11, 16, 2, '#b07d44');
  p.rect(0, 7, 16, 1, '#8a5a2b'); p.rect(0, 12, 16, 1, '#8a5a2b');
  p.rect(1, 3, 3, 12, '#8a5a2b'); p.rect(12, 3, 3, 12, '#8a5a2b');
  p.rect(1, 3, 1, 12, '#b07d44'); p.rect(12, 3, 1, 12, '#b07d44');
  return innerOutline(p, '#3b2412');
}

export function signTile() {
  const p = new Pix(16, 16);
  p.ellipse(8, 14.8, 4.5, 1.1, '#00000033');
  p.rect(7, 9, 2, 6, '#7a4f2a');
  p.rect(1, 2, 14, 8, '#c8914f');
  p.rect(1, 8, 14, 2, '#a8743c');
  p.rect(3, 4, 10, 1, '#5a3a1a'); p.rect(3, 6, 7, 1, '#5a3a1a');
  p.set(2, 3, '#e6b878'); p.set(13, 3, '#e6b878');
  return innerOutline(p, '#3b2412');
}

export function campfireBase() {
  const p = new Pix(16, 16);
  p.ellipse(8, 12.5, 7, 3.2, '#2b1d1488');
  // stone ring
  [[2, 11], [4, 13], [7, 14], [10, 13], [12, 11], [11, 9], [3, 9]].forEach(([x, y]) => {
    p.rect(x, y, 2, 2, '#8c95a4'); p.set(x, y, '#b9c1cd');
  });
  // crossed logs
  p.line(4, 12, 11, 9, '#6a4326'); p.line(4, 13, 11, 10, '#8a5a2b');
  p.line(4, 9, 11, 12, '#6a4326'); p.line(4, 10, 11, 13, '#8a5a2b');
  p.ellipse(8, 11, 2.5, 1.2, '#2b1d14');
  return innerOutline(p, '#2b1d14');
}

export function flameFrames() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const p = new Pix(16, 16);
    const lean = [0, 1, -1][f];
    p.ellipse(8 + lean * 0.4, 8, 3.2, 5, '#ff7a1a');
    p.ellipse(8 + lean * 0.3, 8.6, 2.2, 3.8, '#ffb62e');
    p.ellipse(8, 9.6, 1.2, 2.2, '#fff2a8');
    p.set(8 + lean, 2 + f % 2, '#ff7a1a'); p.set(8 + lean, 3, '#ff7a1a');
    p.set(5 + f, 4 - (f % 2), '#ffd93d'); p.set(11 - f, 3 + f, '#ffd93d');
    frames.push(p);
  }
  return frames;
}

export function standingStoneFrames() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const p = new Pix(16, 16);
    p.ellipse(8, 14.8, 5.5, 1.2, '#00000033');
    p.rect(4, 5, 8, 10, '#8d97ad');
    p.ellipse(8, 5.6, 4, 2.6, '#8d97ad');
    p.rect(4, 5, 2, 10, '#b4bdd0'); p.rect(10, 5, 2, 10, '#5f6a82');
    p.rect(4, 14, 8, 1, '#5f6a82');
    [[4, 13], [5, 14], [10, 14], [11, 13]].forEach(([x, y]) => p.set(x, y, '#6ba04a'));
    // carved die face
    p.rect(5, 6, 6, 6, '#2a3347');
    const glow = ['#4fb7c7', '#8ff3ff', '#d6fcff'][f];
    [[6, 7], [9, 7], [7, 9], [6, 10], [9, 10]].forEach(([x, y]) => p.set(x, y, glow));
    innerOutline(p, '#2a2f3a');
    frames.push(p);
  }
  return frames;
}

export function thornTile(variant = 0) {
  const r = mulberry32(8800 + variant);
  const p = new Pix(16, 16).rect(0, 0, 16, 16, '#1d3a24');
  for (let i = 0; i < 6; i++) {
    const x0 = (r() * 16) | 0, y0 = (r() * 16) | 0;
    p.line(x0, y0, (x0 + 8 + ((r() * 8) | 0)) % 16, (y0 + 6 + ((r() * 8) | 0)) % 16, '#2f5a33');
  }
  for (let i = 0; i < 12; i++) {
    const x = (r() * 15) | 0, y = (r() * 15) | 0;
    p.set(x, y, '#c0392b'); p.set(x + 1, y - 1, '#e8665a');
  }
  for (let i = 0; i < 10; i++) p.set((r() * 16) | 0, (r() * 16) | 0, '#122618');
  return p;
}

// ───────── everything, built once ─────────
let cache = null;
export function tileArt() {
  if (cache) return cache;
  const pathMasks = {};
  for (let m = 0; m < 16; m++) pathMasks[m] = [pathTile(m, 0), pathTile(m, 1)];
  const water = [0, 1, 2].map((f) => {
    const byMask = {};
    for (let m = 0; m < 16; m++) byMask[m] = waterTile(f, m);
    return byMask;
  });
  cache = {
    grass: [0, 1, 2, 3].map(grassTile),
    path: pathMasks,
    water,
    tall: tallGrassFrames(),
    overlay: grassOverlayFrames(),
    trees: [0, 1, 2, 3].map(treeTile),
    bush: bushTile(),
    rock: rockTile(),
    flowers: { 1: [0, 1].map((v) => flowerTile(1, v)), 2: [0, 1].map((v) => flowerTile(2, v)), 3: [0, 1].map((v) => flowerTile(3, v)), 4: [0, 1].map((v) => flowerTile(4, v)) },
    fence: fenceTile(),
    sign: signTile(),
    campfire: campfireBase(),
    flame: flameFrames(),
    stone: standingStoneFrames(),
    thorn: [0, 1, 2].map(thornTile),
  };
  return cache;
}

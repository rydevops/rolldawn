// world.js — builds the Verdant Reach map (deterministically, from a seed) and answers questions about it.
// This file is pure data + logic: no drawing (see maprender.js / field.js).

import { WORLD } from './config.js';
import { mulberry32 } from './util.js';
import { AREAS } from './story.js';

export const GROUND = { GRASS: 0, PATH: 1, WATER: 2 };
const SOLID = new Set(['tree', 'bush', 'rock', 'fence', 'sign', 'campfire', 'stone', 'thorn']);

export function generateWorld() {
  const { w, h, seed, spawn, campfire } = WORLD;
  const r = mulberry32(seed);
  const idx = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  const world = {
    w, h,
    ground: new Uint8Array(w * h),
    tall: new Uint8Array(w * h),
    obj: new Array(w * h).fill(''),
    flower: new Uint8Array(w * h),
    pick: new Uint8Array(w * h),        // per-tile art variant
    pathMask: new Uint8Array(w * h),
    waterMask: new Uint8Array(w * h),
    info: {},                           // 'x,y' → { kind: 'sign'|'stone'|'campfire', id }
    pathX: [],                          // path centre x for each row (used to place signs / gate)
  };
  for (let i = 0; i < w * h; i++) world.pick[i] = (r() * 256) | 0;

  const nearSpawn = (x, y, d) => Math.hypot(x - spawn.x, y - spawn.y) < d;

  // ── 1. the road north (meandering) ──
  let cx = spawn.x;
  for (let y = h - 4; y >= 2; y--) {
    const target = 24 + Math.round(5 * Math.sin(y / 8.5) + 3 * Math.sin(y / 3.7 + 1));
    cx += Math.max(-1, Math.min(1, target - cx));
    cx = Math.max(10, Math.min(w - 11, cx));
    world.pathX[y] = cx;
    const wide = y > 47;
    for (let x = cx - (wide ? 1 : 0); x <= cx + 1; x++) world.ground[idx(x, y)] = GROUND.PATH;
  }
  // spawn clearing
  for (let y = 50; y <= 58; y++) {
    for (let x = 19; x <= 30; x++) {
      if (((x - 24.5) / 5.2) ** 2 + ((y - 54.5) / 3.4) ** 2 < 1) world.ground[idx(x, y)] = GROUND.PATH;
    }
  }

  // ── 2. ponds ──
  const ponds = [[37, 41, 5.2, 4.2], [9, 23, 3.6, 2.8], [11, 50, 2.6, 2.1], [38, 14, 3.6, 4.4]];
  for (const [px, py, rx, ry] of ponds) {
    for (let y = Math.floor(py - ry - 2); y <= py + ry + 2; y++) {
      for (let x = Math.floor(px - rx - 2); x <= px + rx + 2; x++) {
        if (!inb(x, y) || world.ground[idx(x, y)] === GROUND.PATH) continue;
        const d = ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2;
        if (d < 1 + (r() - 0.5) * 0.4) world.ground[idx(x, y)] = GROUND.WATER;
      }
    }
  }

  const free = (x, y) => inb(x, y) && world.ground[idx(x, y)] === GROUND.GRASS && !world.obj[idx(x, y)];
  const put = (x, y, kind) => { if (free(x, y)) world.obj[idx(x, y)] = kind; };

  // ── 3. forest border ──
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      const chance = d < 2 ? 1 : d === 2 ? 0.92 : d === 3 ? 0.55 : d === 4 ? 0.2 : 0;
      if (r() < chance) put(x, y, 'tree');
    }
  }

  // ── 4. groves ──
  for (let g = 0; g < 16; g++) {
    const gx = 6 + ((r() * (w - 12)) | 0), gy = 6 + ((r() * (h - 14)) | 0);
    if (nearSpawn(gx, gy, 9)) continue;
    const rad = 2 + r() * 1.6;
    for (let y = Math.floor(gy - rad); y <= gy + rad; y++) {
      for (let x = Math.floor(gx - rad); x <= gx + rad; x++) {
        if (Math.hypot(x - gx, y - gy) < rad && r() < 0.62) put(x, y, 'tree');
      }
    }
  }

  // ── 5. rocks & bushes ──
  for (let i = 0; i < 70; i++) {
    const x = 3 + ((r() * (w - 6)) | 0), y = 3 + ((r() * (h - 6)) | 0);
    if (nearSpawn(x, y, 4.5)) continue;
    put(x, y, i % 2 ? 'bush' : 'rock');
  }

  // ── 6. gate, signs, shrine, campfire ──
  const gateY = 4;
  const gx0 = world.pathX[gateY] - 1, gx1 = world.pathX[gateY] + 1;
  for (let y = gateY - 1; y <= gateY; y++) {
    for (let x = gx0 - 4; x <= gx1 + 4; x++) {
      if (inb(x, y) && world.ground[idx(x, y)] !== GROUND.WATER) { world.obj[idx(x, y)] = 'thorn'; }
    }
  }
  for (const side of [-1, 1]) {
    for (let k = 2; k <= 5; k++) {
      const x = side < 0 ? world.pathX[8] - 1 - k : world.pathX[8] + 1 + k;
      put(x, 8, 'fence');
    }
  }
  const placeThing = (x, y, kind, id) => {
    world.ground[idx(x, y)] = world.ground[idx(x, y)] === GROUND.WATER ? GROUND.GRASS : world.ground[idx(x, y)];
    world.obj[idx(x, y)] = kind;
    world.info[`${x},${y}`] = { kind, id };
  };
  placeThing(campfire.x, campfire.y, 'campfire', 'camp');
  placeThing(22, 51, 'sign', 'welcome');
  placeThing(world.pathX[30] + 3, 30, 'sign', 'mid');
  placeThing(world.pathX[7] - 3, 7, 'sign', 'north');
  placeThing(15, 44, 'stone', 'shardstone');

  // keep the spawn clearing and the road free of clutter
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (world.ground[i] === GROUND.PATH && world.obj[i] && world.obj[i] !== 'campfire' && world.obj[i] !== 'sign') {
        if (world.obj[i] !== 'thorn') world.obj[i] = '';
      }
      if (nearSpawn(x, y, 3.2) && world.obj[i] && world.obj[i] !== 'campfire' && world.obj[i] !== 'sign') world.obj[i] = '';
    }
  }
  // the campfire & signs keep a ring of open ground so they stay reachable
  for (const [tx, ty] of [[campfire.x, campfire.y], [22, 51], [15, 44]]) {
    for (let y = ty - 1; y <= ty + 1; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        if (inb(x, y) && !world.info[`${x},${y}`] && world.obj[idx(x, y)] && world.obj[idx(x, y)] !== 'thorn') world.obj[idx(x, y)] = '';
      }
    }
  }

  // ── 7. tall (waving) grass patches ──
  const patches = [[19, 49, 3.4], [30, 47, 3.2], [17, 41, 3.4], [29, 37, 3.8]];
  for (let i = 0; i < 15; i++) patches.push([7 + ((r() * (w - 14)) | 0), 8 + ((r() * 40) | 0), 1.8 + r() * 2.4]);
  for (const [px, py, rad] of patches) {
    for (let y = Math.floor(py - rad - 1); y <= py + rad + 1; y++) {
      for (let x = Math.floor(px - rad - 1); x <= px + rad + 1; x++) {
        if (!inb(x, y) || nearSpawn(x, y, 5)) continue;
        if (Math.hypot(x - px, y - py) < rad * (0.7 + r() * 0.5) && free(x, y)) world.tall[idx(x, y)] = 1;
      }
    }
  }

  // ── 8. flowers ──
  for (let i = 0; i < w * h; i++) {
    if (world.ground[i] === GROUND.GRASS && !world.obj[i] && !world.tall[i] && r() < 0.075) {
      world.flower[i] = r() < 0.4 ? 1 : 1 + ((r() * 4) | 0);
    }
  }

  // ── 9. edge masks for pretty path / shore blending ──
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      const g = (xx, yy) => (inb(xx, yy) ? world.ground[idx(xx, yy)] : -1);
      if (world.ground[i] === GROUND.PATH) {
        let m = 0;
        if (g(x, y - 1) === GROUND.GRASS || g(x, y - 1) === GROUND.WATER) m |= 1;
        if (g(x + 1, y) === GROUND.GRASS || g(x + 1, y) === GROUND.WATER) m |= 2;
        if (g(x, y + 1) === GROUND.GRASS || g(x, y + 1) === GROUND.WATER) m |= 4;
        if (g(x - 1, y) === GROUND.GRASS || g(x - 1, y) === GROUND.WATER) m |= 8;
        world.pathMask[i] = m;
      } else if (world.ground[i] === GROUND.WATER) {
        let m = 0;
        if (g(x, y - 1) !== GROUND.WATER && g(x, y - 1) !== -1) m |= 1;
        if (g(x + 1, y) !== GROUND.WATER && g(x + 1, y) !== -1) m |= 2;
        if (g(x, y + 1) !== GROUND.WATER && g(x, y + 1) !== -1) m |= 4;
        if (g(x - 1, y) !== GROUND.WATER && g(x - 1, y) !== -1) m |= 8;
        world.waterMask[i] = m;
      }
    }
  }

  return world;
}

export const tileIndex = (world, x, y) => y * world.w + x;
export const inBounds = (world, x, y) => x >= 0 && y >= 0 && x < world.w && y < world.h;

export function isSolid(world, x, y) {
  if (!inBounds(world, x, y)) return true;
  const i = y * world.w + x;
  if (world.ground[i] === GROUND.WATER) return true;
  return SOLID.has(world.obj[i]);
}

export const isTallGrass = (world, x, y) => inBounds(world, x, y) && world.tall[y * world.w + x] === 1;
export const infoAt = (world, x, y) => world.info[`${x},${y}`] || null;

// How deep into the Reach is this tile? (1 = safe meadow … 4 = Thornward Road)
export function zoneFor(y) {
  const d = WORLD.spawn.y - y;
  return d < 12 ? 1 : d < 28 ? 2 : d < 42 ? 3 : 4;
}
export const areaName = (y) => AREAS[zoneFor(y) - 1];

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

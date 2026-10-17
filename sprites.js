// sprites.js — all character art, painted in code with pix.js (no image files).
//   hero:   16×16 walk frames (down / up / left / right) + a battle pose set
//   mobs:   one painted sprite per monster in mobs.js
// Everything is built once (lazily) and cached as Pix buffers; call .toCanvas() to draw them.

import { Pix, lighten, darken } from './pix.js';

const OUT = '#1a1423';

// ───────────────────────────── HERO ─────────────────────────────
const HP = {
  h: '#8a3a24', H: '#bd5a30',
  s: '#f4c9a1', S: '#d99c78',
  e: '#1a1423',
  c: '#e0485a', C: '#a02a3c',
  t: '#2f9c8d', T: '#1f6e67',
  b: '#f0c040',
  p: '#5a4a82',
  B: '#6a4326',
};

const HERO_ROWS = {
  down: [
    '...hhhhhh...',
    '..hhhHhhhh..',
    '.hhHhhhhhhh.',
    '.hhhhhhhhhh.',
    '.hhsssssshh.',
    '.hssessessh.',
    '.hsssSSsssh.',
    '..hssssssh..',
    '...cccccc...',
    '.tttcCCcttt.',
    '.tTttbbttTt.',
    '.sTttttttTs.',
  ],
  up: [
    '...hhhhhh...',
    '..hhhHhhhh..',
    '.hhHhhhhhhh.',
    '.hhhhhhhhhh.',
    '.hhhhhhhhhh.',
    '.hhhhhhhhhh.',
    '.hhhhhhhhhh.',
    '..hhhhhhhh..',
    '...cccccc...',
    '.tttthhtttt.',
    '.tTtthhttTt.',
    '.sTttttttTs.',
  ],
  right: [
    '...hhhhhh...',
    '..hhhHhhhh..',
    '.hhHhhhhhhh.',
    '.hhhhhhhhss.',
    '.hhhhhhssss.',
    'hhhhhhssses.',
    'hhhhhhsssSs.',
    'hhhhhhssss..',
    'hh.ccccccc..',
    '..tttttttt..',
    '..ttttbbttt.',
    '..TttttttsS.',
  ],
};

const LEGS = {
  idle: { down: ['..pppppppp..', '..BBB..BBB..'], up: ['..pppppppp..', '..BBB..BBB..'], right: ['...pppppp...', '...BBBBBBB..'] },
  a: { down: ['..pppppBBB..', '..BBB.......'], up: ['..pppppBBB..', '..BBB.......'], right: ['..pppp.ppp..', '.BBBB..BBB..'] },
  b: { down: ['..BBBppppp..', '.......BBB..'], up: ['..BBBppppp..', '.......BBB..'], right: ['...ppppp....', '....BBBB....'] },
};

function heroBody(dir, legs) {
  const key = dir === 'left' ? 'right' : dir;
  const rows = [...HERO_ROWS[key], ...LEGS[legs][key]];
  return Pix.fromRows(rows, HP);
}

function heroFrame(dir, legs) {
  let body = heroBody(dir, legs);
  if (dir === 'left') body = body.flipX();
  const o = body.outline(OUT); // 14 × 16
  return o.padTo(16, 16, 1, 0);
}

function buildHero() {
  const frames = {};
  for (const dir of ['down', 'up', 'left', 'right']) {
    frames[dir] = {
      idle: heroFrame(dir, 'idle'),
      // walk cycle: step A, stand, step B, stand
      walk: [heroFrame(dir, 'a'), heroFrame(dir, 'idle'), heroFrame(dir, 'b'), heroFrame(dir, 'idle')],
    };
  }
  return frames;
}

// Battle hero: side view facing right, sword in hand. pose = 'idle' | 'attack'
function heroBattle(pose) {
  const c = new Pix(30, 22);
  const body = heroBody('right', 'idle');
  c.blit(body, 4, 5);
  // sword (drawn before the outline so it gets wrapped in the same dark edge)
  const steel = '#dfe8f2', steelD = '#8fa3ba', gold = '#f0c040';
  if (pose === 'idle') {
    // held up and forward
    c.line(16, 15, 22, 5, steelD);
    c.line(17, 15, 23, 5, steel);
    c.line(14, 16, 18, 14, gold);
    c.set(15, 17, gold);
    c.set(13, 15, '#6a4326');
  } else {
    // thrust forward
    c.line(16, 16, 27, 14, steelD);
    c.line(16, 15, 27, 13, steel);
    c.line(15, 13, 16, 18, gold);
    c.set(14, 16, '#6a4326');
  }
  return c.outline(OUT);
}

// ───────────────────────────── MOBS ─────────────────────────────
function slime() {
  const base = '#58c96a', light = '#9cf0a8', dark = '#2f9a4a', deep = '#1f6e3a';
  const p = new Pix(20, 16);
  p.ellipse(10, 9, 9, 7, base);
  p.ellipse(11, 3.2, 3, 2.4, base); // top bump
  for (let y = 14; y < 16; y++) for (let x = 0; x < 20; x++) p.clear(x, y); // flat bottom
  for (let x = 0; x < 20; x++) {
    if (p.solid(x, 13)) p.set(x, 13, dark);
    if (p.solid(x, 12) && (x % 3 !== 0)) p.set(x, 12, dark);
  }
  p.ellipse(6.5, 6, 3, 1.7, light);
  p.set(5, 4, '#ffffff'); p.set(6, 4, '#ffffff');
  p.set(16, 7, light); p.set(16, 8, light);
  // face (looks left, towards the hero)
  p.rect(6, 8, 2, 3, '#ffffff'); p.rect(12, 8, 2, 3, '#ffffff');
  p.rect(6, 9, 1, 2, OUT); p.rect(12, 9, 1, 2, OUT);
  p.set(9, 12, deep); p.set(10, 12, deep); p.set(8, 11, deep); p.set(11, 11, deep);
  return p.outline(OUT);
}

function rat() {
  const fur = '#9a7350', furD = '#6f5036', furL = '#c19a6b', pink = '#e58a9b';
  const p = new Pix(26, 16);
  // tail
  p.line(21, 10, 23, 8, pink); p.line(23, 8, 24, 5, pink); p.set(24, 4, pink);
  // body + head
  p.ellipse(14, 9, 7.5, 4.5, fur);
  p.ellipse(6.5, 9, 4.2, 3.4, furL);
  p.rect(2, 9, 3, 2, furL); // snout
  p.set(1, 10, OUT); p.set(1, 9, pink); // nose
  // belly + shading
  for (let x = 8; x < 21; x++) if (p.solid(x, 12)) p.set(x, 12, furD);
  for (let x = 8; x < 21; x++) if (p.solid(x, 5)) p.set(x, 5, furD);
  // ear
  p.ellipse(8, 5, 2.2, 2.2, furL);
  p.ellipse(8, 5.2, 1.1, 1.1, pink);
  // eye + whisker + teeth
  p.set(5, 8, '#ff3b3b'); p.set(5, 7, OUT);
  p.set(3, 11, '#ffffff'); p.set(4, 11, '#ffffff');
  p.line(0, 9, 2, 8, '#d9c7a8');
  // thistle spikes along the back
  const sp = '#b45ed6', spL = '#e0a4f2', stem = '#4aa04a';
  [[10, 5], [13, 4], [16, 4], [19, 5]].forEach(([x, y]) => {
    p.set(x, y + 1, stem);
    p.rect(x, y - 2, 2, 3, sp);
    p.set(x, y - 3, spL); p.set(x, y - 2, spL);
  });
  // feet
  p.rect(10, 13, 2, 2, furD); p.rect(17, 13, 2, 2, furD);
  p.rect(7, 13, 2, 2, furD);
  return p.outline(OUT);
}

function sporeling() {
  const cap = '#8b5cc7', capL = '#b98cf0', capD = '#5a3a96';
  const stem = '#f1e3c2', stemD = '#cdb88f';
  const p = new Pix(22, 24);
  p.ellipse(11, 8.5, 10, 7.5, cap);
  for (let y = 13; y < 24; y++) for (let x = 0; x < 22; x++) if (y > 13) p.clear(x, y);
  p.rect(0, 13, 22, 1, capD);
  p.ellipse(7, 5, 3.4, 1.8, capL);
  // spots
  [[5, 7, 2.2], [14, 5, 1.9], [16, 9, 1.5], [10, 9.5, 1.5]].forEach(([x, y, r]) => p.ellipse(x, y, r, r, '#f4eaff'));
  // stem
  p.rect(6, 14, 10, 8, stem);
  p.rect(14, 14, 2, 8, stemD);
  p.rect(6, 21, 10, 1, stemD);
  // gills under cap
  for (let x = 4; x < 18; x += 2) p.set(x, 13, '#d9c9f5');
  // face (angry, looks left)
  p.rect(7, 16, 2, 3, OUT); p.rect(11, 16, 2, 3, OUT);
  p.set(7, 16, '#ffffff'); p.set(11, 16, '#ffffff');
  p.set(6, 15, OUT); p.set(7, 15, OUT); p.set(12, 15, OUT); p.set(13, 15, OUT);
  p.rect(8, 20, 4, 1, '#7a2e3a');
  // stubby feet
  p.ellipse(8, 22.5, 2.6, 1.6, stemD); p.ellipse(14, 22.5, 2.6, 1.6, stemD);
  return p.outline(OUT);
}

function wolf() {
  const fur = '#7f8a99', furD = '#58626f', furL = '#aab4c2', belly = '#d3d9e0';
  const p = new Pix(36, 26);
  // tail
  p.line(30, 11, 33, 7, furD); p.line(31, 11, 34, 8, fur); p.line(32, 12, 35, 8, fur); p.set(34, 6, furL); p.set(35, 7, furL);
  // legs (behind then front)
  [[10, 16], [14, 17], [24, 17], [28, 16]].forEach(([x, y], i) => {
    p.rect(x, y, 3, 7, i % 2 ? furD : fur);
    p.rect(x, y + 6, 4, 2, furL);
  });
  // body
  p.ellipse(20, 12, 11, 6, fur);
  p.ellipse(20, 15, 8, 3, belly);
  p.ellipse(11, 10, 6, 6.5, fur); // chest / neck
  for (let x = 12; x < 30; x++) if (p.solid(x, 6)) p.set(x, 6, furL);
  for (let x = 14; x < 28; x++) if (p.solid(x, 8) && x % 3 === 0) p.set(x, 8, furD);
  // head
  p.ellipse(7, 10, 5, 4, fur);
  p.rect(1, 10, 5, 3, furL); // snout
  p.rect(1, 12, 5, 1, furD);
  p.set(1, 10, OUT); p.set(1, 11, OUT); // nose
  // fangs + open jaw
  p.set(2, 13, '#ffffff'); p.set(5, 13, '#ffffff');
  p.rect(2, 13, 4, 1, '#7a2230');
  p.set(2, 14, '#ffffff'); p.set(5, 14, '#ffffff');
  // ears
  p.line(7, 6, 8, 2, furD); p.line(8, 6, 9, 2, fur); p.line(9, 6, 9, 2, fur); p.set(8, 3, furL);
  p.line(10, 7, 12, 3, furD); p.line(11, 7, 12, 3, fur);
  // eye
  p.rect(5, 8, 2, 2, '#ffd23f'); p.set(5, 9, OUT);
  p.line(4, 6, 7, 7, OUT); // angry brow
  // grass tufts growing on its back (it is a *Grass* Wolf)
  const g1 = '#4fae4a', g2 = '#7fd35a';
  [[16, 5], [19, 4], [22, 5], [25, 6]].forEach(([x, y]) => {
    p.line(x, y + 1, x - 1, y - 2, g1); p.line(x + 1, y + 1, x + 1, y - 3, g2);
  });
  return p.outline(OUT);
}

function bandit() {
  const hood = '#4b3a2e', hoodL = '#6b5442', mask = '#c0392b', maskD = '#8c2a20';
  const tunic = '#6b5a45', tunicD = '#4d4030', belt = '#2d2118', gold = '#f0c040';
  const p = new Pix(30, 32);
  // sack on back
  p.ellipse(22, 17, 4.5, 4.5, '#b8975a'); p.rect(20, 11, 4, 2, '#8c6f3a'); p.set(22, 12, '#c0392b');
  p.line(19, 13, 23, 13, '#8c6f3a');
  // legs + boots
  p.rect(10, 22, 4, 7, tunicD); p.rect(15, 22, 4, 7, tunicD);
  p.rect(9, 27, 5, 3, belt); p.rect(15, 27, 5, 3, belt);
  p.rect(8, 28, 2, 2, belt);
  // torso + cloak
  p.ellipse(15, 16, 6.5, 6.5, tunic);
  p.rect(9, 18, 12, 5, tunic);
  p.rect(9, 20, 12, 3, tunicD);
  p.rect(9, 19, 12, 2, belt); p.rect(14, 19, 2, 2, gold);
  // hood + face
  p.ellipse(14, 8, 6, 6, hood);
  p.ellipse(12, 5.5, 3, 2, hoodL);
  p.rect(9, 8, 6, 3, '#1a1423'); // shadowed face
  p.rect(9, 8, 2, 1, '#ffd23f'); p.rect(13, 8, 2, 1, '#ffd23f'); // glowing eyes
  p.rect(8, 11, 8, 3, mask); p.rect(8, 13, 8, 1, maskD); // bandana mask
  p.line(16, 12, 20, 14, mask); // knot tail
  // arms
  p.rect(18, 14, 3, 6, tunicD); // back arm
  p.rect(7, 14, 3, 5, tunic); // front arm
  p.rect(5, 17, 4, 3, '#e0a97f'); // fist
  // cudgel held out front
  const wood = '#8a5a2b', woodD = '#5e3b1a', woodL = '#b57b3c';
  p.line(6, 18, 1, 9, woodD); p.line(7, 18, 2, 9, wood); p.line(8, 18, 3, 9, wood);
  p.ellipse(2, 7.5, 2.6, 3.4, wood); p.set(1, 6, woodL); p.set(1, 7, woodL);
  p.set(3, 9, woodD); p.set(3, 8, woodD);
  p.set(2, 5, '#cfcfcf'); p.set(4, 7, '#cfcfcf'); // nail studs
  return p.outline(OUT);
}

// ───────────────────────────── registry ─────────────────────────────
let cache = null;

export function sprites() {
  if (cache) return cache;
  cache = {
    hero: buildHero(),
    heroBattle: { idle: heroBattle('idle'), attack: heroBattle('attack') },
    mobs: { slime: slime(), rat: rat(), sporeling: sporeling(), wolf: wolf(), bandit: bandit() },
  };
  return cache;
}

export function mobSprite(id) {
  const s = sprites().mobs[id];
  if (!s) throw new Error(`No sprite for mob ${id}`);
  return s;
}

// helper for HUD / slot portraits
export const heroPortrait = () => sprites().hero.down.idle;

export { lighten, darken };

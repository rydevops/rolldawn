// field.js — the exploration scene: scrolling tile map, grid walking, tall-grass encounters,
// signs, shrine and campfire. Everything the player does between fights happens here.

import { TILE, MOVE, ENCOUNTER, WORLD } from './config.js';
import { game } from './state.js';
import { $, clamp, pixelScale, fitCanvas, sleep } from './util.js';
import { generateWorld, isSolid, isTallGrass, infoAt, zoneFor, areaName, DIRS, GROUND } from './world.js';
import { renderStatic } from './maprender.js';
import { tileArt } from './tiles.js';
import { sprites, heroPortrait } from './sprites.js';
import * as input from './input.js';
import { say, ask, showScreen, dialogState, setBar, drawPix } from './ui.js';
import { sfx } from './sfx.js';
import { playMusic, stopMusic } from './music.js';
import { go } from './scenes.js';
import { openMenu } from './menu.js';
import { writeSlot } from './save.js';
import { wipeIn, wipeOut, fadeTo, strobe } from './transitions.js';
import { rollEncounter } from './mobs.js';
import { fullRestore } from './entities.js';
import { NEW_GAME_LINES, SIGNS, STONE, CAMPFIRE, GAMEOVER_WAKE } from './story.js';

// ── cached art (built on first entry) ──
let world = null;
let mapCanvas = null;
let A = null; // canvases
let canvas = null;
let scale = 3;
let lastSize = '';

// ── runtime state ──
let time = 0;
let busy = true;
let unsubs = [];
let lastZone = 0;
let bumpCooldown = 0;
const hero = { tx: 0, ty: 0, fx: 0, fy: 0, px: 0, py: 0, dir: 'down', moving: false, t: 0, parity: 0 };
let butterflies = [];

const cv = (pix) => pix.toCanvas();

function buildArt() {
  if (A) return;
  world = generateWorld();
  const art = tileArt();
  mapCanvas = renderStatic(world, art).toCanvas();
  const hs = sprites().hero;
  A = {
    tall: art.tall.map(cv),
    water: art.water.map((byMask) => Object.fromEntries(Object.entries(byMask).map(([k, v]) => [k, cv(v)]))),
    stone: art.stone.map(cv),
    flame: art.flame.map(cv),
    overlay: art.overlay.map(cv),
    hero: Object.fromEntries(Object.entries(hs).map(([dir, f]) => [dir, { idle: cv(f.idle), walk: f.walk.map(cv) }])),
    shadow: null,
  };
}

// ───────────────────────── HUD ─────────────────────────
export function updateHud() {
  const p = game.player;
  $('#hud-name').textContent = p.name.toUpperCase();
  $('#hud-lv').textContent = `Lv${p.level}`;
  $('#hud-hp').textContent = `${p.hp}/${p.maxHp}`;
  setBar($('#hud-hp-bar'), p.hp, p.maxHp);
  setBar($('#hud-mp-bar'), p.mp, p.maxMp);
}

function showArea() {
  const n = $('#area-name');
  n.textContent = areaName(hero.ty);
  n.classList.remove('show');
  void n.offsetWidth;
  n.classList.add('show');
}

// ───────────────────────── movement ─────────────────────────
function placeHero(x, y, dir) {
  hero.tx = hero.fx = x;
  hero.ty = hero.fy = y;
  hero.px = x;
  hero.py = y;
  hero.dir = dir;
  hero.moving = false;
  hero.t = 0;
  game.pos = { x, y, dir };
}

function tryStep(dir) {
  hero.dir = dir;
  const { dx, dy } = DIRS[dir];
  const nx = hero.tx + dx, ny = hero.ty + dy;
  if (isSolid(world, nx, ny)) {
    if (bumpCooldown <= 0) { sfx('bump'); bumpCooldown = 0.35; }
    return false;
  }
  hero.fx = hero.tx;
  hero.fy = hero.ty;
  hero.tx = nx;
  hero.ty = ny;
  hero.moving = true;
  hero.t = 0;
  hero.parity ^= 1;
  return true;
}

function finishStep() {
  hero.moving = false;
  hero.px = hero.tx;
  hero.py = hero.ty;
  game.pos = { x: hero.tx, y: hero.ty, dir: hero.dir };
  game.steps += 1;
  game.stepsSinceBattle += 1;
  const tall = isTallGrass(world, hero.tx, hero.ty);
  sfx(tall ? 'stepTall' : 'step');

  const z = zoneFor(hero.ty);
  if (z !== lastZone) { lastZone = z; showArea(); }

  if (tall && game.stepsSinceBattle > ENCOUNTER.safeSteps && Math.random() < ENCOUNTER.chance) {
    startEncounter();
  }
}

function updateMovement(dt) {
  bumpCooldown = Math.max(0, bumpCooldown - dt);
  let left = dt;
  // allow chaining several tiny steps in one frame so walking stays smooth at any frame-rate
  for (let guard = 0; guard < 3 && left > 0; guard++) {
    if (hero.moving) {
      const need = (1 - hero.t) * MOVE.stepTime;
      if (left >= need) {
        left -= need;
        hero.t = 1;
        finishStep();
        if (busy) return;
      } else {
        hero.t += left / MOVE.stepTime;
        left = 0;
      }
      hero.px = hero.fx + (hero.tx - hero.fx) * hero.t;
      hero.py = hero.fy + (hero.ty - hero.fy) * hero.t;
    } else {
      const d = input.getDir();
      if (!d) break;
      if (!tryStep(d)) break;
    }
  }
}

// ───────────────────────── interaction ─────────────────────────
function facing() {
  const { dx, dy } = DIRS[hero.dir];
  return infoAt(world, hero.tx + dx, hero.ty + dy);
}

async function interact() {
  if (busy || dialogState.open) return;
  if (performance.now() - dialogState.closedAt < 260) return;
  if (hero.moving) return;
  const info = facing();
  if (!info) return;
  busy = true;
  try {
    if (info.kind === 'sign') {
      sfx('read');
      await say(SIGNS[info.id]);
    } else if (info.kind === 'stone') {
      sfx('read');
      const first = !game.flags.shardstone;
      game.flags.shardstone = true;
      await say(first ? STONE.first : STONE.again);
    } else if (info.kind === 'campfire') {
      const choice = await ask(CAMPFIRE.ask, [CAMPFIRE.yes, CAMPFIRE.no]);
      if (choice === 0) await rest();
    }
  } finally {
    busy = false;
  }
}

async function rest() {
  stopMusic(0.8);
  await fadeTo(true, 700);
  sfx('rest');
  sfx('crackle');
  await sleep(1500);
  fullRestore(game.player);
  writeSlot();
  updateHud();
  playMusic('field', { fade: 1.2 });
  await fadeTo(false, 700);
  sfx('save');
  await say(CAMPFIRE.rested);
}

async function openPause() {
  if (busy || dialogState.open) return;
  busy = true;
  input.setEnabled(false);
  const result = await openMenu();
  input.setEnabled(true);
  if (result === 'quit') {
    stopMusic(0.7);
    await wipeOut();
    busy = false;
    await go('title', { fromGame: true });
    return;
  }
  busy = false;
}

// ───────────────────────── encounters ─────────────────────────
async function startEncounter() {
  busy = true;
  input.setEnabled(false);
  game.stepsSinceBattle = 0;
  stopMusic(0.25);
  sfx('encounter');
  await strobe(3, 120);
  await wipeOut();
  const zone = zoneFor(hero.ty);
  const mobId = rollEncounter(zone);
  input.setEnabled(true);
  await go('battle', { mobId, zone });
}

// ───────────────────────── ambient life ─────────────────────────
function resetButterflies() {
  butterflies = Array.from({ length: 7 }, (_, i) => ({
    x: hero.px * TILE + (Math.random() - 0.5) * 220,
    y: hero.py * TILE + (Math.random() - 0.5) * 220,
    a: Math.random() * 6.28,
    s: 6 + Math.random() * 8,
    c: ['#ffe14a', '#ff9ec7', '#ffffff', '#8fd1ff'][i % 4],
    ph: Math.random() * 10,
  }));
}

function updateButterflies(dt) {
  const cx = hero.px * TILE, cy = hero.py * TILE;
  for (const b of butterflies) {
    b.a += (Math.random() - 0.5) * 3.2 * dt * 4;
    b.x += Math.cos(b.a) * b.s * dt;
    b.y += Math.sin(b.a) * b.s * dt * 0.8;
    if (Math.hypot(b.x - cx, b.y - cy) > 190) {
      b.x = cx + (Math.random() - 0.5) * 240;
      b.y = cy + (Math.random() - 0.5) * 240;
    }
  }
}

// ───────────────────────── drawing ─────────────────────────
function drawWorld(ctx, w, h, camX, camY) {
  const mapW = world.w * TILE, mapH = world.h * TILE;

  // static layer
  const sx = Math.max(0, camX), sy = Math.max(0, camY);
  const dx = sx - camX, dy = sy - camY;
  const sw = Math.min(w - dx, mapW - sx), sh = Math.min(h - dy, mapH - sy);
  if (sw > 0 && sh > 0) ctx.drawImage(mapCanvas, sx, sy, sw, sh, dx, dy, sw, sh);

  // animated tiles
  const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(world.w - 1, Math.floor((camX + w) / TILE));
  const y0 = Math.max(0, Math.floor(camY / TILE)), y1 = Math.min(world.h - 1, Math.floor((camY + h) / TILE));
  const wf = Math.floor(time * 2.2) % 3;
  const gf = Math.floor(time * 5);
  const ff = Math.floor(time * 9) % 3;
  const sf = Math.floor(time * 3.2) % 3;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * world.w + x;
      const px = x * TILE - camX, py = y * TILE - camY;
      if (world.ground[i] === GROUND.WATER) ctx.drawImage(A.water[wf][world.waterMask[i]], px, py);
      if (world.tall[i]) ctx.drawImage(A.tall[(gf + x + y * 2) & 3], px, py);
      const o = world.obj[i];
      if (o === 'campfire') ctx.drawImage(A.flame[ff], px, py - 3);
      else if (o === 'stone') ctx.drawImage(A.stone[sf], px, py);
    }
  }
}

function drawHero(ctx, camX, camY) {
  const x = Math.round(hero.px * TILE - camX);
  const y = Math.round(hero.py * TILE - camY);
  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 8, y + 15, 5, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const set = A.hero[hero.dir];
  let frame = set.idle;
  let bob = 0;
  if (hero.moving) {
    frame = hero.t < 0.5 ? (hero.parity ? set.walk[0] : set.walk[2]) : set.walk[1];
    bob = hero.t > 0.25 && hero.t < 0.75 ? -1 : 0;
  }
  ctx.drawImage(frame, x, y + bob);

  // tall grass swallows her ankles
  const gx = Math.round(hero.px), gy = Math.round(hero.py);
  if (isTallGrass(world, gx, gy)) ctx.drawImage(A.overlay[Math.floor(time * 6) & 1], x, y + 9);
}

function drawButterflies(ctx, camX, camY) {
  for (const b of butterflies) {
    const x = Math.round(b.x - camX), y = Math.round(b.y - camY + Math.sin(time * 3 + b.ph) * 2);
    const open = Math.sin(time * 18 + b.ph) > 0;
    ctx.fillStyle = b.c;
    if (open) { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); }
    else { ctx.fillRect(x - 1, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); }
    ctx.fillStyle = '#1a1423';
    ctx.fillRect(x, y - 1, 1, 2);
  }
}

function drawClouds(ctx, w, h, camX, camY) {
  const mapW = world.w * TILE;
  ctx.fillStyle = '#0f1f4a';
  for (let i = 0; i < 6; i++) {
    const cx = ((time * 6 + i * 190) % (mapW + 320)) - 160 - camX;
    const cy = 90 + i * 150 - camY + Math.sin(i * 2.1) * 40;
    if (cx < -140 || cx > w + 140 || cy < -80 || cy > h + 80) continue;
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = 0.035;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70 - k * 12, 26 - k * 5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 34, cy + 6, 44 - k * 10, 18 - k * 4, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 38, cy + 8, 40 - k * 9, 16 - k * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function draw() {
  const size = `${canvas.clientWidth}x${canvas.clientHeight}`;
  if (size !== lastSize) {
    lastSize = size;
    scale = pixelScale(canvas.clientWidth, canvas.clientHeight);
  }
  const { ctx, w, h } = fitCanvas(canvas, scale);
  const mapW = world.w * TILE, mapH = world.h * TILE;

  const wantX = hero.px * TILE + TILE / 2 - w / 2;
  const wantY = hero.py * TILE + TILE / 2 - h * 0.47;
  const camX = Math.round(mapW <= w ? -(w - mapW) / 2 : clamp(wantX, 0, mapW - w));
  const camY = Math.round(mapH <= h ? -(h - mapH) / 2 : clamp(wantY, 0, mapH - h));

  ctx.fillStyle = '#173d22';
  ctx.fillRect(0, 0, w, h);
  drawWorld(ctx, w, h, camX, camY);
  drawHero(ctx, camX, camY);
  drawButterflies(ctx, camX, camY);
  drawClouds(ctx, w, h, camX, camY);
}

// ───────────────────────── scene hooks ─────────────────────────
function update(dt) {
  time += dt;
  game.playtime += dt;
  updateButterflies(dt);
  if (!busy && !dialogState.open) updateMovement(dt);
  const ready = !busy && !dialogState.open && !hero.moving && !!facing();
  $('#btn-a').classList.toggle('ready', ready);
}

async function enter(params = {}) {
  buildArt();
  canvas = $('#field-canvas');
  const mode = params.mode || 'continue';
  busy = true;
  lastSize = '';

  if (mode === 'respawn') {
    placeHero(WORLD.campfire.x - 1, WORLD.campfire.y, 'right');
    fullRestore(game.player);
  } else if (mode !== 'return') {
    placeHero(game.pos.x, game.pos.y, game.pos.dir);
  }
  lastZone = zoneFor(hero.ty);
  resetButterflies();

  drawPix($('#hud-face'), heroPortrait());
  updateHud();
  showScreen('screen-field');

  unsubs.forEach((u) => u());
  unsubs = [input.on('action', interact), input.on('menu', openPause)];
  input.setEnabled(true);
  draw();

  if (mode === 'new') {
    playMusic('field', { fade: 2.5 });
    $('#fade').style.transitionDuration = '0ms';
    $('#fade').classList.add('on');
    await wipeIn();
    await fadeTo(false, 1800);
    showArea();
    await say(NEW_GAME_LINES);
    game.flags.begun = true;
    writeSlot();
  } else if (mode === 'respawn') {
    playMusic('field', { fade: 2 });
    await wipeIn();
    showArea();
    await say(GAMEOVER_WAKE);
    writeSlot();
  } else if (mode === 'return') {
    playMusic('field', { fade: 1.2 });
    await wipeIn();
  } else {
    playMusic('field', { fade: 1.8 });
    await wipeIn();
    showArea();
  }
  busy = false;
}

function exit() {
  unsubs.forEach((u) => u());
  unsubs = [];
  input.setEnabled(false);
  $('#btn-a').classList.remove('ready');
}

// debug hooks (handy from the browser console): __dawnroll.field.teleport(x, y)
export const debug = {
  teleport(x, y) { placeHero(x, y, hero.dir); },
  encounter() { return startEncounter(); },
  hero,
};

export default { enter, exit, update, draw };

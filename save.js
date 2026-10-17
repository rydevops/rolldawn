// save.js — three save slots + settings, stored in localStorage.
// If storage is blocked (private mode, etc.) it quietly falls back to memory so the game still runs.

import { GAME, PLAYER_START } from './config.js';
import { game, settings } from './state.js';

const mem = new Map();
const store = {
  get(k) {
    try { return localStorage.getItem(k); } catch { return mem.get(k) ?? null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch { mem.set(k, v); }
  },
  del(k) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    mem.delete(k);
  },
};

const keyFor = (i) => GAME.saveKey + i;

export function snapshot() {
  return {
    v: 1,
    savedAt: Date.now(),
    playtime: Math.floor(game.playtime),
    steps: game.steps,
    kills: game.kills,
    pos: { ...game.pos },
    flags: { ...game.flags },
    player: { ...game.player },
  };
}

export function readSlot(i) {
  const raw = store.get(keyFor(i));
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || !d.player) return null;
    return d;
  } catch {
    return null;
  }
}

export function listSlots() {
  return Array.from({ length: GAME.slots }, (_, i) => readSlot(i));
}

export function writeSlot(i = game.slot) {
  if (i < 0) return false;
  store.set(keyFor(i), JSON.stringify(snapshot()));
  return true;
}

export function eraseSlot(i) {
  store.del(keyFor(i));
}

export function loadSlot(i) {
  const d = readSlot(i);
  if (!d) return false;
  game.slot = i;
  game.inGame = true;
  game.player = { ...PLAYER_START, ...d.player };
  game.pos = { x: d.pos.x, y: d.pos.y, dir: d.pos.dir || 'down' };
  game.playtime = d.playtime || 0;
  game.steps = d.steps || 0;
  game.kills = d.kills || 0;
  game.stepsSinceBattle = 0;
  game.flags = { ...(d.flags || {}) };
  return true;
}

export function loadSettings() {
  try {
    const d = JSON.parse(store.get(GAME.settingsKey) || '{}');
    if (typeof d.music === 'boolean') settings.music = d.music;
    if (typeof d.sfx === 'boolean') settings.sfx = d.sfx;
  } catch { /* defaults */ }
}

export function saveSettings() {
  store.set(GAME.settingsKey, JSON.stringify(settings));
}

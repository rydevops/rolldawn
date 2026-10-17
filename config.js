// config.js — every tunable number lives here so balancing never means hunting through code.

export const GAME = {
  title: 'DAWNROLL',
  subtitle: 'Chronicle of the Verdant Reach',
  version: globalThis.DAWNROLL_VERSION || '0.0.0', // set in version.js
  slots: 3,
  saveKey: 'dawnroll.slot.',
  settingsKey: 'dawnroll.settings',
  heroName: 'Wren',
};

// ---- World / exploration -------------------------------------------------
export const TILE = 16;           // pixel size of one map tile (before scaling)
export const WORLD = {
  w: 48,
  h: 64,
  seed: 20261017,                 // fixed seed => the same meadow every time
  spawn: { x: 24, y: 55 },
  campfire: { x: 26, y: 54 },
};
export const MOVE = {
  stepTime: 0.17,                 // seconds to walk one tile
};
export const ENCOUNTER = {
  chance: 0.13,                   // chance per step in tall grass
  safeSteps: 3,                   // steps of grace after any battle
  newGameSafeSteps: 8,
};

// ---- Dice rules (the heart of the D&D feel) ------------------------------
export const DICE = {
  missMax: 2,                     // red die 1-2  => miss
  hitMax: 4,                      // red die 3-4  => hit, 5-6 => critical
  critMultiplier: 2,
};
export const LUCK = {
  rerollPerPoint: 0.03,           // each LCK point = 3% chance to re-roll a missed attack die
};

// ---- Progression ----------------------------------------------------------
export const PLAYER_START = {
  name: 'Wren',
  level: 1,
  xp: 0,
  hp: 34, maxHp: 34,
  mp: 8,  maxMp: 8,
  str: 5,                         // strength  — adds to damage
  def: 3,                         // defense   — reduces damage taken
  lck: 3,                         // luck      — lucky re-rolls
  arc: 4,                         // arcana    — magic aptitude (spells arrive later)
};

// ---- Palette (shared by UI + canvas art) ---------------------------------
export const COLORS = {
  ink: '#fff4d6',
  night: '#0c0a1d',
  panel: '#1f1a38',
  gold: '#f2d388',
  red: '#e63946',
  green: '#2fbf71',
  outline: '#1a1423',
};

// Stat names shown in the UI — "Arcana" is the magic-aptitude stat.
export const STAT_LABELS = {
  hp: 'HP', mp: 'MP', str: 'STR', def: 'DEF', lck: 'LCK', arc: 'ARC',
};

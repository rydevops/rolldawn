// entities.js — the player's stat block, XP curve and level-ups.

import { PLAYER_START } from './config.js';
import { rollD6 } from './rules.js';

export function createPlayer() {
  return { ...PLAYER_START };
}

// XP needed to climb from `level` to `level + 1`: 10, 30, 60, 100, 150 …
export const xpNeeded = (level) => 5 * level * (level + 1);

// Adds XP and returns one record per level gained (so the UI can celebrate each).
export function grantXp(p, amount, rng = Math.random) {
  p.xp += amount;
  const ups = [];
  while (p.xp >= xpNeeded(p.level)) {
    p.xp -= xpNeeded(p.level);
    p.level += 1;
    const hpRoll = rollD6(rng); // a die roll even for growth — very D&D
    const gain = {
      level: p.level,
      hpRoll,
      hp: 4 + hpRoll,
      mp: 1 + (p.level % 2),
      str: 1,
      def: p.level % 2 === 0 ? 1 : 0,
      lck: p.level % 3 === 0 ? 1 : 0,
      arc: p.level % 2 === 1 ? 1 : 0,
    };
    p.maxHp += gain.hp;
    p.hp = Math.min(p.maxHp, p.hp + gain.hp);
    p.maxMp += gain.mp;
    p.mp = Math.min(p.maxMp, p.mp + gain.mp);
    p.str += gain.str;
    p.def += gain.def;
    p.lck += gain.lck;
    p.arc += gain.arc;
    ups.push(gain);
  }
  return ups;
}

export function fullRestore(p) {
  p.hp = p.maxHp;
  p.mp = p.maxMp;
}

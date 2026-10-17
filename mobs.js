// mobs.js — the bestiary. Add a monster by adding an entry here (and a sprite in sprites.js).
//
// tier  : how deep into the Reach it starts showing up (see zoneFor in world.js)
// atk   : flavour for its basic melee attack — { verb, sfx }
// stats : hp / mp / str / def / lck / arc — same stat block as the player.

import { weightedPick } from './util.js';

export const MOBS = {
  slime: {
    id: 'slime', name: 'Gooey Slime', level: 1, tier: 1,
    hp: 12, mp: 0, str: 2, def: 0, lck: 1, arc: 0, xp: 6,
    atk: { verb: 'slops into', sfx: 'squish' },
    intro: 'A Gooey Slime wobbles out of the grass!',
    defeat: 'The slime pops into a puddle of sparkles.',
  },
  rat: {
    id: 'rat', name: 'Thistle Rat', level: 1, tier: 1,
    hp: 10, mp: 0, str: 3, def: 0, lck: 3, arc: 0, xp: 6,
    atk: { verb: 'gnaws at', sfx: 'bite' },
    intro: 'A Thistle Rat bristles and squeaks at you!',
    defeat: 'The rat scurries off in a puff of fluff.',
  },
  sporeling: {
    id: 'sporeling', name: 'Sporeling', level: 2, tier: 2,
    hp: 16, mp: 4, str: 4, def: 1, lck: 2, arc: 3, xp: 11,
    atk: { verb: 'puffs spores at', sfx: 'spore' },
    intro: 'A Sporeling stomps out, shedding spores!',
    defeat: 'The sporeling deflates with a sad little wheeze.',
  },
  wolf: {
    id: 'wolf', name: 'Grass Wolf', level: 3, tier: 3,
    hp: 24, mp: 0, str: 7, def: 2, lck: 2, arc: 0, xp: 18,
    atk: { verb: 'snaps at', sfx: 'bite' },
    intro: 'A Grass Wolf slinks forward, hackles raised!',
    defeat: 'The wolf yelps and bounds away into the reeds.',
  },
  bandit: {
    id: 'bandit', name: 'Field Bandit', level: 4, tier: 4,
    hp: 32, mp: 2, str: 8, def: 3, lck: 4, arc: 1, xp: 28,
    atk: { verb: 'cudgels', sfx: 'club' },
    intro: 'A Field Bandit leaps from the grass — "Your coin or your luck!"',
    defeat: 'The bandit drops his cudgel and flees, cursing the dice.',
  },
};

export function spawnMob(id) {
  const d = MOBS[id];
  if (!d) throw new Error(`Unknown mob ${id}`);
  return { ...d, maxHp: d.hp, maxMp: d.mp };
}

// Which mob jumps out of the grass? Depends on how far north (deeper) you are.
export function rollEncounter(zone, rng = Math.random) {
  const pool = Object.values(MOBS).filter((m) => m.tier <= zone && m.tier >= zone - 2);
  const weight = (m) => (m.tier === zone ? 3 : m.tier === zone - 1 ? 2 : 1);
  return weightedPick(pool, weight, rng).id;
}

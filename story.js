// story.js — all of the words. Edit freely: captions, signs, lore and battle lines live here.

import { pick } from './util.js';

// Intro cutscene captions. `at` is seconds from the start (intro.js draws the matching visuals).
export const CUTSCENE_CAPTIONS = [
  { at: 1.2, text: 'Before the first dawn, the gods played a single game.' },
  { at: 6.2, text: 'One die decided every storm, every blade, every heart.' },
  { at: 11.4, text: 'But even gods can fumble.' },
  { at: 16.2, text: 'The Prime Die slipped from their hands and shattered across the Verdant Reach.' },
  { at: 22.6, text: 'Since that night, nothing is certain. Every sword swing is a roll of the dice.' },
  { at: 28.4, text: 'And at the edge of a sunlit meadow, someone is waking up…' },
];

export const NEW_GAME_LINES = [
  'Grass tickles your cheek. Warm light. A lark singing somewhere high above.',
  'You sit up in a meadow you don\'t remember reaching. Your name comes back first: Wren.',
  'Around your neck, a cracked little die hums softly. Its pips keep rearranging themselves.',
  'A rusty sword lies in the grass beside you. It feels… lucky.',
  'Use the pad to walk. Tall, waving grass hides things that bite.\nTap A to read, rest and poke at things.',
];

export const SIGNS = {
  welcome: [
    'A weathered sign reads:\n"WELCOME TO THE VERDANT REACH. Rest by the fire. Beware the tall grass: it bites."',
    'Underneath, in smaller scratchy letters:\n"(Mostly the slimes.)"',
  ],
  mid: [
    'The road to PIPSTONE continues north.\n"Fewer monsters in town!" someone has scrawled here.',
    'Someone else has crossed that out and written: "LIAR."',
  ],
  north: [
    '"ROAD CLOSED. Thorns grew overnight. Pipstone will have to wait. — The Management"',
    'Beyond the brambles, something vast and patient seems to be listening.',
    '(That\'s the edge of the prototype map. More road coming soon!)',
  ],
};

export const STONE = {
  first: [
    'A mossy standing stone. A die face is carved into it, glowing faintly cyan.',
    'Your pendant answers with a warm pulse. A voice like dice rattling in a cup whispers:\n"Five more… find the five more…"',
  ],
  again: [
    'The stone is quiet. So is your pendant.\nBut somewhere very far away, dice are rolling.',
  ],
};

export const CAMPFIRE = {
  ask: 'A little campfire crackles. Rest here?',
  yes: 'Rest by the fire',
  no: 'Not now',
  rested: [
    'You sit beside the fire and let the warmth sink in.\nHP and MP restored. Game saved.',
  ],
};

export const AREAS = ['VERDANT FIELD', 'WHISPERING MEADOW', 'THE TANGLEWOLD EDGE', 'THORNWARD ROAD'];

export const GAMEOVER_WAKE = [
  'Cold. Then warm. Fire crackles.',
  'You wake beside the campfire with a headache and a faint feeling the dice were laughing at you.',
];

// ── battle text ──
export const battle = {
  playerSwing: (name, mob) => pick([
    `${name} swings her sword!`,
    `${name} lunges at the ${mob}!`,
    `${name} charges in, blade first!`,
  ]),
  mobSwing: (mob) => `${mob.name} ${mob.atk.verb} Wren!`,
  rolling: 'The dice tumble…',
  luckyReroll: 'Lucky! Wren gets a re-roll!',
  miss: (who) => `${who} misses!`,
  hit: (dmg) => `A solid hit! ${dmg} damage.`,
  crit: (dmg) => pick([
    `CRITICAL HIT! ${dmg} damage!`,
    `The dice roar! CRITICAL HIT, ${dmg} damage!`,
    `Fate smiles! CRITICAL HIT, ${dmg} damage!`,
  ]),
  hurtHit: (dmg) => `Ouch! Wren takes ${dmg} damage.`,
  hurtCrit: (dmg) => `CRITICAL HIT! Wren takes ${dmg} damage!`,
  victory: (mob, xp) => `Wren defeated the ${mob}!\nShe gains ${xp} XP.`,
  levelUp: (lv) => `LEVEL UP! Wren reaches level ${lv}!`,
};

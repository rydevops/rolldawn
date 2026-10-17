// rules.js — the dice rules, as pure functions (no DOM, no audio) so they can be unit-tested.
//
//   RED die   (attack roll):  1-2 miss · 3-4 hit · 5-6 CRITICAL HIT
//   GREEN die (damage roll):  d6 + STR bonus − DEF bonus on a hit
//                             (d6 + STR bonus) × 2, ignoring DEF, on a critical
//   LUCK: every LCK point gives a 3% chance to re-roll a *missed* red die once.

import { DICE, LUCK } from './config.js';

export const statBonus = (stat) => Math.floor(stat / 2);
export const rollD6 = (rng = Math.random) => 1 + Math.floor(rng() * 6);

export function classify(red) {
  if (red <= DICE.missMax) return 'miss';
  if (red <= DICE.hitMax) return 'hit';
  return 'crit';
}

export function resolveAttack(attacker, defender, rng = Math.random) {
  let red = rollD6(rng);
  const rolls = [red];
  let lucky = false;

  if (classify(red) === 'miss' && rng() < attacker.lck * LUCK.rerollPerPoint) {
    lucky = true;
    red = rollD6(rng);
    rolls.push(red);
  }

  const outcome = classify(red);
  const green = rollD6(rng);
  let damage = 0;
  let calc = null;

  if (outcome === 'hit') {
    const str = statBonus(attacker.str);
    const def = statBonus(defender.def);
    damage = Math.max(1, green + str - def);
    calc = { green, str, def, mult: 1, total: damage };
  } else if (outcome === 'crit') {
    const str = statBonus(attacker.str);
    damage = Math.max(2, (green + str) * DICE.critMultiplier);
    calc = { green, str, def: 0, mult: DICE.critMultiplier, total: damage };
  }

  return { outcome, red, rolls, lucky, green, damage, calc };
}

// Human-readable maths line shown under the dice, e.g. "4 + 2 STR − 1 DEF = 5"
export function describeCalc(res) {
  if (!res.calc) return 'The swing finds nothing but air.';
  const { green, str, def, mult, total } = res.calc;
  if (mult > 1) return `(${green} + ${str} STR) × ${mult} = ${total}  ·  armor ignored`;
  const parts = [`${green}`];
  if (str) parts.push(`+ ${str} STR`);
  if (def) parts.push(`− ${def} DEF`);
  return `${parts.join(' ')} = ${total}`;
}

// state.js — the one shared, mutable "game" object plus user settings.
// Scenes read and write this directly; save.js turns it into JSON and back.

import { PLAYER_START, WORLD } from './config.js';

export const settings = {
  music: true,
  sfx: true,
};

export const game = {
  slot: -1,
  inGame: false,
  player: null,
  pos: { x: WORLD.spawn.x, y: WORLD.spawn.y, dir: 'up' },
  playtime: 0,        // seconds
  steps: 0,
  kills: 0,
  stepsSinceBattle: 99,
  flags: {},          // story flags, e.g. { intro: true, readShardstone: true }
};

export function newGame(slot) {
  game.slot = slot;
  game.inGame = true;
  game.player = { ...PLAYER_START };
  game.pos = { x: WORLD.spawn.x, y: WORLD.spawn.y, dir: 'up' };
  game.playtime = 0;
  game.steps = 0;
  game.kills = 0;
  game.stepsSinceBattle = 0;
  game.flags = {};
}

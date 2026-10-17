// gameover.js — "YOU FELL". Wren wakes at the campfire with full health; nothing is lost but pride.

import { $ } from './util.js';
import { showScreen } from './ui.js';
import { sfx } from './sfx.js';
import { stopMusic } from './music.js';
import { go } from './scenes.js';
import { wipeIn, wipeOut } from './transitions.js';

let busy = false;

async function enter() {
  busy = false;
  showScreen('screen-gameover');
  await wipeIn();
  $('#go-continue').onclick = async () => {
    if (busy) return;
    busy = true;
    sfx('select');
    stopMusic(0.8);
    await wipeOut();
    await go('field', { mode: 'respawn' });
  };
}

function exit() {
  $('#go-continue').onclick = null;
}

export default { enter, exit };

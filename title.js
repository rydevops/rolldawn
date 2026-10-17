// title.js — the title screen: logo, spinning die, "TAP TO START". Tapping anywhere opens the save slots.

import { $ } from './util.js';
import { DawnScene } from './scenery.js';
import { buildDie, setFace } from './dice.js';
import { showScreen } from './ui.js';
import { sfx } from './sfx.js';
import { playMusic } from './music.js';
import { go } from './scenes.js';
import { wipeIn, wipeOut, fadeTo } from './transitions.js';
import { GAME } from './config.js';
import { updateReady, reloadForUpdate } from './updates.js';

let scene = null;
let handler = null;
let leaving = false;

async function enter(params = {}) {
  // a newer version arrived while playing — the title screen is the safe moment to switch to it
  if (updateReady()) { reloadForUpdate(); return; }
  $('#title-version').textContent = `v${GAME.version}`;
  const canvas = $('#title-canvas');
  scene = new DawnScene(canvas, { k: 0.8, dim: 0, hero: true });
  leaving = false;
  const die = $('#title-die');
  buildDie(die);
  setFace(die, 6);
  die.classList.add('spin', 'float');

  // the logo plays its drop-in animation each time the screen appears
  const wrap = document.querySelector('.title-wrap');
  wrap.style.animation = 'none';
  void wrap.offsetWidth;
  wrap.style.animation = '';

  showScreen('screen-title');
  playMusic('title', { fade: params.from === 'intro' ? 2 : 1.2 });

  if (params.fromGame || params.from === 'slots') await wipeIn();
  else await fadeTo(false, 600);

  handler = async () => {
    if (leaving) return;
    leaving = true;
    sfx('select');
    await wipeOut();
    await go('slots');
  };
  $('#screen-title').addEventListener('pointerdown', handler);
  window.addEventListener('keydown', onKey);
}

function onKey(e) {
  if (e.key === 'Enter' || e.key === ' ') handler && handler();
}

function exit() {
  $('#screen-title').removeEventListener('pointerdown', handler);
  window.removeEventListener('keydown', onKey);
  handler = null;
}

function draw(dt) {
  if (scene) scene.draw(dt);
}

export default { enter, exit, draw };

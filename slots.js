// slots.js — pick one of three save slots: continue, start a new adventure, or erase.

import { $, el, fmtTime } from './util.js';
import { GAME } from './config.js';
import { DawnScene } from './scenery.js';
import { listSlots, loadSlot, eraseSlot, writeSlot } from './save.js';
import { newGame } from './state.js';
import { heroPortrait } from './sprites.js';
import { showScreen, drawPix, ask } from './ui.js';
import { sfx } from './sfx.js';
import { stopMusic } from './music.js';
import { go } from './scenes.js';
import { wipeIn, wipeOut } from './transitions.js';

let scene = null;
let busy = false;

function dateLabel(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function render() {
  const list = $('#slot-list');
  list.innerHTML = '';
  listSlots().forEach((d, i) => {
    let face;
    let meta;
    if (d) {
      const cv = el('canvas', { width: 16, height: 16 });
      drawPix(cv, heroPortrait());
      face = el('div', { class: 'face-wrap' }, cv);
      meta = el('div', { class: 'meta' },
        el('div', { class: 't1', text: `SLOT ${i + 1} · ${(d.player.name || GAME.heroName).toUpperCase()}` }),
        el('div', { class: 't2', text: `Lv ${d.player.level} · HP ${d.player.hp}/${d.player.maxHp}` }),
        el('div', { class: 't3', text: `${fmtTime(d.playtime)} played · ${dateLabel(d.savedAt)}` }));
    } else {
      face = el('div', { class: 'face-wrap' }, el('span', { class: 'q', text: '?' }));
      meta = el('div', { class: 'meta' },
        el('div', { class: 't1', text: `SLOT ${i + 1}` }),
        el('div', { class: 't2', text: 'NEW ADVENTURE' }));
    }
    list.append(el('div', {
      class: `slot panel${d ? '' : ' empty'}`, role: 'button', tabindex: '0',
      onclick: () => choose(i, d),
    }, face, meta));
  });
}

async function startNew(i) {
  newGame(i);
  writeSlot(i);
  stopMusic(1);
  await wipeOut();
  await go('field', { mode: 'new' });
}

async function choose(i, d) {
  if (busy) return;
  busy = true;
  sfx('select');
  try {
    if (!d) {
      await startNew(i);
      return;
    }
    const pick = await ask(`Slot ${i + 1}: Wren, level ${d.player.level}.`, ['CONTINUE', 'ERASE', 'CANCEL']);
    if (pick === 0) {
      if (loadSlot(i)) {
        stopMusic(1);
        await wipeOut();
        await go('field', { mode: 'continue' });
        return;
      }
    } else if (pick === 1) {
      const sure = await ask('Erase this adventure forever?', ['YES, ERASE', 'NO']);
      if (sure === 0) { eraseSlot(i); sfx('crackle'); render(); }
    }
  } finally {
    busy = false;
  }
}

async function enter() {
  scene = new DawnScene($('#slots-canvas'), { k: 0.8, dim: 0.5, hero: false });
  busy = false;
  render();
  showScreen('screen-slots');
  $('#slots-back').onclick = async () => {
    if (busy) return;
    busy = true;
    sfx('back');
    await wipeOut();
    await go('title', { from: 'slots' });
  };
  await wipeIn();
}

function exit() {
  $('#slots-back').onclick = null;
}

function draw(dt) {
  if (scene) scene.draw(dt);
}

export default { enter, exit, draw };

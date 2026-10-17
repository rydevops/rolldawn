// menu.js — the pause menu: stats, save, sound, quit. openMenu() resolves with 'resume' or 'quit'.

import { $, el, fmtTime } from './util.js';
import { game } from './state.js';
import { writeSlot } from './save.js';
import { sfx } from './sfx.js';
import { setBar, toggleSound, refreshSoundButtons } from './ui.js';
import { xpNeeded } from './entities.js';

function paintStats() {
  const p = game.player;
  const box = $('#menu-stats');
  box.innerHTML = '';
  const stat = (label, value, cls = '') => el('div', { class: `stat ${cls}` }, el('b', { text: label }), el('span', { text: value }));
  box.append(
    stat('LEVEL', p.level),
    stat('HP', `${p.hp}/${p.maxHp}`),
    stat('MP', `${p.mp}/${p.maxMp}`),
    stat('STR', p.str),
    stat('DEF', p.def),
    stat('LCK', p.lck),
    stat('ARCANA', p.arc),
    stat('XP', `${p.xp}/${xpNeeded(p.level)}`),
    stat('TIME', fmtTime(game.playtime)),
  );
  const bar = el('div', { class: 'bar xp-bar mp' }, el('i'));
  box.append(bar);
  setBar(bar.firstChild, p.xp, xpNeeded(p.level));
}

export function openMenu() {
  return new Promise((resolve) => {
    const root = $('#overlay-menu');
    const note = $('#menu-note');
    let confirmQuit = false;
    paintStats();
    refreshSoundButtons();
    note.textContent = '';
    $('[data-act="quit"]', root).textContent = 'QUIT TO TITLE';
    root.classList.remove('hidden');
    sfx('menu');

    const close = (result) => {
      root.removeEventListener('click', onClick);
      root.classList.add('hidden');
      resolve(result);
    };

    function onClick(e) {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act !== 'quit' && confirmQuit) {
        confirmQuit = false;
        $('[data-act="quit"]', root).textContent = 'QUIT TO TITLE';
      }
      if (act === 'resume') { sfx('back'); close('resume'); }
      else if (act === 'save') {
        const ok = writeSlot();
        sfx(ok ? 'save' : 'back');
        note.textContent = ok ? 'Game saved.' : 'Could not save (storage blocked?)';
      } else if (act === 'sound') {
        toggleSound();
      } else if (act === 'quit') {
        if (!confirmQuit) {
          confirmQuit = true;
          btn.textContent = 'TAP AGAIN TO CONFIRM';
          note.textContent = 'Unsaved progress will be lost.';
          sfx('blip');
        } else {
          sfx('back');
          close('quit');
        }
      }
    }
    root.addEventListener('click', onClick);
  });
}

// main.js — boots the game: wires modules together, registers scenes, runs the frame loop.
// Add a new scene by importing it here and calling register('name', scene).

import { $ } from './util.js';
import { loadSettings } from './save.js';
import { initAudio, unlock, resumeAudio, suspendAudio, audioRunning } from './audio.js';
import { resyncMusic } from './music.js';
import { initUi, showScreen } from './ui.js';
import { initInput } from './input.js';
import { initTransitions } from './transitions.js';
import { register, go, tick } from './scenes.js';
import { buildDie } from './dice.js';
import { sfx } from './sfx.js';
import { game } from './state.js';
import { GAME } from './config.js';
import { initUpdates, checkOnBoot } from './updates.js';
import intro from './intro.js';
import title from './title.js';
import slots from './slots.js';
import field, { debug as fieldDebug } from './field.js';
import battle from './battle.js';
import gameover from './gameover.js';

register('intro', intro);
register('title', title);
register('slots', slots);
register('field', field);
register('battle', battle);
register('gameover', gameover);

// ── frame loop ──
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  try { tick(dt); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

// ── keep audio sane when the tab / app is hidden ──
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    suspendAudio();
  } else {
    last = performance.now();
    await resumeAudio();
    resyncMusic();
  }
});
// iOS can interrupt audio (calls, Siri); the next touch brings it back.
window.addEventListener('pointerdown', () => { if (!document.hidden && !audioRunning()) resumeAudio(); }, { passive: true });

// ── boot ──
async function boot() {
  loadSettings();
  initUi();
  initInput();
  initTransitions();

  const die = $('#boot-die');
  buildDie(die);
  die.classList.add('spin', 'float');
  showScreen('screen-boot');
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

  $('#boot-hint').textContent = `v${GAME.version} · sound on · best on a phone`;
  const tapLine = $('#boot-tap');
  tapLine.textContent = 'CHECKING FOR UPDATES…';

  // 1. register the offline worker and ask the server whether a newer version exists
  //    (reloads the page by itself if it finds one)
  await initUpdates();
  const status = await checkOnBoot();
  if (status === 'updated') return;
  tapLine.textContent = status === 'offline' ? 'OFFLINE · TOUCH TO WAKE THE WORLD' : 'TOUCH TO WAKE THE WORLD';
  tapLine.classList.add('blink');

  // 2. one touch unlocks audio on iOS, then the story begins
  const gate = $('#screen-boot');
  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    gate.removeEventListener('pointerdown', start);
    window.removeEventListener('keydown', onKey);
    initAudio();
    await unlock();
    sfx('chime', 0);
    await go('intro');
  };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') start(); };
  gate.addEventListener('pointerdown', start);
  window.addEventListener('keydown', onKey);
}

// debug hook: __dawnroll.go('field'), __dawnroll.game, __dawnroll.field.teleport(x, y) …
window.__dawnroll = { go, game, field: fieldDebug, version: GAME.version };

if (document.fonts && document.fonts.ready) {
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(boot);
} else {
  boot();
}

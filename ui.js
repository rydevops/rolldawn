// ui.js — DOM helpers shared by every screen: screen switching, typewriter text, dialog box,
// choices, stat bars, toasts and the sound toggle.

import { $, $$, clamp, el } from './util.js';
import { sfx } from './sfx.js';
import { settings } from './state.js';
import { applyVolumes, unlock } from './audio.js';
import { saveSettings } from './save.js';

const screens = $$('.screen');

export function showScreen(id) {
  screens.forEach((s) => s.classList.toggle('active', s.id === id));
}

// ── toast ──
let toastTimer = 0;
export function toast(text, ms = 2200) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ── typewriter ──
// Tap the `skip` element (or press Enter/Space) to reveal the whole line instantly.
export function typeText(node, text, { speed = 22, blip = true, skip = document.body } = {}) {
  return new Promise((resolve) => {
    node.textContent = '';
    if (!text) { resolve(); return; }
    let i = 0;
    let done = false;
    let timer = 0;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      skip.removeEventListener('pointerdown', finish);
      window.removeEventListener('keydown', onKey);
      node.textContent = text;
      resolve();
    };
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') finish(); };
    skip.addEventListener('pointerdown', finish);
    window.addEventListener('keydown', onKey);
    timer = setInterval(() => {
      i++;
      node.textContent = text.slice(0, i);
      const ch = text[i - 1];
      if (blip && i % 3 === 0 && ch && ch !== ' ' && ch !== '\n') sfx('text');
      if (i >= text.length) finish();
    }, speed);
  });
}

// Resolves on the next tap on `target` (or Enter/Space/Z) after a short grace period.
export function waitAdvance(target) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const cleanup = () => {
      target.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', key);
    };
    const go = () => { if (performance.now() - t0 < 160) return; cleanup(); resolve(); };
    const key = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') go(); };
    target.addEventListener('pointerdown', go);
    window.addEventListener('keydown', key);
  });
}

// ── dialog box (narration, signs, choices) ──
export const dialogState = { open: false, closedAt: 0 };

function dialogEls() {
  return {
    root: $('#dialog'), txt: $('#dialog-text'), more: $('#dialog-more'),
    nm: $('#dialog-name'), choices: $('#dialog-choices'),
  };
}

function openDialog(name) {
  const d = dialogEls();
  dialogState.open = true;
  d.nm.textContent = name;
  d.nm.classList.toggle('show', !!name);
  d.choices.innerHTML = '';
  d.more.classList.remove('show');
  d.root.classList.remove('hidden');
  return d;
}

function closeDialog(d) {
  d.more.classList.remove('show');
  d.choices.innerHTML = '';
  d.root.classList.add('hidden');
  dialogState.open = false;
  dialogState.closedAt = performance.now();
}

export async function say(lines, { name = '' } = {}) {
  const d = openDialog(name);
  for (const line of [].concat(lines)) {
    d.more.classList.remove('show');
    await typeText(d.txt, line, { skip: d.root });
    d.more.classList.add('show');
    await waitAdvance(d.root);
    sfx('blip');
  }
  closeDialog(d);
}

// Shows a prompt + buttons; resolves with the chosen index.
export async function ask(prompt, options, { name = '' } = {}) {
  const d = openDialog(name);
  await typeText(d.txt, prompt, { skip: d.root });
  return new Promise((resolve) => {
    options.forEach((label, i) => {
      d.choices.append(el('button', {
        class: 'btn small', type: 'button',
        onclick: () => { sfx('select'); closeDialog(d); resolve(i); },
      }, label));
    });
  });
}

// ── stat bars ──
export function setBar(iEl, cur, max) {
  const pct = clamp(max > 0 ? cur / max : 0, 0, 1);
  iEl.style.width = `${(pct * 100).toFixed(1)}%`;
  const bar = iEl.parentElement;
  if (bar.classList.contains('mp')) return;
  bar.classList.toggle('low', pct <= 0.25);
  bar.classList.toggle('mid', pct > 0.25 && pct <= 0.5);
}

// Paint a Pix into an existing canvas at its native size (CSS scales it up).
export function drawPix(canvas, pix) {
  canvas.width = pix.w;
  canvas.height = pix.h;
  const g = canvas.getContext('2d');
  const id = g.createImageData(pix.w, pix.h);
  id.data.set(pix.d);
  g.putImageData(id, 0, 0);
}

// ── sound toggle ──
export function refreshSoundButtons() {
  const on = settings.music || settings.sfx;
  $('#sound-toggle').textContent = on ? '🔊' : '🔇';
  const m = $('#overlay-menu [data-act="sound"]');
  if (m) m.textContent = `SOUND: ${on ? 'ON' : 'OFF'}`;
}

export function toggleSound() {
  const on = !(settings.music || settings.sfx);
  settings.music = on;
  settings.sfx = on;
  applyVolumes();
  saveSettings();
  refreshSoundButtons();
  if (on) sfx('blip');
}

export function initUi() {
  refreshSoundButtons();
  $('#sound-toggle').addEventListener('click', () => { unlock(); toggleSound(); });
}

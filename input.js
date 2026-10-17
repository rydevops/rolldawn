// input.js — keyboard + on-screen D-pad / A button / menu button.
// Scenes poll getDir() every frame and subscribe to 'action' / 'menu' events.

import { $ } from './util.js';

const DIRS = ['up', 'down', 'left', 'right'];
const KEYMAP = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};

const kb = [];          // keyboard directions, most recent first
let padDir = null;      // direction currently held on the touch pad
let enabled = true;
const listeners = { action: new Set(), menu: new Set() };

export function on(event, fn) {
  listeners[event].add(fn);
  return () => listeners[event].delete(fn);
}
const emit = (event) => { if (enabled) listeners[event].forEach((fn) => fn()); };

export function setEnabled(v) {
  enabled = v;
  if (!v) { kb.length = 0; padDir = null; paint(); }
}

export function getDir() {
  if (!enabled) return null;
  return padDir || kb[0] || null;
}

function paint() {
  const d = getDir();
  DIRS.forEach((k) => {
    const node = $(`#dpad .dp.${k}`);
    if (node) node.classList.toggle('on', d === k);
  });
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const dir = KEYMAP[e.key];
    if (dir) {
      e.preventDefault();
      const i = kb.indexOf(dir);
      if (i >= 0) kb.splice(i, 1);
      kb.unshift(dir);
      paint();
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
      if (e.key === ' ') e.preventDefault();
      emit('action');
    } else if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
      emit('menu');
    }
  });
  window.addEventListener('keyup', (e) => {
    const dir = KEYMAP[e.key];
    if (!dir) return;
    const i = kb.indexOf(dir);
    if (i >= 0) kb.splice(i, 1);
    paint();
  });
  window.addEventListener('blur', () => { kb.length = 0; padDir = null; paint(); });

  // ── touch D-pad: one pointer, direction = which side of the centre it is on ──
  const pad = $('#dpad');
  let padPointer = null;
  const dirFrom = (e) => {
    const r = pad.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(x, y) < 16) return null;
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    padPointer = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    padDir = dirFrom(e);
    paint();
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== padPointer) return;
    e.preventDefault();
    padDir = dirFrom(e);
    paint();
  });
  const release = (e) => {
    if (e.pointerId !== padPointer) return;
    padPointer = null;
    padDir = null;
    paint();
  };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
  pad.addEventListener('lostpointercapture', release);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── A button + menu button ──
  $('#btn-a').addEventListener('pointerdown', (e) => { e.preventDefault(); emit('action'); });
  $('#btn-menu').addEventListener('click', () => emit('menu'));
}

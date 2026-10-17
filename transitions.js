// transitions.js — screen wipes, fades and flashes (all plain DOM + CSS).

import { $, el, sleep } from './util.js';

const BARS = 10;
let root = null;

export function initTransitions() {
  root = $('#transition');
  root.innerHTML = '';
  for (let i = 0; i < BARS; i++) {
    root.append(el('div', { class: 'bar-wipe', style: { transitionDelay: `${(i % 5) * 38}ms` } }));
  }
}

// Slide the bars in until the screen is covered.
export async function wipeOut() {
  root.classList.add('covering');
  await sleep(540);
}

// Slide the bars away to reveal whatever is underneath.
export async function wipeIn() {
  root.classList.remove('covering');
  await sleep(540);
}

export async function fadeTo(black, ms = 500) {
  const f = $('#fade');
  f.style.transitionDuration = `${ms}ms`;
  f.classList.toggle('on', black);
  await sleep(ms);
}

export function flash() {
  const f = $('#flash');
  f.classList.remove('pop');
  void f.offsetWidth; // restart the animation
  f.classList.add('pop');
}

export async function strobe(times = 3, gap = 100) {
  for (let i = 0; i < times; i++) {
    flash();
    await sleep(gap);
  }
}

export function shake(node, big = false) {
  const cls = big ? 'shake-big' : 'shake';
  node.classList.remove('shake', 'shake-big');
  void node.offsetWidth;
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), big ? 600 : 400);
}

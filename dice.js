// dice.js — real 3D CSS dice. buildDie() fills an element with a cube; rollDie() tumbles it to a value.
//   Faces: 1 front · 6 back · 3 right · 4 left · 2 top · 5 bottom (opposites add up to 7).

import { el, sleep } from './util.js';

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// rotation [x, y] (degrees) that brings each face to the front
const FACE_ROT = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
};

const rnd = (n) => Math.floor(Math.random() * n);

export function buildDie(host) {
  host.innerHTML = '';
  const cube = el('div', { class: 'cube' });
  for (let v = 1; v <= 6; v++) {
    cube.append(el('div', { class: `face f${v}` }, PIPS[v].map((i) => el('i', { class: `p${i}` }))));
  }
  host.append(el('div', { class: 'hop' }, el('div', { class: 'tilt' }, cube)));
  host._cube = cube;
  setFace(host, 1);
  return host;
}

export function setFace(host, value) {
  const [rx, ry] = FACE_ROT[value];
  host._cube.style.transition = 'none';
  host._cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
}

// Tumble the die and land on `value`. Resolves when it has settled.
export async function rollDie(host, value, { duration = 1150 } = {}) {
  const cube = host._cube;
  cube.style.transition = 'none';
  cube.style.transform = `rotateX(${rnd(4) * 90}deg) rotateY(${rnd(4) * 90}deg)`;
  host.classList.remove('throwing');
  void host.offsetWidth; // flush so the new start pose takes effect
  const [rx, ry] = FACE_ROT[value];
  const spin = () => (2 + rnd(2)) * 360 * (Math.random() < 0.5 ? -1 : 1);
  cube.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.72, 0.18, 1)`;
  host.classList.add('throwing');
  cube.style.transform = `rotateX(${rx + spin()}deg) rotateY(${ry + spin()}deg)`;
  await sleep(duration);
}

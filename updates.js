// updates.js — service-worker registration and the "is there a newer version?" check.
//  • checkOnBoot()  : called while the boot screen shows. Asks the server for a new worker; if one exists it
//                     downloads it, then reloads so the player starts on the new version.
//  • While playing  : re-checks whenever the app comes back to the foreground. If a new version lands
//                     mid-session it is applied the next time the player reaches the title screen.

const CHECK_MS = 4000;     // never keep the player waiting longer than this on a slow connection
const INSTALL_MS = 12000;  // …or this long for a download

const supported = 'serviceWorker' in navigator && location.protocol.startsWith('http');
let reg = null;
let hadController = supported && !!navigator.serviceWorker.controller;
let ready = false;

export const updateReady = () => ready;
export const reloadForUpdate = () => location.reload();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function watchWorker(worker) {
  return new Promise((resolve) => {
    if (!worker) { resolve(false); return; }
    const done = () => {
      if (worker.state === 'activated') resolve(true);
      else if (worker.state === 'redundant') resolve(false);
    };
    worker.addEventListener('statechange', done);
    done();
  });
}

export async function initUpdates() {
  if (!supported) return;
  try {
    reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
  } catch (err) {
    console.warn('service worker unavailable', err);
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) ready = true;   // a newer version took over while the game was running
    hadController = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && reg) reg.update().catch(() => {});
  });
}

// Resolves 'updated' (page is about to reload), or 'current' / 'offline' / 'unsupported'.
export async function checkOnBoot() {
  if (!supported || !reg) return 'unsupported';
  try {
    await Promise.race([reg.update(), wait(CHECK_MS).then(() => { throw new Error('slow'); })]);
  } catch {
    return navigator.onLine ? 'current' : 'offline';
  }
  const incoming = reg.installing || reg.waiting;
  if (!incoming || !navigator.serviceWorker.controller) return 'current';
  const ok = await Promise.race([watchWorker(incoming), wait(INSTALL_MS).then(() => false)]);
  if (!ok) return 'current';
  // once per session at most, so a misbehaving host can never cause a reload loop
  try {
    if (sessionStorage.getItem('dawnroll.reloaded')) return 'current';
    sessionStorage.setItem('dawnroll.reloaded', '1');
  } catch { /* storage blocked: fall through */ }
  reloadForUpdate();
  await wait(5000);
  return 'updated';
}

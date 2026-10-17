// sw.js — offline play + automatic updates.
//  • install  : downloads EVERY game file (fresh, bypassing the HTTP cache) into a cache named after the
//               version. If any download fails the install fails and the old version keeps running.
//  • fetch    : network-first with revalidation (never a stale HTTP-cached copy); falls back to the saved
//               copy when offline or when the network is slow.
//  • activate : deletes caches from older versions.
// A new release = a changed version.js → the browser sees a changed worker → this cycle runs again.

importScripts('version.js');

const VERSION = self.DAWNROLL_VERSION;
const FILES = self.DAWNROLL_FILES;
const CACHE = `dawnroll-${VERSION}`;
const SLOW_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FILES.map(async (f) => {
      const res = await fetch(new Request(f, { cache: 'reload' }));
      if (!res.ok) throw new Error(`precache failed: ${f} (${res.status})`);
      await cache.put(f, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('dawnroll-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'version' && e.source) e.source.postMessage({ type: 'version', version: VERSION });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const lookup = () => cache.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
  const cached = await lookup();

  const net = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });

  if (!cached) return net.catch(() => Response.error());
  try {
    // slow or no connection? the saved copy wins so the game still opens quickly
    return await Promise.race([net, new Promise((_, rej) => setTimeout(rej, SLOW_MS))]);
  } catch {
    net.catch(() => {});
    return cached;
  }
}

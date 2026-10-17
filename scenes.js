// scenes.js — a minimal scene router. main.js registers scenes; scenes call go('name').
// A scene is just { enter(params), exit(), update(dt), draw(dt) } — every hook is optional.

const registry = new Map();
let current = null;
let currentName = '';
let switching = false;

export function register(name, scene) {
  registry.set(name, scene);
}

export const activeScene = () => currentName;

export async function go(name, params = {}) {
  const next = registry.get(name);
  if (!next) throw new Error(`Unknown scene: ${name}`);
  if (switching) return;
  switching = true;
  try {
    if (current && current.exit) await current.exit(name);
    current = null;
    currentName = name;
    if (next.enter) await next.enter(params);
    current = next;
  } finally {
    switching = false;
  }
}

export function tick(dt) {
  if (current && current.update) current.update(dt);
  if (current && current.draw) current.draw(dt);
}

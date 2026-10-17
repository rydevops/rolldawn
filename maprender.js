// maprender.js — paints the *static* layer of the map (grass, roads, trees, rocks, flowers…) into one big
// Pix once. Animated bits (tall grass, water, fire, the shrine glow) are drawn live by field.js.

import { Pix } from './pix.js';
import { TILE } from './config.js';
import { tileArt } from './tiles.js';
import { GROUND } from './world.js';

export function renderStatic(world, art = tileArt()) {
  const { w, h } = world;
  const out = new Pix(w * TILE, h * TILE);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = world.pick[i];
      const px = x * TILE, py = y * TILE;

      // base: grass everywhere (water & tall grass are drawn over it live)
      out.blit(art.grass[v & 3], px, py);

      if (world.ground[i] === GROUND.PATH) {
        out.blit(art.path[world.pathMask[i]][(v >> 2) & 1], px, py);
      }
      if (world.flower[i]) {
        const set = art.flowers[world.flower[i]];
        out.blit(set[(v >> 3) & 1], px, py);
      }

      switch (world.obj[i]) {
        case 'tree': out.blit(art.trees[(v >> 4) & 3], px, py); break;
        case 'bush': out.blit(art.bush, px, py); break;
        case 'rock': out.blit(art.rock, px, py); break;
        case 'fence': out.blit(art.fence, px, py); break;
        case 'sign': out.blit(art.sign, px, py); break;
        case 'campfire': out.blit(art.campfire, px, py); break;
        case 'thorn': out.blit(art.thorn[(v >> 5) % 3], px, py); break;
        default: break; // 'stone' is animated → live layer
      }
    }
  }
  return out;
}

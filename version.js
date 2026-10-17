// version.js — THE ONE FILE TO EDIT FOR A RELEASE.
// Classic script (not a module) so index.html, the ES modules AND the service worker can all read it.
//
//  1. Bump DAWNROLL_VERSION.
//  2. If you added/removed a file, update DAWNROLL_FILES (these are saved for offline play).
//  3. Upload to GitHub. Players get it the next time they open the app while online.

self.DAWNROLL_VERSION = '0.2.0';

self.DAWNROLL_FILES = [
  'index.html', 'manifest.webmanifest', 'version.js',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  'font-pixel.woff2', 'font-body.woff2',
  'fonts.css', 'base.css', 'screens.css', 'hud.css', 'battle.css', 'dice.css', 'menu.css',
  'main.js', 'updates.js', 'scenes.js', 'config.js', 'state.js', 'save.js', 'util.js', 'pix.js',
  'rules.js', 'entities.js', 'mobs.js', 'story.js',
  'world.js', 'tiles.js', 'maprender.js', 'sprites.js', 'scenery.js',
  'field.js', 'battle.js', 'battlefx.js', 'dice.js', 'menu.js',
  'intro.js', 'title.js', 'slots.js', 'gameover.js',
  'audio.js', 'sfx.js', 'music.js', 'ui.js', 'input.js', 'transitions.js',
];

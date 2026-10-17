# DAWNROLL — Chronicle of the Verdant Reach
A tiny dice-driven pixel RPG prototype. Plain HTML5 + CSS + ES-module JavaScript — **no build step, no images, no audio files, no folders.** All pixel art is painted by code and all music/SFX are synthesised with Web Audio.

## Play it on your iPhone (GitHub Pages)
1. Create a new GitHub repo (e.g. `dawnroll`) and upload **every file in this folder** to the repo root (drag & drop in the web UI works — keep the `.nojekyll` file).
2. Repo → **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → Save.
3. After a minute open `https://<you>.github.io/dawnroll/` in **Safari** on your iPhone.
4. Tap **Share → Add to Home Screen** for a full-screen app icon. Turn the ringer on or off — the game asks iOS to play sound either way.

Local testing: `python3 -m http.server` in this folder, then open http://localhost:8000 (ES modules need http, not file://).

## Versions, updates and offline play
- The version lives in **one place: `version.js`** (`DAWNROLL_VERSION`). It shows on the boot screen and the title screen.
- **Offline:** the first time a player opens the game online, every file is saved on the device (`sw.js`). After that it opens with no connection — saves are already local.
- **Updates:** every time the app opens (and whenever it returns to the foreground) it asks GitHub for the latest `sw.js`/`version.js`. If the version changed it downloads the full new set first, then reloads onto it. A slow or missing connection never blocks play (4 s limit, then the saved copy is used). If an update lands mid-session it is applied when the player next reaches the title screen.
- Files are always revalidated with the server, so GitHub Pages' 10-minute browser cache can't serve stale code.
- **To ship a release:** bump `DAWNROLL_VERSION`, add any new files to `DAWNROLL_FILES`, upload. (A file missing from the list still works online and is saved after its first use, but won't be there for a first-time offline start.)

## How to play
- **Touch to wake the world** (needed once so iOS allows sound) → intro cutscene (tap SKIP to jump ahead) → **TAP TO START** → pick a save slot.
- D-pad (or arrow keys / WASD) walks. **A** (or Enter / Space) reads signs, the standing stone and rests at the campfire (saves).
- Only **tall, waving grass** triggers fights. Heading north is riskier and nastier.
- Battle: tap **ATTACK**. Two dice roll:
  - 🔴 **Red** — 1-2 miss · 3-4 hit · 5-6 **critical** (double damage, ignores defense)
  - 🟢 **Green** — damage roll: `d6 + STR/2 − enemy DEF/2` (min 1)
  - 🍀 **Luck** — each LCK point gives a 3 % chance to re-roll a missed red die (once).
- Stats: **HP, MP, STR, DEF, LCK, ARC (Arcana — magic aptitude, ready for spells).**

## File map
| File | Job |
|---|---|
| `index.html` | All screens (markup only) |
| `base.css` `screens.css` `hud.css` `battle.css` `dice.css` `menu.css` `fonts.css` | Styles, one concern each |
| `main.js` | Boot, scene registration, frame loop |
| `scenes.js` | Tiny scene router (`go('field')`) |
| `config.js` | **Every tunable number** (stats, encounter rate, dice, luck) |
| `state.js` `save.js` | Shared game state; 3 localStorage save slots |
| `rules.js` `entities.js` `mobs.js` | Dice maths, player/XP, monster table + encounters |
| `story.js` | All text: cutscene, signs, lore, battle lines |
| `world.js` `tiles.js` `maprender.js` `field.js` | Map generation, tile art, exploration scene |
| `battle.js` `battlefx.js` `dice.js` | Battle flow, effects, 3-D CSS dice |
| `pix.js` `sprites.js` `scenery.js` | Pixel-art painter, character/monster sprites, sky & hills |
| `intro.js` `title.js` `slots.js` `gameover.js` `menu.js` | Other screens |
| `audio.js` `sfx.js` `music.js` | Web Audio engine, sound effects, songs |
| `ui.js` `input.js` `transitions.js` `util.js` | Shared helpers |
| `version.js` | **Version tag + offline file list (edit on every release)** |
| `updates.js` `sw.js` | Update check on open; offline cache worker |
| `manifest.webmanifest` `icon-*.png` | Home-screen app |

## Extending it
- **New monster:** add an entry in `mobs.js` + a sprite in `sprites.js`, then add its id to a zone in `rollEncounter`.
- **New song / sound:** add to `SONGS` in `music.js` / `SOUNDS` in `sfx.js`.
- **Magic:** the `arc` and `mp` stats already exist — add a command to the `COMMANDS` list in `battle.js`.
- **New scene:** write a module exporting `{ enter, exit, update, draw }`, `register()` it in `main.js`, `go()` to it.
- Debug from the browser console: `__dawnroll.field.teleport(24, 20)`, `__dawnroll.field.encounter()`.

Fonts are open-licensed (SIL OFL). Everything else is original to this prototype.

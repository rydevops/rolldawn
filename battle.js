// battle.js — turn-based battle flow. Player strikes first; every attack throws two dice:
//   RED = does it land? (1-2 miss · 3-4 hit · 5-6 critical)     GREEN = how hard?
// The maths lives in rules.js, the pictures in battlefx.js, the words in story.js.

import { game } from './state.js';
import { $, el, sleep, ease } from './util.js';
import { spawnMob } from './mobs.js';
import { resolveAttack, describeCalc, classify } from './rules.js';
import { grantXp } from './entities.js';
import { battle as T } from './story.js';
import { buildDie, rollDie, setFace } from './dice.js';
import * as fx from './battlefx.js';
import { showScreen, typeText, setBar, waitAdvance } from './ui.js';
import { sfx } from './sfx.js';
import { playMusic, stopMusic, playJingle } from './music.js';
import { wipeIn, wipeOut, flash, shake } from './transitions.js';
import { go } from './scenes.js';

// Commands are data — add { id: 'magic', label: 'MAGIC' } here later and handle it in playerTurn().
const COMMANDS = [{ id: 'attack', label: 'ATTACK' }];

let mob = null;
let running = false;
let keyHandler = null;

const screen = () => $('#screen-battle');
const msgEl = () => $('#battle-msg');

// ───────────────────────── text + HUD ─────────────────────────
async function msg(text, wait = 600) {
  await typeText(msgEl(), text, { speed: 17, skip: screen() });
  if (wait) await sleep(wait);
}

// a message that waits for a tap
async function msgTap(text) {
  await typeText(msgEl(), text, { speed: 17, skip: screen() });
  msgEl().textContent = `${text}  ▼`;
  await waitAdvance(screen());
  sfx('blip');
}

function paintCards() {
  const p = game.player;
  $('#enemy-name').textContent = mob.name.toUpperCase();
  $('#enemy-lv').textContent = `Lv${mob.level}`;
  $('#enemy-hp').textContent = `${Math.max(0, mob.hp)}/${mob.maxHp}`;
  setBar($('#enemy-hp-bar'), mob.hp, mob.maxHp);
  $('#bhero-name').textContent = p.name.toUpperCase();
  $('#bhero-lv').textContent = `Lv${p.level}`;
  $('#bhero-hp').textContent = `${Math.max(0, p.hp)}/${p.maxHp}`;
  setBar($('#bhero-hp-bar'), p.hp, p.maxHp);
  setBar($('#bhero-mp-bar'), p.mp, p.maxMp);
}

function floatText(lx, ly, text, cls = '') {
  const { x, y } = fx.toCss(lx, ly);
  const n = el('div', { class: `dmg ${cls}` }, text);
  n.style.left = `${x}px`;
  n.style.top = `${y}px`;
  $('#fx-layer').append(n);
  setTimeout(() => n.remove(), 1200);
  return n;
}
function floatCrit(lx, ly, dmg) {
  const { x, y } = fx.toCss(lx, ly);
  const n = el('div', { class: 'dmg crit' }, String(dmg), el('small', { text: 'CRITICAL!' }));
  n.style.left = `${x}px`;
  n.style.top = `${y}px`;
  $('#fx-layer').append(n);
  setTimeout(() => n.remove(), 1200);
}

// ───────────────────────── dice ─────────────────────────
const LABEL = { miss: 'MISS', hit: 'HIT', crit: 'CRIT!' };

function showRed(v) {
  const kind = classify(v);
  const rr = $('#res-red');
  rr.textContent = LABEL[kind];
  rr.className = `die-result ${kind}`;
}

async function throwDice(res) {
  const tray = $('#dice-tray');
  const red = $('#die-red'), green = $('#die-green');
  const rr = $('#res-red'), rg = $('#res-green'), calc = $('#dice-calc');
  rr.textContent = ''; rr.className = 'die-result';
  rg.textContent = ''; rg.className = 'die-result';
  calc.textContent = '';
  red.classList.remove('dimmed');
  green.classList.remove('dimmed');
  tray.classList.add('show');
  await sleep(240);

  sfx('diceRoll');
  const pRed = rollDie(red, res.rolls[0], { duration: 1050 }).then(() => { sfx('diceLand'); showRed(res.rolls[0]); });
  const pGreen = rollDie(green, res.green, { duration: 1200 }).then(() => sfx('diceLand'));
  await pRed;

  if (res.lucky) {
    await sleep(320);
    sfx('lucky');
    rr.textContent = 'LUCKY!';
    rr.className = 'die-result hit';
    msgEl().textContent = T.luckyReroll;
    await pGreen;
    await sleep(250);
    sfx('diceRoll');
    await rollDie(red, res.rolls[1], { duration: 1000 });
    sfx('diceLand');
    showRed(res.rolls[1]);
  }
  await pGreen;

  if (res.outcome === 'miss') {
    green.classList.add('dimmed');
    rg.textContent = '—';
    rg.className = 'die-result dim';
  } else {
    rg.textContent = String(res.green);
  }
  calc.textContent = describeCalc(res);
  await sleep(res.outcome === 'miss' ? 650 : 950);
}

function hideTray() { $('#dice-tray').classList.remove('show'); }

// ───────────────────────── attack animations ─────────────────────────
function pulse(obj, ms, color = false) {
  obj.red = color;
  obj.flash = 1;
  fx.tween(ms, (t) => { obj.flash = 1 - t; });
}

async function heroStrike(res) {
  const L = fx.layout(), S = fx.spriteSize();
  const dist = (L.mob.x - S.mob.w * 0.35) - (L.hero.x + S.hero.w * 0.45);
  const mx = L.mob.x, my = L.mob.y - S.mob.h * 0.5;

  await fx.tween(150, (t) => { fx.hero.ox = -3 * t; }, ease.outCubic);
  fx.hero.pose = 'attack';
  sfx('swing');
  await fx.tween(140, (t) => { fx.hero.ox = -3 + (dist + 3) * t; }, ease.inCubic);

  if (res.outcome === 'miss') {
    sfx('miss');
    fx.slash(mx - 3, my, { dir: 1 });
    floatText(mx, my - 4, 'MISS', 'miss');
    fx.tween(320, (t) => { fx.mob.oy = -6 * Math.sin(t * Math.PI); fx.mob.ox = 6 * Math.sin(t * Math.PI); });
  } else {
    const crit = res.outcome === 'crit';
    sfx(crit ? 'crit' : 'hit');
    fx.slash(mx - 3, my, { dir: 1, crit });
    fx.spark(mx - 4, my, { n: crit ? 22 : 11, color: crit ? ['#fff6a8', '#ffd23f', '#ffffff'] : ['#ffffff', '#ffe9a8'], speed: crit ? 70 : 46, size: crit ? 2 : 1 });
    pulse(fx.mob, 260);
    fx.tween(300, (t) => { fx.mob.ox = 5 * Math.sin(t * Math.PI) * (crit ? 1.6 : 1); });
    mob.hp = Math.max(0, mob.hp - res.damage);
    paintCards();
    if (crit) { floatCrit(mx, my - 6, res.damage); flash(); shake(screen(), true); }
    else { floatText(mx, my - 4, `-${res.damage}`); shake(screen()); }
  }
  await sleep(170);
  fx.hero.pose = 'idle';
  await fx.tween(300, (t) => { fx.hero.ox = dist * (1 - t); }, ease.outCubic);
  fx.hero.ox = 0;
}

async function mobStrike(res) {
  const L = fx.layout(), S = fx.spriteSize();
  const dist = (L.mob.x - S.mob.w * 0.35) - (L.hero.x + S.hero.w * 0.45);
  const hx = L.hero.x + 2, hy = L.hero.y - S.hero.h * 0.5;
  const p = game.player;

  await fx.tween(170, (t) => { fx.mob.ox = 3 * t; }, ease.outCubic);
  sfx('mobAttack', mob.atk.sfx);
  await fx.tween(170, (t) => { fx.mob.ox = 3 - (dist + 3) * t; }, ease.inCubic);

  if (res.outcome === 'miss') {
    sfx('miss');
    floatText(hx, hy - 6, 'MISS', 'miss');
    fx.tween(320, (t) => { fx.hero.ox = -6 * Math.sin(t * Math.PI); fx.hero.oy = -5 * Math.sin(t * Math.PI); });
  } else {
    const crit = res.outcome === 'crit';
    sfx('hurt');
    pulse(fx.hero, 300, true);
    fx.spark(hx + 4, hy, { n: crit ? 20 : 10, color: ['#ff6b6b', '#ffd0d0', '#ffffff'], speed: crit ? 62 : 40 });
    fx.tween(320, (t) => { fx.hero.ox = -6 * Math.sin(t * Math.PI) * (crit ? 1.5 : 1); });
    p.hp = Math.max(0, p.hp - res.damage);
    paintCards();
    floatText(hx, hy - 6, `-${res.damage}`, 'hurt');
    if (crit) { flash(); shake(screen(), true); } else shake(screen());
  }
  await sleep(170);
  await fx.tween(300, (t) => { fx.mob.ox = -dist * (1 - t); }, ease.outCubic);
  fx.mob.ox = 0;
}

// ───────────────────────── turns ─────────────────────────
function chooseCommand() {
  return new Promise((resolve) => {
    const box = $('#battle-cmds');
    box.innerHTML = '';
    const done = (id) => {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
      box.innerHTML = '';
      sfx('select');
      resolve(id);
    };
    COMMANDS.forEach((c) => box.append(el('button', { class: 'btn', type: 'button', onclick: () => done(c.id) }, c.label)));
    keyHandler = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') done(COMMANDS[0].id); };
    window.addEventListener('keydown', keyHandler);
  });
}

async function playerTurn() {
  const p = game.player;
  typeText(msgEl(), `What will ${p.name} do?`, { speed: 14, skip: screen(), blip: false });
  const cmd = await chooseCommand();
  if (cmd === 'attack') {
    await msg(T.playerSwing(p.name, mob.name), 250);
    const res = resolveAttack(p, mob);
    await throwDice(res);
    hideTray();
    await sleep(140);
    await heroStrike(res);
    if (res.outcome === 'miss') await msg(T.miss(p.name), 420);
    else await msg(res.outcome === 'crit' ? T.crit(res.damage) : T.hit(res.damage), 520);
  }
}

async function mobTurn() {
  await msg(T.mobSwing(mob), 250);
  const res = resolveAttack(mob, game.player);
  await throwDice(res);
  hideTray();
  await sleep(140);
  await mobStrike(res);
  if (res.outcome === 'miss') await msg(T.miss(mob.name), 420);
  else await msg(res.outcome === 'crit' ? T.hurtCrit(res.damage) : T.hurtHit(res.damage), 520);
}

// ───────────────────────── endings ─────────────────────────
async function victory() {
  const L = fx.layout(), S = fx.spriteSize();
  sfx('enemyDown');
  for (let i = 0; i < 3; i++) { fx.mob.flash = 1; await sleep(80); fx.mob.flash = 0; await sleep(70); }
  fx.mob.dead = true;
  fx.tween(750, (t) => {
    fx.mob.alpha = 1 - t;
    fx.mob.sy = 1 - 0.45 * t;
    if (Math.random() < 0.5) fx.star(L.mob.x + (Math.random() - 0.5) * S.mob.w, L.mob.y - Math.random() * S.mob.h);
  });
  await sleep(500);
  stopMusic(0.2);
  playJingle('victory');
  await sleep(300);
  fx.mob.hidden = true;

  const p = game.player;
  const ups = grantXp(p, mob.xp);
  game.kills += 1;
  paintCards();
  await msg(mob.defeat, 350);
  await msgTap(T.victory(mob.name, mob.xp));

  for (const up of ups) {
    sfx('levelup');
    for (let i = 0; i < 10; i++) fx.star(L.hero.x + (Math.random() - 0.5) * 24, L.hero.y - Math.random() * 20, '#9ff3ff');
    const gains = [`HP +${up.hp} (d6 rolled ${up.hpRoll})`, `MP +${up.mp}`, 'STR +1'];
    if (up.def) gains.push('DEF +1');
    if (up.lck) gains.push('LCK +1');
    if (up.arc) gains.push('ARC +1');
    paintCards();
    await msgTap(`${T.levelUp(up.level)}\n${gains.join(' · ')}`);
  }
  await leave('field');
}

async function defeat() {
  stopMusic(0.2);
  sfx('hurt');
  fx.tween(650, (t) => { fx.hero.rot = -1.35 * t; fx.hero.alpha = 1 - 0.65 * t; fx.hero.oy = 7 * t; }, ease.outCubic);
  await msg(`${game.player.name} collapses…`, 900);
  playJingle('gameover');
  await sleep(1400);
  await leave('gameover');
}

async function leave(where) {
  await wipeOut();
  running = false;
  if (where === 'field') await go('field', { mode: 'return' });
  else await go('gameover');
}

// ───────────────────────── scene hooks ─────────────────────────
async function run(params) {
  running = true;
  mob = spawnMob(params.mobId);
  fx.setup($('#battle-canvas'), $('#battle-stage'), mob.id, params.zone || 1);
  fx.hero.ox = -56;
  fx.mob.ox = 60;
  buildDie($('#die-red'));
  buildDie($('#die-green'));
  setFace($('#die-red'), 1);
  setFace($('#die-green'), 1);
  hideTray();
  $('#battle-cmds').innerHTML = '';
  msgEl().textContent = '';
  paintCards();
  showScreen('screen-battle');
  playMusic('battle', { fade: 0.15 });
  await sleep(60);
  await wipeIn();

  fx.tween(560, (t) => { fx.hero.ox = -56 * (1 - t); }, ease.outCubic);
  await fx.tween(560, (t) => { fx.mob.ox = 60 * (1 - t); }, ease.outCubic);
  await msg(mob.intro, 450);

  for (;;) {
    await playerTurn();
    if (mob.hp <= 0) { await victory(); return; }
    await sleep(160);
    await mobTurn();
    if (game.player.hp <= 0) { await defeat(); return; }
    await sleep(120);
  }
}

export default {
  enter(params) {
    run(params).catch((e) => console.error('battle crashed', e));
  },
  exit() {
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    hideTray();
    fx.stopDrawing();
  },
  draw(dt) { if (running) fx.draw(dt); },
};

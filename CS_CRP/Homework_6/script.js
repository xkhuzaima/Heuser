'use strict';

// ---------- A. Constants ----------
const GAME_WIDTH = 480, GAME_HEIGHT = 640;
const RENDER_SCALE = 2;              // backing-store multiplier for sharpness
const MAX_DT = 0.05;                 // seconds
const START_LIVES = 3;
const CATCHER_WIDTH = 90, CATCHER_HEIGHT = 18, CATCHER_BOTTOM_GAP = 32;
const CATCHER_KEY_SPEED = 450, CATCHER_POINTER_SPEED = 900;
const FIRST_SPAWN_DELAY = 0.6;
const SPAWN_INTERVAL_START = 1.10, SPAWN_INTERVAL_MIN = 0.40;
const FALL_SPEED_START = 150, FALL_SPEED_MAX = 420;
const BAD_CHANCE_START = 0.15, BAD_CHANCE_MAX = 0.35;
const BONUS_CHANCE = 0.08, SPEED_JITTER = 0.10, SPAWN_MARGIN = 8;
const LEVEL_TIME = 12, MAX_LEVEL = 10, RAMP_TIME = LEVEL_TIME * (MAX_LEVEL - 1);
const STREAK_STEP = 5, MAX_MULTIPLIER = 4;
const RESTART_DELAY = 0.8;
// Stage 4: storage
const SAVE_KEY = 'starfall.save.v1';
const SAVE_VERSION = 1;
const SAVE_INT_MAX = 999999999;
const RESET_CONFIRM_MS = 3000, RESET_DONE_MS = 1500;
const RESET_GUARD_MS = 400;         // Stage 5 fix B1
const POINTER_SWITCH_PX = 24;       // Stage 5 fix B2
const NEW_BEST_IN_TIME = 0.35;      // ribbon pop-in, seconds
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const TITLE_FONT_STACK = 'ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, -apple-system, "Segoe UI", sans-serif';
const SPRITE_PAD = 10;          // transparent margin around each sprite for its glow (game units)
const ART_SEED = 20261029;      // fixed seed, so the sky looks the same on every load
const TWINKLE_COUNT = 16;
const DEBUG_HITBOXES = false;   // set true to outline hitboxes when checking the art

const PALETTE = {
  midnight: '#0b1026', indigo: '#1b1f4b', dusk: '#3a2a6b', plum: '#5b3a78',
  farHill: '#241a4a', nearHill: '#120f2e', pageBg: '#05070f',
  starlight: '#fff6d8', coolStar: '#cfd8ff', mist: '#9aa3d6',
  starGold: '#ffd23f', starCore: '#fff6c2', amber: '#f29e1f', amberDeep: '#b86b12', cocoa: '#5a3a10',
  gemIce: '#d6f7ff', gemCyan: '#5ce1ff', gemBlue: '#1d7fd1', gemEdge: '#0f4f8a',
  ember: '#ff5a36', flare: '#ffb347',
  rockLight: '#8a7480', rock: '#5a4a52', rockDark: '#2e252c', rockLine: '#1c161b',
  moonCream: '#f4ecc2', moonShade: '#c9b98a', moonLine: '#8f8460',
  planetLight: '#8d78d6', heart: '#ff6b9a'
};

const ITEM_TYPES = {
  good:  { w: 28, h: 28, points: 10, speedMul: 1.00, color: PALETTE.starGold },
  bonus: { w: 22, h: 22, points: 30, speedMul: 1.35, color: PALETTE.gemCyan },
  bad:   { w: 30, h: 30, points: 0,  speedMul: 1.10, color: PALETTE.ember }
};

// Stage 3: feedback
const MAX_PARTICLES = 200, MAX_FLOATERS = 12;
const MASTER_VOLUME = 0.3;
const HEART_POP_DUR = 0.45, SCORE_POP_DUR = 0.18, MULT_POP_DUR = 0.35;
const FLOATER_RISE = 45;            // game units per second
const GAMEOVER_IN_TIME = 0.4;       // must stay below RESTART_DELAY
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const BURSTS = {
  star:   { count: 14, colors: [PALETTE.starGold, PALETTE.starCore, PALETTE.amber], speed: [60, 170], life: [0.35, 0.7], size: [1.5, 3], gravity: 260, drag: 1.5, lift: 60, shape: 'spark' },
  gem:    { count: 20, colors: [PALETTE.gemIce, PALETTE.gemCyan, PALETTE.starlight], speed: [80, 210], life: [0.4, 0.8], size: [1.5, 3], gravity: 180, drag: 1.2, lift: 80, shape: 'spark' },
  mult:   { count: 12, colors: [PALETTE.gemCyan, PALETTE.gemIce], speed: [120, 220], life: [0.4, 0.7], size: [1.5, 2.5], gravity: 120, drag: 1.5, lift: 40, shape: 'spark' },
  meteor: { count: 26, colors: [PALETTE.ember, PALETTE.flare, PALETTE.rockLight, PALETTE.rock], speed: [90, 260], life: [0.4, 0.9], size: [2, 4], gravity: 420, drag: 1.0, lift: 50, shape: 'dot' },
  miss:   { count: 10, colors: [PALETTE.mist, PALETTE.starGold], speed: [30, 90], life: [0.4, 0.7], size: [1, 2.2], gravity: -60, drag: 2, lift: 30, shape: 'dot' },
  start:  { count: 18, colors: [PALETTE.starGold, PALETTE.starlight, PALETTE.gemCyan], speed: [80, 220], life: [0.5, 0.9], size: [1.5, 3], gravity: 300, drag: 1.2, lift: 120, shape: 'spark' },
  level:  { count: 30, colors: [PALETTE.starGold, PALETTE.starCore, PALETTE.gemCyan, PALETTE.heart], speed: [100, 260], life: [0.6, 1.1], size: [1.5, 3], gravity: 200, drag: 1.2, lift: 40, shape: 'spark' }
};

// ---------- B. Canvas setup ----------
const canvas = document.getElementById('game-canvas');
const muteBtn = document.getElementById('mute-btn');
const pauseBtn = document.getElementById('pause-btn');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const quitBtn = document.getElementById('quit-btn');
const resetBtn = document.getElementById('reset-btn');
const ctx = canvas.getContext('2d');
canvas.width = GAME_WIDTH * RENDER_SCALE;
canvas.height = GAME_HEIGHT * RENDER_SCALE;
ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);

// ---------- C. State objects ----------
const game = {
  state: 'menu',      // 'menu' | 'playing' | 'paused' | 'over'
  score: 0, lives: START_LIVES,
  streak: 0, bestStreak: 0, caughtCount: 0,
  elapsed: 0,         // seconds in 'playing'
  level: 1,
  spawnTimer: 0,      // seconds until next spawn
  overTimer: 0,       // seconds since game over
  newBest: false, recorded: false
};
const catcher = {
  x: (GAME_WIDTH - CATCHER_WIDTH) / 2,                       // left edge
  y: GAME_HEIGHT - CATCHER_BOTTOM_GAP - CATCHER_HEIGHT,      // top edge = 590
  w: CATCHER_WIDTH, h: CATCHER_HEIGHT
};
let items = [];       // array of item objects
let bgCanvas = null; const sprites = {}; let twinkles = [];
const input = { left: false, right: false, pointerX: GAME_WIDTH / 2, usePointer: false, lastClientX: null, travel: 0 };
const heldKeys = {};
const fx = {
  clock: 0,                                   // seconds, always advancing (for pulses/bobs)
  particles: [], floaters: [],
  shakeTime: 0, shakeDur: 0, shakeMag: 0, shakeX: 0, shakeY: 0,
  flashTime: 0, flashDur: 0, flashMax: 0, flashRGB: '255,90,54',
  squashTime: 0, squashDur: 0.22, squashAmt: 0,
  tilt: 0, prevCatcherX: catcher.x, wakeTimer: 0,
  scorePop: 0, multPop: 0, heartPop: new Array(START_LIVES).fill(0),
  bannerText: '', bannerSub: '', bannerTime: 0, bannerDur: 1,
  canvasClickable: null
};
let audioCtx = null, masterGain = null, noiseBuffer = null;
let muted = false;                            // loaded from saveData at startup; change only via setMuted()
let saveData = defaultSaveData(); let storageOK = true; let uiState = null; let resetTimer = null, resetArmed = false, resetArmedAt = 0;

// ---------- D. Functions ----------

// Maths helpers
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function randRange(min, max) { return min + Math.random() * (max - min); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getDifficulty() {
  const d = Math.min(game.elapsed / RAMP_TIME, 1);
  return {
    spawnInterval: lerp(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, d),
    fallSpeed: lerp(FALL_SPEED_START, FALL_SPEED_MAX, d),
    badChance: lerp(BAD_CHANCE_START, BAD_CHANCE_MAX, d),
    level: Math.min(MAX_LEVEL, 1 + Math.floor(game.elapsed / LEVEL_TIME))
  };
}

function getMultiplier() {
  return Math.min(1 + Math.floor(game.streak / STREAK_STEP), MAX_MULTIPLIER);
}

// Save data (Stage 4)
function defaultSaveData() {
  return { version: SAVE_VERSION, highScore: 0, bestStreak: 0, bestLevel: 1,
           gamesPlayed: 0, totalCaught: 0, muted: false };
}
function readInt(value, min, max, fallback) {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  return clamp(Math.floor(value), min, max);
}
function sanitizeSaveData(obj) {
  const d = defaultSaveData();
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return d;
  d.highScore   = readInt(obj.highScore,   0, SAVE_INT_MAX, 0);
  d.bestStreak  = readInt(obj.bestStreak,  0, SAVE_INT_MAX, 0);
  d.bestLevel   = readInt(obj.bestLevel,   1, MAX_LEVEL, 1);
  d.gamesPlayed = readInt(obj.gamesPlayed, 0, SAVE_INT_MAX, 0);
  d.totalCaught = readInt(obj.totalCaught, 0, SAVE_INT_MAX, 0);
  d.muted       = obj.muted === true;
  return d;
}
function loadSaveData() {
  let raw = null;
  try { raw = window.localStorage.getItem(SAVE_KEY); }
  catch (err) { storageOK = false; return defaultSaveData(); }
  if (raw === null) return defaultSaveData();
  try { return sanitizeSaveData(JSON.parse(raw)); }
  catch (err) { return defaultSaveData(); }
}
function writeSaveData() {
  saveData = sanitizeSaveData(saveData);
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    storageOK = true;
    return true;
  } catch (err) { storageOK = false; return false; }
}
function resetSaveData() {
  const keepMuted = muted;
  try { window.localStorage.removeItem(SAVE_KEY); } catch (err) { storageOK = false; }
  saveData = defaultSaveData();
  saveData.muted = keepMuted;
  writeSaveData();
}
function recordRun() {
  if (game.recorded) return false;
  game.recorded = true;
  const isNewBest = game.score > saveData.highScore;
  saveData.highScore   = Math.max(saveData.highScore, game.score);
  saveData.bestStreak  = Math.max(saveData.bestStreak, game.bestStreak);
  saveData.bestLevel   = Math.max(saveData.bestLevel, game.level);
  saveData.gamesPlayed += 1;
  saveData.totalCaught += game.caughtCount;
  writeSaveData();
  return isNewBest;
}

// State changes
function resetGame() {
  game.score = 0;
  game.lives = START_LIVES;
  game.streak = 0;
  game.bestStreak = 0;
  game.caughtCount = 0;
  game.elapsed = 0;
  game.level = 1;
  game.spawnTimer = FIRST_SPAWN_DELAY;
  game.overTimer = 0;
  game.newBest = false; game.recorded = false;
  items = [];
  catcher.x = (GAME_WIDTH - catcher.w) / 2;
  resetEffects();
}

function startGame() {
  resetGame();
  game.state = 'playing';
  fxStart();
}

function endGame() {
  game.state = 'over';
  game.overTimer = 0;
  game.newBest = recordRun();
  fxGameOver(game.newBest);
}

function handleAction() {
  if (game.state === 'menu') {
    startGame();
  } else if (game.state === 'paused') {
    resumeGame();
  } else if (game.state === 'over' && game.overTimer >= RESTART_DELAY) {
    startGame();
  }
}

function pauseGame(silent) {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  clearMoveKeys();   // Stage 5 fix B6
  if (!silent) sndClick();
}
function resumeGame() {
  if (game.state !== 'paused') return;
  game.state = 'playing';
  sndClick();
}
function togglePause() { if (game.state === 'playing') pauseGame(false); else if (game.state === 'paused') resumeGame(); }
function goToMenu() { resetGame(); game.state = 'menu'; }
function quitToMenu() { if (game.state !== 'paused') return; recordRun(); goToMenu(); sndClick(); }
function restartRun() { if (game.state !== 'paused') return; recordRun(); startGame(); }
function menuFromOver() { if (game.state === 'over' && game.overTimer >= RESTART_DELAY) { goToMenu(); sndClick(); } }

function setResetLabel(text, cls) {
  resetBtn.textContent = text;
  resetBtn.classList.remove('is-armed', 'is-done');
  if (cls) resetBtn.classList.add(cls);
}
function disarmReset() {
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = null; resetArmed = false;
  setResetLabel('Reset data', '');
}
function onResetClick() {
  if (game.state !== 'menu') return;
  if (!resetArmed) {
    disarmReset(); resetArmed = true; resetArmedAt = performance.now();   // Stage 5 fix B1
    setResetLabel('Sure? Click again', 'is-armed');
    resetTimer = setTimeout(disarmReset, RESET_CONFIRM_MS);
    sndClick();
  } else {
    if (performance.now() - resetArmedAt < RESET_GUARD_MS) return;   // 2nd click of a double-click

    resetSaveData();
    if (resetTimer) clearTimeout(resetTimer);
    resetArmed = false;
    setResetLabel('Data cleared', 'is-done');
    resetTimer = setTimeout(disarmReset, RESET_DONE_MS);
    sndMiss();
  }
}

// Spawning
function chooseItemType(diff) {
  const r = Math.random();
  if (r < diff.badChance) return 'bad';
  if (r < diff.badChance + BONUS_CHANCE) return 'bonus';
  return 'good';
}

function spawnItem(diff) {
  const type = chooseItemType(diff);
  const def = ITEM_TYPES[type];
  items.push({
    type: type,
    x: randRange(SPAWN_MARGIN, GAME_WIDTH - def.w - SPAWN_MARGIN),
    y: -def.h,
    w: def.w,
    h: def.h,
    vy: diff.fallSpeed * def.speedMul * randRange(1 - SPEED_JITTER, 1 + SPEED_JITTER),
    dead: false,
    age: 0, phase: randRange(0, Math.PI * 2), trailTimer: 0
  });
}

// Gameplay consequences
function onCatch(item) {
  const oldMult = getMultiplier();
  const oldScore = game.score;
  game.streak++;
  if (game.streak > game.bestStreak) game.bestStreak = game.streak;
  game.caughtCount++;
  game.score += ITEM_TYPES[item.type].points * getMultiplier();
  fxCatch(item, game.score - oldScore, getMultiplier() > oldMult);
}

function onHitBad(item) {
  game.streak = 0;
  fxMeteorHit(item);
  loseLife();
}

function onMiss(item) {
  game.streak = 0;
  fxMiss(item);
  loseLife();
}

function loseLife() {
  game.lives = Math.max(0, game.lives - 1);
  if (game.lives < fx.heartPop.length) fx.heartPop[game.lives] = HEART_POP_DUR;
  if (game.lives === 0) endGame();
}

function onLevelUp(level) {
  showBanner('LEVEL UP!', 'Level ' + level, 1.6);
  burst(240, 230, BURSTS.level);
  flash('255,210,63', 0.12, 0.35);
  sndLevelUp();
}

// Effects
function resetEffects() {
  fx.particles.length = 0;
  fx.floaters.length = 0;
  fx.shakeTime = 0; fx.flashTime = 0; fx.squashTime = 0;
  fx.shakeX = 0; fx.shakeY = 0;
  fx.tilt = 0; fx.wakeTimer = 0;
  fx.scorePop = 0; fx.multPop = 0; fx.bannerTime = 0;
  for (let i = 0; i < fx.heartPop.length; i++) fx.heartPop[i] = 0;
  fx.prevCatcherX = catcher.x;
}

function addParticle(x, y, vx, vy, life, size, color, gravity, drag, shape) {
  if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();   // cap: drop oldest
  fx.particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, maxLife: life, size: size,
    color: color, gravity: gravity, drag: drag, shape: shape });
}
function burst(x, y, b) {
  for (let i = 0; i < b.count; i++) {
    const a = Math.random() * Math.PI * 2, sp = randRange(b.speed[0], b.speed[1]);
    addParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - b.lift,
      randRange(b.life[0], b.life[1]), randRange(b.size[0], b.size[1]),
      b.colors[Math.floor(Math.random() * b.colors.length)], b.gravity, b.drag, b.shape);
  }
}
function addFloater(text, x, y, color, size, life) {
  if (fx.floaters.length >= MAX_FLOATERS) fx.floaters.shift();
  life = life || 0.8;
  fx.floaters.push({ text: text, x: clamp(x, 40, GAME_WIDTH - 40), y: y, vy: -FLOATER_RISE,
    life: life, maxLife: life, color: color, size: size });
}
function addShake(mag, dur) {
  if (REDUCED_MOTION) return;
  fx.shakeMag = Math.max(fx.shakeTime > 0 ? fx.shakeMag : 0, mag);
  fx.shakeDur = fx.shakeTime = dur;
}
function flash(rgb, maxAlpha, dur) {
  fx.flashRGB = rgb;
  fx.flashMax = REDUCED_MOTION ? maxAlpha / 2 : maxAlpha;
  fx.flashDur = fx.flashTime = dur;
}
function squash(amount, dur) {
  fx.squashAmt = amount;
  fx.squashDur = fx.squashTime = dur;
}
function showBanner(text, sub, dur) {
  fx.bannerText = text; fx.bannerSub = sub;
  fx.bannerDur = fx.bannerTime = dur;
}

function fxStart() {
  showBanner('GO!', '', 0.9);
  burst(catcher.x + catcher.w / 2, catcher.y, BURSTS.start);
  sndStart();
}
function fxGameOver(newBest) {
  fx.bannerTime = 0;
  if (newBest) sndLevelUp(0.3); else sndGameOver();
}
function fxCatch(item, gained, multUp) {
  const cx = item.x + item.w / 2, cy = Math.min(item.y + item.h / 2, catcher.y);
  const ccx = catcher.x + catcher.w / 2;
  if (item.type === 'good') {
    burst(cx, cy, BURSTS.star);
    addFloater('+' + gained, cx, catcher.y - 14, PALETTE.starGold, 18, 0.8);
    squash(0.16, 0.2);
    sndCatchStar(getMultiplier());
  } else {
    burst(cx, cy, BURSTS.gem);
    addFloater('+' + gained, cx, catcher.y - 14, PALETTE.gemCyan, 22, 0.8);
    squash(0.22, 0.24);
    sndCatchGem();
  }
  fx.scorePop = SCORE_POP_DUR;
  if (multUp) {
    const m = getMultiplier();
    addFloater('x' + m + '!', ccx, catcher.y - 40, PALETTE.gemCyan, 26, 0.9);
    burst(ccx, catcher.y, BURSTS.mult);
    fx.multPop = MULT_POP_DUR;
    sndMultiplier(m);
  }
}
function fxMeteorHit(item) {
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  burst(cx, cy, BURSTS.meteor);
  addShake(7, 0.35);
  flash('255,90,54', 0.35, 0.3);
  squash(0.35, 0.3);
  addFloater('OUCH!', cx, catcher.y - 20, PALETTE.ember, 20, 0.8);
  sndMeteorHit();
}
function fxMiss(item) {
  const cx = item.x + item.w / 2;
  burst(cx, GAME_HEIGHT - 6, BURSTS.miss);
  addShake(3, 0.18);
  flash('255,107,154', 0.18, 0.25);
  addFloater('MISS', cx, GAME_HEIGHT - 40, PALETTE.heart, 18, 0.8);
  sndMiss();
}

function updateEffects(dt) {
  fx.clock += dt;
  fx.shakeTime = Math.max(0, fx.shakeTime - dt);
  fx.flashTime = Math.max(0, fx.flashTime - dt);
  fx.squashTime = Math.max(0, fx.squashTime - dt);
  fx.scorePop = Math.max(0, fx.scorePop - dt);
  fx.multPop = Math.max(0, fx.multPop - dt);
  fx.bannerTime = Math.max(0, fx.bannerTime - dt);
  for (let i = 0; i < fx.heartPop.length; i++) fx.heartPop[i] = Math.max(0, fx.heartPop[i] - dt);
  if (fx.shakeTime > 0) {
    const m = fx.shakeMag * fx.shakeTime / fx.shakeDur;
    fx.shakeX = randRange(-m, m); fx.shakeY = randRange(-m, m);
  } else { fx.shakeX = 0; fx.shakeY = 0; }

  // catcher tilt and wake
  let v = 0;
  if (dt > 0) { v = (catcher.x - fx.prevCatcherX) / dt; fx.prevCatcherX = catcher.x; }
  const playing = game.state === 'playing';
  const target = playing ? clamp(v / CATCHER_KEY_SPEED, -1, 1) * 0.10 : 0;
  fx.tilt += (target - fx.tilt) * Math.min(1, dt * 10);
  if (playing && Math.abs(v) > 120) {
    fx.wakeTimer -= dt;
    if (fx.wakeTimer <= 0) {
      fx.wakeTimer = 0.05;
      addParticle(catcher.x + (v > 0 ? 8 : catcher.w - 8), catcher.y + catcher.h - 4,
        -Math.sign(v) * randRange(20, 40), randRange(-20, 5), 0.4, randRange(1.2, 2),
        Math.random() < 0.5 ? PALETTE.starlight : PALETTE.coolStar, 0, 2, 'dot');
    }
  }

  // item trails
  if (playing) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      it.age += dt;
      if (it.type === 'bad' || it.type === 'bonus') {
        it.trailTimer -= dt;
        if (it.trailTimer <= 0) {
          const cx = it.x + it.w / 2;
          if (it.type === 'bad') {
            it.trailTimer = 0.06;
            addParticle(cx + randRange(-5, 5), it.y + 4, randRange(-15, 15), randRange(-40, -10),
              randRange(0.3, 0.45), randRange(1.5, 3),
              Math.random() < 0.5 ? PALETTE.ember : PALETTE.flare, -40, 1, 'dot');
          } else {
            it.trailTimer = 0.10;
            addParticle(cx + randRange(-4, 4), it.y + 2, randRange(-10, 10), randRange(-10, 10),
              0.45, randRange(1, 1.8),
              Math.random() < 0.5 ? PALETTE.gemIce : PALETTE.gemCyan, 0, 1, 'spark');
          }
        }
      }
    }
  }

  // particles
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) { fx.particles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    const damp = Math.max(0, 1 - p.drag * dt);
    p.vx *= damp; p.vy *= damp;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  // floaters
  for (let i = fx.floaters.length - 1; i >= 0; i--) {
    const f = fx.floaters[i];
    f.y += f.vy * dt;
    f.life -= dt;
    if (f.life <= 0) fx.floaters.splice(i, 1);
  }
}

// Sound
function initAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      const comp = audioCtx.createDynamicsCompressor();      // safety limiter for overlaps
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
      masterGain.connect(comp); comp.connect(audioCtx.destination);
      noiseBuffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.5), audioCtx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    // Stage 5 fix H1
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      const p = audioCtx.resume();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }
  } catch (err) { audioCtx = null; }       // no sound, game still works
}
function tone(type, f0, f1, delay, attack, dur, vol) {
  if (!audioCtx || muted) return;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(masterGain);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}
function noise(delay, attack, dur, vol, f0, f1) {          // low-pass filtered white noise
  if (!audioCtx || muted || !noiseBuffer) return;
  const t0 = audioCtx.currentTime + delay;
  const src = audioCtx.createBufferSource(), filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = noiseBuffer; filt.type = 'lowpass';
  filt.frequency.setValueAtTime(f0, t0); filt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt); filt.connect(g); g.connect(masterGain);
  src.start(t0); src.stop(t0 + dur + 0.02);
}
function sndStart() {
  tone('triangle', 523.25, 523.25, 0, 0.01, 0.12, 0.35);
  tone('triangle', 659.25, 659.25, 0.08, 0.01, 0.12, 0.35);
  tone('triangle', 783.99, 783.99, 0.16, 0.01, 0.28, 0.35);
}
function sndCatchStar(mult) {
  const p = Math.pow(2, (mult - 1) * 2 / 12);
  tone('sine', 880 * p, 1320 * p, 0, 0.005, 0.12, 0.4);
  tone('triangle', 1760 * p, 1760 * p, 0.03, 0.005, 0.08, 0.12);
}
function sndCatchGem() {
  tone('sine', 1046.5, 1046.5, 0, 0.005, 0.10, 0.3);
  tone('sine', 1318.5, 1318.5, 0.05, 0.005, 0.10, 0.3);
  tone('sine', 1567.98, 1567.98, 0.10, 0.005, 0.20, 0.3);
  tone('triangle', 2093, 2093, 0.10, 0.005, 0.20, 0.1);
}
function sndMultiplier(mult) {
  const p = Math.pow(2, (mult - 1) * 2 / 12);
  tone('triangle', 440 * p, 1760 * p, 0, 0.01, 0.22, 0.3);
  tone('sine', 1760 * p, 1760 * p, 0.20, 0.005, 0.15, 0.2);
}
function sndMeteorHit() {
  noise(0, 0.003, 0.35, 0.55, 2000, 150);
  tone('sine', 160, 45, 0, 0.005, 0.30, 0.6);
}
function sndMiss() {
  tone('triangle', 330, 220, 0, 0.01, 0.18, 0.3);
  tone('triangle', 247, 165, 0.16, 0.01, 0.25, 0.3);
}
function sndLevelUp(delay) {
  const d = delay || 0;
  tone('triangle', 523.25, 523.25, d + 0, 0.01, 0.12, 0.3);
  tone('triangle', 659.25, 659.25, d + 0.07, 0.01, 0.12, 0.3);
  tone('triangle', 783.99, 783.99, d + 0.14, 0.01, 0.12, 0.3);
  tone('triangle', 1046.5, 1046.5, d + 0.21, 0.01, 0.35, 0.3);
}
function sndGameOver() {
  tone('triangle', 392, 392, 0.20, 0.01, 0.25, 0.35);
  tone('triangle', 311.13, 311.13, 0.45, 0.01, 0.25, 0.35);
  tone('triangle', 261.63, 196, 0.70, 0.01, 0.60, 0.35);
}
function sndClick() { tone('triangle', 1200, 800, 0, 0.002, 0.05, 0.25); }
function sndHover() { tone('sine', 1500, 1500, 0, 0.005, 0.035, 0.08); }

function setMuted(value) {
  muted = !!value;
  saveData.muted = muted;
  if (audioCtx && masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, audioCtx.currentTime, 0.02);
  muteBtn.classList.toggle('is-muted', muted);
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}
function toggleMute() {
  setMuted(!muted);
  writeSaveData();
  if (!muted) sndClick();
  muteBtn.classList.remove('pop'); void muteBtn.offsetWidth; muteBtn.classList.add('pop');  // replay CSS pop
}

// Updating
function update(dt) {
  if (game.state === 'playing') updatePlaying(dt);
  else if (game.state === 'over') game.overTimer += dt;
  if (game.state !== 'paused') updateEffects(dt);
  syncUI();
}

function syncUI() {
  const s = game.state;
  const clickable = s === 'menu' || s === 'paused' || (s === 'over' && game.overTimer >= RESTART_DELAY);
  if (clickable !== fx.canvasClickable) { fx.canvasClickable = clickable; canvas.classList.toggle('is-clickable', clickable); }
  if (s === uiState) return;
  uiState = s;
  const paused = s === 'paused';
  pauseBtn.hidden = !(s === 'playing' || paused);
  pauseBtn.classList.toggle('is-paused', paused);
  pauseBtn.setAttribute('aria-pressed', String(paused));
  pauseBtn.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  pauseMenu.hidden = !paused;
  resetBtn.hidden = s !== 'menu';
  if (s !== 'menu') disarmReset();
}

function updatePlaying(dt) {
  game.elapsed += dt;
  const diff = getDifficulty();
  if (diff.level > game.level) {
    game.level = diff.level;
    onLevelUp(game.level);
  }
  updateCatcher(dt);
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnItem(diff);
    game.spawnTimer = diff.spawnInterval;
  }
  updateItems(dt);
}

function updateCatcher(dt) {
  if (game.state !== 'playing') return;
  if (input.usePointer) {
    const target = input.pointerX - catcher.w / 2;
    const maxStep = CATCHER_POINTER_SPEED * dt;
    catcher.x += clamp(target - catcher.x, -maxStep, maxStep);
  } else {
    let dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;
    catcher.x += dir * CATCHER_KEY_SPEED * dt;
  }
  catcher.x = clamp(catcher.x, 0, GAME_WIDTH - catcher.w);
}

function updateItems(dt) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.y += item.vy * dt;
    if (rectsOverlap(item, catcher)) {
      if (item.type === 'bad') onHitBad(item);
      else onCatch(item);
      item.dead = true;
    } else if (item.y > GAME_HEIGHT) {
      if (item.type === 'good') onMiss(item);
      item.dead = true;
    }
    if (game.state !== 'playing') break;
  }
  items = items.filter(function (i) { return !i.dead; });
}

// Art helpers
function makeRng(seed) {            // Park-Miller generator; same seed gives the same numbers
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function makeArtCanvas(w, h) {      // offscreen canvas you draw on in game units
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * RENDER_SCALE); cv.height = Math.ceil(h * RENDER_SCALE);
  const c = cv.getContext('2d'); c.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  return { canvas: cv, c: c };
}
function buildSprite(w, h, paintFn) {
  const art = makeArtCanvas(w + 2 * SPRITE_PAD, h + 2 * SPRITE_PAD);
  paintFn(art.c, SPRITE_PAD, SPRITE_PAD, w, h);
  return art.canvas;
}
function drawSprite(sprite, x, y, w, h) {
  ctx.drawImage(sprite, x - SPRITE_PAD, y - SPRITE_PAD, w + 2 * SPRITE_PAD, h + 2 * SPRITE_PAD);
}
function setGlow(c, color, blur) { c.shadowColor = color; c.shadowBlur = blur * RENDER_SCALE; }
function clearGlow(c) { c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; }

function pathRoundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function pathStar(c, cx, cy, points, outerR, innerR) {
  c.beginPath();
  for (let i = 0; i < 2 * points; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points;
    const rad = (i % 2 === 0) ? outerR : innerR;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}
function pathHeart(c, cx, cy, size) {
  c.save();
  c.translate(cx, cy);
  c.scale(size / 110, size / 110);
  c.translate(-75, -72.5);
  c.beginPath();
  c.moveTo(75, 40);
  c.bezierCurveTo(75, 37, 70, 25, 50, 25);
  c.bezierCurveTo(20, 25, 20, 62.5, 20, 62.5);
  c.bezierCurveTo(20, 80, 40, 102, 75, 120);
  c.bezierCurveTo(110, 102, 130, 80, 130, 62.5);
  c.bezierCurveTo(130, 62.5, 130, 25, 100, 25);
  c.bezierCurveTo(85, 25, 75, 37, 75, 40);
  c.closePath();
  c.restore();
}

function paintStar(c, x, y, w, h) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  const cx = x + 0.5 * w, cy = y + 0.54 * h, R = 0.48 * w, r = 0.23 * w;
  pathStar(c, cx, cy, 5, R, r);
  const g = c.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, R);
  g.addColorStop(0, PALETTE.starCore);
  g.addColorStop(0.45, PALETTE.starGold);
  g.addColorStop(1, PALETTE.amber);
  c.fillStyle = g;
  setGlow(c, 'rgba(255,210,63,0.75)', 6);
  c.fill();
  clearGlow(c);
  c.strokeStyle = PALETTE.amberDeep; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = PALETTE.cocoa;
  c.beginPath(); c.arc(cx - 3.4, cy - 0.5, 1.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(cx + 3.4, cy - 0.5, 1.4, 0, Math.PI * 2); c.fill();
  c.strokeStyle = PALETTE.cocoa; c.lineWidth = 1.3;
  c.beginPath(); c.arc(cx, cy + 1.2, 3, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.beginPath(); c.arc(cx - 1.6, cy - 7, 1.2, 0, Math.PI * 2); c.fill();
  c.restore();
}

function paintGem(c, x, y, w, h) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  const tlx = x + 0.27 * w, trx = x + 0.73 * w, ty = y + 0.14 * h;
  const glx = x + 0.05 * w, grx = x + 0.95 * w, gy = y + 0.41 * h;
  const cux = x + 0.5 * w, cuy = y + 0.95 * h;
  function outline() {
    c.beginPath();
    c.moveTo(tlx, ty); c.lineTo(trx, ty); c.lineTo(grx, gy); c.lineTo(cux, cuy); c.lineTo(glx, gy);
    c.closePath();
  }
  outline();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, PALETTE.gemIce);
  g.addColorStop(0.5, PALETTE.gemCyan);
  g.addColorStop(1, PALETTE.gemBlue);
  c.fillStyle = g;
  setGlow(c, 'rgba(92,225,255,0.8)', 6);
  c.fill();
  clearGlow(c);
  c.beginPath();
  c.moveTo(tlx, ty); c.lineTo(trx, ty); c.lineTo(grx, gy); c.lineTo(glx, gy);
  c.closePath();
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(glx, gy); c.lineTo(grx, gy);
  c.moveTo(tlx, ty); c.lineTo(x + 0.39 * w, gy);
  c.moveTo(trx, ty); c.lineTo(x + 0.61 * w, gy);
  c.moveTo(x + 0.39 * w, gy); c.lineTo(cux, cuy);
  c.moveTo(x + 0.61 * w, gy); c.lineTo(cux, cuy);
  c.stroke();
  outline();
  c.strokeStyle = PALETTE.gemEdge; c.lineWidth = 1.2; c.stroke();
  pathStar(c, x + 0.84 * w, y + 0.16 * h, 4, 3.5, 0.9);
  c.fillStyle = PALETTE.starlight; c.fill();
  c.restore();
}

function paintMeteor(c, x, y, w, h) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  const cx = x + 0.5 * w, ry = y + 0.65 * h, by = y + 0.67 * h;
  function tongue(tipX, tipY, halfW) {
    const my = (tipY + by) / 2;
    c.beginPath();
    c.moveTo(tipX, tipY);
    c.quadraticCurveTo(tipX + 1.1 * halfW, my, tipX + halfW, by);
    c.lineTo(tipX - halfW, by);
    c.quadraticCurveTo(tipX - 1.1 * halfW, my, tipX, tipY);
    c.closePath();
  }
  const fg = c.createLinearGradient(0, y, 0, by);
  fg.addColorStop(0, 'rgba(255,90,54,0)');
  fg.addColorStop(0.45, PALETTE.ember);
  fg.addColorStop(1, '#ff7a3d');
  c.fillStyle = fg;
  setGlow(c, 'rgba(255,90,54,0.8)', 6);
  tongue(cx, y + 0.02 * h, 0.3 * w); c.fill();
  tongue(x + 0.27 * w, y + 0.2 * h, 0.2 * w); c.fill();
  tongue(x + 0.73 * w, y + 0.13 * h, 0.2 * w); c.fill();
  clearGlow(c);
  tongue(cx, y + 0.25 * h, 0.17 * w);
  c.fillStyle = PALETTE.flare; c.fill();
  // rock
  const mult = [1, 0.88, 0.97, 0.86, 1, 0.9, 0.95, 0.87, 0.98];
  c.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 9;
    const rad = 0.33 * w * mult[i];
    const px = cx + Math.cos(a) * rad, py = ry + Math.sin(a) * rad;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  const rg = c.createRadialGradient(cx - 3, ry - 4, 1, cx, ry, 11);
  rg.addColorStop(0, PALETTE.rockLight);
  rg.addColorStop(0.6, PALETTE.rock);
  rg.addColorStop(1, PALETTE.rockDark);
  c.fillStyle = rg;
  setGlow(c, 'rgba(255,90,54,0.45)', 4);
  c.fill();
  clearGlow(c);
  c.strokeStyle = PALETTE.rockLine; c.lineWidth = 1.5; c.stroke();
  // craters
  c.fillStyle = PALETTE.rockDark;
  c.beginPath(); c.arc(cx + 5, ry + 5, 2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(cx - 5.5, ry + 4.5, 1.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(cx + 1.5, ry - 6.5, 1.2, 0, Math.PI * 2); c.fill();
  // face
  c.fillStyle = PALETTE.starlight;
  c.beginPath(); c.arc(cx - 3.6, ry - 0.5, 1.8, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(cx + 3.6, ry - 0.5, 1.8, 0, Math.PI * 2); c.fill();
  c.fillStyle = PALETTE.rockLine;
  c.beginPath(); c.arc(cx - 3.3, ry - 0.2, 0.9, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(cx + 3.3, ry - 0.2, 0.9, 0, Math.PI * 2); c.fill();
  c.strokeStyle = PALETTE.rockLine; c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(cx - 6.2, ry - 4.2); c.lineTo(cx - 1.6, ry - 2.4);
  c.moveTo(cx + 6.2, ry - 4.2); c.lineTo(cx + 1.6, ry - 2.4);
  c.stroke();
  c.lineWidth = 1.2;
  c.beginPath(); c.arc(cx, ry + 6.5, 2.6, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke();
  c.restore();
}

function paintMoonBoat(c, x, y, w, h) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  const lx = x + 2, ly = y + 1, rx = x + w - 2;
  const ox = x + w / 2, oy = y + 2 * h - 2;
  const ix = x + w / 2, iy = y + 0.67 * h;
  c.beginPath();
  c.moveTo(lx, ly);
  c.quadraticCurveTo(ox, oy, rx, ly);
  c.quadraticCurveTo(ix, iy, lx, ly);
  c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, PALETTE.starlight);
  g.addColorStop(0.45, PALETTE.moonCream);
  g.addColorStop(1, PALETTE.moonShade);
  c.fillStyle = g;
  setGlow(c, 'rgba(244,236,194,0.5)', 7);
  c.fill();
  clearGlow(c);
  c.strokeStyle = PALETTE.moonLine; c.lineWidth = 1.2; c.stroke();
  c.beginPath();
  c.moveTo(rx, ly);
  c.quadraticCurveTo(ix, iy, lx, ly);
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1; c.stroke();
  c.fillStyle = 'rgba(143,132,96,0.55)';
  c.beginPath(); c.arc(x + 0.33 * w, y + 0.67 * h, 2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x + 0.58 * w, y + 0.78 * h, 1.6, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x + 0.71 * w, y + 0.58 * h, 1.3, 0, Math.PI * 2); c.fill();
  c.restore();
}

function buildBackgroundCanvas(rng) {
  const art = makeArtCanvas(GAME_WIDTH, GAME_HEIGHT);
  const c = art.c;
  // 1. sky
  const sky = c.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, PALETTE.midnight);
  sky.addColorStop(0.55, PALETTE.indigo);
  sky.addColorStop(0.85, PALETTE.dusk);
  sky.addColorStop(1, PALETTE.plum);
  c.fillStyle = sky;
  c.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  // 2. haze
  const hz = [[70, 470], [190, 340], [310, 220], [430, 100]];
  for (let i = 0; i < hz.length; i++) {
    const hg = c.createRadialGradient(hz[i][0], hz[i][1], 0, hz[i][0], hz[i][1], 140);
    hg.addColorStop(0, 'rgba(150,140,255,0.08)');
    hg.addColorStop(1, 'rgba(150,140,255,0)');
    c.fillStyle = hg;
    c.fillRect(hz[i][0] - 140, hz[i][1] - 140, 280, 280);
  }
  // 3. stars
  for (let i = 0; i < 120; i++) {
    const sx = rng() * 480, sy = rng() * 570;
    const sr = 0.4 + rng() * rng() * 1.1;
    c.globalAlpha = 0.35 + rng() * 0.5;
    c.fillStyle = rng() < 0.15 ? PALETTE.coolStar : PALETTE.starlight;
    c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // 4. planet
  c.globalAlpha = 0.9;
  c.strokeStyle = 'rgba(207,216,255,0.45)'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(420, 150, 40, 9, -0.35, Math.PI, 2 * Math.PI); c.stroke();
  const pg = c.createRadialGradient(412, 142, 3, 420, 150, 24);
  pg.addColorStop(0, PALETTE.planetLight);
  pg.addColorStop(1, PALETTE.dusk);
  c.fillStyle = pg;
  c.beginPath(); c.arc(420, 150, 24, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(420, 150, 40, 9, -0.35, 0, Math.PI); c.stroke();
  c.globalAlpha = 1;
  // 5. dusk glow
  const dg = c.createLinearGradient(0, 500, 0, 600);
  dg.addColorStop(0, 'rgba(255,107,154,0)');
  dg.addColorStop(1, 'rgba(255,107,154,0.10)');
  c.fillStyle = dg;
  c.fillRect(0, 500, 480, 100);
  // 6. far hills
  c.fillStyle = PALETTE.farHill;
  c.beginPath();
  c.moveTo(0, 640); c.lineTo(0, 586);
  c.quadraticCurveTo(90, 548, 180, 576);
  c.quadraticCurveTo(270, 602, 350, 570);
  c.quadraticCurveTo(420, 544, 480, 566);
  c.lineTo(480, 640); c.closePath(); c.fill();
  // 7. near hills
  c.fillStyle = PALETTE.nearHill;
  c.beginPath();
  c.moveTo(0, 640); c.lineTo(0, 612);
  c.quadraticCurveTo(120, 584, 240, 606);
  c.quadraticCurveTo(360, 628, 480, 598);
  c.lineTo(480, 640); c.closePath(); c.fill();
  return art;
}

function makeTwinkles(rng) {
  const list = [];
  for (let i = 0; i < TWINKLE_COUNT; i++) {
    list.push({
      x: 12 + rng() * 456, y: 50 + rng() * 470, r: 0.9 + rng() * 0.8,
      phase: rng() * 2 * Math.PI, speed: 1 + rng() * 1.6
    });
  }
  return list;
}

function initArt() {
  const rng = makeRng(ART_SEED);
  bgCanvas = buildBackgroundCanvas(rng).canvas;
  twinkles = makeTwinkles(rng);
  sprites.good = buildSprite(ITEM_TYPES.good.w, ITEM_TYPES.good.h, paintStar);
  sprites.bonus = buildSprite(ITEM_TYPES.bonus.w, ITEM_TYPES.bonus.h, paintGem);
  sprites.bad = buildSprite(ITEM_TYPES.bad.w, ITEM_TYPES.bad.h, paintMeteor);
  sprites.catcher = buildSprite(CATCHER_WIDTH, CATCHER_HEIGHT, paintMoonBoat);
}

// Rendering
function render() {
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);          // base, every frame
  drawBackground();
  if (game.state === 'menu') {
    drawStartScreen();
  } else {
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE,
      fx.shakeX * RENDER_SCALE, fx.shakeY * RENDER_SCALE);             // e,f are device pixels
    for (let i = 0; i < items.length; i++) drawItem(items[i]);
    drawCatcher();
    drawParticles();
    drawFloaters();
    if (DEBUG_HITBOXES) drawHitboxes();
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);          // reset before HUD
    drawFlash();
    drawHUD();
    drawBanner();
    if (game.state === 'over') drawGameOverScreen();
    else if (game.state === 'paused') drawPauseScreen();
  }
}

function drawParticles() {
  ctx.save();
  for (let i = 0; i < fx.particles.length; i++) {
    const p = fx.particles[i];
    const k = p.life / p.maxLife;
    ctx.globalAlpha = k;
    const r = p.size * (0.4 + 0.6 * k);
    ctx.fillStyle = p.color;
    if (p.shape === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillRect(p.x - 2 * r, p.y - 0.35 * r, 4 * r, 0.7 * r);
      ctx.fillRect(p.x - 0.35 * r, p.y - 2 * r, 0.7 * r, 4 * r);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawFloaters() {
  for (let i = 0; i < fx.floaters.length; i++) {
    const f = fx.floaters[i];
    const t = 1 - f.life / f.maxLife;
    const alpha = Math.min(1, (f.life / f.maxLife) / 0.5);
    const s = easeOutBack(Math.min(1, t / 0.2));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(f.x, f.y);
    ctx.scale(s, s);
    drawText(f.text, 0, 0, f.size, f.color);
    ctx.restore();
  }
}

function drawFlash() {
  if (fx.flashTime <= 0) return;
  ctx.fillStyle = 'rgba(' + fx.flashRGB + ',' + (fx.flashMax * fx.flashTime / fx.flashDur).toFixed(3) + ')';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function drawBanner() {
  if (fx.bannerTime <= 0) return;
  const age = fx.bannerDur - fx.bannerTime;
  const inT = clamp(age / 0.25, 0, 1);
  const scale = 0.6 + 0.4 * easeOutBack(inT);
  const alpha = inT * Math.min(1, fx.bannerTime / 0.4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(240, 230);
  ctx.scale(scale, scale);
  drawGlowText(fx.bannerText, 0, 0, 40, PALETTE.starGold, 'rgba(255,210,63,0.6)');
  if (fx.bannerSub) drawText(fx.bannerSub, 0, 36, 18, PALETTE.starlight);
  ctx.restore();
}

function drawHitboxes() {
  ctx.save();
  ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1;
  for (let i = 0; i < items.length; i++) ctx.strokeRect(items[i].x, items[i].y, items[i].w, items[i].h);
  ctx.strokeRect(catcher.x, catcher.y, catcher.w, catcher.h);
  ctx.restore();
}

function drawBackground() {
  ctx.drawImage(bgCanvas, 0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawTwinkles();
}

function drawTwinkles() {
  const t = performance.now() / 1000;
  ctx.fillStyle = PALETTE.starlight;
  for (let i = 0; i < twinkles.length; i++) {
    const k = twinkles[i];
    ctx.globalAlpha = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * k.speed + k.phase));
    ctx.fillRect(k.x - 3 * k.r, k.y - 0.5, 6 * k.r, 1);
    ctx.fillRect(k.x - 0.5, k.y - 3 * k.r, 1, 6 * k.r);
    ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCatcher() {
  const t = fx.squashTime > 0 ? 1 - fx.squashTime / fx.squashDur : 1;
  const s = fx.squashAmt * Math.sin(t * Math.PI);
  const sx = 1 + 0.6 * s, sy = 1 - s;
  const b = game.state === 'menu' ? 2 * Math.sin(fx.clock * 2) : 0;
  ctx.save();
  ctx.translate(catcher.x + catcher.w / 2, catcher.y + catcher.h + b);
  ctx.rotate(fx.tilt);
  ctx.scale(sx, sy);
  drawSprite(sprites.catcher, -catcher.w / 2, -catcher.h, catcher.w, catcher.h);
  ctx.restore();
}

function drawItem(item) {
  const a = item.age, p = item.phase;
  let angle = 0, scale = 1;
  if (item.type === 'good') angle = 0.22 * Math.sin(3 * a + p);
  else if (item.type === 'bonus') { angle = 0.12 * Math.sin(5 * a + p); scale = 1 + 0.08 * Math.sin(9 * a + p); }
  else angle = 0.07 * Math.sin(16 * a + p);
  ctx.save();
  ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  drawSprite(sprites[item.type], -item.w / 2, -item.h / 2, item.w, item.h);
  ctx.restore();
}

function drawText(text, x, y, size, color, align, fontStack, maxWidth) {
  ctx.save();
  ctx.font = 'bold ' + size + 'px ' + (fontStack || FONT_STACK);
  ctx.fillStyle = color;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowOffsetY = 1 * RENDER_SCALE;
  if (maxWidth) ctx.fillText(text, x, y, maxWidth); else ctx.fillText(text, x, y);
  ctx.restore();
}

function drawGlowText(text, x, y, size, color, glowColor) {
  ctx.save();
  ctx.font = 'bold ' + size + 'px ' + TITLE_FONT_STACK;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setGlow(ctx, glowColor, 10);
  ctx.fillText(text, x, y);
  clearGlow(ctx);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = 'rgba(11,16,38,0.72)';
  ctx.fillRect(0, 0, GAME_WIDTH, 36);
  ctx.fillStyle = PALETTE.dusk;
  ctx.fillRect(0, 36, GAME_WIDTH, 1.5);
  drawText('Score ' + game.score, 42, 18, 18 * (1 + 0.25 * fx.scorePop / SCORE_POP_DUR), PALETTE.starlight, 'left');
  if (saveData.highScore > 0 && game.score > saveData.highScore) {
    ctx.save();
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(fx.clock * 6);
    drawText('NEW BEST!', 42, 50, 13, PALETTE.starGold, 'left');
    ctx.restore();
  } else {
    drawText('Best ' + saveData.highScore, 42, 50, 13, PALETTE.mist, 'left');
  }
  drawText('Level ' + game.level, 240, 18, 18, PALETTE.starlight);
  if (getMultiplier() > 1) {
    const k = 1 + 0.45 * fx.multPop / MULT_POP_DUR;
    ctx.save();
    ctx.translate(312, 18); ctx.scale(k, k); ctx.translate(-312, -18);
    pathRoundRect(ctx, 292, 8, 40, 20, 10);
    ctx.fillStyle = PALETTE.gemCyan;
    ctx.fill();
    drawText('x' + getMultiplier(), 312, 18, 14, PALETTE.midnight);
    ctx.restore();
  }
  for (let i = 0; i < START_LIVES; i++) {
    const hs = (game.lives === 1 && i === 0 && game.state === 'playing')
      ? 18 * (1 + 0.12 * Math.abs(Math.sin(fx.clock * 5))) : 18;
    pathHeart(ctx, 420 + i * 22, 18, hs);
    if (i < game.lives) {
      ctx.fillStyle = PALETTE.heart;
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,107,154,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (fx.heartPop[i] > 0) {
      const u = 1 - fx.heartPop[i] / HEART_POP_DUR;
      ctx.save();
      ctx.globalAlpha = 1 - u;
      pathHeart(ctx, 420 + i * 22, 18, 18 * (1 + 0.8 * u));
      ctx.fillStyle = PALETTE.heart;
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawStartScreen() {
  drawGlowText('STARFALL', 240, 84 + 3 * Math.sin(fx.clock * 1.5), 52, PALETTE.starGold, 'rgba(255,210,63,0.6)');
  drawText('Catch the falling stars!', 240, 122, 17, PALETTE.starlight);
  pathRoundRect(ctx, 60, 140, 360, 54, 14);
  ctx.fillStyle = 'rgba(255,210,63,0.10)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,63,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  drawText('Best score ' + saveData.highScore, 240, 159, 19, PALETTE.starGold, 'center', null, 330);
  drawText('Streak ' + saveData.bestStreak + ' \u00B7 Level ' + saveData.bestLevel + ' \u00B7 Games ' + saveData.gamesPlayed + ' \u00B7 Caught ' + saveData.totalCaught,
    240, 181, 13, PALETTE.mist, 'center', null, 330);
  pathRoundRect(ctx, 40, 208, 400, 222, 16);
  ctx.fillStyle = 'rgba(11,16,38,0.68)'; ctx.fill();
  ctx.strokeStyle = 'rgba(154,163,214,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  const rows = [
    { y: 242, type: 'good',  name: 'Star',     color: ITEM_TYPES.good.color,  effect: '+10 points' },
    { y: 286, type: 'bonus', name: 'Moon gem', color: ITEM_TYPES.bonus.color, effect: '+30, falls fast' },
    { y: 330, type: 'bad',   name: 'Meteor',   color: ITEM_TYPES.bad.color,   effect: 'avoid! -1 life' }
  ];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], def = ITEM_TYPES[r.type];
    drawSprite(sprites[r.type], 80 - def.w / 2, r.y - def.h / 2, def.w, def.h);
    drawText(r.name, 108, r.y, 19, r.color, 'left');
    drawText(r.effect, 420, r.y, 16, PALETTE.starlight, 'right');
  }
  drawText('Miss a star: lose a life', 240, 372, 16, PALETTE.starlight);
  drawText('5 catches in a row = multiplier (max x4)', 240, 404, 14, PALETTE.mist);
  drawText('Move: Arrow keys / A D / mouse / touch', 240, 450, 15, PALETTE.mist);
  drawText('P / Esc pause \u00B7 M mute', 240, 470, 13, PALETTE.mist);
  pathRoundRect(ctx, 70, 490, 340, 40, 20);
  ctx.fillStyle = 'rgba(255,210,63,0.14)'; ctx.fill();
  ctx.strokeStyle = PALETTE.starGold; ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(fx.clock * 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawText('Press SPACE / ENTER or click to start', 240, 510, 16, PALETTE.starlight, 'center', null, 320);
  if (!storageOK) drawText('Saving is unavailable - records reset on refresh', 240, 552, 12, PALETTE.heart, 'center', null, 400);
  drawCatcher();
}

function drawGameOverScreen() {
  const t = clamp(game.overTimer / GAMEOVER_IN_TIME, 0, 1);
  ctx.save();
  ctx.globalAlpha = t;
  ctx.fillStyle = 'rgba(5,7,15,0.72)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.translate(0, -80 * (1 - easeOutCubic(t)));
  pathRoundRect(ctx, 40, 120, 400, 390, 18);
  ctx.fillStyle = 'rgba(27,31,75,0.92)'; ctx.fill();
  ctx.strokeStyle = PALETTE.dusk; ctx.lineWidth = 2; ctx.stroke();
  drawGlowText('GAME OVER', 240, 164, 44, PALETTE.ember, 'rgba(255,90,54,0.5)');
  if (game.newBest) {
    const k = easeOutBack(clamp((game.overTimer - GAMEOVER_IN_TIME) / NEW_BEST_IN_TIME, 0, 1));
    if (k > 0.01) {
      const pulse = REDUCED_MOTION ? 1 : 1 + 0.04 * Math.sin(fx.clock * 6);
      ctx.save(); ctx.translate(240, 206); ctx.scale(k * pulse, k * pulse);
      pathRoundRect(ctx, -92, -16, 184, 32, 16);
      ctx.fillStyle = 'rgba(255,210,63,0.18)'; ctx.fill();
      ctx.strokeStyle = PALETTE.starGold; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = PALETTE.starGold;
      pathStar(ctx, -70, 0, 5, 7, 3); ctx.fill();
      pathStar(ctx, 70, 0, 5, 7, 3); ctx.fill();
      drawGlowText('NEW BEST!', 0, 1, 20, PALETTE.starGold, 'rgba(255,210,63,0.7)');
      ctx.restore();
    }
  }
  ctx.fillStyle = 'rgba(154,163,214,0.35)';
  ctx.fillRect(80, 232, 320, 1);
  drawText('Score', 80, 266, 20, PALETTE.mist, 'left');
  drawText(String(game.score), 400, 266, 28, PALETTE.starGold, 'right');
  drawText('Best', 80, 304, 20, PALETTE.mist, 'left');
  drawText(String(saveData.highScore), 400, 304, 22, game.newBest ? PALETTE.starGold : PALETTE.starlight, 'right');
  drawText('Time', 80, 340, 20, PALETTE.mist, 'left');
  drawText(game.elapsed.toFixed(1) + ' s', 400, 340, 22, PALETTE.starlight, 'right');
  drawText('Caught', 80, 374, 20, PALETTE.mist, 'left');
  drawText(String(game.caughtCount), 400, 374, 22, PALETTE.starlight, 'right');
  drawText('Best streak', 80, 408, 20, PALETTE.mist, 'left');
  drawText(String(game.bestStreak), 400, 408, 22, PALETTE.starlight, 'right');
  if (game.overTimer >= RESTART_DELAY) {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(fx.clock * 4);
    drawText('Press SPACE / ENTER or click to play again', 240, 466, 16, PALETTE.starlight, 'center', null, 380);
    drawText('Q / Esc: menu', 240, 492, 13, PALETTE.mist);
  }
  ctx.restore();
}

function drawPauseScreen() {
  const t = performance.now() / 1000;
  ctx.fillStyle = 'rgba(5,7,15,0.6)';
  ctx.fillRect(0, 37.5, GAME_WIDTH, GAME_HEIGHT - 37.5);
  pathRoundRect(ctx, 90, 180, 300, 280, 18);
  ctx.fillStyle = 'rgba(27,31,75,0.92)'; ctx.fill();
  ctx.strokeStyle = PALETTE.dusk; ctx.lineWidth = 2; ctx.stroke();
  const bob = REDUCED_MOTION ? 0 : 2 * Math.sin(t * 2);
  drawGlowText('PAUSED', 240, 226 + bob, 42, PALETTE.starlight, 'rgba(207,216,255,0.55)');
  drawText('Score ' + game.score + ' \u00B7 Best ' + saveData.highScore, 240, 266, 16, PALETTE.mist, 'center', null, 270);
  drawText('P / Esc resume \u00B7 R restart \u00B7 Q quit', 240, 428, 13, PALETTE.mist, 'center', null, 270);
}

// Input
let lastHoverAt = 0;
function useKeys() { input.usePointer = false; input.travel = 0; input.lastClientX = null; }
function refreshMoveKeys() {
  input.left  = !!(heldKeys.ArrowLeft || heldKeys.KeyA);
  input.right = !!(heldKeys.ArrowRight || heldKeys.KeyD);
}
function clearMoveKeys() {
  for (const k in heldKeys) delete heldKeys[k];
  input.left = false; input.right = false;
}
function pointerToGameX(e) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return null;
  return (e.clientX - rect.left) * (GAME_WIDTH / rect.width);
}

function wireButton(btn, onClick) {
  btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
  btn.addEventListener('click', function () { initAudio(); onClick(); btn.blur(); });
  btn.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'mouse' && performance.now() - lastHoverAt > 80) { lastHoverAt = performance.now(); sndHover(); }
  });
}

function setupInput() {
  const actionKeys = ['Space', 'Enter', 'NumpadEnter'];
  const leftKeys = ['ArrowLeft', 'KeyA'];
  const rightKeys = ['ArrowRight', 'KeyD'];

  window.addEventListener('keydown', function (e) {
    // Stage 5 fix B4/B6: movement only for plain keys; track held keys
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    const isLeft = plain && leftKeys.indexOf(e.code) !== -1;
    const isRight = plain && rightKeys.indexOf(e.code) !== -1;
    const isAction = actionKeys.indexOf(e.code) !== -1;
    if (e.key === 'Meta') clearMoveKeys();
    initAudio();
    const onButton = e.target instanceof HTMLButtonElement;
    if (isAction && onButton) return;
    if (isLeft || isRight || isAction) e.preventDefault();
    if (isLeft || isRight) { heldKeys[e.code] = true; refreshMoveKeys(); useKeys(); }
    if (isAction && !e.repeat) handleAction();
    if (e.code === 'KeyM' && !e.repeat && plain) toggleMute();
    if (plain && !e.repeat) {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (game.state === 'playing' || game.state === 'paused') { e.preventDefault(); togglePause(); }
        else if (e.code === 'Escape') menuFromOver();
      } else if (e.code === 'KeyQ') {
        if (game.state === 'paused') quitToMenu(); else menuFromOver();
      } else if (e.code === 'KeyR') {
        if (game.state === 'paused') restartRun();
        else if (game.state === 'over' && game.overTimer >= RESTART_DELAY) startGame();
      }
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.target instanceof HTMLButtonElement && actionKeys.indexOf(e.code) !== -1) return;
    // Stage 5 fix B6
    if (leftKeys.indexOf(e.code) !== -1 || rightKeys.indexOf(e.code) !== -1) {
      delete heldKeys[e.code]; refreshMoveKeys(); e.preventDefault();
    }
    if (actionKeys.indexOf(e.code) !== -1) e.preventDefault();
  });

  window.addEventListener('blur', function () {
    clearMoveKeys();   // Stage 5 fix B6
    if (game.state === 'playing') pauseGame(true);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearMoveKeys(); if (game.state === 'playing') pauseGame(true); }
    else lastTime = performance.now();
  });

  // Stage 5 fix B5: reload the save when another tab changes it
  window.addEventListener('storage', function (e) {
    if (e.key !== null && e.key !== SAVE_KEY) return;
    saveData = loadSaveData();
    setMuted(saveData.muted);
  });

  // Stage 5 fix B2/B7
  window.addEventListener('pointermove', function (e) {
    if (!e.isPrimary) return;
    const x = pointerToGameX(e);
    if (x === null) return;
    if (!input.usePointer) {
      if (input.lastClientX !== null) input.travel += Math.abs(e.clientX - input.lastClientX);
      input.lastClientX = e.clientX;
      if (input.travel < POINTER_SWITCH_PX) return;
    }
    input.pointerX = x;
    input.usePointer = true;
  });

  wireButton(muteBtn, toggleMute);
  wireButton(pauseBtn, togglePause);
  wireButton(resumeBtn, resumeGame);
  wireButton(quitBtn, quitToMenu);
  wireButton(resetBtn, onResetClick);

  canvas.addEventListener('pointerdown', function (e) {
    if (!e.isPrimary) return;                                    // Stage 5 fix B3/B7
    if (e.pointerType === 'mouse' && e.button !== 0) return;     // left button only
    initAudio();
    const x = pointerToGameX(e);
    if (x !== null) {
      input.pointerX = x;
      input.usePointer = true;
    }
    handleAction();
  });

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

// ---------- Game loop ----------
let lastTime = performance.now();
function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt < 0) dt = 0;
  if (dt > MAX_DT) dt = MAX_DT;   // also stops a jump after the tab was hidden
  update(dt);
  render();
  requestAnimationFrame(loop);
}
initArt();
saveData = loadSaveData();
setupInput();
setMuted(saveData.muted);
syncUI();
requestAnimationFrame(loop);

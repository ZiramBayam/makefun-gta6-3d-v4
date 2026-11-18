// Boot, fixed-step loop, screens, hotkeys, audio events and persistent save.
import { SEED, STEP, MAX_FRAME, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createAssets } from './assets.js';
import { createWorld } from './world.js';
import { createRenderer } from './render3d.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hudRoot = document.getElementById('hud');
const random = createRandom(SEED);
const city = createCity(random);
const assets = createAssets(window.THREE, random);
const world = createWorld(city, createRandom(SEED));
const renderer = createRenderer(canvas, city, assets);
const hud = createHud(hudRoot);
const input = createInput(renderer);
const audio = createAudio();

let screen = 'title';
let accumulator = 0;
let last = performance.now();
let muted = false;

const SFX = {
  shoot: 'shoot', hit: 'hit', impact: 'impact', explosion: 'explosion',
  pickup: 'pickup', mission: 'mission', wanted: 'wanted', reward: 'reward',
  crash: 'crash', ram: 'ram', dry: 'dry', melee: 'melee', enter: 'enter',
  exit: 'exit', enemyShot: 'shoot', enemyDown: 'hit', win: 'win',
};

function saveExists() {
  try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch { return false; }
}
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world.snapshot()));
    status.textContent = 'Progress saved in Cielo Bay.';
  } catch { status.textContent = 'Saving is unavailable in this browser.'; }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    world.restore(JSON.parse(raw));
    return true;
  } catch { return false; }
}

function setScreen(next) {
  screen = next;
  if (next === 'play') {
    audio.resume();
    input.lock();
  } else if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}

function jumpToObjective() {
  const goal = world.objective();
  if (!goal) return;
  const p = world.state.player;
  const angle = Math.atan2(goal.z - p.z, goal.x - p.x) || 0.7;
  const radius = 26;
  p.x = goal.x + Math.cos(angle) * radius;
  p.z = goal.z + Math.sin(angle) * radius;
  if (!p.onFoot) {
    const car = world.state.cars.find((c) => c.id === p.carId);
    if (car) { car.x = p.x; car.z = p.z; }
  }
  renderer.faceObjective(goal.x, goal.z, p);
  status.textContent = `Objective: ${goal.label}`;
}

function handlePlayKey(code) {
  switch (code) {
    case 'KeyE': world.tryEnter(); break;
    case 'KeyJ': case 'Space': world.melee(); break;
    case 'KeyP': case 'Escape': setScreen('paused'); break;
    case 'KeyM':
      muted = !muted; audio.setEnabled(!muted); break;
    case 'KeyR': world.state.rain = !world.state.rain; break;
    case 'F2': world.addWanted(3, 'hotkey'); break;
    case 'F3': jumpToObjective(); break;
    default: break;
  }
}

function handleMenuKey(code) {
  if (code === 'Enter' || code === 'Space') {
    if (screen === 'title') { world.reset(); setScreen('play'); }
    else if (screen === 'win') { world.reset(); setScreen('play'); }
    else if (screen === 'paused') setScreen('play');
    else if (screen === 'controls') setScreen('title');
  } else if (code === 'KeyP' || code === 'Escape') {
    if (screen === 'paused') setScreen('play');
  } else if (code === 'KeyM') {
    muted = !muted; audio.setEnabled(!muted);
  }
}

hudRoot.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  audio.sfx('click');
  switch (button.dataset.action) {
    case 'play': world.reset(); setScreen('play'); break;
    case 'continue': loadGame(); setScreen('play'); break;
    case 'controls': setScreen('controls'); break;
    case 'back': setScreen('title'); break;
    case 'resume': setScreen('play'); break;
    case 'save': saveGame(); break;
    case 'mute': muted = !muted; audio.setEnabled(!muted); break;
    case 'restart': world.reset(); setScreen('play'); break;
    default: break;
  }
});

function frame(now) {
  const elapsed = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
  last = now;
  const presses = input.presses();
  const clicks = input.clicks();

  if (screen === 'play') {
    for (const code of presses) handlePlayKey(code);
    if (clicks.length) world.fire();
    accumulator += elapsed;
    while (accumulator >= STEP) {
      world.step(STEP, input.axis());
      accumulator -= STEP;
    }
  } else {
    for (const code of presses) handleMenuKey(code);
    accumulator = 0;
  }

  for (const evt of world.state.events) {
    const sound = SFX[evt.type];
    if (sound) audio.sfx(sound);
    if (evt.type === 'mission') status.textContent = `Job: ${evt.title}`;
  }
  world.state.events.length = 0;

  window.CBObjective = screen === 'play' || screen === 'paused' ? world.objective() : null;
  const extras = {
    mouse: input.mouse, saveExists: saveExists(), muted, city,
    objective: window.CBObjective, objectiveScreen: renderer.api.objectiveScreen,
  };
  renderer.draw(world.state, screen, extras);
  hud.render(world.state, screen, extras);
  audio.update(elapsed, world.state);
  input.clear();
  requestAnimationFrame(frame);
}

window.CB = {
  world, city, state: world.state, renderer, input, audio,
  get screen() { return screen; },
};
window.CBObjective = world.objective();
requestAnimationFrame(frame);
status.textContent = 'Cielo Bay ready.';

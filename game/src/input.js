// Keyboard, pointer-lock mouse look, edge-triggered presses and logical-screen clicks.
const HELD_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const EDGE_KEYS = new Set([
  'KeyE', 'KeyJ', 'Space', 'KeyP', 'Escape', 'KeyM', 'KeyR', 'KeyF', 'KeyH',
  'F2', 'F3', 'Enter', 'Tab',
]);

export function createInput(renderer) {
  const keys = new Set();
  const pressed = [];
  const clicks = [];
  const mouse = { dx: 0, dy: 0, down: false, aim: false, x: 0, y: 0, locked: false };
  const canvas = document.getElementById('game');

  window.addEventListener('keydown', (event) => {
    if (HELD_KEYS.has(event.code) || EDGE_KEYS.has(event.code)) event.preventDefault();
    if (!keys.has(event.code) && EDGE_KEYS.has(event.code)) pressed.push(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; mouse.aim = false; });

  window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX; mouse.y = event.clientY;
    if (mouse.locked || mouse.down) {
      mouse.dx += event.movementX || 0;
      mouse.dy += event.movementY || 0;
    }
  });
  window.addEventListener('mousedown', (event) => {
    mouse.x = event.clientX; mouse.y = event.clientY;
    if (event.button === 0) {
      mouse.down = true;
      clicks.push(renderer.screenToLogical(event.clientX, event.clientY));
    } else if (event.button === 2) {
      mouse.aim = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
    if (event.button === 2) mouse.aim = false;
  });
  window.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = Boolean(document.pointerLockElement);
  });

  function axis() {
    return {
      x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
      z: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      handbrake: keys.has('KeyF'),
    };
  }

  const presses = () => pressed.slice();
  const takeClicks = () => clicks.slice();
  function lock() {
    if (canvas && canvas.requestPointerLock && document.pointerLockElement !== canvas) {
      const result = canvas.requestPointerLock();
      if (result && result.catch) result.catch(() => {});
    }
  }
  function clear() {
    pressed.length = 0;
    clicks.length = 0;
    mouse.dx = 0;
    mouse.dy = 0;
  }

  return { axis, presses, clicks: takeClicks, mouse, clear, lock, isDown: (code) => keys.has(code) };
}

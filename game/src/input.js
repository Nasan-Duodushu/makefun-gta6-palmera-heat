// Keyboard and mouse input. Held keys and the pointer are read every frame; one-shot
// presses (interact, melee, pause, confirm) are queued as flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
window.PH = window.PH || {};

PH.ACT = { CONFIRM: 1, INTERACT: 2, MELEE: 4, PAUSE: 8, RELOAD: 16, WEAPON: 32, HORN: 64, MUTE: 128 };

const HELD = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'], brake: ['Space'],
};
const ONESHOT = {
  KeyE: PH.ACT.INTERACT, KeyF: PH.ACT.MELEE, KeyR: PH.ACT.RELOAD,
  KeyQ: PH.ACT.WEAPON, KeyH: PH.ACT.HORN, KeyM: PH.ACT.MUTE,
  Enter: PH.ACT.CONFIRM, Space: PH.ACT.CONFIRM,
  KeyP: PH.ACT.PAUSE, Escape: PH.ACT.PAUSE,
};

PH.createInput = function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    const flag = ONESHOT[event.code];
    if (flag && !event.repeat) actions |= flag;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; actions |= PH.ACT.CONFIRM; }
  });
  window.addEventListener('pointerup', (event) => { if (event.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const held = (list) => list.some((code) => keys.has(code));
  return {
    mouse,
    up: () => held(HELD.up), down: () => held(HELD.down),
    left: () => held(HELD.left), right: () => held(HELD.right),
    run: () => held(HELD.run), brake: () => held(HELD.brake),
    /** The one-shot presses since the last call, as PH.ACT flags. */
    takeActions() { const taken = actions; actions = 0; return taken; },
    /** Whether the pointer was clicked since the last frame (for shooting). */
    takeClick() { const was = mouse.clicked; mouse.clicked = false; return was; },
  };
};

// Keyboard and mouse input. Held keys give movement axes; one-shot presses are
// consumed once per frame so menus and car entry never double-fire.

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  enter: ['KeyE'],
  punch: ['KeyF'],
  reload: ['KeyR'],
  weaponNext: ['KeyQ'],
  weaponPrev: ['Tab'],
  pause: ['Escape', 'KeyP'],
  horn: ['KeyH'],
  map: ['KeyM'],
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, wheel: 0 };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab' || event.code === 'Space') event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    pressed.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    mouse.wheel += Math.sign(event.deltaY);
  }, { passive: false });

  return {
    mouse,
    axis(name) {
      return KEYS[name].some((code) => held.has(code));
    },
    wasPressed(name) {
      return KEYS[name].some((code) => pressed.has(code));
    },
    anyPressed(codes) {
      return codes.some((code) => pressed.has(code));
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
      mouse.wheel = 0;
    },
    // Scripted input for the ?shot= scenes: the staging code drives the game
    // through the same input object the player uses.
    inject(codes, mouseDown) {
      for (const code of codes) held.add(code);
      mouse.down = mouseDown;
    },
    releaseAll() {
      held.clear();
    },
  };
}

// Input.
// Computer (like Minecraft): click to capture the mouse, move = look, hold LEFT = mine, RIGHT = place/use,
//   wheel / 1-9 = choose block, WASD = walk, Space = jump, E = crafting, V = camera, Esc = release mouse.
// Tablet: left side = floating joystick, right side drag = look, HOLD on a block = mine, TAP = place/use.
export class Controls {
  constructor(layer, joyEl) {
    this.layer = layer; this.joyEl = joyEl; this.knob = joyEl.querySelector('.knob');
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.keys = new Set();
    this.jump = false;
    this.lastLookTime = 0;
    this.usedTouch = false;
    this.locked = false;
    this.mining = null;            // {x, y} screen point while mining
    this.ptrs = new Map();
    this.enabled = true;
    this.onUse = () => {}; this.onWheel = () => {}; this.onKey = () => {}; this.onLockChange = () => {};
    this.lockFailed = false;

    layer.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveEv(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (this.enabled) this.onWheel(Math.sign(e.deltaY)); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === layer;
      if (!this.locked) this.mining = null;
      this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; this.onLockChange(false); });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.onKey(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mining = null; });
  }
  requestLock() {
    if (this.usedTouch || this.lockFailed || !this.layer.requestPointerLock) return false;
    try { const p = this.layer.requestPointerLock(); if (p?.catch) p.catch(() => { this.lockFailed = true; }); } catch { this.lockFailed = true; return false; }
    return true;
  }
  center() { return { x: innerWidth / 2, y: innerHeight / 2 }; }

  down(e) {
    if (!this.enabled) return;
    const touch = e.pointerType !== 'mouse';
    if (touch) this.usedTouch = true;
    if (!touch) {
      if (!this.locked && !this.lockFailed) { this.requestLock(); return; }
      if (this.locked) {
        if (e.button === 0) this.mining = this.center();
        if (e.button === 2) this.onUse(innerWidth / 2, innerHeight / 2, false);
        return;
      }
    }
    const isJoy = touch && e.clientX < innerWidth * 0.42 && ![...this.ptrs.values()].some((p) => p.joy);
    const p = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false, joy: isJoy, touch, button: e.button };
    this.ptrs.set(e.pointerId, p);
    if (isJoy) {
      this.joyEl.style.left = e.clientX - 70 + 'px'; this.joyEl.style.top = e.clientY - 70 + 'px';
      this.joyEl.classList.add('active');
      this.knob.style.transform = 'translate(0px,0px)';
    } else {
      // hold without moving = mine
      p.holdTimer = setTimeout(() => { if (!p.moved && this.ptrs.get(e.pointerId) === p) { p.mine = true; this.mining = { x: p.x, y: p.y }; } }, 230);
    }
    try { this.layer.setPointerCapture(e.pointerId); } catch {}
  }
  moveEv(e) {
    if (this.locked && e.pointerType === 'mouse') {
      this.look.dx += e.movementX; this.look.dy += e.movementY; this.lastLookTime = performance.now();
      return;
    }
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!p.mine && Math.hypot(p.x - p.x0, p.y - p.y0) > (p.touch ? 22 : 12)) p.moved = true;
    if (p.joy) {
      let jx = p.x - p.x0, jy = p.y - p.y0; const len = Math.hypot(jx, jy), max = 60;
      if (len > max) { jx = jx / len * max; jy = jy / len * max; }
      this.knob.style.transform = `translate(${jx}px,${jy}px)`;
      const dead = 8;
      this.move.x = Math.abs(jx) > dead ? jx / max : 0;
      this.move.y = Math.abs(jy) > dead ? -jy / max : 0;
    } else if (p.mine) {
      this.mining = { x: p.x, y: p.y };
    } else if (p.moved) {
      this.look.dx += dx; this.look.dy += dy; this.lastLookTime = performance.now();
    }
  }
  up(e, cancel) {
    if (this.locked && e.pointerType === 'mouse') { if (e.button === 0) this.mining = null; return; }
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    clearTimeout(p.holdTimer);
    this.ptrs.delete(e.pointerId);
    if (p.joy) { this.move.x = 0; this.move.y = 0; this.joyEl.classList.remove('active'); return; }
    if (p.mine) { this.mining = null; return; }
    if (!cancel && !p.moved && performance.now() - p.t0 < 450 && this.enabled) this.onUse(p.x, p.y, p.touch);
  }
  getMove() {
    let x = this.move.x, y = this.move.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }
  takeLook() { const l = { ...this.look }; this.look.dx = 0; this.look.dy = 0; return l; }
  jumpHeld() { return this.jump || this.keys.has('Space'); }
  sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('ControlLeft'); }
}

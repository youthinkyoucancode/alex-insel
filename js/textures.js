// Procedurally painted 16x16 pixel textures: original art, no licensing questions.
import * as THREE from 'three';
import { T, BLOCKS } from './blocks.js';

export const TILE = 16;
export const COLS = 8;
export const ROWS = 8;

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

class Painter {
  constructor(ctx, tile, seed) {
    this.ctx = ctx; this.ox = (tile % COLS) * TILE; this.oy = Math.floor(tile / COLS) * TILE;
    this.r = rng(seed * 7919 + 13);
    this.img = ctx.getImageData(this.ox, this.oy, TILE, TILE);
  }
  px(x, y, rgb, a = 255) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILE + x) * 4, d = this.img.data;
    d[i] = Math.max(0, Math.min(255, rgb[0])); d[i + 1] = Math.max(0, Math.min(255, rgb[1]));
    d[i + 2] = Math.max(0, Math.min(255, rgb[2])); d[i + 3] = a;
  }
  get(x, y) { const i = (y * TILE + x) * 4, d = this.img.data; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
  shade(rgb, f) { return [rgb[0] * f, rgb[1] * f, rgb[2] * f]; }
  noise(color, amt, a = 255, rows = [0, TILE]) {
    const c = hex(color);
    for (let y = rows[0]; y < rows[1]; y++) for (let x = 0; x < TILE; x++)
      this.px(x, y, this.shade(c, 1 + (this.r() - 0.5) * amt), a);
  }
  specks(color, chance, rows = [0, TILE]) {
    const c = hex(color);
    for (let y = rows[0]; y < rows[1]; y++) for (let x = 0; x < TILE; x++)
      if (this.r() < chance) this.px(x, y, this.shade(c, 1 + (this.r() - 0.5) * 0.1));
  }
  // Soft "toy brick" bevel: light top-left edge, dark bottom-right edge.
  bevel(light = 1.14, dark = 0.8) {
    for (let i = 0; i < TILE; i++) {
      const t = this.get(i, 0); if (t[3]) this.px(i, 0, this.shade(t, light), t[3]);
      const l = this.get(0, i); if (l[3]) this.px(0, i, this.shade(l, light), l[3]);
      const b = this.get(i, TILE - 1); if (b[3]) this.px(i, TILE - 1, this.shade(b, dark), b[3]);
      const r = this.get(TILE - 1, i); if (r[3]) this.px(TILE - 1, i, this.shade(r, dark), r[3]);
    }
  }
  done() { this.ctx.putImageData(this.img, this.ox, this.oy); }
}

const painters = {
  [T.grass_top](p) { p.noise('#79c653', 0.14); p.specks('#9fe073', 0.12); p.specks('#5fae45', 0.08); p.bevel(); },
  [T.dirt](p) { p.noise('#a3734b', 0.16); p.specks('#80583a', 0.08); p.specks('#bf8c5f', 0.05); p.bevel(); },
  [T.grass_side](p) {
    painters[T.dirt](p);
    p.noise('#79c653', 0.14, 255, [0, 3]);
    for (let x = 0; x < TILE; x++) if (p.r() < 0.55) p.px(x, 3, hex('#6bb84a'));
    for (let x = 0; x < TILE; x++) if (p.r() < 0.2) p.px(x, 4, hex('#6bb84a'));
    p.bevel();
  },
  [T.savanna_top](p) { p.noise('#c9b45a', 0.14); p.specks('#e0cd78', 0.14); p.specks('#a8964a', 0.1); p.bevel(); },
  [T.savanna_side](p) {
    painters[T.dirt](p);
    p.noise('#c9b45a', 0.14, 255, [0, 3]);
    for (let x = 0; x < TILE; x++) if (p.r() < 0.55) p.px(x, 3, hex('#b5a04c'));
    for (let x = 0; x < TILE; x++) if (p.r() < 0.2) p.px(x, 4, hex('#b5a04c'));
    p.bevel();
  },
  // toy-brick tiles are added below (studs on top, plain sides)
  [T.stone](p) {
    p.noise('#a9adb4', 0.1);
    for (let k = 0; k < 5; k++) { const x = (p.r() * 13) | 0, y = (p.r() * 13) | 0; p.px(x, y, hex('#8b9097')); p.px(x + 1, y, hex('#8b9097')); p.px(x + 1, y + 1, hex('#bfc3c9')); }
    p.bevel(1.15, 0.76);
  },
  [T.sand](p) { p.noise('#f1db9c', 0.07); p.specks('#e2c47e', 0.08); p.specks('#fff0c4', 0.05); p.bevel(1.06, 0.88); },
  [T.water](p) {
    p.noise('#3ea6df', 0.06, 205);
    for (let k = 0; k < 4; k++) { const y = (p.r() * 15) | 0, x0 = (p.r() * 10) | 0; for (let x = x0; x < x0 + 4; x++) p.px(x, y, hex('#86cdf2'), 215); }
  },
  [T.log_side](p) {
    p.noise('#94653d', 0.12);
    for (let x = 1; x < TILE; x += 3) for (let y = 0; y < TILE; y++) if (p.r() < 0.8) p.px(x, y, hex('#76502f'));
    p.bevel(1.1, 0.78);
  },
  [T.log_top](p) {
    const ring = ['#7a5231', '#d8aa6b', '#c4955a', '#d8aa6b', '#c4955a', '#d8aa6b', '#c4955a', '#b78750'];
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) | 0;
      p.px(x, y, p.shade(hex(ring[Math.min(7, 7 - d)]), 1 + (p.r() - 0.5) * 0.08));
    }
    p.bevel();
  },
  [T.leaves](p) { p.noise('#4da64a', 0.18); p.specks('#3a8a3c', 0.18); p.specks('#72c766', 0.12); p.bevel(1.12, 0.8); },
  [T.planks](p) {
    p.noise('#dba566', 0.08);
    for (let y = 3; y < TILE; y += 4) for (let x = 0; x < TILE; x++) p.px(x, y, hex('#b58248'));
    for (let row = 0; row < 4; row++) { const x = (row % 2 ? 4 : 11); for (let y = row * 4; y < row * 4 + 3; y++) p.px(x, y, hex('#b58248')); }
    p.bevel();
  },
  [T.glass](p) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) p.px(x, y, [205, 236, 255], 70);
    for (let i = 0; i < TILE; i++) { p.px(i, 0, [235, 248, 255], 255); p.px(0, i, [235, 248, 255], 255); p.px(i, 15, [170, 205, 225], 255); p.px(15, i, [170, 205, 225], 255); }
    for (let i = 3; i < 8; i++) p.px(i, 11 - i, [255, 255, 255], 190);
    for (let i = 6; i < 9; i++) p.px(i, 15 - i, [255, 255, 255], 150);
  },
  [T.brick](p) {
    p.noise('#ece1d1', 0.04);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let b = -1; b < 2; b++) {
        const x0 = b * 8 + off + 1, y0 = row * 4 + 1;
        const tint = 1 + (p.r() - 0.5) * 0.14;
        for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 7; x++) p.px(x, y, p.shade(hex('#c75b40'), tint * (1 + (p.r() - 0.5) * 0.08)));
      }
    }
    p.bevel(1.08, 0.82);
  },
  [T.snow](p) { p.noise('#f6faff', 0.03); p.specks('#e1ebf7', 0.1); p.bevel(1.03, 0.9); },
  [T.snow_side](p) {
    painters[T.dirt](p);
    p.noise('#f6faff', 0.03, 255, [0, 4]);
    for (let x = 0; x < TILE; x++) if (p.r() < 0.5) p.px(x, 4, hex('#eef4fb'));
    p.bevel();
  },
  [T.crystal](p) {
    p.noise('#a77cf2', 0.08);
    for (let i = 0; i < TILE; i++) { p.px(i, i, hex('#d9c2ff')); p.px(i, (i + 8) % 16, hex('#d9c2ff')); p.px(15 - i, i, hex('#8a5ad8')); }
    p.specks('#f3eaff', 0.05);
    p.bevel(1.2, 0.75);
  },
  [T.coal_ore](p) { ore(p, ['#2c2c33', '#45454f']); },
  [T.iron_ore](p) { ore(p, ['#d79b74', '#efc4a2']); },
  [T.gold_ore](p) { ore(p, ['#f3c623', '#fff08a']); },
  [T.clay](p) { p.noise('#a8b2c3', 0.08); p.specks('#96a0b2', 0.1); p.specks('#bcc5d4', 0.06); p.bevel(1.08, 0.84); },
  [T.wool](p) {
    p.noise('#f4f2ec', 0.05);
    for (let k = 0; k < 14; k++) { const x = (p.r() * 14) | 0, y = (p.r() * 14) | 0; p.px(x, y, hex('#e3dfd5')); p.px(x + 1, y + 1, hex('#ffffff')); }
    p.bevel(1.04, 0.86);
  },
  [T.gold_block](p) {
    p.noise('#f4c63a', 0.06);
    for (let i = 2; i < 14; i++) { p.px(i, 2, hex('#fff2a8')); p.px(2, i, hex('#fff2a8')); p.px(i, 13, hex('#c99a1c')); p.px(13, i, hex('#c99a1c')); }
    p.px(4, 4, hex('#ffffff')); p.px(5, 4, hex('#ffffff')); p.px(4, 5, hex('#ffffff'));
    p.bevel(1.18, 0.75);
  },
  [T.chest](p) {
    p.noise('#b9793e', 0.08);
    for (let y = 4; y < 16; y += 4) for (let x = 0; x < 16; x++) p.px(x, y, hex('#8d5a2b'));
    for (let i = 0; i < 16; i++) { p.px(i, 0, hex('#5b3a1d')); p.px(i, 15, hex('#5b3a1d')); p.px(0, i, hex('#5b3a1d')); p.px(15, i, hex('#5b3a1d')); p.px(i, 6, hex('#e8b830')); }
    for (let y = 5; y < 10; y++) for (let x = 6; x < 10; x++) p.px(x, y, hex('#f3c623'));
    p.px(7, 8, hex('#3a2a12')); p.px(8, 8, hex('#3a2a12'));
  },
  [T.chest_top](p) {
    p.noise('#c4844a', 0.08);
    for (let i = 0; i < 16; i++) { p.px(i, 0, hex('#5b3a1d')); p.px(i, 15, hex('#5b3a1d')); p.px(0, i, hex('#5b3a1d')); p.px(15, i, hex('#5b3a1d')); p.px(i, 7, hex('#e8b830')); p.px(7, i, hex('#e8b830')); }
  },
  [T.torch](p) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) p.px(x, y, [0, 0, 0], 0);
    for (let y = 6; y < 16; y++) { p.px(7, y, hex('#8a5a2e')); p.px(8, y, hex('#a8713d')); }
    [[7, 5], [8, 5], [7, 4], [8, 4], [6, 4], [9, 4], [7, 3], [8, 3]].forEach(([x, y]) => p.px(x, y, hex('#ffb12e')));
    [[7, 2], [8, 2], [7, 1]].forEach(([x, y]) => p.px(x, y, hex('#ffe680')));
    p.px(7, 4, hex('#fff6c2')); p.px(8, 4, hex('#fff6c2'));
  },
  [T.flower_red](p) { flower(p, '#ff5d6c', '#ffd23f'); },
  [T.flower_yellow](p) { flower(p, '#ffd23f', '#f08a24'); },
  [T.metal](p) {
    p.noise('#c3c9d2', 0.06);
    for (let i = 0; i < TILE; i++) for (let w = 0; w < 2; w++) {
      const c = ((i + w) >> 2) % 2 ? hex('#f3c43f') : hex('#565c6b');
      p.px(i, w, c); p.px(i, 15 - w, c);
    }
    [[4, 5], [11, 5], [4, 10], [11, 10]].forEach(([x, y]) => { p.px(x, y, hex('#8d94a1')); p.px(x + 1, y, hex('#e6eaf0')); });
    p.bevel(1.08, 0.8);
  },
};

painters[T.moon] = (p) => {   // pale grey dust with small craters
  p.noise('#c7c9cf', 0.12); p.specks('#9fa2aa', 0.1);
  for (const [cx, cy, r] of [[4, 5, 2], [11, 11, 3], [12, 3, 1]]) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y); if (d <= r - 0.5) p.px(cx + x, cy + y, hex('#a3a6ad')); else if (d <= r + 0.5 && x + y < 0) p.px(cx + x, cy + y, hex('#e3e5ea'));
  }
  p.bevel(1.08, 0.82);
};
// Toy bricks: a smooth plastic colour, four round studs on top with a highlight and a shadow
const STUD_COLORS = { red: '#d8342c', blue: '#2a63d6', yellow: '#f5c518', green: '#2f9a44', white: '#f2f2ee', black: '#3a3a42' };
for (const [name, col] of Object.entries(STUD_COLORS)) {
  painters[T['stud_' + name]] = (p) => {
    p.noise(col, 0.03); const c = hex(col);
    for (const [cx, cy] of [[4, 4], [11, 4], [4, 11], [11, 11]]) {
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
        const d = x * x + y * y;
        if (d <= 7) p.px(cx + x, cy + y, p.shade(c, 1.08));
        else if (d <= 11 && x + y > 0) p.px(cx + x, cy + y, p.shade(c, 0.72));      // shadow under the stud
      }
      p.px(cx - 1, cy - 1, p.shade(c, 1.35)); p.px(cx - 2, cy, p.shade(c, 1.22)); p.px(cx, cy - 2, p.shade(c, 1.22));   // shine
    }
    p.bevel(1.15, 0.75);
  };
  painters[T['stud_' + name + '_side']] = (p) => {
    p.noise(col, 0.03); const c = hex(col);
    for (let x = 0; x < 16; x++) { p.px(x, 1, p.shade(c, 1.12)); p.px(x, 14, p.shade(c, 0.85)); }
    p.bevel(1.15, 0.75);
  };
}

function ore(p, [c1, c2]) {
  painters[T.stone](p);
  const spots = [[3, 3], [10, 4], [6, 9], [11, 11], [2, 12]];
  for (const [sx, sy] of spots) {
    const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
    for (const [dx, dy] of pts) if (p.r() < 0.85) p.px(sx + dx, sy + dy, hex(dx + dy < 2 ? c2 : c1));
  }
}

function flower(p, petal, center) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) p.px(x, y, [0, 0, 0], 0);
  for (let y = 7; y < 16; y++) { p.px(7, y, hex('#3f9a3a')); p.px(8, y, hex('#4dae46')); }
  [[5, 11], [6, 11], [6, 12], [9, 10], [10, 10], [9, 11]].forEach(([x, y]) => p.px(x, y, hex('#5cbf4f')));
  const pc = hex(petal);
  for (let y = 2; y < 8; y++) for (let x = 4; x < 12; x++) {
    const dx = x - 7.5, dy = y - 4.5;
    if (dx * dx + dy * dy < 9.5) p.px(x, y, p.shade(pc, 1 + (p.r() - 0.5) * 0.12));
  }
  [[7, 4], [8, 4], [7, 5], [8, 5]].forEach(([x, y]) => p.px(x, y, hex(center)));
}

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE; canvas.height = ROWS * TILE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const glow = document.createElement('canvas');
  glow.width = canvas.width; glow.height = canvas.height;
  const gctx = glow.getContext('2d');
  gctx.fillStyle = '#000'; gctx.fillRect(0, 0, glow.width, glow.height);

  for (const [tile, paint] of Object.entries(painters)) {
    const p = new Painter(ctx, +tile, +tile + 1);
    paint(p); p.done();
  }

  const tex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { canvas, texture: tex(canvas), glowTexture: tex(glow) };
}

export function tileUV(tile) {
  const col = tile % COLS, row = Math.floor(tile / COLS);
  const e = 0.0004;
  return [col / COLS + e, 1 - (row + 1) / ROWS + e, (col + 1) / COLS - e, 1 - row / ROWS - e];
}

// Crack overlays shown while mining (5 stages).
export function crackTextures() {
  const out = [];
  const r = rng(99);
  const lines = [];
  for (let k = 0; k < 10; k++) { let x = 8, y = 8; const seg = []; const a = r() * Math.PI * 2; for (let s = 0; s < 7; s++) { x += Math.cos(a + (r() - 0.5)) * 1.3; y += Math.sin(a + (r() - 0.5)) * 1.3; seg.push([x | 0, y | 0]); } lines.push(seg); }
  for (let stage = 0; stage < 5; stage++) {
    const c = document.createElement('canvas'); c.width = c.height = TILE;
    const ctx = c.getContext('2d'); ctx.fillStyle = 'rgba(30,25,35,0.75)';
    const n = 2 + stage * 2;
    for (let k = 0; k < n; k++) for (const [x, y] of lines[k].slice(0, 2 + stage)) ctx.fillRect(x, y, 1, 1);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    out.push(t);
  }
  return out;
}

// Pixel-art icons for items that are not blocks.
const ITEM_ART = {
  64: (s) => s.blob([[5, 6, 7, 6], [4, 7, 9, 4]], '#2c2c33', '#55555f'),                         // Kohle
  65: (s) => s.ingot('#b9c0cc', '#e8edf4', '#8a919e'),                                            // Eisen
  66: (s) => s.ingot('#f3c623', '#fff08a', '#c99a1c'),                                            // Gold
  67: (s) => s.egg(),                                                                              // Ei
  70: (s) => s.pick('#c4955a', '#8a5a2e'),
  71: (s) => s.pick('#a9adb4', '#8a5a2e'),
  72: (s) => s.pick('#dfe4ec', '#8a5a2e'),
};
export function itemIcon(id, size = 96) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  const s = {
    blob(rects, col, hi) { for (const [x, y, w, h] of rects) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); } px(6, 7, hi); px(7, 7, hi); px(10, 8, hi); },
    ingot(col, hi, lo) {
      for (let y = 6; y < 12; y++) for (let x = 3 + (11 - y) / 2; x < 13 - (11 - y) / 2; x++) px(x | 0, y, col);
      for (let x = 5; x < 11; x++) px(x, 6, hi);
      for (let x = 3; x < 13; x++) px(x, 11, lo);
    },
    egg() {
      for (let y = 3; y < 14; y++) for (let x = 3; x < 13; x++) {
        const dx = (x - 7.5) / 4.4, dy = (y - 8.5) / (y < 8.5 ? 5.6 : 5); if (dx * dx + dy * dy < 1) px(x, y, '#f5e6cc');
      }
      px(6, 5, '#fffaf0'); px(6, 6, '#fffaf0'); px(5, 7, '#fffaf0');
    },
    pick(head, stick) {
      for (let i = 0; i < 9; i++) { px(4 + i, 12 - i, stick); }
      for (let i = 0; i < 9; i++) { const x = 4 + i, y = 2 + Math.round(Math.abs(i - 4) * 0.6); px(x, y, head); px(x, y + 1, head); }
    },
  };
  ITEM_ART[id]?.(s);
  const out = document.createElement('canvas'); out.width = out.height = size;
  const o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.drawImage(c, 0, 0, size, size);
  return out.toDataURL();
}

// Small isometric cube icon (for hotbar, cards and the book).
export function blockIcon(atlasCanvas, id, size = 64) {
  const def = BLOCKS[id];
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const src = (tile) => [(tile % COLS) * TILE, Math.floor(tile / COLS) * TILE];
  if (def.kind === 'cross') {
    const [sx, sy] = src(def.tiles.top);
    ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, size * 0.1, size * 0.1, size * 0.8, size * 0.8);
    return c.toDataURL();
  }
  const s = size * 0.46, h = s * 0.5;
  const face = (tile, m, shade) => {
    const [sx, sy] = src(tile);
    ctx.save(); ctx.setTransform(...m);
    ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, 0, 0, 1, 1);
    if (shade) { ctx.fillStyle = `rgba(0,0,0,${shade})`; ctx.fillRect(0, 0, 1, 1); }
    ctx.restore();
  };
  const cx = size / 2, top = size * 0.04;
  face(def.tiles.top, [s * 0.98, h * 0.98, -s * 0.98, h * 0.98, cx, top], 0);
  face(def.tiles.side, [s, h, 0, s, cx - s, top + h], 0.18);
  face(def.tiles.side, [s, -h, 0, s, cx, top + 2 * h], 0.32);
  return c.toDataURL();
}

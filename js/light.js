// Block lighting (like voxel games do it): sky light pours down from above and spreads sideways,
// torches and crystals glow. Values 0..15, one byte per cell. Caves get properly dark, torches matter.
import { B, BLOCKS, isOpaque } from './blocks.js';
import { W, H, D } from './world.js';

const EMIT = { [B.TORCH]: 14, [B.CRYSTAL]: 10 };
const N = W * H * D;
const idx = (x, y, z) => (y * D + z) * W + x;

export class Lighting {
  constructor(world) {
    this.world = world;
    this.sky = new Uint8Array(N);
    this.blk = new Uint8Array(N);
    this.opq = new Uint8Array(N);
    this.changed = null;
  }
  refreshOpacity(x0 = 0, x1 = W - 1, z0 = 0, z1 = D - 1) {
    const data = this.world.data;
    for (let y = 0; y < H; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const i = idx(x, y, z); const id = data[i];
      this.opq[i] = isOpaque(id) && !EMIT[id] ? 1 : 0;
    }
  }
  computeAll() { this.refreshOpacity(); this.computeBox(0, W - 1, 0, D - 1, false); }

  // Recompute light inside [x0..x1]×[z0..z1] (full height), using the cells around it as sources.
  computeBox(x0, x1, z0, z1, track = true) {
    x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(W - 1, x1); z1 = Math.min(D - 1, z1);
    const { sky, blk, opq } = this, data = this.world.data;
    const bw = x1 - x0 + 1, bd = z1 - z0 + 1;
    const bi = (x, y, z) => (y * bd + (z - z0)) * bw + (x - x0);
    const oldS = track ? new Uint8Array(bw * bd * H) : null, oldB = track ? new Uint8Array(bw * bd * H) : null;
    const qs = [], qb = [];
    // highest roof per column (box + 1 ring): an open cell only needs to spread sideways
    // if a neighbour column has a roof above it (cave mouth, overhang, under trees)
    const tw = bw + 2, top = new Int16Array(tw * (bd + 2)).fill(-1);
    for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (x < 0 || z < 0 || x >= W || z >= D) continue;
      for (let y = H - 1; y >= 0; y--) if (this.opq[idx(x, y, z)]) { top[(z - z0 + 1) * tw + (x - x0 + 1)] = y; break; }
    }
    const roofNear = (x, y, z) => {
      const b = (z - z0 + 1) * tw + (x - x0 + 1);
      return top[b - 1] > y || top[b + 1] > y || top[b - tw] > y || top[b + tw] > y;
    };
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      let open = true;
      for (let y = H - 1; y >= 0; y--) {
        const i = idx(x, y, z);
        if (track) { const k = bi(x, y, z); oldS[k] = sky[i]; oldB[k] = blk[i]; }
        if (opq[i]) open = false;
        sky[i] = open ? 15 : 0;
        // only open cells next to a covered cell need to spread light sideways
        if (open && roofNear(x, y, z)) qs.push(i);
        const e = EMIT[data[i]] || 0;
        blk[i] = e; if (e) qb.push(i);
      }
    }
    // neighbours just outside the box keep their light and shine in
    if (track) {
      const edge = (x, z) => { if (x < 0 || z < 0 || x >= W || z >= D) return; for (let y = 0; y < H; y++) { const i = idx(x, y, z); if (sky[i] > 1) qs.push(i); if (blk[i] > 1) qb.push(i); } };
      for (let x = x0 - 1; x <= x1 + 1; x++) { edge(x, z0 - 1); edge(x, z1 + 1); }
      for (let z = z0; z <= z1; z++) { edge(x0 - 1, z); edge(x1 + 1, z); }
    }
    this.flood(sky, qs, x0 - 1, x1 + 1, z0 - 1, z1 + 1);
    this.flood(blk, qb, x0 - 1, x1 + 1, z0 - 1, z1 + 1);
    if (track) {
      // report which area really changed (so only those chunks are rebuilt)
      let cx0 = Infinity, cx1 = -1, cz0 = Infinity, cz1 = -1;
      for (let y = 0; y < H; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const i = idx(x, y, z), k = bi(x, y, z);
        if (sky[i] !== oldS[k] || blk[i] !== oldB[k]) { if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (z < cz0) cz0 = z; if (z > cz1) cz1 = z; }
      }
      this.changed = cx1 >= 0 ? { x0: cx0, x1: cx1, z0: cz0, z1: cz1 } : null;
    }
  }
  flood(L, q, x0, x1, z0, z1) {
    const opq = this.opq;
    let head = 0;
    while (head < q.length) {
      const i = q[head++]; const v = L[i]; if (v <= 1) continue;
      const x = i % W, z = Math.floor(i / W) % D, y = Math.floor(i / (W * D));
      const nv = v - 1;
      // 6 neighbours, staying inside the box (+1 ring)
      if (x > x0 && x > 0) { const j = i - 1; if (!opq[j] && L[j] < nv) { L[j] = nv; q.push(j); } }
      if (x < x1 && x < W - 1) { const j = i + 1; if (!opq[j] && L[j] < nv) { L[j] = nv; q.push(j); } }
      if (z > z0 && z > 0) { const j = i - W; if (!opq[j] && L[j] < nv) { L[j] = nv; q.push(j); } }
      if (z < z1 && z < D - 1) { const j = i + W; if (!opq[j] && L[j] < nv) { L[j] = nv; q.push(j); } }
      if (y > 0) { const j = i - W * D; if (!opq[j] && L[j] < nv) { L[j] = nv; q.push(j); } }
      if (y < H - 1) { const j = i + W * D; if (!opq[j] && L[j] < nv) { L[j] = nv; q.push(j); } }
    }
  }
  // After a block change: update opacity + relight a 15-block box around it.
  onBlockChanged(x, y, z) {
    const i = idx(x, y, z), id = this.world.data[i];
    this.opq[i] = isOpaque(id) && !EMIT[id] ? 1 : 0;
    this.computeBox(x - 15, x + 15, z - 15, z + 15);
    return this.changed;
  }
  // many blocks at once (an explosion): one relight for the whole area
  onBlocksChanged(cells) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, y, z] of cells) {
      const i = idx(x, y, z), id = this.world.data[i];
      this.opq[i] = isOpaque(id) && !EMIT[id] ? 1 : 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    this.computeBox(x0 - 15, x1 + 15, z0 - 15, z1 + 15);
    return this.changed;
  }
  get(x, y, z) {
    if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return [15, 0];
    if (y < 0) return [0, 0];
    const i = idx(x, y, z); return [this.sky[i], this.blk[i]];
  }
}

// light value 0..15 -> brightness (each step ~18% darker, like real light falloff feels)
export const CURVE = Array.from({ length: 16 }, (_, v) => Math.pow(0.82, 15 - v));

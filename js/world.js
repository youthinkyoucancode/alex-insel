import { B, isSolid } from './blocks.js';

export const W = 128, H = 48, D = 128;
export const SEA = 12;
export const CHUNK = 16;

export class World {
  constructor() {
    this.W = W; this.H = H; this.D = D;
    this.data = new Uint8Array(W * H * D);
    this.edits = new Map();          // index -> id (for saving)
    this.listeners = [];
  }
  idx(x, y, z) { return (y * D + z) * W + x; }
  inBounds(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D; }
  get(x, y, z) {
    if (y < 0) return B.STONE;
    if (!this.inBounds(x, y, z)) return B.AIR;
    return this.data[this.idx(x, y, z)];
  }
  rawSet(x, y, z, id) { if (this.inBounds(x, y, z)) this.data[this.idx(x, y, z)] = id; }
  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return false;
    const i = this.idx(x, y, z);
    if (this.data[i] === id) return false;
    this.data[i] = id;
    this.edits.set(i, id);
    for (const fn of this.listeners) fn(x, y, z, id);
    return true;
  }
  solidAt(x, y, z) { return isSolid(this.get(Math.floor(x), Math.floor(y), Math.floor(z))); }
  // Height of the walkable surface in column (x,z), searching down from `fromY`.
  surface(x, z, fromY = H - 1) {
    const ix = Math.floor(x), iz = Math.floor(z);
    for (let y = Math.min(H - 1, Math.floor(fromY)); y >= 0; y--) if (isSolid(this.get(ix, y, iz))) return y + 1;
    return 0;
  }
  topBlock(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    for (let y = H - 1; y >= 0; y--) { const id = this.get(ix, y, iz); if (id !== B.AIR) return { id, y }; }
    return { id: B.AIR, y: 0 };
  }

  // Voxel ray traversal (Amanatides & Woo). Returns first targetable block.
  raycast(origin, dir, maxDist, accept) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = sx ? Math.abs(1 / dir.x) : Infinity, tdy = sy ? Math.abs(1 / dir.y) : Infinity, tdz = sz ? Math.abs(1 / dir.z) : Infinity;
    let tmx = sx > 0 ? (x + 1 - origin.x) * tdx : sx < 0 ? (origin.x - x) * tdx : Infinity;
    let tmy = sy > 0 ? (y + 1 - origin.y) * tdy : sy < 0 ? (origin.y - y) * tdy : Infinity;
    let tmz = sz > 0 ? (z + 1 - origin.z) * tdz : sz < 0 ? (origin.z - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxDist) {
      const id = this.get(x, y, z);
      if (accept(id)) return { x, y, z, nx, ny, nz, id, t };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
      if (y < -1 || y > H + 1) break;
    }
    return null;
  }

  serializeEdits() { return Array.from(this.edits.entries()); }
  applyEdits(list) { for (const [i, id] of list) { this.data[i] = id; this.edits.set(i, id); } }
}

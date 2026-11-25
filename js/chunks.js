// Chunk meshing: face culling + per-vertex ambient occlusion (soft dark corners).
import * as THREE from 'three';
import { B, BLOCKS, isOpaque } from './blocks.js';
import { W, H, D, CHUNK } from './world.js';
import { tileUV } from './textures.js';
import { CURVE } from './light.js';

// corners listed counter-clockwise seen from outside; uv: BL, BR, TR, TL
// shade: light baked per face direction (no real-time lighting needed → cheap on the tablet GPU)
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], side: 'side', shade: 0.82 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], side: 'side', shade: 0.74 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], side: 'top', shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], side: 'bottom', shade: 0.55 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], side: 'side', shade: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], side: 'side', shade: 0.66 },
];
const AO_LEVELS = [0.52, 0.7, 0.86, 1.0];

const FULL_LIGHT = [[1, 0], [1, 0], [1, 0], [1, 0]];
class GeoBuilder {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.lt = []; this.idx = []; this.v = 0; }
  quad(verts, normal, uvRect, ao, flip, lights = FULL_LIGHT) {
    const [u0, v0, u1, v1] = uvRect;
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 4; i++) {
      this.pos.push(verts[i][0], verts[i][1], verts[i][2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      const a = ao[i]; this.col.push(a, a, a);
      this.lt.push(lights[i][0], lights[i][1]);
    }
    const b = this.v;
    if (flip) this.idx.push(b + 1, b + 2, b + 3, b + 1, b + 3, b);
    else this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.v += 4;
  }
  // raw typed arrays (merged later with the neighbouring chunks into one region mesh)
  build() {
    if (!this.v) return null;
    return { v: this.v, pos: new Float32Array(this.pos), uv: new Float32Array(this.uv), col: new Float32Array(this.col), lt: new Float32Array(this.lt), idx: this.idx };
  }
}

function shouldDrawFace(id, nid) {
  const kind = BLOCKS[id].kind;
  if (kind === 'cube') return !isOpaque(nid);
  if (kind === 'glass') return !isOpaque(nid) && nid !== B.GLASS;
  if (kind === 'water') return nid !== B.WATER && !isOpaque(nid);
  return false;
}

export function meshChunk(world, cx, cz, light) {
  const lightAt = (x, y, z) => { const [s, b] = light ? light.get(x, y, z) : [15, 0]; return [CURVE[s], CURVE[b]]; };
  const lights = [[1, 0], [1, 0], [1, 0], [1, 0]];
  const opaque = new GeoBuilder(), trans = new GeoBuilder(), crossB = new GeoBuilder();
  const GLOW = [[1, 2], [1, 2], [1, 2], [1, 2]];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const g = (x, y, z) => world.get(x, y, z);
  const occ = (x, y, z) => (isOpaque(g(x, y, z)) ? 1 : 0);
  const verts = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const ao = [1, 1, 1, 1];

  for (let y = 0; y < H; y++) for (let z = z0; z < z0 + CHUNK; z++) for (let x = x0; x < x0 + CHUNK; x++) {
    const id = g(x, y, z);
    if (id === B.AIR) continue;
    const def = BLOCKS[id];
    if (def.kind === 'cross') {
      const uv = tileUV(def.tiles.top);
      const a = 0.15, b = 0.85;
      const n = [0, 1, 0], full = [1, 1, 1, 1];
      const cross = crossB;
      const l = lightAt(x, y, z), ls = def.glow ? GLOW : [l, l, l, l];
      cross.quad([[x + a, y, z + a], [x + b, y, z + b], [x + b, y + 1, z + b], [x + a, y + 1, z + a]], n, uv, full, false, ls);
      cross.quad([[x + a, y, z + b], [x + b, y, z + a], [x + b, y + 1, z + a], [x + a, y + 1, z + b]], n, uv, full, false, ls);
      continue;
    }
    const isWater = def.kind === 'water';
    const waterTop = isWater && g(x, y + 1, z) !== B.WATER ? 0.86 : 1;
    const target = def.kind === 'cube' ? opaque : trans;
    for (const f of FACES) {
      const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
      const nid = g(nx, ny, nz);
      if (!shouldDrawFace(id, nid)) continue;
      // Water surface: always draw the top even against air (handled above); skip faces at world floor
      if (ny < 0) continue;
      const tile = def.tiles[f.side];
      const front = lightAt(nx, ny, nz);
      for (let i = 0; i < 4; i++) {
        const c = f.c[i];
        verts[i] = [x + c[0], y + (c[1] === 1 ? waterTop : 0), z + c[2]];
        if (def.glow) { ao[i] = f.shade; lights[i] = GLOW[0]; continue; }
        if (isWater || def.kind === 'glass') { ao[i] = f.shade; lights[i] = front; continue; }
        // AO + smooth light: look at the 3 neighbours in front of the face around this corner
        let s1x = 0, s1y = 0, s1z = 0, s2x = 0, s2y = 0, s2z = 0;
        if (f.n[0] !== 0) { s1y = c[1] ? 1 : -1; s2z = c[2] ? 1 : -1; }
        else if (f.n[1] !== 0) { s1x = c[0] ? 1 : -1; s2z = c[2] ? 1 : -1; }
        else { s1x = c[0] ? 1 : -1; s2y = c[1] ? 1 : -1; }
        const ax = nx + s1x, ay = ny + s1y, az = nz + s1z, bx = nx + s2x, by = ny + s2y, bz = nz + s2z;
        const cx_ = nx + s1x + s2x, cy_ = ny + s1y + s2y, cz_ = nz + s1z + s2z;
        const s1 = occ(ax, ay, az), s2 = occ(bx, by, bz), cc = occ(cx_, cy_, cz_);
        ao[i] = AO_LEVELS[s1 && s2 ? 0 : 3 - (s1 + s2 + cc)] * f.shade;
        let ss = front[0], sb = front[1], n = 1;
        if (!s1) { const l = lightAt(ax, ay, az); ss += l[0]; sb += l[1]; n++; }
        if (!s2) { const l = lightAt(bx, by, bz); ss += l[0]; sb += l[1]; n++; }
        if (!cc && !(s1 && s2)) { const l = lightAt(cx_, cy_, cz_); ss += l[0]; sb += l[1]; n++; }
        lights[i] = [ss / n, sb / n];
      }
      const flip = ao[0] + ao[2] < ao[1] + ao[3];
      target.quad(verts, f.n, tileUV(tile), ao, flip, lights);
    }
  }
  return { opaque: opaque.build(), trans: trans.build(), cross: crossB.build() };
}

const REGION = 2;   // chunks per region side: 2x2 chunks = one 32x32 region = one draw call per material
function mergeParts(parts) {
  let v = 0, ni = 0;
  for (const p of parts) { v += p.v; ni += p.idx.length; }
  if (!v) return null;
  const pos = new Float32Array(v * 3), uv = new Float32Array(v * 2), col = new Float32Array(v * 3), lt = new Float32Array(v * 2);
  const idx = v > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const p of parts) {
    pos.set(p.pos, vo * 3); uv.set(p.uv, vo * 2); col.set(p.col, vo * 3); lt.set(p.lt, vo * 2);
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo;
    vo += p.v; io += p.idx.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('light', new THREE.BufferAttribute(lt, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

export class ChunkManager {
  constructor(world, scene, materials, light) {
    this.world = world; this.scene = scene; this.mat = materials; this.light = light;
    this.nx = W / CHUNK; this.nz = D / CHUNK;
    this.parts = new Map();      // chunk -> raw geometry per material
    this.regions = new Map();    // region -> meshes
    this.dirty = new Set();      // chunks to re-mesh
    this.dirtyRegions = new Set();
    world.listeners.push((x, y, z) => {
      this.markAround(x, z);
      const ch = light?.onBlockChanged(x, y, z);
      if (ch) for (let cz = Math.floor((ch.z0 - 1) / CHUNK); cz <= Math.floor((ch.z1 + 1) / CHUNK); cz++)
        for (let cx = Math.floor((ch.x0 - 1) / CHUNK); cx <= Math.floor((ch.x1 + 1) / CHUNK); cx++)
          if (cx >= 0 && cz >= 0 && cx < this.nx && cz < this.nz) this.dirty.add(this.key(cx, cz));
    });
  }
  key(cx, cz) { return cx + ',' + cz; }
  // set many blocks at once without relighting after every single one
  setMany(cells) {
    const w = this.world;
    for (const [x, y, z, id] of cells) { const i = w.idx(x, y, z); w.data[i] = id; w.edits.set(i, id); this.markAround(x, z); }
    const ch = this.light?.onBlocksChanged(cells);
    if (ch) for (let cz = Math.floor((ch.z0 - 1) / CHUNK); cz <= Math.floor((ch.z1 + 1) / CHUNK); cz++)
      for (let cx = Math.floor((ch.x0 - 1) / CHUNK); cx <= Math.floor((ch.x1 + 1) / CHUNK); cx++)
        if (cx >= 0 && cz >= 0 && cx < this.nx && cz < this.nz) this.dirty.add(this.key(cx, cz));
  }
  markAround(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    this.dirty.add(this.key(cx, cz));
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    if (lx === 0 && cx > 0) this.dirty.add(this.key(cx - 1, cz));
    if (lx === CHUNK - 1 && cx < this.nx - 1) this.dirty.add(this.key(cx + 1, cz));
    if (lz === 0 && cz > 0) this.dirty.add(this.key(cx, cz - 1));
    if (lz === CHUNK - 1 && cz < this.nz - 1) this.dirty.add(this.key(cx, cz + 1));
  }
  buildAll() {
    for (let cz = 0; cz < this.nz; cz++) for (let cx = 0; cx < this.nx; cx++) this.remesh(cx, cz);
    for (const r of this.dirtyRegions) this.buildRegion(r);
    this.dirtyRegions.clear();
  }
  remesh(cx, cz) {
    this.parts.set(this.key(cx, cz), meshChunk(this.world, cx, cz, this.light));
    this.dirtyRegions.add(Math.floor(cx / REGION) + ',' + Math.floor(cz / REGION));
  }
  buildRegion(rk) {
    const [rx, rz] = rk.split(',').map(Number);
    const old = this.regions.get(rk);
    if (old) for (const m of old) { this.scene.remove(m); m.geometry.dispose(); }
    const meshes = [];
    for (const kind of ['opaque', 'cross', 'trans']) {
      const parts = [];
      for (let dz = 0; dz < REGION; dz++) for (let dx = 0; dx < REGION; dx++) { const p = this.parts.get(this.key(rx * REGION + dx, rz * REGION + dz)); if (p?.[kind]) parts.push(p[kind]); }
      const g = mergeParts(parts); if (!g) continue;
      const m = new THREE.Mesh(g, this.mat[kind]);
      if (kind === 'trans') m.renderOrder = 1;
      m.matrixAutoUpdate = false; this.scene.add(m); meshes.push(m);
    }
    this.regions.set(rk, meshes);
  }
  // The edited chunk is re-meshed first; light-only changes trickle in a few per frame (no hitches).
  update(max = 3) {
    let n = 0;
    for (const k of this.dirty) {
      if (n++ >= max) break;
      const [cx, cz] = k.split(',').map(Number); this.remesh(cx, cz); this.dirty.delete(k);
    }
    for (const r of this.dirtyRegions) this.buildRegion(r);
    this.dirtyRegions.clear();
  }
}

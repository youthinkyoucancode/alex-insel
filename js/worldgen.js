// Builds Alex's island: meadow, forest, beach, a snowy mountain with a crystal cave,
// and a flat launch pad for the rocket.
import { B, isSolid } from './blocks.js';
import { W, H, D, SEA } from './world.js';

function hash2(x, z, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
function valueNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = fade(x - xi), zf = fade(z - zi);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed), c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
function fbm(x, z, seed, oct = 4) {
  let s = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += valueNoise(x * f, z * f, seed + i * 17) * amp; n += amp; amp *= 0.5; f *= 2; }
  return s / n;
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export const LAYOUT = {
  spawn: { x: 51, z: 74 },
  pad: { x: 60, z: 66 },
  rover: { x: 45, z: 79 },
  mountain: { x: 92, z: 38, r: 26 },
  forest: { x: 34, z: 36, r: 22 },
  savanna: { x: 88, z: 88, r: 13 },   // dry grassland with flat-topped trees: home of the lions
  pond: { x: 24, z: 58, r: 3.6 },     // a pond at the forest edge: the tiger's favourite spot (tigers love water)
  ramp: { x: 53, z: 79 },
  moon: { x: 15, z: 15, y: 34, r: 9 },   // the "moon": a grey platform high in the sky over the sea (y = surface)             // where the rover jump ramp gets built (rover drives along +x)
  kiste: { x: 50, z: 82 },            // the "Baukiste": a chest with the bricks for the ramp
};

export function generate(world, seed = 2026) {
  const rand = seeded(seed);
  const heights = new Int16Array(W * D);
  const cx = W / 2, cz = D / 2;
  const M = LAYOUT.mountain;

  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - cx, z - cz) / (W / 2) + (fbm(x / 18, z / 18, seed + 5) - 0.5) * 0.18;
    const fall = 1 - smooth(0.62, 0.95, d);
    let h = 14 + fbm(x / 34, z / 34, seed) * 7;
    const md = Math.hypot(x - M.x, z - M.z) / M.r;
    if (md < 1) h += Math.pow(1 - md, 1.6) * 24 * (0.85 + fbm(x / 9, z / 9, seed + 9) * 0.3);
    h = 5 + (h - 5) * fall;
    heights[z * W + x] = Math.max(2, Math.min(H - 4, Math.round(h)));
  }

  // Flatten around spawn, pad and rover so building space is calm and even.
  const flatten = (px, pz, r, level) => {
    for (let z = pz - r - 3; z <= pz + r + 3; z++) for (let x = px - r - 3; x <= px + r + 3; x++) {
      if (x < 0 || z < 0 || x >= W || z >= D) continue;
      const dd = Math.max(Math.abs(x - px), Math.abs(z - pz));
      const t = dd <= r ? 1 : 1 - (dd - r) / 4;
      const i = z * W + x;
      heights[i] = Math.round(heights[i] + (level - heights[i]) * Math.max(0, t));
    }
  };
  const L = LAYOUT;
  const baseLevel = 16;
  flatten(L.spawn.x, L.spawn.z, 5, baseLevel);
  flatten(L.pad.x, L.pad.z, 4, baseLevel);
  flatten(L.rover.x, L.rover.z, 3, baseLevel);
  flatten(L.ramp.x, L.ramp.z + 1, 5, baseLevel);        // run-up, ramp and landing strip
  flatten(L.ramp.x + 6, L.ramp.z + 1, 4, baseLevel);
  L.ramp.y = baseLevel;
  const P = L.pond, pondLevel = Math.max(SEA + 3, heights[P.z * W + P.x]);
  flatten(P.x, P.z, 5, pondLevel);
  P.y = pondLevel;
  const S = L.savanna;
  const inSavanna = (x, z) => Math.hypot(x - S.x, z - S.z) / S.r + (fbm(x / 8, z / 8, seed + 31) - 0.5) * 0.35 < 1;

  // Fill columns
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = heights[z * W + x];
    const beach = h <= SEA + 1;
    const snowy = h >= 30;
    const rocky = h >= 25 && !snowy;
    for (let y = 0; y < h; y++) {
      let id;
      if (y === h - 1) id = beach ? B.SAND : snowy ? B.SNOW : rocky ? B.STONE : inSavanna(x, z) ? B.SAVANNA : B.GRASS;
      else if (y >= h - 4) id = beach ? B.SAND : rocky || snowy ? B.STONE : B.DIRT;
      else id = B.STONE;
      world.rawSet(x, y, z, id);
    }
    for (let y = h; y <= SEA; y++) world.rawSet(x, y, z, B.WATER);
  }

  // The tiger's pond: still water with a sandy shore
  for (let z = P.z - 6; z <= P.z + 6; z++) for (let x = P.x - 6; x <= P.x + 6; x++) {
    const d = Math.hypot(x - P.x, z - P.z) + (fbm(x / 3, z / 3, seed + 61) - 0.5) * 0.8;
    if (d < P.r) {
      const depth = d < P.r - 1.4 ? 2 : 1;
      for (let y = pondLevel - depth; y < pondLevel; y++) world.rawSet(x, y, z, B.WATER);
      world.rawSet(x, pondLevel - depth - 1, z, B.SAND);
    } else if (d < P.r + 1.1 && world.get(x, pondLevel - 1, z) === B.GRASS) world.rawSet(x, pondLevel - 1, z, B.SAND);
  }

  // Winding caves (worm tunnels) — exploring underground is where the treasure is.
  const nearWater = (x, y, z) => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => world.get(x + a, y + b, z + c) === B.WATER);
  // Flat-floored tunnel slice: floor at `floor`, 3 blocks high, radius r — always walkable for a child.
  const carveSlice = (px, floor, pz, r, h = 3) => {
    for (let y = floor; y < floor + h; y++) for (let z = Math.floor(pz - r); z <= pz + r; z++) for (let x = Math.floor(px - r); x <= px + r; x++) {
      if (y < 2 || !world.inBounds(x, y, z)) continue;
      const rr = y === floor + h - 1 ? r - 0.6 : r;          // rounded ceiling
      if ((x + 0.5 - px) ** 2 + (z + 0.5 - pz) ** 2 >= rr * rr) continue;
      const id = world.get(x, y, z);
      if (id === B.WATER || id === B.AIR || nearWater(x, y, z)) continue;
      world.rawSet(x, y, z, B.AIR);
    }
  };
  const caveStarts = [
    { x: L.spawn.x - 9, z: L.spawn.z - 8, yaw: -2.4 },  // one close to the start, so it's found quickly
    { x: 70, z: 90, yaw: 0.3 }, { x: 30, z: 72, yaw: 2.6 }, { x: 80, z: 62, yaw: 1.2 }, { x: 46, z: 47, yaw: -0.8 }, { x: 62, z: 36, yaw: 2.0 },
  ];
  L.caves = [];
  for (const s of caveStarts) {
    let x = s.x + 0.5, z = s.z + 0.5;
    let floor = heights[s.z * W + s.x];
    let yaw = s.yaw;
    L.caves.push({ x: s.x, y: floor, z: s.z, yaw });
    const len = 60 + rand() * 30;
    for (let i = 0; i < len; i++) {
      const wide = i % 26 === 25 ? 2.6 : 1.6 + Math.sin(i * 0.4) * 0.25;   // the odd bigger room
      carveSlice(x, floor, z, wide, wide > 2 ? 4 : 3);
      x += Math.sin(yaw) * 0.8; z += Math.cos(yaw) * 0.8;
      // entrance ramp first, then gentle ups and downs (max 1 block per step → auto-jump can climb)
      if (i < 14) { if (i % 2 === 1) floor -= 1; }
      else if (rand() < 0.18) floor += floor > 6 && rand() < 0.6 ? -1 : 1;
      // stay under the ground, but never drop more than one block per step (so you can always walk back out)
      if (i >= 14) { const surf = heights[Math.round(z) * W + Math.round(x)] ?? floor; if (floor > surf - 4) floor -= 1; floor = Math.max(4, floor); }
      yaw += (rand() - 0.5) * 0.35;
      if (x < 8 || z < 8 || x > W - 8 || z > D - 8) yaw += Math.PI * 0.5;
    }
    // torches mark the entrance (real cave guides use lights too)
    const fx = Math.round(s.x - Math.cos(s.yaw) * 1.6), fz = Math.round(s.z + Math.sin(s.yaw) * 1.6);
    const gx = Math.round(s.x + Math.cos(s.yaw) * 1.6), gz = Math.round(s.z - Math.sin(s.yaw) * 1.6);
    for (const [tx, tz] of [[fx, fz], [gx, gz]]) {
      const ty = world.surface(tx, tz);
      if (world.get(tx, ty, tz) === B.AIR && isSolid(world.get(tx, ty - 1, tz))) world.rawSet(tx, ty, tz, B.TORCH);
    }
  }

  // Ores in the stone: coal is common, iron less, gold rare and deep (like in real rock layers, roughly)
  const cluster = (id, count, size, maxY) => {
    for (let n = 0; n < count; n++) {
      let x = (rand() * W) | 0, y = 2 + ((rand() * (maxY - 2)) | 0), z = (rand() * D) | 0;
      for (let k = 0; k < size; k++) {
        if (world.get(x, y, z) === B.STONE) world.rawSet(x, y, z, id);
        x += ((rand() * 3) | 0) - 1; y += ((rand() * 3) | 0) - 1; z += ((rand() * 3) | 0) - 1;
      }
    }
  };
  cluster(B.COAL_ORE, 520, 6, 40);
  cluster(B.IRON_ORE, 380, 4, 26);
  cluster(B.GOLD_ORE, 140, 3, 13);
  // Extra ore on cave walls so exploring caves pays off
  for (let y = 2; y < 30; y++) for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
    if (world.get(x, y, z) !== B.STONE) continue;
    if (![[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => world.get(x + a, y + b, z + c) === B.AIR)) continue;
    const r = rand();
    if (r < 0.05) world.rawSet(x, y, z, B.COAL_ORE);
    else if (r < 0.085 && y < 22) world.rawSet(x, y, z, B.IRON_ORE);
    else if (r < 0.095 && y < 12) world.rawSet(x, y, z, B.GOLD_ORE);
  }

  // Clay by the water (real bricks are made from fired clay)
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = heights[z * W + x];
    if (h < SEA - 2 || h > SEA + 1) continue;
    if (fbm(x / 7, z / 7, seed + 44) < 0.58) continue;
    for (let y = h - 2; y < h; y++) if (world.get(x, y, z) === B.SAND) world.rawSet(x, y, z, B.CLAY);
  }

  // Crystal cave: a tunnel from the mountain's foot into a chamber.
  const dirX = L.spawn.x - M.x, dirZ = L.spawn.z - M.z, len = Math.hypot(dirX, dirZ);
  const ux = dirX / len, uz = dirZ / len;
  let ex = M.x + ux * 17, ez = M.z + uz * 17;
  const entranceY = heights[Math.round(ez) * W + Math.round(ex)];
  const chamber = { x: M.x + ux * 4, y: entranceY + 1, z: M.z + uz * 4 };
  const carve = (px, py, pz, r) => {
    for (let y = Math.floor(py - r); y <= py + r; y++) for (let z = Math.floor(pz - r); z <= pz + r; z++) for (let x = Math.floor(px - r); x <= px + r; x++) {
      if ((x + 0.5 - px) ** 2 + ((y + 0.5 - py) * 1.25) ** 2 + (z + 0.5 - pz) ** 2 < r * r && y > 2) {
        const id = world.get(x, y, z);
        if (id !== B.WATER) world.rawSet(x, y, z, B.AIR);
      }
    }
  };
  for (let t = 0; t <= 1; t += 0.03) {
    carve(ex + (chamber.x - ex) * t, entranceY + 1.2 + (chamber.y - entranceY) * t * 0.5, ez + (chamber.z - ez) * t, 2.1);
  }
  carve(chamber.x, chamber.y + 1, chamber.z, 4.6);
  // Crystals grow on the chamber walls.
  for (let y = Math.floor(chamber.y - 3); y <= chamber.y + 6; y++) for (let z = Math.floor(chamber.z - 6); z <= chamber.z + 6; z++) for (let x = Math.floor(chamber.x - 6); x <= chamber.x + 6; x++) {
    if (world.get(x, y, z) !== B.STONE) continue;
    const nearAir = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => world.get(x + a, y + b, z + c) === B.AIR);
    if (nearAir && rand() < 0.3) world.rawSet(x, y, z, B.CRYSTAL);
  }
  // Floor of the tunnel: make it walkable stone.
  L.cave = { x: chamber.x, y: chamber.y, z: chamber.z, entrance: { x: ex, y: entranceY, z: ez } };

  // Trees
  const trees = [];
  const nearSpecial = (x, z) => [L.spawn, L.pad, L.rover].some((p) => Math.hypot(x - p.x, z - p.z) < 7.5)
    || Math.hypot(x - L.pond.x, z - L.pond.z) < 9 || (x > L.ramp.x - 10 && x < L.ramp.x + 13 && z > L.ramp.z - 5 && z < L.ramp.z + 7)
    || L.caves.some((c) => Math.hypot(x - (c.x + Math.sin(c.yaw) * 5), z - (c.z + Math.cos(c.yaw) * 5)) < 7);
  for (let z = 3; z < D - 3; z++) for (let x = 3; x < W - 3; x++) {
    const h = heights[z * W + x];
    if (world.get(x, h - 1, z) !== B.GRASS || world.get(x, h, z) !== B.AIR) continue;
    if (nearSpecial(x, z)) continue;
    const fd = Math.hypot(x - L.forest.x, z - L.forest.z) / L.forest.r;
    const density = fd < 1 ? 0.07 * (1 - fd * 0.6) * (0.6 + fbm(x / 6, z / 6, seed + 3)) : 0.005;
    if (rand() > density) continue;
    if (trees.some((t) => Math.abs(t.x - x) < 4 && Math.abs(t.z - z) < 4)) continue;
    trees.push({ x, z, y: h });
    const th = 4 + ((rand() * 2) | 0);
    for (let y = h; y < h + th; y++) world.rawSet(x, y, z, B.LOG);
    const top = h + th;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy >= 0 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === 1 || rand() < 0.6)) continue;
        if (world.get(x + dx, top + dy, z + dz) === B.AIR) world.rawSet(x + dx, top + dy, z + dz, B.LEAVES);
      }
    }
    if (world.get(x, top + 1, z) === B.AIR) world.rawSet(x, top + 1, z, B.LEAVES);
  }

  // Savanna trees: a thin trunk and a wide, flat crown (like real acacias in Africa)
  L.acacias = [];
  for (let n = 0, tries = 0; n < 6 && tries < 400; tries++) {
    const x = Math.round(S.x + (rand() - 0.5) * S.r * 1.8), z = Math.round(S.z + (rand() - 0.5) * S.r * 1.8);
    const h = world.surface(x, z);
    if (world.get(x, h - 1, z) !== B.SAVANNA || Math.hypot(x - S.x, z - S.z) < 3) continue;
    if (L.acacias.some((t) => Math.hypot(t.x - x, t.z - z) < 6)) continue;
    L.acacias.push({ x, z, y: h }); trees.push({ x, z, y: h }); n++;
    const th = 4 + ((rand() * 2) | 0), lean = rand() < 0.5 ? 1 : -1;
    for (let y = h; y < h + th; y++) world.rawSet(x, y, z, B.LOG);
    world.rawSet(x + lean, h + th - 1, z, B.LOG);
    const top = h + th, tx = x + lean;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const r = Math.hypot(dx, dz);
      if (r < 3.3 && world.get(tx + dx, top, z + dz) === B.AIR) world.rawSet(tx + dx, top, z + dz, B.LEAVES);
      if (r < 1.9 && world.get(tx + dx, top + 1, z + dz) === B.AIR) world.rawSet(tx + dx, top + 1, z + dz, B.LEAVES);
    }
  }

  // Flowers on the meadow
  for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) {
    const h = heights[z * W + x];
    if (world.get(x, h - 1, z) !== B.GRASS || world.get(x, h, z) !== B.AIR) continue;
    if (Math.hypot(x - L.pad.x, z - L.pad.z) < 5 || Math.hypot(x - L.spawn.x, z - L.spawn.z) < 2) continue;
    if (rand() < 0.035 * (0.4 + fbm(x / 10, z / 10, seed + 21))) world.rawSet(x, h, z, rand() < 0.5 ? B.FLOWER_R : B.FLOWER_Y);
  }

  // Launch pad (5x5 metal) at the pad position
  const py = baseLevel - 1;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    world.rawSet(L.pad.x + dx, py, L.pad.z + dz, B.METAL);
    for (let y = py + 1; y < py + 14; y++) world.rawSet(L.pad.x + dx, y, L.pad.z + dz, B.AIR);
  }
  L.pad.y = py; // top surface of the pad is y = py + 1

  // Treasure chests: forest, beach, crystal cave, mountain top
  L.chests = [];
  const placeChest = (id, x, z, y = null) => {
    x = Math.round(x); z = Math.round(z);
    if (y == null) {
      y = world.surface(x, z);
      // don't place on a tree top
      while (y > 0 && [B.LEAVES, B.LOG].includes(world.get(x, y - 1, z))) { x += 1; y = world.surface(x, z); }
    }
    world.rawSet(x, y, z, B.CHEST);
    world.rawSet(x, y + 1, z, B.AIR);
    L.chests.push({ id, x, y, z });
  };
  placeChest('wald', L.forest.x + 2, L.forest.z + 3);
  placeChest('bau', L.kiste.x, L.kiste.z);
  { // beach: walk from island centre toward the south-west until we reach sand
    let x = cx, z = cz;
    for (let i = 0; i < 80; i++) { x -= 0.55; z += 0.75; const t = world.topBlock(x, z); if (t.id === B.SAND && t.y >= SEA) break; }
    placeChest('strand', x, z);
  }
  { // crystal cave: on the chamber floor
    const c = L.cave; let y = Math.floor(c.y) + 3;
    while (y > 1 && !isSolid(world.get(Math.round(c.x), y - 1, Math.round(c.z)))) y--;
    placeChest('hoehle', c.x, c.z, y);
  }
  { // mountain top
    let best = { h: 0, x: M.x, z: M.z };
    for (let z = M.z - 8; z <= M.z + 8; z++) for (let x = M.x - 8; x <= M.x + 8; x++) { const h = world.surface(x, z); if (h > best.h) best = { h, x, z }; }
    placeChest('berg', best.x, best.z);
  }

  // The moon: a round grey platform high above the sea, with craters, a landing pad and a little station
  { const Mo = L.moon;
    for (let z = Mo.z - Mo.r - 1; z <= Mo.z + Mo.r + 1; z++) for (let x = Mo.x - Mo.r - 1; x <= Mo.x + Mo.r + 1; x++) {
      const d = Math.hypot(x - Mo.x, z - Mo.z) + (fbm(x / 3, z / 3, seed + 77) - 0.5) * 1.2;
      if (d > Mo.r) continue;
      const depth = d < Mo.r - 2 ? 3 : 2;
      for (let y = Mo.y - depth; y < Mo.y; y++) world.rawSet(x, y, z, B.MOON);
    }
    for (const [cx, cz, r] of [[Mo.x - 4, Mo.z + 3, 1.6], [Mo.x + 4, Mo.z - 3, 2.2], [Mo.x + 3, Mo.z + 5, 1.2]])   // craters
      for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) < r && world.get(x, Mo.y - 1, z) === B.MOON) world.rawSet(x, Mo.y - 1, z, B.AIR);
    Mo.pad = { x: Mo.x, z: Mo.z + 4 };
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) world.rawSet(Mo.pad.x + dx, Mo.y - 1, Mo.pad.z + dz, B.METAL);
    Mo.station = { x: Mo.x, z: Mo.z - 4 };   // a small metal hut with a glass dome
    const sx = Mo.station.x, sz = Mo.station.z, sy = Mo.y;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 1) continue;   // door towards the pad
      world.rawSet(sx + dx, sy, sz + dz, B.METAL); world.rawSet(sx + dx, sy + 1, sz + dz, dx === 0 || dz === 0 ? B.GLASS : B.METAL);
      world.rawSet(sx + dx, sy + 2, sz + dz, B.GLASS);
    }
    world.rawSet(sx, sy, sz, B.AIR); world.rawSet(sx, sy + 1, sz, B.AIR); world.rawSet(sx, sy + 1, sz + 1, B.AIR);
    world.rawSet(sx, sy + 3, sz, B.CRYSTAL);
  }

  return { heights, trees, layout: L };
}

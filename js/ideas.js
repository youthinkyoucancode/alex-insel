// Build ideas: small "Bauanleitung" models, built layer by layer like toy-brick instructions.
// Each shape returns cells [x, y, z, blockId] in local space: x = right, y = up, z = away from the player.
import { B } from './blocks.js';

const ring = (w, d, y, id, skip = () => false) => {
  const out = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++)
    if ((x === 0 || z === 0 || x === w - 1 || z === d - 1) && !skip(x, z)) out.push([x, y, z, id]);
  return out;
};
const fill = (x0, x1, z0, z1, y, id) => { const out = []; for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push([x, y, z, id]); return out; };

export const SHAPES = {
  haus: () => [
    ...ring(5, 4, 0, B.PLANKS, (x, z) => x === 2 && z === 0),                       // door gap
    ...ring(5, 4, 1, B.PLANKS, (x, z) => x === 2 && z === 0).map((c) =>
      (c[0] === 0 && c[2] === 2) || (c[0] === 4 && c[2] === 2) || (c[0] === 2 && c[2] === 3) ? [c[0], 1, c[2], B.GLASS] : c),   // windows
    ...ring(5, 4, 2, B.PLANKS),
    ...fill(0, 4, 0, 3, 3, B.STUD_RED),                                              // red roof
  ],
  turm: () => [
    ...ring(3, 3, 0, B.STONE, (x, z) => x === 1 && z === 0),
    ...ring(3, 3, 1, B.STONE, (x, z) => x === 1 && z === 0),
    ...ring(3, 3, 2, B.STONE), ...ring(3, 3, 3, B.STONE), ...ring(3, 3, 4, B.STONE),
    [1, 4, 1, B.PLANKS],
    [0, 5, 0, B.STONE], [2, 5, 0, B.STONE], [0, 5, 2, B.STONE], [2, 5, 2, B.STONE],
    [1, 5, 1, B.TORCH],
  ],
  pyramide: () => [...fill(0, 4, 0, 4, 0, B.SAND), ...fill(1, 3, 1, 3, 1, B.SAND), [2, 2, 2, B.GOLD_BLOCK]],
  auto: () => [
    [0, 0, 0, B.STUD_BLACK], [2, 0, 0, B.STUD_BLACK], [0, 0, 3, B.STUD_BLACK], [2, 0, 3, B.STUD_BLACK],
    ...fill(0, 2, 0, 3, 1, B.STUD_RED),
    ...fill(0, 2, 1, 1, 2, B.GLASS), ...fill(0, 2, 2, 2, 2, B.STUD_RED),
    ...fill(0, 2, 1, 2, 3, B.STUD_WHITE),
  ],
  raumschiff: () => [
    [2, 0, 1, B.STUD_BLACK], [2, 0, 5, B.STUD_BLACK],
    ...fill(2, 2, 0, 6, 1, B.STUD_WHITE), [2, 1, 7, B.STUD_RED],
    ...fill(0, 1, 1, 3, 1, B.STUD_BLUE), ...fill(3, 4, 1, 3, 1, B.STUD_BLUE),
    [1, 1, 0, B.CRYSTAL], [3, 1, 0, B.CRYSTAL],
    [2, 2, 4, B.GLASS], [2, 2, 5, B.GLASS], [0, 2, 1, B.STUD_RED], [4, 2, 1, B.STUD_RED],
  ],
  satellit: () => [
    ...fill(2, 2, 0, 2, 1, B.STUD_WHITE), [2, 0, 1, B.METAL], [2, 3, 1, B.METAL], [2, 4, 1, B.STUD_RED],
    ...fill(0, 1, 1, 1, 1, B.STUD_BLUE), ...fill(3, 4, 1, 1, 1, B.STUD_BLUE),
    ...fill(0, 1, 1, 1, 2, B.STUD_BLUE), ...fill(3, 4, 1, 1, 2, B.STUD_BLUE),
    [2, 2, 1, B.GLASS],
  ],
  raumstation: () => [
    ...fill(0, 6, 2, 2, 1, B.METAL), ...fill(3, 3, 0, 4, 1, B.METAL),
    ...fill(0, 0, 0, 4, 2, B.STUD_BLUE), ...fill(6, 6, 0, 4, 2, B.STUD_BLUE),
    ...fill(2, 4, 1, 3, 2, B.STUD_WHITE), [3, 3, 2, B.GLASS], [3, 4, 2, B.STUD_RED],
    [3, 0, 2, B.METAL], [3, 0, 3, B.METAL],
  ],
  brunnen: () => [
    ...ring(5, 5, 0, B.STONE), ...fill(1, 3, 1, 3, 0, B.WATER),
    ...ring(5, 5, 1, B.STUD_BLUE),
    [0, 2, 0, B.LOG], [4, 2, 0, B.LOG], [0, 2, 4, B.LOG], [4, 2, 4, B.LOG],
    ...fill(0, 4, 0, 4, 3, B.PLANKS),
  ],
};

// Turn local cells into Blueprint steps (one step per layer), placed in front of the player.
// facing: player's yaw. Returns { base, steps } with steps = [[dx, dy, dz, id], ...] per layer.
export function placeIdea(id, px, pz, facing) {
  const cells = SHAPES[id]();
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const q = ((Math.round(facing / (Math.PI / 2)) % 4) + 4) % 4;
  const F = [[0, 1], [1, 0], [0, -1], [-1, 0]][q];   // forward (x, z)
  const R = [-F[1], F[0]];                            // right
  const ox = Math.floor(px) + F[0] * 3, oz = Math.floor(pz) + F[1] * 3;
  const half = Math.floor(w / 2);
  const layers = new Map();
  for (const [x, y, z, b] of cells) {
    const dx = R[0] * (x - half) + F[0] * z, dz = R[1] * (x - half) + F[1] * z;
    if (!layers.has(y)) layers.set(y, []);
    layers.get(y).push([dx, y, dz, b]);
  }
  const steps = [...layers.keys()].sort((a, b) => a - b).map((y) => layers.get(y));
  return { base: { x: ox, z: oz }, steps, count: cells.length };
}

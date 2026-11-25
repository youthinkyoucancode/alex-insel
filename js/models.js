// Chunky, original toy-style models built from boxes (hero, animals, rover, rocket).
import * as THREE from 'three';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
export function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}
// Box with its pivot at `pivot` (relative), placed at position p, size s.
export function part(parent, color, s, p, pivotTop = false) {
  const m = new THREE.Mesh(boxGeo, typeof color === 'string' ? mat(color) : color);
  m.scale.set(s[0], s[1], s[2]);
  if (pivotTop) {
    const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]);
    m.position.y = -s[1] / 2; g.add(m); parent.add(g); return g;
  }
  m.position.set(p[0], p[1], p[2]); parent.add(m); return m;
}

// Merge every static box of a model into ONE mesh (vertex colours), keeping only the
// animated parts (legs, arms, wheels…) separate. Cuts draw calls ~5x — important on the tablet.
const bakedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
export function bake(root, keep = [], material = bakedMat) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const keepSet = new Set(keep);
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== root; p = p.parent) if (keepSet.has(p)) return;
    meshes.push(o);
  });
  const pos = [], nor = [], col = [], idx = [];
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  let off = 0;
  for (const mesh of meshes) {
    m.multiplyMatrices(inv, mesh.matrixWorld); nm.getNormalMatrix(m);
    const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, c = mesh.material.color;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    else for (let i = 0; i < P.count; i++) idx.push(i + off);
    off += P.count;
    mesh.parent.remove(mesh);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const merged = new THREE.Mesh(geo, material);
  root.add(merged);
  return merged;
}

export const OUTFITS = [
  { main: '#e8423f', second: '#2f5fd0', name: 'rot' },
  { main: '#2f7de1', second: '#f2c230', name: 'blau' },
  { main: '#34a853', second: '#f28c28', name: 'grün' },
  { main: '#8e5bd8', second: '#3ccfcf', name: 'lila' },
];
// Full hero look (Alex can paint every part in the hero editor)
export const HERO_DEFAULT = { skin: '#f2c9a0', hair: '#6b4428', shirt: '#e8423f', pants: '#2f5fd0', boots: '#3b3f4a', cape: '#2f5fd0', hat: 'none' };
export const heroFromOutfit = (o) => ({ ...HERO_DEFAULT, shirt: o.main, pants: o.second, cape: o.second });
export const HATS = ['none', 'kappe', 'krone', 'helm', 'raumhelm'];

export function makeHero(cfg) {
  if (cfg.main) cfg = heroFromOutfit(cfg);
  const c = { ...HERO_DEFAULT, ...cfg };
  const g = new THREE.Group();
  const legs = [part(g, c.pants, [0.22, 0.75, 0.24], [-0.13, 0.75, 0], true), part(g, c.pants, [0.22, 0.75, 0.24], [0.13, 0.75, 0], true)];
  legs.forEach((l) => part(l, c.boots, [0.24, 0.24, 0.27], [0, -0.63, 0.01]));
  const body = new THREE.Group(); g.add(body);
  part(body, c.shirt, [0.56, 0.6, 0.3], [0, 1.05, 0]);
  part(body, c.pants, [0.58, 0.1, 0.32], [0, 0.78, 0]); // belt
  part(body, '#ffffff', [0.16, 0.16, 0.02], [0, 1.12, 0.16]);
  part(body, c.cape, [0.08, 0.08, 0.02], [0, 1.12, 0.175]);
  const arms = [part(g, c.shirt, [0.18, 0.6, 0.22], [-0.38, 1.33, 0], true), part(g, c.shirt, [0.18, 0.6, 0.22], [0.38, 1.33, 0], true)];
  arms.forEach((a) => part(a, c.skin, [0.16, 0.12, 0.2], [0, -0.62, 0]));
  part(g, c.skin, [0.46, 0.46, 0.44], [0, 1.6, 0]);
  if (c.hat !== 'helm' && c.hat !== 'raumhelm') { part(g, c.hair, [0.5, 0.14, 0.48], [0, 1.85, 0]); part(g, c.hair, [0.5, 0.3, 0.1], [0, 1.72, -0.2]); }
  part(g, '#2b2b35', [0.07, 0.09, 0.02], [-0.1, 1.62, 0.225]);
  part(g, '#2b2b35', [0.07, 0.09, 0.02], [0.1, 1.62, 0.225]);
  part(g, '#d9876f', [0.14, 0.04, 0.02], [0, 1.5, 0.225]);
  if (c.hat === 'kappe') { part(g, c.cape, [0.52, 0.16, 0.5], [0, 1.92, 0]); part(g, c.cape, [0.42, 0.05, 0.22], [0, 1.86, 0.32]); }
  if (c.hat === 'krone') { part(g, '#f2c230', [0.5, 0.12, 0.48], [0, 1.95, 0]); for (const [x, z] of [[-0.19, 0.18], [0.19, 0.18], [-0.19, -0.18], [0.19, -0.18], [0, 0.18]]) part(g, '#f2c230', [0.09, 0.14, 0.09], [x, 2.07, z]); part(g, '#e8423f', [0.07, 0.07, 0.02], [0, 1.95, 0.245]); }
  if (c.hat === 'helm') { part(g, '#aab2bf', [0.52, 0.5, 0.5], [0, 1.68, 0]); part(g, '#2b2b35', [0.36, 0.06, 0.02], [0, 1.64, 0.255]); part(g, c.cape, [0.08, 0.22, 0.4], [0, 2.0, -0.02]); }
  let bubble = null;
  if (c.hat === 'raumhelm') {
    part(g, c.hair, [0.5, 0.14, 0.48], [0, 1.85, 0]);
    bubble = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.62, 0.62), new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35 }));
    bubble.position.set(0, 1.66, 0); g.add(bubble);
    part(g, '#ffffff', [0.6, 0.1, 0.56], [0, 1.33, 0]);
  }
  const cape = part(g, c.cape, [0.52, 0.8, 0.04], [0, 1.36, -0.18], true);
  g.userData = { legs, arms, cape };
  bake(g, [...legs, ...arms, cape, ...(bubble ? [bubble] : [])]);
  legs.forEach((l) => bake(l));
  return g;
}

export function makeAnimal(type) {
  const g = new THREE.Group();
  const legs = [];
  const leg = (color, w, h, x, z, y) => legs.push(part(g, color, [w, h, w], [x, y ?? h, z], true));
  const eyes = (y, z, dx, size = 0.06) => { part(g, '#222', [size, size, 0.02], [-dx, y, z]); part(g, '#222', [size, size, 0.02], [dx, y, z]); };
  let head;
  switch (type) {
    case 'schaf': {
      part(g, '#f4f1ea', [0.8, 0.62, 1.05], [0, 0.78, 0]);
      head = part(g, '#4e403a', [0.38, 0.4, 0.36], [0, 1.0, 0.65]);
      part(g, '#f4f1ea', [0.4, 0.14, 0.3], [0, 1.24, 0.62]);
      eyes(1.06, 0.835, 0.1);
      part(g, '#4e403a', [0.12, 0.08, 0.16], [-0.24, 1.08, 0.62]); part(g, '#4e403a', [0.12, 0.08, 0.16], [0.24, 1.08, 0.62]);
      [[-0.26, 0.32], [0.26, 0.32], [-0.26, -0.32], [0.26, -0.32]].forEach(([x, z]) => leg('#4e403a', 0.16, 0.5, x, z));
      break;
    }
    case 'huhn': {
      part(g, '#fbfbf6', [0.36, 0.34, 0.46], [0, 0.42, 0]);
      head = part(g, '#fbfbf6', [0.24, 0.28, 0.22], [0, 0.7, 0.2]);
      part(g, '#f2a72c', [0.1, 0.06, 0.12], [0, 0.68, 0.36]);
      part(g, '#e5413d', [0.06, 0.1, 0.16], [0, 0.88, 0.2]);
      part(g, '#e5413d', [0.06, 0.08, 0.04], [0, 0.6, 0.32]);
      eyes(0.75, 0.315, 0.07, 0.045);
      part(g, '#ecebe2', [0.06, 0.2, 0.3], [-0.21, 0.44, 0]); part(g, '#ecebe2', [0.06, 0.2, 0.3], [0.21, 0.44, 0]);
      part(g, '#fbfbf6', [0.2, 0.2, 0.08], [0, 0.55, -0.25]);
      leg('#f2a72c', 0.06, 0.25, -0.09, 0); leg('#f2a72c', 0.06, 0.25, 0.09, 0);
      break;
    }
    case 'hund': {
      part(g, '#b77b47', [0.4, 0.4, 0.8], [0, 0.6, 0]);
      head = part(g, '#b77b47', [0.38, 0.36, 0.36], [0, 0.88, 0.5]);
      part(g, '#e8c59c', [0.2, 0.16, 0.18], [0, 0.8, 0.72]);
      part(g, '#2b2523', [0.08, 0.06, 0.04], [0, 0.86, 0.81]);
      part(g, '#7a4e2b', [0.1, 0.2, 0.12], [-0.2, 0.98, 0.45]); part(g, '#7a4e2b', [0.1, 0.2, 0.12], [0.2, 0.98, 0.45]);
      eyes(0.95, 0.685, 0.09);
      const tail = part(g, '#b77b47', [0.08, 0.08, 0.32], [0, 0.78, -0.5]); tail.rotation.x = 0.5; g.userData.tail = tail;
      [[-0.13, 0.27], [0.13, 0.27], [-0.13, -0.27], [0.13, -0.27]].forEach(([x, z]) => leg('#9c6538', 0.12, 0.42, x, z));
      break;
    }
    case 'katze': {
      part(g, '#f0a24a', [0.3, 0.3, 0.66], [0, 0.42, 0]);
      for (let i = -1; i <= 1; i++) part(g, '#d9822f', [0.32, 0.06, 0.08], [0, 0.58, i * 0.18]);
      head = part(g, '#f0a24a', [0.32, 0.28, 0.28], [0, 0.66, 0.4]);
      part(g, '#f0a24a', [0.08, 0.1, 0.06], [-0.1, 0.84, 0.38]); part(g, '#f0a24a', [0.08, 0.1, 0.06], [0.1, 0.84, 0.38]);
      part(g, '#fff4e6', [0.16, 0.1, 0.04], [0, 0.6, 0.55]);
      part(g, '#e88a8a', [0.05, 0.04, 0.02], [0, 0.64, 0.57]);
      eyes(0.7, 0.545, 0.075, 0.05);
      const tail = part(g, '#f0a24a', [0.07, 0.42, 0.07], [0, 0.55, -0.34]); tail.rotation.x = -0.4; g.userData.tail = tail;
      [[-0.09, 0.22], [0.09, 0.22], [-0.09, -0.22], [0.09, -0.22]].forEach(([x, z]) => leg('#e48f3c', 0.09, 0.28, x, z));
      break;
    }
    case 'pferd': {
      part(g, '#8a5a35', [0.55, 0.6, 1.3], [0, 1.25, 0]);
      const neck = part(g, '#8a5a35', [0.32, 0.7, 0.36], [0, 1.65, 0.62]); neck.rotation.x = 0.45;
      head = part(g, '#8a5a35', [0.3, 0.32, 0.6], [0, 1.95, 0.95]);
      part(g, '#3a2618', [0.1, 0.55, 0.42], [0, 1.85, 0.52]).rotation.x = 0.45;
      part(g, '#3a2618', [0.12, 0.5, 0.12], [0, 1.15, -0.72]).rotation.x = 0.35;
      part(g, '#6b4327', [0.08, 0.14, 0.06], [-0.1, 2.15, 0.78]); part(g, '#6b4327', [0.08, 0.14, 0.06], [0.1, 2.15, 0.78]);
      part(g, '#f3e7d8', [0.12, 0.2, 0.02], [0, 2.02, 1.26]);
      eyes(2.02, 1.07, 0.16, 0.06);
      [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]].forEach(([x, z]) => leg('#6b4327', 0.17, 0.95, x, z));
      break;
    }
    // Big cats: chunky toy shapes, real features (only the male lion has a mane; cubs are spotted)
    case 'loewe': case 'loewin': case 'loewenjunges': {
      const fur = '#d4a053', light = '#ecd3a0', dark = '#6e3f1c';
      part(g, fur, [0.62, 0.58, 1.3], [0, 0.95, 0]);
      part(g, light, [0.5, 0.1, 1.0], [0, 0.66, 0.02]);                      // pale belly
      head = part(g, fur, [0.52, 0.5, 0.48], [0, 1.28, 0.78]);
      part(g, light, [0.3, 0.2, 0.18], [0, 1.16, 1.06]);                     // muzzle
      part(g, '#4a2c22', [0.14, 0.08, 0.04], [0, 1.24, 1.15]);               // nose
      eyes(1.36, 1.025, 0.13, 0.07);
      if (type === 'loewe') {
        part(g, '#9a5a28', [0.86, 0.84, 0.36], [0, 1.3, 0.6]);               // big mane
        part(g, '#9a5a28', [0.7, 0.7, 0.3], [0, 1.24, 0.38]);
        part(g, '#9a5a28', [0.62, 0.16, 0.5], [0, 1.6, 0.74]);
        part(g, dark, [0.12, 0.12, 0.06], [-0.25, 1.62, 0.8]); part(g, dark, [0.12, 0.12, 0.06], [0.25, 1.62, 0.8]);
      } else {
        part(g, fur, [0.14, 0.14, 0.08], [-0.2, 1.58, 0.74]); part(g, fur, [0.14, 0.14, 0.08], [0.2, 1.58, 0.74]);
        part(g, dark, [0.08, 0.08, 0.02], [-0.2, 1.58, 0.785]); part(g, dark, [0.08, 0.08, 0.02], [0.2, 1.58, 0.785]);
      }
      if (type === 'loewenjunges') {
        // young lions are born with spots that fade as they grow up
        for (const [x, y, z] of [[-0.32, 1.0, 0.3], [0.32, 1.05, -0.1], [-0.32, 0.9, -0.4], [0.32, 0.88, 0.35], [0, 1.25, -0.2], [0.1, 1.25, 0.35], [-0.15, 1.25, 0.1]])
          part(g, '#b07c3a', [x ? 0.02 : 0.12, 0.12, 0.14], [x, y, z]);
      }
      const tail = part(g, fur, [0.08, 0.08, 0.7], [0, 1.05, -0.95]); tail.rotation.x = -0.6;
      part(g, dark, [0.15, 0.15, 0.16], [0, 0.84, -1.27]);                   // tail tuft
      [[-0.2, 0.42], [0.2, 0.42], [-0.2, -0.45], [0.2, -0.45]].forEach(([x, z]) => leg(fur, 0.2, 0.68, x, z));
      if (type === 'loewenjunges') g.scale.setScalar(0.5);
      break;
    }
    // original creature: a walking red mushroom with white spots (it hisses, then goes "BUMM")
    case 'bummpilz': {
      part(g, '#f3e6cf', [0.5, 0.58, 0.5], [0, 0.53, 0]);                    // stem body
      head = part(g, '#e23b2e', [1.0, 0.42, 1.0], [0, 1.0, 0]);              // cap
      part(g, '#e23b2e', [0.78, 0.16, 0.78], [0, 1.28, 0]);
      for (const [x, y, z, w] of [[-0.28, 1.215, 0.22, 0.2], [0.26, 1.215, -0.24, 0.18], [0.02, 1.365, 0.04, 0.2], [0.3, 1.0, 0.505, 0.16], [-0.34, 0.95, 0.505, 0.14], [-0.505, 1.02, -0.1, 0.16], [0.505, 0.98, 0.15, 0.15]])
        part(g, '#ffffff', [Math.abs(x) > 0.49 ? 0.02 : w, Math.abs(z) > 0.49 || Math.abs(x) > 0.49 ? w : 0.02, Math.abs(z) > 0.49 ? 0.02 : w], [x, y, z]);
      part(g, '#ffffff', [0.15, 0.18, 0.02], [-0.11, 0.62, 0.255]); part(g, '#ffffff', [0.15, 0.18, 0.02], [0.11, 0.62, 0.255]);
      part(g, '#222', [0.07, 0.09, 0.02], [-0.1, 0.6, 0.265]); part(g, '#222', [0.07, 0.09, 0.02], [0.1, 0.6, 0.265]);
      part(g, '#c0504a', [0.12, 0.04, 0.02], [0, 0.45, 0.255]);
      leg('#c9b28f', 0.15, 0.24, -0.12, 0.04); leg('#c9b28f', 0.15, 0.24, 0.12, 0.04);
      break;
    }
    // robot buddy "Piep" (original design): round body, visor face, antenna, one big wheel
    case 'piep': {
      part(g, '#f4f6fa', [0.56, 0.5, 0.5], [0, 0.62, 0]);
      part(g, '#c9d3e0', [0.6, 0.08, 0.54], [0, 0.38, 0]);
      head = part(g, '#f4f6fa', [0.46, 0.34, 0.42], [0, 1.04, 0]);
      part(g, '#1f2a44', [0.38, 0.18, 0.02], [0, 1.05, 0.215]);
      part(g, '#4fe0ff', [0.08, 0.08, 0.02], [-0.09, 1.06, 0.225]); part(g, '#4fe0ff', [0.08, 0.08, 0.02], [0.09, 1.06, 0.225]);
      part(g, '#9aa3b2', [0.04, 0.24, 0.04], [0, 1.32, 0]); part(g, '#e8423f', [0.1, 0.1, 0.1], [0, 1.46, 0]);
      part(g, '#2f7de1', [0.2, 0.2, 0.02], [0, 0.66, 0.255]);
      part(g, '#c9d3e0', [0.1, 0.32, 0.12], [-0.33, 0.66, 0]); part(g, '#c9d3e0', [0.1, 0.32, 0.12], [0.33, 0.66, 0]);
      leg('#3a3f4b', 0.2, 0.3, 0, 0);
      break;
    }
    // stone guardian of the crystal cave (original): big mossy stone body, glowing crystal eyes
    case 'steinwaechter': {
      part(g, '#8f949c', [1.1, 1.0, 0.8], [0, 1.4, 0]);
      part(g, '#6f8f4a', [0.5, 0.12, 0.3], [-0.2, 1.92, 0.2]); part(g, '#6f8f4a', [0.3, 0.3, 0.05], [0.35, 1.2, 0.41]);
      head = part(g, '#9ba0a8', [0.7, 0.55, 0.6], [0, 2.15, 0.05]);
      part(g, '#7cf0ff', [0.14, 0.1, 0.02], [-0.16, 2.2, 0.36]); part(g, '#7cf0ff', [0.14, 0.1, 0.02], [0.16, 2.2, 0.36]);
      part(g, '#a99bff', [0.18, 0.28, 0.18], [0.3, 2.5, -0.05]); part(g, '#a99bff', [0.14, 0.2, 0.14], [-0.25, 2.47, 0.05]);
      part(g, '#80858d', [0.3, 0.95, 0.32], [-0.72, 1.45, 0]); part(g, '#80858d', [0.3, 0.95, 0.32], [0.72, 1.45, 0]);
      [[-0.28, 0], [0.28, 0]].forEach(([x, z]) => leg('#7a7f87', 0.34, 0.9, x, z));
      break;
    }
    // "Klapperknochen" (original): a friendly bony fellow with a round skull, big eyes and a lantern
    case 'klapper': {
      part(g, '#efeadf', [0.1, 0.55, 0.1], [0, 1.05, 0]);
      for (let i = 0; i < 3; i++) part(g, '#efeadf', [0.42 - i * 0.06, 0.06, 0.24], [0, 1.22 - i * 0.14, 0]);
      head = part(g, '#f6f2e8', [0.46, 0.42, 0.42], [0, 1.62, 0]);
      part(g, '#2b2b35', [0.13, 0.15, 0.02], [-0.1, 1.64, 0.215]); part(g, '#2b2b35', [0.13, 0.15, 0.02], [0.1, 1.64, 0.215]);
      part(g, '#ffffff', [0.04, 0.04, 0.02], [-0.08, 1.67, 0.225]); part(g, '#ffffff', [0.04, 0.04, 0.02], [0.12, 1.67, 0.225]);
      part(g, '#2b2b35', [0.2, 0.03, 0.02], [0, 1.49, 0.215]);
      part(g, '#3a5fd0', [0.5, 0.12, 0.46], [0, 1.88, 0]); part(g, '#3a5fd0', [0.3, 0.14, 0.3], [0, 1.99, 0]);   // little woolly hat
      part(g, '#efeadf', [0.07, 0.5, 0.07], [-0.27, 1.12, 0.05]); part(g, '#efeadf', [0.07, 0.5, 0.07], [0.27, 1.12, 0.1]);
      part(g, '#4b3a2a', [0.18, 0.04, 0.18], [0.3, 0.98, 0.2]); part(g, '#ffd36b', [0.14, 0.18, 0.14], [0.3, 0.88, 0.2]); part(g, '#4b3a2a', [0.16, 0.03, 0.16], [0.3, 0.78, 0.2]);
      [[-0.1, 0], [0.1, 0]].forEach(([x, z]) => leg('#efeadf', 0.08, 0.78, x, z));
      break;
    }
    case 'tiger': {
      const fur = '#e8832e', light = '#fbf1e2', stripe = '#2a211d';
      part(g, fur, [0.62, 0.58, 1.5], [0, 0.95, 0]);
      part(g, light, [0.5, 0.1, 1.2], [0, 0.66, 0.02]);
      for (const z of [-0.6, -0.3, 0, 0.3, 0.55]) {                          // stripes over the back and sides
        part(g, stripe, [0.64, 0.08, 0.09], [0, 1.245, z]);
        part(g, stripe, [0.64, 0.3, 0.07], [0, 1.05, z + 0.07]);
      }
      head = part(g, fur, [0.54, 0.5, 0.48], [0, 1.26, 0.88]);
      part(g, light, [0.32, 0.2, 0.18], [0, 1.14, 1.16]);
      part(g, light, [0.12, 0.12, 0.02], [-0.16, 1.4, 1.125]); part(g, light, [0.12, 0.12, 0.02], [0.16, 1.4, 1.125]);
      part(g, '#c4616a', [0.12, 0.07, 0.04], [0, 1.22, 1.25]);
      part(g, stripe, [0.04, 0.16, 0.02], [0, 1.44, 1.125]); part(g, stripe, [0.3, 0.04, 0.02], [0, 1.48, 1.125]);
      part(g, stripe, [0.03, 0.14, 0.42], [-0.28, 1.26, 0.88]); part(g, stripe, [0.03, 0.14, 0.42], [0.28, 1.26, 0.88]);
      eyes(1.34, 1.125, 0.13, 0.07);
      part(g, fur, [0.14, 0.14, 0.08], [-0.2, 1.56, 0.82]); part(g, fur, [0.14, 0.14, 0.08], [0.2, 1.56, 0.82]);
      part(g, '#ffffff', [0.08, 0.08, 0.02], [-0.2, 1.56, 0.78]); part(g, '#ffffff', [0.08, 0.08, 0.02], [0.2, 1.56, 0.78]);
      const tail = part(g, fur, [0.09, 0.09, 0.8], [0, 1.0, -1.05]); tail.rotation.x = -0.5;
      for (const u of [0.05, 0.2]) part(g, stripe, [0.11, 0.11, 0.07], [0, 1.0 - 0.479 * u, -1.05 - 0.878 * u]);
      part(g, stripe, [0.11, 0.11, 0.14], [0, 1.0 - 0.479 * 0.36, -1.05 - 0.878 * 0.36]);
      [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.52], [0.2, -0.52]].forEach(([x, z]) => leg(fur, 0.2, 0.68, x, z));
      break;
    }
  }
  g.userData.legs = legs; g.userData.head = null; g.userData.tail = null;
  g.userData.body = bake(g, legs);
  // level of detail: far away, the four legs are drawn as one merged piece (they stop walking, nobody notices)
  const still = new THREE.Group(); g.add(still);
  legs.forEach((l) => still.add(l.clone(true)));
  bake(still); still.visible = false; g.userData.legsStatic = still;
  return g;
}

export function makeRover() {
  const g = new THREE.Group();
  part(g, '#f4f4f0', [1.3, 0.38, 1.9], [0, 0.72, 0]);
  part(g, '#f28c28', [1.34, 0.12, 1.94], [0, 0.56, 0]);
  part(g, '#30343f', [1.6, 0.06, 1.0], [0, 0.95, -0.2]);   // solar panel frame
  for (let i = -1; i <= 1; i++) part(g, '#3c68c9', [0.48, 0.03, 0.9], [i * 0.52, 0.99, -0.2]);
  const mast = part(g, '#c9ced6', [0.1, 0.7, 0.1], [0.35, 1.25, 0.65]);
  part(g, '#c9ced6', [0.42, 0.2, 0.2], [0.35, 1.65, 0.68]);
  part(g, '#1f2330', [0.12, 0.1, 0.03], [0.26, 1.66, 0.79]); part(g, '#1f2330', [0.12, 0.1, 0.03], [0.44, 1.66, 0.79]);
  part(g, '#c9ced6', [0.04, 0.6, 0.04], [-0.5, 1.25, -0.8]);
  part(g, '#e5413d', [0.1, 0.1, 0.1], [-0.5, 1.58, -0.8]);
  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.24, 12);
  wGeo.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.78, 0.68], [0.78, 0.68], [-0.78, 0], [0.78, 0], [-0.78, -0.68], [0.78, -0.68]]) {
    const w = new THREE.Group(); w.position.set(x, 0.3, z); g.add(w); wheels.push(w);
    w.add(new THREE.Mesh(wGeo, mat('#2b2e36')));
    part(w, '#f2c230', [0.26, 0.12, 0.12], [x > 0 ? 0.03 : -0.03, 0, 0]);
  }
  g.userData.wheels = wheels;
  for (const w of wheels) bake(w);
  bake(g, wheels);
  return g;
}

export function makeRocket() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 3.2, 16), mat('#f6f6f2')); body.position.y = 2.1; g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.77, 0.3, 16), mat('#e5413d')); band.position.y = 1.0; g.add(band);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 16), mat('#e5413d')); nose.position.y = 4.35; g.add(nose);
  const win = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 16), mat('#6cc4ff')); win.rotation.x = Math.PI / 2; win.position.set(0, 2.8, 0.76); g.add(win);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16), mat('#9aa3b2')); rim.position.set(0, 2.8, 0.8); g.add(rim);
  for (let i = 0; i < 4; i++) {
    const fin = part(g, '#e5413d', [0.12, 1.1, 0.7], [0, 0.85, 0]);
    const a = i * Math.PI / 2; fin.position.set(Math.sin(a) * 0.95, 0.85, Math.cos(a) * 0.95); fin.rotation.y = a;
  }
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.5, 12), mat('#4b505c')); nozzle.position.y = 0.3; g.add(nozzle);
  bake(g);
  return g;
}

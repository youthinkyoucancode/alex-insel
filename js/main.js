// Alex' Insel — demo v2. Plain three.js, no build step, everything served from one folder.
import * as THREE from 'three';
import { B, I, BLOCKS, ITEMS, isSolid, isTargetable, isOpaque, isBlockItem, wordOf } from './blocks.js';
import { buildAtlas, blockIcon, itemIcon, crackTextures } from './textures.js';
import { World, SEA } from './world.js';
import { generate } from './worldgen.js';
import { ChunkManager } from './chunks.js';
import { Lighting, CURVE } from './light.js';
import { Player } from './player.js';
import { Controls } from './controls.js';
import { makeHero, makeAnimal, makeRover, makeRocket, OUTFITS, bake, heroFromOutfit, HATS } from './models.js';
import { Animal, Rover, RocketSite, Blueprint, RAMP_STEPS } from './entities.js';
import { HUD, ICONS, wordHTML } from './ui.js';
import { WORDS, LINES, UI, QUESTS, MISSIONS, CHEST_LOOT, RECIPES, IDEAS, HERO_PARTS, HATS_INFO } from './content.js';
import { placeIdea, SHAPES } from './ideas.js';
import { say, isTalking, preloadVoice, sfx, settings as audioSettings, unlockAudio, setSubtitleHandler, stopVoice, startMusic, setMusicMood, setMusicVolume } from './audio.js';
import { tileUV } from './textures.js';

const BOT = location.search.includes('bot');
const SAVE_KEY = 'alex-insel-v4' + (location.search.includes('test') ? '-test' : '') + (BOT ? '-bot' : '');
if (BOT) localStorage.removeItem(SAVE_KEY);
// the 'tiere' goal: visit the lion family (any of them) and the tiger
const CAT_FAMILY = { loewe: 'loewe', loewin: 'loewe', loewenjunges: 'loewe', tiger: 'tiger' };
const catsFound = () => new Set([...state.found].filter((k) => CAT_FAMILY[k]).map((k) => CAT_FAMILY[k]));
const BOOK_ORDER = ['baum', 'holz', 'blaetter', 'bretter', 'gras', 'erde', 'stein', 'sand', 'ton', 'wasser', 'blume', 'schnee',
  'kohle', 'eisenerz', 'eisen', 'metall', 'golderz', 'gold', 'goldblock', 'kristall', 'glas', 'ziegel', 'baustein_rot', 'baustein_blau', 'baustein_gelb', 'baustein_gruen', 'baustein_weiss', 'baustein_schwarz', 'fackel', 'truhe',
  'spitzhacke_holz', 'spitzhacke_stein', 'spitzhacke_eisen', 'wolle', 'ei', 'schaf', 'huhn', 'hund', 'katze', 'pferd', 'loewe', 'loewin', 'loewenjunges', 'tiger', 'safari', 'bummpilz', 'klapper', 'steinwaechter', 'piep', 'mondgestein', 'rover', 'rakete'];
const isTouch = matchMedia('(pointer: coarse)').matches;
const HOTBAR_SIZE = 9;
// Baukasten (free build): every building block, unlimited
const CREATIVE = [B.STUD_RED, B.STUD_BLUE, B.STUD_YELLOW, B.STUD_GREEN, B.STUD_WHITE, B.STUD_BLACK, B.PLANKS, B.BRICK, B.GLASS, B.STONE, B.WOOL, B.GOLD_BLOCK, B.METAL, B.LOG, B.LEAVES, B.SAND, B.DIRT, B.GRASS,
  B.SAVANNA, B.SNOW, B.CRYSTAL, B.CLAY, B.TORCH, B.FLOWER_R, B.FLOWER_Y];

// ---------- persistent state ----------
let save = {};
try { save = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch { save = {}; }
const state = {
  outfit: save.outfit ?? 0,
  found: new Set(save.found || []),
  inv: new Map(save.inv || []),
  hotbar: save.hotbar || Array(HOTBAR_SIZE).fill(0),
  stats: Object.assign({ collected: {}, crafted: {}, events: {}, placed: 0 }, save.stats || {}),
  creative: !!save.creative, creativeBar: save.creativeBar || CREATIVE.slice(0, HOTBAR_SIZE),
  mode: 'mine',
  photos: save.photos || {}, stickers: new Set(save.stickers || []),   // touch: 'mine' = tap breaks blocks, 'build' = tap places the selected block
  quest: save.quest || 0,
  chests: new Set(save.chests || []),
  settings: Object.assign({ music: 0.35, voice: 0.9, sfx: 0.6, calm: false, quality: 1, fps: false, pauseTime: false, boom: true }, save.settings || {}),
  ideasDone: new Set(save.ideasDone || []),
  hero: save.hero || heroFromOutfit(OUTFITS[save.outfit ?? 0]),
  slot: 0, firstPerson: !isTouch, driving: false, watching: 0,
  time: save.time ?? 0.28, lastPhase: 'day',
};
Object.assign(audioSettings, { voice: state.settings.voice, sfx: state.settings.sfx, music: state.settings.music });
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        edits: world.serializeEdits(), found: [...state.found], inv: [...state.inv], hotbar: state.hotbar, stats: state.stats,
        quest: state.quest, chests: [...state.chests], outfit: state.outfit, settings: state.settings, time: state.time,
        creative: state.creative, creativeBar: state.creativeBar, photos: state.photos, stickers: [...state.stickers], ideasDone: [...state.ideasDone], hero: state.hero,
      }));
    } catch (e) { console.warn('save failed', e); }
  }, 700);
}

// ---------- renderer & scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const basePR = 1, maxPR = Math.min(window.devicePixelRatio || 1, 1.5);
let autoScale = 1;
function applyQuality() { renderer.setPixelRatio(basePR * state.settings.quality * autoScale); renderer.setSize(innerWidth, innerHeight, false); }
const perf = { t: 0, n: 0, good: 0 };
function governQuality(dt) {   // sharp first: 1.0 is the minimum, step up to the native screen sharpness when it stays smooth
  perf.t += dt; perf.n++;
  if (perf.t < 3) return;
  const fps = perf.n / perf.t; perf.t = 0; perf.n = 0;
  const top = maxPR / basePR;
  if (fps < 48 && autoScale > 1) { autoScale = Math.max(1, autoScale - 0.17); applyQuality(); perf.good = 0; }
  else if (fps > 57) { if (++perf.good >= 3 && autoScale < top) { autoScale = Math.min(top, autoScale + 0.17); applyQuality(); perf.good = 0; } }
  else perf.good = 0;
}
applyQuality();
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
canvas.addEventListener('webglcontextrestored', () => location.reload());

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 112);
scene.fog = new THREE.Fog(0x8fd3ff, 40, 100);
const hemi = new THREE.HemisphereLight(0xdff3ff, 0x9a8a70, 1.1);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
scene.add(hemi, sun, sun.target);

const atlas = buildAtlas();
// Terrain shader: texture × baked AO × (sky light × daylight  OR  warm torch light, whichever is brighter)
// Plus a soft "headlamp" around the hero, so caves are mysterious but never scary-dark.
const lightU = { uDay: { value: 1 }, uSky: { value: new THREE.Color(1, 1, 1) }, uMin: { value: 0.11 }, uLamp: { value: new THREE.Vector4(0, 0, 0, 0.6) } };
function lit(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, lightU);
    sh.vertexShader = 'attribute vec2 light;\nvarying vec2 vLight;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLight = light;\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uDay;\nuniform vec3 uSky;\nuniform float uMin;\nuniform vec4 uLamp;\nvarying vec2 vLight;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n  float lamp = uLamp.w * clamp(1.0 - distance(vWPos, uLamp.xyz) / 8.0, 0.0, 1.0);\n  vec3 lc = vLight.y > 1.5 ? vec3(1.0) : max(uSky * (vLight.x * uDay), vec3(1.0, 0.8, 0.55) * max(vLight.y, lamp));\n  diffuseColor.rgb *= max(lc, vec3(uMin));');
  };
  return mat;
}
const materials = {
  opaque: lit(new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true })),
  glow: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }),
  cross: lit(new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide })),
  glowCross: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
  trans: lit(new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, transparent: true, depthWrite: false })),
};

// ---------- world ----------
const world = new World();
const gen = generate(world);
const L = gen.layout;
if (save.edits) world.applyEdits(save.edits);
const lighting = new Lighting(world);
lighting.computeAll();
const chunks = new ChunkManager(world, scene, materials, lighting);
chunks.buildAll();

// ---------- icons ----------
const iconCache = {};
const iconOf = (id) => {
  if (!id) return '';
  if (!iconCache[id]) iconCache[id] = id < 64 ? blockIcon(atlas.canvas, id, 96) : itemIcon(id, 96);
  return iconCache[id];
};
let snapR = null;
function snapshot(obj, size = 160, zoom = 2.4) {
  if (!snapR) { snapR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); snapR.setPixelRatio(1); }
  const r = snapR; r.setSize(size, size); r.setClearColor(0x000000, 0); r.clear();
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x998877, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 2.5); s.add(dl);
  s.add(obj);
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.copy(c).add(new THREE.Vector3(0.75, 0.45, 1).normalize().multiplyScalar(Math.max(sz.x, sz.y, sz.z) * zoom)); cam.lookAt(c);
  r.render(s, cam);
  return r.domElement.toDataURL();
}
const modelIcons = {};
for (const t of ['schaf', 'huhn', 'hund', 'katze', 'pferd', 'loewe', 'loewin', 'loewenjunges', 'tiger', 'bummpilz', 'piep', 'steinwaechter', 'klapper']) modelIcons[t] = snapshot(makeAnimal(t));
modelIcons.rover = snapshot(makeRover());
modelIcons.rakete = snapshot(makeRocket());
const texCache = {};
const loader = new THREE.TextureLoader();
const itemTexture = (id) => {
  if (!texCache[id]) { const t = loader.load(iconOf(id)); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; texCache[id] = t; }
  return texCache[id];
};

// ---------- HUD ----------
const hudRoot = document.getElementById('hud');
const hud = new HUD(hudRoot, iconOf, modelIcons);
hud.photoOf = (k) => state.photos[k];
hud.touch = isTouch;
const joyEl = document.createElement('div'); joyEl.id = 'joy'; joyEl.innerHTML = '<div class="knob"></div>'; document.body.append(joyEl);
const controls = new Controls(document.getElementById('touch-layer'), joyEl);
setSubtitleHandler((text, on) => { hud.showSubtitle(text, on); });
document.body.classList.toggle('calm', state.settings.calm);
hud.fps.classList.toggle('hidden', !state.settings.fps);
hud.jumpBtn.classList.toggle('hidden', !isTouch);
hud.setCamera(state.firstPerson);
let modalOpen = false;
function openModal(fn) {
  if (document.pointerLockElement) document.exitPointerLock();
  controls.mining = null; modalOpen = true;
  return fn(() => { modalOpen = false; updateClickHint(); });
}

// ---------- inventory ----------
const inv = {
  count: (id) => state.inv.get(id) || 0,
  bestTool() { return [I.PICK_IRON, I.PICK_STONE, I.PICK_WOOD].find((t) => inv.count(t) > 0) || 0; },
  toolTier() { const t = inv.bestTool(); return t ? ITEMS[t].tool : 0; },
  add(id, n = 1, source = 'pickup') {
    state.inv.set(id, inv.count(id) + n);
    const isTool = ITEMS[id]?.tool;
    if (!isTool && !state.hotbar.includes(id)) {
      const free = state.hotbar.indexOf(0);
      if (free >= 0) {
        state.hotbar[free] = id;
        // empty hand? hold the new thing right away, so right-click/tap just works
        if (!state.hotbar[state.slot] && isBlockItem(id)) state.slot = free;
      }
    }
    if (source === 'pickup') state.stats.collected[id] = (state.stats.collected[id] || 0) + n;
    if (source === 'craft') state.stats.crafted[id] = (state.stats.crafted[id] || 0) + n;
    const i = state.hotbar.indexOf(id); if (i >= 0) hud.bumpSlot(i);
    refreshInv();
    const w = wordOf(id); if (w) discover(w, source !== 'quiet');
  },
  remove(id, n = 1) {
    const c = inv.count(id) - n;
    if (c <= 0) { state.inv.delete(id); const i = state.hotbar.indexOf(id); if (i >= 0) state.hotbar[i] = 0; }
    else state.inv.set(id, c);
    refreshInv();
  },
};
const touchUI = () => isTouch || controls.usedTouch;
const bar = () => (state.creative ? state.creativeBar : state.hotbar);
const countOf = (id) => (state.creative && isBlockItem(id) ? Infinity : inv.count(id));
const mineMode = () => touchUI() && state.mode === 'mine';
// what the hero holds: the pickaxe in chop mode, otherwise the selected block
const heldId = () => (mineMode() ? (state.creative ? 0 : inv.bestTool()) : bar()[state.slot] || 0);
function refreshInv() {
  hud.setHotbar(bar().map((id) => ({ id, count: countOf(id), name: id ? WORDS[wordOf(id)]?.word : '' })), mineMode() ? -1 : state.slot);
  hud.setTool(state.creative ? 0 : inv.bestTool(), true, mineMode());
  const craftable = QUESTS && canCraftSomething();
  hud.setCraftDot(craftable);
  checkQuest();
  persist();
}
function canCraftSomething() { return RECIPES.some((r) => r.in.every(([id, n]) => inv.count(id) >= n)); }

// ---------- entities ----------
const player = new Player(world);
player.pos.set(L.spawn.x + 0.5, world.surface(L.spawn.x, L.spawn.z), L.spawn.z + 0.5);
let hero = makeHero(state.hero);
scene.add(hero);

const freeSpot = (x, z) => {
  for (let i = 0; i < 12; i++) { const t = world.topBlock(x, z).id; if (t !== B.LEAVES && t !== B.LOG && t !== B.WATER) return [x, z]; x += 2; }
  return [x, z];
};
const animals = [];
const addAnimal = (type, x, z, home) => { const [ax, az] = freeSpot(x, z); const a = new Animal(type, world, ax, az, home || { x: ax, z: az }); animals.push(a); scene.add(a.mesh); return a; };
[[66, 84], [68, 87], [64, 88]].forEach(([x, z]) => addAnimal('schaf', x, z, { x: 66, z: 86 }));
[[43, 64], [45, 62]].forEach(([x, z]) => addAnimal('huhn', x, z, { x: 44, z: 63 }).onEgg = (p) => dropItem(I.EGG, p.x, p.y + 0.4, p.z));
addAnimal('hund', 54, 76);
addAnimal('katze', 47, 69);
addAnimal('pferd', 75, 76);
// the lion family lives in the savanna, the tiger by the pond at the forest edge
{ const S = L.savanna; addAnimal('loewe', S.x, S.z, S); addAnimal('loewin', S.x + 3, S.z - 2, S); addAnimal('loewenjunges', S.x + 1, S.z + 3, S); }
addAnimal('tiger', L.pond.x + 4, L.pond.z + 1, L.pond);
// helper: put an animal at an exact spot (caves, the moon)
function placeAt(a, x, y, z) { a.pos.set(x + 0.5, y, z + 0.5); a.home = { x: x + 0.5, z: z + 0.5 }; a.mesh.position.copy(a.pos); }
// Piep the robot waits at the moon station until Alex finds him, then follows him everywhere
const piep = addAnimal('piep', L.moon.station.x, L.moon.station.z + 2);
placeAt(piep, L.moon.station.x, L.moon.y, L.moon.station.z + 2);
if (state.stats.events.robot) { piep.following = true; placeAt(piep, L.spawn.x + 2, world.surface(L.spawn.x + 2, L.spawn.z), L.spawn.z); }
// the stone guardian sleeps in the crystal cave
const golem = (() => {
  const c = L.cave, gx = Math.round(c.x) + 2, gz = Math.round(c.z);
  let gy = Math.floor(c.y) + 3; while (gy > 2 && !isSolid(world.get(gx, gy - 1, gz))) gy--;
  const a = addAnimal('steinwaechter', gx, gz); placeAt(a, gx, gy, gz);
  a.rest = 1e9; a.awake = false; a.giftT = 0; return a;
})();
// night visitors: Klapperknochen with lanterns (they only come out in the dark)
const klappers = [0, 1].map(() => { const a = addAnimal('klapper', L.spawn.x, L.spawn.z); a.gone = Infinity; a.mesh.visible = false; a.night = true; return a; });
// Bumm-Pilze (original creature): waddle up to Alex, hiss, flash and go BUMM — a crater, no damage
const pilze = [[30, 46], [82, 52], [62, 100]].map(([x, z]) => {
  const a = addAnimal('bummpilz', x, z); a.fuse = 0; a.gone = 0; a.spawn = { x: a.pos.x, z: a.pos.z };
  const f = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  f.position.y = 1.05; f.visible = false; a.mesh.add(f); a.flashMesh = f;
  return a;
});
// extra Bumm-Pilze that sneak around at night and in caves
for (let i = 0; i < 3; i++) {
  const a = addAnimal('bummpilz', L.spawn.x, L.spawn.z); a.fuse = 0; a.gone = Infinity; a.night = true; a.mesh.visible = false; a.spawn = { x: a.pos.x, z: a.pos.z };
  const f = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  f.position.y = 1.05; f.visible = false; a.mesh.add(f); a.flashMesh = f; pilze.push(a);
}
const rover = new Rover(world, L.rover.x, L.rover.z);
rover.dir = Math.atan2(L.savanna.x - L.rover.x, L.savanna.z - L.rover.z); rover.update(0);   // parked facing the open meadow and the savanna
scene.add(rover.mesh);
const rocket = new RocketSite(world, scene, L.pad);
rocket.block = B.METAL;
rocket.check();
const ramp = new Blueprint(world, scene, L.ramp, RAMP_STEPS, B.BRICK, 0xffb06a);
ramp.onStepDone = () => sfx.done();
ramp.onComplete = () => { sfx.done(); state.stats.events.rampBuilt = 1; setTimeout(checkQuest, 0); };   // (may fire while the game is still loading a save)
ramp.check(); ramp.showStep();
rover.onLand = (air) => {
  if (!state.driving) return;
  if (stunt && stunt.phase === 'go') { stunt.phase = 'landed'; stunt.t = 0; if (air >= 0.5) { hud.confetti(state.settings.calm); hud.pop('WOW!'); } }
  sfx.land();
  const q = QUESTS[state.quest];
  const nearRamp = ramp.state === 'done' && rover.pos.distanceTo(ramp.center()) < 12;
  if (air >= 0.5 && nearRamp) {
    state.stats.events.jump = (state.stats.events.jump || 0) + 1;
    if (q?.id !== 'sprung') say(null, LINES.jump_big);
    checkQuest();
  } else if (q?.id === 'sprung') say(null, LINES.jump_small);
};

const FUSE = 1.8;
let shakeT = 0;
// Bumm-Pilze stay away from the places Alex needs for his missions
const SAFE = () => [L.spawn, L.rover, L.pad, L.kiste, { x: L.ramp.x + 1, z: L.ramp.z + 1 }];
const inSafeZone = (x, z) => SAFE().some((p) => Math.hypot(x - p.x, z - p.z) < 15);
function startFuse(a) {
  if (a.fuse > 0 || a.gone > 0 || !state.settings.boom || state.driving || inSafeZone(a.pos.x, a.pos.z)) return;
  a.fuse = FUSE; sfx.hiss();
  if (!state.stats.events.boom) say(null, LINES.boom_hiss, { now: true });
}
function explode(a) {
  const cx = a.pos.x, cy = a.pos.y + 0.5, cz = a.pos.z, cells = [];
  const protect = new Set([...rocket.allCells(), ...ramp.allCells()].map((c) => `${c.x},${c.y},${c.z}`));
  // a shallow crater (at most two blocks deep), so nobody gets trapped in it
  for (let y = Math.floor(cy) - 1; y <= cy + 3; y++) for (let z = Math.floor(cz - 3); z <= cz + 3; z++) for (let x = Math.floor(cx - 3); x <= cx + 3; x++) {
    const R = isNight() ? 3.2 : 2.4;
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 * 1.3 + (z + 0.5 - cz) ** 2 > R * R || y <= 1 || !world.inBounds(x, y, z)) continue;
    const id = world.get(x, y, z);
    if (id === B.AIR || id === B.WATER || BLOCKS[id].unbreakable || isPadBlock(x, y, z) || protect.has(`${x},${y},${z}`) || inSafeZone(x, z)) continue;
    cells.push([x, y, z, B.AIR]);
    if (Math.random() < 0.35) burst(x, y, z, id, 2);
  }
  const loot = cells.map(([x, y, z]) => [x, y, z, world.get(x, y, z)]).filter((c) => BLOCKS[c[3]].kind === 'cube').sort(() => Math.random() - 0.5).slice(0, 3);
  chunks.setMany(cells);
  loot.forEach(([x, y, z, id]) => { const d = BLOCKS[id].drop ?? id; if (d) dropItem(d, x + 0.5, y + 0.5, z + 0.5); });
  for (let i = 0; i < (state.settings.calm ? 2 : 5); i++) burst(cx - 0.5, cy, cz - 0.5, [B.STUD_RED, B.STUD_WHITE, B.STUD_YELLOW][i % 3], 8);
  sfx.boom(); shakeT = state.settings.calm ? 0.2 : 0.55; hud.pop('BUMM!');
  const dx = player.pos.x - cx, dz = player.pos.z - cz, d = Math.max(0.5, Math.hypot(dx, dz));
  if (d < 6 && !state.driving) { player.vel.x += dx / d * 7; player.vel.z += dz / d * 7; player.vel.y = 7; }
  if (state.driving && rover.pos.distanceTo(a.pos) < 6) { rover.vy = 6; rover.onGround = false; }
  a.fuse = 0; a.flashMesh.visible = false; a.mesh.visible = false; a.gone = a.night ? Infinity : 35;
  state.stats.events.boom = (state.stats.events.boom || 0) + 1;
  rocket.check(); ramp.check(); persist();
}
// spot for a night visitor: behind Alex, out of sight, on ground (or on a cave floor when underground)
function spawnSpotNear(minD, maxD) {
  for (let i = 0; i < 24; i++) {
    const ang = player.facing + Math.PI + (Math.random() - 0.5) * 2.2, r = minD + Math.random() * (maxD - minD);
    const x = player.pos.x + Math.sin(ang) * r, z = player.pos.z + Math.cos(ang) * r, fx = Math.floor(x), fz = Math.floor(z);
    if (x < 4 || z < 4 || x > 123 || z > 123 || onMoon()) continue;
    let y = null;
    if (underground()) { for (let yy = Math.floor(player.pos.y) + 3; yy >= player.pos.y - 4; yy--) if (isSolid(world.get(fx, yy - 1, fz)) && !isSolid(world.get(fx, yy, fz)) && !isSolid(world.get(fx, yy + 1, fz))) { y = yy; break; } }
    else { y = world.surface(x, z); if (Math.abs(y - player.pos.y) > 4) y = null; }
    if (y == null || y <= SEA || world.get(fx, y - 1, fz) === B.WATER || isSolid(world.get(fx, y, fz))) continue;
    return { x: fx, y, z: fz };
  }
  return null;
}
let nightT = 0, saidNight = false;
function updateNightVisitors(dt) {
  if (!started || state.watching) return;
  nightT -= dt; if (nightT > 0) return; nightT = 6;
  const dark = isNight() || underground();
  const pilzOn = pilze.filter((a) => a.night && a.gone !== Infinity).length;
  if (dark && state.settings.boom && pilzOn < 1 && !inSafeZone(player.pos.x, player.pos.z)) {
    const a = pilze.find((q) => q.night && q.gone === Infinity), sp = a && spawnSpotNear(13, 18);
    if (sp && !inSafeZone(sp.x, sp.z)) { placeAt(a, sp.x, sp.y, sp.z); a.spawn = { x: a.pos.x, z: a.pos.z }; a.gone = 0; a.mesh.visible = true; a.mesh.scale.setScalar(0.1);
      if (!saidNight && isNight()) { saidNight = true; say(null, LINES.pilz_night, { low: true }); } }
  }
  for (const k of klappers) {
    const d = k.pos.distanceTo(player.pos);
    if (k.gone === Infinity && dark && Math.random() < 0.5) { const sp = spawnSpotNear(8, 14); if (sp) { placeAt(k, sp.x, sp.y, sp.z); k.gone = 0; k.mesh.visible = true; } }
    else if (k.gone !== Infinity && (!dark || d > 40)) { k.gone = Infinity; k.mesh.visible = false; burst(k.pos.x - 0.5, k.pos.y + 0.5, k.pos.z - 0.5, B.STUD_WHITE, 4); }
  }
}
function updateCreatures(dt) {
  // the stone guardian wakes up when Alex comes close
  const gd = golem.pos.distanceTo(player.pos);
  if (!golem.awake && gd < 6) {
    golem.awake = true; golem.rest = 0; golem.doReact('roar', player); sfx.land(); shakeT = Math.max(shakeT, 0.3);
    if (!state.found.has('steinwaechter')) { discover('steinwaechter', false); say(null, LINES.golem_wake); }
  }
  if (golem.awake && gd > 14) { golem.awake = false; golem.rest = 1e9; }
  golem.giftT -= dt;
  // Piep: found on the moon
  if (!piep.following && onMoon() && piep.pos.distanceTo(player.pos) < 3.5) {
    piep.following = true; state.stats.events.robot = 1; sfx.beep(); discover('piep', false); say(null, LINES.robot_hello); piep.doReact('hop', player); checkQuest(); persist();
  }
  for (const k of klappers) if (!k.mesh.visible && k.gone === 0 && k.apart > 0) { k.apart -= dt; if (k.apart <= 0) { k.mesh.visible = true; k.doReact('hop', player); sfx.rattle(); } }
  for (const k of klappers) if (k.gone === 0 && !state.found.has('klapper') && k.pos.distanceTo(player.pos) < 8) { discover('klapper', false); say(null, LINES.klapper_found); }
}
let lodT = 0;
function updateLOD(dt) {
  lodT -= dt; if (lodT > 0) return; lodT = 0.25;
  for (const a of animals) {
    const ud = a.mesh.userData; if (!ud.legsStatic) continue;
    const d = a.mesh.position.distanceTo(camera.position), show = d < 52, near = d < 15;
    ud.body.visible = show; ud.legsStatic.visible = show && !near;
    for (const l of ud.legs) l.visible = show && near;
  }
}
function updatePilze(dt) {
  for (const a of pilze) {
    if (a.gone > 0) {
      a.gone -= dt;
      if (a.gone <= 0) { a.pos.set(a.spawn.x, world.surface(a.spawn.x, a.spawn.z), a.spawn.z); a.mesh.visible = true; a.mesh.scale.setScalar(0.1); a.target = null; }
      if (a.gone === Infinity) a.gone = Infinity;
      continue;
    }
    if (a.fuse <= 0 && a.mesh.scale.x < 1) a.mesh.scale.setScalar(Math.min(1, a.mesh.scale.x + dt * 1.5));
    if (!started || !state.settings.boom || state.watching || modalOpen || state.driving) { if (a.fuse > 0) { a.fuse = 0; a.mesh.scale.setScalar(1); a.flashMesh.visible = false; } continue; }
    const d = Math.hypot(player.pos.x - a.pos.x, player.pos.z - a.pos.z), dy = Math.abs(player.pos.y - a.pos.y);
    if (d < 9 && dy < 4 && !state.found.has('bummpilz')) { discover('bummpilz', false); say(null, LINES.boom_found); }
    if (a.fuse > 0) {
      a.fuse -= dt;
      const k = 1 - a.fuse / FUSE;
      a.mesh.scale.setScalar(1 + k * 0.4 + Math.sin(k * 50) * 0.04);
      a.flashMesh.visible = Math.sin(k * k * 70) > 0;
      if (d > 7) { a.fuse = 0; a.mesh.scale.setScalar(1); a.flashMesh.visible = false; }   // ran away: it calms down
      else if (a.fuse <= 0) explode(a);
    } else if (d < 2.6 && dy < 2.5) startFuse(a);   // only when Alex walks right up to it (it hisses first: run away and it calms down)
    else if (isNight() && d < 12 && dy < 3 && !inSafeZone(player.pos.x, player.pos.z)) {   // at night it sneaks after Alex — but never into the mission areas
      a.target = { x: player.pos.x, z: player.pos.z }; a.wait = 1; a.rest = 0; a.speed = 1.8;
    }
    if (a.night && !isNight() && !underground() && d > 12 && a.fuse <= 0) { a.mesh.visible = false; a.gone = Infinity; burst(a.pos.x - 0.5, a.pos.y, a.pos.z - 0.5, B.STUD_RED, 4); }
  }
}

// ---------- dropped items (pop out, then fly to the player) ----------
const drops = [];
function dropItem(id, x, y, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: itemTexture(id), transparent: true, alphaTest: 0.1 }));
  s.scale.setScalar(0.45);
  s.position.set(x, y, z);
  scene.add(s);
  drops.push({ id, s, v: new THREE.Vector3((Math.random() - 0.5) * 1.5, 3.2, (Math.random() - 0.5) * 1.5), age: 0 });
}
function updateDrops(dt) {
  const target = player.pos.clone().add(new THREE.Vector3(0, 1, 0));
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; d.age += dt;
    const p = d.s.position;
    const dist = p.distanceTo(target);
    if (d.age > 0.35 && dist < 5 && !state.driving) {
      p.lerp(target, Math.min(1, dt * (6 + d.age * 4)));
      if (dist < 0.7) {
        scene.remove(d.s); d.s.material.dispose(); drops.splice(i, 1);
        sfx.pickup(); inv.add(d.id, 1, 'pickup');
        continue;
      }
    } else {
      d.v.y -= 14 * dt;
      let ny = p.y + d.v.y * dt;
      if (d.v.y > 0 && world.solidAt(p.x, ny + 0.2, p.z)) { d.v.y = 0; ny = p.y; }
      if (d.v.y <= 0 && world.solidAt(p.x, ny - 0.25, p.z)) { ny = Math.floor(ny - 0.25) + 1.25; d.v.y = 0; d.rest = ny; }
      p.y = ny;
      const nx = p.x + d.v.x * dt; if (!world.solidAt(nx, p.y, p.z)) p.x = nx; else d.v.x = 0;
      const nz = p.z + d.v.z * dt; if (!world.solidAt(p.x, p.y, nz)) p.z = nz; else d.v.z = 0;
      d.v.x *= 1 - dt * 3; d.v.z *= 1 - dt * 3;
      if (d.v.y === 0 && d.rest != null) p.y = d.rest + Math.sin(d.age * 3) * 0.06;
    }
  }
}

// ---------- sky: stars, clouds, sun & moon ----------
const stars = (() => {
  const n = 500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2, v = Math.random() * 0.9 + 0.1, r = 120;
    pos.set([Math.cos(u) * Math.sqrt(1 - v * v) * r, v * r, Math.sin(u) * Math.sqrt(1 - v * v) * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  m.frustumCulled = false; scene.add(m); return m;
})();
const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xfff1b0, fog: false }));
const moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: 0xf2f4ff, fog: false, transparent: true }));
scene.add(sunMesh, moonMesh);
const clouds = new THREE.Group();
{
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, emissive: 0x888888 });
  clouds.userData.mat = cm;
  const r = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    const parts = 3 + Math.floor(r() * 3);
    for (let k = 0; k < parts; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(6 + r() * 8, 1.6, 4 + r() * 6), cm);
      b.position.set(k * 4 - parts * 2, r() * 0.8, (r() - 0.5) * 4); c.add(b);
    }
    c.position.set(r() * 200 - 36, 44 + r() * 6, r() * 200 - 36); clouds.add(c);
  }
  const merged = bake(clouds, [], cm);         // all clouds = one mesh
  for (let i = clouds.children.length - 1; i >= 0; i--) if (clouds.children[i] !== merged) clouds.remove(clouds.children[i]);
  const copy = merged.clone(); copy.position.x = -200; clouds.add(copy);   // a second copy for seamless drifting
  scene.add(clouds);
}
// endless ocean around the island (hides the square edge of the world)
const ocean = (() => {
  const R = 600, y = SEA + 0.86, pos = [], idx = [];
  // a big square with a 128×128 hole where the island's own water is
  const rects = [[-R, -R, R + 128, 0], [-R, 128, R + 128, R + 128], [-R, 0, 0, 128], [128, 0, R + 128, 128]];
  rects.forEach(([x0, z0, x1, z1], k) => { pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0); const b = k * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('light', new THREE.Float32BufferAttribute(Array.from({ length: 16 }, (_, i) => (i % 2 ? 0 : 1)), 2));
  g.setIndex(idx);
  return new THREE.Mesh(g, lit(new THREE.MeshBasicMaterial({ color: 0x6cc2ec, side: THREE.DoubleSide })));
})();
scene.add(ocean);
const caveFog = new THREE.Color('#231f33');
let lightHere = 1;
const SKY = { day: new THREE.Color('#8fd3ff'), set: new THREE.Color('#ffb98a'), night: new THREE.Color('#27306a') };
const skyCol = new THREE.Color(), sunDir = new THREE.Vector3();
function updateSky(dt) {
  if (!state.settings.pauseTime && !state.watching) state.time = (state.time + dt / 420) % 1; // 7-minute day
  const ang = state.time * Math.PI * 2, elev = Math.sin(ang);
  const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.28);
  const dusk = Math.max(0, 1 - Math.abs(elev) / 0.3) * 0.85;
  skyCol.copy(SKY.night).lerp(SKY.day, day).lerp(SKY.set, dusk * (elev > -0.2 ? 1 : 0) * 0.7);
  dayNow = day;
  const space = started && onMoon() ? 1 : 0;   // on the moon the sky is black: there is no air
  if (space) skyCol.set(0x05060f);
  // light where the player stands (head height) drives fog and how bright characters look
  const [ls, lb] = lighting.get(Math.floor(player.pos.x), Math.floor(player.pos.y + 1.4), Math.floor(player.pos.z));
  const skyHere = CURVE[ls], blkHere = CURVE[lb];
  const under = 1 - skyHere;     // 0 outside, ~1 deep in a cave
  scene.background = skyCol; scene.fog.color.copy(skyCol).lerp(caveFog, under * 0.9);
  scene.fog.near = 40 - under * 28; scene.fog.far = 100 - under * 62;
  lightU.uDay.value = 0.3 + day * 0.7;
  lightU.uLamp.value.set(player.pos.x, player.pos.y + 1.4, player.pos.z, 0.62);
  lightU.uSky.value.setRGB(0.78 + day * 0.22, 0.84 + day * 0.16, 1);
  const here = Math.max(skyHere * (0.3 + day * 0.7), blkHere * 0.9, 0.55);
  hemi.intensity = 0.25 + here * 1.0; sun.intensity = 1.4 * day * skyHere;
  lightHere = here;
  setMusicMood(under > 0.6 ? 'cave' : day < 0.3 ? 'night' : 'day');
  sunDir.set(Math.cos(ang) * 0.8, elev, 0.45).normalize();
  sun.position.copy(player.pos).addScaledVector(sunDir, 50); sun.target.position.copy(player.pos);
  sunMesh.position.copy(camera.position).addScaledVector(sunDir, 120); sunMesh.lookAt(camera.position);
  moonMesh.position.copy(camera.position).addScaledVector(sunDir, -120); moonMesh.lookAt(camera.position);
  moonMesh.material.opacity = 1 - day;
  stars.position.copy(camera.position); stars.material.opacity = space ? 1 : Math.max(0, 1 - day * 1.6) * (1 - under);
  if (space) { scene.fog.near = 120; scene.fog.far = 260; }
  clouds.userData.mat.emissiveIntensity = 0.1 + day * 0.9; clouds.userData.mat.opacity = 0.55 + day * 0.37;
  clouds.position.x = (clouds.position.x + dt * 0.8) % 200;
  const phase = day < 0.25 ? 'night' : 'day';
  if (!started) { scene.fog.near = 90; scene.fog.far = 260; }
  if (phase !== state.lastPhase) {
    state.lastPhase = phase;
    if (started) say(phase === 'night' ? 'night' : 'morning', LINES[phase === 'night' ? 'night' : 'morning'], { low: true });
  }
}

// ---------- the moon ----------
const MO = L.moon;
const onMoon = () => Math.hypot(player.pos.x - MO.x, player.pos.z - MO.z) < MO.r + 6 && player.pos.y > MO.y - 6;
let dayNow = 1;
const isNight = () => dayNow < 0.3;
let moonAir = 0;
function updateMoon(dt) {
  player.gravity = onMoon() ? 1 / 6 : 1;   // real Moon: about one sixth of Earth's gravity
  if (!started || state.watching) return;
  if (onMoon()) {
    if (!player.onGround && !player.inWater) moonAir += dt;
    else { if (moonAir > 1.2 && !state.stats.events.moonJump) { state.stats.events.moonJump = 1; say(null, LINES.moon_fact); checkQuest(); } moonAir = 0; }
  }
  // fell off the moon: back onto the landing pad
  if (Math.hypot(player.pos.x - MO.x, player.pos.z - MO.z) < MO.r + 8 && player.pos.y < MO.y - 6 && player.pos.y > SEA + 4 && shuttleAt === 'moon') {
    player.pos.set(MO.pad.x + 2.5, MO.y, MO.pad.z + 0.5); player.vel.set(0, 0, 0);
  }
}

// ---------- particles, highlight, cracks ----------
const tileColor = {};
{
  const ctx = atlas.canvas.getContext('2d');
  for (let id = 1; id < BLOCKS.length; id++) {
    const t = BLOCKS[id].tiles.side, x = (t % 8) * 16, y = Math.floor(t / 8) * 16;
    const d = ctx.getImageData(x + 4, y + 6, 8, 8).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    tileColor[id] = new THREE.Color(`rgb(${(r / Math.max(1, n)) | 0},${(g / Math.max(1, n)) | 0},${(b / Math.max(1, n)) | 0})`);
  }
}
const pGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
const bits = [];
function burst(x, y, z, id, n) {
  n = n ?? (state.settings.calm ? 3 : 7);
  const m = new THREE.MeshBasicMaterial({ color: tileColor[id] || 0xffffff });
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(pGeo, m);
    b.position.set(x + 0.15 + Math.random() * 0.7, y + 0.15 + Math.random() * 0.7, z + 0.15 + Math.random() * 0.7);
    b.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3), life: 0.6 };
    scene.add(b); bits.push(b);
  }
}
function updateBits(dt) {
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i], u = b.userData;
    u.life -= dt; u.v.y -= 14 * dt; b.position.addScaledVector(u.v, dt);
    b.scale.setScalar(Math.max(0.05, u.life / 0.6));
    if (u.life <= 0) { scene.remove(b); bits.splice(i, 1); }
  }
}
const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), new THREE.LineBasicMaterial({ color: 0x1d1b2a, transparent: true, opacity: 0.55 }));
hl.visible = false; scene.add(hl);
const cracks = crackTextures();
const crackMat = new THREE.MeshBasicMaterial({ map: cracks[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), crackMat);
crack.visible = false; scene.add(crack);

// ---------- camera ----------
const cam = { yaw: Math.PI * 0.85, pitch: -0.2, dist: 5.5, cur: 5.5 };
const fwd = new THREE.Vector3();
const camFollow = new THREE.Vector3(L.spawn.x + 0.5, 17.5, L.spawn.z + 0.5);
let titleT = 0;
function updateCamera(dt) {
  if (!started) { // title screen: slowly circle the island
    titleT += dt * 0.05;
    camera.position.set(64 + Math.cos(titleT) * 78, 46, 64 + Math.sin(titleT) * 78);
    camera.lookAt(64, 14, 64);
    hero.visible = true;
    return;
  }
  const look = controls.takeLook();
  const k = controls.locked ? 0.0026 : isTouch ? 0.0065 : 0.0045;
  cam.yaw -= look.dx * k; cam.pitch -= look.dy * k;
  const fp = state.firstPerson && !state.driving;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch, -1.5, fp ? 1.5 : 0.7);
  // Touch only: if the view stays stuck far up/down, ease it toward the horizon
  if (isTouch && performance.now() - controls.lastLookTime > 3000) {
    if (cam.pitch < -0.75) cam.pitch += (-0.75 - cam.pitch) * Math.min(1, dt * 0.8);
    if (cam.pitch > 0.3) cam.pitch += (0.3 - cam.pitch) * Math.min(1, dt * 0.8);
  }
  if (state.driving && stunt && stunt.phase !== 'line') {   // stunt: watch from the side, like on TV
    const rp = rover.pos, eye = new THREE.Vector3(rp.x - 2, rp.y + 3, rp.z - 9);
    camera.position.lerp(eye, Math.min(1, dt * 4)); camera.lookAt(rp.x + 2, rp.y + 1, rp.z); hero.visible = false;
    return;
  }
  if (state.driving && performance.now() - controls.lastLookTime > 500) {   // camera swings in behind the rover
    let d = rover.dir - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d * Math.min(1, dt * 3.5);
    cam.pitch += (-0.3 - cam.pitch) * Math.min(1, dt * 2);
  }
  fwd.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));

  if (travel) {   // watch the shuttle fly
    const sp = shuttle.position, eye = sp.clone().add(new THREE.Vector3(-10, travel.t < 3.6 ? 3 - travel.t * 1.5 : 3, 10));
    camera.position.lerp(eye, Math.min(1, dt * 3)); camera.lookAt(sp.x, sp.y + 2, sp.z); hero.visible = false;
    return;
  }
  if (state.watching && rocket.rocket) {
    const target = rocket.rocket.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    const eye = rocket.center().clone().add(new THREE.Vector3(-9, 4, 9));
    camera.position.lerp(eye, Math.min(1, dt * 2));
    camera.lookAt(target);
    return;
  }
  if (fp) {
    camera.position.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
    camera.lookAt(camera.position.clone().add(fwd));
    hero.visible = false;
    return;
  }
  hero.visible = !state.driving;
  const target = state.driving ? rover.pos.clone().add(new THREE.Vector3(0, 1.6, 0)) : player.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
  // over-the-shoulder: shift right so the crosshair isn't on the hero
  const right = new THREE.Vector3(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw));
  if (!state.driving) target.addScaledVector(right, 0.7);
  let dist = state.driving ? 7.5 : cam.dist;
  const back = fwd.clone().negate();
  const hit = world.raycast(target, back, dist, (id) => isOpaque(id) && (id !== B.LEAVES || state.driving));
  if (hit) dist = Math.max(1.0, hit.t - 0.3);
  cam.cur += (dist - cam.cur) * Math.min(1, dt * (dist < cam.cur ? 20 : 2.5));
  camFollow.lerp(target, Math.min(1, dt * 18));
  camera.position.copy(camFollow).addScaledVector(back, cam.cur);
  camera.lookAt(camFollow.clone().add(fwd));
}
function shakeCamera(dt) {
  if (shakeT <= 0) return;
  shakeT -= dt; const k = Math.max(0, shakeT) * 0.5;
  camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k;
}

// ---------- first-person held item (block, item or hand) with swing & bob ----------
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 10);
const vmHolder = new THREE.Group(); vmScene.add(vmHolder);
const vm = { id: -1, mesh: null, swap: 0, swing: 0, minePhase: 0 };
const FACE_SHADE = [0.82, 0.74, 1, 0.55, 0.9, 0.66];
function viewmodelFor(id) {
  if (!id) { // hand
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.6), new THREE.MeshBasicMaterial({ color: 0xf2c9a0 }));
    m.position.set(0.42, -0.42, -0.55); m.rotation.set(0.2, -0.25, 0.1); return m;
  }
  if (isBlockItem(id) && BLOCKS[id].kind !== 'cross') {
    const def = BLOCKS[id], g = new THREE.BoxGeometry(1, 1, 1), uv = g.attributes.uv;
    const faces = [def.tiles.side, def.tiles.side, def.tiles.top, def.tiles.bottom, def.tiles.side, def.tiles.side];
    const col = [];
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = tileUV(faces[f]);
      for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i)); col.push(FACE_SHADE[f], FACE_SHADE[f], FACE_SHADE[f]); }
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, transparent: def.kind !== 'cube', alphaTest: 0.05 }));
    m.scale.setScalar(0.34); m.position.set(0.48, -0.42, -0.78); m.rotation.set(0.05, 0.75, 0); return m;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: itemTexture(id), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  m.position.set(0.48, -0.36, -0.75); m.rotation.set(0, -0.6, 0.25); return m;
}
function updateViewmodel(dt, light) {
  const id = heldId();
  vmHolder.visible = state.firstPerson && started && !state.driving && !state.watching && !modalOpen;
  if (id !== vm.id) { if (vm.mesh) { vmHolder.remove(vm.mesh); vm.mesh.geometry.dispose(); } vm.mesh = viewmodelFor(id); vm.id = id; vmHolder.add(vm.mesh); vm.base = vm.mesh.position.clone(); vm.baseRot = vm.mesh.rotation.clone(); }
  vm.swap = Math.max(0, vm.swap - dt * 4); vm.swing = Math.max(0, vm.swing - dt * 4);
  if ((controls.mining || autoMine) && mineState.key) vm.minePhase += dt * 9; else vm.minePhase = 0;
  const sw = Math.max(Math.sin(vm.swing * Math.PI), Math.abs(Math.sin(vm.minePhase)));
  const bob = Math.sin(player.walkPhase) * 0.025 * Math.min(1, player.moving);
  const m = vm.mesh;
  m.position.set(vm.base.x - sw * 0.12, vm.base.y + bob - vm.swap * 0.3 - sw * 0.08, vm.base.z - sw * 0.12);
  m.rotation.set(vm.baseRot.x - sw * 0.9, vm.baseRot.y, vm.baseRot.z + sw * 0.3);
  m.material.color.setScalar(Math.min(1, light + 0.1));
}
renderer.autoClear = false;

// ---------- discovery & labels ----------
function discover(key, speak = true) {
  if (!WORDS[key] || state.found.has(key)) return;
  state.found.add(key); persist();
  sfx.card();
  hud.toast(hud.iconFor(key), `${UI.new_card}<br><span style="font-size:28px">${wordHTML(WORDS[key].word)}</span>`);
  if (speak) say(WORDS[key].audio, WORDS[key].word, { low: true });
  if (CAT_FAMILY[key]) checkQuest();
}
// now = the child asked for it (tapped a speaker): say it right away
function speakWord(key, now = false) { const w = WORDS[key]; if (w) say(w.audio, w.word, { now }); }
function speakFact(key, now = false) { const w = WORDS[key]; if (w?.fact) say(w.factAudio, w.fact, { now }); }
function openCard(key, extra) {
  discover(key, false);
  speakWord(key);
  return openModal((onClose) => hud.card(key, { onSpeakWord: () => speakWord(key, true), onSpeakFact: () => speakFact(key, true), extra, onClose }));
}

let nearKey = null, nearTimer = 0;
const LABEL_H = { pferd: 2.6, schaf: 1.6, loewe: 2.0, loewin: 1.8, tiger: 1.8, loewenjunges: 1.0 };
const nearAnchor = new THREE.Vector3();
function scanNearby() {
  const p = player.pos;
  let best = null, bestD = 4.5;
  const consider = (key, pos, d, h) => { if (d < bestD) { bestD = d; best = { key, pos: pos.clone().add(new THREE.Vector3(0, h, 0)) }; } };
  // (the dog always walks with you, so it doesn't hog the word bubble)
  for (const a of animals) if (a.type !== 'hund' && a.mesh.visible) consider(a.type, a.pos, a.pos.distanceTo(p), LABEL_H[a.type] ?? 1.2);
  consider('rover', rover.pos, rover.pos.distanceTo(p), 2.1);
  const rc = rocket.center(); consider('rakete', rc, Math.hypot(rc.x - p.x, rc.z - p.z) - 0.5, 1.5);
  if (!best) {
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    let sb = null, sd = 99;
    for (let y = py - 1; y <= py + 3; y++) for (let z = pz - 3; z <= pz + 3; z++) for (let x = px - 3; x <= px + 3; x++) {
      const id = world.get(x, y, z);
      let key = null;
      if (id === B.LOG) key = 'baum';
      else if (id === B.FLOWER_R || id === B.FLOWER_Y) key = 'blume';
      else if (id === B.CRYSTAL) key = 'kristall';
      else if (id === B.CHEST) key = 'truhe';
      else if (id === B.COAL_ORE) key = 'kohle';
      else if (id === B.IRON_ORE) key = 'eisenerz';
      else if (id === B.GOLD_ORE) key = 'golderz';
      else if (id === B.WATER && world.get(x, y + 1, z) === B.AIR) key = 'wasser';
      if (!key) continue;
      const d = Math.hypot(x + 0.5 - p.x, (y - p.y) * 0.5, z + 0.5 - p.z) + (key === 'wasser' ? 1 : 0);
      if (d < sd) { sd = d; sb = { key, pos: new THREE.Vector3(x + 0.5, y + (key === 'baum' ? 1.6 : 1.3), z + 0.5) }; }
    }
    if (sb && sd < 3.5) best = sb;
  }
  nearKey = best ? best.key : null;
  // walking up to the lions or the tiger counts as finding them (that's the 'tiere' goal)
  let greeted = false;
  for (const a of animals) {
    if (!CAT_FAMILY[a.type] || state.found.has(a.type) || a.pos.distanceTo(p) > 11) continue;
    discover(a.type, false);
    if (!greeted) {
      if (a.type === 'tiger') { sfx.chuff(); a.goSwim(); }
      else {   // the whole family turns round, and the lion roars
        discover('safari', false);
        for (const o of animals) if (CAT_FAMILY[o.type] === 'loewe') o.doReact(o.type === 'loewe' ? 'roar' : o.type === 'loewenjunges' ? 'hop' : 'look', player);
        sfx.roar(false); setTimeout(() => sfx.roar(true), 900);
      }
    }
    greeted = true;
  }
  findPhotoCandidate();
  updateHint();
  if (best) nearAnchor.copy(best.pos);
}
// ---------- photo safari ----------
let photoCand = null, photoReq = false;
const pv = new THREE.Vector3();
function findPhotoCandidate() {   // the animal nearest the middle of the picture
  photoCand = null; let bs = 1e9;
  for (const a of animals) {
    if (!a.mesh.visible) continue;
    const d = a.pos.distanceTo(player.pos); if (d > 18) continue;
    pv.copy(a.pos); pv.y += (LABEL_H[a.type] ?? 1.2) * 0.6; pv.project(camera);
    if (pv.z > 1 || Math.abs(pv.x) > 0.85 || Math.abs(pv.y) > 0.9) continue;
    const q = QUESTS[state.quest];
    const wanted = q?.kind === 'photo' && q.which.includes(a.type) && !state.photos[a.type];
    const score = Math.hypot(pv.x, pv.y) + d * 0.015 - (wanted ? 0.6 : 0);   // an animal still missing from the album wins
    if (score < bs) { bs = score; photoCand = a; }
  }
}
hud.on('photo', () => { photoReq = true; });
function takePhoto() {
  const a = photoCand;
  sfx.shutter(); hud.flash();
  if (!a) { say(null, LINES.photo_none); return; }
  // zoom in on the animal, like a real camera
  const src = renderer.domElement, W = src.width, H = src.height, c = document.createElement('canvas');
  const h = LABEL_H[a.type] ?? 1.2;
  pv.copy(a.pos).project(camera); const bx = (pv.x * 0.5 + 0.5) * W, by = (-pv.y * 0.5 + 0.5) * H;
  pv.copy(a.pos); pv.y += h; pv.project(camera); const ty = (-pv.y * 0.5 + 0.5) * H;
  const ch = Math.max(H * 0.3, Math.min(H, Math.abs(by - ty) * 2.6)), cw = Math.min(W, ch * 4 / 3);
  const cx = Math.max(0, Math.min(W - cw, bx - cw / 2)), cy = Math.max(0, Math.min(H - ch, (by + ty) / 2 - ch / 2));
  c.width = 320; c.height = 240;
  c.getContext('2d').drawImage(src, cx, cy, cw, ch, 0, 0, 320, 240);
  const url = c.toDataURL('image/jpeg', 0.72);
  const first = !state.photos[a.type];
  state.photos[a.type] = url; persist();
  const w = WORDS[a.type];
  hud.polaroid(url, wordHTML(w.word));
  discover(a.type, false);
  if (a.type === 'loewe' || a.type === 'loewin') { a.doReact('roar', player); sfx.roar(false); }
  else if (a.type === 'loewenjunges') { a.doReact('hop', player); sfx.roar(true); }
  else if (a.type === 'tiger') sfx.chuff();
  else if (a.type === 'hund') say(null, LINES.woof);
  else a.doReact('hop', player);
  if (!first) say(null, LINES.photo_again, { low: true });
  else { if (a.type === 'tiger' && a.inWater) say(null, LINES.photo_swim); else speakWord(a.type); speakFact(a.type); }   // queued: never cut off
  checkQuest();
}

const v3 = new THREE.Vector3();
function updateLabel() {
  if (!nearKey || state.watching || state.driving || controls.mining) { hud.hideLabel(); return; }
  v3.copy(nearAnchor).project(camera);
  if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { hud.hideLabel(); return; }
  hud.showLabel(nearKey, (v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight);
}
hud.on('labelTap', () => { if (nearKey) { sfx.tap(); speakWord(nearKey, true); discover(nearKey, false); } });
addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && nearKey && started) { speakWord(nearKey, true); discover(nearKey, false); } });

// ---------- picking ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
// ignoreEnts: mining/outlining look straight through animals (the dog likes to stand close)
function pick(x, y, ignoreEnts = false) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  let ent = null, entDist = Infinity;
  if (!ignoreEnts) {
    const ents = raycaster.intersectObjects([...animals.filter((a) => a.mesh.visible).map((a) => a.mesh), rover.mesh], true);
    if (ents.length) {
      let o = ents[0].object; while (o && !o.userData.entity) o = o.parent;
      if (o) { ent = o.userData.entity; entDist = ents[0].distance; }
    }
  }
  const hit = world.raycast(raycaster.ray.origin, raycaster.ray.direction, 40, isTargetable);
  if (ent && (!hit || entDist < hit.t)) return { ent, entDist, behind: hit };
  return hit ? { block: hit } : null;
}
const reachOK = (x, y, z) => Math.hypot(x + 0.5 - player.pos.x, y + 0.5 - (player.pos.y + 1.4), z + 0.5 - player.pos.z) <= 6;
const buildCell = (h) => (BLOCKS[h.id].kind === 'cross' ? { x: h.x, y: h.y, z: h.z } : { x: h.x + h.nx, y: h.y + h.ny, z: h.z + h.nz });
const isPadBlock = (x, y, z) => y === L.pad.y && Math.abs(x - L.pad.x) <= 2 && Math.abs(z - L.pad.z) <= 2;

// ---------- mining (hold) ----------
const mineState = { key: '', t: 0, need: 1, tick: 0, warned: 0 };
let autoMine = null;   // {x,y,z,id}: block chosen with one tap in chop mode
function updateMining(dt) {
  crack.visible = false;
  const m = controls.mining;
  if ((!m && !autoMine) || !started || modalOpen || state.driving || state.watching) { mineState.key = ''; autoMine = null; return; }
  if (m && idea && idea.bp.state === 'build') {   // holding on the build instructions = build quickly
    pick(m.x, m.y, true);
    const hits = raycaster.intersectObjects(idea.bp.ghosts.children, false);
    if (hits.length) {
      ideaHold -= dt; mineState.key = '';
      if (ideaHold <= 0) { ideaHold = 0.13; const gp = hits[0].object.position; fillIdeaCell(Math.floor(gp.x), Math.floor(gp.y), Math.floor(gp.z)); }
      return;
    }
  }
  let h = null;
  if (m) { autoMine = null; const r = pick(m.x, m.y, true); h = r && r.block; }
  else if (world.get(autoMine.x, autoMine.y, autoMine.z) === autoMine.id) h = autoMine;
  else autoMine = null;
  if (!h) { mineState.key = ''; return; }
  const def = BLOCKS[h.id];
  if (!reachOK(h.x, h.y, h.z) || def.unbreakable || isPadBlock(h.x, h.y, h.z) || h.y <= 0) { mineState.key = ''; if (autoMine) { autoMine = null; sfx.nope(); } return; }
  const key = `${h.x},${h.y},${h.z}`;
  const tier = inv.toolTier();
  if (key !== mineState.key) {
    mineState.key = key; mineState.t = 0; mineState.tick = 0;
    const speed = def.rock ? [1, 2, 3.4, 5][tier] : 1 + tier * 0.25;
    mineState.need = state.creative ? 0.15 : Math.max(0.08, (def.hard ?? 0.5) / speed);
  }
  if ((def.tier || 0) > tier && !state.creative) {
    autoMine = null;
    // not strong enough: gentle hint, no progress
    if (performance.now() - mineState.warned > 4000) { mineState.warned = performance.now(); sfx.nope(); say(null, LINES.need_pick); }
    return;
  }
  mineState.t += dt; mineState.tick -= dt;
  if (mineState.tick <= 0) { mineState.tick = 0.22; sfx.step(1); burst(h.x, h.y, h.z, h.id, state.settings.calm ? 1 : 2); }
  const k = mineState.t / mineState.need;
  crack.visible = true; crack.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5);
  crackMat.map = cracks[Math.min(4, Math.floor(k * 5))];
  armSwing = 1; vm.swing = 1;
  if (k >= 1) { breakBlock(h); mineState.key = ''; autoMine = null; }
}
function breakBlock(h) {
  const def = BLOCKS[h.id];
  world.set(h.x, h.y, h.z, B.AIR);
  const above = world.get(h.x, h.y + 1, h.z);
  if (BLOCKS[above]?.kind === 'cross') { world.set(h.x, h.y + 1, h.z, B.AIR); dropItem(above, h.x + 0.5, h.y + 1.3, h.z + 0.5); }
  if (h.y <= SEA && [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([a, b, c]) => world.get(h.x + a, h.y + b, h.z + c) === B.WATER)) world.set(h.x, h.y, h.z, B.WATER);
  burst(h.x, h.y, h.z, h.id);
  sfx.dig();
  const drop = def.drop ?? h.id;
  if (drop && !state.creative) dropItem(drop, h.x + 0.5, h.y + 0.5, h.z + 0.5);
  rocket.check();
  persist();
}

// ---------- use (tap / right click) ----------
controls.onUse = (x, y, touch) => {
  if (!started || state.watching || modalOpen || state.driving) return;
  let r = pick(x, y);
  // the dog is see-through while you're building
  // the dog is see-through for taps (it likes to stand close, and must never block a chest or a tree)
  if (r?.ent?.type === 'hund' && r.behind) r = { block: r.behind };
  // Tapping a glowing ghost block (rocket or ramp instructions) fills it with the right block
  for (const bp of [rocket, ramp, idea?.bp].filter(Boolean)) {
    if (bp.state !== 'build' || !bp.ghosts.visible) continue;
    const ghostHits = raycaster.intersectObjects(bp.ghosts.children, false);
    if (!ghostHits.length) continue;
    const blk = r?.block || r?.behind;
    const hitIsPart = blk && bp.allCells().some((c) => c.x === blk.x && c.y === blk.y && c.z === blk.z);
    if ((r?.ent && ghostHits[0].distance > r.entDist) || !(hitIsPart || ghostHits[0].distance < (blk?.t ?? Infinity) + 0.01)) continue;
    const gp = ghostHits[0].object.position;
    const gx = Math.floor(gp.x), gy = Math.floor(gp.y), gz = Math.floor(gp.z);
    if (bp === idea?.bp) { fillIdeaCell(gx, gy, gz); return; }
    if (state.creative) { sfx.nope(); say(null, LINES.rocket_own); return; }
    if (inv.count(bp.block) <= 0) { sfx.nope(); say(null, bp === rocket ? LINES.rocket_metal : LINES.ramp_need); return; }
    if (!reachOK(gx, gy, gz) || player.overlapsBlock(gx, gy, gz)) { sfx.nope(); return; }
    world.set(gx, gy, gz, bp.block); inv.remove(bp.block, 1); state.stats.placed = (state.stats.placed || 0) + 1;
    sfx.place(); armSwing = 1; vm.swing = 1; burst(gx, gy, gz, bp === rocket ? B.CRYSTAL : B.BRICK, 5);
    bp.check(); persist();
    return;
  }
  if (!r) return;
  if (r.ent) {
    const e = r.ent;
    if (e.pos.distanceTo(player.pos) > 7) { sfx.nope(); return; }
    sfx.tap();
    if (e === rover) {
      if (e.pos.distanceTo(player.pos) < 6) startDrive(); else sfx.nope();
    } else if (e.type === 'bummpilz') {
      startFuse(e);
    } else if (e.type === 'piep') {
      sfx.beep(); e.doReact('hop', player); if (e.following) openCard('piep'); else say(null, LINES.robot_beep);
    } else if (e.type === 'steinwaechter') {
      e.doReact('roar', player); sfx.land();
      if (e.giftT <= 0) { e.giftT = 45; dropItem(B.CRYSTAL, e.pos.x, e.pos.y + 2, e.pos.z); say(null, LINES.golem_gift); } else openCard('steinwaechter');
    } else if (e.type === 'klapper') {
      e.mesh.visible = false; e.apart = 1.8; sfx.rattle(); say(null, LINES.klapper_tap, { low: true });
      for (let i = 0; i < 3; i++) burst(e.pos.x - 0.5, e.pos.y + 0.6 + i * 0.4, e.pos.z - 0.5, B.STUD_WHITE, 4);
    } else if (e.type === 'schaf' && e.shear()) {
      dropItem(B.WOOL, e.pos.x, e.pos.y + 1, e.pos.z); dropItem(B.WOOL, e.pos.x, e.pos.y + 1, e.pos.z);
    } else {
      if (e.type === 'hund') say(null, LINES.woof);
      if (e.type === 'loewe' || e.type === 'loewin' || e.type === 'loewenjunges') sfx.roar(e.type === 'loewenjunges');
      if (e.type === 'tiger') sfx.chuff();
      openCard(e.type);
    }
    return;
  }
  const h = r.block;
  if (h.id === B.CHEST) { openChest(h); return; }
  // chop mode (touch): one tap = keep hacking this block until it breaks
  if (touch && mineMode()) {
    if (!reachOK(h.x, h.y, h.z)) { sfx.nope(); return; }
    autoMine = { x: h.x, y: h.y, z: h.z, id: h.id }; return;
  }
  const id = bar()[state.slot];
  if (!id || !isBlockItem(id) || countOf(id) <= 0) { sfx.nope(); return; }
  const c = buildCell(h);
  if (!world.inBounds(c.x, c.y, c.z) || !reachOK(c.x, c.y, c.z)) { sfx.nope(); return; }
  const cur = world.get(c.x, c.y, c.z);
  if (isSolid(cur) || (BLOCKS[cur].kind === 'cross' && c.y !== h.y)) { sfx.nope(); return; }
  if (player.overlapsBlock(c.x, c.y, c.z) && isSolid(id)) {
    // jump + place under your feet = build a tower (like in Minecraft)
    const underFeet = c.x === Math.floor(player.pos.x) && c.z === Math.floor(player.pos.z) && !player.onGround && player.pos.y > c.y + 0.2
      && !isSolid(world.get(c.x, c.y + 1, c.z)) && !isSolid(world.get(c.x, c.y + 2, c.z)) && !isSolid(world.get(c.x, c.y + 3, c.z));
    if (!underFeet) { sfx.nope(); return; }
    player.pos.y = c.y + 1; player.vel.y = Math.max(0, player.vel.y);
  }
  if (ramp.isCell(c.x, c.y, c.z) && (id !== B.BRICK || state.creative)) { sfx.nope(); return; }
  if (rocket.isCell(c.x, c.y, c.z) && (id !== B.METAL || state.creative)) { sfx.nope(); say(null, state.creative ? LINES.rocket_own : LINES.rocket_metal); return; }
  if (BLOCKS[id].kind === 'cross' && !isSolid(world.get(c.x, c.y - 1, c.z))) { sfx.nope(); return; }
  world.set(c.x, c.y, c.z, id);
  if (!state.creative) { inv.remove(id, 1); state.stats.placed = (state.stats.placed || 0) + 1; checkQuest(); }
  sfx.place(); armSwing = 1; vm.swing = 1;
  if (rocket.isCell(c.x, c.y, c.z) || id === B.METAL) burst(c.x, c.y, c.z, B.CRYSTAL, 4);
  rocket.check(); ramp.check();
  persist();
};

function openChest(h) {
  const c = L.chests.find((q) => q.x === h.x && q.y === h.y && q.z === h.z);
  if (!c) return;
  if (state.chests.has(c.id)) { say(null, LINES.chest_empty); return; }
  state.chests.add(c.id);
  state.stats.events.chest = (state.stats.events.chest || 0) + 1;
  sfx.done(); say(null, c.id === 'bau' ? LINES.bau_open : LINES.chest_open);
  discover('truhe', false);
  burst(h.x, h.y + 0.6, h.z, B.GOLD_BLOCK, 12);
  CHEST_LOOT[c.id].forEach(([id, n], i) => setTimeout(() => { for (let k = 0; k < n; k++) dropItem(id, h.x + 0.5, h.y + 1.2, h.z + 0.5); }, i * 250));
  checkQuest(); persist();
}

// ---------- build ideas (Bauanleitungen with free blocks) ----------
let idea = null, ideaHold = 0;
function ideaPreview(id) {   // a little 3D picture of the finished model
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(1, 1, 1), mats = {};
  for (const [x, y, z, b] of SHAPES[id]()) {
    if (!mats[b]) mats[b] = new THREE.MeshLambertMaterial({ color: tileColor[b] || 0xffffff, transparent: b === B.GLASS || b === B.WATER, opacity: b === B.GLASS || b === B.WATER ? 0.6 : 1 });
    const m = new THREE.Mesh(geo, mats[b]); m.position.set(x, y, z); g.add(m);
  }
  return snapshot(g, 180);
}
const ideaPics = {};
function openIdeas() {
  sfx.tap();
  for (const i of IDEAS) if (!ideaPics[i.id]) ideaPics[i.id] = ideaPreview(i.id);
  openModal((onClose) => hud.ideas(IDEAS.map((i) => ({ ...i, pic: ideaPics[i.id], done: state.ideasDone.has(i.id) })), (id) => { hud.openModal?.(); startIdea(id); }, onClose));
}
function startIdea(id) {
  if (idea) idea.bp.dispose();
  const info = IDEAS.find((i) => i.id === id);
  const p = placeIdea(id, player.pos.x, player.pos.z, cam.yaw);
  p.base.y = world.surface(p.base.x, p.base.z, player.pos.y + 3);
  const bp = new Blueprint(world, scene, p.base, p.steps, B.STONE);
  bp.tint = (b) => tileColor[b] || 0xffffff;
  bp.onStepDone = () => sfx.done();
  bp.onComplete = () => {
    state.ideasDone.add(id); persist();
    hud.confetti(state.settings.calm); sfx.done(); setTimeout(() => sfx.done(), 300);
    hud.showBanner(UI.ideas, info.name, 3000);
    say(null, LINES.idea_done);
    bp.dispose(); idea = null; showQuest(false);
  };
  idea = { id, bp, name: info.name, total: p.count };
  bp.showStep(); bp.check();
  if (state.driving) stopDrive();
  if (touchUI()) state.mode = 'build';
  say(null, info.say, { tag: 'step', now: true }); say(null, touchUI() ? LINES.idea_start : LINES.idea_start_mouse, { tag: 'idea' });
  updateIdeaGoal(); refreshInv();
}
function fillIdeaCell(x, y, z) {
  const c = idea?.bp.cellAt(x, y, z); if (!c) return;
  if (player.overlapsBlock(x, y, z) && isSolid(c.id)) { sfx.nope(); return; }
  if (Math.hypot(x + 0.5 - player.pos.x, z + 0.5 - player.pos.z) > 11) { sfx.nope(); return; }
  world.set(x, y, z, c.id);
  sfx.place(); armSwing = 1; vm.swing = 1; burst(x, y, z, c.id, 3);
  const bp = idea.bp; bp.check(); if (idea) { bp.showStep(); updateIdeaGoal(); }
  persist();
}
function updateIdeaGoal() {
  if (!idea) return;
  const done = idea.bp.allCells().filter((c) => world.get(c.x, c.y, c.z) === c.id).length;
  hud.setGoal(`<img alt="" src="${ideaPics[idea.id] || ''}" style="width:48px;height:48px">`, idea.name, done / idea.total, UI.ideas);
}
hud.on('ideas', openIdeas);

// ---------- crafting ----------
function openCrafting() {
  sfx.tap();
  openModal((onClose) => hud.crafting(inv, (r) => {
    if (!r.in.every(([id, n]) => inv.count(id) >= n)) return;
    r.in.forEach(([id, n]) => inv.remove(id, n));
    inv.add(r.out[0], r.out[1], 'craft');
    sfx.done();
  }, wordOf, onClose, craftHintIds()));
}
hud.on('craft', openCrafting);

// ---------- hotbar & keys ----------
function selectSlot(i, speak = true) {
  state.slot = (i + HOTBAR_SIZE) % HOTBAR_SIZE; state.mode = 'build'; autoMine = null; refreshInv(); sfx.tap();
  const id = bar()[state.slot]; const w = id && wordOf(id);
  if (w) { hud.showItemName(WORDS[w]?.word); if (speak) say(WORDS[w]?.audio, WORDS[w]?.word, { low: true }); }
  vm.swap = 1;
}
hud.on('select', selectSlot);
hud.on('mineMode', () => { state.mode = 'mine'; refreshInv(); sfx.tap(); vm.swap = 1; showText(LINES.mode_mine); });
function showText(t) { hud.itemName.textContent = t; hud.itemName.classList.remove('show'); void hud.itemName.offsetWidth; hud.itemName.classList.add('show'); }
hud.on('gearTap', () => { sfx.tap(); showText(LINES.gear_hint); });
hud.on('creative', () => {
  state.creative = !state.creative; hud.setCreative(state.creative); autoMine = null;
  if (state.creative) state.mode = 'build';
  sfx.card(); say(null, state.creative ? LINES.build_on : LINES.build_off);
  refreshInv(); vm.swap = 1; persist();
});
hud.on('palette', () => {
  sfx.tap();
  openModal((onClose) => hud.palette(CREATIVE, (id) => {
    state.creativeBar[state.slot] = id; state.mode = 'build'; refreshInv(); hud.openModal?.(); vm.swap = 1;
    const w = wordOf(id); if (w) { discover(w, false); speakWord(w, true); }
  }, onClose));
});
controls.onWheel = (d) => { if (started && !modalOpen) selectSlot(state.slot + d, false); };
function toggleCamera() { state.firstPerson = !state.firstPerson; hud.setCamera(state.firstPerson); sfx.tap(); }
hud.on('camera', toggleCamera);
hud.on('jump', (v) => { controls.jump = v; });
controls.onKey = (code) => {
  if (!started) return;
  if (code.startsWith('Digit')) { const n = +code.slice(5); if (n >= 1 && n <= 9) selectSlot(n - 1); }
  if (code === 'KeyE') { if (modalOpen) hud.openModal?.(); else openCrafting(); }
  if (code === 'Escape' && modalOpen) hud.openModal?.();
  if (code === 'KeyB' && !modalOpen) openBook();
  if (code === 'KeyV') toggleCamera();
};
controls.onLockChange = () => updateClickHint();
function updateClickHint() {
  const show = started && !isTouch && !controls.locked && !controls.lockFailed && !modalOpen && !controls.usedTouch;
  hud.clickHint.classList.toggle('hidden', !show);
  hud.cross.classList.toggle('hidden', !(controls.locked && !state.driving));
}

// ---------- driving ----------
const driveIn = { gas: false, back: false, left: false, right: false };
let stunt = null;
const rampReady = () => ramp.state === 'done';
const canStunt = () => state.driving && rampReady() && !stunt && rover.pos.distanceTo(ramp.center()) < 35;
function startStunt() {
  if (!canStunt()) return;
  stunt = { t: 0, phase: 'line' };
  const f = document.createElement('div'); f.className = 'fade'; document.body.append(f); setTimeout(() => f.remove(), 900);
  setTimeout(() => {   // line up in front of the ramp
    const sx = L.ramp.x - 9 + 0.5, sz = L.ramp.z + 1;
    rover.pos.set(sx, world.surface(sx, sz, rover.pos.y + 3), sz); rover.dir = Math.PI / 2; rover.speed = 0; rover.vy = 0; rover.onGround = true; rover.update(0);
    cam.yaw = rover.dir; stunt.phase = 'count'; stunt.t = 0;
    say(null, LINES.stunt_go, { now: true });
  }, 380);
}
hud.on('stunt', startStunt);
addEventListener('keydown', (e) => { if (e.code === 'KeyT' && started && !modalOpen) startStunt(); });
function stuntInput(dt) {   // returns [throttle, steer] while the stunt runs
  stunt.t += dt;
  if (stunt.phase === 'line') return [0, 0];
  if (stunt.phase === 'count') { if (stunt.t > 2.2) { stunt.phase = 'go'; stunt.t = 0; } return [0, 0]; }
  if (stunt.phase === 'go') { rover.dir = Math.PI / 2; if (stunt.t > 7) stunt = null; return [1, 0]; }
  if (stunt.phase === 'landed') { if (stunt.t > 1.2) stunt = null; return [0, 0]; }
  return [0, 0];
}
hud.on('driveKey', (k, v) => { driveIn[k] = v; });
const nearRover = () => !state.driving && rover.pos.distanceTo(player.pos) < 4.5;
function startDrive() {
  if (state.driving || state.watching) return;
  state.driving = true; hud.setDriving(true); hud.enterBtn.classList.add('hidden'); hud.selName.classList.add('hidden');
  hud.actions.classList.add('hidden'); hud.hotbar.classList.add('hidden');
  Object.keys(driveIn).forEach((k) => { driveIn[k] = false; });
  sfx.tap(); cam.yaw = rover.dir; cam.pitch = -0.3; updateClickHint();
  const first = !state.stats.events.roverIn;
  state.stats.events.roverIn = 1; checkQuest();
  if (!first) say('rover_in', LINES.rover_in);
}
function stopDrive() {
  if (!state.driving) return;
  state.driving = false; hud.setDriving(false); rover.speed = 0; refreshInv();
  hud.actions.classList.remove('hidden'); hud.hotbar.classList.remove('hidden');
  const px = rover.pos.x + Math.cos(rover.dir) * 1.6, pz = rover.pos.z - Math.sin(rover.dir) * 1.6;
  player.pos.set(px, world.surface(px, pz, rover.pos.y + 2), pz); player.vel.set(0, 0, 0); updateClickHint();
}
hud.on('exitDrive', stopDrive);
hud.on('enter', () => (nearShuttle() ? startTravel() : startDrive()));

// ---------- home: one tap back to the start, so nobody is ever stuck ----------
function goHome() {
  if (state.driving) stopDrive();
  if (travel) return;
  if (shuttleAt === 'moon') placeShuttle('pad');   // the rocket comes home too
  if (Math.hypot(rover.pos.x - L.rover.x, rover.pos.z - L.rover.z) > 6) {   // and the rover, wherever it got stuck
    rover.pos.set(L.rover.x + 0.5, world.surface(L.rover.x, L.rover.z), L.rover.z + 0.5); rover.dir = Math.atan2(L.savanna.x - L.rover.x, L.savanna.z - L.rover.z); rover.speed = 0; rover.update(0);
  }
  const fade = document.createElement('div'); fade.className = 'fade'; document.body.append(fade);
  sfx.done();
  setTimeout(() => {
    player.pos.set(L.spawn.x + 0.5, world.surface(L.spawn.x, L.spawn.z), L.spawn.z + 0.5); player.vel.set(0, 0, 0);
    cam.cur = cam.dist; camFollow.copy(player.pos);
    say(null, LINES.home);
  }, 350);
  setTimeout(() => fade.remove(), 900);
}
hud.on('home', goHome);
addEventListener('keydown', (e) => { if (e.code === 'KeyH' && started && !modalOpen) goHome(); });
addEventListener('keydown', (e) => {
  if (state.driving && (e.code === 'KeyF' || e.code === 'Escape')) stopDrive();
  else if (e.code === 'KeyF' && started && !modalOpen && nearRover()) startDrive();
  if (e.code === 'KeyP' && started && !modalOpen) photoReq = true;
});

// ---------- the shuttle: after the first launch the rocket lands again, and Alex can ride it ----------
const shuttle = makeRocket(); shuttle.visible = false; scene.add(shuttle);
let shuttleAt = null, travel = null;
const earthPad = () => new THREE.Vector3(L.pad.x + 0.5, L.pad.y + 1, L.pad.z + 0.5);
const moonPad = () => new THREE.Vector3(MO.pad.x + 0.5, MO.y, MO.pad.z + 0.5);
function placeShuttle(where) { shuttleAt = where; shuttle.position.copy(where === 'moon' ? moonPad() : earthPad()); shuttle.visible = true; }
const nearShuttle = () => shuttleAt && !travel && !state.driving && Math.hypot(shuttle.position.x - player.pos.x, shuttle.position.z - player.pos.z) < 4 && Math.abs(shuttle.position.y - player.pos.y) < 3;
function startTravel() {
  if (!nearShuttle()) return;
  const toMoon = shuttleAt === 'pad';
  travel = { t: 0, toMoon, from: shuttle.position.clone(), to: toMoon ? moonPad() : earthPad(), moved: false, puff: 0 };
  state.watching = 2; hudRoot.classList.add('cinematic'); sfx.tap();
  say(null, toMoon ? LINES.to_moon : LINES.to_home, { now: true });
}
function updateTravel(dt) {
  if (!travel) return;
  const T = travel; T.t += dt;
  if (T.t < 3.6) {   // lift-off
    const k = Math.max(0, T.t - 1.4);
    shuttle.position.set(T.from.x + (k === 0 && !state.settings.calm ? (Math.random() - 0.5) * 0.06 : 0), T.from.y + 2.6 * k * k, T.from.z);
    if (T.t > 1.2 && !T.roared) { T.roared = true; sfx.rocket(); }
    T.puff -= dt; if (T.puff <= 0) { T.puff = state.settings.calm ? 0.15 : 0.05; burst(shuttle.position.x - 0.5, shuttle.position.y - 0.5, shuttle.position.z - 0.5, B.GOLD_BLOCK, 3); }
    if (T.t > 3.2 && !T.fade) { T.fade = true; const f = document.createElement('div'); f.className = 'fade'; document.body.append(f); setTimeout(() => f.remove(), 900); }
  } else {
    if (!T.moved) {   // arrive: Alex (and his buddies) are next to the landing pad
      T.moved = true;
      const to = T.to; player.pos.set(to.x + 2.5, to.y, to.z); player.vel.set(0, 0, 0);
      for (const b of animals) if (b.follow && b.following) b.pos.set(to.x + 2.5 + b.follow, to.y, to.z - 1.5);
      cam.yaw = Math.atan2(to.x - player.pos.x, to.z - player.pos.z); camFollow.copy(player.pos);
    }
    const k = Math.min(1, (T.t - 3.6) / 2.6), e = 1 - (1 - k) * (1 - k);
    shuttle.position.set(T.to.x, T.to.y + 16 * (1 - e), T.to.z);
    T.puff -= dt; if (T.puff <= 0 && k < 1) { T.puff = state.settings.calm ? 0.2 : 0.08; burst(shuttle.position.x - 0.5, shuttle.position.y - 0.5, shuttle.position.z - 0.5, B.GOLD_BLOCK, 2); }
    if (k >= 1) {
      state.watching = 0; hudRoot.classList.remove('cinematic');
      shuttleAt = T.toMoon ? 'moon' : 'pad'; travel = null; sfx.land();
      if (T.toMoon) { state.stats.events.moonLanded = 1; say(null, LINES.moon_sky, { low: true }); }
      else state.stats.events.backHome = state.stats.events.robot ? 1 : 0;
      checkQuest(); persist();
    }
  }
}
addEventListener('keydown', (e) => { if (e.code === 'KeyF' && started && !modalOpen && nearShuttle()) startTravel(); });

// ---------- rocket ----------
rocket.onStepDone = () => sfx.done();
rocket.onComplete = () => {
  sfx.done(); say('rocket_done', LINES.rocket_done);
  state.stats.events.rocketBuilt = 1; checkQuest();
  hud.launchWrap.classList.remove('hidden');
};
rocket.onLaunchDone = () => {
  state.watching = 0; hudRoot.classList.remove("cinematic");
  rocket.state = 'done'; rocket.ghosts.clear(); placeShuttle('pad');   // the rocket comes back down: now Alex can ride it
  state.stats.events.rocketLaunched = 1; checkQuest();
  discover('rakete', false);
};
if (rocket.state === 'ready') hud.launchWrap.classList.remove('hidden');
if (state.stats.events.rocketLaunched) { rocket.state = 'done'; rocket.ghosts.clear(); placeShuttle('pad'); }
hud.on('launch', () => {
  if (rocket.state !== 'ready') return;
  hud.launchWrap.classList.add('hidden');
  say('countdown', LINES.countdown);
  state.watching = 1; hudRoot.classList.add("cinematic");
  setTimeout(() => { sfx.rocket(); rocket.launch(state.settings.calm); }, 2600);
});

// ---------- missions: one clear step at a time, spoken aloud, with a light beam to the target ----------
function questValue(q) {
  if (q.kind === 'collect') return state.stats.collected[q.item] || 0;
  if (q.kind === 'craft') return state.stats.crafted[q.item] || 0;
  if (q.kind === 'place') return state.stats.placed || 0;
  if (q.kind === 'cats') return catsFound().has(q.which) ? 1 : 0;
  if (q.kind === 'photo') return q.which.filter((k) => state.photos[k]).length;
  if (q.kind === 'chests') return q.which.filter((k) => state.chests.has(k)).length;
  return state.stats.events[q.event] || 0;
}
const imgIcon = (src, px = 44) => `<img alt="" src="${src}" style="width:${px}px;height:${px}px;image-rendering:pixelated">`;
function questIcon(q) {
  if (q.item) return imgIcon(iconOf(q.item), 40);
  if (q.kind === 'place') return imgIcon(iconOf(B.PLANKS), 40);
  if (q.kind === 'cats') return imgIcon(modelIcons[q.which]);
  if (q.kind === 'photo') return ICONS.camera;
  if (q.kind === 'chests') return imgIcon(iconOf(B.CHEST), 40);
  if (q.event === 'rampBuilt') return imgIcon(iconOf(B.BRICK), 40);
  if (q.event === 'jump') return imgIcon(modelIcons.rover);
  if (q.event === 'roverIn') return imgIcon(modelIcons.rover);
  if (q.event === 'chest') return imgIcon(iconOf(B.CHEST), 40);
  return ICONS.rocket;
}
const stepSay = (q) => (!touchUI() && q.sayMouse) || q.say || q.text;
const questHead = (q) => `${UI.mission_n} ${q.mission + 1} · ${MISSIONS[q.mission].title}`;
function showQuest(speak) {
  if (idea) { updateIdeaGoal(); return; }
  const q = QUESTS[state.quest];
  if (!q) { hud.setGoal(ICONS.star, UI.free, null, ''); updateHint(); return; }
  hud.setGoal(questIcon(q), q.text, q.n > 1 ? Math.min(1, questValue(q) / q.n) : null, questHead(q));
  updateHint();
  if (speak) say(null, stepSay(q), { tag: 'step' });
}
let introTimer = 0;
// playtest log (only sent when the dev server's probe is loaded; does nothing in the real game)
const probe = (type, data) => window.__probeSend?.(type, data);
{ const nope = sfx.nope; sfx.nope = () => { probe('nope', { step: QUESTS[state.quest]?.id, mode: state.mode, driving: state.driving }); nope(); }; }
// stuck helper: no progress on a step for a while -> repeat the instruction and wiggle the goal card
const stuck = { step: -1, value: -1, t: 0, n: 0 };
function updateStuck(dt) {
  const q = QUESTS[state.quest];
  if (!started || !q || idea || modalOpen || state.watching || state.creative) return;
  const val = questValue(q);
  if (stuck.step !== state.quest || stuck.value !== val) { stuck.step = state.quest; stuck.value = val; stuck.t = 0; stuck.n = 0; return; }
  if (isTalking()) return;
  stuck.t += dt;
  if (stuck.t > (stuck.n === 0 ? 45 : 60)) {
    stuck.t = 0; stuck.n++;
    hud.goalDone(); sfx.card();
    say(null, stepSay(q), { tag: 'step' });
    probe('stuck', { step: q.id, reminders: stuck.n });
  }
}
let stepStart = performance.now();
function introStep() {
  const q = QUESTS[state.quest];
  stepStart = performance.now(); probe('step', { step: q?.id || 'free', mission: q ? q.mission + 1 : null });
  if (q && q.first && started) { hud.showBanner(`${UI.mission_n} ${q.mission + 1}`, MISSIONS[q.mission].title); sfx.card(); }
  if (!q && started) { say(null, LINES.free_ideas, { tag: 'step' }); hud.setGoal(ICONS.star, UI.free, null, ''); updateHint(); return; }
  showQuest(started);
}
function checkQuest() {
  let q = QUESTS[state.quest];
  if (!q) { updateHint(); return; }
  hud.setGoal(questIcon(q), q.text, q.n > 1 ? Math.min(1, questValue(q) / q.n) : null, questHead(q));
  let advanced = false, finished = -1;
  // skip ahead over steps that were already reached out of order
  while (q && questValue(q) >= q.n) { probe('stepDone', { step: q.id, seconds: Math.round((performance.now() - stepStart) / 1000) }); if (q.last) finished = q.mission; state.quest++; q = QUESTS[state.quest]; advanced = true; }
  updateHint();
  if (!advanced) return;
  persist();
  hud.goalDone(); sfx.done();
  clearTimeout(introTimer);
  if (finished >= 0 && started) {
    state.stickers.add(MISSIONS[finished].id); persist();
    setTimeout(() => {
      const m = MISSIONS[finished];
      hud.showBanner(`${LINES.mission_done} ${LINES.sticker}`, m.sticker.name, 4200, stickerIcon(m)); hud.confetti(state.settings.calm);
      sfx.done(); setTimeout(() => sfx.done(), 350);
      say(null, MISSIONS[finished].done);
    }, 500);
    introTimer = setTimeout(introStep, 6500);
  } else introTimer = setTimeout(introStep, 900);
}
hud.on('goalSpeak', () => { const q = QUESTS[state.quest]; say(null, q ? stepSay(q) : LINES.free, { now: true }); });

// which button glows: the workbench when the next craft is possible, the planks/metal slot, the start button
function canMake(outIds) { return RECIPES.some((r) => outIds.includes(r.out[0]) && r.in.every(([id, n]) => inv.count(id) >= n)); }
function craftHintIds() {
  const q = QUESTS[state.quest]; if (!q || !q.item) return [];
  if (q.item === B.METAL) return [I.IRON, B.METAL];
  return [q.item];
}
const stickerIcon = (m) => (typeof m.sticker.icon === 'string' ? modelIcons[m.sticker.icon] : iconOf(m.sticker.icon));
function updateHint() {
  const q = QUESTS[state.quest]; let h = null;
  if (!q && !idea && started && state.ideasDone.size === 0) h = 'ideas';
  if (q && !state.creative && started) {
    if (q.hl === 'enter' && (nearRover() || nearShuttle())) h = 'enter';
    if (q.hl === 'gas' && state.driving && Math.abs(rover.speed) < 0.6) h = 'gas';
    if (q.hl === 'exit' && state.driving) h = 'exit';
    if (q.hl === 'stunt') h = canStunt() ? 'stunt' : nearRover() ? 'enter' : null;
    if (q.hl === 'photo' && photoCand && q.which.includes(photoCand.type) && !state.photos[photoCand.type]) h = 'photo';
    if (q.hl === 'bag' && canMake(craftHintIds())) h = 'bag';
    if (q.hl === 'planks' || q.hl === 'metal') {
      const id = q.hl === 'planks' ? B.PLANKS : B.METAL, i = state.hotbar.indexOf(id);
      const near = q.hl === 'planks' || rocket.center().distanceTo(player.pos) < 12;
      if (i >= 0 && near && (mineMode() || state.slot !== i)) h = i;
    }
    if (q.hl === 'launch' && rocket.state === 'ready') h = 'launch';
  }
  hud.setHint(h);
}

// the target of the light beam
// really underground = no sky above (a crater is open to the sky, so it doesn't count)
const underground = () => lighting.get(Math.floor(player.pos.x), Math.floor(player.pos.y + 1.4), Math.floor(player.pos.z))[0] < 7 && player.pos.y < world.surface(player.pos.x, player.pos.z) - 2.5;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
function nearest(list, f) { let best = null, bd = 1e9; for (const o of list) { const p = f(o); if (!p) continue; const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z); if (d < bd) { bd = d; best = p; } } return best; }
const nearestTree = () => nearest(gen.trees, (t) => (world.get(t.x, t.y, t.z) === B.LOG ? v(t.x + 0.5, t.y + 0.5, t.z + 0.5) : null));
const nearestCave = () => nearest(L.caves, (c) => v(c.x + 0.5, c.y + 0.5, c.z + 0.5));
const oreCache = { t: 0, id: 0, p: null };
function nearestOre(id) {   // nearest visible block of this kind (touches air) around the player, re-scanned once a second
  const now = performance.now();
  if (oreCache.id === id && now - oreCache.t < 1000 && (!oreCache.p || world.get(Math.floor(oreCache.p.x), Math.floor(oreCache.p.y), Math.floor(oreCache.p.z)) === id)) return oreCache.p;
  oreCache.t = now; oreCache.id = id; oreCache.p = null;
  const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
  let bd = 1e9;
  for (let y = py - 5; y <= py + 6; y++) for (let z = pz - 12; z <= pz + 12; z++) for (let x = px - 12; x <= px + 12; x++) {
    if (world.get(x, y, z) !== id) continue;
    if (![[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => world.get(x + a, y + b, z + c) === B.AIR)) continue;
    const d = Math.hypot(x - px, (y - py) * 1.5, z - pz);
    if (d < bd) { bd = d; oreCache.p = v(x + 0.5, y + 0.5, z + 0.5); }
  }
  return oreCache.p;
}
const oreTarget = (id) => (underground() ? nearestOre(id) || nearestCave() : nearestCave());
function questTarget() {
  if (idea) return idea.bp.center().distanceTo(player.pos) > 7 ? idea.bp.center().add(v(0, 1, 0)) : null;
  const q = QUESTS[state.quest]; if (!q || state.creative) return null;
  switch (q.target) {
    case 'tree': return nearestTree();
    case 'treeIfNeeded': return inv.count(B.PLANKS) < 5 && !canMake([B.PLANKS]) ? nearestTree() : null;
    case 'rover': return state.driving ? null : rover.pos.clone().add(v(0, 1.2, 0));
    case 'lionPhoto': case 'tigerPhoto': {
      const want = q.which.filter((k) => !state.photos[k]);
      const a = animals.filter((e) => want.includes(e.type)).sort((x, y) => x.pos.distanceTo(player.pos) - y.pos.distanceTo(player.pos))[0];
      return a ? a.pos.clone().add(v(0, (LABEL_H[a.type] ?? 1.2) + 0.6, 0)) : null;
    }
    case 'kiste': { const c = L.chests.find((k) => k.id === 'bau'); return state.chests.has('bau') ? null : v(c.x + 0.5, c.y + 0.5, c.z + 0.5); }
    case 'ramp': return inv.count(B.BRICK) > 0 || ramp.state !== 'build' ? ramp.center() : nearest(L.chests, (c) => (c.id === 'bau' ? v(c.x + 0.5, c.y + 0.5, c.z + 0.5) : null));
    case 'jump': return state.driving ? ramp.center().add(v(0, 2.5, 0)) : rover.pos.clone().add(v(0, 1.2, 0));
    case 'crystal': {
      const c = L.chests.find((k) => k.id === 'hoehle'), e = L.cave.entrance;
      return Math.hypot(c.x - player.pos.x, c.z - player.pos.z) > 13 ? v(e.x, e.y + 0.5, e.z) : v(c.x + 0.5, c.y + 0.5, c.z + 0.5);
    }
    case 'shuttle': return shuttleAt ? shuttle.position.clone().add(v(0, 4.5, 0)) : null;
    case 'robot': return piep.following ? null : piep.pos.clone().add(v(0, 1.8, 0));
    case 'lion': case 'tiger': { const a = animals.find((e) => e.type === (q.target === 'lion' ? 'loewe' : 'tiger')); return a.pos.clone().add(v(0, 1.4, 0)); }
    case 'coal': return oreTarget(B.COAL_ORE);
    case 'iron': return oreTarget(B.IRON_ORE);
    case 'stone':
      if (canMake([I.PICK_STONE])) return null;
      if (inv.count(B.STONE) >= 3) return inv.count(B.PLANKS) < 2 && !canMake([B.PLANKS]) ? nearestTree() : null;   // missing planks
      return underground() ? nearestOre(B.STONE) || nearestCave() : nearestCave();
    case 'coalIfNeeded': return inv.count(I.COAL) < inv.count(B.IRON_ORE) ? oreTarget(B.COAL_ORE) : null;
    case 'pad': return rocket.center().clone().add(v(0, 1, 0));
    case 'chest': return nearest(L.chests, (c) => (state.chests.has(c.id) || !q.which.includes(c.id) ? null : v(c.x + 0.5, c.y + 0.5, c.z + 0.5)));
  }
  return null;
}
// golden light beam + bobbing arrow at the target (visible from far away, like a quest marker)
const beacon = new THREE.Group();
{
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 70, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.5, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  beam.position.y = 35.5; beam.name = 'beam';
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
  beam.add(core);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 4), new THREE.MeshBasicMaterial({ color: 0xff9d1f, fog: false }));
  arrow.rotation.x = Math.PI; arrow.name = 'arrow';
  beacon.add(beam, arrow); beacon.visible = false; scene.add(beacon);
}
function updateBeacon(tgt, t) {
  beacon.visible = !!tgt && started && !state.watching;
  if (!beacon.visible) return;
  beacon.position.copy(tgt);
  const d = Math.hypot(tgt.x - player.pos.x, tgt.z - player.pos.z);
  const beam = beacon.getObjectByName('beam'), arrow = beacon.getObjectByName('arrow');
  beam.visible = d > 3;
  beam.material.opacity = 0.42 + Math.sin(t * 3) * 0.12;
  arrow.position.y = 1.6 + Math.sin(t * 4) * 0.25; arrow.rotation.y = t * 2;
}
// a tapping finger over the first tree, until the first wood is chopped (touch only)
const handV = new THREE.Vector3();
function updateHandHint(tgt) {
  const q = QUESTS[state.quest];
  if (!tgt || !touchUI() || !q || q.id !== 'holz' || (state.stats.collected[B.LOG] || 0) > 0 || modalOpen || autoMine || controls.mining
    || Math.hypot(tgt.x - player.pos.x, tgt.z - player.pos.z) > 7) { hud.showHand(null); return; }
  handV.copy(tgt).project(camera);
  if (handV.z > 1 || Math.abs(handV.x) > 0.95 || Math.abs(handV.y) > 0.95) { hud.showHand(null); return; }
  hud.showHand((handV.x * 0.5 + 0.5) * innerWidth, (-handV.y * 0.5 + 0.5) * innerHeight);
}

// ---------- book & settings ----------
function openBook() {
  sfx.tap();
  const stickers = MISSIONS.map((m) => ({ name: m.sticker.name, icon: stickerIcon(m), have: state.stickers.has(m.id) }));
  openModal((onClose) => hud.book(state.found, BOOK_ORDER, (key) => { hud.openModal?.(); openCard(key); }, onClose, stickers));
}
hud.on('book', openBook);
hud.on('settings', () => {
  openModal((onClose) => hud.settings(state.settings, {
    change(k, v) {
      state.settings[k] = v;
      if (k === 'voice') audioSettings.voice = v;
      if (k === 'music') setMusicVolume(v);
      if (k === 'sfx') audioSettings.sfx = v;
      if (k === 'calm') document.body.classList.toggle('calm', v);
      if (k === 'quality') applyQuality();
      if (k === 'fps') hud.fps.classList.toggle('hidden', !v);
      if (k === 'boom' && !v) pilze.forEach((a) => { a.fuse = 0; a.flashMesh.visible = false; a.mesh.scale.setScalar(1); });
      persist();
    },
    action(a) {
      if (a === 'day') state.time = 0.25;
      if (a === 'night') state.time = 0.72;
      if (a === 'reset') { localStorage.removeItem(SAVE_KEY); location.reload(); }
    },
  }, onClose));
});

// ---------- hero editor: Alex paints his own hero ----------
const heroPic = (cfg) => { const h = makeHero(cfg); h.rotation.y = 0.5; return snapshot(h, 240, 1.95); };   // far enough to show him head (and hat) to shoes
function setHero(cfg) {
  state.hero = cfg; persist();
  const vis = hero.visible; scene.remove(hero); hero = makeHero(cfg); hero.visible = vis; scene.add(hero);
}
function openHeroEditor(onDone) {
  say(null, LINES.hero_hi, { now: true });
  openModal((onClose) => hud.heroEditor(state.hero, HERO_PARTS, HATS_INFO, heroPic, (cfg, word) => { setHero(cfg); sfx.tap(); if (word) say(null, word, { now: true }); },
    () => { onClose(); onDone?.(); }));
}

// ---------- start screen ----------
let started = false;
function showStart() {
  const s = document.createElement('div'); s.id = 'start';
  s.innerHTML = `<h1>${UI.start_title}</h1><p>${UI.start_pick}</p><div class="swatches"></div><button class="go">${ICONS.play}${UI.start_go}</button>`;
  const sw = s.querySelector('.swatches');
  OUTFITS.forEach((o, i) => {
    const b = document.createElement('button'); b.className = 'swatch' + (state.hero.shirt === o.main ? ' on' : '');
    b.style.background = o.main; b.style.setProperty('--second', o.second); b.setAttribute('aria-label', o.name);
    b.onclick = () => {
      unlockAudio(); sfx.tap();
      sw.querySelectorAll('.swatch').forEach((x, k) => x.classList.toggle('on', k === i));
      setHero({ ...state.hero, shirt: o.main, pants: o.second, cape: o.second });
    };
    sw.append(b);
  });
  const hb = document.createElement('button'); hb.className = 'herobtn'; hb.innerHTML = `${ICONS.person}${UI.hero_btn}`;
  hb.onclick = () => { unlockAudio(); sfx.tap(); s.style.display = 'none'; openHeroEditor(() => { s.style.display = ''; }); };
  sw.after(hb);
  function goFullscreen() {   // full screen + landscape, like an installed game (no-op when the home-screen app already is full screen)
    if (!isTouch || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    if (/AlexInselApp/.test(navigator.userAgent)) return;   // the tablet app is already full screen + landscape
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
      .catch(() => {});
  }
  s.querySelector('.go').onclick = () => {
    unlockAudio();
    goFullscreen();
    if (isTouch) document.addEventListener('touchend', goFullscreen, { passive: true });   // back to full screen after a swipe/back press
    s.remove(); started = true; hudRoot.classList.remove('hidden'); persist();
    if (!isTouch) controls.requestLock();
    say('hallo', LINES.hallo);
    preloadVoice();   // fetch the natural-voice recordings in the background
    setTimeout(startMusic, 2500);
    hud.setCreative(state.creative); refreshInv();
    { const t = questTarget(); if (t) { cam.yaw = Math.atan2(t.x - player.pos.x, t.z - player.pos.z); player.facing = cam.yaw; } }   // look at the first goal
    showQuest(false);
    introTimer = setTimeout(introStep, 3400);
    updateClickHint();
  };
  document.body.append(s);
}

// ---------- main loop ----------
const clock = new THREE.Timer();
let fpsAcc = 0, fpsN = 0, armSwing = 0, lastStep = 0;
const mvF = new THREE.Vector3(), mvR = new THREE.Vector3();
function frame(ts) {
  requestAnimationFrame(frame);
  clock.update(ts);
  step(Math.min(0.05, clock.getDelta()));
}
const frameMs = { logic: 0, render: 0, n: 0 };
function step(dt) {
  const tS = performance.now();
  if (started && !state.watching && !modalOpen) {
    const m = controls.getMove();
    if (state.driving) {
      const cl = (x) => Math.max(-1, Math.min(1, x));
      if (stunt) { const [th, st] = stuntInput(dt); rover.drive(rover.onGround ? dt : dt * 0.45, th, st); }   // slow motion in the air
      else rover.drive(dt, cl(m.y + (driveIn.gas ? 1 : 0) - (driveIn.back ? 1 : 0)), cl(m.x + (driveIn.right ? 1 : 0) - (driveIn.left ? 1 : 0)));
      player.pos.copy(rover.pos);
    }
    else {
      mvF.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
      mvR.set(-mvF.z, 0, mvF.x);
      const sp = controls.sprint() ? 1.45 : 1;
      const mv = mvF.multiplyScalar(m.y * sp).add(mvR.multiplyScalar(m.x * sp));
      player.update(dt, mv, controls.jumpHeld());
      if (state.firstPerson && Math.hypot(m.x, m.y) < 0.1) player.facing = cam.yaw;
    }
  }
  hero.position.copy(player.pos);
  hero.rotation.y = player.facing;
  const ud = hero.userData, sw = Math.sin(player.walkPhase) * 0.75 * Math.min(1, player.moving);
  armSwing = Math.max(0, armSwing - dt * 3);
  ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw;
  ud.arms[0].rotation.x = -sw * 0.8; ud.arms[1].rotation.x = sw * 0.8 - Math.sin(armSwing * Math.PI) * 1.4;
  ud.cape.rotation.x = 0.12 + Math.min(1, player.moving) * 0.55 + (player.onGround ? 0 : 0.3);

  for (const a of animals) if (!a.gone && !(a.apart > 0)) a.update(dt, state.driving || travel ? null : player);
  updatePilze(dt);
  updateNightVisitors(dt);
  updateCreatures(dt);
  updateStuck(dt);
  updateLOD(dt);
  if (started && !modalOpen) governQuality(dt);
  updateMoon(dt);
  updateTravel(dt);
  if (!state.driving) rover.update(0);
  rocket.update(dt);
  updateBits(dt);
  updateDrops(dt);
  updateCamera(dt);
  shakeCamera(dt);
  updateMining(dt);
  chunks.update();
  // outline the block under the crosshair / mouse
  const aim = controls.locked ? controls.center() : null;
  if (aim && started && !modalOpen && !state.driving) {
    const r = pick(aim.x, aim.y, true);
    hl.visible = !!(r && r.block && reachOK(r.block.x, r.block.y, r.block.z));
    if (hl.visible) hl.position.set(r.block.x + 0.5, r.block.y + 0.5, r.block.z + 0.5);
  } else hl.visible = false;
  updateSky(dt);
  nearTimer -= dt; if (nearTimer <= 0) { nearTimer = 0.2; if (started) scanNearby(); }
  updateLabel();
  const tgt = started ? questTarget() : null;
  updateBeacon(tgt, performance.now() / 1000);
  hud.touch = touchUI();
  const enterLabel = nearShuttle() ? (shuttleAt === 'pad' ? UI.to_moon : UI.go_home) : UI.enter;
  const enterText = touchUI() ? enterLabel : enterLabel + ' (F)';
  if (hud.enterBtn.dataset.t !== enterText) { hud.enterBtn.dataset.t = enterText; hud.enterBtn.querySelector('b').textContent = enterText; }
  hud.enterBtn.classList.toggle('hidden', !(started && (nearRover() || nearShuttle()) && !modalOpen && !state.watching));
  const qNow = QUESTS[state.quest];
  hud.ideasBtn.classList.toggle('hidden', !(started && (state.quest >= QUESTS.length || state.creative)));
  idea?.bp.update(dt);
  hud.stuntBtn.classList.toggle('hidden', !(started && canStunt() && !modalOpen));
  hud.photoBtn.classList.toggle('hidden', !(started && !modalOpen && !state.watching && (photoCand || qNow?.kind === 'photo')));
  ramp.ghosts.visible = state.quest >= QUESTS.findIndex((q) => q.id === 'schanze');
  ramp.update(dt);
  updateHandHint(tgt);
  if (tgt && Math.hypot(tgt.x - player.pos.x, tgt.z - player.pos.z) > 5) {
    const ang = Math.atan2(tgt.x - player.pos.x, tgt.z - player.pos.z) - cam.yaw;
    hud.setGoalArrow(-Math.atan2(Math.sin(ang), Math.cos(ang)));
  } else hud.setGoalArrow(null);

  updateViewmodel(dt, lightHere);
  // footsteps
  if (player.onGround && player.moving > 0.2 && !state.driving) {
    const s = Math.floor(player.walkPhase / Math.PI);
    if (s !== lastStep) {
      lastStep = s;
      const below = world.get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z));
      sfx.foot(BLOCKS[below]?.rock || below === B.METAL ? 'stone' : below === B.SAND || below === B.SNOW ? 'sand' : 'soft');
    }
  }
  const tR = performance.now();
  renderer.clear();
  renderer.render(scene, camera);
  if (photoReq) { photoReq = false; takePhoto(); }
  if (vmHolder.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
  const tE = performance.now(); frameMs.logic += tR - tS; frameMs.render += tE - tR; frameMs.n++;
  if (state.settings.fps) { fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { hud.fps.textContent = `${Math.round(fpsN / fpsAcc)} FPS · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris`; fpsAcc = 0; fpsN = 0; } }
}

addEventListener('resize', () => { camera.aspect = vmCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); applyQuality(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopVoice(); persist(); } });

window.__dbg = { world, player, camera, pick, state, controls, rocket, cam, renderer, scene, inv, L, step, drops, gen, animals, chunks, frameMs, get pixelScale() { return autoScale; }, startStunt, get stunt() { return stunt; }, get autoScale() { return autoScale; }, roverObj: rover, pilze, piep, golem, klappers, shuttle, startTravel, get shuttleAt() { return shuttleAt; }, get travel() { return travel; }, startIdea, get idea() { return idea; }, fillIdeaCell, ramp, hud, driveIn, get photoCand() { return photoCand; }, QUESTS, questTarget, get autoMine() { return autoMine; } };
refreshInv();
if (BOT) import('../dev/bot.js');
document.getElementById('loading').remove();
showStart();
updateCamera(0.016);
requestAnimationFrame(frame);

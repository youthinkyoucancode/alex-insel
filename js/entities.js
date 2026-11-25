// Animals (calm wandering), the drivable rover and the rocket build site.
import * as THREE from 'three';
import { B, isSolid } from './blocks.js';
import { SEA } from './world.js';
import { makeAnimal, makeRover, makeRocket } from './models.js';

export class Animal {
  constructor(type, world, x, z, home) {
    this.type = type; this.world = world;
    this.mesh = makeAnimal(type);
    this.mesh.userData.entity = this;
    this.pos = new THREE.Vector3(x + 0.5, world.surface(x, z), z + 0.5);
    this.home = home || { x, z };
    this.dir = Math.random() * Math.PI * 2;
    this.target = null; this.wait = 1 + Math.random() * 3; this.phase = Math.random() * 10;
    this.speed = { schaf: 0.9, huhn: 1.1, hund: 1.8, katze: 1.3, pferd: 1.6, loewe: 1.2, loewin: 1.4, loewenjunges: 1.7, tiger: 1.5, bummpilz: 1.4, piep: 2, steinwaechter: 0.8, klapper: 1.1 }[type];
    this.follow = type === 'hund' ? 1 : type === 'piep' ? -1 : 0;   // buddies: dog on the left, robot on the right
    this.following = type === 'hund';
    // big cats nap a lot (real lions rest up to about 20 hours a day); the tiger also likes to swim
    this.napper = type === 'loewe' || type === 'loewin' || type === 'loewenjunges' || type === 'tiger';
    this.swims = type === 'tiger';
    this.rest = 0; this.lie = 0; this.inWater = false;
    // how far nose and tail stick out: big animals check their whole body, so they never stand inside a tree
    this.reach = { loewe: 0.8, loewin: 0.8, tiger: 0.85, pferd: 0.75, schaf: 0.5, hund: 0.4, steinwaechter: 0.7 }[type] || 0;
    this.react = null; this.reactT = 0;
    this.mesh.position.copy(this.pos);
    this.wordKey = type;
    this.sheared = 0;
    this.eggTimer = 25 + Math.random() * 35;
    this.onEgg = null;
  }
  // Sheep give wool (it grows back after a while — true for real sheep too)
  shear() {
    if (this.type !== 'schaf' || this.sheared > 0) return false;
    this.sheared = 120; this.mesh.scale.set(0.82, 0.9, 0.9);
    return true;
  }
  canStand(x, z, fromY) {
    const w = this.world;
    if (this.swims) {   // paddle in the pond (above sea level only — never out to sea)
      const t = w.topBlock(x, z);
      if (t.id === B.WATER && t.y > SEA && Math.abs(t.y + 0.35 - fromY) < 1.01) return t.y + 0.35;
    }
    const s = w.surface(x, z, fromY + 1.5);
    if (Math.abs(s - fromY) > 1.01) return null;
    const below = w.get(Math.floor(x), s - 1, Math.floor(z));
    if (below === B.WATER || s <= SEA || w.get(Math.floor(x), s, Math.floor(z)) === B.WATER) return null;
    if (isSolid(w.get(Math.floor(x), s, Math.floor(z))) || isSolid(w.get(Math.floor(x), s + 1, Math.floor(z)))) return null;
    if (this.reach) {
      for (const k of [1, -1]) {
        const px = Math.floor(x + Math.sin(this.dir) * this.reach * k), pz = Math.floor(z + Math.cos(this.dir) * this.reach * k);
        if (isSolid(w.get(px, s, pz)) || isSolid(w.get(px, s + 1, pz))) return null;
      }
    }
    return s;
  }
  // a little show when Alex finds or photographs the animal: 'roar' (rear up), 'hop', 'look'
  doReact(kind, player) {
    this.react = kind; this.reactT = kind === 'roar' ? 1.6 : 1.2; this.rest = 0; this.target = null; this.wait = 2.5;
    if (player) this.dir = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
  }
  goSwim() { if (!this.swims) return; this.rest = 0; this.wait = 6; this.target = { x: this.home.x + 0.5, z: this.home.z + 0.5 }; }
  update(dt, player) {
    const p = this.pos;
    this.phase += dt;
    if (this.sheared > 0) { this.sheared -= dt; if (this.sheared <= 0) this.mesh.scale.set(1, 1, 1); }
    if (this.type === 'huhn') {
      this.eggTimer -= dt;
      if (this.eggTimer <= 0) { this.eggTimer = 45 + Math.random() * 40; this.onEgg?.(this.pos); }
    }
    const pd = player ? Math.hypot(player.pos.x - p.x, player.pos.z - p.z) : 99;
    // The dog is Alex's buddy: it follows him around the island.
    // it trots along *behind* Alex, so it never stands in the way of what he's looking at
    // (behind and to the left, so it is never between the camera and the hero)
    const side = this.follow || 1;
    const bx = player ? player.pos.x - Math.sin(player.facing) * 1.2 + Math.cos(player.facing) * 2.2 * side : 0, bz = player ? player.pos.z - Math.cos(player.facing) * 1.2 - Math.sin(player.facing) * 2.2 * side : 0;
    const buddy = this.follow && this.following;
    if (buddy && player && pd > 30) { p.set(bx, this.world.surface(bx, bz, player.pos.y + 3), bz); }   // far behind: catch up at once
    if (buddy && player && (pd > 3.2 || Math.hypot(p.x - bx, p.z - bz) > 2.2) && pd < 40) {
      this.target = { x: bx, z: bz };
      this.speed = pd > 8 ? 5.5 : 3.2;
      this.home = { x: player.pos.x, z: player.pos.z };
    }
    const near = player && pd < 2.2 && !buddy;
    let moving = false;
    if (near) {
      // stop and look at the child
      const want = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
      let d = want - this.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); this.dir += d * Math.min(1, dt * 3);
      this.target = null;
    } else if (this.reactT > 0) {
      this.reactT -= dt;
    } else if (this.rest > 0) {
      this.rest -= dt;
      if (this.rest <= 0) this.wait = 0.5;
    } else if (this.target && !moving) {
      const dx = this.target.x - p.x, dz = this.target.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < 0.3) { this.target = null; this.wait = 2 + Math.random() * 4; }
      else {
        const want = Math.atan2(dx, dz);
        let d = want - this.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); this.dir += d * Math.min(1, dt * 4);
        const step = this.speed * dt;
        const nx = p.x + Math.sin(this.dir) * step, nz = p.z + Math.cos(this.dir) * step;
        let s = this.canStand(nx, nz, p.y);
        // the dog may hop up to two blocks to keep up
        if (s === null && buddy) { const s2 = this.world.surface(nx, nz, p.y + 2.5); if (Math.abs(s2 - p.y) <= 2.01 && s2 > SEA) s = s2; }
        if (s === null && buddy && player && pd > 12) { p.x = player.pos.x - 1; p.z = player.pos.z - 1; p.y = player.pos.y; moving = true; }
        else if (s === null) { this.target = null; this.wait = 0.5; }
        else { p.x = nx; p.z = nz; p.y += (s - p.y) * Math.min(1, dt * 10); moving = true; }
      }
    } else {
      this.wait -= dt;
      if (this.wait <= 0 && this.napper && !this.inWater && Math.random() < 0.45) {
        this.rest = 10 + Math.random() * 14;
      } else if (this.wait <= 0 && this.swims && Math.random() < 0.5) {
        this.target = { x: this.home.x + (Math.random() - 0.5) * 3, z: this.home.z + (Math.random() - 0.5) * 3 };   // off for a swim
      } else if (this.wait <= 0) {
        const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
        let tx = p.x + Math.sin(a) * r, tz = p.z + Math.cos(a) * r;
        if (Math.hypot(tx - this.home.x, tz - this.home.z) > 10) { tx = this.home.x + (Math.random() - 0.5) * 6; tz = this.home.z + (Math.random() - 0.5) * 6; }
        this.target = { x: tx, z: tz };
      }
    }
    // snap to ground if the ground changed under us (e.g. dug away)
    this.inWater = this.swims && this.world.topBlock(p.x, p.z).id === B.WATER;
    const s = this.world.surface(p.x, p.z, p.y + 0.5);
    if (!this.inWater && s < p.y - 0.05) p.y = Math.max(s, p.y - dt * 6);

    this.mesh.position.copy(p);
    // lying down: front paws stretched forward, back legs tucked, body lowered
    this.lie += ((this.rest > 0 ? 1 : 0) - this.lie) * Math.min(1, dt * 3);
    if (this.napper) this.mesh.position.y -= this.lie * 0.5 * this.mesh.scale.y;
    this.mesh.rotation.y = this.dir;
    this.mesh.rotation.x = 0;
    if (this.reactT > 0) {
      const k = Math.sin(Math.min(1, this.reactT / (this.react === 'roar' ? 1.6 : 1.2)) * Math.PI);
      if (this.react === 'roar') this.mesh.rotation.x = -0.32 * k;
      if (this.react === 'hop') this.mesh.position.y += Math.abs(Math.sin(this.reactT * 9)) * 0.45 * this.mesh.scale.y;
    }
    const legs = this.mesh.userData.legs;
    const swing = moving ? Math.sin(this.phase * this.speed * 7) * 0.5 : 0;
    legs.forEach((l, i) => { l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? 1 : -1) * swing * (1 - this.lie) + this.lie * (i < 2 ? -1.45 : 1.45); });
    const head = this.mesh.userData.head;
    if (head && !moving) head.rotation.x = Math.sin(this.phase * 0.7) * 0.06;
    const tail = this.mesh.userData.tail;
    if (tail) tail.rotation.y = Math.sin(this.phase * (near ? 9 : 3)) * 0.4;
  }
}

export class Rover {
  constructor(world, x, z) {
    this.world = world;
    this.mesh = makeRover();
    this.mesh.userData.entity = this;
    this.pos = new THREE.Vector3(x + 0.5, world.surface(x, z), z + 0.5);
    this.dir = -0.6; this.speed = 0; this.wheelSpin = 0;
    this.vy = 0; this.air = 0; this.onGround = true; this.onLand = null;
    this.wordKey = 'rover';
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.dir;
  }
  groundAt(x, z, fromY) {
    // highest ground under the rover's footprint
    let best = -1;
    for (const [ox, oz] of [[0, 0], [0.5, 0.7], [-0.5, 0.7], [0.5, -0.7], [-0.5, -0.7]]) {
      const c = Math.cos(this.dir), s = Math.sin(this.dir);
      const wx = x + ox * c + oz * s, wz = z - ox * s + oz * c;
      best = Math.max(best, this.world.surface(wx, wz, fromY + 1.2));
    }
    return best;
  }
  // throttle: -1..1 (gas / reverse), steer: -1..1 (left / right) — like an RC car remote
  drive(dt, throttle, steer) {
    const target = throttle * (throttle > 0 ? 7 : 3.5);
    this.speed += (target - this.speed) * Math.min(1, dt * (throttle ? 2.4 : 4));
    const grip = Math.min(1, Math.abs(this.speed) / 1.5) * (this.onGround ? 1 : 0.4);
    this.dir -= steer * dt * 2.1 * grip * (this.speed < -0.1 ? -1 : 1);
    const nx = this.pos.x + Math.sin(this.dir) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.dir) * this.speed * dt;
    const g = this.groundAt(nx, nz, this.pos.y);
    const wet = this.world.get(Math.floor(nx), g - 1, Math.floor(nz)) === B.WATER || g <= SEA;
    if (g - this.pos.y <= 1.01 && !wet && nx > 2 && nz > 2 && nx < 126 && nz < 126) {
      this.pos.x = nx; this.pos.z = nz;
      if (g > this.pos.y + 0.3 && this.onGround) { this.pos.y = g; if (this.speed > 3.5) { this.vy = 3.6; this.onGround = false; } }   // up a step: hop when fast
    } else this.speed *= -0.3;
    const ground = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.onGround && ground >= this.pos.y - 0.6) { this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 12); this.vy = 0; }
    else {
      // driving off an edge at speed launches the rover a little (ramp jumps!)
      if (this.onGround && this.speed > 3 && this.vy <= 0) this.vy = this.speed * 0.42;
      this.onGround = false; this.vy -= 22 * dt; this.pos.y += this.vy * dt; this.air += dt;
      if (this.pos.y <= ground) { this.pos.y = ground; if (this.air > 0.3) this.onLand?.(this.air); this.vy = 0; this.air = 0; this.onGround = true; }
    }
    this.update(dt);
  }
  update(dt) {
    this.wheelSpin += this.speed * dt / 0.3;
    this.mesh.userData.wheels.forEach((w) => { w.rotation.x = this.wheelSpin; });
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.dir;
    this.mesh.rotation.x = this.onGround ? 0 : Math.max(-0.35, Math.min(0.35, -this.vy * 0.05));
  }
}

// "Bauanleitung" (like LEGO instructions): glowing ghost blocks show the next row to build.
export class Blueprint {
  constructor(world, scene, base, steps, block, color = 0x8fe6ff) {
    this.world = world; this.scene = scene; this.base = base; this.steps = steps; this.block = block;
    this.step = 0; this.state = 'build';
    this.ghosts = new THREE.Group(); scene.add(this.ghosts);
    this.ghostMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false });
    this.ghostGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.edgeGeo = new THREE.EdgesGeometry(this.ghostGeo);
    this.time = 0; this.onStepDone = () => {}; this.onComplete = () => {};
  }
  // cells may carry their own block id ([dx, dy, dz, id]); otherwise the blueprint's block
  cells(step) { return this.steps[step].map(([dx, dy, dz, id]) => ({ x: this.base.x + dx, y: this.base.y + dy, z: this.base.z + dz, id: id ?? this.block })); }
  allCells() { return this.steps.flatMap((_, i) => this.cells(i)); }
  cellAt(x, y, z) { return this.state === 'build' ? this.cells(this.step).find((c) => c.x === x && c.y === y && c.z === z) : null; }
  matFor(id) {   // ghost tinted in the colour of the block that goes there
    if (!this.tint) return this.ghostMat;
    this.mats = this.mats || new Map();
    if (!this.mats.has(id)) this.mats.set(id, new THREE.MeshBasicMaterial({ color: this.tint(id), transparent: true, opacity: 0.5, depthWrite: false }));
    return this.mats.get(id);
  }
  showStep() {
    this.ghosts.clear();
    if (this.state !== 'build') return;
    for (const c of this.cells(this.step)) {
      if (this.world.get(c.x, c.y, c.z) === c.id) continue;
      const m = new THREE.Mesh(this.ghostGeo, this.matFor(c.id)); m.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5);
      m.add(new THREE.LineSegments(this.edgeGeo, this.edgeMat));
      this.ghosts.add(m);
    }
  }
  isCell(x, y, z) { return this.state === 'build' && this.cells(this.step).some((c) => c.x === x && c.y === y && c.z === z); }
  check() {
    if (this.state !== 'build') return;
    let advanced = false;
    while (this.state === 'build' && this.cells(this.step).every((c) => this.world.get(c.x, c.y, c.z) === c.id)) {
      this.step++; advanced = true;
      if (this.step >= this.steps.length) { this.state = 'done'; this.ghosts.clear(); this.onComplete(); return; }
    }
    this.showStep();
    if (advanced) this.onStepDone(this.step);
  }
  center() { const c = this.cells(0); const x = c.reduce((a, q) => a + q.x, 0) / c.length, z = c.reduce((a, q) => a + q.z, 0) / c.length; return new THREE.Vector3(x + 0.5, this.base.y + 1, z + 0.5); }
  update(dt) { this.time += dt; const o = 0.35 + Math.sin(this.time * 2.2) * 0.12; this.ghostMat.opacity = o; this.mats?.forEach((m) => { m.opacity = o + 0.1; }); }
  dispose() { this.ghosts.clear(); this.scene.remove(this.ghosts); }
}
// A jump ramp for the rover: three rising rows of bricks (built along +x, two blocks wide)
export const RAMP_STEPS = [
  [[0, 0, 0], [0, 0, 1], [1, 0, 0], [1, 0, 1], [2, 0, 0], [2, 0, 1]],
  [[1, 1, 0], [1, 1, 1], [2, 1, 0], [2, 1, 1]],
  [[2, 2, 0], [2, 2, 1]],
];

// The rocket "Bauanleitung": glowing ghost blocks show the next row to build.
const ROCKET_STEPS = [
  [[0, 1, 0], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1]],
  [[0, 2, 0], [0, 3, 0], [0, 4, 0]],
];

export class RocketSite {
  constructor(world, scene, pad) {
    this.world = world; this.scene = scene;
    this.base = { x: pad.x, y: pad.y, z: pad.z };
    this.step = 0; this.state = 'build';  // build | ready | flying | cooldown
    this.ghosts = new THREE.Group(); scene.add(this.ghosts);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fe6ff, transparent: true, opacity: 0.45, depthWrite: false });
    this.ghostGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.edgeGeo = new THREE.EdgesGeometry(this.ghostGeo);
    this.time = 0; this.rocket = null; this.particles = null;
    this.onStepDone = () => {}; this.onComplete = () => {}; this.onLaunchDone = () => {};
    this.showStep();
  }
  cells(step) { return ROCKET_STEPS[step].map(([dx, dy, dz]) => ({ x: this.base.x + dx, y: this.base.y + dy, z: this.base.z + dz })); }
  allCells() { return ROCKET_STEPS.flatMap((_, i) => this.cells(i)); }
  showStep() {
    this.ghosts.clear();
    if (this.state !== 'build') return;
    for (const c of this.cells(this.step)) {
      if (this.world.get(c.x, c.y, c.z) !== B.AIR) continue;
      const m = new THREE.Mesh(this.ghostGeo, this.ghostMat); m.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5);
      const e = new THREE.LineSegments(this.edgeGeo, this.edgeMat); m.add(e);
      this.ghosts.add(m);
    }
  }
  isCell(x, y, z) { return this.state === 'build' && this.cells(this.step).some((c) => c.x === x && c.y === y && c.z === z); }
  // Called after any block change
  check() {
    if (this.state !== 'build') return;
    let advanced = false;
    while (this.state === 'build' && this.cells(this.step).every((c) => this.world.get(c.x, c.y, c.z) === B.METAL)) {
      this.step++; advanced = true;
      if (this.step >= ROCKET_STEPS.length) { this.state = 'ready'; this.ghosts.clear(); this.onComplete(); return; }
    }
    this.showStep();
    if (advanced) this.onStepDone(this.step);
  }
  center() { return new THREE.Vector3(this.base.x + 0.5, this.base.y + 1, this.base.z + 0.5); }
  launch(calm) {
    if (this.state !== 'ready') return;
    this.state = 'flying';
    for (const c of this.allCells()) this.world.set(c.x, c.y, c.z, B.AIR);
    this.rocket = makeRocket();
    this.rocket.position.copy(this.center());
    this.scene.add(this.rocket);
    this.flyT = 0; this.calm = calm;
    // exhaust particles
    const n = calm ? 60 : 160;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    this.pdata = Array.from({ length: n }, () => ({ life: -Math.random() * 1.2, v: new THREE.Vector3(), p: new THREE.Vector3() }));
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }
  update(dt) {
    this.time += dt;
    this.ghostMat.opacity = 0.35 + Math.sin(this.time * 2.2) * 0.12;
    if (this.state !== 'flying') return;
    this.flyT += dt;
    const t = Math.max(0, this.flyT - 1.2);            // 1.2 s of rumbling before lift-off
    const r = this.rocket;
    r.position.y = this.center().y + 0.5 * 3.2 * t * t; // gentle constant acceleration
    r.position.x = this.center().x + (this.flyT < 1.2 && !this.calm ? (Math.random() - 0.5) * 0.04 : 0);
    // particles
    const pos = this.particles.geometry.attributes.position, col = this.particles.geometry.attributes.color;
    this.pdata.forEach((q, i) => {
      q.life += dt;
      if (q.life > 1.4 || q.life < 0) {
        if (q.life > 1.4) q.life = 0;
        q.p.set(r.position.x + (Math.random() - 0.5) * 0.5, r.position.y, r.position.z + (Math.random() - 0.5) * 0.5);
        q.v.set((Math.random() - 0.5) * 2.5, -3 - Math.random() * 3, (Math.random() - 0.5) * 2.5);
      }
      if (q.life >= 0) { q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 1.5); if (q.p.y < this.base.y + 1.1) { q.p.y = this.base.y + 1.1; q.v.y = 0; q.v.x *= 1.05; q.v.z *= 1.05; } }
      pos.setXYZ(i, q.p.x, q.life >= 0 ? q.p.y : -100, q.p.z);
      const k = Math.min(1, q.life / 1.0);
      col.setXYZ(i, 1 - k * 0.35, 0.75 - k * 0.1, 0.3 + k * 0.45);
    });
    pos.needsUpdate = true; col.needsUpdate = true;
    if (this.flyT > 9) {
      this.scene.remove(this.rocket); this.scene.remove(this.particles);
      this.particles.geometry.dispose(); this.rocket = null; this.particles = null;
      this.state = 'build'; this.step = 0; this.showStep(); this.onLaunchDone();
    }
  }
}

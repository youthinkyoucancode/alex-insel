// Player movement with simple box-vs-voxel collision, auto-jump and gentle swimming.
import * as THREE from 'three';
import { B } from './blocks.js';
import { W, D } from './world.js';

const GRAVITY = 24, JUMP_V = 7.6, SPEED = 5.2;

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.w = 0.6; this.h = 1.75;
    this.onGround = false; this.inWater = false;
    this.facing = 0; this.moving = 0; this.walkPhase = 0;
    this.distance = 0;
    this.gravity = 1;   // 1 on the island, 1/6 on the moon (like the real Moon)
  }
  collides(px, py, pz) {
    const hw = this.w / 2;
    const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
    const y0 = Math.floor(py), y1 = Math.floor(py + this.h);
    const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
      if (this.world.solidAt(x, y, z)) return true;
    return false;
  }
  // Does a block at (bx,by,bz) overlap the player? (so we never build inside ourselves)
  overlapsBlock(bx, by, bz) {
    const hw = this.w / 2, p = this.pos;
    return bx + 1 > p.x - hw && bx < p.x + hw && by + 1 > p.y && by < p.y + this.h && bz + 1 > p.z - hw && bz < p.z + hw;
  }
  update(dt, move, jump) {
    const p = this.pos, v = this.vel, world = this.world;
    this.inWater = world.get(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z)) === B.WATER;
    const headWet = world.get(Math.floor(p.x), Math.floor(p.y + 1.3), Math.floor(p.z)) === B.WATER;
    const speed = SPEED * (this.inWater ? 0.6 : 1);
    const target = new THREE.Vector3(move.x * speed, 0, move.z * speed);
    const accel = this.onGround || this.inWater ? 22 : 8;
    v.x += (target.x - v.x) * Math.min(1, accel * dt);
    v.z += (target.z - v.z) * Math.min(1, accel * dt);

    if (this.inWater) {
      v.y -= GRAVITY * 0.2 * dt;
      if (headWet) v.y += 9 * dt;           // float up gently, nobody sinks
      if (jump) v.y = Math.max(v.y, 3.2);
      v.y = Math.max(-1.6, Math.min(4, v.y));
    } else {
      v.y -= GRAVITY * this.gravity * dt;
      if (jump && this.onGround) v.y = JUMP_V;
    }
    v.y = Math.max(v.y, -30);

    const moveLen = Math.hypot(move.x, move.z);
    let blocked = false;
    // X axis
    let nx = p.x + v.x * dt;
    if (this.collides(nx, p.y, p.z)) {
      blocked = true;
      nx = v.x > 0 ? Math.floor(nx + this.w / 2) - this.w / 2 - 0.001 : Math.floor(nx - this.w / 2) + 1 + this.w / 2 + 0.001;
      if (this.collides(nx, p.y, p.z)) nx = p.x;
      v.x = 0;
    }
    p.x = nx;
    // Z axis
    let nz = p.z + v.z * dt;
    if (this.collides(p.x, p.y, nz)) {
      blocked = true;
      nz = v.z > 0 ? Math.floor(nz + this.w / 2) - this.w / 2 - 0.001 : Math.floor(nz - this.w / 2) + 1 + this.w / 2 + 0.001;
      if (this.collides(p.x, p.y, nz)) nz = p.z;
      v.z = 0;
    }
    p.z = nz;
    // Y axis
    let ny = p.y + v.y * dt;
    this.onGround = false;
    if (this.collides(p.x, ny, p.z)) {
      if (v.y < 0) { ny = Math.floor(ny) + 1; this.onGround = true; }
      else ny = Math.floor(ny + this.h) - this.h - 0.001;
      if (this.collides(p.x, ny, p.z)) ny = p.y;
      v.y = 0;
    }
    p.y = ny;

    // Auto-jump: one block steps are climbed automatically
    if (blocked && moveLen > 0.2 && (this.onGround || this.inWater)) {
      const ax = p.x + move.x / moveLen * 0.45, az = p.z + move.z / moveLen * 0.45;
      if (!this.collides(ax, p.y + 1.05, az) && this.collides(ax, p.y + 0.05, az)) v.y = this.inWater ? 6 : JUMP_V;
    }

    // Keep on the island area
    p.x = Math.max(1, Math.min(W - 1, p.x));
    p.z = Math.max(1, Math.min(D - 1, p.z));
    if (p.y < -5) { p.y = world.surface(p.x, p.z) + 0.5; v.set(0, 0, 0); }

    const hs = Math.hypot(v.x, v.z);
    this.moving = hs / SPEED;
    this.distance += hs * dt;
    this.walkPhase += hs * dt * 2.4;
    if (moveLen > 0.1) {
      const want = Math.atan2(move.x, move.z);
      let d = want - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 14);
    }
  }
}

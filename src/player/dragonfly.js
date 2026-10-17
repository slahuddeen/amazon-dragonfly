// Dragonfly model (player + NPCs) and the flight controller / chase camera / tour autopilot.
import * as THREE from 'three';
import { MeshBuilder, addTube, addEllipsoid } from '../core/geometry.js';
import { canvasTexture, creatureMat } from '../fauna/common.js';
import { WORLD } from '../core/shared.js';

const C = (h) => new THREE.Color(h);

let wingTexture = null;
function getWingTexture() {
  if (wingTexture) return wingTexture;
  wingTexture = canvasTexture(512, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    // wing outline (base at left)
    const path = () => {
      x.beginPath();
      x.moveTo(4, h * 0.42);
      x.bezierCurveTo(w * 0.3, h * 0.08, w * 0.85, h * 0.12, w - 6, h * 0.42);
      x.bezierCurveTo(w - 2, h * 0.62, w * 0.8, h * 0.9, w * 0.45, h * 0.86);
      x.bezierCurveTo(w * 0.2, h * 0.84, w * 0.06, h * 0.75, 4, h * 0.58);
      x.closePath();
    };
    path();
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(200,140,60,0.55)'); g.addColorStop(0.18, 'rgba(230,220,200,0.22)'); g.addColorStop(1, 'rgba(235,240,245,0.16)');
    x.fillStyle = g; x.fill();
    x.save(); path(); x.clip();
    x.strokeStyle = 'rgba(40,30,20,0.7)';
    // longitudinal veins
    for (let i = 0; i < 9; i++) {
      x.lineWidth = i < 2 ? 2.4 : 1.2;
      x.beginPath(); x.moveTo(4, h * 0.42 + i * 2);
      x.bezierCurveTo(w * 0.3, h * (0.1 + i * 0.09), w * 0.7, h * (0.14 + i * 0.085), w - 6, h * (0.4 + i * 0.03));
      x.stroke();
    }
    // cross veins mesh
    x.lineWidth = 0.7; x.strokeStyle = 'rgba(40,30,20,0.45)';
    for (let i = 0; i < 70; i++) {
      const px = 12 + i * (w / 72);
      x.beginPath(); x.moveTo(px, 0); x.lineTo(px + 4, h); x.stroke();
    }
    for (let i = 0; i < 200; i++) {
      const px = Math.random() * w, py = h * 0.2 + Math.random() * h * 0.65;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6, py + 5); x.stroke();
    }
    x.restore();
    // pterostigma
    x.fillStyle = 'rgba(30,20,10,0.95)';
    x.fillRect(w * 0.84, h * 0.17, w * 0.06, h * 0.07);
    path(); x.strokeStyle = 'rgba(30,20,10,0.8)'; x.lineWidth = 2; x.stroke();
  });
  return wingTexture;
}

const SCHEMES = {
  flame: { eye: 0x8a1a10, thorax: 0x8a3020, abd: 0xd8281a, stripe: 0x3a0a08 },
  blue: { eye: 0x2a6a8a, thorax: 0x2a3a4a, abd: 0x5a9ad8, stripe: 0x101820 },
  emerald: { eye: 0x2a8a4a, thorax: 0x2a6a2a, abd: 0x1a3a2a, stripe: 0x9ac040 },
  amber: { eye: 0x7a5a20, thorax: 0x6a5020, abd: 0xd8a030, stripe: 0x2a1a08 },
};

export function buildDragonfly(scheme = 'flame', scale = 1) {
  const S = SCHEMES[scheme];
  const g = new THREE.Group();
  const mb = new MeshBuilder();
  // abdomen
  const pts = [], radii = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(new THREE.Vector3(0, 0.001 - t * 0.003, 0.008 - t * 0.054));
    radii.push((0.0034 - t * 0.0012) * (1 + 0.12 * Math.abs(Math.sin(t * Math.PI * 10))));
  }
  addTube(mb, pts, radii, { radial: 8, capEnd: true, colorFn: (i) => (i % 2 === 0 ? C(S.stripe).lerp(C(S.abd), 0.4) : C(S.abd)) });
  // thorax & head
  mb.setColor(C(S.thorax));
  addEllipsoid(mb, new THREE.Vector3(0, 0.001, 0.017), 0.0055, 0.0062, 0.0095, { w: 10, h: 8 });
  mb.setColor(C(S.eye));
  addEllipsoid(mb, new THREE.Vector3(0.0036, 0.003, 0.029), 0.0048, 0.0052, 0.0048, { w: 10, h: 8 });
  addEllipsoid(mb, new THREE.Vector3(-0.0036, 0.003, 0.029), 0.0048, 0.0052, 0.0048, { w: 10, h: 8 });
  mb.setColor(C(0xd8c890));
  addEllipsoid(mb, new THREE.Vector3(0, -0.0015, 0.0325), 0.003, 0.0025, 0.002, { w: 8, h: 6 });
  // legs tucked
  mb.setColor(C(0x1a1410));
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const b = new THREE.Vector3(s * 0.002, -0.004, 0.022 - k * 0.004);
    addTube(mb, [b, b.clone().add(new THREE.Vector3(s * 0.004, -0.003, 0.004)), b.clone().add(new THREE.Vector3(s * 0.003, -0.005, 0.009))], [0.0006, 0.0005, 0.0004], { radial: 3 });
  }
  const body = new THREE.Mesh(mb.toGeometry(), creatureMat({ vertexColors: true, roughness: 0.32, metalness: 0.25 }, 'dragonfly'));
  body.castShadow = true;
  g.add(body);

  const wingGeo = new THREE.PlaneGeometry(1, 1);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0.5, 0, 0);
  const wm = new THREE.MeshPhysicalMaterial({
    map: getWingTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.15, metalness: 0,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [200, 700], opacity: 1,
  });
  const wings = [];
  for (const [z, len, wid] of [[0.022, 0.039, 0.0095], [0.0125, 0.037, 0.0125]]) {
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.0025, 0.005, z);
      const w = new THREE.Mesh(wingGeo, wm);
      w.scale.set(len * s, 1, wid);
      w.rotation.y = s * (z > 0.02 ? 0.08 : -0.12);
      pivot.add(w);
      g.add(pivot);
      wings.push({ pivot, side: s, fore: z > 0.02 });
    }
  }
  g.scale.setScalar(scale);
  g.userData.wings = wings;
  g.userData.flap = (t, amp = 0.55, freq = 26) => {
    for (const w of wings) {
      const ph = t * freq * Math.PI * 2 + (w.fore ? 0 : 1.7);
      w.pivot.rotation.z = w.side * (Math.sin(ph) * amp + 0.08);
    }
  };
  return g;
}

// ------------------------------------------------------------------- controller
export class DragonflyPlayer {
  constructor({ camera, terrain, colliders, dom }) {
    this.camera = camera; this.terrain = terrain; this.colliders = colliders; this.dom = dom;
    this.model = buildDragonfly('flame');
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.keys = new Set();
    this.mode = 'chase';
    this.speedMul = 1;
    this.camPos = new THREE.Vector3();
    this.tour = null;
    this.touring = false;
    this.t = 0;
    this.lastYaw = 0;
    this.mouse = { dx: 0, dy: 0 };
    this.locked = false;
    this.perched = null; // { p, n } when sitting on a surface
    this.perchTargets = null; // Object3D whose meshes can be landed on
    this.raycaster = new THREE.Raycaster();
    this.bind();
  }
  // Land on the closest surface below / ahead (leaves, twigs, bark, vines, ground).
  tryPerch() {
    if (!this.perchTargets) return false;
    const rc = this.raycaster;
    rc.near = 0; rc.far = 2.5;
    rc.layers.enableAll();
    const cand = [];
    this.perchTargets.traverse((o) => {
      if (!o.isMesh || !o.visible || o.name === 'sky') return;
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = o.isInstancedMesh ? (o.boundingSphere || (o.computeBoundingSphere(), o.boundingSphere)) : g.boundingSphere;
      const c = bs.center.clone().applyMatrix4(o.matrixWorld);
      if (c.distanceTo(this.pos) < bs.radius + 3) cand.push(o);
    });
    const f = this.forward();
    const dirs = [new THREE.Vector3(0, -1, 0), f.clone().setY(f.y - 0.6).normalize(), f.clone(), f.clone().setY(f.y - 0.25).normalize()];
    let best = null;
    for (const d of dirs) {
      rc.set(this.pos, d);
      const hits = rc.intersectObjects(cand, false);
      if (hits.length && (!best || hits[0].distance < best.distance)) best = hits[0];
    }
    if (!best) return false;
    const n = best.face ? best.face.normal.clone() : new THREE.Vector3(0, 1, 0);
    if (best.object.isInstancedMesh && best.instanceId !== undefined) {
      const m = new THREE.Matrix4(); best.object.getMatrixAt(best.instanceId, m);
      n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(m));
    }
    n.transformDirection(best.object.matrixWorld).normalize();
    if (n.dot(rc.ray.direction) > 0) n.negate();
    if (n.y < -0.2) n.set(0, 1, 0); // never hang upside-down under a leaf
    this.perched = { p: best.point.clone().addScaledVector(n, 0.012), n };
    this.vel.set(0, 0, 0);
    return true;
  }
  bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ', 'KeyE', 'KeyC'].includes(e.code) && this.touring) this.stopTour();
      if (e.code === 'KeyV') this.mode = this.mode === 'chase' ? 'fpv' : 'chase';
      if (e.code === 'KeyF') { if (this.perched) this.perched = null; else if (!this.touring) this.tryPerch(); }
      if (this.perched && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ', 'KeyE', 'KeyC'].includes(e.code)) { this.perched = null; this.vel.y = 0.6; }
      if (e.code === 'KeyT') this.touring ? this.stopTour() : this.startTour();
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.dom; });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX; this.mouse.dy += e.movementY;
    });
    addEventListener('wheel', (e) => {
      this.speedMul = THREE.MathUtils.clamp(this.speedMul * (e.deltaY > 0 ? 0.9 : 1.1), 0.25, 4);
    }, { passive: true });
  }
  setPose(p, yaw, pitch = 0) {
    this.pos.copy(p); this.yaw = yaw; this.pitch = pitch;
    this.camPos.copy(p);
  }
  setTour(points) {
    this.tour = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
    this.tourLen = this.tour.getLength();
    this.tourS = 0;
  }
  startTour() {
    if (!this.tour) return;
    // start from the closest point on the loop
    let best = 0, bd = Infinity;
    for (let i = 0; i < 400; i++) { const d = this.tour.getPointAt(i / 400).distanceToSquared(this.pos); if (d < bd) { bd = d; best = i / 400; } }
    this.tourS = best;
    this.touring = true;
  }
  stopTour() { this.touring = false; this.vel.set(0, 0, 0); }

  forward(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  update(dt, time) {
    this.t = time;
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    const f = this.forward();
    if (this.perched) {
      const sens = 0.0022;
      this.yaw -= this.mouse.dx * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - this.mouse.dy * sens, -1.2, 1.2);
      this.mouse.dx = this.mouse.dy = 0;
      this.pos.copy(this.perched.p);
      this.vel.set(0, 0, 0);
      this.roll *= 0.9;
    } else if (this.touring) {
      const speed = 4.2;
      this.tourS = (this.tourS + (speed * dt) / this.tourLen) % 1;
      const p = this.tour.getPointAt(this.tourS);
      const ahead = this.tour.getPointAt((this.tourS + 2.5 / this.tourLen) % 1);
      const dir = ahead.clone().sub(p).normalize();
      const yaw = Math.atan2(-dir.x, -dir.z), pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      let dy = yaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * (1 - Math.exp(-dt * 3));
      this.pitch += (pitch - this.pitch) * (1 - Math.exp(-dt * 3));
      this.vel.copy(p).sub(this.pos).divideScalar(Math.max(dt, 1e-3));
      this.pos.copy(p);
      this.roll += (THREE.MathUtils.clamp(-dy * 2.5, -0.6, 0.6) - this.roll) * (1 - Math.exp(-dt * 3));
    } else {
      const sens = 0.0022;
      this.yaw -= this.mouse.dx * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - this.mouse.dy * sens, -1.45, 1.45);
      const yawRate = -this.mouse.dx * sens / Math.max(dt, 1e-3);
      this.mouse.dx = this.mouse.dy = 0;
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const fw = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const st = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const up = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') || k.has('KeyC') ? 1 : 0);
      if (!this.locked) { // arrow keys turn when the mouse isn't captured
        if (k.has('ArrowLeft')) this.yaw += dt * 1.6;
        if (k.has('ArrowRight')) this.yaw -= dt * 1.6;
      }
      const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 4 : 1;
      const speed = 3.0 * this.speedMul * boost;
      const target = new THREE.Vector3().addScaledVector(f, fw * speed).addScaledVector(right, (this.locked ? st : 0) * speed).addScaledVector(new THREE.Vector3(0, 1, 0), up * speed * 0.8);
      this.vel.lerp(target, 1 - Math.exp(-dt * (boost > 1 ? 3 : 5)));
      this.pos.addScaledVector(this.vel, dt);
      const rollT = THREE.MathUtils.clamp(-st * 0.4 + yawRate * 0.08, -0.7, 0.7);
      this.roll += (rollT - this.roll) * (1 - Math.exp(-dt * 6));
    }
    // collisions
    const p = this.pos;
    if (this.perched) return this.updatePerchedView(dt, time);
    const ground = Math.max(this.terrain.height(p.x, p.z), WORLD.waterLevel) + 0.07;
    if (p.y < ground) { p.y = ground; if (this.vel.y < 0) this.vel.y = 0; }
    if (!this.touring) {
      this.colliders.resolve(p, 0.06);
      const r = Math.hypot(p.x, p.z), lim = WORLD.radius - 4;
      if (r > lim) { p.x *= lim / r; p.z *= lim / r; }
      p.y = Math.min(p.y, 160);
    }
    // model
    const bob = Math.sin(time * 2.3) * 0.006 + Math.sin(time * 5.1) * 0.002;
    this.model.position.copy(p); this.model.position.y += bob;
    this.model.rotation.set(0, 0, 0);
    this.model.quaternion.setFromEuler(new THREE.Euler(-this.pitch * 0.7 - 0.08, this.yaw + Math.PI, -this.roll, 'YXZ'));
    this.model.userData.flap(time, 0.6, 24);
    // camera
    const cam = this.camera;
    if (this.mode === 'chase') {
      const camUp = new THREE.Vector3(0, 1, 0);
      const desired = p.clone().addScaledVector(f, -0.36).addScaledVector(camUp, 0.085);
      this.camPos.lerp(desired, 1 - Math.exp(-dt * 10));
      const cg = Math.max(this.terrain.height(this.camPos.x, this.camPos.z), WORLD.waterLevel) + 0.04;
      if (this.camPos.y < cg) this.camPos.y = cg;
      this.colliders.resolve(this.camPos, 0.04);
      cam.position.copy(this.camPos);
      cam.quaternion.setFromEuler(new THREE.Euler(this.pitch - 0.12, this.yaw, this.roll * 0.35, 'YXZ'));
      this.model.visible = true;
    } else {
      cam.position.copy(p).addScaledVector(f, 0.02);
      cam.position.y += bob;
      cam.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll * 0.6, 'YXZ'));
      this.model.visible = false;
    }
  }
  updatePerchedView(dt, time) {
    const { p, n } = this.perched;
    // body sits on the surface, aligned to its normal, heading where the player looks
    const f = this.forward().clone();
    const fwd = f.addScaledVector(n, -f.dot(n)).normalize();
    if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0);
    const right = new THREE.Vector3().crossVectors(n, fwd).normalize();
    const m = new THREE.Matrix4().makeBasis(right, n, fwd);
    this.model.position.copy(p);
    this.model.quaternion.setFromRotationMatrix(m);
    for (const w of this.model.userData.wings) w.pivot.rotation.z = w.side * (0.05 + Math.sin(time * 1.3) * 0.02); // wings held flat
    const cam = this.camera;
    const cf = this.forward();
    const desired = p.clone().addScaledVector(cf, -0.28).addScaledVector(n, 0.07);
    this.camPos.lerp(desired, 1 - Math.exp(-dt * 6));
    this.colliders.resolve(this.camPos, 0.04);
    cam.position.copy(this.camPos);
    cam.quaternion.setFromEuler(new THREE.Euler(this.pitch - 0.15, this.yaw, 0, 'YXZ'));
    this.model.visible = true;
  }
  speed() { return this.perched ? 0 : this.vel.length(); }
}

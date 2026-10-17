// Birds: macaws (flying pairs + perched), toucans, hummingbirds visiting flowers, a harpy eagle.
import * as THREE from 'three';
import { MeshBuilder, addEllipsoid, addTube } from '../core/geometry.js';
import { creatureMat, faceDir } from './common.js';

const C = (h) => new THREE.Color(h);
const UP = new THREE.Vector3(0, 1, 0);

// flat wing in XZ extending along +x; colours sampled along the span
function wingGeometry(span, chord, colorAt, notch = 0.4) {
  const mb = new MeshBuilder();
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = chord * (1 - 0.35 * t) * (t > 0.85 ? Math.sqrt(Math.max(0.05, (1 - t) / 0.15)) : 1);
    const lead = c * 0.3, trail = -c * 0.7 * (1 + (t > 0.5 ? notch * 0.15 * Math.sin(t * 60) : 0));
    mb.setColor(colorAt(t, 0));
    mb.v(t * span, 0, lead, 0, 1, 0, t, 0);
    mb.setColor(colorAt(t, 1));
    mb.v(t * span, 0, trail, 0, 1, 0, t, 1);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; mb.quad(a, a + 2, a + 3, a + 1); }
  return mb.toGeometry();
}
function tailGeometry(len, w0, w1, colorAt) {
  const mb = new MeshBuilder();
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = w0 + (w1 - w0) * t;
    mb.setColor(colorAt(t));
    mb.v(-w, 0, -t * len, 0, 1, 0, 0, t);
    mb.v(w, 0, -t * len, 0, 1, 0, 1, t);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; mb.quad(a, a + 1, a + 3, a + 2); }
  return mb.toGeometry();
}

const bodyMat = () => creatureMat({ vertexColors: true, roughness: 0.55 }, 'bird');
const wingMatV = () => creatureMat({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }, 'birdwing');

function assembleBird({ body, wing, tail, wingPos, tailPos, scale = 1 }) {
  const g = new THREE.Group();
  const bm = new THREE.Mesh(body, bodyMat()); bm.castShadow = true; g.add(bm);
  const wm = wingMatV();
  const wings = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * wingPos.x, wingPos.y, wingPos.z);
    const m = new THREE.Mesh(wing, wm);
    m.scale.x = s; m.castShadow = true;
    pivot.add(m); g.add(pivot);
    wings.push({ pivot, s });
  }
  if (tail) {
    const t = new THREE.Mesh(tail, wm);
    t.position.copy(tailPos);
    t.castShadow = true;
    g.add(t);
    g.userData.tail = t;
  }
  g.scale.setScalar(scale);
  g.userData.wings = wings;
  g.userData.flap = (ph, amp) => { for (const w of wings) { w.pivot.rotation.set(0, 0, w.s * Math.sin(ph) * amp); } };
  g.userData.fold = () => { for (const w of wings) { w.pivot.rotation.set(0.15, w.s * -1.45, w.s * -0.2); } };
  return g;
}

export function buildMacaw(kind = 'scarlet') {
  const mb = new MeshBuilder();
  const red = C(0xd0140c), yellow = C(0xf0c010), blue = C(0x1a48c0), white = C(0xf0ece4), green = C(0x2a9a3a), byYellow = C(0xf0b818), byBlue = C(0x1a6ad0);
  const scarlet = kind === 'scarlet';
  addEllipsoid(mb, new THREE.Vector3(0, 0, 0), 0.065, 0.07, 0.15, { w: 12, h: 9, colorFn: (x, y) => (scarlet ? red : y < -0.1 ? byYellow : byBlue) });
  addEllipsoid(mb, new THREE.Vector3(0, 0.04, 0.15), 0.05, 0.052, 0.055, { w: 12, h: 9, colorFn: (x, y, z) => (z > 0.55 && Math.abs(x) > 0.25 && y < 0.5 ? white : scarlet ? red : y > 0.3 ? green : byBlue) });
  mb.setColor(C(0x101010));
  for (const s of [-1, 1]) addEllipsoid(mb, new THREE.Vector3(s * 0.035, 0.05, 0.18), 0.008, 0.008, 0.008, { w: 6, h: 4 });
  // hooked beak
  const beak = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; beak.push(new THREE.Vector3(0, 0.035 - t * t * 0.07, 0.195 + Math.sin(t * 1.4) * 0.05)); }
  addTube(mb, beak, beak.map((_, i) => 0.026 * (1 - i / 7)), { radial: 7, capEnd: true, colorFn: () => (scarlet ? C(0xe8e0c8) : C(0x202020)) });
  mb.setColor(C(0x202020));
  addEllipsoid(mb, new THREE.Vector3(0, 0.0, 0.2), 0.02, 0.016, 0.022, { w: 6, h: 4 });
  // feet
  mb.setColor(C(0x4a4a4a));
  for (const s of [-1, 1]) addTube(mb, [new THREE.Vector3(s * 0.025, -0.05, 0.02), new THREE.Vector3(s * 0.03, -0.09, 0.03)], [0.008, 0.007], { radial: 4 });
  const wing = wingGeometry(0.46, 0.17, (t, e) => (scarlet ? (t < 0.32 ? red : t < 0.5 ? (e ? green : yellow) : blue) : (t < 0.6 ? byBlue : C(0x1a3a8a))));
  const tail = tailGeometry(0.45, 0.05, 0.015, (t) => (scarlet ? (t < 0.6 ? red : blue) : byBlue));
  return assembleBird({ body: mb.toGeometry(), wing, tail, wingPos: new THREE.Vector3(0.04, 0.04, 0.05), tailPos: new THREE.Vector3(0, -0.02, -0.13) });
}

export function buildToucan() {
  const mb = new MeshBuilder();
  const black = C(0x101010), bib = C(0xf8f0d0), red = C(0xd02010);
  addEllipsoid(mb, new THREE.Vector3(0, 0, 0), 0.06, 0.075, 0.12, { w: 12, h: 9, colorFn: (x, y, z) => (z > 0.35 && y > -0.2 ? bib : y < -0.6 && z < -0.3 ? red : black) });
  addEllipsoid(mb, new THREE.Vector3(0, 0.06, 0.1), 0.045, 0.05, 0.05, { w: 10, h: 8, colorFn: (x, y, z) => (z > 0.1 && y < 0.0 ? bib : black) });
  mb.setColor(C(0x2a80e0));
  for (const s of [-1, 1]) addEllipsoid(mb, new THREE.Vector3(s * 0.034, 0.07, 0.12), 0.014, 0.014, 0.012, { w: 6, h: 4 });
  // huge beak
  const beak = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; beak.push(new THREE.Vector3(0, 0.06 - t * t * 0.03, 0.13 + t * 0.19)); }
  addTube(mb, beak, beak.map((_, i) => { const t = i / 8; return 0.034 * (1 - t * 0.85); }), {
    radial: 8, capEnd: true, colorFn: (i) => (i > 7 ? black : i > 5 ? C(0xe86010) : C(0xf89020)),
    radiusFn: (i, th) => 0.75 + 0.35 * Math.abs(Math.sin(th)),
  });
  mb.setColor(C(0x3a3a3a));
  for (const s of [-1, 1]) addTube(mb, [new THREE.Vector3(s * 0.02, -0.06, 0.01), new THREE.Vector3(s * 0.025, -0.09, 0.02)], [0.006, 0.006], { radial: 4 });
  const wing = wingGeometry(0.22, 0.12, () => black, 0.2);
  const tail = tailGeometry(0.16, 0.035, 0.03, () => black);
  return assembleBird({ body: mb.toGeometry(), wing, tail, wingPos: new THREE.Vector3(0.035, 0.03, 0.03), tailPos: new THREE.Vector3(0, -0.01, -0.1) });
}

export function buildHummingbird() {
  const mb = new MeshBuilder();
  const g1 = C(0x1a8a40), throat = C(0xe0103a);
  addEllipsoid(mb, new THREE.Vector3(0, 0, 0), 0.011, 0.012, 0.025, { w: 8, h: 6, colorFn: (x, y, z) => (y < -0.3 && z > 0.2 ? throat : g1) });
  addEllipsoid(mb, new THREE.Vector3(0, 0.008, 0.024), 0.009, 0.009, 0.009, { w: 8, h: 6, colorFn: () => g1 });
  mb.setColor(C(0x101010));
  addTube(mb, [new THREE.Vector3(0, 0.006, 0.032), new THREE.Vector3(0, 0.004, 0.06)], [0.0016, 0.0008], { radial: 4 });
  const wing = wingGeometry(0.05, 0.016, () => C(0x2a3a2a), 0.1);
  const tail = tailGeometry(0.03, 0.008, 0.012, () => C(0x1a5a30));
  const b = assembleBird({ body: mb.toGeometry(), wing, tail, wingPos: new THREE.Vector3(0.006, 0.006, 0.006), tailPos: new THREE.Vector3(0, 0, -0.022) });
  b.children[0].material = creatureMat({ vertexColors: true, roughness: 0.25, metalness: 0.6 }, 'humming');
  for (const w of b.userData.wings) { w.pivot.children[0].material = creatureMat({ vertexColors: true, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }, 'hwing'); }
  return b;
}

export function buildHarpy() {
  const mb = new MeshBuilder();
  const grey = C(0x8a8a88), dark = C(0x2a2a2a), white = C(0xf0f0ec);
  addEllipsoid(mb, new THREE.Vector3(0, 0, 0), 0.16, 0.26, 0.15, { w: 12, h: 10, colorFn: (x, y, z) => (z > 0.2 && y < 0.35 ? (y > 0.15 ? dark : white) : dark) });
  addEllipsoid(mb, new THREE.Vector3(0, 0.3, 0.04), 0.1, 0.1, 0.1, { w: 10, h: 8, colorFn: () => grey });
  mb.setColor(dark);
  for (const s of [-1, 1]) addTube(mb, [new THREE.Vector3(s * 0.04, 0.37, 0.0), new THREE.Vector3(s * 0.06, 0.47, -0.04)], [0.025, 0.004], { radial: 5, capEnd: true });
  mb.setColor(C(0x1a1a1a));
  addTube(mb, [new THREE.Vector3(0, 0.3, 0.12), new THREE.Vector3(0, 0.27, 0.16), new THREE.Vector3(0, 0.24, 0.155)], [0.025, 0.018, 0.006], { radial: 6, capEnd: true });
  mb.setColor(C(0xe0c040));
  for (const s of [-1, 1]) addTube(mb, [new THREE.Vector3(s * 0.06, -0.22, 0.04), new THREE.Vector3(s * 0.06, -0.3, 0.06)], [0.025, 0.02], { radial: 5 });
  const body = new THREE.Mesh(mb.toGeometry(), bodyMat());
  body.castShadow = true;
  const g = new THREE.Group(); g.add(body);
  return g;
}

export class Birds {
  constructor(scene, { forest, plants, terrain, rng, near }) {
    this.flyers = []; this.perched = []; this.hummers = []; this.toucans = [];
    this.rng = rng;
    // flying macaw pairs
    for (let p = 0; p < 3; p++) {
      const center = new THREE.Vector3(rng.range(-50, 50), rng.range(50, 64), rng.range(-50, 50));
      const radius = rng.range(45, 85), speed = rng.range(9, 12) / radius, phase = rng.range(0, 6.28);
      const kind = p === 1 ? 'blueyellow' : 'scarlet';
      for (let k = 0; k < 2; k++) {
        const b = buildMacaw(kind);
        scene.add(b);
        this.flyers.push({ obj: b, center, radius: radius + k * 2.2, speed, phase: phase - k * 0.05, k, wob: rng.range(0, 6) });
      }
    }
    // perched macaws on emergent limbs
    const high = forest.perches.filter((q) => q.p.y > 34 && q.tree && (q.tree.type === 'kapok' || q.tree.type === 'brazilnut'));
    for (let i = 0; i < 4 && high.length; i++) {
      const per = high.splice(rng.int(0, high.length - 1), 1)[0];
      for (let k = 0; k < 2; k++) {
        const b = buildMacaw(i % 2 ? 'blueyellow' : 'scarlet');
        b.position.copy(per.p).add(new THREE.Vector3(k * 0.25, 0.12, 0));
        b.rotation.y = rng.range(0, 6.28);
        b.rotateX(-0.5);
        b.userData.fold();
        if (b.userData.tail) b.userData.tail.rotation.x = -1.0;
        scene.add(b);
        this.perched.push({ obj: b, base: b.quaternion.clone(), ph: rng.range(0, 6) });
      }
    }
    // toucans
    const mid = forest.perches.filter((q) => q.p.y > 12 && q.p.y < 38 && q.tree);
    for (let i = 0; i < 7 && mid.length; i++) {
      const b = buildToucan();
      const per = rng.pick(mid);
      b.position.copy(per.p).add(new THREE.Vector3(0, 0.1, 0));
      b.userData.fold();
      scene.add(b);
      this.toucans.push({ obj: b, perch: per, from: b.position.clone(), to: b.position.clone(), t: 1, wait: rng.range(3, 12), yaw: rng.range(0, 6.28), rng: rng.fork(i), mid });
    }
    // hummingbirds at flowers
    const flowers = plants.flowers;
    for (let i = 0; i < 10 && flowers.length; i++) {
      const home = i < 4 ? near : flowers[rng.int(0, flowers.length - 1)];
      const local = flowers.filter((f) => f.distanceToSquared(home) < 30 * 30);
      if (local.length < 2) continue;
      const b = buildHummingbird();
      const start = rng.pick(local).clone();
      b.position.copy(start);
      scene.add(b);
      this.hummers.push({ obj: b, flowers: local, target: start.clone(), pos: start.clone(), vel: new THREE.Vector3(), hover: 0, rng: rng.fork(50 + i) });
    }
    // harpy eagle on the tallest emergent
    const tallest = forest.trees.filter((t) => t.type === 'kapok' || t.type === 'brazilnut').sort((a, b) => b.height - a.height)[0];
    if (tallest) {
      const top = forest.perches.filter((q) => q.tree === tallest).sort((a, b) => b.p.y - a.p.y)[0];
      if (top) {
        const h = buildHarpy();
        h.position.copy(top.p).add(new THREE.Vector3(0, 0.3, 0));
        scene.add(h);
        this.harpy = h;
      }
    }
  }
  update(dt, t, cam) {
    for (const f of this.flyers) {
      const a = f.phase + t * f.speed;
      const p = new THREE.Vector3(f.center.x + Math.cos(a) * f.radius, f.center.y + Math.sin(t * 0.3 + f.wob) * 3 + f.k * 0.8, f.center.z + Math.sin(a) * f.radius);
      const dir = new THREE.Vector3(-Math.sin(a), Math.cos(t * 0.3 + f.wob) * 0.05, Math.cos(a));
      f.obj.position.copy(p);
      faceDir(f.obj, dir, -0.35, 1);
      const glide = Math.sin(t * 0.5 + f.wob) > 0.6;
      f.obj.userData.flap(t * 22 + f.k, glide ? 0.05 : 0.75);
      f.obj.visible = p.distanceToSquared(cam) < 400 * 400;
    }
    for (const p of this.perched) {
      p.obj.children[0].rotation.y = Math.sin(t * 0.7 + p.ph) * 0.25;
    }
    for (const b of this.toucans) {
      if (b.t < 1) {
        b.t = Math.min(1, b.t + dt / b.dur);
        const s = b.t;
        b.obj.position.lerpVectors(b.from, b.to, s);
        b.obj.position.y += Math.sin(Math.PI * s) * Math.min(3, b.from.distanceTo(b.to) * 0.3);
        b.obj.userData.flap(t * 30, 0.8);
        if (b.t >= 1) { b.obj.userData.fold(); b.wait = b.rng.range(4, 14); }
      } else {
        b.wait -= dt;
        b.obj.children[0].rotation.y = Math.sin(t * 0.9 + b.yaw) * 0.4;
        if (b.wait < 0) {
          const near = b.mid.filter((q) => q.p.distanceToSquared(b.obj.position) < 18 * 18 && q !== b.perch);
          if (near.length) {
            b.perch = b.rng.pick(near);
            b.from.copy(b.obj.position); b.to.copy(b.perch.p).add(new THREE.Vector3(0, 0.1, 0));
            b.t = 0; b.dur = Math.max(0.6, b.from.distanceTo(b.to) / 5);
            const d = b.to.clone().sub(b.from); d.y = 0;
            faceDir(b.obj, d, 0, 1);
          } else b.wait = 5;
        }
      }
    }
    for (const h of this.hummers) {
      const d2 = h.pos.distanceToSquared(cam);
      h.obj.visible = d2 < 50 * 50;
      if (h.hover > 0) {
        h.hover -= dt;
        h.pos.lerp(h.target, 1 - Math.exp(-dt * 6));
        h.obj.position.copy(h.pos).add(new THREE.Vector3(Math.sin(t * 9) * 0.004, Math.sin(t * 7) * 0.006, 0));
        if (h.hover <= 0) {
          const f = h.rng.pick(h.flowers);
          h.target.copy(f).add(new THREE.Vector3(h.rng.range(-0.05, 0.05), 0.02, h.rng.range(-0.05, 0.05)));
        }
      } else {
        const to = h.target.clone().sub(h.pos);
        const d = to.length();
        to.multiplyScalar(Math.min(6, d * 3) / Math.max(d, 1e-4));
        h.vel.lerp(to, 1 - Math.exp(-dt * 6));
        h.pos.addScaledVector(h.vel, dt);
        h.obj.position.copy(h.pos);
        if (d < 0.08) h.hover = h.rng.range(1.2, 3.5);
        faceDir(h.obj, new THREE.Vector3(h.vel.x, 0, h.vel.z), 0, 1 - Math.exp(-dt * 10));
      }
      h.obj.userData.flap(t * 260, 1.1);
    }
    if (this.harpy) this.harpy.children[0].rotation.y = Math.sin(t * 0.2) * 0.8;
  }
}

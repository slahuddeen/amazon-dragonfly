// Frogs, sloths, an emerald tree boa, capybaras and caimans.
import * as THREE from 'three';
import { MeshBuilder, addEllipsoid, addTube } from '../core/geometry.js';
import { creatureMat, faceDir } from './common.js';
import { createNoise } from '../core/noise.js';

const C = (h) => new THREE.Color(h);
const nz = createNoise(777);

// ---------------------------------------------------------------- frogs
const FROGS = {
  azureus: { body: 0x1a50d0, spot: 0x05060a, leg: 0x10308a, spots: true },
  leucomelas: { body: 0xf0d010, spot: 0x08080a, leg: 0xf0d010, bands: true },
  pumilio: { body: 0xe01a10, spot: 0x200808, leg: 0x1a40b0 },
  terribilis: { body: 0xf0c020, spot: 0xf0c020, leg: 0xe0b010 },
  redeye: { body: 0x40c030, spot: 0x40c030, leg: 0x3060d0, tree: true },
};
function buildFrog(kind) {
  const F = FROGS[kind];
  const s = F.tree ? 1.8 : 1;
  const mb = new MeshBuilder();
  const col = (x, y, z) => {
    if (F.spots && nz.noise3(x * 4, y * 4, z * 4) > 0.35) return C(F.spot);
    if (F.bands && Math.sin(z * 9 + nz.noise2(x * 3, y * 3) * 2) > 0.55) return C(F.spot);
    if (F.tree && y < -0.2) return C(0xf0f0d0);
    if (F.tree && Math.abs(x) > 0.75) return C(0x2a5ad0);
    return C(F.body);
  };
  addEllipsoid(mb, new THREE.Vector3(0, 0.008 * s, 0), 0.008 * s, 0.006 * s, 0.012 * s, { w: 10, h: 7, colorFn: col });
  addEllipsoid(mb, new THREE.Vector3(0, 0.01 * s, 0.01 * s), 0.0075 * s, 0.005 * s, 0.006 * s, { w: 10, h: 7, colorFn: col });
  for (const sd of [-1, 1]) {
    mb.setColor(F.tree ? C(0xd01010) : C(0x050505));
    addEllipsoid(mb, new THREE.Vector3(sd * 0.0052 * s, 0.0135 * s, 0.012 * s), 0.0027 * s, 0.0027 * s, 0.0027 * s, { w: 8, h: 6 });
    mb.setColor(C(F.leg));
    // folded legs
    addTube(mb, [new THREE.Vector3(sd * 0.006 * s, 0.006 * s, 0.008 * s), new THREE.Vector3(sd * 0.011 * s, 0.002 * s, 0.012 * s), new THREE.Vector3(sd * 0.01 * s, 0.0005, 0.016 * s)], [0.0016 * s, 0.0013 * s, 0.001 * s], { radial: 4 });
    addTube(mb, [new THREE.Vector3(sd * 0.006 * s, 0.006 * s, -0.008 * s), new THREE.Vector3(sd * 0.014 * s, 0.004 * s, -0.004 * s), new THREE.Vector3(sd * 0.008 * s, 0.001, -0.012 * s), new THREE.Vector3(sd * 0.013 * s, 0.0005, -0.016 * s)], [0.0024 * s, 0.002 * s, 0.0015 * s, 0.001 * s], { radial: 4 });
  }
  const m = new THREE.Mesh(mb.toGeometry(), creatureMat({ vertexColors: true, roughness: 0.18, metalness: 0.05 }, 'frog'));
  m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  return g;
}

export class Frogs {
  constructor(scene, { spots, rng }) {
    this.list = [];
    for (const sp of spots) {
      const kind = sp.kind || rng.pick(['azureus', 'azureus', 'leucomelas', 'pumilio', 'terribilis']);
      const f = buildFrog(kind);
      f.position.copy(sp.p);
      f.rotation.y = rng.range(0, 6.28);
      scene.add(f);
      this.list.push({ obj: f, home: sp.p.clone(), getY: sp.getY, wait: rng.range(2, 10), hop: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), rng: rng.fork(this.list.length), canHop: sp.canHop !== false, ph: rng.range(0, 6) });
    }
  }
  update(dt, t, cam) {
    for (const f of this.list) {
      const near = f.obj.position.distanceToSquared(cam) < 25 * 25;
      f.obj.visible = near;
      if (!near) continue;
      f.obj.children[0].scale.y = 1 + Math.sin(t * 6 + f.ph) * 0.04; // breathing
      if (f.hop < 1) {
        f.hop = Math.min(1, f.hop + dt * 3);
        f.obj.position.lerpVectors(f.from, f.to, f.hop);
        f.obj.position.y += Math.sin(Math.PI * f.hop) * 0.04;
      } else if (f.canHop) {
        f.wait -= dt;
        if (f.wait < 0) {
          f.wait = f.rng.range(2, 9);
          f.from.copy(f.obj.position);
          const a = f.rng.range(0, 6.28), r = f.rng.range(0.04, 0.12);
          f.to.set(f.home.x + Math.cos(a) * r, 0, f.home.z + Math.sin(a) * r);
          f.to.y = f.getY ? f.getY(f.to.x, f.to.z) : f.home.y;
          f.hop = 0;
          faceDir(f.obj, f.to.clone().sub(f.from).setY(0), 0, 1);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- sloth
export function buildSloth() {
  const mb = new MeshBuilder();
  const fur = (x, y, z) => C(0x8a7a62).lerp(C(0x5a6a3a), Math.max(0, nz.noise3(x * 3, y * 3, z * 3)) * 0.8); // algae-tinged fur
  const shag = (x, y, z) => 1 + 0.07 * nz.noise3(x * 9, y * 9, z * 9);
  addEllipsoid(mb, new THREE.Vector3(0, 0, 0), 0.16, 0.13, 0.26, { w: 14, h: 10, colorFn: fur, disp: shag });
  addEllipsoid(mb, new THREE.Vector3(0, -0.02, 0.27), 0.085, 0.08, 0.08, {
    w: 12, h: 9, disp: shag,
    colorFn: (x, y, z) => (z > 0.55 ? (Math.abs(x) > 0.25 && Math.abs(x) < 0.6 && y > -0.1 && y < 0.35 ? C(0x2a1a10) : C(0xd8c8a8)) : fur(x, y, z)),
  });
  mb.setColor(C(0x101010));
  for (const s of [-1, 1]) addEllipsoid(mb, new THREE.Vector3(s * 0.03, 0.0, 0.345), 0.008, 0.008, 0.006, { w: 6, h: 4 });
  addEllipsoid(mb, new THREE.Vector3(0, -0.025, 0.352), 0.014, 0.01, 0.008, { w: 6, h: 4 });
  const m = new THREE.Mesh(mb.toGeometry(), creatureMat({ vertexColors: true, roughness: 0.95 }, 'fur'));
  m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  g.userData.head = m;
  return g;
}

export class Sloths {
  constructor(scene, { forest, rng, batch }) {
    this.list = [];
    const cands = forest.hangs.filter((h) => h.p.y > 10 && h.p.y < 30 && h.r > 0.12 && h.tree && h.tree.type !== 'cecropia');
    for (let i = 0; i < 3 && cands.length; i++) {
      const h = cands.splice(rng.int(0, cands.length - 1), 1)[0];
      const s = buildSloth();
      // hang below the branch, back down
      const body = h.p.clone().add(new THREE.Vector3(0, -0.42, 0));
      s.position.copy(body);
      s.rotation.set(Math.PI, rng.range(0, 6.28), 0);
      scene.add(s);
      // limbs gripping the branch
      const mb = new MeshBuilder();
      const fur = C(0x7a6a52);
      const q = s.quaternion;
      for (const [x, z] of [[-0.12, 0.15], [0.12, 0.15], [-0.12, -0.15], [0.12, -0.15]]) {
        const shoulder = new THREE.Vector3(x, 0.05, z).applyQuaternion(q).add(body);
        const grip = new THREE.Vector3(x * 1.4, 0, z * 1.2).applyQuaternion(q);
        grip.y = 0; grip.add(h.p).add(new THREE.Vector3(0, h.r * 0.4, 0));
        const elbow = shoulder.clone().lerp(grip, 0.5).add(new THREE.Vector3(0, -0.04, 0));
        mb.setColor(fur);
        addTube(mb, [shoulder, elbow, grip], [0.045, 0.035, 0.025], { radial: 7 });
        mb.setColor(C(0x2a2018));
        addTube(mb, [grip, grip.clone().add(new THREE.Vector3(0, h.r * 0.5 + 0.04, 0.02))], [0.01, 0.004], { radial: 4, capEnd: true });
      }
      const limbs = new THREE.Mesh(mb.toGeometry(), creatureMat({ vertexColors: true, roughness: 0.95 }, 'fur'));
      limbs.castShadow = true;
      scene.add(limbs);
      this.list.push({ obj: s, ph: rng.range(0, 6), base: s.position.clone() });
    }
  }
  update(dt, t) {
    for (const s of this.list) {
      s.obj.position.y = s.base.y + Math.sin(t * 0.25 + s.ph) * 0.015;
      s.obj.children[0].rotation.z = Math.sin(t * 0.15 + s.ph) * 0.05;
    }
  }
}

// ---------------------------------------------------------------- emerald tree boa coiled over a branch
export function buildBoa(center, axis, rng) {
  const mb = new MeshBuilder();
  const pts = [], radii = [];
  const side = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
  const loops = 4, R = 0.11, steps = 120;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = t * loops * Math.PI * 2;
    const along = (t - 0.5) * 0.28;
    const p = center.clone().addScaledVector(axis, along)
      .addScaledVector(side, Math.cos(ang) * R * 1.1)
      .add(new THREE.Vector3(0, Math.sin(ang) * R * 0.55 + 0.05, 0));
    pts.push(p);
    radii.push(0.026 * Math.min(1, Math.min(t * 6, (1 - t) * 12 + 0.25)));
  }
  // head resting on top of the coils
  const last = pts[pts.length - 1];
  const headDir = axis.clone().multiplyScalar(-1);
  for (let i = 1; i <= 6; i++) { const p = last.clone().addScaledVector(headDir, i * 0.022); p.y = center.y + R * 0.75; pts.push(p); radii.push(0.024 - (i > 4 ? (i - 4) * 0.006 : 0)); }
  addTube(mb, pts, radii, {
    radial: 9, capEnd: true,
    colorFn: (i) => (i % 9 === 0 && i < steps ? C(0xf0f8e8) : i > steps - 2 ? C(0x3ab840) : C(0x18a038)),
  });
  mb.setColor(C(0xe8e030));
  addEllipsoid(mb, pts[pts.length - 3].clone().add(new THREE.Vector3(0, 0.012, 0)).addScaledVector(side, 0.012), 0.004, 0.004, 0.004, { w: 6, h: 4 });
  addEllipsoid(mb, pts[pts.length - 3].clone().add(new THREE.Vector3(0, 0.012, 0)).addScaledVector(side, -0.012), 0.004, 0.004, 0.004, { w: 6, h: 4 });
  const m = new THREE.Mesh(mb.toGeometry(), creatureMat({ vertexColors: true, roughness: 0.25, metalness: 0.05 }, 'snake'));
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- capybara
function buildCapybara() {
  const mb = new MeshBuilder();
  const fur = (x, y) => (y < -0.4 ? C(0x7a5232) : C(0x9a6a40));
  addEllipsoid(mb, new THREE.Vector3(0, 0.38, 0), 0.24, 0.22, 0.45, { w: 14, h: 10, colorFn: fur, disp: (x, y, z) => 1 + 0.03 * nz.noise3(x * 6, y * 6, z * 6) });
  addEllipsoid(mb, new THREE.Vector3(0, 0.46, 0.5), 0.13, 0.15, 0.2, { w: 12, h: 8, colorFn: fur });
  mb.setColor(C(0x3a2618));
  addEllipsoid(mb, new THREE.Vector3(0, 0.43, 0.68), 0.09, 0.08, 0.05, { w: 8, h: 6 });
  for (const s of [-1, 1]) {
    mb.setColor(C(0x101010)); addEllipsoid(mb, new THREE.Vector3(s * 0.11, 0.53, 0.55), 0.016, 0.016, 0.016, { w: 6, h: 4 });
    mb.setColor(C(0x6a4228)); addEllipsoid(mb, new THREE.Vector3(s * 0.09, 0.62, 0.42), 0.03, 0.035, 0.015, { w: 6, h: 4 });
  }
  mb.setColor(C(0x6a4a2c));
  for (const [x, z] of [[-0.14, 0.28], [0.14, 0.28], [-0.15, -0.28], [0.15, -0.28]]) addTube(mb, [new THREE.Vector3(x, 0.25, z), new THREE.Vector3(x, 0.0, z + 0.02)], [0.06, 0.045], { radial: 6 });
  const m = new THREE.Mesh(mb.toGeometry(), creatureMat({ vertexColors: true, roughness: 0.9 }, 'fur'));
  m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  return g;
}
export class Capybaras {
  constructor(scene, { terrain, rng, spot }) {
    this.list = [];
    this.terrain = terrain;
    for (let i = 0; i < 4; i++) {
      const c = buildCapybara();
      const s = i === 3 ? 0.6 : rng.range(0.85, 1.05);
      c.scale.setScalar(s);
      const p = spot.clone().add(new THREE.Vector3(rng.range(-3, 3), 0, rng.range(-2, 2)));
      p.y = Math.max(terrain.height(p.x, p.z), -0.25);
      c.position.copy(p);
      c.rotation.y = rng.range(0, 6.28);
      scene.add(c);
      this.list.push({ obj: c, ph: rng.range(0, 6), home: p.clone(), target: p.clone(), wait: rng.range(3, 12), rng: rng.fork(i) });
    }
  }
  update(dt, t, cam) {
    for (const c of this.list) {
      const head = c.obj.children[0];
      head.rotation.x = Math.max(0, Math.sin(t * 0.6 + c.ph)) * 0.12;
      c.wait -= dt;
      if (c.wait < 0) {
        c.wait = c.rng.range(5, 15);
        c.target.set(c.home.x + c.rng.range(-3, 3), 0, c.home.z + c.rng.range(-3, 3));
      }
      const to = c.target.clone().sub(c.obj.position); to.y = 0;
      const d = to.length();
      if (d > 0.1) {
        to.multiplyScalar(Math.min(0.35, d) * dt / d);
        c.obj.position.add(to);
        faceDir(c.obj, to, 0, 1 - Math.exp(-dt * 2));
        c.obj.rotation.x = 0; c.obj.rotation.z = 0;
      }
      c.obj.position.y = Math.max(this.terrain.height(c.obj.position.x, c.obj.position.z), -0.32);
    }
  }
}

// ---------------------------------------------------------------- caiman (mostly submerged)
function buildCaiman() {
  const mb = new MeshBuilder();
  const dark = C(0x2a2e1a), belly = C(0x6a6a4a);
  const pts = [], radii = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push(new THREE.Vector3(0, 0, 1.1 - t * 2.4));
    radii.push(t < 0.12 ? 0.05 + t * 0.6 : t < 0.5 ? 0.13 + Math.sin((t - 0.12) * 8) * 0.04 : 0.13 * (1 - (t - 0.5) * 1.9));
  }
  addTube(mb, pts, radii, { radial: 10, capEnd: true, colorFn: () => dark, radiusFn: (i, th) => (Math.sin(th) > 0.6 ? 1.05 + 0.08 * (i % 2) : Math.sin(th) < -0.3 ? 0.8 : 1) });
  mb.setColor(C(0xc0a020));
  for (const s of [-1, 1]) addEllipsoid(mb, new THREE.Vector3(s * 0.055, 0.075, 0.82), 0.025, 0.02, 0.025, { w: 8, h: 6 });
  mb.setColor(C(0x101010));
  for (const s of [-1, 1]) addEllipsoid(mb, new THREE.Vector3(s * 0.06, 0.088, 0.835), 0.008, 0.012, 0.004, { w: 6, h: 4 });
  // dorsal scutes
  mb.setColor(C(0x22261a));
  for (let i = 4; i < 20; i++) for (const s of [-1, 1]) addEllipsoid(mb, new THREE.Vector3(s * 0.05, 0.12, 0.75 - i * 0.1), 0.02, 0.02, 0.035, { w: 5, h: 3 });
  const m = new THREE.Mesh(mb.toGeometry(), creatureMat({ vertexColors: true, roughness: 0.4 }, 'caiman'));
  const g = new THREE.Group(); g.add(m);
  return g;
}
export class Caimans {
  constructor(scene, { terrain, rng, xs }) {
    this.list = [];
    this.terrain = terrain;
    for (const x of xs) {
      const c = buildCaiman();
      const z = terrain.riverZ(x) + rng.range(-2, 2);
      c.position.set(x, -0.085, z);
      scene.add(c);
      this.list.push({ obj: c, x0: x, ph: rng.range(0, 6), dir: rng.sign() });
    }
  }
  update(dt, t) {
    for (const c of this.list) {
      const x = c.x0 + Math.sin(t * 0.02 + c.ph) * 12;
      const z = this.terrain.riverZ(x) + Math.sin(t * 0.05 + c.ph) * 2;
      const dx = Math.cos(t * 0.02 + c.ph) * c.dir;
      c.obj.position.x = x; c.obj.position.z = z;
      c.obj.position.y = -0.09 + Math.sin(t * 0.8 + c.ph) * 0.006;
      c.obj.rotation.y = Math.atan2(dx, (this.terrain.riverZ(x + 0.5) - this.terrain.riverZ(x - 0.5)) * dx) ;
    }
  }
}

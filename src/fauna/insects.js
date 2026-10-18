// Insects & arachnids: morpho and other butterflies, dragonflies, damselflies, midge swarms,
// leafcutter ants marching to their nest, and golden orb-weaver webs.
import * as THREE from 'three';
import { canvasTexture, creatureMat, wingMat, faceDir } from './common.js';
import { MeshBuilder, addEllipsoid, addTube } from '../core/geometry.js';
import { buildDragonfly } from '../player/dragonfly.js';
import { U, WORLD } from '../core/shared.js';

const C = (h) => new THREE.Color(h);

// ---------------------------------------------------------------- butterflies
const BUTTERFLY_SPECIES = {
  morpho: { span: 0.15, draw: (x, w, h) => {
    wingShape(x, w, h, (p) => {
      const g = x.createRadialGradient(0, h * 0.5, 10, 0, h * 0.5, w * 0.95);
      g.addColorStop(0, '#0a2a8a'); g.addColorStop(0.4, '#1a7af0'); g.addColorStop(0.75, '#38b8ff'); g.addColorStop(0.86, '#101018'); g.addColorStop(1, '#101018');
      x.fillStyle = g; p(); x.fill();
      x.fillStyle = '#f0f0f0';
      for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(w * (0.78 + i * 0.035), h * (0.12 + i * 0.07), 4, 0, 6.3); x.fill(); }
    });
  } },
  heliconius: { span: 0.08, draw: (x, w, h) => {
    wingShape(x, w, h, (p) => {
      x.fillStyle = '#121010'; p(); x.fill();
      x.save(); p(); x.clip();
      x.fillStyle = '#e02818'; x.beginPath(); x.ellipse(w * 0.55, h * 0.3, w * 0.25, h * 0.08, -0.4, 0, 6.3); x.fill();
      x.fillStyle = '#f8d020'; x.fillRect(w * 0.08, h * 0.62, w * 0.5, h * 0.06);
      x.restore();
    }, 1.3);
  } },
  glasswing: { span: 0.06, draw: (x, w, h) => {
    wingShape(x, w, h, (p) => {
      x.fillStyle = 'rgba(220,235,240,0.35)'; p(); x.fill();
      x.strokeStyle = '#3a2010'; x.lineWidth = 7; p(); x.stroke();
      x.fillStyle = '#f0f0f0'; x.fillRect(w * 0.7, h * 0.12, 18, 6);
    }, 1.2);
  }, glass: true },
  sulphur: { span: 0.065, draw: (x, w, h) => {
    wingShape(x, w, h, (p) => {
      const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#f8c020'); g.addColorStop(1, '#ffe860');
      x.fillStyle = g; p(); x.fill();
    }, 0.95);
  } },
  owl: { span: 0.13, draw: (x, w, h) => {
    wingShape(x, w, h, (p) => {
      x.fillStyle = '#6a5038'; p(); x.fill();
      x.save(); p(); x.clip();
      x.fillStyle = '#d8c090'; x.fillRect(0, h * 0.4, w, h * 0.05);
      x.fillStyle = '#1a1208'; x.beginPath(); x.arc(w * 0.45, h * 0.75, 26, 0, 6.3); x.fill();
      x.fillStyle = '#e8c860'; x.beginPath(); x.arc(w * 0.45, h * 0.75, 26, 0, 6.3); x.lineWidth = 6; x.strokeStyle = '#e8c860'; x.stroke();
      x.restore();
    });
  } },
};
function wingShape(x, w, h, paint, elong = 1) {
  const p = () => {
    x.beginPath();
    x.moveTo(2, h * 0.46);
    x.bezierCurveTo(w * 0.3 * elong, h * 0.02, w * 0.9, -h * 0.02, w * 0.96, h * 0.2);
    x.bezierCurveTo(w * 0.98, h * 0.36, w * 0.7, h * 0.46, w * 0.62, h * 0.5);
    x.bezierCurveTo(w * 0.8, h * 0.62, w * 0.7, h * 0.98, w * 0.38, h * 0.96);
    x.bezierCurveTo(w * 0.15, h * 0.95, w * 0.05, h * 0.7, 2, h * 0.54);
    x.closePath();
  };
  x.clearRect(0, 0, w, h);
  paint(p);
}

function buildButterfly(kind) {
  const sp = BUTTERFLY_SPECIES[kind];
  const g = new THREE.Group();
  const mb = new MeshBuilder();
  mb.setColor(C(0x1a1410));
  addEllipsoid(mb, new THREE.Vector3(0, 0, 0), 0.004, 0.004, 0.018, { w: 6, h: 5 });
  addEllipsoid(mb, new THREE.Vector3(0, 0.001, 0.02), 0.003, 0.003, 0.003, { w: 6, h: 4 });
  for (const s of [-1, 1]) addTube(mb, [new THREE.Vector3(s * 0.001, 0.002, 0.022), new THREE.Vector3(s * 0.006, 0.008, 0.038)], [0.0005, 0.0005], { radial: 3 });
  const body = new THREE.Mesh(mb.toGeometry(), creatureMat({ vertexColors: true }));
  g.add(body);
  if (!sp.tex) sp.tex = canvasTexture(256, 256, sp.draw);
  if (!sp.mat) {
    sp.mat = wingMat(sp.tex, kind === 'morpho' ? { emissive: new THREE.Color(0x0a3aa0), emissiveIntensity: 0.6, emissiveMap: sp.tex, roughness: 0.25, metalness: 0.3 } : {});
    if (sp.glass) { sp.mat.transparent = true; sp.mat.alphaTest = 0.05; sp.mat.depthWrite = false; }
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2); geo.translate(0.5, 0, 0);
  const half = sp.span / 2;
  const wings = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    const w = new THREE.Mesh(geo, sp.mat);
    w.scale.set(half * s, 1, half * 1.05);
    w.rotation.y = 0;
    pivot.add(w);
    g.add(pivot);
    wings.push({ pivot, s });
  }
  g.userData.wings = wings;
  return g;
}

export class Butterflies {
  constructor(scene, { terrain, plants, rng, near }) {
    this.list = [];
    const kinds = ['morpho', 'morpho', 'morpho', 'heliconius', 'heliconius', 'glasswing', 'sulphur', 'owl'];
    const R = WORLD.radius - 10;
    for (let i = 0; i < 46; i++) {
      const kind = i < 10 ? 'morpho' : rng.pick(kinds);
      const obj = buildButterfly(kind);
      let home;
      if (i < 14) home = near.clone().add(new THREE.Vector3(rng.range(-14, 14), 0, rng.range(-14, 14)));
      else if (kind === 'sulphur') { const x = rng.range(-R, R); home = new THREE.Vector3(x, 0, terrain.riverZ(x) + rng.range(-8, 8)); }
      else home = new THREE.Vector3(rng.range(-R, R), 0, rng.range(-R, R));
      home.y = Math.max(0, terrain.height(home.x, home.z));
      const b = {
        obj, kind, home, pos: home.clone().add(new THREE.Vector3(0, rng.range(0.6, 3), 0)), vel: new THREE.Vector3(),
        target: new THREE.Vector3(), timer: 0, phase: rng.range(0, 10), freq: kind === 'morpho' ? 5 : kind === 'owl' ? 4 : 9,
        rng: rng.fork(i), terrain,
      };
      obj.position.copy(b.pos);
      scene.add(obj);
      this.list.push(b);
    }
  }
  update(dt, t, cam) {
    for (const b of this.list) {
      const d2 = b.pos.distanceToSquared(cam);
      b.obj.visible = d2 < 70 * 70;
      if (!b.obj.visible && d2 > 120 * 120) continue;
      b.timer -= dt;
      if (b.timer <= 0) {
        const r = b.rng;
        b.timer = r.range(1.5, 4.5);
        b.target.set(b.home.x + r.range(-9, 9), 0, b.home.z + r.range(-9, 9));
        b.target.y = Math.max(0, b.terrain.height(b.target.x, b.target.z)) + r.range(0.4, b.kind === 'morpho' ? 3 : 5);
      }
      const desired = b.target.clone().sub(b.pos);
      const dist = desired.length();
      desired.normalize().multiplyScalar(Math.min(1.4, dist + 0.3));
      // erratic, bouncy flight
      desired.x += Math.sin(t * 2.3 + b.phase) * 0.6; desired.z += Math.cos(t * 1.9 + b.phase * 1.3) * 0.6;
      b.vel.lerp(desired, 1 - Math.exp(-dt * 2));
      const flap = Math.sin(t * b.freq * Math.PI * 2 + b.phase);
      b.pos.addScaledVector(b.vel, dt);
      b.pos.y += flap * 0.08 * dt * b.freq * 0.5;
      const gy = Math.max(0.05, b.terrain.height(b.pos.x, b.pos.z) + 0.15);
      if (b.pos.y < gy) b.pos.y = gy;
      b.obj.position.copy(b.pos);
      faceDir(b.obj, new THREE.Vector3(b.vel.x, b.vel.y * 0.3, b.vel.z), 0, 1 - Math.exp(-dt * 6));
      const a = flap * 0.95 + 0.35;
      for (const w of b.obj.userData.wings) w.pivot.rotation.z = w.s * a;
    }
  }
}

// ---------------------------------------------------------------- dragonflies & damselflies
export class Odonates {
  constructor(scene, { terrain, rng, near }) {
    this.list = [];
    const schemes = ['blue', 'emerald', 'amber', 'flame', 'blue'];
    for (let i = 0; i < 22; i++) {
      const obj = buildDragonfly(rng.pick(schemes), rng.range(0.85, 1.25));
      let home;
      if (i < 6) home = near.clone().add(new THREE.Vector3(rng.range(-12, 12), 0, rng.range(-12, 12)));
      else { const x = rng.range(-100, 100); home = new THREE.Vector3(x, 0, terrain.riverZ(x) + rng.range(-5, 5)); }
      home.y = Math.max(0, terrain.height(home.x, home.z));
      const d = { obj, home, pos: home.clone().add(new THREE.Vector3(0, 0.8, 0)), vel: new THREE.Vector3(), target: new THREE.Vector3(), timer: 0, hover: true, rng: rng.fork(i), terrain };
      d.target.copy(d.pos);
      scene.add(obj);
      this.list.push(d);
    }
    // helicopter damselflies: very long abdomen, wings tipped white
    for (let i = 0; i < 8; i++) {
      const obj = buildDragonfly('amber', 1.0);
      obj.children[0].scale.set(0.6, 0.6, 1.9);
      const home = near.clone().add(new THREE.Vector3(rng.range(-40, 40), 0, rng.range(-40, 40)));
      home.y = Math.max(0, terrain.height(home.x, home.z));
      const d = { obj, home, pos: home.clone().add(new THREE.Vector3(0, 1.5, 0)), vel: new THREE.Vector3(), target: new THREE.Vector3(), timer: 0, hover: true, rng: rng.fork(100 + i), terrain, slow: true };
      d.target.copy(d.pos);
      scene.add(obj);
      this.list.push(d);
    }
  }
  update(dt, t, cam) {
    for (const d of this.list) {
      const d2 = d.pos.distanceToSquared(cam);
      d.obj.visible = d2 < 60 * 60;
      if (!d.obj.visible) continue;
      d.timer -= dt;
      if (d.timer <= 0) {
        const r = d.rng;
        d.hover = !d.hover;
        d.timer = d.hover ? r.range(0.8, 3) : r.range(0.3, 0.9);
        if (!d.hover) {
          d.target.set(d.home.x + r.range(-6, 6), 0, d.home.z + r.range(-6, 6));
          d.target.y = Math.max(0, d.terrain.height(d.target.x, d.target.z)) + r.range(0.25, d.slow ? 3 : 1.8);
        }
      }
      const maxV = d.slow ? 1.2 : 7;
      const desired = d.target.clone().sub(d.pos);
      const dist = desired.length();
      if (d.hover) desired.set(Math.sin(t * 3 + d.home.x) * 0.05, Math.sin(t * 4.1 + d.home.z) * 0.05, Math.cos(t * 2.7) * 0.05);
      else desired.multiplyScalar(Math.min(maxV, dist * 4) / Math.max(dist, 1e-3));
      d.vel.lerp(desired, 1 - Math.exp(-dt * (d.slow ? 2 : 8)));
      d.pos.addScaledVector(d.vel, dt);
      d.obj.position.copy(d.pos);
      if (!d.hover && d.vel.lengthSq() > 0.05) faceDir(d.obj, new THREE.Vector3(d.vel.x, 0, d.vel.z), 0, 1 - Math.exp(-dt * 10));
      d.obj.userData.flap(t + d.home.x, d.slow ? 0.7 : 0.55, d.slow ? 8 : 26);
    }
  }
}

// ---------------------------------------------------------------- midge swarms (GPU animated points)
export function createMidges(spots, rng) {
  const per = 70, n = spots.length * per;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  spots.forEach((s, k) => {
    for (let i = 0; i < per; i++) {
      const j = k * per + i;
      pos.set([s.x, s.y, s.z], j * 3);
      seed.set([rng.next(), rng.next(), rng.next(), rng.range(0.3, 1.1)], j * 4);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexShader: `
      uniform float uTime; attribute vec4 aSeed; varying float vA;
      void main() {
        float t = uTime * (1.5 + aSeed.x * 2.0);
        vec3 o = vec3(sin(t + aSeed.y * 30.0) * cos(t * 0.7 + aSeed.z * 20.0), sin(t * 1.3 + aSeed.z * 40.0) * 0.6 + sin(uTime * 0.5 + aSeed.x * 6.0) * 0.4, cos(t * 1.1 + aSeed.x * 50.0)) * aSeed.w * 0.6;
        vec4 mv = viewMatrix * vec4(position + o, 1.0);
        float d = -mv.z;
        vA = smoothstep(18.0, 4.0, d) * smoothstep(0.3, 1.0, d);
        gl_PointSize = clamp(8.0 / max(d, 0.05), 1.0, 4.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.8) * a * vA * 0.6, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.name = 'midges';
  return pts;
}

// ---------------------------------------------------------------- leafcutter ants
export class Ants {
  constructor(scene, trail, rng, opts = {}) {
    this.trail = trail;
    this.lift = opts.lift ?? 0;
    const pts = trail.pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.len = this.cum[this.cum.length - 1];
    const N = opts.count ?? 700;
    const mb = new MeshBuilder();
    mb.setColor(C(opts.color ?? 0x5a2010));
    addEllipsoid(mb, new THREE.Vector3(0, 0.0012, 0.003), 0.0012, 0.0011, 0.0016, { w: 6, h: 4 });
    addEllipsoid(mb, new THREE.Vector3(0, 0.0012, 0.0), 0.0007, 0.0007, 0.0014, { w: 6, h: 4 });
    addEllipsoid(mb, new THREE.Vector3(0, 0.0014, -0.0032), 0.0016, 0.0014, 0.002, { w: 6, h: 4 });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const b = new THREE.Vector3(s * 0.0005, 0.0012, 0.0012 - k * 0.0012);
      addTube(mb, [b, b.clone().add(new THREE.Vector3(s * 0.0025, -0.0012, (k - 1) * 0.0012))], [0.00025, 0.0002], { radial: 3 });
    }
    const antGeo = mb.toGeometry();
    const lb = new MeshBuilder();
    lb.setColor(C(0x4a8a2a));
    addEllipsoid(lb, new THREE.Vector3(0, 0.0075, 0.004), 0.004, 0.0004, 0.0045, { w: 6, h: 2, quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.0) });
    lb.setColor(C(0x2a1a10));
    addTube(lb, [new THREE.Vector3(0, 0.0014, 0.0035), new THREE.Vector3(0, 0.004, 0.004)], [0.0002, 0.0002], { radial: 3 });
    const leafGeo = lb.toGeometry();
    const mat = creatureMat({ vertexColors: true, roughness: 0.4 });
    this.ants = new THREE.InstancedMesh(antGeo, mat, N);
    this.leaves = new THREE.InstancedMesh(leafGeo, creatureMat({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }, 'leafbit'), N);
    this.ants.frustumCulled = this.leaves.frustumCulled = false;
    this.state = [];
    for (let i = 0; i < N; i++) {
      const inbound = rng.chance(0.5);
      this.state.push({ s: rng.range(0, this.len), v: rng.range(0.025, 0.045) * (opts.speed ?? 1), off: rng.range(-1, 1) * (opts.width ?? 0.025), inbound, leaf: opts.leaves !== false && inbound && rng.chance(0.85), wob: rng.range(0, 6) });
    }
    scene.add(this.ants, this.leaves);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.sc = new THREE.Vector3(1, 1, 1).multiplyScalar(opts.scale ?? 1);
    this.posArr = new Float32Array(N * 3).fill(1e9);
    this.visibleNow = false;
    this.center = pts[Math.floor(pts.length / 2)].clone();
    this.reach = opts.reach ?? (this.len * 0.6 + 25);
    this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  sample(s, out, dir) {
    s = Math.max(0, Math.min(this.len - 1e-4, s));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] < s) lo = m; else hi = m; }
    const f = (s - this.cum[lo]) / Math.max(1e-6, this.cum[hi] - this.cum[lo]);
    out.copy(this.trail.pts[lo]).lerp(this.trail.pts[hi], f);
    dir.subVectors(this.trail.pts[hi], this.trail.pts[lo]).normalize();
  }
  update(dt, t, cam) {
    let near = false;
    for (let i = 0; i < this.trail.pts.length && !near; i += 8) near = cam.distanceToSquared(this.trail.pts[i]) < 900;
    this.ants.visible = this.leaves.visible = near;
    this.visibleNow = near;
    if (!near) return;
    const dir = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < this.state.length; i++) {
      const a = this.state[i];
      a.s += (a.inbound ? -1 : 1) * a.v * dt;
      if (a.s < 0) { a.s = 0; a.inbound = false; a.leaf = false; }
      if (a.s > this.len) { a.s = this.len; a.inbound = true; a.leaf = true; }
      this.sample(a.s, this.p, dir);
      if (a.inbound) dir.negate();
      side.crossVectors(up, dir);
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize();
      const nrm = new THREE.Vector3().crossVectors(dir, side).normalize();
      this.p.addScaledVector(side, a.off + Math.sin(t * 3 + a.wob) * 0.003).addScaledVector(nrm, this.lift);
      this.q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, nrm, dir));
      this.m.compose(this.p, this.q, this.sc);
      this.posArr[i * 3] = this.p.x; this.posArr[i * 3 + 1] = this.p.y; this.posArr[i * 3 + 2] = this.p.z;
      this.ants.setMatrixAt(i, this.m);
      this.leaves.setMatrixAt(i, a.leaf ? this.m : this.hidden);
    }
    this.ants.instanceMatrix.needsUpdate = true;
    this.leaves.instanceMatrix.needsUpdate = true;
  }
  // a dragonfly snaps up any ant within reach of its jaws; the colony sends a replacement
  tryEat(head, r = 0.035) {
    if (!this.visibleNow) return 0;
    let eaten = 0;
    const r2 = r * r, P = this.posArr;
    for (let i = 0; i < this.state.length; i++) {
      const dx = P[i * 3] - head.x, dy = P[i * 3 + 1] - head.y, dz = P[i * 3 + 2] - head.z;
      if (dx * dx + dy * dy + dz * dz < r2) {
        const a = this.state[i];
        a.s = a.inbound ? this.len : 0; // back to the nest / trail start
        P[i * 3] = 1e9;
        eaten++;
      }
    }
    return eaten;
  }
}

// ---------------------------------------------------------------- orb webs + golden orb-weavers
export function createWebs(spots, rng) {
  const group = new THREE.Group();
  const pos = [];
  const spiders = new MeshBuilder();
  for (const s of spots) {
    const R = rng.range(0.25, 0.55);
    const a = rng.range(0, 6.28);
    const ax = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const ay = new THREE.Vector3(0, 1, 0).applyAxisAngle(ax, rng.range(-0.25, 0.25));
    const c = s;
    const P = (r, th) => c.clone().addScaledVector(ax, Math.cos(th) * r).addScaledVector(ay, Math.sin(th) * r * 0.9);
    const spokes = 28;
    for (let i = 0; i < spokes; i++) {
      const th = (i / spokes) * Math.PI * 2;
      const p0 = P(0.01, th), p1 = P(R * (0.9 + 0.1 * Math.sin(i * 3)), th);
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
    // anchor lines
    for (let k = 0; k < 4; k++) {
      const th = k * 1.57 + 0.4;
      const p0 = P(R * 0.95, th), p1 = P(R * 2.2, th + 0.2);
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
    // capture spiral
    const turns = 22, steps = turns * spokes;
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const th = (i / spokes) * Math.PI * 2;
      const r = R * (0.15 + 0.78 * i / steps);
      const p = P(r, th);
      if (prev) pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev = p;
    }
    // spider at the hub (golden orb-weaver)
    const n = new THREE.Vector3().crossVectors(ax, ay).normalize();
    spiders.setColor(C(0xd8b020));
    addEllipsoid(spiders, c.clone().addScaledVector(ay, -0.012).addScaledVector(n, 0.003), 0.004, 0.011, 0.004, { w: 7, h: 6 });
    spiders.setColor(C(0x2a2018));
    addEllipsoid(spiders, c.clone().addScaledVector(ay, 0.004).addScaledVector(n, 0.003), 0.003, 0.004, 0.003, { w: 6, h: 4 });
    for (let l = 0; l < 8; l++) {
      const s2 = l < 4 ? 1 : -1, k = l % 4;
      const b = c.clone().addScaledVector(ay, 0.004).addScaledVector(n, 0.003);
      const knee = b.clone().addScaledVector(ax, s2 * 0.012).addScaledVector(ay, (1.5 - k) * 0.008).addScaledVector(n, 0.004);
      const tip = b.clone().addScaledVector(ax, s2 * 0.022).addScaledVector(ay, (1.5 - k) * 0.016);
      addTube(spiders, [b, knee, tip], [0.0006, 0.0005, 0.0003], { radial: 3, colorFn: (i) => (i === 1 ? C(0xd8a020) : C(0x1a1410)) });
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const lm = new THREE.LineBasicMaterial({ color: 0xdde8e0, transparent: true, opacity: 0.16, depthWrite: false, fog: true });
  const lines = new THREE.LineSegments(g, lm);
  lines.name = 'webs';
  group.add(lines);
  const sm = new THREE.Mesh(spiders.toGeometry(), creatureMat({ vertexColors: true, roughness: 0.35 }));
  group.add(sm);
  return group;
}

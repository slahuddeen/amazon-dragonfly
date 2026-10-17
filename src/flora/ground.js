// Forest floor detail: camera-following leaf litter & sprigs, fallen nurse logs with
// upturned root plates, and a leafcutter ant nest with its cleared trail.
import * as THREE from 'three';
import { addTube, addEllipsoid, addRibbon, MeshBuilder } from '../core/geometry.js';
import { patchMaterial } from '../core/shaders.js';
import { U, WORLD, QUALITY } from '../core/shared.js';
import { CELL, cellRect } from '../core/textures.js';

const UP = new THREE.Vector3(0, 1, 0);

const RING_HEAD = `
uniform vec2 uCamXZ;
uniform float uRingR;
uniform sampler2D uHeightMap;
uniform vec4 uWorldRect;
attribute vec4 aOff;
vec2 ringPos() {
  vec2 base = uCamXZ - uRingR * 0.5;
  return base + mod(aOff.xy - base, uRingR);
}
float rh(vec2 p, float k) { return fract(sin(dot(p, vec2(12.9898 + k, 78.233 - k))) * 43758.5453); }
`;

function ringMaterial(atlas, key, R, uvCode, extraBegin = '') {
  const m = new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.45, alphaToCoverage: QUALITY.msaa > 0, side: THREE.DoubleSide, roughness: 0.8, vertexColors: false });
  const uniforms = { uCamXZ: { value: new THREE.Vector2() }, uRingR: { value: R }, uHeightMap: { value: null } };
  patchMaterial(m, {
    key,
    uniforms,
    translucent: 0.4,
    vertexHead: RING_HEAD,
    vertexUv: `
    {
      vec2 rp = ringPos();
      ${uvCode}
    }`,
    vertexNormal: 'objectNormal = vec3(0.0, 1.0, 0.0);',
    vertexBegin: `
    {
      vec2 p = ringPos();
      float h1 = rh(p, 0.0), h2 = rh(p, 1.7);
      vec2 huv = (p - uWorldRect.xy) / uWorldRect.zw;
      vec4 hm = texture2D(uHeightMap, huv);
      float dist = length(p - uCamXZ);
      float fade = smoothstep(uRingR * 0.5, uRingR * 0.36, dist) * smoothstep(-0.05, 0.5, hm.b) * step(length(p), ${(WORLD.radius + 2).toFixed(1)});
      float sc = mix(0.6, 1.4, h2) * fade * aOff.z;
      float ang = h1 * 6.2831;
      float ca = cos(ang), sa = sin(ang);
      vec3 v = position * sc;
      v = vec3(ca * v.x + sa * v.z, v.y, -sa * v.x + ca * v.z);
      ${extraBegin}
      transformed = vec3(p.x, hm.r + 0.012, p.y) + v;
    }`,
    fragColor: 'diffuseColor.rgb *= vRingTint;',
    fragHead: 'varying vec3 vRingTint;',
    vertexEnd: `
    {
      vec2 p2 = ringPos();
      float t = rh(p2, 3.3);
      vRingTint = mix(vec3(0.7, 0.65, 0.6), vec3(1.15, 1.05, 0.95), t);
    }`,
  });
  // varying must be declared in the vertex shader too
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader) => {
    prev(shader);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRingTint;');
    shader.uniforms.uCamXZ = uniforms.uCamXZ;
    shader.uniforms.uRingR = uniforms.uRingR;
    shader.uniforms.uHeightMap = uniforms.uHeightMap;
  };
  m.userData.ring = uniforms;
  return m;
}

function litterGeometry() {
  // small curled leaf lying flat (local XZ), 3x4 grid
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], nrm = [], idx = [];
  const nx = 3, nz = 4;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / nz;
    const x = (u - 0.5) * 0.06, z = (v - 0.5) * 0.11;
    const y = 0.25 * Math.pow((u - 0.5) * 2, 2) * 0.02 + Math.sin(v * 3.1) * 0.006;
    pos.push(x, y, z); uv.push(u, v); nrm.push(0, 1, 0);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i;
    idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}
function sprigGeometry() {
  // three tiny fern fronds
  const mb = new MeshBuilder();
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1;
    const pts = [];
    for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push(new THREE.Vector3(Math.cos(a) * t * 0.12, Math.sin(t * 2.2) * 0.06, Math.sin(a) * t * 0.12)); }
    addRibbon(mb, pts, [0.01, 0.025, 0.03, 0.025, 0.01], cellRect(CELL.fern), { fold: 0.2 });
  }
  const g = mb.toGeometry();
  g.deleteAttribute('color'); g.deleteAttribute('aWind');
  return g;
}

function ringMesh(geo, mat, count, R, scaleRange, rng) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = geo.index;
  for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.getAttribute(k));
  const off = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off[i * 4] = rng.range(0, R); off[i * 4 + 1] = rng.range(0, R);
    off[i * 4 + 2] = rng.range(...scaleRange); off[i * 4 + 3] = rng.next();
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  g.instanceCount = count;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

export class Ground {
  constructor({ terrain, batch, forest, plants, epiphytes, colliders, materials, rng }) {
    Object.assign(this, { terrain, batch, forest, plants, epi: epiphytes, colliders, M: materials, rng });
    this.rings = [];
    this.antTrail = null;
  }

  buildRings(atlas, heightTex) {
    const group = new THREE.Group();
    const D = QUALITY.density;
    const [u0, v0] = cellRect(CELL.dead);
    const litterMat = ringMaterial(atlas, 'ring-litter', 26, `
      float sub = floor(rh(rp, 5.1) * 4.0);
      vec2 so = vec2(mod(sub, 2.0), 1.0 - floor(sub / 2.0)) * 0.125;
      vMapUv = vec2(${(u0 - 0.002).toFixed(4)}, ${(v0 - 0.002).toFixed(4)}) + so + 0.004 + uv * (0.125 - 0.008);`);
    const [fu0, fv0, fdu, fdv] = cellRect(CELL.fern);
    const sprigMat = ringMaterial(atlas, 'ring-sprig', 18, `vMapUv = vMapUv;`, '');
    const litter = ringMesh(litterGeometry(), litterMat, Math.round(22000 * D), 26, [0.8, 1.5], this.rng);
    const sprigs = ringMesh(sprigGeometry(), sprigMat, Math.round(6500 * D), 18, [0.6, 1.6], this.rng);
    for (const m of [litterMat, sprigMat]) { m.userData.ring.uHeightMap.value = heightTex; this.rings.push(m.userData.ring); }
    litter.name = 'litterRing'; sprigs.name = 'sprigRing';
    litter.layers.set(1); sprigs.layers.set(1);
    group.add(litter, sprigs);
    return group;
  }
  update(cam) {
    for (const r of this.rings) r.uCamXZ.value.set(cam.x, cam.z);
  }

  // ---------------------------------------------------------------- fallen trees
  logs() {
    const T = this.terrain, rng = this.rng;
    const R = WORLD.radius - 8;
    let made = 0;
    this.logList = [];
    for (let tries = 0; tries < 1500 && made < 26; tries++) {
      const x = rng.range(-R, R), z = rng.range(-R, R);
      if (Math.hypot(x, z) > R || T.bankDist(x, z) < 3) continue;
      const a = rng.range(0, 6.28);
      const big = made < 10;
      const len = big ? rng.range(9, 22) : rng.range(2.5, 8), r = big ? rng.range(0.35, 0.8) : rng.range(0.14, 0.35);
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const end = new THREE.Vector3(x + dir.x * len, 0, z + dir.z * len);
      if (Math.hypot(end.x, end.z) > R || T.bankDist(end.x, end.z) < 2) continue;
      let blocked = false;
      for (let t = 0; t <= 1; t += 0.1) {
        const p = new THREE.Vector3(x + dir.x * len * t, 0, z + dir.z * len * t);
        p.y = T.height(p.x, p.z) + 0.5;
        if (this.colliders.nearest(p) < r + 0.3) { blocked = true; break; }
      }
      if (blocked) continue;
      this.log(x, z, dir, len, r, big && rng.chance(0.5), rng.chance(big ? 0.35 : 0.15));
      made++;
    }
  }

  log(x, z, dir, len, r, rootPlate, hollow = false) {
    const T = this.terrain, rng = this.rng;
    const n = Math.ceil(len / 0.7);
    const pts = [], radii = [];
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = x + dir.x * len * t + side.x * Math.sin(t * 3) * 0.3, pz = z + dir.z * len * t + side.z * Math.sin(t * 3) * 0.3;
      const rr = r * (1 - 0.35 * t);
      pts.push(new THREE.Vector3(px, T.height(px, pz) + rr * 0.55, pz));
      radii.push(rr);
    }
    // smooth heights so it doesn't follow every bump
    for (let k = 0; k < 3; k++) for (let i = 1; i < pts.length - 1; i++) pts[i].y = Math.max(pts[i].y, (pts[i - 1].y + pts[i + 1].y) / 2);
    const mb = this.batch.get('barkDark', x, z);
    mb.setColor(new THREE.Color(0x7a6a58).multiplyScalar(rng.range(0.7, 1.05)));
    if (hollow) {
      // rotten core: dark inner wall + rim at the open end
      const inner = this.batch.get('plain', x, z);
      inner.setColor(new THREE.Color(0x2a1c12));
      const ip = pts.slice().reverse(), ir = radii.slice().reverse().map((q) => q * 0.72);
      addTube(inner, ip, ir, { radial: 10 });
      const e = pts.length - 1, T = pts[e].clone().sub(pts[e - 1]).normalize();
      const n0 = new THREE.Vector3().crossVectors(T, UP).normalize(), b0 = new THREE.Vector3().crossVectors(T, n0);
      inner.setColor(new THREE.Color(0x6a4a30));
      const base = inner.count;
      for (let j = 0; j <= 12; j++) {
        const th = (j / 12) * Math.PI * 2, d = n0.clone().multiplyScalar(Math.cos(th)).addScaledVector(b0, Math.sin(th));
        for (const k of [0.72, 1.0]) { const q = pts[e].clone().addScaledVector(d, radii[e] * k); inner.v(q.x, q.y, q.z, T.x, T.y, T.z, j / 12, k); }
      }
      for (let j = 0; j < 12; j++) { const a = base + j * 2; inner.quad(a, a + 2, a + 3, a + 1); inner.quad(a, a + 1, a + 3, a + 2); }
    }
    addTube(mb, pts, radii, {
      radial: 12, uRepeat: Math.max(1, Math.round(r * 5)), vScale: 1.4, capEnd: !rootPlate && !hollow,
      radiusFn: (i, th) => 1 + 0.08 * Math.sin(th * 5 + i) + (i === pts.length - 1 ? 0.2 * Math.sin(th * 7) : 0),
      windFn: () => 0.9,
    });
    for (let i = 0; i < pts.length - 1; i++) this.colliders.addCapsule(pts[i], pts[i + 1], radii[i]);
    this.logList.push({ pts, radii });
    if (rootPlate) {
      // upturned root plate: a vertical disc of soil with roots radiating out
      const c = pts[0].clone().addScaledVector(dir, -0.3);
      const pr = r * rng.range(3.5, 5);
      c.y = T.height(c.x, c.z) + pr * 0.6;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate());
      const soil = this.batch.get('soil', x, z);
      soil.setColor(new THREE.Color(0x6a5040));
      addEllipsoid(soil, c, pr, pr * 0.85, r * 1.2, { w: 18, h: 12, quat: q, disp: (nx, ny, nz) => 1 + 0.12 * Math.sin(nx * 7 + ny * 5) * Math.cos(ny * 6) });
      this.colliders.addCapsule(c.clone().addScaledVector(side, -pr * 0.8), c.clone().addScaledVector(side, pr * 0.8), pr * 0.5);
      const rb = this.batch.get('roots', x, z);
      rb.setColor(new THREE.Color(0x8a7a66));
      for (let k = 0; k < 22; k++) {
        const a = rng.range(0, 6.28);
        const out = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.85, 0).applyQuaternion(q);
        const start = c.clone().addScaledVector(out, pr * rng.range(0.6, 0.95)).addScaledVector(dir, -r * 0.6);
        const L = rng.range(0.8, 2.6);
        const rp = [start];
        const d = out.clone().addScaledVector(dir, -0.4).normalize();
        for (let i = 1; i <= 5; i++) {
          d.y -= 0.12; d.x += rng.range(-0.15, 0.15); d.z += rng.range(-0.15, 0.15); d.normalize();
          rp.push(rp[i - 1].clone().addScaledVector(d, L / 5));
        }
        const r0 = rng.range(0.02, 0.07);
        addTube(rb, rp, rp.map((_, i) => r0 * (1 - i / 6)), { radial: 5, capEnd: true, windFn: () => 0.3 });
      }
      // the pit left behind
    }
    // decorate the nurse log
    const top = (t) => { const i = Math.min(pts.length - 1, Math.round(t * (pts.length - 1))); return { p: pts[i].clone().add(new THREE.Vector3(0, radii[i] * 0.95, 0)), r: radii[i] }; };
    for (let k = 0; k < Math.ceil(len / 1.4); k++) {
      const { p } = top(rng.range(0.05, 0.95));
      const what = rng.next();
      if (what < 0.35) this.plants.add('seedling', p.x, p.y - 0.02, p.z, rng.range(0, 6.28), rng.range(0.7, 1.3), null);
      else if (what < 0.55) this.plants.add('fernSmall', p.x, p.y - 0.02, p.z, rng.range(0, 6.28), rng.range(0.5, 0.9), null);
      else if (what < 0.75) this.epi.place('moss', p, UP, dir, rng.range(1, 1.8));
      else this.plants.add(rng.pick(['mushrooms', 'cupFungi', 'coral', 'parasols']), p.x, p.y - 0.02, p.z, rng.range(0, 6.28), rng.range(1, 1.8), null);
    }
    for (let k = 0; k < Math.ceil(len / 1.8); k++) {
      const t = rng.range(0.1, 0.95), i = Math.round(t * (pts.length - 1));
      const s = rng.sign();
      const out = side.clone().multiplyScalar(s);
      const p = pts[i].clone().addScaledVector(out, radii[i] * 0.9);
      this.epi.placeOutward('bracket', p, out, rng.range(0.9, 1.8));
    }
  }

  // ---------------------------------------------------------------- standing dead wood
  snags() {
    const T = this.terrain, rng = this.rng;
    const R = WORLD.radius - 6;
    let snags = 0, stumps = 0;
    for (let tries = 0; tries < 2000 && (snags < 12 || stumps < 22); tries++) {
      const x = rng.range(-R, R), z = rng.range(-R, R);
      if (Math.hypot(x, z) > R || T.bankDist(x, z) < 1.5) continue;
      const gy = T.height(x, z);
      const isSnag = snags < 12 && rng.chance(0.4);
      const h = isSnag ? rng.range(4, 15) : rng.range(0.4, 1.6);
      const r = isSnag ? rng.range(0.3, 0.75) : rng.range(0.25, 0.7);
      if (this.colliders.nearest(new THREE.Vector3(x, gy + 0.6, z)) < r + 0.6) continue;
      const n = Math.max(3, Math.ceil(h / 0.6));
      const pts = [], radii = [];
      const lean = new THREE.Vector3(rng.range(-0.08, 0.08), 1, rng.range(-0.08, 0.08)).normalize();
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push(new THREE.Vector3(x, gy - 0.3, z).addScaledVector(lean, t * (h + 0.3)));
        radii.push(r * (1 - 0.15 * t) * (1 + 0.5 * Math.exp(-t * h / 1.2)));
      }
      const mb = this.batch.get('barkDark', x, z);
      mb.setColor(new THREE.Color(0x8a7a68).multiplyScalar(rng.range(0.6, 0.9)));
      const top = pts.length - 1, seed = rng.range(0, 9);
      addTube(mb, pts, radii, {
        radial: 12, uRepeat: Math.max(1, Math.round(r * 5)), vScale: 1.4, capEnd: true,
        // jagged broken top
        radiusFn: (i, th) => (i === top ? 0.35 + 0.65 * Math.abs(Math.sin(th * 3 + seed)) : 1 + 0.06 * Math.sin(th * 5 + i)),
        windFn: (i) => (isSnag ? 0.4 : 0.9),
      });
      for (let i = 0; i < pts.length - 1; i++) this.colliders.addCapsule(pts[i], pts[i + 1], radii[i]);
      // fungi shelves up the trunk, woodpecker holes
      const shelves = isSnag ? rng.int(4, 12) : rng.int(1, 4);
      for (let k = 0; k < shelves; k++) {
        const i = rng.int(0, top - 1), a = rng.range(0, 6.28);
        const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        this.epi.placeOutward('bracket', pts[i].clone().addScaledVector(out, radii[i] * 0.92), out, rng.range(1, 2.4));
      }
      if (isSnag) {
        const holes = this.batch.get('plain', x, z);
        holes.setColor(new THREE.Color(0x060403));
        for (let k = 0; k < rng.int(1, 4); k++) {
          const i = rng.int(Math.floor(top * 0.4), top - 1), a = rng.range(0, 6.28);
          const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
          addEllipsoid(holes, pts[i].clone().addScaledVector(out, radii[i] * 0.97), 0.05, 0.07, 0.015, { w: 8, h: 5, quat: q });
        }
        snags++;
      } else {
        // mossy stump crowned with mushrooms and seedlings
        const p = pts[top].clone(); p.y += 0.02;
        this.epi.place('moss', p, UP, new THREE.Vector3(1, 0, 0), r * 2.2);
        this.plants.add(rng.pick(['mushrooms', 'parasols', 'cupFungi']), p.x + r * 0.3, p.y, p.z, rng.range(0, 6.28), rng.range(1, 2), null);
        if (rng.chance(0.6)) this.plants.add('seedling', p.x - r * 0.3, p.y, p.z, 0, rng.range(0.8, 1.4), null);
        stumps++;
      }
    }
    this.snagCount = snags; this.stumpCount = stumps;
  }

  // ---------------------------------------------------------------- leafcutter ants
  antColony(nest, target) {
    const T = this.terrain, rng = this.rng;
    const soil = this.batch.get('soil', nest.x, nest.z);
    const gy = T.height(nest.x, nest.z);
    soil.setColor(new THREE.Color(0x8a6a4a));
    addEllipsoid(soil, new THREE.Vector3(nest.x, gy - 0.05, nest.z), 2.2, 0.38, 1.9, {
      w: 24, h: 10, disp: (x, y, z) => 1 + 0.06 * Math.sin(x * 9) * Math.sin(z * 11),
    });
    const holes = this.batch.get('plain', nest.x, nest.z);
    holes.setColor(new THREE.Color(0x0a0604));
    this.antHoles = [];
    for (let k = 0; k < 9; k++) {
      const a = rng.range(0, 6.28), r = rng.range(0, 1.3);
      const hx = nest.x + Math.cos(a) * r, hz = nest.z + Math.sin(a) * r * 0.85;
      const hy = gy - 0.05 + 0.38 * Math.sqrt(Math.max(0, 1 - (r / 2.1) ** 2)) + 0.005;
      addEllipsoid(holes, new THREE.Vector3(hx, hy, hz), 0.05, 0.008, 0.05, { w: 8, h: 3 });
      this.antHoles.push(new THREE.Vector3(hx, hy, hz));
    }
    // trail: a wandering cleared path from the nest to the target plant
    const pts = [];
    const start = new THREE.Vector3(nest.x, 0, nest.z), end = new THREE.Vector3(target.x, 0, target.z);
    const len = start.distanceTo(end);
    const n = Math.ceil(len / 0.25);
    const side = new THREE.Vector3(-(end.z - start.z), 0, end.x - start.x).normalize();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = start.clone().lerp(end, t).addScaledVector(side, Math.sin(t * 7.3) * 1.2 * Math.sin(Math.PI * t) + Math.sin(t * 23) * 0.12);
      const top = Math.hypot(p.x - nest.x, (p.z - nest.z) / 0.86) < 2.1 ? 0.38 * Math.sqrt(Math.max(0, 1 - (Math.hypot(p.x - nest.x, (p.z - nest.z) / 0.86) / 2.2) ** 2)) - 0.05 : 0;
      p.y = Math.max(T.height(p.x, p.z) + 0.006, gy + top);
      pts.push(p);
    }
    const dec = this.batch.get('soil', nest.x, nest.z);
    dec.setColor(new THREE.Color(0x5a4430));
    addRibbon(dec, pts, pts.map(() => 0.07), [0, 0, 1, 1], { fold: 0, faceHint: UP });
    this.antTrail = { pts, nest: new THREE.Vector3(nest.x, gy + 0.33, nest.z) };
  }
}

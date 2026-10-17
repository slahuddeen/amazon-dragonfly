// Geometry toolkit: a fast mesh builder, tubes / lofts / ribbons / cards,
// chunked batching of static meshes, instanced atlas cards and distance culling.
import * as THREE from 'three';
import { WORLD } from './shared.js';

const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class MeshBuilder {
  constructor() {
    this.p = []; this.n = []; this.uv = []; this.c = []; this.w = []; this.idx = [];
    this.cr = 1; this.cg = 1; this.cb = 1;
  }
  get count() { return this.p.length / 3; }
  setColor(c) {
    if (c.isColor) { this.cr = c.r; this.cg = c.g; this.cb = c.b; }
    else { this.cr = c[0]; this.cg = c[1]; this.cb = c[2]; }
    return this;
  }
  v(x, y, z, nx, ny, nz, u, v, w = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v);
    this.c.push(this.cr, this.cg, this.cb); this.w.push(w);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.w, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Parallel-transport frames along a polyline.
export function frames(pts) {
  const n = pts.length, T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    T.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  const t0 = T[0];
  const ref = Math.abs(t0.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
  let nn = new THREE.Vector3().crossVectors(t0, ref).normalize();
  for (let i = 0; i < n; i++) {
    const t = T[i];
    nn = nn.clone().addScaledVector(t, -nn.dot(t));
    if (nn.lengthSq() < 1e-8) nn.crossVectors(t, ref);
    nn.normalize();
    N.push(nn);
    B.push(new THREE.Vector3().crossVectors(t, nn).normalize());
  }
  return { T, N, B };
}

/**
 * Tube along pts. opts: radial, uRepeat, vScale, radiusFn(i,theta)->mult, windFn(i)->amt,
 * capEnd, colorFn(i)->THREE.Color, vOffset
 */
export function addTube(mb, pts, radii, opts = {}) {
  const radial = opts.radial ?? 8;
  const uRep = opts.uRepeat ?? 1;
  const vScale = opts.vScale ?? 1;
  const { T, N, B } = frames(pts);
  let dist = opts.vOffset || 0;
  const base = mb.count;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) dist += pts[i].distanceTo(pts[i - 1]);
    const p = pts[i], n = N[i], b = B[i];
    const w = opts.windFn ? opts.windFn(i) : 0;
    if (opts.colorFn) mb.setColor(opts.colorFn(i));
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      const cs = Math.cos(th), sn = Math.sin(th);
      const dx = n.x * cs + b.x * sn, dy = n.y * cs + b.y * sn, dz = n.z * cs + b.z * sn;
      const r = radii[i] * (opts.radiusFn ? opts.radiusFn(i, th) : 1);
      mb.v(p.x + dx * r, p.y + dy * r, p.z + dz * r, dx, dy, dz, (j / radial) * uRep, dist / vScale, w);
    }
  }
  const R = radial + 1;
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = base + i * R + j, b = a + 1, c = a + R + 1, d = a + R;
    mb.quad(a, b, c, d);
  }
  if (opts.capEnd) {
    const i = pts.length - 1, p = pts[i], t = T[i];
    const ctr = mb.v(p.x + t.x * radii[i] * 0.3, p.y + t.y * radii[i] * 0.3, p.z + t.z * radii[i] * 0.3, t.x, t.y, t.z, 0.5, dist / vScale, opts.windFn ? opts.windFn(i) : 0);
    for (let j = 0; j < radial; j++) mb.tri(base + i * R + j, base + i * R + j + 1, ctr);
  }
  return { T, N, B };
}

// Loft through arbitrary closed rings: rings[i] = { pts:[V3], nrm:[V3], v }
export function addLoft(mb, rings, uRepeat = 1, windFn = null) {
  const base = mb.count, M = rings[0].pts.length;
  rings.forEach((r, i) => {
    const w = windFn ? windFn(i) : 0;
    for (let j = 0; j <= M; j++) {
      const p = r.pts[j % M], n = r.nrm[j % M];
      mb.v(p.x, p.y, p.z, n.x, n.y, n.z, (j / M) * uRepeat, r.v, w);
    }
  });
  const R = M + 1;
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < M; j++) {
    const a = base + i * R + j, b = a + 1, c = a + R + 1, d = a + R;
    mb.quad(a, b, c, d);
  }
}

/**
 * Ribbon (fronds / strap leaves) along pts, V-folded, textured with an atlas cell.
 * widths[i] half-width, faceHint: vector the ribbon should face (e.g. up)
 */
export function addRibbon(mb, pts, widths, rect, opts = {}) {
  const fold = opts.fold ?? 0.35;
  const hint = opts.faceHint || UP;
  const n = pts.length;
  const base = mb.count;
  const side = new THREE.Vector3(), nrm = new THREE.Vector3(), t = new THREE.Vector3();
  const [u0, v0, du, dv] = rect;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    t.subVectors(b, a).normalize();
    side.crossVectors(t, hint);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    nrm.crossVectors(side, t).normalize();
    const p = pts[i], w = widths[i], s = i / (n - 1);
    const wind = opts.windFn ? opts.windFn(s) : s * (opts.wind ?? 0.15);
    const twist = opts.twist ? opts.twist * s : 0;
    const dropx = -fold * w;
    const nx = nrm.x, ny = nrm.y, nz = nrm.z;
    // left, centre, right
    for (let k = -1; k <= 1; k++) {
      const off = k * w;
      const dropk = k === 0 ? 0 : dropx + twist * k;
      mb.v(p.x + side.x * off + nrm.x * dropk, p.y + side.y * off + nrm.y * dropk, p.z + side.z * off + nrm.z * dropk,
        nx + side.x * k * fold * 0.6, ny + side.y * k * fold * 0.6, nz + side.z * k * fold * 0.6,
        u0 + du * (k + 1) / 2, v0 + dv * s, wind);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const a = base + i * 3;
    mb.quad(a, a + 1, a + 4, a + 3);
    mb.quad(a + 1, a + 2, a + 5, a + 4);
  }
}

// Flat-ish card baked into geometry (for instanced plant prototypes).
export function addCard(mb, origin, xAxis, yAxis, w, h, rect, opts = {}) {
  const segX = opts.segX ?? 2, segY = opts.segY ?? 3;
  const bend = opts.bend ?? 0, fold = opts.fold ?? 0;
  const z = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
  const [u0, v0, du, dv] = rect;
  const base = mb.count;
  const windBase = opts.windBase ?? 0, windTip = opts.windTip ?? 0.05;
  const anchorY = opts.anchorY ?? 0; // 0 = base anchored, 0.5 = centre anchored
  for (let iy = 0; iy <= segY; iy++) for (let ix = 0; ix <= segX; ix++) {
    const fx = ix / segX - 0.5, fy = iy / segY;
    const lx = fx * w, ly = (fy - anchorY) * h;
    const dz = bend * fy * fy * h + fold * Math.abs(fx) * w;
    const px = origin.x + xAxis.x * lx + yAxis.x * ly + z.x * dz;
    const py = origin.y + xAxis.y * lx + yAxis.y * ly + z.y * dz;
    const pz = origin.z + xAxis.z * lx + yAxis.z * ly + z.z * dz;
    // tilt normal with fold + bend
    _v.copy(z).addScaledVector(xAxis, -Math.sign(fx) * fold * 0.8).addScaledVector(yAxis, -bend * fy * 1.2).normalize();
    mb.v(px, py, pz, _v.x, _v.y, _v.z, u0 + du * (fx + 0.5), v0 + dv * fy, windBase + (windTip - windBase) * fy);
  }
  const R = segX + 1;
  for (let iy = 0; iy < segY; iy++) for (let ix = 0; ix < segX; ix++) {
    const a = base + iy * R + ix;
    mb.quad(a, a + 1, a + R + 1, a + R);
  }
}

// Ellipsoid with optional displacement fn(nx,ny,nz)->scale
export function addEllipsoid(mb, c, rx, ry, rz, opts = {}) {
  const ws = opts.w ?? 10, hs = opts.h ?? 7;
  const q = opts.quat;
  const base = mb.count;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= hs; i++) {
    const phi = (i / hs) * Math.PI;
    for (let j = 0; j <= ws; j++) {
      const th = (j / ws) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
      const d = opts.disp ? opts.disp(nx, ny, nz) : 1;
      p.set(nx * rx * d, ny * ry * d, nz * rz * d);
      n.set(nx / rx, ny / ry, nz / rz).normalize();
      if (q) { p.applyQuaternion(q); n.applyQuaternion(q); }
      if (opts.colorFn) mb.setColor(opts.colorFn(nx, ny, nz));
      mb.v(c.x + p.x, c.y + p.y, c.z + p.z, n.x, n.y, n.z, j / ws, i / hs, opts.wind ?? 0);
    }
  }
  const R = ws + 1;
  for (let i = 0; i < hs; i++) for (let j = 0; j < ws; j++) {
    const a = base + i * R + j;
    mb.quad(a, a + 1, a + R + 1, a + R);
  }
}

// Lathe around an axis (for lily pads, mushroom caps, cones). profile: [[r, y], ...]
export function addLathe(mb, c, profile, opts = {}) {
  const seg = opts.seg ?? 16;
  const q = opts.quat;
  const base = mb.count;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < profile.length; i++) {
    const [r, y] = profile[i];
    const [r0, y0] = profile[Math.max(0, i - 1)], [r1, y1] = profile[Math.min(profile.length - 1, i + 1)];
    const dr = r1 - r0, dy = y1 - y0;
    if (opts.colorFn) mb.setColor(opts.colorFn(i / (profile.length - 1)));
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const cs = Math.cos(th), sn = Math.sin(th);
      const rr = r * (opts.radiusFn ? opts.radiusFn(th, i) : 1);
      p.set(cs * rr, y, sn * rr);
      n.set(cs * dy, -dr, sn * dy).normalize();
      if (opts.flipNormals) n.negate();
      if (q) { p.applyQuaternion(q); n.applyQuaternion(q); }
      mb.v(c.x + p.x, c.y + p.y, c.z + p.z, n.x, n.y, n.z, j / seg, i / (profile.length - 1), opts.wind ?? 0);
    }
  }
  const R = seg + 1;
  for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = base + i * R + j;
    mb.quad(a, a + R, a + R + 1, a + 1);
  }
}

// ------------------------------------------------------------------ chunking
export function chunkOf(x, z) {
  const n = Math.ceil(WORLD.size / WORLD.chunk);
  const cx = Math.max(0, Math.min(n - 1, Math.floor((x + WORLD.half) / WORLD.chunk)));
  const cz = Math.max(0, Math.min(n - 1, Math.floor((z + WORLD.half) / WORLD.chunk)));
  return cx + ',' + cz;
}

export class Culler {
  constructor() { this.items = []; }
  add(obj, maxDist) {
    if (!isFinite(maxDist)) return;
    obj.updateMatrixWorld?.();
    let c, r;
    if (obj.isInstancedMesh) {
      obj.computeBoundingSphere();
      c = obj.boundingSphere.center.clone(); r = obj.boundingSphere.radius;
    } else {
      const bs = obj.geometry.boundingSphere || (obj.geometry.computeBoundingSphere(), obj.geometry.boundingSphere);
      c = bs.center.clone(); r = bs.radius;
    }
    this.items.push({ obj, c, r, maxDist });
  }
  update(cam) {
    for (const it of this.items) {
      const dx = it.c.x - cam.x, dz = it.c.z - cam.z, dy = (it.c.y - cam.y) * 0.5;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy) - it.r;
      // above the canopy the understory is hidden anyway
      const md = cam.y > 45 ? it.maxDist * 0.6 : it.maxDist;
      it.obj.visible = d < md;
    }
  }
}

// Static geometry batched per material and chunk.
export class Batcher {
  constructor() { this.map = new Map(); }
  get(matKey, x, z) {
    const key = matKey + '|' + chunkOf(x, z);
    let e = this.map.get(key);
    if (!e) { e = { matKey, mb: new MeshBuilder() }; this.map.set(key, e); }
    return e.mb;
  }
  build(group, materials, culler, settings = {}) {
    let tris = 0;
    for (const [key, e] of this.map) {
      if (e.mb.count === 0) continue;
      const mat = materials[e.matKey];
      if (!mat) { console.warn('missing material', e.matKey); continue; }
      const g = e.mb.toGeometry();
      tris += e.mb.idx.length / 3;
      const m = new THREE.Mesh(g, mat);
      const s = settings[e.matKey] || {};
      m.castShadow = s.castShadow ?? true;
      m.receiveShadow = true;
      if (s.customDepthMaterial) m.customDepthMaterial = s.customDepthMaterial;
      m.name = key;
      group.add(m);
      culler.add(m, s.maxDist ?? Infinity);
    }
    this.map.clear();
    return tris;
  }
}

// Instanced atlas cards (foliage). One InstancedMesh per chunk+layer.
const _m = new THREE.Matrix4();
export class CardSystem {
  constructor() { this.chunks = new Map(); this.total = 0; }
  /**
   * pos: base position, x/y/z axes (unit, z = face normal), w/h size, rect: atlas cell rect,
   * color: THREE.Color, params: {bend, fold, wind}, nrm: shading normal (world)
   */
  add(layer, pos, x, y, z, w, h, rect, color, params, nrm) {
    const key = layer + '|' + chunkOf(pos.x, pos.z);
    let c = this.chunks.get(key);
    if (!c) { c = { layer, m: [], cell: [], par: [], nrm: [], col: [] }; this.chunks.set(key, c); }
    _m.set(
      x.x * w, y.x * h, z.x, pos.x,
      x.y * w, y.y * h, z.y, pos.y,
      x.z * w, y.z * h, z.z, pos.z,
      0, 0, 0, 1);
    for (let i = 0; i < 16; i++) c.m.push(_m.elements[i]);
    c.cell.push(rect[0], rect[1], rect[2], rect[3]);
    c.par.push(params.bend ?? 0, params.fold ?? 0, params.wind ?? 0.02, 0);
    const n = nrm || z;
    c.nrm.push(n.x, n.y, n.z);
    c.col.push(color.r, color.g, color.b);
    this.total++;
  }
  build(group, material, depthMaterial, culler, layerSettings = {}) {
    const base = new THREE.PlaneGeometry(1, 1, 1, 3);
    base.translate(0, 0.5, 0);
    for (const [key, c] of this.chunks) {
      const count = c.col.length / 3;
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index;
      g.setAttribute('position', base.getAttribute('position'));
      g.setAttribute('normal', base.getAttribute('normal'));
      g.setAttribute('uv', base.getAttribute('uv'));
      g.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(c.cell), 4));
      g.setAttribute('aParams', new THREE.InstancedBufferAttribute(new Float32Array(c.par), 4));
      g.setAttribute('aNrm', new THREE.InstancedBufferAttribute(new Float32Array(c.nrm), 3));
      const mesh = new THREE.InstancedMesh(g, material, count);
      mesh.instanceMatrix.array.set(c.m);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.col), 3);
      const s = layerSettings[c.layer] || {};
      mesh.castShadow = s.castShadow ?? true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depthMaterial;
      mesh.name = 'cards|' + key;
      mesh.computeBoundingSphere();
      // leaves bend & sway: pad the bounds a little
      mesh.boundingSphere.radius += 3;
      group.add(mesh);
      culler.add(mesh, s.maxDist ?? Infinity);
    }
    this.chunks.clear();
  }
}

// Instanced prototypes (ground plants, epiphytes, fungi...). Chunked.
export class Scatter {
  constructor() { this.protos = new Map(); }
  register(name, parts, opts = {}) {
    this.protos.set(name, { parts, opts, chunks: new Map() });
  }
  has(name) { return this.protos.has(name); }
  add(name, matrix, color) {
    const p = this.protos.get(name);
    if (!p) throw new Error('unknown proto ' + name);
    const e = matrix.elements;
    const key = chunkOf(e[12], e[14]);
    let c = p.chunks.get(key);
    if (!c) { c = { m: [], col: [] }; p.chunks.set(key, c); }
    for (let i = 0; i < 16; i++) c.m.push(e[i]);
    c.col.push(color ? color.r : 1, color ? color.g : 1, color ? color.b : 1);
  }
  count(name) { let n = 0; for (const c of this.protos.get(name).chunks.values()) n += c.col.length / 3; return n; }
  build(group, culler) {
    for (const [name, p] of this.protos) {
      for (const [key, c] of p.chunks) {
        const count = c.col.length / 3;
        for (const part of p.parts) {
          const mesh = new THREE.InstancedMesh(part.geometry, part.material, count);
          mesh.instanceMatrix.array.set(c.m);
          mesh.instanceMatrix.needsUpdate = true;
          mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.col), 3);
          mesh.castShadow = part.castShadow ?? p.opts.castShadow ?? true;
          mesh.receiveShadow = true;
          if (part.customDepthMaterial) mesh.customDepthMaterial = part.customDepthMaterial;
          mesh.name = name + '|' + key;
          mesh.computeBoundingSphere();
          group.add(mesh);
          culler.add(mesh, p.opts.maxDist ?? 110);
        }
      }
      p.chunks.clear();
    }
  }
}

// Build a basis (x,y,z) where y = 'up' direction of the card and z faces 'faceHint'.
export function cardBasis(yDir, faceHint, outX, outY, outZ) {
  outY.copy(yDir).normalize();
  outZ.copy(faceHint).addScaledVector(outY, -faceHint.dot(outY));
  if (outZ.lengthSq() < 1e-6) { outZ.set(0, 0, 1).addScaledVector(outY, -outY.z); }
  outZ.normalize();
  outX.crossVectors(outY, outZ).normalize();
}

// Lianas, aerial roots, trunk-climbing aroids and shingle plants, monkey-ladder vines.
import * as THREE from 'three';
import { addTube, addLoft, cardBasis } from '../core/geometry.js';
import { CELL, cellRect } from '../core/textures.js';
import { WORLD, QUALITY } from '../core/shared.js';

const UP = new THREE.Vector3(0, 1, 0);
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();

export class Vines {
  constructor({ forest, terrain, batch, cards, colliders, rng }) {
    Object.assign(this, { forest, terrain, batch, cards, colliders, rng });
    this.count = { lianas: 0, hanging: 0, roots: 0, climbers: 0, feasting: 0 };
    this.trails = []; // traversal network: polylines along vines/limbs (ants, climbers)
  }

  leaf(p, out, size, cell = CELL.heart, tint = null, pressed = false) {
    const rng = this.rng;
    const ydir = pressed ? new THREE.Vector3(out.x * 0.15, 1, out.z * 0.15) : out.clone().add(new THREE.Vector3(0, rng.range(-0.3, 0.4), 0));
    cardBasis(ydir, pressed ? out : out.clone().add(UP), _X, _Y, _Z);
    const v = rng.range(0.85, 1.1);
    const col = tint ? tint.clone().multiplyScalar(v) : new THREE.Color(v, v, v);
    this.cards.add('detail', p.clone().addScaledVector(_Y, -size * 0.15), _X, _Y, _Z, size, size, cellRect(cell), col,
      { bend: pressed ? 0.02 : -size * 0.2, fold: pressed ? 0 : size * 0.1, wind: pressed ? 0.005 : 0.04 }, _Z.clone());
  }

  // sagging liana between two points
  catenary(a, b, r, rng, sagMul = 1) {
    const span = a.distanceTo(b);
    const sag = span * rng.range(0.12, 0.45) * sagMul;
    const n = Math.max(6, Math.ceil(span / 0.9));
    const pts = [], radii = [];
    const twist = rng.range(0, 6.28);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= sag * 4 * t * (1 - t);
      p.x += Math.sin(t * 9 + twist) * 0.05; p.z += Math.cos(t * 7 + twist) * 0.05;
      pts.push(p); radii.push(r * (0.85 + 0.15 * Math.sin(t * 13)));
    }
    const mb = this.batch.get('vine', a.x, a.z);
    mb.setColor(new THREE.Color(0x8a7a5a).multiplyScalar(rng.range(0.8, 1.1)));
    addTube(mb, pts, radii, { radial: 4, vScale: 0.6, windFn: (i) => 0.05 + 0.25 * 4 * (i / n) * (1 - i / n) * Math.min(1, span / 10) });
    for (let i = 2; i < n - 1; i += rng.int(2, 5)) {
      if (rng.chance(0.4)) this.leaf(pts[i], new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize(), rng.range(0.15, 0.3));
    }
  }

  // woody liana dropping from the canopy to the floor, twisted pair of strands
  dropLiana(top, rng) {
    const gx = top.x + rng.range(-4, 4), gz = top.z + rng.range(-4, 4);
    if (this.terrain.bankDist(gx, gz) < 0.5) return;
    const gy = this.terrain.height(gx, gz);
    const bottom = new THREE.Vector3(gx, gy - 0.2, gz);
    const h = top.y - gy;
    const n = Math.ceil(h / 1.0);
    const mid = [];
    const loopAt = rng.chance(0.4) ? rng.range(0.3, 0.8) : -1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = top.clone().lerp(bottom, t);
      // hang mostly vertical then sweep to the ground anchor
      const sweep = Math.pow(t, 3);
      p.x = top.x + (gx - top.x) * sweep + Math.sin(t * 11 + gx) * 0.25 * (1 - t);
      p.z = top.z + (gz - top.z) * sweep + Math.cos(t * 9 + gz) * 0.25 * (1 - t);
      if (loopAt > 0 && Math.abs(t - loopAt) < 0.06) {
        const k = (t - loopAt + 0.06) / 0.12 * Math.PI * 2;
        p.x += Math.sin(k) * 0.6; p.y += (1 - Math.cos(k)) * 0.5;
      }
      mid.push(p);
    }
    const r = rng.range(0.025, 0.06);
    const strands = rng.chance(0.55) ? 2 : 1;
    const mb = this.batch.get('vine', top.x, top.z);
    mb.setColor(new THREE.Color(0x7a6a50).multiplyScalar(rng.range(0.8, 1.15)));
    for (let s = 0; s < strands; s++) {
      const pts = mid.map((p, i) => {
        if (strands === 1) return p.clone();
        const a = i * 0.9 + s * Math.PI;
        return p.clone().add(new THREE.Vector3(Math.cos(a) * r * 1.1, 0, Math.sin(a) * r * 1.1));
      });
      addTube(mb, pts, pts.map((_, i) => r * (strands === 2 ? 0.7 : 1) * (0.8 + 0.4 * (i / n))), {
        radial: 4, vScale: 0.6, windFn: (i) => 0.12 * Math.sin(Math.PI * Math.min(1, i / n * 1.2)) * (1 - Math.pow(i / n, 4)),
      });
    }
    for (let i = 0; i < mid.length - 1; i += 2) this.colliders.addCapsule(mid[i], mid[Math.min(mid.length - 1, i + 2)], r + 0.02);
    for (let i = 3; i < mid.length - 2; i += rng.int(2, 4)) {
      if (rng.chance(0.45)) this.leaf(mid[i], new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize(), rng.range(0.15, 0.35), rng.chance(0.7) ? CELL.heart : CELL.lance);
    }
    this.count.hanging++;
  }

  monkeyLadder(top, rng) {
    // Bauhinia: a flat ribbon that zigzags as it falls
    const gx = top.x + rng.range(-2, 2), gz = top.z + rng.range(-2, 2);
    const gy = this.terrain.height(gx, gz);
    const h = top.y - gy;
    const n = Math.ceil(h / 0.25);
    const side = new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize();
    const fwd = new THREE.Vector3().crossVectors(UP, side);
    const rings = [];
    const W = rng.range(0.06, 0.1), Tk = 0.012;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = top.y - t * (h + 0.2);
      const zig = Math.sin(i * 1.15) * 0.12;
      const c = new THREE.Vector3(top.x + (gx - top.x) * t * t, y, top.z + (gz - top.z) * t * t).addScaledVector(side, zig);
      const pts = [], nrm = [];
      const M = 8;
      for (let j = 0; j < M; j++) {
        const th = (j / M) * Math.PI * 2;
        const cs = Math.cos(th), sn = Math.sin(th);
        pts.push(c.clone().addScaledVector(side, -cs * W).addScaledVector(fwd, sn * Tk));
        nrm.push(side.clone().multiplyScalar(-cs / W).addScaledVector(fwd, sn / Tk).normalize());
      }
      rings.push({ pts, nrm, v: t * h / 0.5 });
    }
    const mb = this.batch.get('vine', top.x, top.z);
    mb.setColor(new THREE.Color(0x8a6a48));
    addLoft(mb, rings, 1, (i) => 0.1 * Math.sin(Math.PI * i / n));
  }

  aerialRoots(h, rng, bunch) {
    const gy = this.terrain.height(h.p.x, h.p.z);
    const mb = this.batch.get('vine', h.p.x, h.p.z);
    for (let k = 0; k < bunch; k++) {
      const start = h.p.clone().add(new THREE.Vector3(rng.range(-0.4, 0.4), 0, rng.range(-0.4, 0.4)));
      const reach = rng.chance(0.5) ? 1 : rng.range(0.3, 0.95);
      const endY = reach === 1 ? gy - 0.1 : start.y - (start.y - gy) * reach;
      const len = start.y - endY;
      const n = Math.max(2, Math.ceil(len / 2.5));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push(new THREE.Vector3(start.x + Math.sin(t * 5 + k) * 0.05, start.y - t * len, start.z + Math.cos(t * 4 + k) * 0.05));
      }
      mb.setColor(new THREE.Color(rng.chance(0.5) ? 0x9a6a4a : 0x7a6a50));
      const r = rng.range(0.009, 0.018);
      addTube(mb, pts, pts.map(() => r), { radial: 3, vScale: 0.5, capEnd: true, windFn: (i) => (reach === 1 ? 0.08 * Math.sin(Math.PI * i / n) : 0.18 * i / n) });
      this.count.roots++;
    }
  }

  // aroid climbing up a trunk, leaves pressed or held out
  climber(tree, rng) {
    const { pts, radii } = tree.trunk;
    const maxH = Math.min(tree.height * rng.range(0.3, 0.75), rng.range(4, 18));
    const turns = rng.range(0.2, 1.5) * maxH / 6;
    const a0 = rng.range(0, 6.28);
    const path = [];
    const rAt = (y) => { for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1].y >= y) { const f = (y - pts[i].y) / Math.max(1e-4, pts[i + 1].y - pts[i].y); return [THREE.MathUtils.lerp(radii[i], radii[i + 1], f), THREE.MathUtils.lerp(pts[i].x, pts[i + 1].x, f), THREE.MathUtils.lerp(pts[i].z, pts[i + 1].z, f)]; } return [radii[radii.length - 1], pts[pts.length - 1].x, pts[pts.length - 1].z]; };
    const n = Math.ceil(maxH / 0.35);
    const kind = rng.next();
    const shingle = tree.radius < 0.25 && kind < 0.35;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = tree.gy - 0.1 + t * maxH;
      const [r, cx, cz] = rAt(y);
      const a = a0 + t * turns * Math.PI * 2 + Math.sin(t * 7) * 0.1;
      const rr = r * (1 + 0.15 * Math.exp(-(y - tree.gy) / 1.5)) + 0.015;
      path.push(new THREE.Vector3(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr));
      // leaves
      if (i > 1 && i % (shingle ? 1 : 2) === 0) {
        const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        if (shingle) {
          for (const s of [-1, 1]) {
            const aa = a + s * 0.25;
            const o2 = new THREE.Vector3(Math.cos(aa), 0, Math.sin(aa));
            this.leaf(new THREE.Vector3(cx + Math.cos(aa) * (rr + 0.005), y - 0.05, cz + Math.sin(aa) * (rr + 0.005)), o2, 0.11, CELL.broad, new THREE.Color(0.75, 0.95, 0.7), true);
          }
        } else {
          const size = 0.12 + 0.45 * t * rng.range(0.7, 1.1);
          const side = (i / 2) % 2 ? 1 : -1;
          const o2 = out.clone().applyAxisAngle(UP, side * 0.6);
          this.leaf(path[i].clone().addScaledVector(o2, 0.02), o2, size, kind > 0.7 ? CELL.monstera : CELL.heart, null, t < 0.25);
        }
      }
    }
    const mb = this.batch.get('vine', tree.x, tree.z);
    mb.setColor(new THREE.Color(0x5a6a3a));
    addTube(mb, path, path.map(() => (shingle ? 0.008 : 0.016)), { radial: 4, vScale: 0.4 });
    // a few aerial roots hanging from the climber
    if (!shingle && maxH > 6) {
      for (let k = 0; k < 4; k++) {
        const p = path[Math.floor(path.length * rng.range(0.5, 0.95))];
        this.aerialRoots({ p: p.clone().add(new THREE.Vector3(0, -0.05, 0)) }, rng, 1);
      }
    }
    this.count.climbers++;
  }

  // dense leafy curtain hanging from a limb (common along rivers and light gaps)
  curtain(h, rng) {
    const strands = rng.int(5, 12);
    const gy = Math.max(0, this.terrain.height(h.p.x, h.p.z));
    const mb = this.batch.get('vine', h.p.x, h.p.z);
    mb.setColor(new THREE.Color(0x5a6a3a));
    const along = new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize();
    for (let k = 0; k < strands; k++) {
      const top = h.p.clone().addScaledVector(along, (k - strands / 2) * rng.range(0.15, 0.3));
      const len = (top.y - gy) * rng.range(0.25, 0.95);
      const n = Math.max(3, Math.ceil(len / 0.8));
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(top.clone().add(new THREE.Vector3(Math.sin(i * 0.7 + k) * 0.04, -len * i / n, Math.cos(i * 0.5 + k) * 0.04)));
      addTube(mb, pts, pts.map(() => 0.006), { radial: 3, windFn: (i) => 0.25 * i / n });
      const out = new THREE.Vector3().crossVectors(along, UP);
      for (let i = 1; i <= n; i++) {
        if (!rng.chance(0.8)) continue;
        const o = out.clone().multiplyScalar(rng.sign()).applyAxisAngle(UP, rng.range(-0.6, 0.6));
        this.leaf(pts[i], o, rng.range(0.1, 0.22), rng.chance(0.6) ? CELL.heart : CELL.broad);
      }
    }
  }

  // creepers snaking over the forest floor, leaves pressed to the litter
  groundCreeper(x, z, rng) {
    const T = this.terrain;
    let a = rng.range(0, 6.28);
    const n = rng.int(10, 28);
    const pts = [];
    let px = x, pz = z;
    for (let i = 0; i <= n; i++) {
      a += rng.range(-0.4, 0.4);
      px += Math.cos(a) * 0.25; pz += Math.sin(a) * 0.25;
      pts.push(new THREE.Vector3(px, T.height(px, pz) + 0.015, pz));
    }
    if (pts.some((p) => T.bankDist(p.x, p.z) < 0.2)) return;
    const mb = this.batch.get('vine', x, z);
    mb.setColor(new THREE.Color(0x4a5a2a));
    addTube(mb, pts, pts.map(() => 0.007), { radial: 3 });
    for (let i = 1; i < pts.length; i++) {
      if (!rng.chance(0.75)) continue;
      const out = new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize();
      const s = rng.range(0.06, 0.13);
      cardBasis(out.clone().setY(0.25), UP, _X, _Y, _Z);
      const v = rng.range(0.8, 1.1);
      this.cards.add('detail', pts[i].clone(), _X, _Y, _Z, s, s, cellRect(rng.chance(0.5) ? CELL.heart : CELL.broad), new THREE.Color(v, v, v), { bend: -s * 0.2, fold: 0, wind: 0.01 }, UP.clone());
    }
  }

  // Spatial index of every foliage node in every colonised crown.
  indexLeaves() {
    this.leafGrid = new Map();
    for (const t of this.forest.trees) {
      if (!t.leafNodes) continue;
      for (const i of t.leafNodes) {
        const k = Math.floor(t.skel.x[i] / 5) + ',' + Math.floor(t.skel.z[i] / 5);
        let a = this.leafGrid.get(k); if (!a) { a = []; this.leafGrid.set(k, a); }
        a.push({ t, i });
      }
    }
  }
  leavesNear(p, r) {
    const out = [];
    const g = Math.ceil(r / 5), cx = Math.floor(p.x / 5), cz = Math.floor(p.z / 5);
    for (let dx = -g; dx <= g; dx++) for (let dz = -g; dz <= g; dz++) {
      for (const e of this.leafGrid.get((cx + dx) + ',' + (cz + dz)) || []) {
        const sk = e.t.skel;
        const d = Math.hypot(sk.x[e.i] - p.x, sk.y[e.i] - p.y, sk.z[e.i] - p.z);
        if (d < r) out.push({ ...e, d });
      }
    }
    return out;
  }

  // A liana that climbs a host, runs out along its limbs, smothers the crown in its own
  // foliage, bridges to neighbouring crowns and lets curtains fall from the edges.
  feast(host, rng, budget) {
    const sk = host.skel;
    if (!sk) return;
    const path = [];
    const { pts, radii } = host.trunk;
    const rAt = (y) => { for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1].y >= y) return [radii[i], pts[i].x, pts[i].z]; return [radii[radii.length - 1], pts[pts.length - 1].x, pts[pts.length - 1].z]; };
    const vr = rng.range(0.035, 0.08);
    // 1. climb the trunk in a loose helix
    const a0 = rng.range(0, 6.28), turns = rng.range(0.2, 1.1);
    const y0 = host.gy - 0.15, y1 = pts[pts.length - 1].y;
    for (let y = y0; y < y1; y += 0.6) {
      const t = (y - y0) / (y1 - y0);
      const [r, cx, cz] = rAt(y);
      const a = a0 + t * turns * Math.PI * 2;
      const rr = r * (1 + 0.6 * Math.exp(-(y - host.gy) / 1.2)) + vr;
      path.push(new THREE.Vector3(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr));
    }
    const climbEnd = path.length;
    // 2. follow the limbs out to a high, outer twig
    let best = -1, bestS = -Infinity;
    for (let k = 0; k < 40; k++) {
      const i = rng.pick(host.leafNodes);
      const sc = sk.y[i] + 0.3 * Math.hypot(sk.x[i] - host.x, sk.z[i] - host.z) + rng.range(0, 3);
      if (sc > bestS) { bestS = sc; best = i; }
    }
    if (best < 0) return;
    const chain = [];
    for (let i = best; i > 0; i = sk.par[i]) chain.push(i);
    chain.reverse();
    for (let k = 0; k < chain.length; k += 2) {
      const i = chain[k];
      path.push(new THREE.Vector3(sk.x[i], sk.y[i] + sk.r[i] + vr, sk.z[i]));
    }
    // 3. blanket the crown, hopping to neighbours
    let cur = { t: host, i: best };
    const visited = new Set([host.x + ':' + best]);
    const tint = new THREE.Color(...(rng.chance(0.5) ? [0.95, 1.12, 0.72] : [0.85, 1.0, 0.95]));
    let hosts = 1;
    for (let step = 0; step < budget; step++) {
      const cs = cur.t.skel;
      const p = new THREE.Vector3(cs.x[cur.i], cs.y[cur.i], cs.z[cur.i]);
      const near = this.leavesNear(p, 3.2).filter((e) => e.d > 0.7 && !visited.has(e.t.x + ':' + e.i));
      const own = near.filter((e) => e.t === cur.t);
      let next = null;
      const wantBridge = own.length === 0 || (hosts < 4 && rng.chance(0.06));
      if (!wantBridge) {
        let bs = -Infinity;
        for (const e of own) { const sc = e.t.skel.y[e.i] * 0.4 - e.d * 0.5 + rng.range(0, 1.2); if (sc > bs) { bs = sc; next = e; } }
      } else {
        const far = this.leavesNear(p, 10).filter((e) => e.t !== cur.t && e.d > 2.5 && !visited.has(e.t.x + ':' + e.i));
        if (far.length) {
          far.sort((a, b) => a.d - b.d);
          next = far[Math.min(far.length - 1, rng.int(0, 3))];
          // sagging bridge between crowns
          const q = new THREE.Vector3(next.t.skel.x[next.i], next.t.skel.y[next.i] + 0.3, next.t.skel.z[next.i]);
          const span = p.distanceTo(q), n = Math.ceil(span / 0.6);
          for (let k = 1; k < n; k++) {
            const t = k / n;
            const b = p.clone().lerp(q, t); b.y += 0.3 - span * 0.18 * 4 * t * (1 - t);
            path.push(b);
            if (rng.chance(0.25)) this.leaf(b, new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize(), rng.range(0.15, 0.3), CELL.heart, tint);
          }
          hosts++;
        } else if (own.length) next = own[0];
      }
      if (!next) break;
      visited.add(next.t.x + ':' + next.i);
      const ns = next.t.skel;
      const q = new THREE.Vector3(ns.x[next.i], ns.y[next.i] + 0.35, ns.z[next.i]);
      path.push(q);
      // smother the host foliage with vine leaves
      for (let k = 0; k < 4; k++) {
        const o = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.2, 0.3), rng.range(-1, 1)).normalize();
        const lp = q.clone().addScaledVector(o, rng.range(0.1, 0.6));
        cardBasis(o.clone().setY(0.3), UP.clone().addScaledVector(o, 0.3), _X, _Y, _Z);
        const sz = rng.range(0.3, 0.6), v = rng.range(0.85, 1.1);
        this.cards.add('crown', lp, _X, _Y, _Z, sz, sz, cellRect(rng.chance(0.6) ? CELL.heart : CELL.broad), tint.clone().multiplyScalar(v),
          { bend: -sz * 0.25, fold: sz * 0.05, wind: 0.04 }, UP.clone().addScaledVector(o, 0.4).normalize());
      }
      // curtains drop from the crown edge
      const ct = next.t;
      const edge = Math.hypot(q.x - ct.crownC.x, q.z - ct.crownC.z) / ct.crownR;
      if (edge > 0.72 && rng.chance(0.22)) this.curtain({ p: q.clone().add(new THREE.Vector3(0, -0.4, 0)) }, rng);
      cur = next;
    }
    if (path.length < climbEnd + 3) return;
    // smooth the walk a little and emit one continuous stem
    for (let it = 0; it < 2; it++) for (let i = climbEnd + 1; i < path.length - 1; i++) path[i].lerp(path[i - 1].clone().add(path[i + 1]).multiplyScalar(0.5), 0.4);
    const mb = this.batch.get('vine', host.x, host.z);
    mb.setColor(new THREE.Color(0x7a6a4a).multiplyScalar(rng.range(0.8, 1.1)));
    const n = path.length;
    addTube(mb, path, path.map((_, i) => vr * (1 - 0.6 * i / n)), { radial: 4, vScale: 0.6, windFn: (i) => (i < climbEnd ? 0 : 0.03) });
    for (let i = 0; i < climbEnd - 1; i += 2) this.colliders.addCapsule(path[i], path[Math.min(climbEnd - 1, i + 2)], vr + 0.02);
    this.trails.push({ pts: path, host, climbEnd });
    this.count.feasting++;
  }

  populate() {
    const F = this.forest, rng = this.rng;
    // feasting lianas over the canopy and sub-canopy
    this.indexLeaves();
    const hosts = F.trees.filter((t) => t.skel && t.type !== 'understory');
    const nFeast = Math.round(Math.min(hosts.length * 0.35, 150) * Math.max(0.6, QUALITY.density));
    for (let i = 0; i < nFeast; i++) {
      const h = rng.pick(hosts);
      this.feast(h, rng, rng.int(25, 70));
    }
    // creepers smothering understory saplings
    const small = F.trees.filter((t) => t.skel && t.type === 'understory');
    for (let i = 0; i < Math.min(110, small.length * 0.2); i++) this.feast(rng.pick(small), rng, rng.int(6, 16));
    // lianas between neighbouring crowns
    const tips = F.tips.filter((t) => t.tree.type !== 'understory' && t.p.y > 10);
    const grid = new Map();
    const key = (x, z) => Math.floor(x / 15) + ',' + Math.floor(z / 15);
    for (const t of tips) { const k = key(t.p.x, t.p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t); }
    let made = 0;
    for (let i = 0; i < tips.length && made < 420; i++) {
      if (!rng.chance(0.45)) continue;
      const a = tips[i];
      const [gx, gz] = [Math.floor(a.p.x / 15), Math.floor(a.p.z / 15)];
      const cand = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        for (const b of grid.get((gx + dx) + ',' + (gz + dz)) || []) {
          if (b.tree === a.tree) continue;
          const d = a.p.distanceTo(b.p);
          if (d > 4 && d < 20) cand.push(b);
        }
      }
      if (!cand.length) continue;
      const b = rng.pick(cand);
      this.catenary(a.p.clone().add(new THREE.Vector3(0, -0.3, 0)), b.p.clone().add(new THREE.Vector3(0, -0.3, 0)), rng.range(0.025, 0.06), rng);
      made++;
    }
    this.count.lianas = made;
    // deep liana loops hanging beneath the emergent crowns
    let loops = 0;
    for (const t of F.trees) {
      if (!['giant', 'kapok', 'brazilnut', 'fig'].includes(t.type)) continue;
      const hs = F.hangs.filter((h) => h.tree === t);
      for (let k = 0; k < Math.min(14, hs.length); k++) {
        const a = rng.pick(hs), b = rng.pick(hs);
        const d = a.p.distanceTo(b.p);
        if (d < 2.5 || d > 14) continue;
        this.catenary(a.p.clone(), b.p.clone(), rng.range(0.03, 0.07), rng, rng.range(1.8, 4));
        loops++;
      }
    }
    this.count.loops = loops;
    // hanging woody lianas + monkey ladders
    const big = F.hangs.filter((h) => h.p.y > 12);
    for (let i = 0; i < 200 && big.length; i++) this.dropLiana(rng.pick(big).p.clone(), rng);
    for (let i = 0; i < 10 && big.length; i++) this.monkeyLadder(rng.pick(big).p.clone(), rng);
    // aerial roots (figs & kapoks especially)
    for (const h of F.hangs) {
      const t = h.tree;
      const p = t.type === 'fig' ? 0.6 : t.type === 'kapok' ? 0.22 : t.type === 'canopy' ? 0.06 : 0.03;
      if (rng.chance(p)) this.aerialRoots(h, rng, rng.int(2, 7));
    }
    // climbers on trunks
    for (const t of F.trees) {
      if (!t.trunk || t.type === 'cecropia') continue;
      const p = t.type === 'understory' ? 0.35 : t.type === 'midstory' ? 0.65 : 0.8;
      if (rng.chance(p)) this.climber(t, rng);
      if (t.radius > 0.6 && rng.chance(0.8)) this.climber(t, rng);
      if (t.radius > 1.2) { this.climber(t, rng); this.climber(t, rng); }
    }
    // curtains near the river and in light gaps
    let curtains = 0;
    for (const h of F.hangs) {
      if (curtains > 140) break;
      const nearWater = this.terrain.bankDist(h.p.x, h.p.z) < 10;
      if (h.p.y < 6 || !rng.chance(nearWater ? 0.35 : F.coverAt(h.p.x, h.p.z) < 0.55 ? 0.12 : 0.03)) continue;
      this.curtain(h, rng); curtains++;
    }
    this.count.curtains = curtains;
    const R = WORLD.radius - 3;
    for (let i = 0; i < 260; i++) {
      const x = rng.range(-R, R), z = rng.range(-R, R);
      if (Math.hypot(x, z) < R && this.terrain.bankDist(x, z) > 0.8) this.groundCreeper(x, z, rng);
    }
  }
}

// Capsule colliders in a spatial hash, used to keep the dragonfly out of trunks and limbs.
import * as THREE from 'three';

const _ab = new THREE.Vector3(), _ap = new THREE.Vector3(), _c = new THREE.Vector3();

export class Colliders {
  constructor(cell = 6) { this.cell = cell; this.grid = new Map(); this.list = []; }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  addCapsule(a, b, r) {
    const c = { a: a.clone(), b: b.clone(), r };
    this.list.push(c);
    const s = this.cell;
    const x0 = Math.floor((Math.min(a.x, b.x) - r) / s), x1 = Math.floor((Math.max(a.x, b.x) + r) / s);
    const z0 = Math.floor((Math.min(a.z, b.z) - r) / s), z1 = Math.floor((Math.max(a.z, b.z) + r) / s);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = this.key(i, j);
      let arr = this.grid.get(k); if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(c);
    }
  }
  // Push point p (Vector3) out of any capsule; returns true when a hit occurred.
  resolve(p, rad) {
    const arr = this.grid.get(this.key(Math.floor(p.x / this.cell), Math.floor(p.z / this.cell)));
    if (!arr) return false;
    let hit = false;
    for (const c of arr) {
      _ab.subVectors(c.b, c.a);
      _ap.subVectors(p, c.a);
      const t = Math.max(0, Math.min(1, _ap.dot(_ab) / Math.max(_ab.lengthSq(), 1e-9)));
      _c.copy(c.a).addScaledVector(_ab, t);
      const d = p.distanceTo(_c), min = c.r + rad;
      if (d < min) {
        if (d < 1e-5) p.x += min; else p.sub(_c).multiplyScalar(min / d).add(_c);
        hit = true;
      }
    }
    return hit;
  }
  // distance from p to the nearest capsule surface (approx, within the cell)
  nearest(p) {
    const arr = this.grid.get(this.key(Math.floor(p.x / this.cell), Math.floor(p.z / this.cell)));
    let best = Infinity;
    if (!arr) return best;
    for (const c of arr) {
      _ab.subVectors(c.b, c.a); _ap.subVectors(p, c.a);
      const t = Math.max(0, Math.min(1, _ap.dot(_ab) / Math.max(_ab.lengthSq(), 1e-9)));
      _c.copy(c.a).addScaledVector(_ab, t);
      best = Math.min(best, p.distanceTo(_c) - c.r);
    }
    return best;
  }
}

// Compact index of every branch / vine / root segment (capsules, typed arrays) so the
// dragonfly — and anything else — can find the nearest surface to land on and crawl along.
export class SegmentIndex {
  constructor(cell = 2) {
    this.cell = cell; this.n = 0;
    this.d = new Float32Array(7 * 131072);
    this.grid = new Map();
  }
  key(i, j) { return (i + 5000) * 10000 + (j + 5000); }
  add(a, b, r) {
    if (this.n * 7 + 7 > this.d.length) { const nd = new Float32Array(this.d.length * 2); nd.set(this.d); this.d = nd; }
    const o = this.n * 7, d = this.d;
    d[o] = a.x; d[o + 1] = a.y; d[o + 2] = a.z; d[o + 3] = b.x; d[o + 4] = b.y; d[o + 5] = b.z; d[o + 6] = r;
    const s = this.cell;
    const x0 = Math.floor((Math.min(a.x, b.x) - r) / s), x1 = Math.floor((Math.max(a.x, b.x) + r) / s);
    const z0 = Math.floor((Math.min(a.z, b.z) - r) / s), z1 = Math.floor((Math.max(a.z, b.z) + r) / s);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = this.key(i, j);
      let arr = this.grid.get(k); if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(this.n);
    }
    this.n++;
  }
  // nearest capsule surface point to q within maxD: { d, p, n } or null
  nearest(q, maxD, out = { p: new THREE.Vector3(), n: new THREE.Vector3(), d: 0, seg: -1 }) {
    const s = this.cell, d = this.d;
    const g = Math.ceil(maxD / s);
    const ci = Math.floor(q.x / s), cj = Math.floor(q.z / s);
    let best = maxD, found = false;
    for (let i = ci - g; i <= ci + g; i++) for (let j = cj - g; j <= cj + g; j++) {
      const arr = this.grid.get(this.key(i, j)); if (!arr) continue;
      for (const k of arr) {
        const o = k * 7;
        const ax = d[o], ay = d[o + 1], az = d[o + 2], vx = d[o + 3] - ax, vy = d[o + 4] - ay, vz = d[o + 5] - az, r = d[o + 6];
        const l2 = vx * vx + vy * vy + vz * vz;
        let t = l2 > 0 ? ((q.x - ax) * vx + (q.y - ay) * vy + (q.z - az) * vz) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = ax + vx * t, cy = ay + vy * t, cz = az + vz * t;
        const dx = q.x - cx, dy = q.y - cy, dz = q.z - cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const sd = Math.abs(dist - r);
        if (sd < best) {
          best = sd; found = true;
          if (dist > 1e-6) out.n.set(dx / dist, dy / dist, dz / dist); else out.n.set(0, 1, 0);
          out.p.set(cx + out.n.x * r, cy + out.n.y * r, cz + out.n.z * r);
          out.d = sd; out.seg = k;
        }
      }
    }
    return found ? out : null;
  }
}

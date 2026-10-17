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

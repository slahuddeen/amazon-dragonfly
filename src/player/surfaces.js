// Everything the dragonfly (or an ant) can stand on: every branch, twig, vine and root
// (SegmentIndex), boulders/logs/buttresses (Colliders), the ground, and leaves — leaves are
// ray-tested against the instanced foliage and checked against the leaf atlas alpha, so you
// land on the leaf blade, not on the transparent corner of its card.
import * as THREE from 'three';

const _ray = new THREE.Raycaster();
const _m = new THREE.Matrix4(), _n3 = new THREE.Matrix3();
const _ab = new THREE.Vector3(), _ap = new THREE.Vector3(), _c = new THREE.Vector3();

export class Surfaces {
  constructor({ index, colliders, terrain, world, atlas }) {
    Object.assign(this, { index, colliders, terrain, world, atlas });
    this.alpha = atlas.image.data; this.N = atlas.image.width;
    this.near = []; this.nearAt = new THREE.Vector3(1e9, 0, 0);
    _ray.layers.enableAll();
  }
  // foliage / plant meshes close to p (refreshed as you move)
  refresh(p) {
    if (this.nearAt.distanceToSquared(p) < 4) return;
    this.nearAt.copy(p);
    this.near = [];
    this.world.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.isInstancedMesh) return;
      const bs = o.boundingSphere || (o.computeBoundingSphere(), o.boundingSphere);
      if (bs.center.distanceTo(p) < bs.radius + 6) this.near.push(o);
    });
  }
  solidAt(hit) {
    const o = hit.object, mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat.map !== this.atlas || !hit.uv) return true;
    let u = hit.uv.x, v = hit.uv.y;
    const cell = o.geometry.attributes.aCell;
    if (cell && hit.instanceId !== undefined) {
      u = cell.getX(hit.instanceId) + u * cell.getZ(hit.instanceId);
      v = cell.getY(hit.instanceId) + v * cell.getW(hit.instanceId);
    }
    const N = this.N, x = Math.min(N - 1, Math.max(0, Math.floor(u * N))), y = Math.min(N - 1, Math.max(0, Math.floor(v * N)));
    return this.alpha[(y * N + x) * 4 + 3] > 110;
  }
  // first solid leaf/plant hit along a ray
  leafHit(origin, dir, far, out) {
    _ray.set(origin, dir); _ray.near = 0; _ray.far = far;
    const hits = _ray.intersectObjects(this.near, false);
    for (const h of hits) {
      if (!this.solidAt(h)) continue;
      const o = h.object;
      out.p.copy(h.point);
      out.n.copy(h.face ? h.face.normal : _c.set(0, 1, 0));
      if (h.instanceId !== undefined) {
        o.getMatrixAt(h.instanceId, _m);
        _n3.getNormalMatrix(_m);
        out.n.applyMatrix3(_n3);
        // cards are bent in the vertex shader: follow the visible curve
        const par = o.geometry.attributes.aParams;
        if (par && h.uv) {
          const z = new THREE.Vector3().setFromMatrixColumn(_m, 2).normalize();
          out.p.addScaledVector(z, par.getX(h.instanceId) * h.uv.y * h.uv.y);
        }
      }
      out.n.normalize();
      if (out.n.dot(dir) > 0) out.n.negate();
      out.d = h.distance; out.kind = 'leaf';
      return out;
    }
    return null;
  }
  colliderNearest(q, maxD, out) {
    const C = this.colliders;
    const arr = C.grid.get(C.key(Math.floor(q.x / C.cell), Math.floor(q.z / C.cell)));
    if (!arr) return null;
    let best = maxD, found = false;
    for (const c of arr) {
      _ab.subVectors(c.b, c.a); _ap.subVectors(q, c.a);
      const t = Math.max(0, Math.min(1, _ap.dot(_ab) / Math.max(_ab.lengthSq(), 1e-9)));
      _c.copy(c.a).addScaledVector(_ab, t);
      const dist = q.distanceTo(_c), sd = Math.abs(dist - c.r);
      if (sd < best) {
        best = sd; found = true;
        out.n.subVectors(q, _c).divideScalar(Math.max(dist, 1e-6));
        out.p.copy(_c).addScaledVector(out.n, c.r);
        out.d = sd; out.kind = 'wood';
      }
    }
    return found ? out : null;
  }
  // nearest surface to q; nHint biases the leaf probe direction
  nearest(q, maxD, nHint = null) {
    const cand = [];
    const w = this.index.nearest(q, maxD); if (w) cand.push({ p: w.p.clone(), n: w.n.clone(), d: w.d, kind: 'wood' });
    const c = this.colliderNearest(q, maxD, { p: new THREE.Vector3(), n: new THREE.Vector3() }); if (c) cand.push(c);
    const h = this.terrain.height(q.x, q.z);
    if (q.y - h < maxD && q.y - h > -0.5 && this.terrain.waterAt(q.x, q.z) < h) cand.push({ p: new THREE.Vector3(q.x, h, q.z), n: this.terrain.normal(q.x, q.z), d: Math.abs(q.y - h), kind: 'ground' });
    this.refresh(q);
    const dirs = nHint ? [nHint.clone().negate()] : [new THREE.Vector3(0, -1, 0)];
    for (const d of dirs) {
      const o = q.clone().addScaledVector(d, -Math.min(0.12, maxD));
      const l = this.leafHit(o, d, maxD + 0.12, { p: new THREE.Vector3(), n: new THREE.Vector3() });
      if (l) { l.d = l.p.distanceTo(q); cand.push(l); }
    }
    let best = null;
    for (const k of cand) if (k.d <= maxD && (!best || k.d < best.d)) best = k;
    return best;
  }
  // landing search from a flying position: look down, ahead and around
  landing(pos, forward) {
    let best = this.nearest(pos, 1.2);
    this.refresh(pos);
    const dirs = [forward.clone(), forward.clone().setY(forward.y - 0.6).normalize(), new THREE.Vector3(0, -1, 0)];
    for (const d of dirs) {
      const l = this.leafHit(pos, d, 2.0, { p: new THREE.Vector3(), n: new THREE.Vector3() });
      if (l && (!best || l.d < best.d * 1.5)) best = l;
    }
    return best;
  }
}

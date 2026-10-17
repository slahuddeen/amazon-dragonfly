// Palms and tree ferns: açaí clumps, stilt-rooted walking palms, tree ferns.
import * as THREE from 'three';
import { addTube, addRibbon, addEllipsoid } from '../core/geometry.js';
import { CELL, cellRect } from '../core/textures.js';
import { WORLD } from '../core/shared.js';

const UP = new THREE.Vector3(0, 1, 0);

// A drooping frond ribbon. dir = initial direction (unit), droop = gravity per metre
export function frondPoints(base, dir, length, droop, n = 9, rng = null) {
  const pts = [base.clone()];
  const d = dir.clone(), p = base.clone(), step = length / n;
  for (let i = 1; i <= n; i++) {
    d.y -= droop * step; d.normalize();
    if (rng) { d.x += rng.range(-0.03, 0.03); d.z += rng.range(-0.03, 0.03); d.normalize(); }
    p.addScaledVector(d, step);
    pts.push(p.clone());
  }
  return pts;
}
export function frondWidths(n, width, shape = 0.7) {
  const w = [];
  for (let i = 0; i <= n; i++) { const t = i / n; w.push(width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)), shape)); }
  return w;
}

export class Palms {
  constructor({ terrain, batch, colliders, rng, forest }) {
    Object.assign(this, { terrain, batch, colliders, rng, forest });
    this.crowns = [];
  }

  crown(top, nFronds, len, width, cell, rng, opts = {}) {
    const mb = this.batch.get('plantLeaf', top.x, top.z);
    const col = new THREE.Color();
    for (let i = 0; i < nFronds; i++) {
      const a = (i / nFronds) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const elev = opts.elevBase !== undefined ? opts.elevBase + rng.range(-0.25, 0.25) : rng.range(0.2, 1.2);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
      const L = len * rng.range(0.8, 1.15);
      const n = 10;
      const pts = frondPoints(top, dir, L, (opts.droop ?? 0.35) / L * 2.2, n, rng);
      const v = rng.range(0.85, 1.1);
      const old = elev < 0.1 && rng.chance(0.3);
      col.setRGB(v * (old ? 1.25 : 1), v * (old ? 0.95 : 1), v * (old ? 0.55 : 0.95));
      mb.setColor(col);
      addRibbon(mb, pts, frondWidths(n, width * rng.range(0.85, 1.1)), cellRect(cell), {
        fold: opts.fold ?? 0.5, faceHint: UP, windFn: (s) => 0.04 + 0.16 * s * s,
      });
    }
  }

  acai(x, z, rng) {
    const gy = this.terrain.height(x, z);
    const stems = rng.int(3, 7);
    for (let k = 0; k < stems; k++) {
      const a = rng.range(0, 6.28), off = rng.range(0, 0.9);
      const bx = x + Math.cos(a) * off, bz = z + Math.sin(a) * off;
      const h = rng.range(9, 19) * (k === 0 ? 1.1 : 1);
      const lean = new THREE.Vector3(Math.cos(a) * rng.range(0.03, 0.12), 1, Math.sin(a) * rng.range(0.03, 0.12)).normalize();
      const pts = [], radii = [];
      const r = rng.range(0.065, 0.095);
      const n = Math.ceil(h / 1.5);
      const p = new THREE.Vector3(bx, gy - 0.3, bz), d = lean.clone();
      for (let i = 0; i <= n; i++) {
        pts.push(p.clone()); radii.push(r * (1 - 0.15 * i / n) * (i === 0 ? 1.4 : 1));
        d.x += rng.range(-0.02, 0.02); d.z += rng.range(-0.02, 0.02); d.normalize();
        p.addScaledVector(d, h / n);
      }
      const mb = this.batch.get('barkPalm', bx, bz);
      mb.setColor(new THREE.Color(0xc0b8a8));
      addTube(mb, pts, radii, { radial: 7, vScale: 0.8, capEnd: false, windFn: (i) => (i < 2 ? 0.6 : 0) });
      for (let i = 0; i < pts.length - 1; i++) this.colliders.addCapsule(pts[i], pts[i + 1], radii[i] + 0.02);
      // crownshaft
      const top = pts[pts.length - 1];
      const shaftTop = top.clone().addScaledVector(d, 1.3);
      const mp = this.batch.get('plain', bx, bz);
      mp.setColor(new THREE.Color(0x5a7a3a).lerp(new THREE.Color(0x6a3a3a), rng.next() * 0.5));
      addTube(mp, [top, top.clone().lerp(shaftTop, 0.5), shaftTop], [radii[radii.length - 1] * 1.25, radii[radii.length - 1] * 1.3, radii[radii.length - 1] * 0.9], { radial: 8, capEnd: true });
      // berries
      if (rng.chance(0.6)) {
        const bc = top.clone().addScaledVector(d, 0.1);
        const ba = rng.range(0, 6.28);
        const mbb = this.batch.get('glossy', bx, bz);
        for (let b = 0; b < 3; b++) {
          const dirB = new THREE.Vector3(Math.cos(ba + b * 0.5), -0.6, Math.sin(ba + b * 0.5)).normalize();
          const stem = [bc.clone(), bc.clone().addScaledVector(dirB, 0.7)];
          mp.setColor(new THREE.Color(0x8a6a3a));
          addTube(mp, stem, [0.012, 0.008], { radial: 4 });
          mbb.setColor(new THREE.Color(0x2a0a28));
          for (let q = 0; q < 14; q++) {
            const t = rng.range(0.2, 1);
            const c = stem[0].clone().lerp(stem[1], t).add(new THREE.Vector3(rng.range(-0.05, 0.05), rng.range(-0.05, 0.05), rng.range(-0.05, 0.05)));
            addEllipsoid(mbb, c, 0.028, 0.028, 0.028, { w: 5, h: 4 });
          }
        }
      }
      this.crown(shaftTop, rng.int(8, 12), rng.range(2.4, 3.4), 0.42, CELL.palm, rng, { droop: 0.5, fold: 0.85, elevBase: 0.5 });
      this.crowns.push({ x: shaftTop.x, z: shaftTop.z, r: 2.5, top: shaftTop.y + 1.5 });
      this.forest.perches.push({ p: shaftTop.clone(), dir: new THREE.Vector3(1, 0, 0), tree: null, palm: true });
    }
  }

  walking(x, z, rng) {
    const gy = this.terrain.height(x, z);
    const h = rng.range(12, 19);
    const r = rng.range(0.09, 0.13);
    const rootTop = rng.range(1.2, 2.4);
    const base = new THREE.Vector3(x, gy + rootTop, z);
    const pts = [], radii = [];
    const n = Math.ceil(h / 1.5);
    for (let i = 0; i <= n; i++) {
      pts.push(new THREE.Vector3(x + Math.sin(i * 0.3) * 0.05, base.y + (i / n) * (h - rootTop), z));
      radii.push(r * (1 - 0.1 * i / n));
    }
    const mb = this.batch.get('barkPalm', x, z);
    mb.setColor(new THREE.Color(0xb8b0a0));
    addTube(mb, pts, radii, { radial: 8, vScale: 0.8 });
    this.colliders.addCapsule(pts[0], pts[pts.length - 1], r + 0.03);
    // stilt roots cone
    const roots = rng.int(9, 16);
    const mr = this.batch.get('barkDark', x, z);
    mr.setColor(new THREE.Color(0x8a7a62));
    for (let k = 0; k < roots; k++) {
      const a = (k / roots) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const y0 = gy + rootTop * rng.range(0.55, 1.05);
      const spread = rng.range(0.7, 1.5);
      const gx = x + Math.cos(a) * spread, gz = z + Math.sin(a) * spread;
      const g1 = this.terrain.height(gx, gz) - 0.1;
      const p0 = new THREE.Vector3(x + Math.cos(a) * r * 0.5, y0, z + Math.sin(a) * r * 0.5);
      const p2 = new THREE.Vector3(gx, g1, gz);
      const p1 = p0.clone().lerp(p2, 0.5); p1.x += Math.cos(a) * 0.12; p1.z += Math.sin(a) * 0.12; p1.y += 0.1;
      const rr = rng.range(0.025, 0.045);
      addTube(mr, [p0, p1, p2], [rr, rr * 1.1, rr * 1.3], { radial: 5, windFn: () => 0.5 });
      this.colliders.addCapsule(p0, p2, rr + 0.02);
    }
    const top = pts[pts.length - 1];
    const mp = this.batch.get('plain', x, z);
    mp.setColor(new THREE.Color(0x4a6a32));
    const shaftTop = top.clone().add(new THREE.Vector3(0, 1.2, 0));
    addTube(mp, [top, shaftTop], [r * 1.2, r * 1.0], { radial: 8, capEnd: true });
    this.crown(shaftTop, rng.int(6, 9), rng.range(2.8, 3.8), 0.55, CELL.palm, rng, { droop: 0.4, fold: 0.45, elevBase: 0.6 });
    this.crowns.push({ x, z, r: 3, top: shaftTop.y + 1.5 });
  }

  treeFern(x, z, rng) {
    const gy = this.terrain.height(x, z);
    const h = rng.range(1.8, 5.5);
    const r = rng.range(0.07, 0.11);
    const pts = [], radii = [];
    const d = new THREE.Vector3(rng.range(-0.15, 0.15), 1, rng.range(-0.15, 0.15)).normalize();
    const p = new THREE.Vector3(x, gy - 0.2, z);
    const n = Math.ceil(h / 0.5);
    for (let i = 0; i <= n; i++) {
      pts.push(p.clone()); radii.push(r * (i === 0 ? 1.6 : 1 + 0.15 * Math.sin(i)));
      d.x += rng.range(-0.04, 0.04); d.z += rng.range(-0.04, 0.04); d.y += 0.02; d.normalize();
      p.addScaledVector(d, h / n);
    }
    const mb = this.batch.get('barkDark', x, z);
    mb.setColor(new THREE.Color(0x5a4636));
    addTube(mb, pts, radii, { radial: 7, vScale: 0.5, capEnd: true, windFn: () => 0.7 });
    this.colliders.addCapsule(pts[0], pts[pts.length - 1], r + 0.02);
    const top = pts[pts.length - 1];
    this.crown(top, rng.int(9, 14), rng.range(1.5, 2.4), 0.48, CELL.fern, rng, { droop: 0.55, fold: 0.25, elevBase: 0.75 });
    // fiddleheads
    const mp = this.batch.get('plain', x, z);
    mp.setColor(new THREE.Color(0x7a8a3a));
    for (let k = 0; k < 3; k++) {
      const a = rng.range(0, 6.28);
      const cpts = [], cr = [];
      const base = top.clone();
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const ang = t * Math.PI * 2.2;
        const rad = 0.18 * (1 - t * 0.85);
        cpts.push(new THREE.Vector3(base.x + Math.cos(a) * (0.05 + Math.sin(ang) * rad), base.y + 0.25 + (1 - Math.cos(ang)) * rad * 0.9, base.z + Math.sin(a) * (0.05 + Math.sin(ang) * rad)));
        cr.push(0.018 * (1 - t * 0.5));
      }
      addTube(mp, cpts, cr, { radial: 5, capEnd: true });
    }
  }

  populate() {
    const rng = this.rng, T = this.terrain, F = this.forest;
    const R = WORLD.radius - 3;
    const clear = (x, z, d) => F.placed.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > d * d);
    const tryPlace = (count, fn, pred, minD) => {
      for (let i = 0; i < count; i++) for (let t = 0; t < 50; t++) {
        const x = rng.range(-R, R), z = rng.range(-R, R);
        if (Math.hypot(x, z) > R || !pred(x, z) || !clear(x, z, minD)) continue;
        fn.call(this, x, z, rng.fork(i * 31 + t));
        F.placed.push({ x, z, min: minD, cls: 'small' });
        break;
      }
    };
    tryPlace(30, this.acai, (x, z) => T.bankDist(x, z) > 0.6 && T.bankDist(x, z) < 18, 3.5);
    tryPlace(14, this.acai, (x, z) => T.bankDist(x, z) > 2, 3.5);
    tryPlace(55, this.walking, (x, z) => T.bankDist(x, z) > 1.5, 3);
    tryPlace(80, this.treeFern, (x, z) => T.bankDist(x, z) > 1.5 && F.coverAt(x, z) > 0.45, 2.2);
  }
}

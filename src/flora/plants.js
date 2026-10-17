// Ground-layer plants as instanced prototypes, scattered by light, moisture and space.
import * as THREE from 'three';
import { MeshBuilder, addTube, addRibbon, addCard, addEllipsoid, addLathe, cardBasis } from '../core/geometry.js';
import { CELL, cellRect } from '../core/textures.js';
import { frondPoints, frondWidths } from './palms.js';
import { WORLD, QUALITY } from '../core/shared.js';
import { RNG } from '../core/rng.js';

const UP = new THREE.Vector3(0, 1, 0);
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();
const C = (h) => new THREE.Color(h);

class Proto {
  constructor() { this.mb = {}; this.flowers = []; }
  get(k) { return this.mb[k] || (this.mb[k] = new MeshBuilder()); }
}

function leafOnPetiole(P, base, dir, petLen, leafSize, cell, rng, opts = {}) {
  // petiole as a thin bent tube, leaf card at the end
  const pts = frondPoints(base, dir, petLen, opts.petDroop ?? 0.4, 3);
  const mp = P.get('plainWind');
  mp.setColor(opts.petColor || C(0x4a6a2a));
  const n = pts.length;
  addTube(mp, pts, pts.map((_, i) => (opts.petR ?? 0.01) * (1 - i / n * 0.4)), { radial: 3, windFn: (i) => (i / (n - 1)) * 0.05 * petLen });
  const end = pts[n - 1];
  const tang = new THREE.Vector3().subVectors(end, pts[n - 2]).normalize();
  const ydir = tang.clone().lerp(new THREE.Vector3(tang.x, -0.25, tang.z), opts.leafDroop ?? 0.5);
  const face = UP.clone().addScaledVector(tang, -0.3);
  cardBasis(ydir, face, _X, _Y, _Z);
  const ml = P.get('plantLeaf');
  ml.setColor(opts.leafColor || C(0xffffff));
  const w = leafSize * (opts.aspect ?? 1);
  addCard(ml, end, _X, _Y, w, leafSize, cellRect(cell), {
    bend: opts.bend ?? -0.12, fold: opts.fold ?? 0.08, segX: 2, segY: 2,
    windBase: 0.05 * petLen, windTip: 0.05 * petLen + 0.06 * leafSize,
  });
  return end;
}

const PROTOS = {
  fern(rng, big = 1) {
    const P = new Proto();
    const mb = P.get('plantLeaf');
    const n = big < 0.8 ? rng.int(5, 8) : rng.int(8, 12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const elev = rng.range(0.55, 1.25);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
      const L = rng.range(0.7, 1.3) * big;
      const nSeg = big < 0.8 ? 4 : 6;
      const pts = frondPoints(new THREE.Vector3(0, 0.02, 0), dir, L, 0.9 / L, nSeg, rng);
      const v = rng.range(0.85, 1.12);
      mb.setColor([v * rng.range(0.95, 1.08), v, v * 0.92]);
      addRibbon(mb, pts, frondWidths(nSeg, 0.2 * big * rng.range(0.85, 1.1), 0.55), cellRect(CELL.fern), { fold: 0.25, windFn: (s) => 0.06 * s * s * big });
    }
    return P;
  },
  heliconia(rng) {
    const P = new Proto();
    const shoots = rng.int(4, 7);
    const red = C(0xc81a10), yel = C(0xf0c020), grn = C(0x5a8a2a);
    const pendant = rng.chance(0.5);
    for (let s = 0; s < shoots; s++) {
      const a = rng.range(0, 6.28), off = rng.range(0, 0.35);
      const base = new THREE.Vector3(Math.cos(a) * off, 0, Math.sin(a) * off);
      const h = rng.range(0.8, 1.9);
      const top = base.clone().add(new THREE.Vector3(rng.range(-0.15, 0.15), h, rng.range(-0.15, 0.15)));
      const mp = P.get('plainWind'); mp.setColor(C(0x4f7a2c));
      addTube(mp, [base, base.clone().lerp(top, 0.5), top], [0.025, 0.02, 0.016], { radial: 5, windFn: (i) => i * 0.02 });
      // paddle leaf
      const la = a + rng.range(-0.8, 0.8);
      const dir = new THREE.Vector3(Math.cos(la) * 0.45, 0.9, Math.sin(la) * 0.45).normalize();
      const L = rng.range(1.0, 1.7);
      const pts = frondPoints(top, dir, L, 0.55 / L, 7, rng);
      const ml = P.get('plantLeaf');
      const v = rng.range(0.9, 1.1); ml.setColor([v, v, v]);
      addRibbon(ml, pts, frondWidths(7, rng.range(0.17, 0.24), 0.35), cellRect(CELL.paddle), { fold: 0.12, faceHint: new THREE.Vector3(Math.cos(la + 1.5), 0.6, Math.sin(la + 1.5)).normalize(), windFn: (q) => 0.03 + 0.08 * q });
    }
    // inflorescences: zigzag of boat-shaped bracts
    const nInf = rng.int(1, 2);
    for (let k = 0; k < nInf; k++) {
      const a = rng.range(0, 6.28);
      const start = new THREE.Vector3(Math.cos(a) * 0.25, rng.range(1.1, 1.6), Math.sin(a) * 0.25);
      const mp = P.get('plainWind');
      const nb = rng.int(5, 9);
      const dirDown = pendant ? -1 : 1;
      const rach = [start.clone()];
      for (let i = 1; i <= nb; i++) rach.push(start.clone().add(new THREE.Vector3(Math.sin(i * 1.2) * 0.02, dirDown * i * 0.07, 0)));
      mp.setColor(pendant ? red : C(0xa02010));
      addTube(mp, rach, rach.map(() => 0.012), { radial: 4, windFn: () => 0.03 });
      for (let i = 1; i <= nb; i++) {
        const side = i % 2 ? 1 : -1;
        const b0 = rach[i];
        const out = new THREE.Vector3(side * Math.cos(a + 1.57), pendant ? 0.25 : 0.55, side * Math.sin(a + 1.57)).normalize();
        const L = 0.17 * (pendant ? (1 - i / nb * 0.4) : (1 - i / nb * 0.5));
        const pts = [b0, b0.clone().addScaledVector(out, L * 0.5), b0.clone().addScaledVector(out, L)];
        addTube(mp, pts, [0.03, 0.028, 0.004], {
          radial: 6, capEnd: true, windFn: () => 0.03,
          colorFn: (j) => pendant ? (j === 2 ? yel : red) : (j === 2 ? grn : C(0xd83a10)),
          radiusFn: (j, th) => 0.6 + 0.4 * Math.abs(Math.cos(th)),
        });
        if (i === 2) P.flowers.push(b0.clone().addScaledVector(out, L + 0.05));
      }
    }
    return P;
  },
  aroid(rng, monstera) {
    const P = new Proto();
    const n = rng.int(4, 8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const elev = rng.range(0.9, 1.35);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
      const pet = rng.range(0.4, 1.1) * (monstera ? 1.3 : 1);
      const v = rng.range(0.85, 1.1);
      leafOnPetiole(P, new THREE.Vector3(0, 0, 0), dir, pet, rng.range(0.45, 0.85) * (monstera ? 1.3 : 1), monstera ? CELL.monstera : CELL.heart, rng, {
        petDroop: 0.6, leafDroop: 0.7, petR: 0.012, leafColor: C(0xffffff).multiplyScalar(v), bend: -0.1,
      });
    }
    return P;
  },
  calathea(rng) {
    const P = new Proto();
    const n = rng.int(7, 12);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, 6.28), elev = rng.range(1.15, 1.45);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
      leafOnPetiole(P, new THREE.Vector3(0, 0, 0), dir, rng.range(0.25, 0.6), rng.range(0.28, 0.42), CELL.calathea, rng, {
        petDroop: 0.3, leafDroop: 0.25, aspect: 0.75, petColor: C(0x6a3a3a), bend: -0.05, fold: 0.06,
      });
    }
    return P;
  },
  ivoryPalm(rng) {
    const P = new Proto();
    const mb = P.get('plantLeaf');
    const n = rng.int(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const elev = rng.range(0.9, 1.35);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
      const L = rng.range(2.4, 4.0);
      const pts = frondPoints(new THREE.Vector3(0, 0.3, 0), dir, L, 0.9 / L, 10, rng);
      const v = rng.range(0.85, 1.1); mb.setColor([v, v, v * 0.95]);
      addRibbon(mb, pts, frondWidths(10, rng.range(0.45, 0.6)), cellRect(CELL.palm), { fold: 0.45, windFn: (s) => 0.04 + 0.12 * s * s });
    }
    const mp = P.get('plain'); mp.setColor(C(0x5a4a32));
    addEllipsoid(mp, new THREE.Vector3(0, 0.15, 0), 0.22, 0.3, 0.22, { w: 7, h: 5 });
    return P;
  },
  geonoma(rng) {
    const P = new Proto();
    const stems = rng.int(1, 4);
    for (let s = 0; s < stems; s++) {
      const a = rng.range(0, 6.28), off = s === 0 ? 0 : rng.range(0.1, 0.35);
      const h = rng.range(0.8, 2.4);
      const b = new THREE.Vector3(Math.cos(a) * off, 0, Math.sin(a) * off);
      const top = b.clone().add(new THREE.Vector3(rng.range(-0.2, 0.2), h, rng.range(-0.2, 0.2)));
      const mp = P.get('plainWind'); mp.setColor(C(0x4a5a2a));
      addTube(mp, [b, b.clone().lerp(top, 0.5), top], [0.018, 0.016, 0.014], { radial: 5, windFn: (i) => i * 0.02 });
      const mb = P.get('plantLeaf');
      const n = rng.int(4, 7);
      for (let i = 0; i < n; i++) {
        const fa = (i / n) * 6.28 + rng.range(-0.3, 0.3), el = rng.range(0.4, 1.0);
        const dir = new THREE.Vector3(Math.cos(fa) * Math.cos(el), Math.sin(el), Math.sin(fa) * Math.cos(el));
        const L = rng.range(0.7, 1.1);
        const pts = frondPoints(top, dir, L, 0.8 / L, 7, rng);
        mb.setColor([1, 1, 1]);
        addRibbon(mb, pts, frondWidths(7, 0.3, 0.45), cellRect(CELL.palm), { fold: 0.2, windFn: (q) => 0.04 + 0.1 * q });
      }
    }
    return P;
  },
  seedling(rng) {
    const P = new Proto();
    const h = rng.range(0.12, 0.6);
    const mp = P.get('plainWind'); mp.setColor(C(0x5a6a2a));
    const top = new THREE.Vector3(rng.range(-0.04, 0.04), h, rng.range(-0.04, 0.04));
    addTube(mp, [new THREE.Vector3(), top], [0.006, 0.004], { radial: 3, windFn: (i) => i * 0.02 });
    const n = rng.int(2, 6);
    const cell = rng.pick([CELL.lance, CELL.broad, CELL.heart]);
    const tint = rng.chance(0.25) ? C(0xffb0a0) : C(0xffffff);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + rng.range(-0.3, 0.3);
      const y = h * (0.5 + 0.5 * i / n);
      const dir = new THREE.Vector3(Math.cos(a), rng.range(0.1, 0.5), Math.sin(a)).normalize();
      cardBasis(dir, UP, _X, _Y, _Z);
      const s = rng.range(0.07, 0.18) * (0.5 + h);
      const ml = P.get('plantLeaf'); ml.setColor(tint);
      addCard(ml, new THREE.Vector3(top.x * y / h, y, top.z * y / h), _X, _Y, s * 0.5, s, cellRect(cell), { bend: -0.15, segX: 1, segY: 2, windBase: 0.01, windTip: 0.03 });
    }
    return P;
  },
  psychotria(rng) {
    const P = new Proto();
    const stems = rng.int(2, 4);
    for (let s = 0; s < stems; s++) {
      const a = rng.range(0, 6.28);
      const h = rng.range(0.6, 1.4);
      const top = new THREE.Vector3(Math.cos(a) * 0.2, h, Math.sin(a) * 0.2);
      const mp = P.get('plainWind'); mp.setColor(C(0x4a5a2a));
      addTube(mp, [new THREE.Vector3(), top.clone().multiplyScalar(0.5), top], [0.012, 0.01, 0.008], { radial: 4, windFn: (i) => i * 0.02 });
      for (let i = 0; i < 6; i++) {
        const la = a + i * 1.57 + rng.range(-0.2, 0.2);
        const y = h * (0.45 + 0.1 * i);
        const dir = new THREE.Vector3(Math.cos(la), 0.25, Math.sin(la)).normalize();
        cardBasis(dir, UP, _X, _Y, _Z);
        const sz = rng.range(0.16, 0.24);
        const ml = P.get('plantLeaf'); ml.setColor([1, 1, 1]);
        addCard(ml, new THREE.Vector3(top.x * y / h, y, top.z * y / h), _X, _Y, sz * 0.45, sz, cellRect(CELL.lance), { bend: -0.15, segX: 1, segY: 2, windBase: 0.01, windTip: 0.04 });
      }
      // "hot lips" bracts
      const mr = P.get('glossy'); mr.setColor(C(0xe0102a));
      const lip = top.clone().add(new THREE.Vector3(0, 0.04, 0));
      const q = new THREE.Quaternion().setFromAxisAngle(UP, a);
      addEllipsoid(mr, lip.clone().add(new THREE.Vector3(0, 0.02, 0).applyQuaternion(q)), 0.045, 0.022, 0.03, { w: 8, h: 5, quat: q });
      addEllipsoid(mr, lip.clone().add(new THREE.Vector3(0, -0.02, 0).applyQuaternion(q)), 0.045, 0.022, 0.03, { w: 8, h: 5, quat: q });
      P.flowers.push(lip.clone());
    }
    return P;
  },
  costus(rng) {
    const P = new Proto();
    const h = rng.range(1.0, 2.0);
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 9) * 0.04, t * h, Math.cos(t * 9) * 0.04)); }
    const mp = P.get('plainWind'); mp.setColor(C(0x6a3a2a));
    addTube(mp, pts, pts.map(() => 0.012), { radial: 4, windFn: (i) => i * 0.01 });
    const ml = P.get('plantLeaf');
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t = 0.25 + 0.7 * i / n;
      const a = i * 1.9;
      const dir = new THREE.Vector3(Math.cos(a), 0.15, Math.sin(a)).normalize();
      cardBasis(dir, UP, _X, _Y, _Z);
      const sz = rng.range(0.22, 0.32);
      ml.setColor([1, 1, 1]);
      addCard(ml, new THREE.Vector3(0, t * h, 0), _X, _Y, sz * 0.45, sz, cellRect(CELL.lance), { bend: -0.1, segX: 1, segY: 2, windBase: 0.01, windTip: 0.04 });
    }
    const mr = P.get('glossy'); mr.setColor(C(0xc0202a));
    addEllipsoid(mr, new THREE.Vector3(0, h + 0.07, 0), 0.04, 0.08, 0.04, { w: 8, h: 6, disp: (x, y, z) => 1 + 0.12 * Math.sin(y * 20) });
    mr.setColor(C(0xf0d040));
    addEllipsoid(mr, new THREE.Vector3(0.04, h + 0.09, 0), 0.025, 0.02, 0.03, { w: 6, h: 4 });
    P.flowers.push(new THREE.Vector3(0.05, h + 0.1, 0));
    return P;
  },
  reeds(rng) {
    const P = new Proto();
    const mb = P.get('plainWind');
    const n = rng.int(18, 34);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, 6.28), el = rng.range(1.1, 1.5), off = rng.range(0, 0.15);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const L = rng.range(0.4, 1.2);
      const pts = frondPoints(new THREE.Vector3(Math.cos(a) * off, 0, Math.sin(a) * off), dir, L, 0.7 / L, 5);
      mb.setColor(new THREE.Color(0x5a7a2a).lerp(C(0xa0a050), rng.next() * 0.6));
      addRibbon(mb, pts, pts.map((_, k) => 0.012 * (1 - k / pts.length)), [0, 0, 1, 1], { fold: 0, windFn: (s) => 0.1 * s });
    }
    return P;
  },
  mushrooms(rng) {
    const P = new Proto();
    const kinds = [
      { cap: 0xe07020, stem: 0xf0e0c0 }, { cap: 0xf0ece0, stem: 0xf0ece0 }, { cap: 0x8a5a30, stem: 0xd0c0a0 },
      { cap: 0xd04050, stem: 0xf0e0d0 }, { cap: 0xe0c040, stem: 0xf0e8c0 },
    ];
    const k = rng.pick(kinds);
    const n = rng.int(3, 9);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, 6.28), off = rng.range(0, 0.1);
      const h = rng.range(0.025, 0.09), cr = rng.range(0.015, 0.04);
      const b = new THREE.Vector3(Math.cos(a) * off, 0, Math.sin(a) * off);
      const mp = P.get('plain'); mp.setColor(C(k.stem));
      addTube(mp, [b, b.clone().add(new THREE.Vector3(0, h, 0))], [cr * 0.25, cr * 0.2], { radial: 5 });
      const mg = P.get('glossy'); mg.setColor(C(k.cap));
      addLathe(mg, b.clone().add(new THREE.Vector3(0, h, 0)), [[cr * 0.2, -cr * 0.15], [cr, -cr * 0.1], [cr * 0.8, cr * 0.3], [0.001, cr * 0.55]], { seg: 7 });
    }
    return P;
  },
  bracket(rng) {
    // shelves growing out along local +Z (placed on trunks/logs)
    const P = new Proto();
    const n = rng.int(2, 5);
    const col = rng.pick([[0xe8a040, 0xf8e0b0], [0xf0ece0, 0xc8b8a0], [0x8a5a30, 0xd0b080], [0xe06020, 0xf0c060]]);
    const mg = P.get('plain');
    for (let i = 0; i < n; i++) {
      const s = rng.range(0.06, 0.16);
      const c = new THREE.Vector3(rng.range(-0.08, 0.08), i * 0.07 + rng.range(-0.02, 0.02), s * 0.35);
      addEllipsoid(mg, c, s, s * 0.18, s * 0.75, {
        w: 10, h: 5, colorFn: (x, y, z) => C(col[0]).lerp(C(col[1]), Math.min(1, Math.abs(Math.sin(Math.hypot(x, z) * 9)) * 0.7 + (y < 0 ? 0.6 : 0))),
      });
    }
    return P;
  },
  lily(rng) {
    const P = new Proto();
    const mp = P.get('plain');
    const R = rng.range(0.5, 1.1);
    addLathe(mp, new THREE.Vector3(), [[R * 1.04, 0.1], [R * 1.0, 0.04], [R * 0.95, 0.012], [R * 0.6, 0.0], [0.01, 0.0]], {
      seg: 28, colorFn: (t) => (t < 0.3 ? C(0xa03a28) : C(0x4a8a2a).lerp(C(0x6aa03a), t)),
      radiusFn: (th) => 1 + 0.015 * Math.sin(th * 23),
    });
    if (rng.chance(0.35)) {
      const fl = P.get('glossy');
      const fp = new THREE.Vector3(R * 1.3, 0.05, 0);
      const pink = rng.chance(0.5);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * 6.28;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7 + (i % 2) * 0.4, a, 0, 'YXZ'));
        fl.setColor(pink ? C(0xf0a0c0) : C(0xf8f4ec));
        addEllipsoid(fl, fp.clone().add(new THREE.Vector3(Math.cos(a) * 0.06, 0.05, Math.sin(a) * 0.06)), 0.035, 0.012, 0.08, { w: 6, h: 4, quat: q });
      }
    }
    return P;
  },
  hyacinth(rng) {
    const P = new Proto();
    const n = rng.int(6, 10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + rng.range(-0.2, 0.2);
      const dir = new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a)).normalize();
      leafOnPetiole(P, new THREE.Vector3(), dir, rng.range(0.08, 0.18), rng.range(0.1, 0.16), CELL.heart, rng, { petDroop: 0.5, leafDroop: 0.3, petR: 0.008, leafColor: C(0xb0ff90) });
    }
    if (rng.chance(0.6)) {
      const fl = P.get('glossy'); fl.setColor(C(0xa080e0));
      for (let i = 0; i < 8; i++) addEllipsoid(fl, new THREE.Vector3(rng.range(-0.02, 0.02), 0.2 + i * 0.025, rng.range(-0.02, 0.02)), 0.022, 0.016, 0.022, { w: 6, h: 4 });
    }
    return P;
  },
  sticks(rng) {
    // fallen branch with side twigs, lying on the litter
    const P = new Proto();
    const mb = P.get('plain');
    mb.setColor(new THREE.Color(0x4a3a2a).lerp(C(0x7a6a52), rng.next()));
    const L = rng.range(0.8, 2.8), r = rng.range(0.018, 0.06);
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3((t - 0.5) * L, r * 0.6 + Math.sin(t * 3) * 0.02, Math.sin(t * 4 + L) * 0.08)); }
    addTube(mb, pts, pts.map((_, i) => r * (1 - i / 9)), { radial: 6, capEnd: true });
    for (let k = 0; k < rng.int(2, 5); k++) {
      const b = pts[rng.int(1, 5)].clone();
      const d = new THREE.Vector3(rng.range(-0.3, 0.3), rng.range(0.0, 0.5), rng.sign()).normalize();
      addTube(mb, [b, b.clone().addScaledVector(d, rng.range(0.15, 0.5))], [r * 0.45, r * 0.2], { radial: 4, capEnd: true });
    }
    if (rng.chance(0.4)) { // a few shelf fungi or moss on the stick
      const g = P.get('glossy'); g.setColor(rng.chance(0.5) ? C(0xe89040) : C(0xf0ece0));
      for (let k = 0; k < 4; k++) addEllipsoid(g, pts[rng.int(1, 5)].clone().add(new THREE.Vector3(0, r * 0.8, 0)), 0.02, 0.006, 0.016, { w: 6, h: 3 });
    }
    return P;
  },
  deadFrond(rng) {
    const P = new Proto();
    const mb = P.get('plantLeaf');
    const a = rng.range(0, 6.28);
    const dir = new THREE.Vector3(Math.cos(a), 0.08, Math.sin(a)).normalize();
    const L = rng.range(1.5, 3.2);
    const pts = frondPoints(new THREE.Vector3(0, 0.03, 0), dir, L, 0.02, 8, rng);
    pts.forEach((p) => { p.y = Math.max(0.02, p.y); });
    mb.setColor(new THREE.Color(1.6, 1.05, 0.45).multiplyScalar(rng.range(0.6, 0.9)));
    addRibbon(mb, pts, frondWidths(8, rng.range(0.3, 0.45)), cellRect(CELL.palm), { fold: -0.3, windFn: () => 0 });
    const mp = P.get('plain'); mp.setColor(C(0x6a5034));
    addTube(mp, [pts[0], pts[2], pts[4]], [0.025, 0.02, 0.015], { radial: 5 });
    return P;
  },
  parasols(rng) {
    // tall slender parasol mushrooms
    const P = new Proto();
    const n = rng.int(1, 4);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, 6.28), off = rng.range(0, 0.15);
      const b = new THREE.Vector3(Math.cos(a) * off, 0, Math.sin(a) * off);
      const h = rng.range(0.1, 0.24), cr = rng.range(0.04, 0.08);
      const top = b.clone().add(new THREE.Vector3(rng.range(-0.02, 0.02), h, rng.range(-0.02, 0.02)));
      const mp = P.get('plain'); mp.setColor(C(0xf0e8d8));
      addTube(mp, [b, top], [cr * 0.12, cr * 0.08], { radial: 5 });
      const mg = P.get('plain');
      addLathe(mg, top, [[cr * 0.1, -cr * 0.05], [cr, -cr * 0.18], [cr * 0.9, cr * 0.02], [cr * 0.5, cr * 0.25], [0.001, cr * 0.32]], {
        seg: 9, colorFn: (t) => (t > 0.8 ? C(0x7a4a2a) : C(0xe8dcc8).lerp(C(0xb08a60), t * 0.6)),
      });
    }
    return P;
  },
  cupFungi(rng) {
    const P = new Proto();
    const g = P.get('glossy');
    const col = rng.pick([0xf06a10, 0xe8a020, 0xd02818, 0xf0e8d8]);
    for (let i = 0; i < rng.int(4, 10); i++) {
      const a = rng.range(0, 6.28), off = rng.range(0, 0.12);
      const c = new THREE.Vector3(Math.cos(a) * off, 0, Math.sin(a) * off);
      const r = rng.range(0.008, 0.025);
      g.setColor(C(col));
      addLathe(g, c, [[0.001, 0], [r, r * 0.9], [r * 0.75, r * 0.7], [0.001, r * 0.3]], { seg: 7 });
    }
    return P;
  },
  coral(rng) {
    // coral / club fungi: clustered branching fingers
    const P = new Proto();
    const g = P.get('plain');
    const col = rng.pick([0xf0c040, 0xf08a30, 0xf0ece0, 0xc070c0]);
    g.setColor(C(col));
    for (let i = 0; i < rng.int(6, 14); i++) {
      const a = rng.range(0, 6.28), off = rng.range(0, 0.04);
      const b = new THREE.Vector3(Math.cos(a) * off, 0, Math.sin(a) * off);
      const h = rng.range(0.04, 0.1);
      const tip = b.clone().add(new THREE.Vector3(Math.cos(a) * h * 0.4, h, Math.sin(a) * h * 0.4));
      addTube(g, [b, b.clone().lerp(tip, 0.5), tip], [0.006, 0.005, 0.003], { radial: 4, capEnd: true });
    }
    return P;
  },
  peaceLily(rng) {
    const P = new Proto();
    const n = rng.int(7, 12);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, 6.28), elev = rng.range(1.1, 1.4);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
      leafOnPetiole(P, new THREE.Vector3(), dir, rng.range(0.2, 0.45), rng.range(0.3, 0.45), CELL.lance, rng, { petDroop: 0.5, leafDroop: 0.55, aspect: 0.6, bend: -0.1 });
    }
    for (let k = 0; k < rng.int(1, 3); k++) {
      const a = rng.range(0, 6.28);
      const top = new THREE.Vector3(Math.cos(a) * 0.08, rng.range(0.45, 0.6), Math.sin(a) * 0.08);
      const mp = P.get('plainWind'); mp.setColor(C(0x5a7a2a));
      addTube(mp, [new THREE.Vector3(), top], [0.006, 0.005], { radial: 4, windFn: (i) => i * 0.03 });
      const g = P.get('glossy'); g.setColor(C(0xf8f8f0));
      addEllipsoid(g, top.clone().add(new THREE.Vector3(Math.cos(a) * 0.02, 0.06, Math.sin(a) * 0.02)), 0.035, 0.08, 0.012, { w: 8, h: 6, quat: new THREE.Quaternion().setFromAxisAngle(UP, -a) });
      g.setColor(C(0xe8e0a0));
      addTube(g, [top, top.clone().add(new THREE.Vector3(0, 0.05, 0))], [0.007, 0.005], { radial: 5, capEnd: true });
      P.flowers.push(top.clone().add(new THREE.Vector3(0, 0.08, 0)));
    }
    return P;
  },
  petals(rng) {
    const P = new Proto();
    const mp = P.get('plainWind');
    for (let i = 0; i < 40; i++) {
      const a = rng.range(0, 6.28), r = Math.sqrt(rng.next()) * 1.2;
      const c = new THREE.Vector3(Math.cos(a) * r, 0.015, Math.sin(a) * r);
      const s = rng.range(0.015, 0.03);
      const q = new THREE.Quaternion().setFromAxisAngle(UP, rng.range(0, 6.28));
      mp.setColor([1, 1, 1]);
      addEllipsoid(mp, c, s, 0.003, s * 1.4, { w: 5, h: 2, quat: q });
    }
    return P;
  },
};

function protoToParts(P, M) {
  const parts = [];
  for (const [k, mb] of Object.entries(P.mb)) {
    if (!mb.count) continue;
    const geometry = mb.toGeometry();
    const part = { geometry, material: M[k] };
    if (k === 'plantLeaf') part.customDepthMaterial = M.depth.plantLeaf;
    parts.push(part);
  }
  return parts;
}

export class Plants {
  constructor({ terrain, scatter, materials, forest, colliders, rng }) {
    Object.assign(this, { terrain, scatter, M: materials, forest, colliders, rng });
    this.flowers = [];      // world positions of flowers (hummingbirds)
    this.protoFlowers = {}; // name -> local flower points
    this.variants = {};
  }
  register(name, fn, variants, opts = {}) {
    const names = [];
    for (let v = 0; v < variants; v++) {
      const id = `${name}${v}`;
      const P = fn(new RNG(9000 + v * 77 + name.length * 13), v);
      this.scatter.register(id, protoToParts(P, this.M), opts);
      this.protoFlowers[id] = P.flowers;
      names.push(id);
    }
    this.variants[name] = names;
  }
  registerAll() {
    const P = PROTOS;
    this.register('fern', (r) => P.fern(r, 1), 3, { maxDist: 90 });
    this.register('fernSmall', (r) => P.fern(r, 0.5), 2, { maxDist: 45, castShadow: false });
    this.register('heliconia', P.heliconia, 3, { maxDist: 110 });
    this.register('philodendron', (r) => P.aroid(r, false), 2, { maxDist: 80, castShadow: false });
    this.register('monstera', (r) => P.aroid(r, true), 2, { maxDist: 100 });
    this.register('calathea', P.calathea, 2, { maxDist: 55, castShadow: false });
    this.register('ivoryPalm', P.ivoryPalm, 3, { maxDist: 120 });
    this.register('geonoma', P.geonoma, 3, { maxDist: 100 });
    this.register('seedling', P.seedling, 3, { maxDist: 35, castShadow: false });
    this.register('psychotria', P.psychotria, 2, { maxDist: 60, castShadow: false });
    this.register('costus', P.costus, 2, { maxDist: 80 });
    this.register('reeds', P.reeds, 2, { maxDist: 80, castShadow: false });
    this.register('mushrooms', P.mushrooms, 4, { maxDist: 28, castShadow: false });
    this.register('bracket', P.bracket, 3, { maxDist: 45, castShadow: false });
    this.register('lily', P.lily, 4, { maxDist: 160, castShadow: false });
    this.register('hyacinth', P.hyacinth, 2, { maxDist: 120, castShadow: false });
    this.register('petals', P.petals, 1, { maxDist: 60, castShadow: false });
    this.register('sticks', P.sticks, 4, { maxDist: 40, castShadow: false });
    this.register('deadFrond', P.deadFrond, 4, { maxDist: 60, castShadow: false });
    this.register('parasols', P.parasols, 2, { maxDist: 28, castShadow: false });
    this.register('cupFungi', P.cupFungi, 3, { maxDist: 22, castShadow: false });
    this.register('coral', P.coral, 3, { maxDist: 22, castShadow: false });
    this.register('peaceLily', P.peaceLily, 2, { maxDist: 55, castShadow: false });
  }

  add(name, x, y, z, rotY, scale, color, tilt = 0.08) {
    const id = this.rng.pick(this.variants[name]);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rng.range(-tilt, tilt), rotY, this.rng.range(-tilt, tilt)));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale));
    this.scatter.add(id, m, color);
    for (const f of this.protoFlowers[id]) this.flowers.push(f.clone().applyMatrix4(m));
    return m;
  }
  addMatrix(name, m, color) {
    const id = this.rng.pick(this.variants[name]);
    this.scatter.add(id, m, color);
  }

  populate() {
    const T = this.terrain, F = this.forest, rng = this.rng, D = QUALITY.density;
    const R = WORLD.radius;
    const probe = new THREE.Vector3();
    const free = (x, z, y, r) => { probe.set(x, y + 0.4, z); return this.colliders.nearest(probe) > r; };
    const spread = (name, count, pred, opts = {}) => {
      let n = 0;
      const target = Math.round(count * D);
      for (let i = 0; i < target * 6 && n < target; i++) {
        const x = rng.range(-R, R), z = rng.range(-R, R);
        if (x * x + z * z > R * R) continue;
        const bd = T.bankDist(x, z), cov = F.coverAt(x, z);
        if (!pred(x, z, bd, cov)) continue;
        const y = T.height(x, z);
        if (!free(x, z, y, opts.clear ?? 0.4)) continue;
        const s = rng.range(...(opts.scale || [0.8, 1.2]));
        const v = rng.range(0.85, 1.1);
        this.add(name, x, y - 0.02, z, rng.range(0, 6.28), s, new THREE.Color(v, v, v));
        n++;
        if (opts.cluster) { // satellites
          const k = rng.int(0, opts.cluster);
          for (let j = 0; j < k; j++) {
            const xx = x + rng.range(-1.5, 1.5), zz = z + rng.range(-1.5, 1.5);
            if (T.bankDist(xx, zz) < 0.3) continue;
            this.add(name, xx, T.height(xx, zz) - 0.02, zz, rng.range(0, 6.28), s * rng.range(0.6, 1), new THREE.Color(v, v, v));
          }
        }
      }
      return n;
    };
    spread('fern', 1700, (x, z, bd, c) => bd > 0.8 && rng.chance(0.25 + c * 0.75), { cluster: 3 });
    spread('fernSmall', 1800, (x, z, bd, c) => bd > 0.3, { cluster: 4 });
    spread('heliconia', 340, (x, z, bd, c) => bd > 0.5 && (bd < 12 || c < 0.55) && rng.chance(bd < 12 ? 1 : 0.5), { cluster: 2, scale: [0.85, 1.3] });
    spread('philodendron', 800, (x, z, bd) => bd > 0.8, { cluster: 2 });
    spread('monstera', 380, (x, z, bd, c) => bd > 1.2 && c > 0.35);
    spread('calathea', 1200, (x, z, bd, c) => bd > 0.8 && c > 0.4, { cluster: 3 });
    spread('ivoryPalm', 260, (x, z, bd, c) => bd > 1.5 && c > 0.45, { clear: 1.2, scale: [0.8, 1.15] });
    spread('geonoma', 650, (x, z, bd, c) => bd > 1.0 && c > 0.3, { cluster: 1 });
    spread('seedling', 6000, (x, z, bd) => bd > 0.3, { scale: [0.6, 1.3], clear: 0.15 });
    spread('psychotria', 480, (x, z, bd, c) => bd > 1 && c > 0.3, { cluster: 2 });
    spread('costus', 260, (x, z, bd, c) => bd > 0.4 && (bd < 15 || c < 0.5), { cluster: 2 });
    spread('reeds', 900, (x, z, bd) => bd > -0.6 && bd < 2.5, { clear: 0.1, scale: [0.7, 1.4] });
    spread('mushrooms', 1100, (x, z, bd, c) => bd > 1.0 && c > 0.35, { clear: 0.1, scale: [0.8, 1.6] });

    spread('peaceLily', 500, (x, z, bd, c) => bd > 0.8 && c > 0.4, { cluster: 2 });
    spread('sticks', 1600, (x, z, bd) => bd > 0.5, { clear: 0.2, scale: [0.7, 1.3] });
    spread('deadFrond', 520, (x, z, bd) => bd > 0.8, { clear: 0.2 });
    spread('parasols', 380, (x, z, bd, c) => bd > 1.0 && c > 0.4, { clear: 0.1, cluster: 2 });
    spread('cupFungi', 380, (x, z, bd) => bd > 1.0, { clear: 0.1 });
    spread('coral', 320, (x, z, bd, c) => bd > 1.0 && c > 0.4, { clear: 0.1 });
    // fungi crowd the bases of big trees
    for (const t of F.trees) {
      if (t.radius < 0.3) continue;
      const n = rng.int(1, 5);
      for (let k = 0; k < n; k++) {
        const a = rng.range(0, 6.28), r = t.radius * (1.4 + rng.next() * 1.5) + 0.2;
        const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
        if (T.bankDist(x, z) < 0.3) continue;
        this.add(rng.pick(['mushrooms', 'mushrooms', 'parasols', 'cupFungi', 'coral']), x, T.height(x, z) - 0.01, z, rng.range(0, 6.28), rng.range(0.9, 1.8), null);
      }
    }
    // water lilies & floating plants (only along calm margins)
    let lilies = 0;
    for (let i = 0; i < 4000 && lilies < 130; i++) {
      const x = rng.range(-R, R), z = rng.range(-R, R);
      const d = T.riverDist(x, z), w = T.riverHalfWidth(x);
      if (x * x + z * z > R * R || d > w * 0.92 || d < w * 0.35) continue;
      if (T.height(x, z) > -0.25) continue;
      const big = Math.sin(x * 0.07) > 0.1;
      if (big) this.add('lily', x, 0.012, z, rng.range(0, 6.28), rng.range(0.8, 1.35), null, 0.02);
      else this.add('hyacinth', x, 0.0, z, rng.range(0, 6.28), rng.range(0.8, 1.3), null, 0.05);
      lilies++;
    }
    // fallen ipê petals
    for (const t of F.trees) if (t.type === 'ipe') {
      for (let k = 0; k < 14; k++) {
        const a = rng.range(0, 6.28), r = rng.range(1, 7);
        const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
        if (T.bankDist(x, z) < 0) continue;
        this.add('petals', x, T.height(x, z), z, rng.range(0, 6.28), rng.range(0.8, 1.6), t.leafTint.clone().multiplyScalar(0.95), 0.02);
      }
    }
  }
}

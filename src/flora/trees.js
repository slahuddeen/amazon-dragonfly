// Procedural rainforest trees: emergents (kapok, Brazil nut), canopy & midstory trees,
// strangler figs, cecropia, flowering ipê and understory saplings.
// Every tree also records attachment points (epiphytes), hang points (vines, aerial roots),
// crown blobs (canopy coverage) and colliders.
import * as THREE from 'three';
import { addTube, addLoft, cardBasis } from '../core/geometry.js';
import { CELL, cellRect } from '../core/textures.js';
import { createNoise } from '../core/noise.js';
import { lerp, smoothstep } from '../core/rng.js';
import { WORLD, QUALITY } from '../core/shared.js';
import { colonize, chains } from './growth.js';

const UP = new THREE.Vector3(0, 1, 0);
const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();
const _n = new THREE.Vector3();

const LEAF_TINTS = {
  dark: [0.82, 0.92, 0.78], mid: [1, 1, 1], yellow: [1.12, 1.08, 0.78], blue: [0.8, 0.95, 0.92],
  flush: [1.35, 0.78, 0.62], olive: [0.98, 0.95, 0.72],
};

export const SPECIES = {
  giant: {
    crown: { base: 0.7, R: [13, 18], ry: 0.42, cut: 0.35, count: 1600, D: 0.9, di: 9, dk: 1.5, shell: 0.6, tropism: 0.05, tipR: 0.04, minR: 0.09, trunkTaper: 0.55, cards: [3, 4], size: [2.0, 2.8] },
    bark: 'barkSmooth', tint: 0xd8d0c0,
    trunk: { h: [56, 68], r: [1.9, 2.5] },
    buttress: { n: [7, 10], h: [7, 11.5], reach: [7, 12], thick: 0.55, chance: 1 },
    levels: [
      { seg: 3, wander: 0.01, up: 0, taper: 0.36, kids: [7, 10], kidStart: 0.76, kidEnd: 0.99 },
      { len: [16, 24], seg: 1.8, angle: 1.12, angleVar: 0.22, flat: 0.42, wander: 0.07, up: 0.035, taper: 0.3, radRatio: 0.5, kids: [4, 6], kidStart: 0.22 },
      { lenRatio: 0.5, seg: 1.3, angle: 0.75, angleVar: 0.3, wander: 0.1, up: 0.05, taper: 0.3, radRatio: 0.55, kids: [2, 4], kidStart: 0.3 },
      { lenRatio: 0.5, seg: 0.9, angle: 0.6, angleVar: 0.35, wander: 0.12, up: 0.05, taper: 0.35, radRatio: 0.6, kids: [0, 0] },
    ],
    blob: { r: [2.6, 3.6], cards: [20, 28], size: [2.1, 3.0], cells: [CELL.clusterLight, CELL.clusterDark, CELL.clusterDark], flat: 0.5, lift: 0.3, bend: 0.18, wind: 0.025 },
    tints: ['mid', 'dark', 'olive'], epi: 1.4, hang: 1.4, flare: 1.1,
  },
  kapok: {
    crown: { base: 0.7, R: [11, 15], ry: 0.42, cut: 0.35, count: 1300, D: 0.9, di: 8.5, dk: 1.5, shell: 0.6, tropism: 0.05, tipR: 0.035, minR: 0.065, trunkTaper: 0.55, cards: [3, 4], size: [1.9, 2.7] },
    bark: 'barkSmooth', tint: 0xe0dccc,
    trunk: { h: [46, 54], r: [1.4, 1.8] },
    buttress: { n: [6, 9], h: [6, 9.5], reach: [6, 9.5], thick: 0.5, chance: 1 },
    levels: [
      { seg: 3, wander: 0.012, up: 0, taper: 0.42, kids: [6, 8], kidStart: 0.84, kidEnd: 0.99 },
      { len: [13, 18], seg: 1.7, angle: 1.22, angleVar: 0.16, flat: 0.32, wander: 0.07, up: 0.03, taper: 0.32, radRatio: 0.42, kids: [3, 5], kidStart: 0.3 },
      { lenRatio: 0.5, seg: 1.2, angle: 0.75, angleVar: 0.3, wander: 0.1, up: 0.05, taper: 0.3, radRatio: 0.55, kids: [2, 3], kidStart: 0.35 },
      { lenRatio: 0.55, seg: 0.9, angle: 0.6, angleVar: 0.35, wander: 0.12, up: 0.05, taper: 0.35, radRatio: 0.6, kids: [0, 0] },
    ],
    blob: { r: [2.4, 3.4], cards: [18, 26], size: [2.0, 2.9], cells: [CELL.clusterLight, CELL.clusterLight, CELL.clusterDark], flat: 0.5, lift: 0.35, bend: 0.18, wind: 0.025 },
    tints: ['mid', 'yellow', 'olive'], epi: 1.0, hang: 1.0,
  },
  brazilnut: {
    crown: { base: 0.62, R: [9, 12], ry: 0.7, cut: 0.55, count: 1100, D: 0.85, di: 8, dk: 1.4, shell: 0.55, tropism: 0.08, tipR: 0.035, minR: 0.065, trunkTaper: 0.55, cards: [3, 4], size: [1.8, 2.6] },
    bark: 'barkDark', tint: 0xb0a090,
    trunk: { h: [42, 50], r: [1.1, 1.5] },
    buttress: { n: [4, 6], h: [2, 3.5], reach: [2, 3.5], thick: 0.45, chance: 0.7 },
    levels: [
      { seg: 3, wander: 0.015, up: 0, taper: 0.4, kids: [5, 7], kidStart: 0.72, kidEnd: 0.98 },
      { len: [10, 14], seg: 1.6, angle: 0.75, angleVar: 0.2, flat: 0.75, wander: 0.07, up: 0.04, taper: 0.32, radRatio: 0.45, kids: [3, 4], kidStart: 0.3 },
      { lenRatio: 0.5, seg: 1.2, angle: 0.7, angleVar: 0.3, wander: 0.1, up: 0.05, taper: 0.3, radRatio: 0.55, kids: [2, 3], kidStart: 0.35 },
      { lenRatio: 0.5, seg: 0.9, angle: 0.6, angleVar: 0.35, wander: 0.12, up: 0.04, taper: 0.35, radRatio: 0.6, kids: [0, 0] },
    ],
    blob: { r: [2.3, 3.2], cards: [16, 22], size: [1.9, 2.7], cells: [CELL.clusterDark], flat: 0.65, lift: 0.3, bend: 0.15, wind: 0.025 },
    tints: ['dark', 'mid'], epi: 0.8, hang: 0.8,
  },
  canopy: {
    crown: { base: 0.55, R: [6, 10], ry: 0.55, cut: 0.6, count: 650, D: 0.6, di: 6, dk: 1.0, shell: 0.5, tropism: 0.08, tipR: 0.025, minR: 0.07, trunkTaper: 0.6, cards: [2, 3], size: [1.6, 2.3] },
    bark: 'barkDark', tint: 0xc0b0a0,
    trunk: { h: [22, 32], r: [0.45, 0.95] },
    buttress: { n: [4, 7], h: [2.2, 5], reach: [2, 4.5], thick: 0.45, chance: 0.7 },
    levels: [
      { seg: 2.5, wander: 0.03, up: 0, taper: 0.42, kids: [5, 8], kidStart: 0.58, kidEnd: 0.98 },
      { len: [6.5, 11], seg: 1.4, angle: 0.8, angleVar: 0.25, flat: 0.8, wander: 0.09, up: 0.04, taper: 0.35, radRatio: 0.5, kids: [2, 4], kidStart: 0.3 },
      { lenRatio: 0.55, seg: 1.0, angle: 0.65, angleVar: 0.3, wander: 0.11, up: 0.05, taper: 0.35, radRatio: 0.55, kids: [2, 3], kidStart: 0.35 },
      { lenRatio: 0.5, seg: 0.8, angle: 0.6, angleVar: 0.35, wander: 0.12, up: 0.04, taper: 0.35, radRatio: 0.6, kids: [0, 0] },
    ],
    blob: { r: [1.9, 2.8], cards: [13, 19], size: [1.7, 2.5], cells: [CELL.clusterDark, CELL.clusterLight, CELL.clusterDark], flat: 0.6, lift: 0.25, bend: 0.15, wind: 0.03 },
    tints: ['dark', 'mid', 'mid', 'yellow', 'blue', 'olive', 'flush'], epi: 0.6, hang: 0.6,
  },
  midstory: {
    crown: { base: 0.45, R: [3, 5], ry: 0.8, cut: 0.8, count: 300, D: 0.5, di: 4, dk: 0.8, shell: 0.45, tropism: 0.08, tipR: 0.02, minR: 0.055, trunkTaper: 0.6, cards: [2, 3], size: [1.2, 1.8] },
    bark: 'barkDark', tint: 0xa89888,
    trunk: { h: [11, 18], r: [0.2, 0.38] },
    buttress: { n: [3, 4], h: [0.8, 1.6], reach: [0.8, 1.4], thick: 0.25, chance: 0.25 },
    levels: [
      { seg: 2, wander: 0.05, up: 0, taper: 0.45, kids: [4, 6], kidStart: 0.5, kidEnd: 0.98 },
      { len: [3, 5.5], seg: 1.0, angle: 0.85, angleVar: 0.25, flat: 0.85, wander: 0.1, up: 0.03, taper: 0.35, radRatio: 0.55, kids: [2, 3], kidStart: 0.3 },
      { lenRatio: 0.55, seg: 0.8, angle: 0.7, angleVar: 0.3, wander: 0.12, up: 0.03, taper: 0.35, radRatio: 0.6, kids: [0, 0] },
    ],
    blob: { r: [1.3, 2.0], cards: [9, 14], size: [1.3, 1.9], cells: [CELL.clusterDark, CELL.clusterDark, CELL.clusterLight], flat: 0.6, lift: 0.25, bend: 0.15, wind: 0.035 },
    tints: ['dark', 'mid', 'blue', 'olive'], epi: 0.5, hang: 0.4,
  },
  understory: {
    crown: { base: 0.35, R: [1.0, 2.1], ry: 1.1, cut: 0.9, count: 90, D: 0.3, di: 2.2, dk: 0.45, shell: 0.3, tropism: 0.06, tipR: 0.012, minR: 0.03, trunkTaper: 0.7, cards: [3, 5], size: [0.3, 0.55], single: true },
    bark: 'barkDark', tint: 0x9a8a7a,
    trunk: { h: [3, 8], r: [0.05, 0.12] },
    levels: [
      { seg: 1, wander: 0.09, up: 0.01, taper: 0.5, kids: [3, 5], kidStart: 0.45, kidEnd: 0.98 },
      { len: [1.2, 2.6], seg: 0.6, angle: 0.95, angleVar: 0.3, flat: 0.8, wander: 0.13, up: 0.02, taper: 0.4, radRatio: 0.6, kids: [1, 3], kidStart: 0.4 },
      { lenRatio: 0.6, seg: 0.5, angle: 0.7, angleVar: 0.3, wander: 0.15, up: 0.02, taper: 0.4, radRatio: 0.6, kids: [0, 0] },
    ],
    blob: { r: [0.6, 1.0], cards: [12, 18], size: [0.34, 0.58], cells: [CELL.broad, CELL.lance, CELL.lance], flat: 0.5, lift: 0.1, bend: 0.25, wind: 0.05, single: true },
    tints: ['mid', 'dark', 'yellow'], epi: 0.25, hang: 0.1,
  },
  cecropia: {
    bark: 'barkPale', tint: 0xf4f0e8,
    trunk: { h: [12, 19], r: [0.11, 0.17] },
    levels: [
      { seg: 2, wander: 0.04, up: 0.0, taper: 0.55, kids: [3, 5], kidStart: 0.72, kidEnd: 0.97 },
      { len: [2.5, 4.5], seg: 0.6, angle: 0.75, angleVar: 0.2, flat: 1, wander: 0.04, up: 0.12, taper: 0.6, radRatio: 0.65, kids: [0, 0] },
    ],
    umbrella: true, tints: ['mid'], epi: 0.1, hang: 0.1,
  },
  ipe: {
    crown: { base: 0.55, R: [5, 7.5], ry: 0.62, cut: 0.6, count: 520, D: 0.6, di: 6, dk: 1.0, shell: 0.55, tropism: 0.1, tipR: 0.025, minR: 0.07, trunkTaper: 0.6, cards: [2, 3], size: [1.4, 1.9] },
    bark: 'barkDark', tint: 0xb0a090,
    trunk: { h: [20, 27], r: [0.4, 0.6] },
    buttress: { n: [3, 4], h: [1, 2], reach: [1, 2], thick: 0.3, chance: 0.4 },
    levels: [
      { seg: 2.5, wander: 0.03, up: 0, taper: 0.45, kids: [4, 6], kidStart: 0.62, kidEnd: 0.98 },
      { len: [5, 8], seg: 1.3, angle: 0.75, angleVar: 0.25, flat: 0.8, wander: 0.1, up: 0.05, taper: 0.35, radRatio: 0.5, kids: [2, 4], kidStart: 0.3 },
      { lenRatio: 0.55, seg: 1.0, angle: 0.7, angleVar: 0.3, wander: 0.12, up: 0.05, taper: 0.35, radRatio: 0.55, kids: [2, 3], kidStart: 0.35 },
      { lenRatio: 0.5, seg: 0.8, angle: 0.6, angleVar: 0.35, wander: 0.13, up: 0.04, taper: 0.35, radRatio: 0.6, kids: [0, 0] },
    ],
    blob: { r: [1.3, 2.0], cards: [9, 13], size: [1.3, 1.8], cells: [CELL.blossom], flat: 0.6, lift: 0.35, bend: 0.12, wind: 0.03 },
    tints: ['pink'], epi: 0.3, hang: 0.3,
  },
};
SPECIES.fig = {
  ...SPECIES.canopy, bark: 'roots', tint: 0xb8b0a0,
  crown: { ...SPECIES.canopy.crown, R: [7, 10.5], count: 750 },
  trunk: { h: [24, 30], r: [0.5, 0.7] },
  blob: { ...SPECIES.canopy.blob, cells: [CELL.clusterDark], cards: [11, 16] },
  tints: ['dark'], fig: true, epi: 0.8, hang: 1.2,
};

function radialSegs(r) { return r > 0.9 ? 20 : r > 0.4 ? 13 : r > 0.15 ? 9 : r > 0.06 ? 6 : 5; }

export class Forest {
  constructor({ terrain, batch, cards, colliders, rng }) {
    Object.assign(this, { terrain, batch, cards, colliders, rng });
    this.nz = createNoise(4242);
    this.trees = [];
    this.attach = [];     // epiphyte spots on limbs/crotches
    this.hangs = [];      // underside points for vines / aerial roots
    this.tips = [];       // terminal branch tips
    this.crowns = [];     // foliage blobs (for canopy coverage)
    this.petals = [];     // where ipê flowers fall
    this.perches = [];    // bird perches (outer limbs)
  }

  // ---------------------------------------------------------------- tree
  plant(type, x, z, opts = {}) {
    const sp = SPECIES[type];
    const rng = this.rng.fork(this.trees.length * 7919 + 13);
    const gy = this.terrain.height(x, z);
    const h = opts.height ?? rng.range(...sp.trunk.h);
    const r = opts.radius ?? rng.range(...sp.trunk.r);
    const tintName = opts.tint ?? rng.pick(sp.tints);
    const tree = {
      type, sp, x, z, gy, height: h, radius: r, rng, trunk: null, hollow: !!opts.hollow,
      leafTint: tintName === 'pink' ? (rng.chance(0.65) ? new THREE.Color(1.0, 0.45, 0.72) : new THREE.Color(1.15, 0.85, 0.18)) : new THREE.Color(...LEAF_TINTS[tintName]),
      barkTint: new THREE.Color(sp.tint).multiplyScalar(rng.range(0.85, 1.1)),
      crownTop: gy + h, blobs: 0,
    };
    this.trees.push(tree);
    const base = new THREE.Vector3(x, gy - 0.6, z);
    const dir = new THREE.Vector3(rng.range(-0.04, 0.04), 1, rng.range(-0.04, 0.04)).normalize();
    if (type === 'understory') dir.set(rng.range(-0.2, 0.2), 1, rng.range(-0.2, 0.2)).normalize();
    if (sp.crown) {
      const C = sp.crown;
      tree.crownR = opts.crownR ?? rng.range(...C.R);
      this.growBranch(sp, tree, base, dir, h * C.base + 0.6, r, 0, rng);
      this.growCrown(sp, tree, rng);
    } else this.growBranch(sp, tree, base, dir, h + 0.6, r, 0, rng);
    if (sp.buttress && rng.chance(sp.buttress.chance)) this.buttress(sp, tree, rng);
    if (r > 0.3) this.surfaceRoots(sp, tree, rng);
    if (sp.fig) this.figRoots(tree, rng);
    return tree;
  }

  growBranch(sp, tree, p0, dir, len, r0, depth, rng) {
    const L = sp.levels[depth];
    const segs = Math.max(2, Math.ceil(len / L.seg));
    const pts = [p0.clone()], radii = [r0];
    const d = dir.clone(), p = p0.clone();
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      _r.set(rng.gauss(), rng.gauss() * 0.5, rng.gauss()).multiplyScalar(L.wander);
      d.add(_r); d.y += L.up;
      if (depth > 0 && L.flat !== undefined && L.flat < 0.6 && t < 0.7) d.y *= 0.92; // keep big limbs spreading
      d.normalize();
      p.addScaledVector(d, len / segs);
      pts.push(p.clone());
      const taper = depth === 0 && sp.crown ? sp.crown.trunkTaper : L.taper;
      radii.push(r0 * (1 - (1 - taper) * Math.pow(t, depth === 0 ? 0.8 : 1)));
    }
    if (depth === 0) {
      tree.trunk = { pts, radii };
      // flare at the base
      for (let i = 0; i < pts.length; i++) {
        const hAbove = pts[i].y - tree.gy;
        radii[i] *= 1 + (sp.flare ?? 0.55) * Math.exp(-Math.max(0, hAbove) / (sp.flare ? 3 : 1.6));
      }
    }
    if (depth === 0 && tree.hollow) {
      // host tree has rotted away: only the fig lattice remains (built in figRoots)
      this.growChildren(sp, tree, pts, radii, len, depth, rng, L);
      return;
    }
    const radial = radialSegs(r0);
    const circ = Math.PI * 2 * r0;
    const mb = this.batch.get(sp.bark, tree.x, tree.z);
    mb.setColor(tree.barkTint);
    const nz = this.nz, seed = tree.x * 0.37 + depth * 3.1;
    const flutes = 5 + Math.floor(rng.next() * 4);
    addTube(mb, pts, radii, {
      radial, uRepeat: Math.max(1, Math.round(circ / 1.3)), vScale: depth === 0 ? 1.6 : 1.3,
      capEnd: true,
      radiusFn: r0 > 0.1 ? (i, th) => {
        let m = 1 + 0.06 * nz.noise2(Math.cos(th) * 1.7 + seed, pts[i].y * 0.35 + Math.sin(th) * 1.7);
        if (depth === 0) m += 0.13 * Math.cos(th * flutes + seed) * Math.exp(-Math.max(0, pts[i].y - tree.gy) / 3.5);
        return m;
      } : null,
      windFn: (i) => depth === 0 ? Math.max(0, 1 - (pts[i].y - tree.gy) / 4) * 0.85 : 0.15,
    });
    // colliders
    if (r0 > 0.09) for (let i = 0; i < pts.length - 1; i++) this.colliders.addCapsule(pts[i], pts[i + 1], (radii[i] + radii[i + 1]) * 0.5 + (depth === 0 ? 0.05 : 0));

    // epiphyte & vine spots on the big limbs
    if (depth >= 1 && r0 > 0.12) {
      for (let i = 1; i < pts.length; i++) {
        _n.subVectors(pts[i], pts[i - 1]).normalize();
        if (Math.abs(_n.y) > 0.8) continue;
        const top = pts[i].clone(); top.y += radii[i] * 0.85;
        if (rng.chance(0.7 * sp.epi)) this.attach.push({ p: top, n: UP.clone(), r: radii[i], tree, kind: 'limb', dir: _n.clone() });
        const bot = pts[i].clone(); bot.y -= radii[i] * 0.9;
        if (rng.chance(0.5 * sp.hang)) this.hangs.push({ p: bot, tree, r: radii[i] });
        if (depth >= 2 && rng.chance(0.25)) this.perches.push({ p: top.clone(), dir: _n.clone(), tree });
      }
    }
    if (depth === 0 && (tree.sp.levels.length > 1 || sp.crown)) {
      const crotch = sp.crown ? pts[pts.length - 1] : (pts[Math.floor(pts.length * (L.kidStart + 0.05))] || pts[pts.length - 1]);
      if (r0 > 0.15) this.attach.push({ p: crotch.clone().add(new THREE.Vector3(0, 0.2, 0)), n: UP.clone(), r: r0 * 0.5, tree, kind: 'crotch' });
    }

    this.growChildren(sp, tree, pts, radii, len, depth, rng, L);
  }

  growChildren(sp, tree, pts, radii, len, depth, rng, L) {
    if (sp.crown && depth === 0) return; // crown grown by space colonisation
    // children
    const last = depth === sp.levels.length - 1;
    if (!last) {
      const Lc = sp.levels[depth + 1];
      const n = rng.int(L.kids[0], L.kids[1]);
      let az = rng.range(0, Math.PI * 2);
      for (let k = 0; k < n; k++) {
        const t = lerp(L.kidStart, L.kidEnd ?? 0.98, (k + rng.range(0, 0.9)) / n);
        const fi = t * (pts.length - 1), i0 = Math.floor(fi), fr = fi - i0;
        const i1 = Math.min(pts.length - 1, i0 + 1);
        const pos = pts[i0].clone().lerp(pts[i1], fr);
        const rAt = lerp(radii[i0], radii[i1], fr);
        const pd = new THREE.Vector3().subVectors(pts[i1], pts[i0]).normalize();
        az += 2.39996 + rng.range(-0.35, 0.35);
        const ref = Math.abs(pd.y) < 0.95 ? UP : new THREE.Vector3(1, 0, 0);
        const perp = new THREE.Vector3().crossVectors(pd, ref).normalize().applyAxisAngle(pd, az);
        const ang = Lc.angle + rng.range(-Lc.angleVar, Lc.angleVar);
        const cdir = pd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(perp, Math.sin(ang));
        if (Lc.flat !== undefined) { cdir.y *= Lc.flat; }
        cdir.normalize();
        const clen = Lc.len ? rng.range(...Lc.len) * (depth === 0 ? lerp(1.0, 0.7, (t - L.kidStart) / Math.max(0.01, (L.kidEnd ?? 1) - L.kidStart)) : 1)
          : len * Lc.lenRatio * rng.range(0.75, 1.15) * (1 - 0.35 * t);
        const cr = Math.min(rAt * (Lc.radRatio ?? 0.5), rAt * 0.8);
        if (cr < 0.01 || clen < 0.2) continue;
        this.growBranch(sp, tree, pos.addScaledVector(pd, rAt * 0.2), cdir, clen, cr, depth + 1, rng);
      }
      // trunk leader continues a little above the crotch for big trees
    }
    if (last || (depth > 0 && sp.levels[depth + 1] && sp.levels[depth + 1].kids[1] === 0 && rng.chance(0.55))) {
      const tip = pts[pts.length - 1];
      const tdir = new THREE.Vector3().subVectors(tip, pts[pts.length - 2]).normalize();
      this.tips.push({ p: tip.clone(), dir: tdir, tree });
      if (sp.umbrella) this.umbrella(tree, tip, tdir, rng);
      else this.leafBlob(sp, tree, tip, tdir, rng);
      if (depth >= 1 && rng.chance(0.3)) this.perches.push({ p: tip.clone(), dir: tdir, tree });
    }
  }

  // Space-colonised crown: the skeleton fills the crown envelope, limbs follow the pipe model,
  // and foliage clusters sit on every twig tip, so crowns close up into a continuous layer.
  growCrown(sp, tree, rng) {
    const C = sp.crown;
    const { pts, radii } = tree.trunk;
    const root = pts[pts.length - 1], rootR = radii[radii.length - 1];
    const R = tree.crownR, Ry = R * C.ry;
    const top = tree.gy + tree.height;
    const center = new THREE.Vector3(tree.x + rng.range(-0.15, 0.15) * R, top - Ry, tree.z + rng.range(-0.15, 0.15) * R);
    const dens = Math.max(0.6, QUALITY.density);
    const sk = colonize({
      root, rootR, center, R, Ry, yMin: center.y - Ry * C.cut, count: Math.round(C.count * dens),
      D: C.D, di: C.di, dk: C.dk, shell: C.shell, tropism: C.tropism, tipR: C.tipR, rng,
      rootDir: new THREE.Vector3().subVectors(root, pts[pts.length - 2]).normalize(),
      lopsided: { x: rng.range(-0.25, 0.25), z: rng.range(-0.25, 0.25) },
    });
    tree.skel = sk; tree.crownC = center; tree.crownRy = Ry;
    const { list, childList } = chains(sk);
    const mb = this.batch.get(sp.bark, tree.x, tree.z);
    mb.setColor(tree.barkTint);
    const V = (i) => new THREE.Vector3(sk.x[i], sk.y[i], sk.z[i]);
    for (const ch of list) {
      // keep only nodes thick enough to be seen through the foliage
      let end = ch.length;
      while (end > 2 && sk.r[ch[end - 1]] < C.minR) end--;
      if (sk.r[ch[1]] < C.minR) continue;
      const use = ch.slice(0, end).filter((id, k, arr) => k === 0 || k === arr.length - 1 || sk.r[id] > 0.2 || k % 2 === 0);
      const p = use.map(V), rr = use.map((i) => sk.r[i]);
      const r0 = rr[0];
      addTube(mb, p, rr, {
        radial: Math.max(4, radialSegs(r0) - (r0 < 0.3 ? 3 : 2)), uRepeat: Math.max(1, Math.round(Math.PI * 2 * r0 / 1.3)), vScale: 1.3, capEnd: true,
        windFn: () => 0.15,
      });
      for (let k = 0; k < p.length - 1; k++) {
        if (rr[k] > 0.1) this.colliders.addCapsule(p[k], p[k + 1], rr[k]);
        if (rr[k] > 0.12) {
          _n.subVectors(p[k + 1], p[k]).normalize();
          if (Math.abs(_n.y) < 0.75) {
            if (rng.chance(0.35 * sp.epi)) this.attach.push({ p: p[k].clone().add(new THREE.Vector3(0, rr[k] * 0.85, 0)), n: UP.clone(), r: rr[k], tree, kind: 'limb', dir: _n.clone() });
            if (rng.chance(0.3 * sp.hang)) this.hangs.push({ p: p[k].clone().add(new THREE.Vector3(0, -rr[k] * 0.9, 0)), tree, r: rr[k] });
            if (rr[k] < 0.35 && rng.chance(0.12)) this.perches.push({ p: p[k].clone().add(new THREE.Vector3(0, rr[k], 0)), dir: _n.clone(), tree });
          }
        }
      }
    }
    // foliage on twig tips (and a share of the thinnest twigs)
    const tint = tree.leafTint, col = new THREE.Color();
    const cells = sp.blob.cells;
    tree.leafNodes = [];
    for (let i = 1; i < sk.N; i++) {
      const tip = childList[i].length === 0;
      if (!tip && !(sk.r[i] < C.tipR * 1.5 && rng.chance(0.25))) continue;
      tree.leafNodes.push(i);
      const p = V(i), par = V(sk.par[i]);
      const bdir = p.clone().sub(par).normalize();
      const out = p.clone().sub(center); out.y /= Math.max(0.3, C.ry); out.normalize();
      const n = tip ? rng.int(...C.cards) : 1;
      const flush = !C.single && tree.type !== 'ipe' && rng.chance(0.04);
      for (let k = 0; k < n; k++) {
        _r.set(rng.gauss(), rng.gauss(), rng.gauss()).multiplyScalar(0.35);
        const ydir = bdir.clone().addScaledVector(out, 0.9).add(_r);
        ydir.y += C.single ? -0.1 : 0.15;
        const face = UP.clone().addScaledVector(out, 0.5).add(_r);
        cardBasis(ydir, face, _X, _Y, _Z);
        const sz = rng.range(...C.size);
        const w = sz * (C.single ? rng.range(0.5, 0.7) : 1);
        const v = rng.range(0.82, 1.12);
        const tt = flush ? LEAF_TINTS.flush : [tint.r, tint.g, tint.b];
        col.setRGB(tt[0] * v * rng.range(0.94, 1.06), tt[1] * v, tt[2] * v * rng.range(0.94, 1.06));
        const nrm = out.clone().multiplyScalar(0.65).addScaledVector(UP, 0.45).addScaledVector(_Z, 0.2).normalize();
        const base = p.clone().addScaledVector(_Y, -sz * 0.3).addScaledVector(_r, sz * 0.3);
        this.cards.add('crown', base, _X, _Y, _Z, w, sz, cellRect(rng.pick(cells)), col,
          { bend: sz * sp.blob.bend * (C.single ? 2 : 1), fold: sz * 0.06, wind: sp.blob.wind }, nrm);
      }
      if (tip) {
        this.crowns.push({ x: p.x, z: p.z, r: C.size[1] * 0.75, top: p.y + C.size[1] * 0.4 });
        if (rng.chance(0.08)) this.tips.push({ p, dir: bdir, tree });
      }
    }
    tree.crownTop = top;
  }

  leafBlob(sp, tree, tip, dir, rng) {
    const B = sp.blob;
    const R = rng.range(...B.r);
    const center = tip.clone().addScaledVector(dir, R * 0.35);
    center.y += R * 0.15;
    const n = rng.int(...B.cards);
    const flush = !B.single && tree.type !== 'ipe' && rng.chance(0.08);
    const tint = flush ? new THREE.Color(...LEAF_TINTS.flush) : tree.leafTint;
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      rng.unit(_u);
      _u.y = _u.y * B.flat + B.lift; _u.normalize();
      const dist = R * Math.pow(rng.range(0.15, 1), 0.6);
      const pos = center.clone().addScaledVector(_u, dist);
      pos.y -= dist * _u.y * (1 - B.flat) * 0.5;
      _r.set(rng.gauss(), rng.gauss(), rng.gauss()).multiplyScalar(0.35);
      const ydir = _u.clone().add(_r);
      ydir.y += B.single ? -0.2 : 0.25;
      if (ydir.lengthSq() < 1e-4) ydir.set(0, 1, 0);
      const face = UP.clone().lerp(_u, 0.45).add(_r);
      cardBasis(ydir, face, _X, _Y, _Z);
      const s = rng.range(...B.size);
      const w = s * (B.single ? rng.range(0.5, 0.7) : 1);
      const v = rng.range(0.82, 1.12);
      col.setRGB(tint.r * v * rng.range(0.94, 1.06), tint.g * v, tint.b * v * rng.range(0.94, 1.06));
      const nrm = _u.clone().multiplyScalar(0.65).addScaledVector(UP, 0.45).addScaledVector(_Z, 0.25).normalize();
      // pull the card base back so the visual centre sits on the blob shell
      const base = pos.addScaledVector(_Y, -s * 0.35);
      this.cards.add('crown', base, _X, _Y, _Z, w, s, cellRect(rng.pick(B.cells)), col, { bend: s * B.bend * (B.single ? 2 : 1), fold: s * 0.06, wind: B.wind }, nrm);
    }
    this.crowns.push({ x: center.x, z: center.z, r: R + 0.5, top: center.y + R * B.flat + 0.8 });
    tree.blobs++;
  }

  umbrella(tree, tip, dir, rng) {
    const n = rng.int(7, 10);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const out = new THREE.Vector3(Math.cos(a), rng.range(-0.45, -0.1), Math.sin(a)).normalize();
      const face = UP.clone().addScaledVector(out, 0.35);
      cardBasis(out, face, _X, _Y, _Z);
      const s = rng.range(1.0, 1.5);
      const v = rng.range(0.9, 1.1);
      col.setRGB(v, v, v);
      this.cards.add('crown', tip.clone().addScaledVector(out, 0.08), _X, _Y, _Z, s, s, cellRect(CELL.cecropia), col,
        { bend: -s * 0.15, fold: s * 0.12, wind: 0.05 }, face.clone().normalize());
    }
    // finger-like catkins
    const mb = this.batch.get('plain', tip.x, tip.z);
    mb.setColor([0.35, 0.4, 0.2]);
    for (let k = 0; k < 5; k++) {
      const a = rng.range(0, 6.28);
      const p0 = tip.clone().add(new THREE.Vector3(Math.cos(a) * 0.05, -0.05, Math.sin(a) * 0.05));
      const p1 = p0.clone().add(new THREE.Vector3(Math.cos(a) * 0.12, -0.35, Math.sin(a) * 0.12));
      addTube(mb, [p0, p1], [0.015, 0.012], { radial: 4, capEnd: true });
    }
    this.crowns.push({ x: tip.x, z: tip.z, r: 1.6, top: tip.y + 0.5 });
  }

  // Plank buttress roots: lofted fins that snake out from the trunk.
  buttress(sp, tree, rng) {
    const B = sp.buttress;
    const n = rng.int(...B.n);
    const H = rng.range(...B.h), reach = rng.range(...B.reach);
    const mb = this.batch.get(sp.bark, tree.x, tree.z);
    mb.setColor(tree.barkTint);
    const scale = Math.max(0.35, tree.radius);
    for (let f = 0; f < n; f++) {
      const a0 = (f / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const fr = reach * rng.range(0.65, 1.2), fh = H * rng.range(0.65, 1.1);
      const wob = rng.range(-0.6, 0.6), ph = rng.range(0, 6.28);
      const steps = 16, M = 14, rings = [];
      let prev = null;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const ang = a0 + wob * t * t + 0.1 * Math.sin(t * 7 + ph);
        const rad = tree.radius * 0.5 + t * fr;
        const x = tree.x + Math.cos(ang) * rad, z = tree.z + Math.sin(ang) * rad;
        const gy = this.terrain.height(x, z);
        const top = gy + Math.max(0.12, fh * Math.pow(1 - t, 1.6) * (1 + 0.08 * Math.sin(t * 11 + ph)));
        const bottom = gy - 0.5;
        const th = lerp(B.thick, 0.1, Math.pow(t, 0.8)) * scale;
        const side = new THREE.Vector3(Math.sin(ang), 0, -Math.cos(ang));
        const cy = (top + bottom) / 2, hy = (top - bottom) / 2;
        const pts = [], nrm = [];
        for (let j = 0; j < M; j++) {
          const th2 = (j / M) * Math.PI * 2;
          const c = Math.cos(th2), sn = Math.sin(th2);
          const ec = Math.sign(c) * Math.pow(Math.abs(c), 0.6), es = Math.sign(sn) * Math.pow(Math.abs(sn), 0.8);
          // wedge: plank-thin along the top edge, thick and flared at the foot, knobbly bark
          const wedge = 1 + 1.6 * Math.pow(0.5 - es * 0.5, 2);
          const knob = 1 + 0.18 * this.nz.noise2(x * 0.9 + j, (cy + es * hy) * 0.7 + f * 3);
          const w = th * wedge * knob;
          pts.push(new THREE.Vector3(x + side.x * ec * w, cy + es * hy, z + side.z * ec * w));
          nrm.push(new THREE.Vector3(side.x * c / w, sn / hy * 0.6 + (es < 0 ? 0.3 : 0), side.z * c / w).normalize());
        }
        rings.push({ pts, nrm, v: (t * fr) / 1.4 });
        const ctr = new THREE.Vector3(x, gy + Math.min(1.2, (top - gy) * 0.5), z);
        if (prev && top - gy > 0.4) this.colliders.addCapsule(prev, ctr, th + 0.03);
        prev = ctr;
        if (s === 6 && fh > 3 && rng.chance(0.5)) this.attach.push({ p: new THREE.Vector3(x, top, z), n: UP.clone(), r: th, tree, kind: 'buttress' });
      }
      addLoft(mb, rings, Math.max(2, Math.round((fh * 2 + B.thick * scale * 2) / 1.5)), (i) => 0.25 - (i / steps) * 0.1);
    }
  }

  surfaceRoots(sp, tree, rng) {
    const n = rng.int(3, 6) + (tree.radius > 1 ? 5 : 0);
    const mb = this.batch.get(sp.bark, tree.x, tree.z);
    mb.setColor(tree.barkTint);
    for (let k = 0; k < n; k++) {
      let a = rng.range(0, 6.28);
      const len = rng.range(3, 9) * Math.min(1.5, tree.radius * 1.6);
      const r0 = tree.radius * rng.range(0.12, 0.22);
      const pts = [], radii = [];
      const steps = Math.ceil(len / 0.6);
      const arch = rng.chance(0.3) ? rng.range(0.15, 0.5) : 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        a += rng.range(-0.12, 0.12);
        const rad = tree.radius * 0.7 + t * len;
        const x = tree.x + Math.cos(a) * rad, z = tree.z + Math.sin(a) * rad;
        const rr = r0 * (1 - t * 0.85);
        const lift = arch * Math.max(0, Math.sin(t * Math.PI * 2.5)) * (1 - t);
        pts.push(new THREE.Vector3(x, this.terrain.height(x, z) - rr * 0.35 + lift, z));
        radii.push(rr);
      }
      addTube(mb, pts, radii, { radial: 7, uRepeat: 2, vScale: 1.0, windFn: () => 0.2 });
    }
  }

  // Strangler fig: a lattice of roots grown down around the host trunk.
  figRoots(tree, rng) {
    const { pts: tp, radii: tr } = tree.trunk;
    const topY = tree.gy + tree.height * (tree.hollow ? 0.78 : 0.72);
    const rAtY = (y) => {
      for (let i = 0; i < tp.length - 1; i++) if (tp[i + 1].y >= y) {
        const f = (y - tp[i].y) / Math.max(1e-4, tp[i + 1].y - tp[i].y);
        return { r: lerp(tr[i], tr[i + 1], f), x: lerp(tp[i].x, tp[i + 1].x, f), z: lerp(tp[i].z, tp[i + 1].z, f) };
      }
      return { r: tr[tr.length - 1], x: tp[tp.length - 1].x, z: tp[tp.length - 1].z };
    };
    const mb = this.batch.get('roots', tree.x, tree.z);
    mb.setColor(new THREE.Color(0xc8c0b0));
    const n = tree.hollow ? rng.int(14, 18) : rng.int(8, 12);
    const strands = [];
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const twist = rng.range(-1.4, 1.4);
      const sr = rng.range(0.06, 0.15);
      const pts = [], radii = [], angs = [];
      const start = topY - rng.range(0, 5);
      const steps = Math.ceil((start - tree.gy) / 0.7);
      for (let i = 0; i <= steps + 3; i++) {
        const t = Math.min(1, i / steps);
        const y = lerp(start, tree.gy - 0.2, t);
        const a = a0 + twist * t + 0.15 * Math.sin(t * 9 + k);
        const T = rAtY(y);
        let rr = T.r + sr * 0.6;
        if (i > steps) rr += (i - steps) * rng.range(0.5, 1.0);
        const yy = i > steps ? this.terrain.height(T.x + Math.cos(a) * rr, T.z + Math.sin(a) * rr) - 0.15 : y;
        pts.push(new THREE.Vector3(T.x + Math.cos(a) * rr, yy, T.z + Math.sin(a) * rr));
        radii.push(sr * (0.5 + 0.9 * t));
        angs.push(a);
      }
      addTube(mb, pts, radii, { radial: 7, vScale: 1.2, windFn: () => 0.3 });
      for (let i = 0; i < pts.length - 1; i += 2) this.colliders.addCapsule(pts[i], pts[Math.min(pts.length - 1, i + 2)], radii[i] + 0.03);
      strands.push({ pts, angs, radii });
    }
    // anastomoses between neighbouring strands
    for (let c = 0; c < n * (tree.hollow ? 4 : 2); c++) {
      const k = rng.int(0, n - 1), s1 = strands[k], s2 = strands[(k + 1) % n];
      const i = rng.int(1, Math.min(s1.pts.length, s2.pts.length) - 5);
      const a = s1.pts[i], b = s2.pts[i];
      const mid = a.clone().lerp(b, 0.5);
      const T = rAtY(mid.y);
      const dx = mid.x - T.x, dz = mid.z - T.z, dl = Math.hypot(dx, dz) || 1;
      mid.x = T.x + dx / dl * (T.r + 0.08); mid.z = T.z + dz / dl * (T.r + 0.08);
      mid.y += rng.range(-0.6, 0.6);
      addTube(mb, [a, mid, b], [s1.radii[i] * 0.7, s1.radii[i] * 0.5, s2.radii[i] * 0.7], { radial: 6 });
    }
  }

  // ---------------------------------------------------------------- placement
  populate({ hero }) {
    const T = this.terrain, rng = this.rng;
    const placed = [];
    const R = WORLD.radius - 2;
    const ok = (x, z, minD, waterGap, cls) => {
      if (Math.hypot(x, z) > R) return false;
      if (T.bankDist(x, z) < waterGap) return false;
      for (const p of placed) {
        const dd = (p.x - x) ** 2 + (p.z - z) ** 2;
        const need = Math.max(minD, p.min) * (cls === 'small' || p.cls === 'small' ? 0.5 : 1);
        if (dd < need * need) return false;
      }
      return true;
    };
    // Light-competition rasters, one per forest layer. A new tree goes where its layer is
    // most open, so each layer closes into a continuous ceiling over the one below.
    const N = 128, S = WORLD.size;
    const layers = { emergent: new Float32Array(N * N), canopy: new Float32Array(N * N), sub: new Float32Array(N * N), under: new Float32Array(N * N) };
    const cell = (v) => Math.max(0, Math.min(N - 1, Math.floor(((v + WORLD.half) / S) * N)));
    const splat = (L, x, z, r, w = 1) => {
      const rc = (r / S) * N, cx = ((x + WORLD.half) / S) * N, cz = ((z + WORLD.half) / S) * N;
      for (let j = Math.max(0, Math.floor(cz - rc)); j <= Math.min(N - 1, Math.ceil(cz + rc)); j++)
        for (let i = Math.max(0, Math.floor(cx - rc)); i <= Math.min(N - 1, Math.ceil(cx + rc)); i++) {
          const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz) / rc;
          if (d < 1) L[j * N + i] += w * (1 - d * d * 0.6);
        }
    };
    const shade = (L, x, z, r) => {
      let s2 = 0;
      for (let k = 0; k < 9; k++) {
        const a = (k / 8) * Math.PI * 2, rr = k === 8 ? 0 : r * 0.7;
        s2 += L[cell(z + Math.sin(a) * rr) * N + cell(x + Math.cos(a) * rr)];
      }
      return s2 / 9;
    };
    // upper layers shade lower ones a little too (trees still prefer light gaps)
    const above = { canopy: ['emergent'], sub: ['emergent', 'canopy'], under: ['canopy', 'sub'] };
    const plantIn = (layer, type, opts, x, z, minD) => {
      const sp = SPECIES[type];
      const tree = this.plant(type, x, z, opts);
      placed.push({ x, z, min: minD, cls: layer === 'under' ? 'small' : 'big' });
      const cr = tree.crownR ?? (sp.blob ? 4 : 2.5);
      splat(layers[layer], tree.crownC ? tree.crownC.x : x, tree.crownC ? tree.crownC.z : z, cr);
      return tree;
    };
    const fill = (layer, type, count, minD, waterGap, opts = {}) => {
      const sp = SPECIES[type];
      let made = 0;
      for (let i = 0; i < count; i++) {
        const cr = sp.crown ? rng.range(...sp.crown.R) : 3;
        let best = null, bestS = Infinity;
        for (let k = 0; k < (opts.samples ?? 14); k++) {
          const x = rng.range(-R, R), z = rng.range(-R, R);
          if (opts.pred && !opts.pred(x, z)) continue;
          if (!ok(x, z, minD, waterGap, layer === 'under' ? 'small' : 'big')) continue;
          let sc = shade(layers[layer], x, z, cr);
          for (const a of above[layer] || []) sc += 0.25 * shade(layers[a], x, z, cr);
          sc += rng.next() * 0.05;
          if (sc < bestS) { bestS = sc; best = [x, z]; }
        }
        if (!best) continue;
        plantIn(layer, type, { ...(opts.treeOpts || {}), crownR: cr }, best[0], best[1], minD);
        made++;
      }
      return made;
    };
    // hero trees first
    for (const h of hero) {
      const layer = h.type === 'giant' || h.type === 'kapok' ? 'emergent' : 'canopy';
      plantIn(layer, h.type, h.opts || {}, h.x, h.z, h.min ?? 18);
    }
    fill('emergent', 'giant', 5, 34, 4, { samples: 30 });
    fill('emergent', 'kapok', 3, 28, 3, { samples: 30 });
    fill('emergent', 'brazilnut', 4, 24, 4, { samples: 30 });
    fill('canopy', 'fig', 4, 12, 3);
    for (let i = 0; i < 2; i++) fill('canopy', 'fig', 1, 12, 3, { treeOpts: { hollow: true, radius: rng.range(1.1, 1.5) } });
    fill('canopy', 'ipe', 3, 10, 3);
    const D = Math.max(0.6, QUALITY.density);
    fill('canopy', 'canopy', Math.round(280 * Math.max(0.85, D)), 4, 2);
    fill('canopy', 'cecropia', 18, 3, 0.5, { pred: (x, z) => T.bankDist(x, z) < 14 });
    fill('sub', 'midstory', Math.round(300 * D), 3, 1.5);
    fill('under', 'understory', Math.round(560 * D), 2.2, 1.0);
    this.layers = layers;
    this.placed = placed;
  }

  // canopy coverage map: R = cover 0..1, G = canopy top / 64
  buildCoverage() {
    const N = 256, S = WORLD.size;
    const cov = new Float32Array(N * N), top = new Float32Array(N * N);
    const px = (x) => ((x + WORLD.half) / S) * N;
    for (const c of this.crowns) {
      const cx = px(c.x), cz = px(c.z), rr = (c.r / S) * N * 1.15;
      const x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(N - 1, Math.ceil(cx + rr));
      const z0 = Math.max(0, Math.floor(cz - rr)), z1 = Math.min(N - 1, Math.ceil(cz + rr));
      for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz) / rr;
        if (d >= 1) continue;
        const w = 1 - d * d;
        const k = j * N + i;
        cov[k] += w * 0.75;
        top[k] = Math.max(top[k], c.top * smoothstep(1, 0.4, d));
      }
    }
    // blur
    const blur = (src) => {
      const out = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        let s = 0, n = 0;
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
          s += src[jj * N + ii]; n++;
        }
        out[j * N + i] = s / n;
      }
      return out;
    };
    const cb = blur(cov), tb = blur(top);
    const data = new Uint8Array(N * N * 4);
    this.coverage = new Float32Array(N * N);
    this.canopyTop = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) {
      const c = Math.min(1, cb[k]);
      this.coverage[k] = c; this.canopyTop[k] = tb[k];
      data[k * 4] = c * 255;
      data[k * 4 + 1] = Math.min(255, (tb[k] / 64) * 255);
      data[k * 4 + 2] = 0; data[k * 4 + 3] = 255;
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    this.coverageTex = t;
    this.covN = N;
    return t;
  }
  coverAt(x, z) {
    const N = this.covN, i = Math.floor(((x + WORLD.half) / WORLD.size) * N), j = Math.floor(((z + WORLD.half) / WORLD.size) * N);
    if (i < 0 || j < 0 || i >= N || j >= N) return 0.85;
    return this.coverage[j * N + i];
  }
  topAt(x, z) {
    const N = this.covN, i = Math.floor(((x + WORLD.half) / WORLD.size) * N), j = Math.floor(((z + WORLD.half) / WORLD.size) * N);
    if (i < 0 || j < 0 || i >= N || j >= N) return 38;
    return this.canopyTop[j * N + i];
  }
}

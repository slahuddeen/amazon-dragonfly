// Architectural models for the lower forest strata (after Hallé, Oldeman & Tomlinson 1978).
// Each builds bark + foliage for one tree and records trunk, crown and attachment data
// so the rest of the ecosystem (epiphytes, climbers, coverage) can use it.
//
//  tiers  - Massart / Aubréville: straight trunk with whorls of horizontal branches carrying
//           flat foliage plates (pagoda). Young emergents (kapok saplings & poles), Terminalia-like trees.
//  troll  - Troll: sympodial, arching branches holding two-ranked sprays of large shade leaves.
//           The typical shade-tolerant understory tree that spreads leaves in one wide layer.
//  fork   - Leeuwenberg: repeated forking, a rosette of big leaves at every tip (Schefflera-like).
//  corner - Corner: one unbranched stem with a crown of huge leaves (understory treelets).
import * as THREE from 'three';
import { addTube, cardBasis } from '../core/geometry.js';
import { CELL, cellRect } from '../core/textures.js';

const UP = new THREE.Vector3(0, 1, 0);
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();

function leaf(F, tree, layer, pos, ydir, face, w, h, cell, rng, opts = {}) {
  cardBasis(ydir, face, _X, _Y, _Z);
  const t = tree.leafTint, v = rng.range(0.82, 1.1) * (opts.dark ?? 1);
  const col = new THREE.Color(t.r * v, t.g * v, t.b * v * rng.range(0.92, 1.05));
  const nrm = (opts.nrm || UP).clone().multiplyScalar(0.6).addScaledVector(_Z, 0.4).normalize();
  F.cards.add(layer, pos, _X, _Y, _Z, w, h, cellRect(cell), col, { bend: opts.bend ?? -h * 0.18, fold: w * 0.06, wind: opts.wind ?? 0.04 }, nrm);
}

function stemPath(base, dir, len, n, wander, rng, upPull = 0) {
  const pts = [base.clone()];
  const d = dir.clone(), p = base.clone();
  for (let i = 1; i <= n; i++) {
    d.x += rng.range(-wander, wander); d.z += rng.range(-wander, wander); d.y += upPull; d.normalize();
    p.addScaledVector(d, len / n);
    pts.push(p.clone());
  }
  return pts;
}

function emitStem(F, tree, pts, r0, r1, key, opts = {}) {
  const mb = F.batch.get(key, tree.x, tree.z);
  mb.setColor(tree.barkTint);
  const n = pts.length - 1;
  const radii = pts.map((_, i) => r0 + (r1 - r0) * (i / n));
  addTube(mb, pts, radii, { radial: r0 > 0.1 ? 7 : r0 > 0.04 ? 5 : 4, capEnd: true, vScale: 1.2, windFn: opts.windFn || (() => 0.1) });
  if (r0 > 0.05) for (let i = 0; i < n; i++) F.colliders.addCapsule(pts[i], pts[i + 1], radii[i] + 0.02);
  return radii;
}

function finish(F, tree, pts, radii, crownC, crownR, top) {
  tree.trunk = { pts, radii };
  tree.crownC = crownC; tree.crownR = crownR; tree.crownTop = top;
  F.crowns.push({ x: crownC.x, z: crownC.z, r: crownR, top });
}

// ------------------------------------------------------------------ Massart / Aubréville tiers
export function tiers(F, tree, rng, sp) {
  const H = tree.height, r = tree.radius;
  const key = sp.bark;
  const base = new THREE.Vector3(tree.x, tree.gy - 0.3, tree.z);
  const trunk = stemPath(base, new THREE.Vector3(rng.range(-0.03, 0.03), 1, rng.range(-0.03, 0.03)).normalize(), H + 0.3, Math.max(3, Math.ceil(H / 1.2)), 0.02, rng);
  const radii = emitStem(F, tree, trunk, r, r * 0.35, key);
  const crownStart = H * (sp.crownStart ?? 0.4);
  const spacing = Math.max(0.5, H * rng.range(0.07, 0.11));
  const maxL = sp.spread * rng.range(0.8, 1.2);
  let az = rng.range(0, 6.28);
  const mbB = F.batch.get(key, tree.x, tree.z);
  for (let y = crownStart; y < H - 0.3; y += spacing * rng.range(0.85, 1.15)) {
    const f = (y - crownStart) / Math.max(0.1, H - crownStart); // 0 bottom .. 1 top
    const L = maxL * (1 - 0.75 * f) * rng.range(0.85, 1.1);
    const n = rng.int(sp.whorl[0], sp.whorl[1]);
    const ti = Math.min(trunk.length - 1, Math.round((y / (H + 0.3)) * (trunk.length - 1)));
    const at = trunk[ti].clone();
    az += 0.9;
    for (let k = 0; k < n; k++) {
      const a = az + (k / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const bp = [at.clone()];
      for (let s = 1; s <= 4; s++) {
        const t = s / 4;
        bp.push(at.clone().addScaledVector(out, L * t).add(new THREE.Vector3(0, 0.12 * L * t - 0.18 * L * t * t * (sp.droop ?? 1), 0)));
      }
      mbB.setColor(tree.barkTint);
      addTube(mbB, bp, bp.map((_, i) => Math.max(0.006, r * 0.32 * (1 - i / 5))), { radial: 4, capEnd: true, windFn: (i) => 0.02 * i });
      if (r * 0.32 > 0.06) F.attach.push({ p: bp[1].clone().add(new THREE.Vector3(0, r * 0.3, 0)), n: UP.clone(), r: r * 0.3, tree, kind: 'limb', dir: out.clone() });
      // flat foliage plate: leaves in two ranks along the outer branch, facing the sky
      const side = new THREE.Vector3(-out.z, 0, out.x);
      const nl = Math.max(3, Math.round(L / (sp.leaf[1] * 0.55)));
      for (let j = 0; j < nl; j++) {
        const t = 0.3 + 0.7 * (j / nl);
        const p = bp[0].clone().lerp(bp[4], t); p.y = bp[Math.min(4, Math.round(t * 4))].y;
        for (const s of [-1, 1]) {
          const yd = side.clone().multiplyScalar(s).addScaledVector(out, 0.6);
          yd.y = rng.range(-0.05, 0.1);
          const sz = rng.range(sp.leaf[0], sp.leaf[1]) * (1 + 0.25 * (1 - f));
          leaf(F, tree, sp.layer, p, yd, UP.clone().addScaledVector(out, 0.15), sz * sp.aspect, sz, rng.pick(sp.cells), rng, { bend: -sz * 0.12 });
        }
      }
      // tip cluster
      for (let j = 0; j < 3; j++) {
        const yd = out.clone().add(new THREE.Vector3(rng.range(-0.4, 0.4), 0.05, rng.range(-0.4, 0.4)));
        const sz = rng.range(sp.leaf[0], sp.leaf[1]);
        leaf(F, tree, sp.layer, bp[4], yd, UP, sz * sp.aspect, sz, rng.pick(sp.cells), rng);
      }
      F.crowns.push({ x: bp[3].x, z: bp[3].z, r: Math.max(0.8, L * 0.45), top: bp[3].y + 0.3 });
    }
  }
  // terminal rosette
  const top = trunk[trunk.length - 1];
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * 6.28;
    const yd = new THREE.Vector3(Math.cos(a), 0.5, Math.sin(a));
    const sz = rng.range(sp.leaf[0], sp.leaf[1]);
    leaf(F, tree, sp.layer, top, yd, UP, sz * sp.aspect, sz, rng.pick(sp.cells), rng);
  }
  finish(F, tree, trunk, radii, new THREE.Vector3(tree.x, tree.gy + (crownStart + H) / 2, tree.z), maxL * 0.8, tree.gy + H + 0.3);
}

// ------------------------------------------------------------------ Troll: arching layered sprays
export function troll(F, tree, rng, sp) {
  const H = tree.height, r = tree.radius;
  const key = sp.bark;
  const base = new THREE.Vector3(tree.x, tree.gy - 0.3, tree.z);
  // sympodial trunk: a few leaning modules, each ending in an arching branch
  const lean = new THREE.Vector3(rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25)).normalize();
  const trunk = stemPath(base, lean, H, Math.max(3, Math.ceil(H / 0.9)), 0.08, rng, 0.02);
  const radii = emitStem(F, tree, trunk, r, r * 0.4, key);
  const nb = rng.int(sp.branches[0], sp.branches[1]);
  const mbB = F.batch.get(key, tree.x, tree.z);
  let az = rng.range(0, 6.28);
  let maxR = 1;
  for (let k = 0; k < nb; k++) {
    const t = 0.35 + 0.62 * (k / Math.max(1, nb - 1));
    const ti = Math.min(trunk.length - 1, Math.round(t * (trunk.length - 1)));
    const at = trunk[ti];
    az += 2.4 + rng.range(-0.3, 0.3);
    const out = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const L = sp.spread * rng.range(0.6, 1.1) * (1.1 - 0.4 * t);
    maxR = Math.max(maxR, L);
    // branch rises, arches over and droops at the end
    const bp = [];
    for (let s = 0; s <= 6; s++) {
      const u = s / 6;
      bp.push(at.clone().addScaledVector(out, L * u).add(new THREE.Vector3(0, L * (0.45 * u - 0.6 * u * u), 0)));
    }
    mbB.setColor(tree.barkTint);
    addTube(mbB, bp, bp.map((_, i) => Math.max(0.006, r * 0.45 * (1 - i / 7))), { radial: 4, capEnd: true, windFn: (i) => 0.02 * i });
    // two-ranked (distichous) large shade leaves along the arch, held flat
    const side = new THREE.Vector3(-out.z, 0, out.x);
    for (let s = 2; s <= 6; s++) {
      for (const sd of [-1, 1]) {
        const yd = side.clone().multiplyScalar(sd).addScaledVector(out, 0.35);
        yd.y = -0.1;
        const sz = rng.range(sp.leaf[0], sp.leaf[1]);
        leaf(F, tree, sp.layer, bp[s], yd, UP, sz * sp.aspect, sz, rng.pick(sp.cells), rng, { dark: 0.92 });
      }
    }
    F.crowns.push({ x: bp[4].x, z: bp[4].z, r: Math.max(0.7, L * 0.5), top: bp[3].y + 0.2 });
  }
  const top = trunk[trunk.length - 1];
  for (let j = 0; j < 5; j++) {
    const a = (j / 5) * 6.28 + rng.next();
    const sz = rng.range(sp.leaf[0], sp.leaf[1]);
    leaf(F, tree, sp.layer, top, new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)), UP, sz * sp.aspect, sz, rng.pick(sp.cells), rng);
  }
  finish(F, tree, trunk, radii, new THREE.Vector3(top.x, tree.gy + H * 0.7, top.z), maxR, tree.gy + H + 0.5);
}

// ------------------------------------------------------------------ Leeuwenberg: forking rosettes
export function fork(F, tree, rng, sp) {
  const H = tree.height, r = tree.radius;
  const key = sp.bark;
  const base = new THREE.Vector3(tree.x, tree.gy - 0.2, tree.z);
  const firstLen = H * rng.range(0.45, 0.6);
  const trunk = stemPath(base, new THREE.Vector3(rng.range(-0.1, 0.1), 1, rng.range(-0.1, 0.1)).normalize(), firstLen, 4, 0.04, rng);
  const radii = emitStem(F, tree, trunk, r, r * 0.75, key);
  let maxR = 0.8;
  const tips = [];
  const grow = (p, dir, len, rad, depth) => {
    const pts = stemPath(p, dir, len, 3, 0.05, rng, 0.03);
    const mb = F.batch.get(key, tree.x, tree.z);
    mb.setColor(tree.barkTint);
    addTube(mb, pts, pts.map((_, i) => rad * (1 - 0.2 * i / 3)), { radial: 4, capEnd: true, windFn: (i) => 0.02 * (depth + i / 3) });
    const end = pts[pts.length - 1];
    if (depth >= sp.depth) { tips.push(end); return; }
    const n = rng.chance(0.6) ? 2 : 3;
    const a0 = rng.range(0, 6.28);
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * 6.28;
      const d = new THREE.Vector3(Math.cos(a) * 0.65, 0.8, Math.sin(a) * 0.65).normalize();
      grow(end, d, len * rng.range(0.7, 0.9), rad * 0.7, depth + 1);
    }
    tips.push(end); // older rosettes persist below the new forks
  };
  const rest = H - firstLen;
  grow(trunk[trunk.length - 1], UP.clone(), rest / (sp.depth + 1) * 1.4, r * 0.7, 0);
  for (const tp of tips) {
    const n = rng.int(sp.rosette[0], sp.rosette[1]);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * 6.28 + rng.range(-0.2, 0.2);
      const yd = new THREE.Vector3(Math.cos(a), rng.range(0.0, 0.5), Math.sin(a));
      const sz = rng.range(sp.leaf[0], sp.leaf[1]);
      leaf(F, tree, sp.layer, tp, yd, UP.clone().addScaledVector(yd, 0.3), sz * sp.aspect, sz, rng.pick(sp.cells), rng, { bend: -sz * 0.3 });
    }
    maxR = Math.max(maxR, Math.hypot(tp.x - tree.x, tp.z - tree.z) + sp.leaf[1]);
    F.crowns.push({ x: tp.x, z: tp.z, r: sp.leaf[1] * 1.2, top: tp.y + sp.leaf[1] * 0.4 });
  }
  finish(F, tree, trunk, radii, new THREE.Vector3(tree.x, tree.gy + H * 0.8, tree.z), maxR, tree.gy + H + 0.5);
}

// ------------------------------------------------------------------ Corner: unbranched big-leaf treelet
export function corner(F, tree, rng, sp) {
  const H = tree.height, r = tree.radius;
  const base = new THREE.Vector3(tree.x, tree.gy - 0.15, tree.z);
  const trunk = stemPath(base, new THREE.Vector3(rng.range(-0.15, 0.15), 1, rng.range(-0.15, 0.15)).normalize(), H, Math.max(3, Math.ceil(H / 0.7)), 0.06, rng, 0.03);
  const radii = emitStem(F, tree, trunk, r, r * 0.8, sp.bark, { windFn: (i) => 0.015 * i });
  const top = trunk[trunk.length - 1];
  const n = rng.int(sp.rosette[0], sp.rosette[1]);
  for (let j = 0; j < n; j++) {
    const a = j * 2.39996;
    const young = j > n - 3;
    const yd = new THREE.Vector3(Math.cos(a), young ? 1.2 : rng.range(0.1, 0.6), Math.sin(a));
    const sz = rng.range(sp.leaf[0], sp.leaf[1]) * (young ? 0.7 : 1);
    // leaves hang from the crown on short petioles: base slightly below the tip
    const p = top.clone().add(new THREE.Vector3(0, -0.04 * (j % 4), 0));
    leaf(F, tree, sp.layer, p, yd, UP.clone().addScaledVector(yd, 0.2), sz * sp.aspect, sz, rng.pick(sp.cells), rng, { bend: -sz * 0.45, wind: 0.05 });
  }
  F.crowns.push({ x: top.x, z: top.z, r: sp.leaf[1], top: top.y + sp.leaf[1] * 0.5 });
  finish(F, tree, trunk, radii, top.clone(), sp.leaf[1], top.y + sp.leaf[1] * 0.5);
}

export const ARCHITECTURES = { tiers, troll, fork, corner };

// Species built on these models. Heights in metres; leaf = card size range; layer = card cull group.
export const ARCH_SPECIES = {
  // juvenile emergents & giants: Massart pagodas waiting for a gap
  pole: { arch: 'tiers', bark: 'barkSmooth@near', tint: 0xd0c8b8, h: [9, 19], r: [0.1, 0.22], spread: 3.2, whorl: [3, 5], crownStart: 0.45, leaf: [0.9, 1.4], aspect: 1, cells: [CELL.clusterLight, CELL.clusterDark], layer: 'mid', tints: ['mid', 'yellow'] },
  sapling: { arch: 'tiers', bark: 'barkSmooth@near', tint: 0xc8c0b0, h: [2.2, 7], r: [0.03, 0.07], spread: 1.5, whorl: [3, 4], crownStart: 0.35, leaf: [0.32, 0.6], aspect: 0.6, cells: [CELL.broad, CELL.lance], layer: 'low', tints: ['mid', 'dark', 'flush'] },
  terminalia: { arch: 'tiers', bark: 'barkDark@near', tint: 0xa89888, h: [12, 20], r: [0.18, 0.32], spread: 4.2, whorl: [4, 5], crownStart: 0.5, leaf: [1.0, 1.6], aspect: 1, cells: [CELL.clusterDark, CELL.clusterLight], layer: 'mid', droop: 0.6, tints: ['dark', 'mid', 'olive'] },
  // shade-tolerant understory trees
  shadeTree: { arch: 'troll', bark: 'barkDark@near', tint: 0x9a8a7a, h: [4, 11], r: [0.05, 0.14], spread: 3.0, branches: [4, 7], leaf: [0.35, 0.7], aspect: 0.55, cells: [CELL.broad, CELL.lance, CELL.broad], layer: 'low', tints: ['dark', 'mid', 'blue'] },
  // forking rosette treelets (Schefflera / Tabernaemontana)
  forkTree: { arch: 'fork', bark: 'barkPale@near', tint: 0xb8b0a0, h: [3, 9], r: [0.04, 0.1], depth: 2, rosette: [6, 10], leaf: [0.45, 0.9], aspect: 0.6, cells: [CELL.broad, CELL.heart, CELL.lance], layer: 'low', tints: ['mid', 'dark'] },
  // unbranched big-leaf treelets of the deep shade
  bigLeaf: { arch: 'corner', bark: 'barkPale@near', tint: 0xa0987a, h: [1.2, 4.5], r: [0.025, 0.05], rosette: [9, 15], leaf: [0.7, 1.5], aspect: 0.42, cells: [CELL.paddle, CELL.broad, CELL.lance], layer: 'low', tints: ['dark', 'mid'] },
};

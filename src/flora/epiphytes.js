// Epiphytes living on the trees: tank bromeliads, bird's-nest ferns, orchids, moss cushions,
// bracket fungi, termite nests and hanging beard moss.
import * as THREE from 'three';
import { MeshBuilder, addRibbon, addEllipsoid, addCard, addTube, cardBasis } from '../core/geometry.js';
import { CELL, cellRect } from '../core/textures.js';
import { frondPoints, frondWidths } from './palms.js';
import { RNG } from '../core/rng.js';

const UP = new THREE.Vector3(0, 1, 0);
const C = (h) => new THREE.Color(h);
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();

function rosette(rng, { n, len, width, elev, droop, cell, center, tint, fold = 0.35 }) {
  const mb = new MeshBuilder();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 * 2.618 + rng.range(-0.2, 0.2);
    const ring = i / n;
    const el = elev[0] + (elev[1] - elev[0]) * (1 - ring) + rng.range(-0.1, 0.1);
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    const L = len * rng.range(0.75, 1.1) * (0.7 + 0.3 * ring);
    const pts = frondPoints(new THREE.Vector3(Math.cos(a) * 0.01, 0, Math.sin(a) * 0.01), dir, L, droop / L, 4, rng);
    const v = rng.range(0.85, 1.1);
    mb.setColor(tint ? tint.clone().multiplyScalar(v) : [v, v, v]);
    addRibbon(mb, pts, pts.map((_, k) => width * (k === 0 ? 0.7 : 1) * (1 - Math.pow(k / 4, 3) * 0.6)), cellRect(cell), { fold, windFn: (s) => 0.02 * s });
  }
  return mb;
}

function protoParts(map, M) {
  const parts = [];
  for (const [k, mb] of Object.entries(map)) {
    if (!mb || !mb.count) continue;
    const p = { geometry: mb.toGeometry(), material: M[k] };
    if (k === 'plantLeaf') p.customDepthMaterial = M.depth.plantLeaf;
    parts.push(p);
  }
  return parts;
}

const EPI = {
  bromeliad(rng, kind) {
    const tints = [C(0xffffff), C(0xffc0b0), C(0xd8e0ff), C(0xfff0a0)];
    const leaf = rosette(rng, { n: rng.int(9, 13), len: 0.5, width: 0.055, elev: [1.3, 0.35], droop: 0.25, cell: CELL.strap, tint: tints[kind % 4] });
    const g = new MeshBuilder();
    // water tank + central inflorescence
    g.setColor(C(0x0a0a06));
    addEllipsoid(g, new THREE.Vector3(0, 0.06, 0), 0.05, 0.01, 0.05, { w: 6, h: 2 });
    if (kind === 1 || kind === 3) {
      g.setColor(kind === 1 ? C(0xe02040) : C(0xf08020));
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, a, 0, 'YXZ'));
        addEllipsoid(g, new THREE.Vector3(Math.cos(a) * 0.03, 0.18 + (i % 2) * 0.03, Math.sin(a) * 0.03), 0.018, 0.06, 0.012, { w: 4, h: 3, quat: q });
      }
    }
    return { plantLeaf: leaf, glossy: g };
  },
  birdsnest(rng) {
    return { plantLeaf: rosette(rng, { n: rng.int(10, 15), len: 0.9, width: 0.11, elev: [1.2, 0.5], droop: 0.35, cell: CELL.strap, tint: C(0xb8ffa0), fold: 0.15 }) };
  },
  orchid(rng) {
    const leaf = rosette(rng, { n: 5, len: 0.25, width: 0.035, elev: [0.9, 0.4], droop: 0.1, cell: CELL.strap, tint: C(0xc0ffb0) });
    // flower spray card(s)
    for (let k = 0; k < 2; k++) {
      const a = rng.range(0, 6.28);
      const dir = new THREE.Vector3(Math.cos(a), 0.5, Math.sin(a)).normalize();
      cardBasis(dir, new THREE.Vector3(Math.cos(a + 1.57), 0, Math.sin(a + 1.57)), _X, _Y, _Z);
      leaf.setColor([1, 1, 1]);
      addCard(leaf, new THREE.Vector3(0, 0.05, 0), _X, _Y, 0.35, 0.35, cellRect(CELL.orchid), { bend: -0.05, segX: 1, segY: 2, windBase: 0.0, windTip: 0.03 });
    }
    return { plantLeaf: leaf };
  },
  moss(rng) {
    const g = new MeshBuilder();
    const n = rng.int(3, 6);
    for (let i = 0; i < n; i++) {
      const c = new THREE.Vector3(rng.range(-0.25, 0.25), 0, rng.range(-0.12, 0.12));
      const s = rng.range(0.06, 0.13);
      g.setColor(new THREE.Color(0x3a5a18).lerp(C(0x6a8a28), rng.next()));
      addEllipsoid(g, c, s, s * 0.55, s, { w: 5, h: 4, disp: (x, y, z) => 1 + 0.18 * Math.sin(x * 13 + z * 11) * Math.cos(y * 7) });
    }
    return { plain: g };
  },
  fernlet(rng) {
    // small epiphytic ferns lining a limb
    return { plantLeaf: rosette(rng, { n: rng.int(5, 8), len: 0.4, width: 0.08, elev: [1.0, 0.3], droop: 0.25, cell: CELL.fern, tint: C(0xe8ffd0), fold: 0.2 }) };
  },
  termite(rng) {
    const g = new MeshBuilder();
    g.setColor(C(0x3a2a1c));
    addEllipsoid(g, new THREE.Vector3(0, 0, 0.25), 0.45, 0.6, 0.35, {
      w: 14, h: 10, disp: (x, y, z) => 1 + 0.12 * Math.sin(x * 9 + y * 7) * Math.sin(z * 8 - y * 5) + 0.06 * Math.sin(y * 23 + x * 17),
    });
    return { plain: g };
  },
};

export class Epiphytes {
  constructor({ forest, scatter, materials, cards, batch, terrain, rng, plants }) {
    Object.assign(this, { forest, scatter, M: materials, cards, batch, terrain, rng, plants });
    this.bromeliads = []; // world positions of tank centres (frogs like them)
    this.variants = {};
  }
  register(name, fn, variants, opts = {}) {
    this.variants[name] = [];
    for (let v = 0; v < variants; v++) {
      const id = `epi_${name}${v}`;
      this.scatter.register(id, protoParts(fn(new RNG(5000 + v * 31 + name.length), v), this.M), opts);
      this.variants[name].push(id);
    }
  }
  registerAll() {
    this.register('bromeliad', EPI.bromeliad, 3, { maxDist: 110, castShadow: false });
    this.register('birdsnest', EPI.birdsnest, 2, { maxDist: 120, castShadow: false });
    this.register('orchid', EPI.orchid, 2, { maxDist: 60, castShadow: false });
    this.register('moss', EPI.moss, 2, { maxDist: 60, castShadow: false });
    this.register('fernlet', EPI.fernlet, 2, { maxDist: 60, castShadow: false });
    this.register('termite', EPI.termite, 2, { maxDist: 140 });
  }
  place(name, pos, up, dirHint, scale, color) {
    const id = this.rng.pick(this.variants[name]);
    const y = up.clone().normalize();
    const x = new THREE.Vector3().crossVectors(y, dirHint || new THREE.Vector3(0, 0, 1));
    if (x.lengthSq() < 1e-4) x.set(1, 0, 0);
    x.normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const m = new THREE.Matrix4().makeBasis(x.multiplyScalar(scale), y.multiplyScalar(scale), z.multiplyScalar(scale));
    m.setPosition(pos);
    this.scatter.add(id, m, color);
    return m;
  }

  populate() {
    const rng = this.rng, F = this.forest;
    for (const a of F.attach) {
      const r = rng.next();
      const sideways = new THREE.Vector3(rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25));
      const pos = a.p.clone();
      if (a.kind === 'crotch') {
        this.place('birdsnest', pos, sideways, null, rng.range(1.0, 1.6));
        this.place('bromeliad', pos.clone().add(new THREE.Vector3(0.4, -0.1, 0.2)), sideways, null, rng.range(1.2, 1.8));
        continue;
      }
      if (r < 0.42) {
        const s = rng.range(0.7, 1.5);
        this.place('bromeliad', pos, sideways, a.dir, s);
        this.bromeliads.push(pos.clone().add(new THREE.Vector3(0, 0.06 * s, 0)));
      } else if (r < 0.55) this.place('birdsnest', pos, sideways, a.dir, rng.range(0.8, 1.3));
      else if (r < 0.67) this.place('orchid', pos, sideways, a.dir, rng.range(0.8, 1.4));
      else if (r < 0.85) this.place('moss', pos, UP, a.dir, rng.range(0.8, 1.5) * Math.max(0.6, a.r * 2));
      else this.place('fernlet', pos, sideways, a.dir, rng.range(0.8, 1.3));
    }
    // trunk-dwellers: bromeliads low on trunks, bracket fungi, termite nests
    for (const t of F.trees) {
      if (!t.trunk || t.radius < 0.1) continue;
      const { pts, radii } = t.trunk;
      const top = pts.length - 1;
      const rngT = t.rng;
      const place = (name, hFrac, scale, outward = 0.9) => {
        const fi = hFrac * top, i0 = Math.floor(fi), i1 = Math.min(top, i0 + 1), f = fi - i0;
        const p = pts[i0].clone().lerp(pts[i1], f);
        const r = radii[i0] + (radii[i1] - radii[i0]) * f;
        const a = rngT.range(0, 6.28);
        const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        p.addScaledVector(out, r * outward);
        return { p, out };
      };
      if (rngT.chance(0.8)) {
        const n = rngT.int(1, 3) + Math.floor(t.radius * 2);
        for (let k = 0; k < n; k++) {
          const { p, out } = place('bromeliad', rngT.range(0.08, 0.6), 1);
          const up = out.clone().multiplyScalar(0.6).add(UP);
          const s = rngT.range(0.6, 1.2);
          this.place('bromeliad', p, up, null, s);
          this.bromeliads.push(p.clone().add(new THREE.Vector3(0, 0.06 * s, 0)));
        }
      }
      if (rngT.chance(0.5)) {
        const { p, out } = place('bracket', rngT.range(0.01, 0.12), 1, 0.92);
        p.y = Math.max(p.y, t.gy + 0.25);
        this.placeOutward('bracket', p, out, rngT.range(0.8, 1.6));
      }
      if (rngT.chance(0.07) && t.radius > 0.2) {
        const { p, out } = place('termite', rngT.range(0.1, 0.4), 1, 0.85);
        this.placeOutward('termite', p, out, rngT.range(0.8, 1.4) * Math.min(1.5, t.radius * 2.5));
        // covered termite runway down the trunk
        const mb = this.batch.get('plain', p.x, p.z);
        mb.setColor(C(0x3a2a1c));
        const run = [];
        const a = Math.atan2(out.z, out.x) + 0.3;
        for (let y = p.y - 0.4; y > t.gy - 0.1; y -= 0.5) {
          const rr = this.trunkRadiusAt(t, y) + 0.01;
          const aa = a + Math.sin(y * 0.8) * 0.25;
          run.push(new THREE.Vector3(t.x + Math.cos(aa) * rr, y, t.z + Math.sin(aa) * rr));
        }
        if (run.length > 1) addTube(mb, run, run.map(() => 0.025), { radial: 5 });
      }
      if (t.radius > 0.4) {
        for (let k = 0; k < Math.floor(t.radius * 2.5); k++) {
          const { p, out } = place('moss', rngT.range(0.05, 0.45), 1, 0.95);
          this.place(rngT.chance(0.6) ? 'moss' : 'fernlet', p, out.clone().add(UP), null, rngT.range(0.8, 1.6));
        }
      }
    }
    for (const h of F.hangs) {
      if (rng.chance(0.7)) continue;
      const s = rng.range(0.4, 1.0);
      const a = rng.range(0, 6.28);
      const ydir = new THREE.Vector3(Math.cos(a) * 0.1, -1, Math.sin(a) * 0.1).normalize();
      cardBasis(ydir, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), _X, _Y, _Z);
      const v = rng.range(0.85, 1.1);
      this.cards.add('detail', h.p.clone(), _X, _Y, _Z, s * 0.7, s * 1.4, cellRect(CELL.moss), new THREE.Color(v, v, v), { bend: 0, fold: 0, wind: 0.06 }, _Z.clone());
    }
  }
  placeOutward(name, pos, out, scale) {
    const id = this.rng.pick(this.variants[name] || this.plants.variants[name]);
    const z = out.clone().normalize();
    const x = new THREE.Vector3().crossVectors(UP, z).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    const m = new THREE.Matrix4().makeBasis(x.multiplyScalar(scale), y.multiplyScalar(scale), z.multiplyScalar(scale));
    m.setPosition(pos);
    this.scatter.add(id, m, null);
  }
  trunkRadiusAt(t, y) {
    const { pts, radii } = t.trunk;
    for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1].y >= y) return radii[i];
    return radii[radii.length - 1];
  }
}

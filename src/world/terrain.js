// Forest terrain: rolling hills and ridges, a sandstone escarpment, a blackwater river with
// bluffs, a creek that falls over the escarpment into a plunge pool and cuts a ravine to the
// river, sinkhole ponds, and a cave tunnelled into the cliff.
import * as THREE from 'three';
import { createNoise } from '../core/noise.js';
import { smoothstep, lerp } from '../core/rng.js';
import { WORLD } from '../core/shared.js';
import { patchMaterial } from '../core/shaders.js';

const ESCARP_H = 9.5;

export class Terrain {
  constructor(seed = 21) {
    this.nz = createNoise(seed);
    this.ponds = [
      { x: 42, z: -30, r: 6.5 }, { x: -62, z: 44, r: 7.5 }, { x: 72, z: 58, r: 5.5 }, { x: -70, z: 5, r: 5 },
    ];
    this.cave = { x: 15, len: 15, hw: 3.4, arch: 3.6 };
    this.buildCreek();
    for (const p of this.ponds) { // water sits a little below the lowest point of the rim
      let m = Infinity;
      for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.28; m = Math.min(m, this.baseHeight(p.x + Math.cos(a) * p.r * 1.3, p.z + Math.sin(a) * p.r * 1.3)); }
      p.level = m - 0.35;
    }
    const c = this.cave;
    c.zMouth = this.escarpZ(c.x) + 3.2;            // toe of the cliff
    c.floor = this.baseHeight(c.x, c.zMouth + 3) + 0.05;
    c.top = this.baseHeight(c.x, c.zMouth - c.len - 4);
  }

  // ---------------------------------------------------------------- big landforms
  riverZ(x) { return 20 * Math.sin(x * 0.021 + 0.6) + 8 * Math.sin(x * 0.057 + 2.0) + 2.5 * Math.sin(x * 0.13 + 1.1) - 4; }
  riverHalfWidth(x) { return 6.5 + 2.2 * Math.sin(x * 0.031 + 1) + 1.2 * Math.sin(x * 0.093 + 0.3); }
  riverDist(x, z) {
    const rz = this.riverZ(x);
    const d = this.riverZ(x + 0.5) - this.riverZ(x - 0.5);
    return Math.abs(z - rz) / Math.sqrt(1 + d * d);
  }
  escarpZ(x) { return -58 + 9 * Math.sin(x * 0.035 + 1) + 3 * Math.sin(x * 0.11); }

  // uncarved landform (hills + escarpment); also used by the distant forest ring
  baseHeight(x, z) {
    const n = this.nz;
    let h = 2.4 + n.fbm2(x * 0.011, z * 0.011, 4) * 3.0 + n.fbm2(x * 0.045 + 10, z * 0.045, 3) * 0.8;
    h += n.noise2(x * 0.19, z * 0.19) * 0.08;
    // ridged hills north of the river
    const north = smoothstep(12, 45, z - this.riverZ(x));
    const ridge = 1 - Math.abs(n.fbm2(x * 0.018 + 40, z * 0.018 - 7, 3));
    h += north * (Math.pow(ridge, 2.2) * 9 + n.fbm2(x * 0.03, z * 0.03 + 9, 2) * 2.5);
    // knolls everywhere
    h += Math.max(0, n.noise2(x * 0.05 + 3, z * 0.05 - 2) - 0.35) * 5;
    // sandstone escarpment: plateau to the south, jagged cliff edge, lower terrace beyond
    const ez = this.escarpZ(x) + n.noise2(x * 0.25, 7.7) * 1.4 + n.noise2(x * 0.9, 3.1) * 0.4;
    h += ESCARP_H * smoothstep(ez + 1.6, ez - 1.6, z);
    const ez2 = ez - 32 + 6 * Math.sin(x * 0.05);
    h += 4 * smoothstep(ez2 + 5, ez2 - 5, z);
    return h;
  }

  // ---------------------------------------------------------------- creek
  buildCreek() {
    const ctrl = [[-46, -128], [-40, -104], [-33, -84], [-29, -68], [-28, -60], [-27, -53], [-24, -45], [-21, -37], [-24, -28], [-20, -18], [-17, -8], [-15, -1], [-14, 6]];
    const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const len = curve.getLength();
    const n = Math.ceil(len);
    const P = curve.getSpacedPoints(n);
    const cr = { x: [], z: [], s: [], bed: [], w: [], water: [], n: P.length };
    for (let i = 0; i < P.length; i++) { cr.x.push(P[i].x); cr.z.push(P[i].z); cr.s.push((i / n) * len); }
    // bed: follow the land, always running downhill, into the river
    const raw = cr.x.map((x, i) => this.baseHeight(x, cr.z[i]));
    const sm = raw.map((_, i) => { let s = 0, c = 0; for (let k = -3; k <= 3; k++) { const j = i + k; if (j >= 0 && j < raw.length) { s += raw[j]; c++; } } return s / c; });
    let m = Infinity;
    for (let i = 0; i < sm.length; i++) {
      m = Math.min(m, sm[i] - 1.3);
      const toMouth = (cr.n - 1 - i);
      cr.bed.push(lerp(-1.2, m, smoothstep(0, 14, toMouth)));
    }
    // the lip is where the bed falls fastest (the escarpment)
    let lip = 0, best = 0;
    for (let i = 2; i < cr.n - 2; i++) { const d = cr.bed[i - 2] - cr.bed[i + 2]; if (d > best) { best = d; lip = i; } }
    cr.lip = lip;
    // water surface: pools fill to their downstream lip
    for (let i = 0; i < cr.n; i++) cr.water.push(cr.bed[i] + 0.35);
    for (let i = 1; i < cr.n; i++) cr.water[i] = Math.min(cr.water[i], cr.water[i - 1]);
    // plunge pool under the falls, and two quieter pools downstream
    cr.pools = [{ i: lip + 7, r: 6, d: 1.8, wide: 3.2 }, { i: Math.round(lip + (cr.n - lip) * 0.45), r: 4, d: 0.9, wide: 2 }, { i: Math.round(lip * 0.5), r: 4, d: 0.8, wide: 2 }];
    for (let i = 0; i < cr.n; i++) {
      let w = 1.5 + 0.5 * Math.sin(cr.s[i] * 0.13);
      for (const p of cr.pools) {
        const f = Math.max(0, 1 - Math.abs(i - p.i) / p.r);
        w *= 1 + (p.wide - 1) * smoothstep(0, 1, f);
        cr.bed[i] -= p.d * smoothstep(0, 1, f);
      }
      cr.w.push(w);
    }
    // pool water levels: hold the level across the pool
    for (const p of cr.pools) {
      const lv = cr.water[Math.min(cr.n - 1, p.i + p.r)];
      for (let i = Math.max(0, p.i - p.r); i <= Math.min(cr.n - 1, p.i + p.r); i++) if (i > lip + 1 || p.i < lip) cr.water[i] = Math.max(cr.water[i], Math.min(lv, cr.water[i]));
    }
    // spatial index
    cr.grid = new Map();
    for (let i = 0; i < cr.n; i++) {
      const k = (Math.floor(cr.x[i] / 8) + 500) * 1000 + Math.floor(cr.z[i] / 8) + 500;
      let a = cr.grid.get(k); if (!a) { a = []; cr.grid.set(k, a); } a.push(i);
    }
    this.creek = cr;
  }
  // nearest creek sample: { d, i, f } (f = fractional index for smooth interpolation)
  creekNear(x, z) {
    const cr = this.creek;
    const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
    let best = Infinity, bi = -1;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const a = cr.grid.get((gx + dx + 500) * 1000 + gz + dz + 500); if (!a) continue;
      for (const i of a) { const d = (cr.x[i] - x) ** 2 + (cr.z[i] - z) ** 2; if (d < best) { best = d; bi = i; } }
    }
    if (bi < 0) return null;
    // project onto the neighbouring segment for a smooth distance
    let d = Math.sqrt(best), f = bi;
    for (const j of [bi - 1, bi + 1]) {
      if (j < 0 || j >= cr.n) continue;
      const ax = cr.x[bi], az = cr.z[bi], bx = cr.x[j], bz = cr.z[j];
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
      const px = ax + vx * t, pz = az + vz * t;
      const dd = Math.hypot(x - px, z - pz);
      if (dd < d) { d = dd; f = bi + (j - bi) * t; }
    }
    return { d, f };
  }
  creekAt(arr, f) {
    const i0 = Math.max(0, Math.min(this.creek.n - 1, Math.floor(f))), i1 = Math.min(this.creek.n - 1, i0 + 1);
    return lerp(arr[i0], arr[i1], f - i0);
  }

  // ---------------------------------------------------------------- final height
  height(x, z) {
    let h = this.baseHeight(x, z);
    // river valley with bluffs
    const d = this.riverDist(x, z), w = this.riverHalfWidth(x);
    const t = smoothstep(w * 0.45, w + 7.5, d);
    const bed = -1.9 + 0.5 * smoothstep(0, w, d);
    h = lerp(bed, h, t);
    // creek ravine: a channel with steep rocky walls
    const c = this.creekNear(x, z);
    if (c && c.d < 40) {
      const cr = this.creek;
      const cb = this.creekAt(cr.bed, c.f), cw = this.creekAt(cr.w, c.f);
      const rough = this.nz.noise2(x * 0.35, z * 0.35) * 0.5;
      const wall = cb + 0.35 + Math.pow(Math.max(0, c.d - cw), 1.25) * (1.7 + rough) + rough * 0.6;
      const chan = cb - 0.45 * (1 - smoothstep(0, cw, c.d));
      h = Math.min(h, c.d < cw ? Math.min(chan, wall) : wall);
    }
    // sinkhole ponds
    for (const p of this.ponds) {
      const dd = Math.hypot(x - p.x, z - p.z);
      if (dd < p.r * 2.2) h = Math.min(h, p.level + ((dd / p.r) ** 2 - 1) * 1.6 + 0.3);
    }
    // cave: carve a slot under the escarpment (the rock roof is a separate mesh)
    const cv = this.cave;
    if (cv.zMouth !== undefined) {
      const ax = Math.abs(x - cv.x), inZ = cv.zMouth - z;
      if (ax < cv.hw + 1 && inZ > -2 && inZ < cv.len + 1) {
        const f = smoothstep(cv.hw + 1, cv.hw - 0.4, ax) * smoothstep(-2, 0.5, inZ) * smoothstep(cv.len + 1, cv.len - 1, inZ);
        h = lerp(h, Math.min(h, cv.floor + inZ * 0.03), f);
      }
    }
    return h;
  }

  // water surface height at (x, z) or -Infinity (river = 0, creek, ponds)
  waterAt(x, z) {
    let y = -Infinity;
    if (this.riverDist(x, z) < this.riverHalfWidth(x) + 2) y = WORLD.waterLevel;
    const c = this.creekNear(x, z);
    if (c && c.d < this.creekAt(this.creek.w, c.f) * 1.05 && Math.abs(c.f - this.creek.lip) > 2) y = Math.max(y, this.creekAt(this.creek.water, c.f));
    for (const p of this.ponds) if (Math.hypot(x - p.x, z - p.z) < p.r * 1.05) y = Math.max(y, p.level);
    return y;
  }
  // signed distance to any water's edge (negative = in water)
  bankDist(x, z) {
    let d = this.riverDist(x, z) - this.riverHalfWidth(x) - 0.8;
    const c = this.creekNear(x, z);
    if (c) d = Math.min(d, c.d - this.creekAt(this.creek.w, c.f) - 0.4);
    for (const p of this.ponds) d = Math.min(d, Math.hypot(x - p.x, z - p.z) - p.r - 0.4);
    return d;
  }
  normal(x, z, out = new THREE.Vector3()) {
    const e = 0.4;
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
  slopeY(x, z) { return this.normal(x, z).y; }
  inCave(x, z) { const c = this.cave; return Math.abs(x - c.x) < c.hw + 2 && c.zMouth - z > -3 && c.zMouth - z < c.len + 2; }
  isWater(x, z) { return this.height(x, z) < this.waterAt(x, z); }

  // ---------------------------------------------------------------- mesh
  build(tex) {
    const S = WORLD.size, seg = 420;
    const g = new THREE.PlaneGeometry(S, S, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position'), uv = g.getAttribute('uv');
    const n = pos.count;
    const col = new Float32Array(n * 3), wet = new Float32Array(n);
    const mossC = new THREE.Color(0x6f8a3a), litC = new THREE.Color(0xffffff), darkC = new THREE.Color(0x8a7a6a);
    const c = new THREE.Color();
    const cv = this.cave;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      uv.setXY(i, x / 1.7, z / 1.7);
      const wl = this.waterAt(x, z);
      wet[i] = isFinite(wl) ? 1 - smoothstep(wl - 0.1, wl + 0.9, h) : 0;
      const m = smoothstep(0.25, 0.6, this.nz.fbm2(x * 0.03 + 50, z * 0.03, 3));
      c.copy(litC).lerp(darkC, smoothstep(0.2, 0.8, this.nz.noise2(x * 0.07, z * 0.07) * 0.5 + 0.5) * 0.6).lerp(mossC, m * 0.55);
      // darkness inside the cave
      const inCave = smoothstep(cv.hw + 1, cv.hw - 1, Math.abs(x - cv.x)) * smoothstep(0, 4, cv.zMouth - z) * smoothstep(cv.len + 2, cv.len - 2, cv.zMouth - z);
      c.multiplyScalar(1 - 0.75 * inCave);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aWet', new THREE.BufferAttribute(wet, 1));
    g.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: tex.litter.map, normalMap: tex.litter.normalMap, normalScale: new THREE.Vector2(1.4, 1.4),
      vertexColors: true, roughness: 0.92,
    });
    patchMaterial(mat, {
      key: 'terrain',
      uniforms: { uRock: { value: tex.rock.map } },
      vertexHead: 'attribute float aWet;\nvarying float vWet;\n',
      vertexBegin: 'vWet = aWet;\n',
      fragHead: 'varying float vWet;\nuniform sampler2D uRock;\nfloat vSteep = 0.0;\n',
      fragColor: `
      {
        vec3 wP = cameraPosition + (-vViewPosition) * mat3(viewMatrix);
        vec3 wN = normalize(vNormal * mat3(viewMatrix));
        float nn = texture2D(uNoiseTex, wP.xz * 0.015).r;
        vec3 l2 = texture2D(map, vMapUv * 0.41 + vec2(0.31, 0.71)).rgb * vColor.rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, l2, smoothstep(0.4, 0.6, nn));
        // steep ground turns to mossy sandstone (triplanar)
        vec3 bw = pow(abs(wN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 rock = texture2D(uRock, wP.zy * 0.18).rgb * bw.x + texture2D(uRock, wP.xz * 0.18).rgb * bw.y + texture2D(uRock, wP.xy * 0.18).rgb * bw.z;
        float rn = texture2D(uNoiseTex, wP.xz * 0.05 + wP.y * 0.04).g;
        rock = mix(rock, vec3(0.07, 0.12, 0.03), smoothstep(0.45, 0.7, rn) * 0.7) * vColor.rgb;
        vSteep = smoothstep(0.78, 0.55, wN.y + (rn - 0.5) * 0.15);
        diffuseColor.rgb = mix(diffuseColor.rgb, rock, vSteep);
        vec3 mud = mix(vec3(0.045, 0.032, 0.02), vec3(0.09, 0.07, 0.045), texture2D(uNoiseTex, wP.xz * 0.2).g);
        diffuseColor.rgb = mix(diffuseColor.rgb, mud, smoothstep(0.0, 0.7, vWet) * (1.0 - vSteep * 0.6));
      }`,
      fragRough: 'roughnessFactor = mix(mix(roughnessFactor, 0.5, smoothstep(0.3, 1.0, vWet)), 0.8, vSteep);',
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'terrain';
    this.mesh = mesh;
    this.heightTex = this.buildHeightTexture();
    return mesh;
  }

  buildHeightTexture() {
    const N = 512, S = WORLD.size, cs = S / N;
    const data = new Uint16Array(N * N * 4);
    const H = new Float32Array(N * N);
    const X = (i) => -WORLD.half + (i + 0.5) * cs;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = this.height(X(i), X(j));
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = X(i), z = X(j), k = (j * N + i) * 4, h = H[j * N + i];
      const hx = H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)];
      const hz = H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i];
      const ny = 2 * cs / Math.hypot(hx, 2 * cs, hz);
      data[k] = THREE.DataUtils.toHalfFloat(h);
      const wl = this.waterAt(x, z);
      data[k + 1] = THREE.DataUtils.toHalfFloat(isFinite(wl) && h < wl + 0.1 ? 1 : 0);
      data[k + 2] = THREE.DataUtils.toHalfFloat(this.bankDist(x, z));
      data[k + 3] = THREE.DataUtils.toHalfFloat(ny);
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }
}

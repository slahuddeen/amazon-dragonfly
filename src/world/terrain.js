// Forest floor heightfield with a meandering blackwater river.
import * as THREE from 'three';
import { createNoise } from '../core/noise.js';
import { smoothstep, lerp } from '../core/rng.js';
import { WORLD } from '../core/shared.js';
import { patchMaterial } from '../core/shaders.js';

export class Terrain {
  constructor(seed = 21) {
    this.nz = createNoise(seed);
  }
  riverZ(x) {
    return 20 * Math.sin(x * 0.021 + 0.6) + 8 * Math.sin(x * 0.057 + 2.0) + 2.5 * Math.sin(x * 0.13 + 1.1) - 4;
  }
  riverHalfWidth(x) {
    return 6.5 + 2.2 * Math.sin(x * 0.031 + 1) + 1.2 * Math.sin(x * 0.093 + 0.3);
  }
  riverDist(x, z) {
    const rz = this.riverZ(x);
    const d = this.riverZ(x + 0.5) - this.riverZ(x - 0.5);
    return Math.abs(z - rz) / Math.sqrt(1 + d * d);
  }
  // signed distance to the water's edge (negative = in water)
  bankDist(x, z) { return this.riverDist(x, z) - this.riverHalfWidth(x) - 0.8; }

  baseHeight(x, z) {
    const n = this.nz;
    let h = 2.4 + n.fbm2(x * 0.011, z * 0.011, 4) * 3.0 + n.fbm2(x * 0.045 + 10, z * 0.045, 3) * 0.6;
    h += n.noise2(x * 0.19, z * 0.19) * 0.07;
    return h;
  }
  height(x, z) {
    let h = this.baseHeight(x, z);
    const d = this.riverDist(x, z), w = this.riverHalfWidth(x);
    const t = smoothstep(w * 0.45, w + 7.5, d);
    const bed = -1.9 + 0.5 * smoothstep(0, w, d);
    h = lerp(bed, h, t);
    return h;
  }
  normal(x, z, out = new THREE.Vector3()) {
    const e = 0.4;
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
  isWater(x, z) { return this.height(x, z) < 0.05; }

  build(tex) {
    const S = WORLD.size, seg = 300;
    const g = new THREE.PlaneGeometry(S, S, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position'), uv = g.getAttribute('uv');
    const n = pos.count;
    const col = new Float32Array(n * 3), wet = new Float32Array(n);
    const mossC = new THREE.Color(0x6f8a3a), litC = new THREE.Color(0xffffff), darkC = new THREE.Color(0x8a7a6a);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      uv.setXY(i, x / 1.7, z / 1.7);
      const w = 1 - smoothstep(-0.1, 0.9, h);
      wet[i] = w;
      const m = smoothstep(0.25, 0.6, this.nz.fbm2(x * 0.03 + 50, z * 0.03, 3));
      c.copy(litC).lerp(darkC, smoothstep(0.2, 0.8, this.nz.noise2(x * 0.07, z * 0.07) * 0.5 + 0.5) * 0.6).lerp(mossC, m * 0.55);
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
      vertexHead: 'attribute float aWet;\nvarying float vWet;\n',
      vertexBegin: 'vWet = aWet;\n',
      fragHead: 'varying float vWet;\n',
      fragColor: `
      {
        vec3 wP = cameraPosition + (-vViewPosition) * mat3(viewMatrix);
        float nn = texture2D(uNoiseTex, wP.xz * 0.015).r;
        vec3 l2 = texture2D(map, vMapUv * 0.41 + vec2(0.31, 0.71)).rgb * vColor.rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, l2, smoothstep(0.4, 0.6, nn));
        vec3 mud = mix(vec3(0.045, 0.032, 0.02), vec3(0.09, 0.07, 0.045), texture2D(uNoiseTex, wP.xz * 0.2).g);
        diffuseColor.rgb = mix(diffuseColor.rgb, mud, smoothstep(0.0, 0.7, vWet));
      }`,
      fragRough: 'roughnessFactor = mix(roughnessFactor, 0.5, smoothstep(0.3, 1.0, vWet));',
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.mesh = mesh;
    this.heightTex = this.buildHeightTexture();
    return mesh;
  }

  buildHeightTexture() {
    const N = 512, S = WORLD.size;
    const data = new Uint16Array(N * N * 4);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -WORLD.half + (i + 0.5) / N * S, z = -WORLD.half + (j + 0.5) / N * S;
      const h = this.height(x, z);
      const k = (j * N + i) * 4;
      data[k] = THREE.DataUtils.toHalfFloat(h);
      data[k + 1] = THREE.DataUtils.toHalfFloat(1 - smoothstep(0.0, 0.35, h));
      data[k + 2] = THREE.DataUtils.toHalfFloat(this.bankDist(x, z));
      data[k + 3] = THREE.DataUtils.toHalfFloat(1);
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }
}

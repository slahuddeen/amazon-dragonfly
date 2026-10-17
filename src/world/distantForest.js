// The endless canopy beyond the playable area: a polar heightfield of lumpy tree crowns,
// with the river valley cut through it so the river runs on to the horizon.
import * as THREE from 'three';
import { createNoise } from '../core/noise.js';
import { smoothstep } from '../core/rng.js';
import { patchMaterial } from '../core/shaders.js';

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createDistantForest(terrain, atlas, inner = 110) {
  const nz = createNoise(99);
  const rings = [];
  // wall + canopy rings, geometric spacing outward
  for (let i = 0; i <= 6; i++) rings.push(inner + i * 2);
  let r = rings[rings.length - 1], step = 1.6;
  while (r < 1600) { r += step; step *= 1.045; rings.push(r); }
  const seg = 720;

  const crown = (x, z) => {
    const cs = 8.5;
    const gx = x / cs, gz = z / cs;
    const xi = Math.floor(gx), zi = Math.floor(gz);
    let d1 = 9, d2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cz = zi + j;
      const px = cx + hash2(cx, cz), pz = cz + hash2(cz + 17.3, cx - 3.1);
      const big = hash2(cx * 3.3, cz * 1.7) > 0.93 ? 1.6 : 1;
      const d = Math.hypot(px - gx, pz - gz) / big;
      if (d < d1) { d2 = d1; d1 = d; id = hash2(cx + 0.5, cz + 0.25) + (big > 1 ? 10 : 0); }
      else if (d < d2) d2 = d;
    }
    return { d1, d2, id };
  };

  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  const greens = [0x2f5a1e, 0x3c6a24, 0x4a7a2a, 0x2a4e1c, 0x5a8430, 0x35602a, 0x6a8f3a].map((h) => new THREE.Color(h));
  const pink = new THREE.Color(0xd070a8), yellow = new THREE.Color(0xe8c030), silver = new THREE.Color(0x8aa078);

  for (let ri = 0; ri < rings.length; ri++) {
    const R = rings[ri];
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const { d1, d2, id } = crown(x, z);
      const isBig = id >= 10, cid = id % 1;
      const dome = Math.sqrt(Math.max(0, 1 - Math.pow(d1 / (isBig ? 0.9 : 0.72), 2)));
      let h = 28 + nz.fbm2(x * 0.004, z * 0.004, 3) * 5 + dome * (isBig ? 13 : 5.5) + nz.noise2(x * 0.3, z * 0.3) * 0.9 + nz.noise2(x * 0.9, z * 0.9) * 0.35;
      const edge = smoothstep(0.0, 0.18, d2 - d1); // crevices between crowns
      h -= (1 - edge) * 2.2;
      // wall at the inner edge
      const wallT = smoothstep(inner, inner + 12, R);
      const ground = terrain.baseHeight(x, z) - 0.5;
      h = ground + (h - ground) * wallT;
      // river valley
      const rd = terrain.riverDist(x, z) - terrain.riverHalfWidth(x);
      const cut = smoothstep(2, 14, rd);
      h = -2 + (h + 2) * cut;
      pos.push(x, h, z);
      // colour
      c.copy(greens[Math.floor(cid * greens.length) % greens.length]);
      if (cid > 0.965) c.copy(pink); else if (cid > 0.94) c.copy(yellow); else if (cid > 0.9) c.copy(silver);
      c.multiplyScalar(0.55 + 0.45 * edge * (0.7 + 0.3 * dome));
      if (R < inner + 12) c.multiplyScalar(0.35);
      if (cut < 1) c.lerp(new THREE.Color(0x2a3a1a), 1 - cut);
      col.push(c.r, c.g, c.b);
    }
  }
  const W = seg + 1;
  for (let ri = 0; ri < rings.length - 1; ri++) for (let s = 0; s < seg; s++) {
    const a = ri * W + s, b = a + 1, d = a + W, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  // leafy detail: the canopy-cluster atlas cells projected from above at two scales
  const cl = [0.25, 0.75], cd = [0.5, 0.75];
  patchMaterial(mat, {
    key: 'distant',
    translucent: 0.4,
    uniforms: { uAtlas: { value: atlas } },
    fragHead: 'uniform sampler2D uAtlas;',
    fragColor: `
    {
      vec3 wP = cameraPosition + (-vViewPosition) * mat3(viewMatrix);
      vec2 q1 = wP.xz / 3.2 + vec2(wP.y * 0.05);
      vec2 q2 = wP.xz / 7.5 + 0.37;
      vec4 a1 = textureGrad(uAtlas, vec2(${cl[0]}, ${cl[1]}) + fract(q1) * 0.248, dFdx(q1) * 0.248, dFdy(q1) * 0.248);
      vec4 a2 = textureGrad(uAtlas, vec2(${cd[0]}, ${cd[1]}) + fract(q2) * 0.248, dFdx(q2) * 0.248, dFdy(q2) * 0.248);
      float l1 = mix(0.35, 1.0, a1.a) * (0.6 + 1.6 * dot(a1.rgb, vec3(0.3, 0.6, 0.1)));
      float l2 = mix(0.45, 1.0, a2.a) * (0.6 + 1.6 * dot(a2.rgb, vec3(0.3, 0.6, 0.1)));
      float n1 = texture2D(uNoiseTex, wP.xz * 0.05).b;
      diffuseColor.rgb *= mix(l1, l2, 0.45) * (0.75 + 0.5 * n1);
    }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'distantForest';
  return mesh;
}

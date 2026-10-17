// Blackwater river: planar reflection (Reflector) with ripples, fresnel and sun glints.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { SUN_DIR, U, QUALITY, WORLD } from '../core/shared.js';

const shader = {
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uTime: { value: 0 }, uNoiseTex: { value: null }, uSun: { value: SUN_DIR.clone() },
  }]),
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUvR;
    varying vec3 vWPos;
    #include <fog_pars_vertex>
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWPos = wp.xyz;
      vUvR = textureMatrix * vec4(position, 1.0);
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D uNoiseTex;
    uniform float uTime;
    uniform vec3 uSun;
    varying vec4 vUvR;
    varying vec3 vWPos;
    #include <common>
    #include <fog_pars_fragment>
    vec2 ripple(vec2 p) {
      vec2 a = texture2D(uNoiseTex, p * 0.05 + vec2(uTime * 0.006, uTime * 0.004)).rg;
      vec2 b = texture2D(uNoiseTex, p * 0.13 - vec2(uTime * 0.01, -uTime * 0.007)).ba;
      vec2 c = texture2D(uNoiseTex, p * 0.6 + vec2(uTime * 0.03, uTime * 0.02)).rg;
      return (a - 0.5) * 0.6 + (b - 0.5) * 0.35 + (c - 0.5) * 0.12;
    }
    void main() {
      vec2 rp = ripple(vWPos.xz);
      vec3 N = normalize(vec3(rp.x * 0.35, 1.0, rp.y * 0.35));
      vec3 V = normalize(cameraPosition - vWPos);
      vec4 uv = vUvR;
      uv.xy += N.xz * 0.06 * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
      vec3 deep = vec3(0.018, 0.012, 0.006);
      vec3 col = mix(deep, refl, clamp(fres * 0.85 + 0.12, 0.0, 1.0));
      vec3 H = normalize(uSun + V);
      float spec = pow(max(dot(N, H), 0.0), 420.0) * 30.0;
      col += vec3(1.0, 0.9, 0.7) * spec;
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }`,
};

export function createWater(terrain) {
  // strip of water following the river, extending far beyond the world edge
  const g = new THREE.BufferGeometry();
  const pos = [], idx = [];
  const x0 = -1600, x1 = 1600;
  let i = 0;
  for (let x = x0; x <= x1; x += x > -160 && x < 160 ? 2 : 20) {
    const z = terrain.riverZ(x), w = terrain.riverHalfWidth(x) + 9;
    pos.push(x, -(z - w), 0, x, -(z + w), 0);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    i++;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const s = QUALITY.reflect;
  const water = new Reflector(g, {
    textureWidth: Math.floor(window.innerWidth * s), textureHeight: Math.floor(window.innerHeight * s),
    clipBias: 0.02, shader, multisample: 0,
  });
  water.material.fog = true;
  water.material.uniforms.uTime = U.uTime;
  water.material.uniforms.uNoiseTex = U.uNoiseTex;
  water.rotation.x = -Math.PI / 2; // local +Z (reflector normal) -> world +Y
  water.material.side = THREE.DoubleSide;
  water.position.y = WORLD.waterLevel;
  water.name = 'water';
  water.userData.terrain = terrain;
  return water;
}

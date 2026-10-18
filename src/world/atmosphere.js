// Light shafts through canopy gaps, sunlit dust motes and low mist.
import * as THREE from 'three';
import { SUN_DIR, U, WORLD } from '../core/shared.js';
import { buildSoftSprite } from '../core/textures.js';

export function createGodRays(forest, terrain, rng) {
  const shafts = [];
  const R = WORLD.radius - 5;
  for (let i = 0; i < 6000 && shafts.length < 34; i++) {
    const x = rng.range(-R, R), z = rng.range(-R, R);
    if (Math.hypot(x, z) > R) continue;
    const c = forest.coverAt(x, z);
    if (c > 0.4) continue;
    let around = 0;
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; around += forest.coverAt(x + Math.cos(a) * 7, z + Math.sin(a) * 7); }
    around /= 6;
    if (around < 0.55) continue; // need a real hole, not open river
    if (shafts.some((s) => Math.hypot(s.x - x, s.z - z) < 8)) continue;
    const topY = Math.max(18, forest.topAt(x, z) - 4);
    shafts.push({ x, z, topY, w: rng.range(1.2, 3.2) * (1 - c) });
  }
  const count = shafts.length * 3;
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1, 1, 8); base.translate(0, 0.5, 0);
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  const aTop = new Float32Array(count * 3), aBot = new Float32Array(count * 3), aW = new Float32Array(count * 2);
  let k = 0;
  for (const s of shafts) {
    const top = new THREE.Vector3(s.x, s.topY, s.z);
    const t = (s.topY - 0) / SUN_DIR.y;
    const bot = top.clone().addScaledVector(SUN_DIR, -t);
    bot.y = terrain.height(bot.x, bot.z);
    for (let l = 0; l < 3; l++) {
      aTop.set([top.x, top.y, top.z], k * 3); aBot.set([bot.x, bot.y, bot.z], k * 3);
      aW[k * 2] = s.w * [0.5, 1.0, 1.9][l]; aW[k * 2 + 1] = rng.next() * 10;
      k++;
    }
  }
  geo.setAttribute('aTop', new THREE.InstancedBufferAttribute(aTop, 3));
  geo.setAttribute('aBot', new THREE.InstancedBufferAttribute(aBot, 3));
  geo.setAttribute('aW', new THREE.InstancedBufferAttribute(aW, 2));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uNoiseTex: U.uNoiseTex, uSun: { value: SUN_DIR.clone() }, uIntensity: { value: 0.11 } },
    vertexShader: `
      attribute vec3 aTop; attribute vec3 aBot; attribute vec2 aW;
      varying vec2 vUv; varying float vSeed; varying vec3 vWorld; varying float vW;
      void main() {
        vec3 axis = aBot - aTop;
        vec3 p = aTop + axis * position.y;
        vec3 sd = cross(axis, cameraPosition - p);
        vec3 side = dot(sd, sd) > 1e-8 ? normalize(sd) : vec3(1.0, 0.0, 0.0);
        vec3 wp = p + side * position.x * aW.x;
        vUv = vec2(position.x + 0.5, position.y);
        vSeed = aW.y; vWorld = wp; vW = aW.x;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uNoiseTex; uniform vec3 uSun; uniform float uIntensity;
      varying vec2 vUv; varying float vSeed; varying vec3 vWorld; varying float vW;
      void main() {
        float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
        float a = pow(across, 1.6);
        a *= smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y) * 0.7);
        float n = texture2D(uNoiseTex, vec2(vUv.x * 0.35 + vSeed, vUv.y * 0.6 - uTime * 0.012)).r;
        float n2 = texture2D(uNoiseTex, vec2(vUv.x * 0.8 - vSeed, vUv.y * 1.5 + uTime * 0.02)).g;
        a *= 0.45 + 0.9 * n * n2;
        vec3 V = normalize(vWorld - cameraPosition);
        float dist = length(vWorld - cameraPosition);
        a *= smoothstep(0.5, 5.0, dist) * (1.0 - smoothstep(55.0, 110.0, dist));
        a *= 0.35 + 1.4 * pow(max(dot(V, -uSun) * -1.0, 0.0), 3.0);
        a *= 1.0 / (0.6 + vW * 0.25);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * a * uIntensity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.name = 'godrays';
  mesh.userData.shafts = shafts;
  return mesh;
}

export function createMotes(count = 2500) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), s = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = Math.random() * 24; p[i * 3 + 1] = Math.random() * 14; p[i * 3 + 2] = Math.random() * 24;
    s[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uSun: { value: SUN_DIR.clone() }, uPix: { value: 1 } },
    vertexShader: `
      uniform float uTime; uniform vec3 uCam; uniform float uPix;
      attribute float aSeed;
      varying float vA; varying vec3 vW;
      void main() {
        vec3 box = vec3(24.0, 14.0, 24.0);
        vec3 base = uCam - box * vec3(0.5, 0.35, 0.5);
        vec3 drift = vec3(sin(uTime * 0.13 + aSeed * 40.0), sin(uTime * 0.21 + aSeed * 17.0) * 0.6 + 0.15 * uTime * (aSeed - 0.4), cos(uTime * 0.11 + aSeed * 31.0)) * 0.8;
        vec3 wp = base + mod(position + drift - base, box);
        vW = wp;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        float d = -mv.z;
        vA = smoothstep(13.0, 6.0, d) * smoothstep(0.6, 2.0, d);
        gl_PointSize = clamp(uPix * (0.6 + aSeed * 1.6) * 9.0 / max(d, 0.1), 1.0, 4.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uSun; varying float vA; varying vec3 vW;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c));
        vec3 V = normalize(vW - cameraPosition);
        float fwd = pow(max(dot(V, uSun), 0.0), 4.0);
        float lit = 0.25 + 2.5 * fwd;
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.75) * a * vA * lit * 0.35, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  pts.name = 'motes';
  return pts;
}

export function createMist(terrain, rng) {
  const group = new THREE.Group();
  const tex = buildSoftSprite(128);
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xc8d8d0, transparent: true, opacity: 0.08, depthWrite: false, fog: true });
  for (let i = 0; i < 46; i++) {
    const x = rng.range(-110, 110);
    const river = i < 28;
    const z = river ? terrain.riverZ(x) + rng.range(-6, 6) : rng.range(-110, 110);
    if (Math.hypot(x, z) > 112) continue;
    const s = new THREE.Sprite(mat.clone());
    s.material.opacity = rng.range(0.04, 0.1);
    const y = Math.max(0, terrain.height(x, z)) + rng.range(0.6, river ? 2.5 : 5);
    s.position.set(x, y, z);
    s.scale.set(rng.range(10, 22), rng.range(3, 6), 1);
    s.userData.base = s.position.clone();
    s.userData.ph = rng.range(0, 6.28);
    s.renderOrder = 4;
    group.add(s);
  }
  group.name = 'mist';
  group.userData.update = (t) => {
    for (const s of group.children) {
      s.position.x = s.userData.base.x + Math.sin(t * 0.03 + s.userData.ph) * 3;
      s.position.y = s.userData.base.y + Math.sin(t * 0.07 + s.userData.ph) * 0.3;
    }
  };
  return group;
}

// Sky dome with sun, haze and drifting cumulus. Also used to bake the environment map.
import * as THREE from 'three';
import { SUN_DIR, U } from '../core/shared.js';

const vs = `
varying vec3 vDir;
#include <fog_pars_vertex>
void main() {
  vDir = normalize(position);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_Position.z = gl_Position.w * 0.99999;
  #include <fog_vertex>
}`;
const fs = `
uniform vec3 uSun;
uniform float uTime;
uniform float uClouds;
varying vec3 vDir;
#include <common>
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 zenith = vec3(0.10, 0.26, 0.62);
  vec3 horizon = vec3(0.55, 0.68, 0.82);
  vec3 col = mix(horizon, zenith, pow(h, 0.55));
  float sd = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.85, 0.6) * (pow(sd, 8.0) * 0.35 + pow(sd, 64.0) * 0.8);
  col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, sd) * 40.0;
  // clouds on a plane
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.08) * 0.9 + vec2(uTime * 0.004, uTime * 0.002);
    float c = fbm(uv * 1.6);
    float cov = smoothstep(0.48, 0.72, c) * uClouds;
    float shade = fbm(uv * 1.6 + uSun.xz * 0.06);
    vec3 cloudCol = mix(vec3(0.75, 0.78, 0.82), vec3(1.05, 1.0, 0.95), smoothstep(0.3, 0.7, c - shade + 0.5));
    cloudCol += vec3(1.0, 0.8, 0.55) * pow(sd, 6.0) * 0.6;
    col = mix(col, cloudCol, cov * smoothstep(0.0, 0.18, d.y));
  } else {
    col = mix(horizon * 0.6, vec3(0.05, 0.08, 0.05), smoothstep(0.0, -0.2, d.y));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uSun: { value: SUN_DIR.clone() }, uTime: U.uTime, uClouds: { value: 1 },
    }]),
    vertexShader: vs, fragmentShader: fs, side: THREE.BackSide, depthWrite: false, fog: true,
  });
  mat.uniforms.uTime = U.uTime;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'sky';
  return mesh;
}

export function bakeEnvironment(renderer) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uClouds: { value: 0.6 } },
    vertexShader: vs.replace('#include <fog_pars_vertex>', '').replace('#include <fog_vertex>', ''),
    fragmentShader: fs.replace('#include <fog_pars_fragment>', '').replace('#include <fog_fragment>', '')
      .replace('* 40.0;', '* 0.0;'),
    side: THREE.BackSide, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat));
  // green bounce from below
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.14, 0.06) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -5;
  scene.add(ground);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.02);
  pm.dispose();
  return rt.texture;
}

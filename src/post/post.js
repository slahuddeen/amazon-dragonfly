// Post-processing: HDR render (MSAA) -> bloom -> grade (vignette, warmth, CA, grain) -> tone map.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QUALITY } from '../core/shared.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uUnder: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uUnder; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * r2 * 0.01;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      // gentle grade: warm highlights, cool-green shadows under the canopy
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = mix(vec3(1.0), vec3(0.88, 1.0, 0.92), uUnder);
      vec3 hiTint = vec3(1.04, 1.0, 0.94);
      col *= mix(shadowTint, hiTint, smoothstep(0.05, 0.8, l));
      col = mix(vec3(l), col, 1.08);
      col *= 1.0 - r2 * 0.85;
      col += (hash(vUv * uRes + fract(uTime)) - 0.5) * 0.012 * (0.3 + l);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: QUALITY.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let bloom = null;
  if (QUALITY.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.92);
    composer.addPass(bloom);
  }
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uRes.value.copy(size);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    composer, bloom, grade,
    setSize(w, h) { composer.setSize(w, h); grade.uniforms.uRes.value.set(w, h); },
  };
}

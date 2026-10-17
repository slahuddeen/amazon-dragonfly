// Global shader chunk overrides + per-material patch helpers.
//  - height-based exponential fog with sun in-scattering (all fogged materials)
//  - canopy ambient occlusion driven by a coverage map (materials with WORLD_AO)
//  - wind sway, leaf translucency, atlas cards
import * as THREE from 'three';
import { SUN_DIR, U } from './shared.js';

const f = (n) => n.toFixed(5);
const v3 = (v) => (v.isColor ? `vec3(${f(v.r)}, ${f(v.g)}, ${f(v.b)})` : `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`);

export const FOG = {
  falloff: 0.055,
  haze: 0.00055,
  lowColor: new THREE.Color(0.05, 0.085, 0.06),
  highColor: new THREE.Color(0.5, 0.63, 0.8),
  sunColor: new THREE.Color(1.0, 0.82, 0.58),
};

export function installGlobalChunks() {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG\n varying vec3 vFogMv;\n#endif`;
  C.fog_vertex = `#ifdef USE_FOG\n vFogMv = mvPosition.xyz;\n#endif`;
  C.fog_pars_fragment = `
#ifdef USE_FOG
uniform vec3 fogColor;
varying vec3 vFogMv;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
float fogSeg(float y0, float dy, float d) {
  float k = dy * ${f(FOG.falloff)};
  float e0 = exp(-${f(FOG.falloff)} * clamp(y0, -20.0, 400.0));
  return abs(k) < 1e-5 ? e0 * d : e0 * (1.0 - exp(-k * d)) / k;
}
vec3 worldFog(vec3 col, vec3 mv) {
  vec3 wOff = mv * mat3(viewMatrix);
  float dist = length(wOff);
  vec3 rd = wOff / max(dist, 1e-4);
  float camY = cameraPosition.y;
  #ifdef FOG_EXP2
  float dens = fogDensity;
  #else
  float dens = 0.015;
  #endif
  float integ;
  if (camY < 0.0 && rd.y > 0.0) {
    float t0 = min(-camY / rd.y, dist);
    integ = fogSeg(-camY, -rd.y, t0) + fogSeg(0.0, rd.y, dist - t0);
  } else {
    integ = fogSeg(camY, rd.y, dist);
  }
  float amt = 1.0 - exp(-(dens * integ + ${f(FOG.haze)} * dist));
  float yMid = abs(camY) + wOff.y * 0.5;
  float hi = smoothstep(8.0, 48.0, yMid);
  vec3 fc = mix(fogColor, ${v3(FOG.highColor)}, hi);
  float sunAmt = pow(max(dot(rd, ${v3(SUN_DIR)}), 0.0), 7.0);
  fc += ${v3(FOG.sunColor)} * sunAmt * mix(0.08, 0.75, hi);
  return mix(col, fc, amt);
}
#endif`;
  C.fog_fragment = `#ifdef USE_FOG\n gl_FragColor.rgb = worldFog(gl_FragColor.rgb, vFogMv);\n#endif`;

  C.aomap_pars_fragment += `
#ifdef WORLD_AO
uniform sampler2D uCanopyMap;
uniform vec4 uWorldRect;
#endif`;
  C.aomap_fragment += `
#ifdef WORLD_AO
{
  vec3 wpAO = cameraPosition + (-vViewPosition) * mat3(viewMatrix);
  vec2 cuv = (wpAO.xz - uWorldRect.xy) / uWorldRect.zw;
  vec4 cm = texture2D(uCanopyMap, clamp(cuv, 0.001, 0.999));
  float inside = step(0.0, cuv.x) * step(cuv.x, 1.0) * step(0.0, cuv.y) * step(cuv.y, 1.0);
  float cover = mix(0.85, cm.r, inside);
  float top = mix(38.0, cm.g * 64.0, inside);
  float under = clamp((top - wpAO.y) / max(top, 1.0), 0.0, 1.0);
  float occ = 1.0 - cover * mix(0.3, 0.86, under);
  vec3 tintAO = mix(vec3(1.0), vec3(0.72, 1.0, 0.66), cover * under);
  reflectedLight.indirectDiffuse *= occ * tintAO;
  reflectedLight.indirectSpecular *= occ * occ;
}
#endif`;
}

// Snippets reused by several patches
export const GLSL_WIND = `
uniform float uTime;
uniform float uWind;
vec3 windOffset(vec3 wp, float amt) {
  float ph = dot(wp, vec3(0.21, 0.13, 0.17));
  float gust = 0.6 + 0.4 * sin(uTime * 0.31 + wp.x * 0.02 + wp.z * 0.015);
  return vec3(
    sin(uTime * 1.7 + ph) + 0.4 * sin(uTime * 4.3 + ph * 2.1),
    0.5 * sin(uTime * 2.3 + ph * 1.3),
    cos(uTime * 1.3 + ph * 0.7) + 0.4 * cos(uTime * 3.7 + ph * 1.7)
  ) * amt * uWind * gust;
}`;

const TRANSLUCENT_CHUNK = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  /void RE_Direct_Physical\([^)]*\)\s*\{/,
  (m) => `${m}
#ifdef LEAF_TRANSLUCENT
  {
    float bl = saturate(dot(-geometryNormal, directLight.direction));
    float vt = pow(saturate(dot(-geometryViewDir, directLight.direction)), 4.0);
    reflectedLight.directDiffuse += directLight.color * material.diffuseColor * vec3(1.05, 1.2, 0.55) * (bl * 0.55 + vt * 1.1) * LEAF_TRANSLUCENT;
  }
#endif
`
);

/**
 * Patch a built-in material.
 * opts.key            unique program-cache key (REQUIRED when vertex/fragment patches differ)
 * opts.ao             enable canopy AO (default true for lit materials)
 * opts.translucent    leaf back-lighting strength (number) or false
 * opts.windAttr       name of a float attribute holding sway amplitude (or null)
 * opts.cards          atlas-card instancing (aCell, aParams, aNrm)
 * opts.noFlip         don't flip normals on back faces
 * opts.vertexHead / vertexBegin / fragHead / fragColor  raw GLSL injections
 * opts.uniforms       extra uniforms
 */
export function patchMaterial(mat, opts = {}) {
  const key = opts.key || 'std';
  mat.defines = mat.defines || {};
  if (opts.ao !== false) mat.defines.WORLD_AO = '';
  if (opts.translucent) mat.defines.LEAF_TRANSLUCENT = opts.translucent.toFixed(3);
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, opts.uniforms || {});
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    let head = GLSL_WIND + (opts.vertexHead || '');
    if (opts.windAttr) head += `\nattribute float ${opts.windAttr};\n`;
    if (opts.cards) head += `\nattribute vec4 aCell;\nattribute vec4 aParams;\nattribute vec3 aNrm;\n`;
    vs = vs.replace('#include <common>', `#include <common>\n${head}`);

    let begin = '#include <begin_vertex>\n';
    if (opts.cards) {
      begin += `
      {
        float yy = position.y;
        transformed.z += aParams.x * yy * yy + aParams.y * abs(position.x) * 2.0;
      }`;
    }
    if (opts.windAttr || opts.cards) {
      const amt = opts.cards ? 'aParams.z * position.y' : opts.windAttr;
      begin += `
      {
        #ifdef USE_INSTANCING
        vec4 wpW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #else
        vec4 wpW = modelMatrix * vec4(transformed, 1.0);
        #endif
        transformed += windOffset(wpW.xyz, ${amt});
      }`;
    }
    begin += opts.vertexBegin || '';
    vs = vs.replace('#include <begin_vertex>', begin);

    if (opts.vertexUv) vs = vs.replace('#include <uv_vertex>', '#include <uv_vertex>\n' + opts.vertexUv);
    if (opts.vertexNormal) vs = vs.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + opts.vertexNormal);
    if (opts.cards) {
      vs = vs.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = aCell.xy + vMapUv * aCell.zw;
      #endif`);
      if (vs.includes('#include <defaultnormal_vertex>')) {
        vs = vs.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        transformedNormal = normalize(mat3(viewMatrix) * aNrm);`);
      }
    }
    if (opts.vertexEnd) vs = vs.replace('#include <fog_vertex>', '#include <fog_vertex>\n' + opts.vertexEnd);

    if (fs.includes('#include <lights_physical_pars_fragment>')) {
      fs = fs.replace('#include <lights_physical_pars_fragment>', TRANSLUCENT_CHUNK);
    }
    fs = fs.replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform sampler2D uNoiseTex;\n${opts.fragHead || ''}`);
    if (opts.noFlip) {
      fs = fs.replace('#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    }
    if (opts.fragColor) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + opts.fragColor);
    if (opts.fragRough) fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + opts.fragRough);
    if (opts.fragEnd) fs = fs.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + opts.fragEnd);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  return mat;
}

// Depth material for shadow casting of atlas cards (matches bend/wind/uv).
export function makeCardDepthMaterial(atlas) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.45, side: THREE.DoubleSide });
  patchMaterial(m, { key: 'card-depth', cards: true, ao: false });
  return m;
}
export function makeWindDepthMaterial(atlas, attr = 'aWind') {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: atlas ? 0.45 : 0, side: THREE.DoubleSide });
  patchMaterial(m, { key: 'wind-depth-' + attr + (atlas ? 'a' : ''), windAttr: attr, ao: false });
  return m;
}

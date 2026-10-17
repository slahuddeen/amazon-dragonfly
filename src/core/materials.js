// All shared materials. Built once from the procedural textures.
import * as THREE from 'three';
import { patchMaterial, makeCardDepthMaterial, makeWindDepthMaterial } from './shaders.js';
import { QUALITY } from './shared.js';

const MOSS_GLSL = `
{
  vec3 wN = normalize(vNormal * mat3(viewMatrix));
  vec3 wP = cameraPosition + (-vViewPosition) * mat3(viewMatrix);
  float n1 = texture2D(uNoiseTex, wP.xz * 0.045 + vec2(wP.y * 0.031)).g;
  float n2 = texture2D(uNoiseTex, vec2(wP.x + wP.z, wP.y) * 0.17).b;
  float upM = smoothstep(0.35, 0.9, wN.y + (n1 - 0.5) * 0.9) * MOSS_UP * (0.35 + 0.65 * n2);
  float m = max(upM, vMoss * smoothstep(0.25, 0.6, n1 + n2 * 0.4));
  vec3 mossCol = mix(vec3(0.06, 0.13, 0.025), vec3(0.16, 0.24, 0.05), n2);
  diffuseColor.rgb = mix(diffuseColor.rgb, mossCol, clamp(m, 0.0, 1.0));
  vMossAmt = m;
}`;

function bark(map, normalMap, color, key, mossUp = 0.85, normalScale = 1.2) {
  const m = new THREE.MeshStandardMaterial({
    map, normalMap, color, vertexColors: true, roughness: 0.93, metalness: 0,
    normalScale: new THREE.Vector2(normalScale, normalScale),
  });
  return patchMaterial(m, {
    key: 'bark-' + key,
    vertexHead: 'attribute float aWind;\nvarying float vMoss;\n',
    vertexBegin: 'vMoss = aWind;\n',
    fragHead: `varying float vMoss;\nfloat vMossAmt = 0.0;\n#define MOSS_UP ${mossUp.toFixed(2)}\n`,
    fragColor: MOSS_GLSL,
    fragRough: 'roughnessFactor = mix(roughnessFactor, 0.75, vMossAmt);',
  });
}

export function createMaterials(tex) {
  const a2c = QUALITY.msaa > 0;
  const M = {};
  M.barkDark = bark(tex.barkFissured.map, tex.barkFissured.normalMap, 0xb8a894, 'dark');
  M.barkSmooth = bark(tex.barkSmooth.map, tex.barkSmooth.normalMap, 0xd0c8b8, 'smooth', 0.4, 1.1);
  M.barkPale = bark(tex.barkRinged.map, tex.barkRinged.normalMap, 0xf0ece0, 'pale', 0.3, 0.8);
  M.barkPalm = bark(tex.barkRinged.map, tex.barkRinged.normalMap, 0xa89c88, 'palm', 0.5, 1.0);
  M.roots = bark(tex.barkSmooth.map, tex.barkSmooth.normalMap, 0xa49a88, 'roots', 0.9, 0.8);

  M.vine = patchMaterial(new THREE.MeshStandardMaterial({
    map: tex.barkFissured.map, normalMap: tex.barkFissured.normalMap, color: 0x9a8a70, vertexColors: true, roughness: 0.9,
  }), { key: 'vine', windAttr: 'aWind' });

  M.cards = patchMaterial(new THREE.MeshStandardMaterial({
    map: tex.atlas, alphaTest: 0.45, alphaToCoverage: a2c, side: THREE.DoubleSide,
    roughness: 0.58, metalness: 0,
  }), { key: 'cards', cards: true, translucent: 1.0, noFlip: true });

  M.plantLeaf = patchMaterial(new THREE.MeshStandardMaterial({
    map: tex.atlas, alphaTest: 0.45, alphaToCoverage: a2c, side: THREE.DoubleSide,
    vertexColors: true, roughness: 0.5, metalness: 0,
  }), { key: 'plantLeaf', windAttr: 'aWind', translucent: 0.9 });

  M.plain = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), { key: 'plain' });
  M.plainWind = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: THREE.DoubleSide }), { key: 'plainWind', windAttr: 'aWind', translucent: 0.5 });
  M.glossy = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28 }), { key: 'glossy' });
  M.soil = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: tex.litter.map, color: 0x9a8a7a }), { key: 'soil' });

  M.depth = {
    cards: makeCardDepthMaterial(tex.atlas),
    plantLeaf: makeWindDepthMaterial(tex.atlas, 'aWind'),
    vine: makeWindDepthMaterial(null, 'aWind'),
  };
  return M;
}

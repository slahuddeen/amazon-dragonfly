import * as THREE from 'three';

// World layout (metres). The playable forest is a disc; beyond it a distant canopy ring.
export const WORLD = {
  size: 260,
  half: 130,
  radius: 116,
  waterLevel: 0,
  chunk: 40,
};

// Direction *towards* the sun.
export const SUN_DIR = new THREE.Vector3(-0.42, 0.8, -0.38).normalize();
export const SUN_COLOR = new THREE.Color(1.0, 0.9, 0.74);

// Uniforms shared by every patched material (same object references everywhere).
export const U = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uCanopyMap: { value: null },
  uWorldRect: { value: new THREE.Vector4(-WORLD.half, -WORLD.half, WORLD.size, WORLD.size) },
  uNoiseTex: { value: null },
};

export const QUALITY = (() => {
  const q = new URLSearchParams(location.search).get('q') || 'high';
  const presets = {
    low: { name: 'low', pixelRatio: 0.75, shadow: 2048, msaa: 0, reflect: 0.25, density: 0.55, bloom: false },
    medium: { name: 'medium', pixelRatio: 1, shadow: 2048, msaa: 4, reflect: 0.4, density: 0.8, bloom: true },
    high: { name: 'high', pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadow: 4096, msaa: 4, reflect: 0.5, density: 1, bloom: true },
  };
  return presets[q] || presets.high;
})();

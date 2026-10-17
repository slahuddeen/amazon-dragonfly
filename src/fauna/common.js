import * as THREE from 'three';
import { patchMaterial } from '../core/shaders.js';

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function creatureMat(params = {}, key = 'creature') {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.6, ...params });
  return patchMaterial(m, { key: key + (params.map ? '-map' : '') + (params.vertexColors ? '-vc' : '') });
}

export function wingMat(map, params = {}) {
  const m = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.3, roughness: 0.45, ...params });
  return patchMaterial(m, { key: 'wing', translucent: 0.6 });
}

// Simple steering helper: moves pos towards target with max speed and turn smoothing.
export function steer(pos, vel, target, maxSpeed, accel, dt) {
  const desired = target.clone().sub(pos);
  const d = desired.length();
  if (d > 1e-4) desired.multiplyScalar(Math.min(maxSpeed, d * 2) / d);
  vel.lerp(desired, 1 - Math.exp(-accel * dt));
  pos.addScaledVector(vel, dt);
  return d;
}

// Orient an object so its local +Z points along dir (keeping world up)
const _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3();
export function faceDir(obj, dir, roll = 0, slerp = 1) {
  if (dir.lengthSq() < 1e-8) return;
  _t.copy(obj.position).add(dir);
  _m.lookAt(_t, obj.position, _up);
  const q = new THREE.Quaternion().setFromRotationMatrix(_m);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  obj.quaternion.slerp(q, slerp);
}

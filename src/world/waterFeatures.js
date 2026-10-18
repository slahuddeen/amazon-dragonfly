// Creek water, cascades & the big waterfall with its plunge pool, sinkhole ponds,
// the rock-roofed cave in the escarpment, and mossy boulders.
import * as THREE from 'three';
import { MeshBuilder, addEllipsoid, addLoft } from '../core/geometry.js';
import { patchMaterial } from '../core/shaders.js';
import { U, WORLD } from '../core/shared.js';
import { buildSoftSprite } from '../core/textures.js';

const UP = new THREE.Vector3(0, 1, 0);

function waterMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0c0a06, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.94, envMapIntensity: 1.2, side: THREE.DoubleSide });
  patchMaterial(m, {
    key: 'smallwater',
    vertexHead: 'attribute float aFoam;\nvarying float vFoam;\nvarying vec2 vFlow;\n',
    vertexBegin: 'vFoam = aFoam; vFlow = uv;\n',
    fragHead: 'varying float vFoam;\nvarying vec2 vFlow;\n',
    fragColor: `
    {
      float st = texture2D(uNoiseTex, vec2(vFlow.x * 0.6, vFlow.y * 0.15 - uTime * (0.25 + vFoam * 0.8))).r;
      float st2 = texture2D(uNoiseTex, vec2(vFlow.x * 1.7 + 0.3, vFlow.y * 0.5 - uTime * (0.4 + vFoam))).g;
      float foam = smoothstep(0.55, 0.8, st * 0.6 + st2 * 0.6) * (0.15 + vFoam);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.8, 0.78), clamp(foam, 0.0, 0.9));
      diffuseColor.a = mix(diffuseColor.a, 1.0, foam);
    }`,
    fragRough: 'roughnessFactor = mix(0.05, 0.6, clamp(vFoam, 0.0, 1.0));',
  });
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader) => {
    prev(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    {
      vec3 wPw = cameraPosition + (-vViewPosition) * mat3(viewMatrix);
      vec2 r1 = texture2D(uNoiseTex, wPw.xz * 0.35 + vec2(0.0, -uTime * 0.12)).rg - 0.5;
      vec2 r2 = texture2D(uNoiseTex, wPw.xz * 1.1 + vec2(uTime * 0.05, -uTime * 0.2)).ba - 0.5;
      vec2 rp = r1 * 0.5 + r2 * 0.3;
      normal = normalize(normal + (viewMatrix * vec4(rp.x, 0.0, rp.y, 0.0)).xyz * 0.7);
    }`);
  };
  return m;
}

function fallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: U.uTime, uNoiseTex: U.uNoiseTex }]),
    vertexShader: `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uNoiseTex;
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        float a = texture2D(uNoiseTex, vec2(vUv.x * 2.2, vUv.y * 0.35 + uTime * 0.9)).r;
        float b = texture2D(uNoiseTex, vec2(vUv.x * 5.0 + 0.4, vUv.y * 0.8 + uTime * 1.4)).g;
        float streak = smoothstep(0.35, 0.75, a * 0.7 + b * 0.5);
        float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        float alpha = (0.35 + 0.6 * streak) * edge;
        alpha *= mix(1.0, 0.75, vUv.y);
        vec3 col = mix(vec3(0.55, 0.62, 0.6), vec3(0.95, 0.98, 0.97), streak);
        gl_FragColor = vec4(col * 1.4, alpha);
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
}

export function createWaterFeatures(terrain, M, colliders, rng) {
  const group = new THREE.Group();
  group.name = 'waterFeatures';
  const cr = terrain.creek;
  const wmat = waterMaterial();
  const info = { falls: [] };

  // ---------------------------------------------------------------- creek water ribbon
  {
    const pos = [], uv = [], foam = [], nrm = [], idx = [];
    let vi = 0, prev = -1;
    for (let i = 0; i < cr.n; i++) {
      if (Math.abs(i - cr.lip) <= 2) { prev = -1; continue; }
      const x = cr.x[i], z = cr.z[i];
      if (terrain.riverDist(x, z) < terrain.riverHalfWidth(x) - 1) { prev = -1; continue; }
      const j0 = Math.max(0, i - 1), j1 = Math.min(cr.n - 1, i + 1);
      const tx = cr.x[j1] - cr.x[j0], tz = cr.z[j1] - cr.z[j0], tl = Math.hypot(tx, tz) || 1;
      const sx = -tz / tl, sz = tx / tl;
      const w = cr.w[i] * 1.15, y = cr.water[i];
      const drop = Math.max(0, cr.water[Math.max(0, i - 2)] - cr.water[Math.min(cr.n - 1, i + 2)]);
      const f = Math.min(1, drop * 0.6);
      for (const k of [-1, 0, 1]) {
        pos.push(x + sx * w * k, y, z + sz * w * k);
        nrm.push(0, 1, 0);
        uv.push((k + 1) / 2 * w, cr.s[i]);
        foam.push(f + (k === 0 ? 0 : 0.15));
      }
      if (prev >= 0) for (let k = 0; k < 2; k++) {
        const a = prev + k, b = prev + k + 1, c = vi + k + 1, d = vi + k;
        idx.push(a, d, c, a, c, b);
      }
      prev = vi; vi += 3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, wmat);
    m.name = 'creek'; m.receiveShadow = true; m.renderOrder = 2;
    group.add(m);
  }

  // ---------------------------------------------------------------- ponds
  for (const p of terrain.ponds) {
    const g = new THREE.CircleGeometry(p.r * 1.25, 40);
    g.rotateX(-Math.PI / 2);
    g.setAttribute('aFoam', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    const m = new THREE.Mesh(g, wmat);
    m.position.set(p.x, p.level, p.z);
    m.name = 'pond'; m.receiveShadow = true; m.renderOrder = 2;
    group.add(m);
  }

  // ---------------------------------------------------------------- falls & cascades
  const fm = fallMaterial();
  const sheet = (i0, i1, widthMul = 1.0) => {
    const top = new THREE.Vector3(cr.x[i0], cr.water[i0], cr.z[i0]);
    const bot = new THREE.Vector3(cr.x[i1], cr.water[i1], cr.z[i1]);
    const flow = new THREE.Vector3(bot.x - top.x, 0, bot.z - top.z);
    const run = flow.length(); flow.normalize();
    const side = new THREE.Vector3(-flow.z, 0, flow.x);
    const w = cr.w[i0] * 1.1 * widthMul, drop = top.y - bot.y;
    const pos = [], uv = [], idx = [];
    const NU = 6, NV = 18;
    for (let v = 0; v <= NV; v++) {
      const t = v / NV;
      // water leaves the lip horizontally, then falls along a parabola
      const out = run * (0.35 * t + 0.65 * Math.sqrt(t));
      const y = top.y - drop * t * t;
      for (let u = 0; u <= NU; u++) {
        const k = u / NU - 0.5;
        const spread = 1 + 0.3 * t;
        const c = top.clone().addScaledVector(flow, out).addScaledVector(side, k * w * 2 * spread);
        pos.push(c.x, y + Math.sin(k * 3.1) * 0.05, c.z);
        uv.push(u / NU, t * drop * 0.6);
      }
    }
    for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) {
      const a = v * (NU + 1) + u;
      idx.push(a, a + NU + 1, a + 1, a + 1, a + NU + 1, a + NU + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, fm);
    m.renderOrder = 3;
    group.add(m);
    return { top, bot: top.clone().addScaledVector(flow, run).setY(bot.y), drop, w, flow };
  };
  const main = sheet(Math.max(0, cr.lip - 3), Math.min(cr.n - 1, cr.lip + 3), 1.15);
  info.falls.push(main);
  // smaller cascades wherever the creek steps down
  for (let i = 3; i < cr.n - 4; i++) {
    if (Math.abs(i - cr.lip) < 8) continue;
    const d = cr.water[i] - cr.water[i + 3];
    if (d > 1.0 && d >= cr.water[i - 1] - cr.water[i + 2] && d >= cr.water[i + 1] - cr.water[i + 4]) { info.falls.push(sheet(i, i + 3, 0.9)); i += 4; }
  }
  // foam & spray at the foot of each fall
  {
    const per = 260, n = info.falls.length * per;
    const p = new Float32Array(n * 3), sd = new Float32Array(n * 4);
    info.falls.forEach((f, k) => {
      for (let j = 0; j < per; j++) {
        const q = k * per + j;
        p.set([f.bot.x, f.bot.y + 0.05, f.bot.z], q * 3);
        sd.set([Math.random(), Math.random(), Math.random(), f.w * (0.6 + Math.min(1, f.drop / 6))], q * 4);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime },
      vertexShader: `
        uniform float uTime; attribute vec4 aSeed; varying float vA;
        void main() {
          float life = fract(uTime * (0.35 + aSeed.x * 0.4) + aSeed.y);
          float ang = aSeed.z * 6.2831;
          vec3 o = vec3(cos(ang), 0.0, sin(ang)) * aSeed.w * (0.3 + life * 0.9);
          o.y = life * (1.0 - life) * 3.0 * (0.5 + aSeed.x) ;
          vec4 mv = viewMatrix * vec4(position + o, 1.0);
          vA = (1.0 - life) * smoothstep(60.0, 10.0, -mv.z);
          gl_PointSize = clamp(60.0 * (0.4 + aSeed.x) / max(-mv.z, 0.1), 1.0, 40.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        void main() { float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vec3(0.92, 0.96, 0.95), a * vA * 0.5); }`,
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false; pts.renderOrder = 4; pts.name = 'spray';
    group.add(pts);
    // drifting mist over the plunge pool
    const tex = buildSoftSprite(128);
    for (let k = 0; k < 7; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xdfe8e6, transparent: true, opacity: 0.12, depthWrite: false, fog: true }));
      s.position.copy(main.bot).add(new THREE.Vector3(rng.range(-3, 3), rng.range(0.5, 3), rng.range(-3, 3)));
      s.scale.setScalar(rng.range(4, 8));
      s.userData.base = s.position.clone(); s.userData.ph = rng.range(0, 6);
      group.add(s);
    }
  }

  // ---------------------------------------------------------------- cave roof (rock arch tunnelled into the cliff)
  {
    const cv = terrain.cave;
    const mb = new MeshBuilder();
    mb.setColor([1, 1, 1]);
    const rings = [];
    const M = 22;
    const roofTop = cv.top - cv.floor + 0.6;
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const z = cv.zMouth + 1.5 - t * (cv.len + 2.5);
      const narrow = 1 - 0.35 * t;
      const hw = cv.hw * narrow * (1 + 0.08 * Math.sin(k * 1.7)), ah = cv.arch * (1 - 0.3 * t) * (1 + 0.06 * Math.cos(k * 2.3));
      const ow = cv.hw + 6, oh = roofTop;
      const pts = [], nrm = [];
      // inner arch (right -> left) then outer arch (left -> right): a closed rock ring
      for (let j = 0; j < M / 2; j++) {
        const a = (j / (M / 2 - 1)) * Math.PI;
        const n1 = 1 + 0.12 * Math.sin(j * 2.1 + k);
        pts.push(new THREE.Vector3(cv.x + Math.cos(a) * hw * n1, cv.floor - 0.4 + Math.sin(a) * ah * n1 + 0.4, z));
        nrm.push(new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0));
      }
      for (let j = 0; j < M / 2; j++) {
        const a = Math.PI - (j / (M / 2 - 1)) * Math.PI;
        pts.push(new THREE.Vector3(cv.x + Math.cos(a) * ow, cv.floor - 0.6 + Math.sin(a) * oh, z));
        nrm.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
      }
      rings.push({ pts, nrm, v: t * 4 });
    }
    addLoft(mb, rings, 3, () => 0.6);
    // mouth face (annulus between inner and outer arch) and back wall
    const capRing = (r, flip) => {
      const base = mb.count, n = r.pts.length, h = n / 2;
      for (const p of r.pts) mb.v(p.x, p.y, p.z, 0, 0, flip ? -1 : 1, (p.x - cv.x) * 0.2, p.y * 0.2, 0.4);
      for (let j = 0; j < h - 1; j++) {
        const a = base + j, b = base + j + 1, c = base + (n - 1 - j - 1), d = base + (n - 1 - j);
        mb.quad(a, b, c, d);
      }
    };
    capRing(rings[0], false);
    const back = rings[rings.length - 1];
    const bb = mb.count;
    const ctr = new THREE.Vector3(cv.x, cv.floor + 0.8, back.pts[0].z);
    mb.v(ctr.x, ctr.y, ctr.z, 0, 0, 1, 0.5, 0.5, 0.5);
    for (let j = 0; j < M / 2; j++) { const p = back.pts[j]; mb.v(p.x, p.y, p.z, 0, 0, 1, j / 10, 0, 0.5); }
    for (let j = 0; j < M / 2 - 1; j++) mb.tri(bb, bb + 1 + j, bb + 2 + j);
    // darken the interior via vertex colours
    const cavity = mb.toGeometry();
    const pc = cavity.attributes.position, cc = cavity.attributes.color;
    for (let i = 0; i < pc.count; i++) {
      const depth = THREE.MathUtils.clamp((cv.zMouth - pc.getZ(i)) / cv.len, 0, 1);
      const inner = Math.abs(pc.getX(i) - cv.x) < cv.hw * 1.2 && pc.getY(i) < cv.floor + cv.arch * 1.15;
      const k = inner ? 1 - 0.85 * Math.pow(depth, 0.7) : 1;
      cc.setXYZ(i, k, k, k);
    }
    const mesh = new THREE.Mesh(cavity, M.rockDouble);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'cave';
    group.add(mesh);
    // keep the dragonfly out of the rock walls
    for (let k = 0; k < 6; k++) {
      const z = cv.zMouth - (k / 5) * cv.len;
      for (const s of [-1, 1]) colliders.addCapsule(new THREE.Vector3(cv.x + s * (cv.hw + 0.8), cv.floor, z), new THREE.Vector3(cv.x + s * (cv.hw + 0.8), cv.floor + cv.arch + 3, z), 0.8);
    }
    info.cave = { mouth: new THREE.Vector3(cv.x, cv.floor + 1.5, cv.zMouth + 2), inside: new THREE.Vector3(cv.x, cv.floor + 1.2, cv.zMouth - cv.len * 0.6) };
  }

  // ---------------------------------------------------------------- mossy boulders
  {
    const proto = [];
    for (let v = 0; v < 3; v++) {
      const mb = new MeshBuilder();
      const seed = v * 3.7;
      addEllipsoid(mb, new THREE.Vector3(0, 0.25, 0), 1, 0.75, 0.9, {
        w: 12, h: 8, wind: 0.5,
        disp: (x, y, z) => 1 + 0.18 * Math.sin(x * 3 + seed) * Math.cos(z * 2.6 - seed) + 0.1 * Math.sin(y * 7 + x * 4) + (y < -0.5 ? -0.2 : 0),
      });
      proto.push(mb.toGeometry());
    }
    const spots = [];
    const R = WORLD.radius - 4;
    for (let i = 0; i < cr.n; i += 2) { // creek banks & ravine
      if (rng.chance(0.55)) continue;
      const j0 = Math.max(0, i - 1), j1 = Math.min(cr.n - 1, i + 1);
      const tx = cr.x[j1] - cr.x[j0], tz = cr.z[j1] - cr.z[j0], tl = Math.hypot(tx, tz) || 1;
      const s = rng.sign(), off = cr.w[i] + rng.range(-0.6, 3);
      spots.push([cr.x[i] - tz / tl * off * s, cr.z[i] + tx / tl * off * s, rng.range(0.3, 1.3)]);
    }
    for (let i = 0; i < 90; i++) { // cliff toe of the escarpment
      const x = rng.range(-R, R), z = terrain.escarpZ(x) + rng.range(1.5, 6);
      if (Math.hypot(x, z) < R) spots.push([x, z, rng.range(0.4, 1.8)]);
    }
    for (let i = 0; i < 70; i++) { const x = rng.range(-R, R), z = rng.range(-R, R); if (Math.hypot(x, z) < R && terrain.bankDist(x, z) > 1) spots.push([x, z, rng.range(0.3, 1.1)]); }
    const byProto = proto.map(() => []);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const [x, z, s] of spots) {
      if (terrain.riverDist(x, z) < terrain.riverHalfWidth(x) - 1) continue;
      const y = terrain.height(x, z) - s * 0.25;
      q.setFromEuler(new THREE.Euler(rng.range(-0.2, 0.2), rng.range(0, 6.28), rng.range(-0.2, 0.2)));
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * rng.range(0.8, 1.3), s * rng.range(0.7, 1.1), s * rng.range(0.8, 1.3)));
      byProto[rng.int(0, proto.length - 1)].push(m4.clone());
      colliders.addCapsule(new THREE.Vector3(x, y + s * 0.3, z), new THREE.Vector3(x, y + s * 0.4, z), s * 0.85);
    }
    byProto.forEach((list, k) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(proto[k], M.rock, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; im.receiveShadow = true; im.name = 'boulders';
      im.computeBoundingSphere();
      group.add(im);
    });
  }
  group.userData.update = (t) => {
    for (const s of group.children) if (s.isSprite) { s.position.y = s.userData.base.y + Math.sin(t * 0.4 + s.userData.ph) * 0.4; s.material.opacity = 0.09 + 0.05 * Math.sin(t * 0.7 + s.userData.ph); }
  };
  group.userData.info = info;
  return group;
}

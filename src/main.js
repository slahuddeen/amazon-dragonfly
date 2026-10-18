import * as THREE from 'three';
import { WORLD, SUN_DIR, SUN_COLOR, U, QUALITY } from './core/shared.js';
import { installGlobalChunks, FOG } from './core/shaders.js';
import { RNG } from './core/rng.js';
import { buildLeafAtlas, buildBark, buildLitter, buildNoiseTexture, buildRock } from './core/textures.js';
import { createMaterials } from './core/materials.js';
import { Batcher, CardSystem, Scatter, Culler } from './core/geometry.js';
import { Colliders } from './core/colliders.js';
import { Terrain } from './world/terrain.js';
import { createSky, bakeEnvironment } from './world/sky.js';
import { createWater } from './world/water.js';
import { createWaterFeatures } from './world/waterFeatures.js';
import { createDistantForest } from './world/distantForest.js';
import { createGodRays, createMotes, createMist } from './world/atmosphere.js';
import { Forest } from './flora/trees.js';
import { Palms } from './flora/palms.js';
import { Plants } from './flora/plants.js';
import { Epiphytes } from './flora/epiphytes.js';
import { Vines } from './flora/vines.js';
import { Ground } from './flora/ground.js';
import { Butterflies, Odonates, createMidges, Ants, createWebs } from './fauna/insects.js';
import { Birds } from './fauna/birds.js';
import { Frogs, Sloths, Capybaras, Caimans, buildBoa } from './fauna/animals.js';
import { DragonflyPlayer } from './player/dragonfly.js';
import { createPost } from './post/post.js';
import { Ambience } from './audio/ambience.js';
import { HUD } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const hud = new HUD();
const tick = () => new Promise((r) => setTimeout(r, 0));

async function init() {
  installGlobalChunks();
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(QUALITY.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.getElementById('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG.lowColor.clone(), 0.02);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 3000);
  camera.layers.enable(1);

  hud.progress(0.03, 'Painting leaves, bark and leaf litter…'); await tick();
  const tex = {
    atlas: buildLeafAtlas(),
    barkFissured: buildBark('fissured', 3),
    barkSmooth: buildBark('smooth', 5),
    barkRinged: buildBark('ringed', 7),
    litter: buildLitter(),
    noise: buildNoiseTexture(),
    rock: buildRock(),
  };
  U.uNoiseTex.value = tex.noise;
  const M = createMaterials(tex);

  hud.progress(0.15, 'Shaping the forest floor and the river…'); await tick();
  const terrain = new Terrain();
  scene.add(terrain.build(tex));

  const batch = new Batcher(), cards = new CardSystem(), scatter = new Scatter(), colliders = new Colliders(), culler = new Culler();
  const rng = new RNG(2026);
  const waterFx = createWaterFeatures(terrain, M, colliders, rng.fork(12));
  scene.add(waterFx);
  const waterInfo = waterFx.userData.info;
  const rz0 = terrain.riverZ(0);
  const heroPos = new THREE.Vector3(4, 0, rz0 - 22);
  heroPos.y = terrain.height(heroPos.x, heroPos.z);

  hud.progress(0.22, 'Growing kapoks, figs and canopy trees…'); await tick();
  const forest = new Forest({ terrain, batch, cards, colliders, rng: rng.fork(1) });
  forest.populate({
    hero: [
      { type: 'giant', x: heroPos.x, z: heroPos.z, opts: { height: 64, radius: 2.3, tint: 'mid' }, min: 24 },
      { type: 'fig', x: -16, z: rz0 - 36, opts: { hollow: true, radius: 1.3 }, min: 12 },
      { type: 'ipe', x: 26, z: rz0 - 30, opts: { tint: 'pink' }, min: 10 },
    ],
  });
  forest.hitchhikers(Math.round(70 * Math.max(0.6, QUALITY.density)));
  U.uCanopyMap.value = forest.buildCoverage();

  hud.progress(0.4, 'Raising palms and tree ferns…'); await tick();
  const palms = new Palms({ terrain, batch, colliders, rng: rng.fork(2), forest });
  palms.populate();

  hud.progress(0.48, 'Stringing lianas and climbing aroids…'); await tick();
  const vines = new Vines({ forest, terrain, batch, cards, colliders, rng: rng.fork(3) });
  vines.populate();

  hud.progress(0.56, 'Planting heliconias, ferns and aroids…'); await tick();
  const plants = new Plants({ terrain, scatter, materials: M, forest, colliders, rng: rng.fork(4) });
  plants.registerAll();
  plants.populate();

  hud.progress(0.64, 'Settling bromeliads and orchids…'); await tick();
  const epi = new Epiphytes({ forest, scatter, materials: M, cards, batch, terrain, rng: rng.fork(5), plants });
  epi.registerAll();
  epi.populate();

  hud.progress(0.7, 'Felling old giants, waking the ants…'); await tick();
  const ground = new Ground({ terrain, batch, forest, plants, epiphytes: epi, colliders, materials: M, rng: rng.fork(6) });
  ground.logs();
  ground.snags();
  const nest = new THREE.Vector3(17, 0, rz0 - 14);
  const antTarget = forest.trees.find((t) => t.type === 'understory' && Math.hypot(t.x - nest.x, t.z - nest.z) > 10 && Math.hypot(t.x - nest.x, t.z - nest.z) < 22) || { x: nest.x - 14, z: nest.z - 8 };
  ground.antColony(nest, antTarget);

  hud.progress(0.78, 'Assembling the world…'); await tick();
  const world = new THREE.Group(); world.name = 'world';
  scene.add(world);
  const tris = batch.build(world, M, culler, {
    plantLeaf: { customDepthMaterial: M.depth.plantLeaf },
    vine: { customDepthMaterial: M.depth.vine },
    plain: { maxDist: 160 }, glossy: { maxDist: 120, castShadow: false },
  });
  cards.build(world, M.cards, M.depth.cards, culler, { crown: {}, mid: { maxDist: 170 }, low: { maxDist: 95 }, detail: { maxDist: 110 } });
  scatter.build(world, culler);
  world.add(ground.buildRings(tex.atlas, terrain.heightTex));

  // sky, light, water, horizon
  const sky = createSky(); scene.add(sky);
  scene.environment = bakeEnvironment(renderer);
  scene.environmentIntensity = 0.75;
  const sun = new THREE.DirectionalLight(SUN_COLOR, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
  const EXT = 50;
  Object.assign(sun.shadow.camera, { left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 1, far: 420 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.035;
  sun.shadow.camera.layers.enable(1);
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xa8c8e8, 0x4a5a28, 0.6);
  scene.add(hemi);
  const water = createWater(terrain); scene.add(water);
  scene.add(createDistantForest(terrain, tex.atlas));

  hud.progress(0.86, 'Letting the light in…'); await tick();
  const godrays = createGodRays(forest, terrain, rng.fork(7)); scene.add(godrays);
  const motes = createMotes(QUALITY.name === 'low' ? 1200 : 2600); scene.add(motes);
  const mist = createMist(terrain, rng.fork(8)); scene.add(mist);

  hud.progress(0.9, 'Releasing butterflies, frogs and macaws…'); await tick();
  const spawn = new THREE.Vector3(-5, 0, rz0 - 11);
  spawn.y = terrain.height(spawn.x, spawn.z) + 1.1;
  const near = spawn.clone();
  const fauna = [];
  const frng = rng.fork(9);
  const faunaGroup = new THREE.Group(); faunaGroup.name = 'fauna'; scene.add(faunaGroup);
  const sceneMain = scene;
  {
  const scene = faunaGroup;
  fauna.push(new Butterflies(scene, { terrain, plants, rng: frng.fork(1), near }));
  fauna.push(new Odonates(scene, { terrain, rng: frng.fork(2), near: new THREE.Vector3(spawn.x + 6, 0, rz0 - 4) }));
  fauna.push(new Birds(scene, { forest, plants, terrain, rng: frng.fork(3), near }));
  fauna.push(new Sloths(scene, { forest, rng: frng.fork(4), batch }));
  fauna.push(new Capybaras(scene, { terrain, rng: frng.fork(5), spot: new THREE.Vector3(spawn.x + 14, 0, rz0 - 7.5) }));
  fauna.push(new Caimans(scene, { terrain, rng: frng.fork(6), xs: [-40, 35, 70] }));
  if (ground.antTrail) fauna.push(new Ants(scene, ground.antTrail, frng.fork(7)));
  // arboreal ant highways up the lianas (trunk -> limbs -> over the crowns -> next tree)
  const highways = vines.trails.concat(forest.trails || []).sort((a, b) => a.pts[0].distanceToSquared(spawn) - b.pts[0].distanceToSquared(spawn)).slice(0, 8);
  highways.forEach((tr, i) => fauna.push(new Ants(scene, { pts: tr.pts }, frng.fork(20 + i), { count: 260, leaves: false, color: i % 2 ? 0x1a1008 : 0x6a3010, speed: 1.6, width: 0.012, lift: 0.05 })));
  // frogs: bromeliad tanks, logs and the forest floor near the start
  const frogSpots = [];
  const lowBromeliads = epi.bromeliads.filter((b) => b.y < 12).sort((a, b) => a.distanceToSquared(spawn) - b.distanceToSquared(spawn));
  for (const b of lowBromeliads.slice(0, 16)) frogSpots.push({ p: b.clone(), canHop: false });
  for (let i = 0; i < 18; i++) {
    const x = spawn.x + frng.range(-16, 16), z = spawn.z + frng.range(-16, 10);
    if (terrain.bankDist(x, z) < 0.5) continue;
    frogSpots.push({ p: new THREE.Vector3(x, terrain.height(x, z) + 0.01, z), getY: (xx, zz) => terrain.height(xx, zz) + 0.01 });
  }
  for (let i = 0; i < 8; i++) {
    const x = spawn.x + frng.range(-20, 25), z = rz0 - terrain.riverHalfWidth(x) - frng.range(0.5, 3);
    frogSpots.push({ p: new THREE.Vector3(x, Math.max(0.05, terrain.height(x, z)) + 0.35, z), kind: 'redeye', canHop: false });
  }
  fauna.push(new Frogs(scene, { spots: frogSpots, rng: frng.fork(10) }));
  // emerald tree boa on a low limb near the start
  const limb = forest.attach.filter((a) => a.kind === 'limb' && a.p.y > 4 && a.p.y < 16).sort((a, b) => a.p.distanceToSquared(spawn) - b.p.distanceToSquared(spawn))[0];
  if (limb) scene.add(buildBoa(limb.p.clone().add(new THREE.Vector3(0, -limb.r * 0.4, 0)), limb.dir.clone().setY(0).normalize(), frng));
  // webs & midges
  const webSpots = [];
  for (let i = 0; i < 40; i++) {
    const p = new THREE.Vector3(spawn.x + frng.range(-35, 35), 0, spawn.z + frng.range(-35, 20));
    if (terrain.bankDist(p.x, p.z) < 0.5) continue;
    p.y = terrain.height(p.x, p.z) + frng.range(0.5, 2.5);
    if (colliders.nearest(p) < 0.7) continue;
    webSpots.push(p);
  }
  scene.add(createWebs(webSpots, frng.fork(11)));
  const midgeSpots = godrays.userData.shafts.slice(0, 12).map((s) => new THREE.Vector3(s.x, terrain.height(s.x, s.z) + 1.5, s.z));
  midgeSpots.push(spawn.clone().add(new THREE.Vector3(3, 0.6, -2)), spawn.clone().add(new THREE.Vector3(10, 0.2, 6)));
  scene.add(createMidges(midgeSpots, frng.fork(12)));

  }
  faunaGroup.traverse((o) => o.layers.set(1));
  const scene_ = sceneMain;
  // player
  const player = new DragonflyPlayer({ camera, terrain, colliders, dom: renderer.domElement });
  scene.add(player.model);
  player.perchTargets = world;
  terrain.mesh.userData.perch = true;
  world.add(terrain.mesh);
  const toHero = heroPos.clone().sub(spawn);
  player.setPose(spawn, Math.atan2(-toHero.x, -toHero.z), 0.05);
  const H = (x, z) => Math.max(terrain.height(x, z), terrain.waterAt(x, z));
  const hx = heroPos.x, hz = heroPos.z, hy = heroPos.y;
  const tourPts = [
    [spawn.x, spawn.y, spawn.z],
    [spawn.x + 7, H(spawn.x + 7, rz0 - 4) + 0.5, rz0 - 4],
    [12, 0.45, rz0 - 1],
    [24, 0.6, terrain.riverZ(24) - 3],
    [hx + 12, H(hx + 12, hz - 2) + 2.6, hz - 2],
    [hx + 4, hy + 4, hz - 6],
    [hx - 4, hy + 9, hz - 3],
    [hx + 2, hy + 17, hz + 4],
    [hx + 5, hy + 28, hz - 2],
    [hx - 3, hy + 46, hz - 8],
    [hx + 22, 80, hz + 10],
    [46, 84, 26],
    [55, 30, terrain.riverZ(55)],
    [30, 1.2, terrain.riverZ(30)],
    [10, 0.7, terrain.riverZ(10) + 1],
    [nest.x + 3, H(nest.x + 3, nest.z) + 0.5, nest.z + 2],
    [waterInfo.falls[0].bot.x + 7, waterInfo.falls[0].bot.y + 2.5, waterInfo.falls[0].bot.z + 6],
    [waterInfo.falls[0].bot.x + 2, waterInfo.falls[0].bot.y + 4.5, waterInfo.falls[0].bot.z + 2],
    [waterInfo.falls[0].top.x + 3, waterInfo.falls[0].top.y + 3, waterInfo.falls[0].top.z - 4],
    [waterInfo.cave.mouth.x - 4, waterInfo.cave.mouth.y + 6, waterInfo.cave.mouth.z - 12],
    [waterInfo.cave.mouth.x, waterInfo.cave.mouth.y + 1, waterInfo.cave.mouth.z + 6],
    [waterInfo.cave.inside.x, waterInfo.cave.inside.y, waterInfo.cave.inside.z],
    [waterInfo.cave.mouth.x + 1, waterInfo.cave.mouth.y + 0.5, waterInfo.cave.mouth.z + 3],
    [-14, H(-14, rz0 - 20) + 1.8, rz0 - 20],
    [spawn.x - 3, spawn.y + 0.3, spawn.z - 3],
  ].map((a) => new THREE.Vector3(...a));
  player.setTour(tourPts);

  const post = createPost(renderer, scene, camera);
  const audio = new Ambience();

  // debug camera from URL: ?cam=x,y,z,yaw,pitch
  if (params.get('cam')) {
    const [x, y, z, yaw = 0, pitch = 0] = params.get('cam').split(',').map(Number);
    player.setPose(new THREE.Vector3(x, y, z), yaw, pitch);
  } else if (params.get('tour') !== '0') {
    player.startTour();
  }
  if (params.get('fpv')) player.mode = 'fpv';

  // UI wiring
  const start = document.getElementById('start');
  const go = () => {
    start.classList.add('hidden');
    renderer.domElement.requestPointerLock?.();
    audio.start();
    if (player.touring && !params.get('keepTour')) player.stopTour();
  };
  document.getElementById('flyBtn').addEventListener('click', go);
  document.getElementById('tourBtn').addEventListener('click', () => {
    start.classList.add('hidden'); audio.start(); player.startTour();
  });
  renderer.domElement.addEventListener('click', () => { if (!player.locked && start.classList.contains('hidden')) renderer.domElement.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && !player.touring) start.classList.remove('hidden');
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') audio.toggle();
    if (e.code === 'KeyH') document.getElementById('help').classList.toggle('hidden');
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    post.setSize(innerWidth, innerHeight);
  });

  const stats = {
    tris, cards: cards.total, colliders: colliders.list.length, trees: forest.trees.length,
    attach: forest.attach.length, flowers: plants.flowers.length, vines: vines.count, trails: vines.trails.length,
  };
  console.log('[amazonia] world stats', stats);
  window.__world = { scene, renderer, camera, player, forest, terrain, stats, fauna, plants, epi, vines };

  // shadow camera helpers
  const lightRot = new THREE.Matrix4().lookAt(new THREE.Vector3(), SUN_DIR.clone().negate(), new THREE.Vector3(0, 1, 0));
  const lightInv = lightRot.clone().invert();
  const texel = (EXT * 2) / QUALITY.shadow;
  const sc = new THREE.Vector3(), fwd = new THREE.Vector3();

  const clock = new THREE.Clock();
  let exposure = 1.4, under = 1;
  const lastGood = player.pos.clone();
  hud.ready();
  if (params.get('autostart')) start.classList.add('hidden');

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    U.uTime.value = t;
    player.update(dt, t);
    if (![player.pos.x, player.pos.y, player.pos.z, camera.position.x, camera.position.y, camera.position.z, player.yaw, player.pitch].every(Number.isFinite)) {
      console.warn('[amazonia] recovering from invalid camera state');
      player.perched = null; player.vel.set(0, 0, 0); player.roll = 0;
      player.setPose(lastGood.clone(), Number.isFinite(player.yaw) ? player.yaw : 0, 0);
      player.update(0.016, t);
    } else lastGood.copy(player.pos);
    const cp = camera.position;
    culler.update(cp);
    ground.update(cp);
    sky.position.copy(cp);
    motes.material.uniforms.uCam.value.copy(cp);
    motes.material.uniforms.uPix.value = renderer.getPixelRatio() * innerHeight / 900;
    mist.userData.update(t);
    waterFx.userData.update(t);
    for (const f of fauna) f.update(dt, t, cp);
    // shadows follow the view, snapped to texels in light space
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    sc.copy(cp).addScaledVector(fwd, EXT * 0.55);
    sc.y = Math.min(cp.y, 30);
    sc.applyMatrix4(lightInv);
    sc.x = Math.round(sc.x / texel) * texel; sc.y = Math.round(sc.y / texel) * texel;
    sc.applyMatrix4(lightRot);
    sun.target.position.copy(sc);
    sun.position.copy(sc).addScaledVector(SUN_DIR, 200);
    // water only when it could be seen
    water.visible = terrain.riverDist(cp.x, cp.z) < 95 || cp.y > 22;
    // eye adaptation: brighter under the canopy
    const cov = forest.coverAt(cp.x, cp.z), top = forest.topAt(cp.x, cp.z);
    const u = cov * THREE.MathUtils.clamp((top - cp.y) / Math.max(top, 1), 0, 1);
    under += (u - under) * (1 - Math.exp(-dt * 1.5));
    const target = THREE.MathUtils.lerp(1.0, 3.3, under);
    exposure += (target - exposure) * (1 - Math.exp(-dt * 1.2));
    if (!Number.isFinite(exposure)) { exposure = 1.4; under = 0.5; }
    renderer.toneMappingExposure = exposure;
    post.grade.uniforms.uUnder.value = under;
    post.grade.uniforms.uTime.value = t;
    let fallD = Infinity;
    for (const f of waterInfo.falls) fallD = Math.min(fallD, cp.distanceTo(f.bot) / Math.max(0.5, f.drop / 4));
    audio.update(player.speed(), fallD);
    hud.update(dt, cp.y - Math.max(terrain.height(cp.x, cp.z), 0));
    post.composer.render(dt);
    if (!still) requestAnimationFrame(frame);
  }
  // ?still=1 renders only on demand (used for automated screenshots)
  const still = !!params.get('still');
  window.__renderFrames = (n = 1, dtFixed = 1 / 30) => {
    for (let i = 0; i < n; i++) { clock.elapsedTime += dtFixed; clock.oldTime = performance.now() - dtFixed * 1000; frame(); }
  };
  if (!still) requestAnimationFrame(frame);
  window.__ready = true;
}

init().catch((e) => {
  console.error(e);
  window.__error = e.message;
  document.getElementById('loadmsg').textContent = 'Error: ' + e.message;
});

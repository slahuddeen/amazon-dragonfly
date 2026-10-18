// Procedural textures drawn on canvas: leaf atlas, bark, forest-floor litter, noise.
import * as THREE from 'three';
import { RNG } from './rng.js';
import { createNoise } from './noise.js';

export const ATLAS = { size: 2048, cells: 4 };
export const CELL = {
  broad: 0, clusterDark: 1, clusterLight: 2, heart: 3,
  monstera: 4, paddle: 5, palm: 6, fern: 7,
  strap: 8, calathea: 9, cecropia: 10, dead: 11,
  blossom: 12, lance: 13, moss: 14, orchid: 15,
};

// UV rect (u0, v0, du, dv) for an atlas cell. Canvas row 0 is the top, we flip rows when uploading.
export function cellRect(i, sub = -1) {
  const n = ATLAS.cells, s = 1 / n;
  const col = i % n, row = Math.floor(i / n);
  let u0 = col * s, v0 = 1 - (row + 1) * s, du = s, dv = s;
  if (sub >= 0) { // 2x2 sub-cells
    const h = s / 2;
    u0 += (sub % 2) * h; v0 += (1 - Math.floor(sub / 2)) * h; du = h; dv = h;
  }
  // tiny inset to avoid bleeding
  const e = 0.002;
  return [u0 + e, v0 + e, du - 2 * e, dv - 2 * e];
}

const hex = (h) => '#' + h.toString(16).padStart(6, '0');
function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
function jitterHex(c, rng, amt = 18) {
  const j = () => Math.round(rng.range(-amt, amt));
  const r = Math.max(0, Math.min(255, ((c >> 16) & 255) + j()));
  const g = Math.max(0, Math.min(255, ((c >> 8) & 255) + j()));
  const b = Math.max(0, Math.min(255, (c & 255) + j()));
  return (r << 16) | (g << 8) | b;
}

// ---------------------------------------------------------------- leaf primitives
// Leaf is drawn with base at (0,0) pointing up (towards -y) with length L and half-width W.
function leafOutline(L, W, kind = 'ovate', n = 36) {
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let w;
    switch (kind) {
      case 'lance': w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 1.1); break;
      case 'oblong': w = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.35) * (t < 0.06 ? t / 0.06 * 0.7 + 0.3 : 1); break;
      case 'strap': w = t < 0.85 ? 0.85 + 0.15 * Math.sin(t * 3) : Math.sqrt(Math.max(0, 1 - (t - 0.85) / 0.15)); break;
      case 'oval': w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.75); break;
      default: w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85);
    }
    if (kind !== 'strap' && kind !== 'oblong' && t > 0.8) w *= Math.pow(1 - (t - 0.8) / 0.2, 1.5) * 0.85 + 0.0; // drip tip
    right.push([w * W, -t * L]);
  }
  return right;
}
function pathFromOutline(ctx, right) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (const [x, y] of right) ctx.lineTo(x, y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(-right[i][0], right[i][1]);
  ctx.closePath();
}

function drawVeins(ctx, L, W, right, col, nVeins = 9, alpha = 0.45, angle = 0.55) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1.2, W * 0.035);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L * 0.98); ctx.stroke();
  ctx.lineWidth = Math.max(0.7, W * 0.014);
  ctx.globalAlpha = alpha * 0.75;
  for (let i = 1; i <= nVeins; i++) {
    const t = i / (nVeins + 1);
    const idx = Math.min(right.length - 1, Math.round((t + 0.1) * (right.length - 1)));
    const ex = right[idx][0] * 0.93, ey = right[idx][1];
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -L * t);
      ctx.quadraticCurveTo(s * ex * 0.5, -L * t - L * 0.05 * angle * 2, s * ex, ey);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// mode: 'dilate' (color bleed underlay), 'color', 'mask'
function drawLeaf(ctx, mode, rng, { x, y, rot = 0, L, W, kind = 'ovate', c0, c1, vein = 0xc8e080, veins = 9, veinAlpha = 0.4, speckle = 0.5, edge = true }) {
  const right = leafOutline(L, W, kind);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  pathFromOutline(ctx, right);
  if (mode === 'mask') { ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); return; }
  if (mode === 'dilate') {
    ctx.fillStyle = hex(mixHex(c0, c1, 0.5)); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 14; ctx.stroke(); ctx.fill();
    ctx.restore(); return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, -L);
  g.addColorStop(0, hex(c0)); g.addColorStop(1, hex(c1));
  ctx.fillStyle = g; ctx.fill();
  // soft side shading (one half slightly darker -> fold)
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-W * 1.2, -L, W * 1.2, L * 1.05);
  const hg = ctx.createRadialGradient(W * 0.3, -L * 0.45, 0, W * 0.3, -L * 0.45, L * 0.5);
  hg.addColorStop(0, 'rgba(255,255,230,0.10)'); hg.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = hg; ctx.fillRect(-W * 1.2, -L * 1.05, W * 2.4, L * 1.1);
  for (let i = 0; i < 40 * speckle; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,200,0.05)';
    ctx.beginPath(); ctx.ellipse(rng.range(-W, W), rng.range(-L, 0), rng.range(1, W * 0.12), rng.range(1, W * 0.1), rng.range(0, 3), 0, 6.3); ctx.fill();
  }
  ctx.restore();
  drawVeins(ctx, L, W, right, hex(vein), veins, veinAlpha);
  if (edge) { pathFromOutline(ctx, right); ctx.strokeStyle = 'rgba(20,30,10,0.35)'; ctx.lineWidth = 1.2; ctx.stroke(); }
  ctx.restore();
}

function stroke(ctx, mode, pts, width, col) {
  if (mode === 'mask') ctx.strokeStyle = '#fff';
  else ctx.strokeStyle = hex(col);
  ctx.lineWidth = mode === 'dilate' ? width + 10 : width;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// ---------------------------------------------------------------- cells
const S = 512;
const cells = [];

cells[CELL.broad] = (ctx, m, rng) => {
  drawLeaf(ctx, m, rng, { x: 256, y: 505, L: 490, W: 158, c0: 0x24481a, c1: 0x3f7228, vein: 0xa8cf6a, veins: 10, veinAlpha: 0.5 });
};

function cluster(ctx, m, rng, { dark, n = 18, Lr = [130, 200], Wr = [0.3, 0.38], kind = 'ovate', twig = 0x4a3a24 }) {
  // a spray of leaves on 2-3 twigs
  const twigs = [];
  for (let k = 0; k < 4; k++) {
    const pts = []; let x = 256 + rng.range(-30, 30), y = 510, a = -Math.PI / 2 + (k - 1.5) * 0.45 + rng.range(-0.15, 0.15);
    for (let i = 0; i < 12; i++) { pts.push([x, y]); x += Math.cos(a) * 34; y += Math.sin(a) * 34; a += rng.range(-0.12, 0.12); }
    twigs.push(pts);
  }
  const leaves = [];
  for (const pts of twigs) {
    for (let i = 2; i < pts.length; i++) {
      for (const s of [-1, 1]) {
        if (rng.chance(0.08)) continue;
        const [px, py] = pts[i];
        const dirA = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
        const L = rng.range(Lr[0], Lr[1]) * (1.1 - i / 30);
        leaves.push({ x: px, y: py, rot: dirA + Math.PI / 2 + s * rng.range(0.6, 1.1), L, W: L * rng.range(Wr[0], Wr[1]), depth: rng.next() });
      }
    }
  }
  leaves.sort((a, b) => a.depth - b.depth);
  for (const pts of twigs) stroke(ctx, m, pts, 5, twig);
  const [ca, cb] = dark ? [[0x1c3a14, 0x2e5a1e], [0x355f22, 0x4f8030]] : [[0x3a6a20, 0x55892c], [0x6b9a35, 0x8ab448]];
  for (const lf of leaves) {
    const sh = 0.55 + 0.45 * lf.depth;
    const c0 = mixHex(0x0a1408, jitterHex(rng.pick(ca), rng, 10), sh);
    const c1 = mixHex(0x0a1408, jitterHex(rng.pick(cb), rng, 10), sh);
    drawLeaf(ctx, m, rng, { ...lf, kind, c0, c1, vein: dark ? 0x7aa050 : 0xb8d878, veins: 6, veinAlpha: 0.3, speckle: 0.2 });
  }
}
cells[CELL.clusterDark] = (ctx, m, rng) => cluster(ctx, m, rng, { dark: true });

cells[CELL.clusterLight] = (ctx, m, rng) => {
  // pinnately compound leaves (Inga / legumes) radiating from the base
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.36 + rng.range(-0.1, 0.1);
    const len = rng.range(380, 480);
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([256 + Math.cos(a) * len * t + Math.sin(t * 3) * 8, 508 + Math.sin(a) * len * t]); }
    stroke(ctx, m, pts, 3, 0x5a6a2a);
    for (let i = 2; i <= 10; i++) {
      const t = i / 10;
      const [px, py] = pts[i];
      for (const s of [-1, 1]) {
        const L = 70 + 40 * Math.sin(t * Math.PI);
        const c0 = jitterHex(0x467a26, rng, 14), c1 = jitterHex(0x6f9f3a, rng, 14);
        drawLeaf(ctx, m, rng, { x: px, y: py, rot: a + Math.PI / 2 + s * 1.1, L, W: L * 0.32, kind: 'oval', c0, c1, vein: 0xc0dc8a, veins: 4, veinAlpha: 0.3, speckle: 0.1 });
      }
    }
  }
};

function heartOutline(ctx, L, W) {
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.04);
  ctx.bezierCurveTo(W * 0.35, L * 0.12, W * 1.05, L * 0.06, W * 1.0, -L * 0.25);
  ctx.bezierCurveTo(W * 0.95, -L * 0.55, W * 0.35, -L * 0.8, 0, -L);
  ctx.bezierCurveTo(-W * 0.35, -L * 0.8, -W * 0.95, -L * 0.55, -W * 1.0, -L * 0.25);
  ctx.bezierCurveTo(-W * 1.05, L * 0.06, -W * 0.35, L * 0.12, 0, -L * 0.04);
  ctx.closePath();
}

cells[CELL.heart] = (ctx, m, rng) => {
  const L = 400, W = 215;
  ctx.save(); ctx.translate(256, 420);
  heartOutline(ctx, L, W);
  if (m === 'mask') { ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); return; }
  if (m === 'dilate') { ctx.fillStyle = '#2c5a1e'; ctx.strokeStyle = '#2c5a1e'; ctx.lineWidth = 14; ctx.fill(); ctx.stroke(); ctx.restore(); return; }
  const g = ctx.createLinearGradient(0, 60, 0, -L); g.addColorStop(0, '#1d4214'); g.addColorStop(1, '#3a7426');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(-W * 1.2, -L, W * 1.2, L * 1.3);
  const hg = ctx.createRadialGradient(60, -200, 0, 60, -200, 260); hg.addColorStop(0, 'rgba(255,255,220,0.14)'); hg.addColorStop(1, 'rgba(255,255,220,0)');
  ctx.fillStyle = hg; ctx.fillRect(-W * 1.2, -L, W * 2.4, L * 1.3); ctx.restore();
  ctx.strokeStyle = 'rgba(190,225,130,0.55)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -L * 0.04); ctx.lineTo(0, -L * 0.97); ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
    const t = 0.05 + i * 0.12;
    ctx.beginPath(); ctx.moveTo(0, -L * t);
    ctx.quadraticCurveTo(s * W * 0.5, -L * (t + 0.02), s * W * (0.85 - t * 0.5), -L * (t + 0.18)); ctx.stroke();
  }
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -L * 0.04); ctx.quadraticCurveTo(s * W * 0.5, L * 0.02, s * W * 0.75, L * 0.0); ctx.stroke(); }
  ctx.restore();
};

cells[CELL.monstera] = (ctx, m, rng) => {
  const L = 420, W = 225;
  ctx.save(); ctx.translate(256, 440);
  heartOutline(ctx, L, W);
  if (m === 'dilate') { ctx.fillStyle = '#2a571c'; ctx.strokeStyle = '#2a571c'; ctx.lineWidth = 14; ctx.fill(); ctx.stroke(); ctx.restore(); return; }
  if (m === 'mask') {
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    // slits from edge + rows of holes
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
      const t = 0.12 + i * 0.1;
      const ex = s * W * 1.1, ey = -L * (t + 0.08);
      ctx.lineWidth = 9 - i * 0.5;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(s * W * 0.42, -L * (t + 0.02)); ctx.stroke();
      if (i < 7) { ctx.beginPath(); ctx.ellipse(s * W * 0.22, -L * (t + 0.05), 8, 15, s * 0.6, 0, 6.3); ctx.fill(); }
    }
    ctx.restore(); return;
  }
  const g = ctx.createLinearGradient(0, 60, 0, -L); g.addColorStop(0, '#1a3d12'); g.addColorStop(1, '#357024');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-W * 1.2, -L, W * 1.2, L * 1.3); ctx.restore();
  ctx.strokeStyle = 'rgba(170,210,110,0.5)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -L * 0.04); ctx.lineTo(0, -L * 0.97); ctx.stroke();
  ctx.restore();
};

cells[CELL.paddle] = (ctx, m, rng) => {
  const L = 500, W = 120;
  ctx.save(); ctx.translate(256, 506);
  const right = leafOutline(L, W, 'oblong');
  pathFromOutline(ctx, right);
  if (m === 'dilate') { ctx.fillStyle = '#356a22'; ctx.strokeStyle = '#356a22'; ctx.lineWidth = 14; ctx.fill(); ctx.stroke(); ctx.restore(); return; }
  if (m === 'mask') {
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const s = rng.sign(); const t = rng.range(0.15, 0.9);
      ctx.beginPath(); ctx.moveTo(s * W * 1.1, -L * t - 12); ctx.lineTo(s * W * rng.range(0.15, 0.6), -L * t); ctx.stroke();
    }
    ctx.restore(); return;
  }
  const g = ctx.createLinearGradient(-W, 0, W, 0);
  g.addColorStop(0, '#2a5a1c'); g.addColorStop(0.48, '#4a8a2e'); g.addColorStop(0.52, '#4f9132'); g.addColorStop(1, '#2f6420');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(10,30,5,0.25)'; ctx.lineWidth = 1;
  for (let i = 0; i < 120; i++) { const y = -i * L / 120; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W * 1.1, y - 30); ctx.moveTo(0, y); ctx.lineTo(-W * 1.1, y - 30); ctx.stroke(); }
  ctx.fillStyle = 'rgba(120,90,30,0.35)';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(rng.sign() * W * 0.9, -rng.range(0, L), 10, 30, 0, 0, 6.3); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = '#a8c870'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L); ctx.stroke();
  ctx.restore();
};

function pinnate(ctx, m, rng, { pairs, reach, leafletW, kind, c0, c1, angle, rachis, droop = 0.25, pinnules = false }) {
  stroke(ctx, m, [[256, 512], [256, 0]], 7, rachis);
  for (let i = 0; i < pairs; i++) {
    const t = 0.03 + (i / pairs) * 0.95;
    const y = 512 - t * 512;
    const len = reach * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.6) * (1 - t * 0.35);
    for (const s of [-1, 1]) {
      const rot = s * (Math.PI / 2 - angle) + s * droop * t;
      if (!pinnules) {
        drawLeaf(ctx, m, rng, { x: 256 + s * 3, y, rot, L: len, W: leafletW * (0.8 + 0.4 * Math.sin(Math.PI * t)), kind, c0: jitterHex(c0, rng, 8), c1: jitterHex(c1, rng, 8), vein: 0xb0d080, veins: 0, veinAlpha: 0.35, speckle: 0.05, edge: false });
      } else {
        // fern pinna: little lobes along a midline
        const n = Math.max(3, Math.round(len / 16));
        const ca = Math.cos(rot - Math.PI / 2), sa = Math.sin(rot - Math.PI / 2);
        stroke(ctx, m, [[256, y], [256 + ca * len, y + sa * len]], 2, rachis);
        for (let k = 0; k < n; k++) {
          const tt = (k + 0.5) / n;
          const px = 256 + ca * len * tt, py = y + sa * len * tt;
          const pl = (1 - tt * 0.7) * 26;
          for (const q of [-1, 1]) drawLeaf(ctx, m, rng, { x: px, y: py, rot: rot + q * 0.9 - Math.PI / 2 + Math.PI / 2, L: pl, W: pl * 0.42, kind: 'oval', c0: jitterHex(c0, rng, 6), c1: jitterHex(c1, rng, 6), veins: 0, veinAlpha: 0, speckle: 0, edge: false });
        }
      }
    }
  }
}
cells[CELL.palm] = (ctx, m, rng) => pinnate(ctx, m, rng, { pairs: 44, reach: 250, leafletW: 11, kind: 'lance', c0: 0x2c5a1c, c1: 0x6b9a38, angle: 0.75, rachis: 0x6a7a3a });
cells[CELL.fern] = (ctx, m, rng) => pinnate(ctx, m, rng, { pairs: 26, reach: 235, leafletW: 0, kind: 'oval', c0: 0x3c7424, c1: 0x6aa63c, angle: 0.35, rachis: 0x4a6a28, droop: 0.2, pinnules: true });

cells[CELL.strap] = (ctx, m, rng) => {
  const L = 500, W = 60;
  ctx.save(); ctx.translate(256, 508);
  const right = leafOutline(L, W, 'strap');
  pathFromOutline(ctx, right);
  if (m === 'mask') { ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); return; }
  if (m === 'dilate') { ctx.fillStyle = '#5f8a3a'; ctx.strokeStyle = '#5f8a3a'; ctx.lineWidth = 14; ctx.fill(); ctx.stroke(); ctx.restore(); return; }
  const g = ctx.createLinearGradient(0, 0, 0, -L);
  g.addColorStop(0, '#c8d0a0'); g.addColorStop(0.25, '#6f9a44'); g.addColorStop(0.85, '#4f7f2e'); g.addColorStop(1, '#8a4a3a');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const cg = ctx.createLinearGradient(-W, 0, W, 0);
  cg.addColorStop(0, 'rgba(0,0,0,0.25)'); cg.addColorStop(0.5, 'rgba(255,255,220,0.12)'); cg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = cg; ctx.fillRect(-W, -L, W * 2, L);
  ctx.fillStyle = 'rgba(230,235,210,0.18)';
  for (let y = 30; y < L * 0.9; y += rng.range(18, 34)) ctx.fillRect(-W, -y, W * 2, rng.range(3, 8));
  ctx.restore(); ctx.restore();
};

cells[CELL.calathea] = (ctx, m, rng) => {
  const L = 480, W = 175;
  ctx.save(); ctx.translate(256, 504);
  const right = leafOutline(L, W, 'oval');
  pathFromOutline(ctx, right);
  if (m === 'mask') { ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); return; }
  if (m === 'dilate') { ctx.fillStyle = '#3c6a2a'; ctx.strokeStyle = '#3c6a2a'; ctx.lineWidth = 14; ctx.fill(); ctx.stroke(); ctx.restore(); return; }
  ctx.fillStyle = '#7fa75a'; ctx.fill();
  ctx.save(); ctx.clip();
  // feathered dark pattern along lateral veins
  for (let i = 0; i < 16; i++) {
    const t = 0.06 + i * 0.058;
    for (const s of [-1, 1]) {
      ctx.fillStyle = i % 2 ? '#1f4518' : '#2d5a20';
      ctx.beginPath(); ctx.ellipse(s * W * 0.36, -L * t - 10, W * 0.32, L * 0.022, s * -0.45, 0, 6.3); ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(30,60,20,0.8)'; ctx.lineWidth = 9; pathFromOutline(ctx, right); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#c8a0a0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L * 0.97); ctx.stroke();
  ctx.restore();
};

cells[CELL.cecropia] = (ctx, m, rng) => {
  // peltate, deeply lobed star; petiole attaches at the centre
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const L = 232 * (0.8 + 0.2 * Math.sin(i * 1.7));
    drawLeaf(ctx, m, rng, { x: 256, y: 256, rot: a, L, W: L * 0.24, kind: 'oval', c0: 0x5d7a46, c1: 0x86a466, vein: 0xe0ecd0, veins: 7, veinAlpha: 0.55, speckle: 0.3 });
  }
  if (m === 'color') { ctx.fillStyle = '#c0d0a0'; ctx.beginPath(); ctx.arc(256, 256, 10, 0, 6.3); ctx.fill(); }
};

cells[CELL.dead] = (ctx, m, rng) => {
  const variants = [
    { c0: 0x5a3a1c, c1: 0x7a5228, kind: 'ovate', holes: 0 },
    { c0: 0x8a5a24, c1: 0xb07a34, kind: 'lance', holes: 0 },
    { c0: 0x3a2a18, c1: 0x5a4024, kind: 'oval', holes: 6 },
    { c0: 0x9a7a3a, c1: 0xc0a050, kind: 'ovate', holes: 0 },
  ];
  variants.forEach((v, k) => {
    const ox = (k % 2) * 256, oy = Math.floor(k / 2) * 256;
    drawLeaf(ctx, m, rng, { x: ox + 128, y: oy + 250, L: 236, W: v.kind === 'lance' ? 45 : 80, kind: v.kind, c0: v.c0, c1: v.c1, vein: 0x2a1a0c, veins: 7, veinAlpha: 0.5, speckle: 1 });
    if (m === 'mask' && v.holes) {
      ctx.fillStyle = '#000';
      for (let i = 0; i < v.holes; i++) { ctx.beginPath(); ctx.arc(ox + 128 + rng.range(-40, 40), oy + rng.range(60, 220), rng.range(4, 12), 0, 6.3); ctx.fill(); }
    }
  });
};

cells[CELL.blossom] = (ctx, m, rng) => {
  // dense cluster of trumpet flowers (white-ish; tinted per tree)
  for (let i = 0; i < 4; i++) stroke(ctx, m, [[256, 512], [256 + rng.range(-160, 160), rng.range(120, 300)]], 4, 0x5a4a3a);
  const fl = [];
  for (let i = 0; i < 95; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 215;
    fl.push({ x: 256 + Math.cos(a) * r, y: 250 + Math.sin(a) * r * 0.9, s: rng.range(18, 30), d: rng.next(), rot: rng.range(0, 6.3) });
  }
  fl.sort((a, b) => a.d - b.d);
  for (const f of fl) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    const sh = Math.round(170 + 85 * f.d);
    for (let p = 0; p < 5; p++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath(); ctx.ellipse(0, -f.s * 0.55, f.s * 0.42, f.s * 0.6, 0, 0, 6.3);
      ctx.fillStyle = m === 'mask' ? '#fff' : m === 'dilate' ? '#d8c8d0' : `rgb(${sh},${sh - 12},${sh - 6})`;
      if (m === 'dilate') { ctx.lineWidth = 10; ctx.strokeStyle = '#d8c8d0'; ctx.stroke(); }
      ctx.fill();
    }
    if (m === 'color') { ctx.fillStyle = 'rgba(120,60,40,0.6)'; ctx.beginPath(); ctx.arc(0, 0, f.s * 0.18, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }
};

cells[CELL.lance] = (ctx, m, rng) => {
  drawLeaf(ctx, m, rng, { x: 256, y: 506, L: 495, W: 100, kind: 'lance', c0: 0x2a5a1e, c1: 0x4c8a30, vein: 0xb0d880, veins: 12, veinAlpha: 0.45 });
};

cells[CELL.moss] = (ctx, m, rng) => {
  // hanging beard moss / lichen strands (drawn upward from base; card is hung upside-down)
  for (let i = 0; i < 220; i++) {
    let x = rng.range(60, 452), y = 512;
    const len = rng.range(80, 480) * (1 - Math.abs(x - 256) / 300);
    const pts = [[x, y]];
    for (let k = 0; k < 12; k++) { x += rng.range(-6, 6); y -= len / 12; pts.push([x, y]); }
    stroke(ctx, m, pts, rng.range(1.5, 3.5), jitterHex(rng.chance(0.6) ? 0x8a9a6a : 0x6a7a4a, rng, 14));
  }
};

cells[CELL.orchid] = (ctx, m, rng) => {
  const stem = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; stem.push([120 + t * 280, 500 - Math.sin(t * 2.4) * 380]); }
  stroke(ctx, m, stem, 4, 0x4a6a2a);
  for (let i = 4; i <= 14; i += 2) {
    const [x, y] = stem[i];
    const s = i > 12 ? 20 : 42;
    ctx.save(); ctx.translate(x, y + 20); ctx.rotate(rng.range(-0.3, 0.3));
    const petal = (rx, ry, ang, col) => {
      ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.ellipse(0, -ry, rx, ry, 0, 0, 6.3);
      ctx.fillStyle = m === 'mask' ? '#fff' : m === 'dilate' ? '#c070c0' : col;
      if (m === 'dilate') { ctx.lineWidth = 10; ctx.strokeStyle = '#c070c0'; ctx.stroke(); }
      ctx.fill(); ctx.restore();
    };
    for (let p = 0; p < 3; p++) petal(s * 0.28, s * 0.5, p * 2.09, '#e8c8f0');
    petal(s * 0.38, s * 0.45, 1.05, '#d8a0e8'); petal(s * 0.38, s * 0.45, -1.05, '#d8a0e8');
    petal(s * 0.32, s * 0.38, Math.PI, '#a02890');
    if (m === 'color') { ctx.fillStyle = '#f0d040'; ctx.beginPath(); ctx.arc(0, s * 0.25, s * 0.1, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }
};

// ---------------------------------------------------------------- atlas builder
export function buildLeafAtlas(seed = 7) {
  const N = ATLAS.size;
  const cc = document.createElement('canvas'); cc.width = cc.height = N;
  const ca = document.createElement('canvas'); ca.width = ca.height = N;
  const cx = cc.getContext('2d'), ax = ca.getContext('2d');
  cx.fillStyle = '#2f5222'; cx.fillRect(0, 0, N, N);
  ax.fillStyle = '#000'; ax.fillRect(0, 0, N, N);
  for (let i = 0; i < 16; i++) {
    const fn = cells[i]; if (!fn) continue;
    const ox = (i % 4) * S, oy = Math.floor(i / 4) * S;
    for (const [ctx, mode] of [[cx, 'dilate'], [cx, 'color'], [ax, 'mask']]) {
      ctx.save();
      ctx.beginPath(); ctx.rect(ox + 4, oy + 4, S - 8, S - 8); ctx.clip();
      ctx.translate(ox, oy);
      fn(ctx, mode, new RNG(seed * 100 + i));
      ctx.restore();
    }
  }
  const c = cx.getImageData(0, 0, N, N).data, a = ax.getImageData(0, 0, N, N).data;
  const out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    const src = y * N * 4, dst = (N - 1 - y) * N * 4;
    for (let x = 0; x < N * 4; x += 4) {
      out[dst + x] = c[src + x]; out[dst + x + 1] = c[src + x + 1]; out[dst + x + 2] = c[src + x + 2];
      out[dst + x + 3] = a[src + x];
    }
  }
  const tex = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  tex.userData.preview = cc;
  return tex;
}

// ---------------------------------------------------------------- height -> normal
export function heightToNormalTexture(h, w, hh, strength = 2) {
  const out = new Uint8Array(w * hh * 4);
  const at = (x, y) => h[((y + hh) % hh) * w + ((x + w) % w)];
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = ((hh - 1 - y) * w + x) * 4;
    out[i] = ((-dx / l) * 0.5 + 0.5) * 255;
    out[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
    out[i + 2] = (1 / l) * 0.5 * 255 + 127;
    out[i + 3] = 255;
  }
  const t = new THREE.DataTexture(out, w, hh, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
function rgbTexture(rgb, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 3, d = ((h - 1 - y) * w + x) * 4;
    out[d] = rgb[s]; out[d + 1] = rgb[s + 1]; out[d + 2] = rgb[s + 2]; out[d + 3] = 255;
  }
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- bark
export function buildBark(kind, seed = 3) {
  const W = 512, H = 512;
  const nz = createNoise(seed);
  const h = new Float32Array(W * H), rgb = new Uint8Array(W * H * 3);
  const put = (i, r, g, b) => { rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, i = y * W + x;
    if (kind === 'fissured') {
      const warp = nz.pfbm2(u * 4, v * 4, 4, 4, 3) * 0.6;
      const ridge = 1 - Math.abs(nz.pfbm2(u * 7 + warp, v * 2, 7, 2, 3));
      const r2 = Math.pow(ridge, 3);
      const fine = nz.pfbm2(u * 32, v * 16, 32, 16, 3) * 0.5 + 0.5;
      const hh = r2 * 0.75 + fine * 0.25;
      h[i] = hh;
      const lich = nz.pfbm2(u * 6 + 3, v * 6, 6, 6, 4);
      let r = 45 + 70 * hh, g = 34 + 58 * hh, b = 24 + 44 * hh;
      if (lich > 0.25 && hh > 0.4) { const k = Math.min(1, (lich - 0.25) * 4); r += (150 - r) * k * 0.6; g += (160 - g) * k * 0.6; b += (135 - b) * k * 0.6; }
      put(i, r, g, b);
    } else if (kind === 'smooth') {
      const mott = nz.pfbm2(u * 5, v * 5, 5, 5, 5) * 0.5 + 0.5;
      const fine = nz.pfbm2(u * 40, v * 40, 40, 40, 2) * 0.5 + 0.5;
      const lent = Math.max(0, nz.pnoise2(u * 60, v * 6, 60, 6) - 0.45) * 3; // horizontal lenticels
      const hh = mott * 0.4 + fine * 0.3 - lent * 0.4;
      h[i] = hh;
      let r = 120 + 60 * mott, g = 116 + 54 * mott, b = 102 + 46 * mott;
      r -= lent * 60; g -= lent * 60; b -= lent * 55;
      const lich = nz.pfbm2(u * 8 + 9, v * 8, 8, 8, 4);
      if (lich > 0.3) { const k = Math.min(1, (lich - 0.3) * 5); r += (205 - r) * k * 0.7; g += (210 - g) * k * 0.7; b += (190 - b) * k * 0.7; }
      const lich2 = nz.pfbm2(u * 10 + 2, v * 10 + 7, 10, 10, 3);
      if (lich2 > 0.45) { const k = Math.min(1, (lich2 - 0.45) * 6); r += (190 - r) * k * 0.6; g += (120 - g) * k * 0.6; b += (70 - b) * k * 0.6; }
      put(i, r, g, b);
    } else { // ringed (palms, cecropia)
      const rings = 10;
      const wob = nz.pfbm2(u * 4, v * 4, 4, 4, 3) * 0.15;
      const ph = (v * rings + wob) % 1;
      const ring = Math.exp(-Math.pow((ph - 0.5) / 0.06, 2));
      const fine = nz.pfbm2(u * 24, v * 48, 24, 48, 3) * 0.5 + 0.5;
      const hh = 0.6 - ring * 0.5 + fine * 0.25;
      h[i] = hh;
      const base = 110 + fine * 40;
      put(i, base - ring * 50, base - 4 - ring * 48, base - 14 - ring * 40);
    }
  }
  const map = rgbTexture(rgb, W, H);
  const normalMap = heightToNormalTexture(h, W, H, kind === 'fissured' ? 6 : 3);
  return { map, normalMap };
}

// ---------------------------------------------------------------- sandstone rock
export function buildRock(seed = 13) {
  const W = 512, H = 512;
  const nz = createNoise(seed);
  const h = new Float32Array(W * H), rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, i = y * W + x;
    const warp = nz.pfbm2(u * 3, v * 3, 3, 3, 3) * 0.08;
    const band = Math.sin((v + warp) * Math.PI * 2 * 7) * 0.5 + 0.5;           // bedding layers
    const grit = nz.pfbm2(u * 24, v * 24, 24, 24, 3) * 0.5 + 0.5;
    const crack = Math.pow(1 - Math.abs(nz.pfbm2(u * 6 + 2, v * 4, 6, 4, 3)), 14);  // joints
    const hh = band * 0.35 + grit * 0.5 - crack * 0.6;
    h[i] = hh;
    const tone = 0.55 + 0.45 * band;
    let r = (120 + 60 * grit) * tone, g = (98 + 46 * grit) * tone, b = (78 + 36 * grit) * tone;
    r *= 1 - crack * 0.7; g *= 1 - crack * 0.7; b *= 1 - crack * 0.7;
    const algae = Math.max(0, nz.pfbm2(u * 5 + 7, v * 5, 5, 5, 4) - 0.1) * 1.6;
    r = r * (1 - algae * 0.5); g = g * (1 - algae * 0.25); b = b * (1 - algae * 0.55);
    rgb[i * 3] = Math.min(255, r); rgb[i * 3 + 1] = Math.min(255, g); rgb[i * 3 + 2] = Math.min(255, b);
  }
  return { map: rgbTexture(rgb, W, H), normalMap: heightToNormalTexture(h, W, H, 4) };
}

// ---------------------------------------------------------------- forest floor leaf litter
export function buildLitter(seed = 11) {
  const N = 1024;
  const cc = document.createElement('canvas'); cc.width = cc.height = N;
  const hc = document.createElement('canvas'); hc.width = hc.height = N;
  const cx = cc.getContext('2d'), hx = hc.getContext('2d');
  const rng = new RNG(seed);
  cx.fillStyle = '#24180f'; cx.fillRect(0, 0, N, N);
  hx.fillStyle = '#000'; hx.fillRect(0, 0, N, N);
  const cols = [[0x4a3018, 0x6a4422], [0x6e4a22, 0x94662e], [0x3a2614, 0x523618], [0x8a6a30, 0xa88a44], [0x5a3a1a, 0x7a5426], [0x2e2a16, 0x4a4222], [0x2a1e12, 0x3a2a18], [0x7a4a26, 0x8a3a1a], [0x4a4a2a, 0x5a5a32]];
  const count = 2600;
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, N), y = rng.range(0, N), rot = rng.range(0, 6.3);
    const L = rng.range(28, 95), W = L * rng.range(0.22, 0.42);
    const [c0, c1] = rng.pick(cols);
    const kind = rng.pick(['ovate', 'lance', 'oval']);
    const lvl = Math.round(40 + 215 * (i / count));
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      if (x + ox < -150 || x + ox > N + 150 || y + oy < -150 || y + oy > N + 150) continue;
      drawLeaf(cx, 'color', rng, { x: x + ox, y: y + oy, rot, L, W, kind, c0: jitterHex(c0, rng, 22), c1: jitterHex(c1, rng, 22), vein: 0x2a1a0a, veins: 5, veinAlpha: 0.25, speckle: 0.8, edge: false });
      hx.save(); hx.translate(x + ox, y + oy); hx.rotate(rot);
      pathFromOutline(hx, leafOutline(L, W, kind));
      const g = hx.createLinearGradient(-W, 0, W, 0);
      g.addColorStop(0, `rgb(${lvl - 30},${lvl - 30},${lvl - 30})`); g.addColorStop(0.5, `rgb(${lvl},${lvl},${lvl})`); g.addColorStop(1, `rgb(${lvl - 30},${lvl - 30},${lvl - 30})`);
      hx.fillStyle = g; hx.fill(); hx.restore();
    }
    if (i % 60 === 0) { // twigs
      const tx = rng.range(0, N), ty = rng.range(0, N), a = rng.range(0, 6.3), l = rng.range(80, 220);
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        stroke(cx, 'color', [[tx + ox, ty + oy], [tx + ox + Math.cos(a) * l, ty + oy + Math.sin(a) * l]], rng.range(3, 7), 0x3a2a1a);
        hx.strokeStyle = '#fff'; hx.lineWidth = 6; hx.beginPath(); hx.moveTo(tx + ox, ty + oy); hx.lineTo(tx + ox + Math.cos(a) * l, ty + oy + Math.sin(a) * l); hx.stroke();
      }
    }
  }
  const c = cx.getImageData(0, 0, N, N).data, hd = hx.getImageData(0, 0, N, N).data;
  const rgb = new Uint8Array(N * N * 3), h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) { rgb[i * 3] = c[i * 4]; rgb[i * 3 + 1] = c[i * 4 + 1]; rgb[i * 3 + 2] = c[i * 4 + 2]; h[i] = hd[i * 4] / 255; }
  return { map: rgbTexture(rgb, N, N), normalMap: heightToNormalTexture(h, N, N, 5) };
}

// ---------------------------------------------------------------- generic tileable noise (RGBA = 4 octaves)
export function buildNoiseTexture(seed = 5) {
  const N = 256, nz = createNoise(seed);
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = (y * N + x) * 4;
    d[i] = (nz.pfbm2(u * 4, v * 4, 4, 4, 4) * 0.5 + 0.5) * 255;
    d[i + 1] = (nz.pfbm2(u * 8 + 3, v * 8, 8, 8, 4) * 0.5 + 0.5) * 255;
    d[i + 2] = (nz.pfbm2(u * 16 + 7, v * 16, 16, 16, 3) * 0.5 + 0.5) * 255;
    d[i + 3] = (nz.pnoise2(u * 32, v * 32, 32, 32) * 0.5 + 0.5) * 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// soft radial sprite
export function buildSoftSprite(size = 128, hard = 0) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(hard, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

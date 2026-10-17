// Space-colonisation crown growth (Runions et al. 2007).
// Attraction points fill a crown envelope; branches grow toward them until the volume is
// colonised. The result is a skeleton (nodes + parents) whose radii follow the pipe model,
// so limbs thicken naturally where many twigs feed into them.
import * as THREE from 'three';

/**
 * opts: root (Vector3), rootR, center (Vector3), R (horizontal radius), Ry (vertical radius),
 *       yMin (no attractors below), count, D (step), di (influence), dk (kill), shell (0..1 bias to the
 *       outer shell), tropism (upward pull), rng, tipR
 */
export function colonize(o) {
  const rng = o.rng;
  // --- attraction points
  const ax = [], ay = [], az = [];
  let guard = 0;
  while (ax.length < o.count && guard++ < o.count * 40) {
    const x = rng.range(-1, 1), y = rng.range(-1, 1), z = rng.range(-1, 1);
    const l = Math.sqrt(x * x + y * y + z * z);
    if (l > 1) continue;
    if (l < o.shell && rng.next() > 0.2) continue; // leaves live mostly on the outer shell
    const wy = o.center.y + y * o.Ry;
    if (wy < o.yMin) continue;
    // umbrella crowns: squash the underside
    const wx = o.center.x + x * o.R * (o.lopsided ? 1 + o.lopsided.x * x : 1);
    const wz = o.center.z + z * o.R * (o.lopsided ? 1 + o.lopsided.z * z : 1);
    ax.push(wx); ay.push(wy); az.push(wz);
  }
  const A = ax.length;
  const alive = new Uint8Array(A).fill(1);
  const cl = new Int32Array(A).fill(-1);
  const cd = new Float32Array(A).fill(Infinity);
  // --- nodes
  const nx = [], ny = [], nz = [], par = [];
  const di2 = o.di * o.di, dk2 = o.dk * o.dk;
  const addNode = (x, y, z, p) => {
    const id = nx.length;
    nx.push(x); ny.push(y); nz.push(z); par.push(p);
    for (let a = 0; a < A; a++) {
      if (!alive[a]) continue;
      const dx = ax[a] - x, dy = ay[a] - y, dz = az[a] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < dk2) { alive[a] = 0; continue; }
      if (d2 < cd[a]) { cd[a] = d2; cl[a] = id; }
    }
    return id;
  };
  addNode(o.root.x, o.root.y, o.root.z, -1);
  // extend the leader until it reaches the crown
  const up = o.rootDir ? o.rootDir.clone() : new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < 60; k++) {
    let any = false;
    for (let a = 0; a < A; a++) if (alive[a] && cd[a] < di2) { any = true; break; }
    if (any) break;
    const last = nx.length - 1;
    addNode(nx[last] + up.x * o.D, ny[last] + up.y * o.D, nz[last] + up.z * o.D, last);
  }
  const maxNodes = o.count * 4;
  const sx = [], sy = [], sz = [], sc = [];
  for (let it = 0; it < 160 && nx.length < maxNodes; it++) {
    const n0 = nx.length;
    for (let i = 0; i < n0; i++) { sx[i] = 0; sy[i] = 0; sz[i] = 0; sc[i] = 0; }
    let influenced = 0;
    for (let a = 0; a < A; a++) {
      if (!alive[a] || cd[a] > di2) continue;
      const n = cl[a];
      let dx = ax[a] - nx[n], dy = ay[a] - ny[n], dz = az[a] - nz[n];
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      sx[n] += dx / l; sy[n] += dy / l; sz[n] += dz / l; sc[n]++;
      influenced++;
    }
    if (!influenced) break;
    let grown = 0;
    for (let n = 0; n < n0; n++) {
      if (!sc[n]) continue;
      let dx = sx[n] / sc[n] + (rng.next() - 0.5) * 0.15, dy = sy[n] / sc[n] + o.tropism, dz = sz[n] / sc[n] + (rng.next() - 0.5) * 0.15;
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (l < 1e-3) continue;
      dx /= l; dy /= l; dz /= l;
      const x = nx[n] + dx * o.D, y = ny[n] + dy * o.D, z = nz[n] + dz * o.D;
      addNode(x, y, z, n);
      grown++;
    }
    if (!grown) break;
  }
  // --- pipe-model radii
  const N = nx.length;
  const kids = new Int32Array(N);
  for (let i = 1; i < N; i++) kids[par[i]]++;
  const acc = new Float64Array(N);
  const r = new Float32Array(N);
  const EXP = 2.3;
  for (let i = N - 1; i >= 0; i--) {
    r[i] = kids[i] === 0 ? o.tipR : Math.pow(acc[i], 1 / EXP);
    if (par[i] >= 0) acc[par[i]] += Math.pow(r[i], EXP);
  }
  const s = o.rootR / Math.max(r[0], 1e-4);
  for (let i = 0; i < N; i++) r[i] = Math.max(o.tipR * 0.6, Math.min(r[i] * s, i === 0 ? o.rootR : r[par[i]]));
  return { x: nx, y: ny, z: nz, par, kids, r, N, attractors: A };
}

// Split a skeleton into chains (runs of single-child nodes) for tube emission.
export function chains(sk) {
  const childList = Array.from({ length: sk.N }, () => []);
  for (let i = 1; i < sk.N; i++) childList[sk.par[i]].push(i);
  const out = [];
  const starts = [0];
  while (starts.length) {
    const s = starts.pop();
    for (const c0 of childList[s]) {
      const chain = [s, c0];
      let c = c0;
      while (childList[c].length === 1) { c = childList[c][0]; chain.push(c); }
      out.push(chain);
      if (childList[c].length > 1) starts.push(c);
    }
  }
  return { list: out, childList };
}

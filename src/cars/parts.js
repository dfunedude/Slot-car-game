// ===== cars/parts: what every car is built from: body lofts, wheels, the slot car chassis, drivers =====
// Car coordinates: x forward, y up, z to the right; the origin is on the track surface midway between
// the axles. HO scale, so a car is about 2.6" long and 1.2" wide.
import * as THREE from 'three';
import { PI, TAU } from '../core/geometry.js';
import { GUIDE } from '../core/racer.js';
import { M, paint } from '../render/materials.js';
import { Kit, UNIT, mergeList } from '../render/kit.js';

// One cross-section of a body: a superellipse z = ±w, y from y0 to y1, rounder on top (nT) than
// underneath (nB); bigger n is boxier. zc shifts it sideways, top narrows the roofline.
function ring(s, N) {
  const pts = [], yc = (s.y0 + s.y1) / 2, hh = (s.y1 - s.y0) / 2;
  for (let j = 0; j < N; j++) {
    const a = j / N * TAU, c = Math.cos(a), sn = Math.sin(a);
    const n = sn >= 0 ? (s.nT ?? 2.6) : (s.nB ?? 5);
    const y = yc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
    // the sides draw in towards the roof by `top` (tumblehome)
    const narrow = sn > 0 ? 1 - (s.top ?? 0) * Math.pow(sn, 2) : 1;
    pts.push([(s.zc ?? 0) + s.w * narrow * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), y]);
  }
  return pts;
}
// skin a body through sections ordered from back to front; closed at both ends
export function loft(sections, N = 36) {
  const rings = sections.map(s => ring(s, N));
  const pos = [], idx = [];
  sections.forEach((s, i) => rings[i].forEach(([z, y]) => pos.push(s.x, y, z)));
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < N; j++) {
    const a = i * N + j, b = (i + 1) * N + j, c = (i + 1) * N + (j + 1) % N, d = i * N + (j + 1) % N;
    idx.push(a, b, d, b, c, d);
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shell.setIndex(idx);
  shell.computeVertexNormals();
  const parts = [shell];
  for (const [i, front] of [[0, false], [sections.length - 1, true]]) {
    const s = sections[i], R = rings[i], p = [], cy = (s.y0 + s.y1) / 2, cz = s.zc ?? 0;
    for (let j = 0; j < N; j++) {
      const A = R[j], B = R[(j + 1) % N];
      if (front) p.push(s.x, cy, cz, s.x, B[1], B[0], s.x, A[1], A[0]); else p.push(s.x, cy, cz, s.x, A[1], A[0], s.x, B[1], B[0]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeList(parts);
}
// a mirror pair: put the same part at +z and -z
export function pair(k, mat, geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  k.put(mat, geo, x, y, z, rx, ry, rz, sx, sy, sz);
  k.put(mat, geo, x, y, -z, -rx, -ry, rz, sx, sy, sz);
}

// ---- wheels ----
const discGeo = new THREE.CircleGeometry(1, 28);
const tyreGeo = (() => {
  // a tyre with rounded shoulders, turned about z
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = -PI / 2 + i / 8 * PI; pts.push(new THREE.Vector2(0.82 + 0.18 * Math.cos(a), 0.5 * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, 28).rotateX(PI / 2);
})();
// An axle's pair of wheels, built as its own mesh so it can turn. r: radius, w: tyre width,
// t: half the track (wheel centre from the car's centreline), rim: the rim's share of the radius.
export function axle(r, w, t, opts = {}) {
  const k = new Kit(), rim = opts.rim ?? 0.62, rimMat = opts.rimMat ?? M.mag;
  for (const s of [-1, 1]) {
    k.put(M.rubber, tyreGeo, 0, 0, s * t, 0, 0, 0, r, r, w);
    // lettered sidewall, then the rim face just proud of it, facing out
    k.put(M.sidewall, discGeo, 0, 0, s * (t + w * 0.5 + 0.002), 0, s > 0 ? 0 : PI, 0, r * 0.98, r * 0.98, 1);
    k.put(rimMat, discGeo, 0, 0, s * (t + w * 0.5 + 0.006), 0, s > 0 ? 0 : PI, 0, r * rim, r * rim, 1);
  }
  k.put(M.steel, UNIT.cylZ, 0, 0, 0, 0, 0, 0, 0.03, 0.03, 2 * t);
  const g = k.build();
  g.userData.r = r;
  return g;
}

// ---- underneath: the chassis, guide pin and pickup braids every slot car runs on ----
export function chassis(k, a, opts = {}) {
  const gx = a + GUIDE;
  k.box(M.black, 2 * a + 0.3, 0.07, opts.width ?? 0.78, 0, 0.1, 0);
  // the motor's can between the rear wheels, and its armature bulge
  k.cylZ(M.steel, 0.16, 0.5, -a + 0.3, 0.2, 0);
  // guide pin: a thin blade down into the slot, with copper braids lying on the rails either side
  k.box(M.black, 0.32, 0.18, 0.05, gx, 0.04, 0);
  k.box(M.black, 0.2, 0.05, 0.36, gx, 0.12, 0);
  for (const s of [-1, 1]) k.box(M.copper, 0.42, 0.02, 0.09, gx - 0.05, 0.012, s * 0.15);
}

// ---- the driver: helmet with a visor, shoulders in the overalls ----
export function driver(k, x, y, helmet, suit = 0xe8e2d4) {
  const hm = paint(helmet, 0.25, 0.1, 1.1);
  k.sphere(hm, 0.13, 0.135, 0.12, x, y, 0);
  k.put(M.glass, UNIT.sphere, x + 0.05, y + 0.005, 0, 0, 0, 0, 0.09, 0.05, 0.1);
  k.box(paint(suit, 0.7, 0, 0.3), 0.16, 0.12, 0.32, x - 0.04, y - 0.16, 0);
}
// a wing: a cambered plate with end plates, at (x, y), span 2·hs, chord c
export function wing(k, mat, x, y, hs, c, plateH = 0.18, pitch = 0.08) {
  k.box(mat, c, 0.035, hs * 2, x, y, 0, 0, 0, pitch);
  for (const s of [-1, 1]) k.box(mat, c * 1.15, plateH, 0.03, x - 0.02, y - plateH * 0.2, s * hs);
}
// lamps: a round lens pair at (x, y, ±z), facing forwards (dir 1) or back (dir -1)
export function lamps(k, mat, x, y, z, r, dir = 1) {
  pair(k, mat, UNIT.sphere, x, y, z, 0.03, r, r);
  if (dir) pair(k, M.chrome, UNIT.cylX, x - dir * 0.012, y, z, 0.02, r * 1.25, r * 1.25);
}

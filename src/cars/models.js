// ===== cars/models: the six cars, built from lofted body sections and detailed parts =====
// Each builder takes a livery (see cars/liveries.js) and returns the model: a root group with the
// body, and the two axles as their own meshes so the wheels can turn.
import * as THREE from 'three';
import { SPECS } from '../core/specs.js';
import { GUIDE } from '../core/racer.js';
import { M, paint, liveryMat } from '../render/materials.js';
import { Kit, UNIT } from '../render/kit.js';
import { loft, pair, axle, chassis, driver, wing, lamps } from './parts.js';
import { fill, rect, poly, text, roundel, arches, flames, ellipse } from './paintwork.js';

const S = (x, w, y0, y1, o = {}) => ({ x, w, y0, y1, ...o });
const half = key => (SPECS[key].wb - GUIDE) / 2;
// put the kit's body and the two axles together: front at +a, rear at -a
// eye: where the driver's eye (and the driver camera) sits, [x, y] on the centreline, placed clear of
// the helmet, roof and screen so nothing of the car's own comes within the camera's near clip
function assemble(k, a, front, rear, eye) {
  const root = new THREE.Group();
  root.add(k.build());
  front.position.set(a, front.userData.r, 0);
  rear.position.set(-a, rear.userData.r, 0);
  root.add(front, rear);
  return { root, axles: [front, rear], eye: new THREE.Vector3(eye[0], eye[1], 0) };
}
const loftMirror = (k, mat, sections, zc) => { for (const s of [-1, 1]) k.put(mat, loft(sections.map(q => ({ ...q, zc: s * zc })))); };

// ---------- Wedge F1: a 1972 formula car, wedge nose, side radiators, tall airbox ----------
function f1(L) {
  const a = half('f1'), k = new Kit();
  const box = { x0: -1.3, x1: 1.42, y0: 0.08, y1: 0.78, z0: -0.62, z1: 0.62 };
  const body = liveryMat('f1:' + L.id, box, {}, (g, v) => {
    fill(g, v, L.base);
    if (v.side === 'end') return;
    if (v.side === 'top') {
      rect(g, v, 0.25, 1.42, -0.06, 0.06, L.a);
      roundel(g, v, 0.92, 0, 0.085, L.num, L.round, L.numC);
      rect(g, v, -1.3, -0.95, -0.62, 0.62, L.a);
      text(g, v, L.sponsor, -0.22, 0.38, 0.09, L.text, { maxW: 0.6 });
      text(g, v, L.sponsor, -0.22, -0.38, 0.09, L.text, { maxW: 0.6 });
    } else {
      rect(g, v, -1.3, 1.42, 0.08, 0.17, L.a);
      text(g, v, L.sponsor, -0.1, 0.22, 0.1, L.text, { maxW: 0.8 });
      roundel(g, v, -0.24, 0.6, 0.075, L.num, L.round, L.numC);
      rect(g, v, -1.3, -0.95, 0.5, 0.78, L.a);
    }
  });
  k.put(body, loft([S(-1.08, 0.16, 0.14, 0.34, { nT: 3 }), S(-0.9, 0.25, 0.12, 0.4), S(-0.55, 0.3, 0.1, 0.42), S(-0.28, 0.3, 0.1, 0.4),
    S(0.02, 0.26, 0.1, 0.36), S(0.38, 0.21, 0.1, 0.29), S(0.78, 0.15, 0.1, 0.22), S(1.16, 0.1, 0.1, 0.16), S(1.36, 0.04, 0.11, 0.135)]));
  // the radiator pods either side, with a black intake on their noses
  loftMirror(k, body, [S(-0.6, 0.06, 0.12, 0.22), S(-0.45, 0.14, 0.1, 0.3, { nT: 4 }), S(0.2, 0.14, 0.1, 0.3, { nT: 4 }), S(0.34, 0.13, 0.1, 0.28, { nT: 4 })], 0.37);
  pair(k, M.matte, UNIT.box, 0.345, 0.19, 0.37, 0.02, 0.15, 0.22);
  // the airbox over the driver's head, mouth open at the front
  k.put(body, loft([S(-0.62, 0.05, 0.34, 0.44, { nT: 4 }), S(-0.42, 0.11, 0.36, 0.72, { nT: 4, nB: 4 }), S(-0.16, 0.12, 0.38, 0.74, { nT: 4, nB: 4 })]));
  k.box(M.matte, 0.02, 0.18, 0.18, -0.15, 0.62, 0);
  driver(k, 0.0, 0.42, L.helmet, L.suit);
  k.box(M.black, 0.03, 0.08, 0.2, 0.18, 0.4, 0);
  k.put(M.glass, UNIT.box, 0.22, 0.4, 0, 0, 0, -0.5, 0.02, 0.1, 0.22);
  pair(k, M.black, UNIT.box, 0.12, 0.42, 0.3, 0.06, 0.04, 0.05);
  // wings: a flat front wing on the nose, the rear one on a pylon
  wing(k, body, 1.2, 0.13, 0.58, 0.26, 0.12, 0.05);
  k.box(M.black, 0.12, 0.26, 0.04, -1.02, 0.48, 0);
  wing(k, paint(L.wingC ?? L.a), -1.12, 0.64, 0.52, 0.32, 0.26, 0.12);
  // gearbox, exhausts and an oil cooler out the back
  k.box(M.steel, 0.24, 0.14, 0.26, -1.12, 0.2, 0);
  pair(k, M.chrome, UNIT.cylX, -1.15, 0.27, 0.16, 0.3, 0.03, 0.03, 0, 0, 0.15);
  lamps(k, M.tail, -1.25, 0.24, 0.08, 0.025, 0);
  chassis(k, a, { width: 0.5 });
  return assemble(k, a, axle(0.19, 0.2, 0.5, { rim: 0.6 }), axle(0.25, 0.34, 0.52, { rim: 0.6 }), [0.17, 0.56]);
}

// ---------- Can-Am Spyder: open two-seat body, wheels under bulging fenders, stacks and a big wing ----------
function canam(L) {
  const a = half('canam'), k = new Kit();
  const box = { x0: -1.28, x1: 1.36, y0: 0.08, y1: 0.9, z0: -0.66, z1: 0.66 };
  const body = liveryMat('canam:' + L.id, box, {}, (g, v) => {
    fill(g, v, L.base);
    if (v.side === 'end') return;
    if (v.side === 'top') {
      rect(g, v, -1.28, 1.36, -0.1, 0.1, L.a);
      rect(g, v, -1.28, 1.36, -0.03, 0.03, L.b);
      roundel(g, v, 0.85, 0.45, 0.1, L.num, L.round, L.numC);
      roundel(g, v, 0.85, -0.45, 0.1, L.num, L.round, L.numC);
    } else {
      poly(g, v, [[-1.28, 0.16], [1.36, 0.14], [1.36, 0.22], [-1.28, 0.26]], L.a);
      roundel(g, v, 0.05, 0.27, 0.1, L.num, L.round, L.numC);
      text(g, v, L.sponsor, -0.72, 0.3, 0.09, L.text, { maxW: 0.55 });
      arches(g, v, [a, -a], 0.2);
    }
  });
  // the tub between the wheels, low nose and engine deck
  k.put(body, loft([S(-1.22, 0.32, 0.12, 0.34, { nT: 4 }), S(-0.9, 0.38, 0.1, 0.4, { nT: 4 }), S(-0.3, 0.4, 0.1, 0.38, { nT: 4 }), S(0.3, 0.38, 0.1, 0.32, { nT: 3 }),
    S(0.9, 0.36, 0.1, 0.24, { nT: 3 }), S(1.22, 0.3, 0.1, 0.16, { nT: 3 }), S(1.34, 0.22, 0.11, 0.13, { nT: 3 })]));
  // fenders bulging over the front and back wheels
  loftMirror(k, body, [S(0.32, 0.12, 0.2, 0.3), S(0.5, 0.18, 0.2, 0.42), S(0.95, 0.18, 0.18, 0.4), S(1.25, 0.12, 0.13, 0.22)], 0.46);
  loftMirror(k, body, [S(-1.25, 0.16, 0.18, 0.4, { nT: 4 }), S(-1.0, 0.2, 0.18, 0.48), S(-0.45, 0.2, 0.2, 0.46), S(-0.22, 0.14, 0.24, 0.36)], 0.46);
  // low wraparound screen, driver, roll bar
  k.put(M.glass, loft([S(0.16, 0.28, 0.3, 0.48, { nT: 2.2, top: 0.3 }), S(0.24, 0.3, 0.3, 0.42, { nT: 2.2, top: 0.3 }), S(0.36, 0.3, 0.3, 0.33)]));
  driver(k, -0.02, 0.44, L.helmet, L.suit);
  k.box(M.black, 0.04, 0.22, 0.34, -0.2, 0.46, 0.08);
  // velocity stacks standing out of the engine deck: eight of them in two rows
  for (const x of [-0.46, -0.62]) for (const z of [-0.18, -0.06, 0.06, 0.18]) k.cylY(M.chrome, 0.035, 0.12, x, 0.44, z);
  // the wing on two tall struts
  pair(k, M.black, UNIT.box, -1.02, 0.62, 0.26, 0.08, 0.46, 0.03);
  wing(k, paint(L.wingC ?? L.a), -1.08, 0.86, 0.58, 0.36, 0.22, 0.14);
  lamps(k, M.tail, -1.24, 0.28, 0.42, 0.04, 0);
  lamps(k, M.head, 1.18, 0.26, 0.42, 0.05, 1);
  chassis(k, a, { width: 0.6 });
  return assemble(k, a, axle(0.2, 0.24, 0.45, { rim: 0.6 }), axle(0.23, 0.32, 0.46, { rim: 0.6 }), [0.15, 0.58]);
}

// ---------- Long-tail Coupe: a 1970 endurance prototype, bubble cockpit and a long finned tail ----------
function longtail(L) {
  const a = half('longtail'), k = new Kit();
  const box = { x0: -1.66, x1: 1.3, y0: 0.08, y1: 0.62, z0: -0.64, z1: 0.64 };
  const body = liveryMat('longtail:' + L.id, box, {}, (g, v) => {
    fill(g, v, L.base);
    if (v.side === 'end') return;
    if (v.side === 'top') {
      rect(g, v, -1.66, 1.3, -0.16, 0.16, L.a);
      rect(g, v, 0.5, 1.3, -0.64, 0.64, L.b ?? L.a);
      roundel(g, v, 0.85, 0, 0.12, L.num, L.round, L.numC);
    } else {
      poly(g, v, [[1.3, 0.14], [-0.2, 0.22], [-1.66, 0.3], [-1.66, 0.38], [-0.2, 0.3], [1.3, 0.24]], L.a);
      roundel(g, v, 0.02, 0.27, 0.11, L.num, L.round, L.numC);
      text(g, v, L.sponsor, -0.95, 0.24, 0.1, L.text, { maxW: 0.7 });
      arches(g, v, [a, -a], 0.21);
    }
  });
  k.put(body, loft([S(-1.62, 0.36, 0.14, 0.36, { nT: 5 }), S(-1.2, 0.4, 0.11, 0.42, { nT: 5 }), S(-0.5, 0.42, 0.1, 0.42, { nT: 4 }), S(0.1, 0.42, 0.1, 0.34, { nT: 3 }),
    S(0.7, 0.4, 0.1, 0.27, { nT: 3 }), S(1.12, 0.36, 0.1, 0.2, { nT: 3 }), S(1.28, 0.28, 0.11, 0.15, { nT: 3 })]));
  // front fenders with their faired-in lamps, and the long rear fenders that end in the tail fins
  loftMirror(k, body, [S(0.25, 0.1, 0.2, 0.3), S(0.5, 0.19, 0.18, 0.42), S(0.95, 0.19, 0.16, 0.38), S(1.24, 0.13, 0.12, 0.24)], 0.44);
  loftMirror(k, body, [S(-1.64, 0.1, 0.14, 0.52, { nT: 6 }), S(-1.2, 0.17, 0.12, 0.5, { nT: 4 }), S(-0.5, 0.2, 0.15, 0.46), S(-0.2, 0.15, 0.2, 0.38)], 0.44);
  pair(k, M.glass, UNIT.sphere, 1.0, 0.36, 0.44, 0.16, 0.05, 0.1);
  pair(k, M.head, UNIT.sphere, 1.0, 0.345, 0.44, 0.08, 0.04, 0.06);
  // the bubble cockpit with its roof panel painted
  k.put(M.glass, loft([S(-0.48, 0.2, 0.3, 0.42), S(-0.25, 0.27, 0.3, 0.55, { nT: 2.2, top: 0.25 }), S(0.15, 0.28, 0.3, 0.56, { nT: 2.2, top: 0.25 }), S(0.5, 0.25, 0.28, 0.36)]));
  k.put(body, loft([S(-0.35, 0.16, 0.5, 0.555, { nT: 2 }), S(-0.15, 0.19, 0.53, 0.575, { nT: 2 }), S(0.12, 0.18, 0.53, 0.575, { nT: 2 })]));
  k.box(M.matte, 0.3, 0.012, 0.3, -0.85, 0.425, 0);
  for (let i = 0; i < 5; i++) k.box(M.black, 0.03, 0.02, 0.28, -0.72 - i * 0.07, 0.43, 0);
  lamps(k, M.tail, -1.63, 0.3, 0.3, 0.035, 0);
  chassis(k, a, { width: 0.6 });
  return assemble(k, a, axle(0.21, 0.24, 0.46), axle(0.23, 0.3, 0.46), [0.08, 0.45]);
}

// ---------- Pony Coupe: a 1970 Trans-Am fastback, chrome bumpers, hood scoop, ducktail ----------
function pony(L) {
  const a = half('pony'), k = new Kit();
  const box = { x0: -1.34, x1: 1.34, y0: 0.08, y1: 0.7, z0: -0.6, z1: 0.6 };
  const body = liveryMat('pony:' + L.id, box, {}, (g, v) => {
    fill(g, v, L.base);
    if (v.side === 'end') return;
    if (v.side === 'top') {
      for (const s of [-1, 1]) rect(g, v, -1.34, 1.34, s * 0.06, s * 0.16, L.a);
      roundel(g, v, -0.08, 0, 0.14, L.num, L.round, L.numC);
    } else {
      rect(g, v, -1.34, 1.34, 0.32, 0.36, L.a);
      roundel(g, v, 0.02, 0.25, 0.1, L.num, L.round, L.numC, L.square);
      text(g, v, L.sponsor, 0.75, 0.3, 0.08, L.text, { maxW: 0.55 });
      arches(g, v, [a, -a], 0.21);
    }
  });
  k.put(body, loft([S(-1.32, 0.5, 0.14, 0.38, { nT: 6, nB: 6 }), S(-1.2, 0.54, 0.12, 0.42, { nT: 6, nB: 6 }), S(-0.4, 0.56, 0.11, 0.42, { nT: 6, nB: 6 }),
    S(0.6, 0.56, 0.11, 0.41, { nT: 6, nB: 6 }), S(1.2, 0.54, 0.12, 0.38, { nT: 6, nB: 6 }), S(1.32, 0.5, 0.14, 0.34, { nT: 6, nB: 6 })]));
  // the greenhouse in glass, then the fastback roof painted over it down to the deck
  k.put(M.glass, loft([S(-0.85, 0.46, 0.38, 0.43, { nT: 3 }), S(-0.55, 0.44, 0.38, 0.57, { nT: 3, top: 0.18 }), S(-0.1, 0.43, 0.38, 0.65, { nT: 3, top: 0.18 }), S(0.22, 0.43, 0.38, 0.65, { nT: 3, top: 0.18 }), S(0.48, 0.46, 0.38, 0.42, { nT: 3 })]));
  k.put(body, loft([S(-0.98, 0.46, 0.39, 0.44, { nT: 2 }), S(-0.6, 0.42, 0.52, 0.58, { nT: 2 }), S(-0.15, 0.37, 0.6, 0.665, { nT: 2 }), S(0.2, 0.36, 0.6, 0.665, { nT: 2 })]));
  // hood scoop, ducktail spoiler
  k.put(body, loft([S(0.45, 0.1, 0.38, 0.44, { nT: 4 }), S(0.75, 0.12, 0.38, 0.48, { nT: 4 })]));
  k.box(M.matte, 0.01, 0.06, 0.18, 0.755, 0.45, 0);
  k.box(body, 0.14, 0.05, 1.04, -1.25, 0.44, 0, 0, 0, 0.35);
  // chrome bumpers, grille, quad lamps, taillights
  for (const x of [-1.34, 1.34]) k.box(M.chrome, 0.06, 0.07, 1.06, x, 0.19, 0);
  k.box(M.matte, 0.02, 0.13, 0.7, 1.33, 0.3, 0);
  lamps(k, M.head, 1.335, 0.3, 0.27, 0.045, 1);
  lamps(k, M.head, 1.335, 0.3, 0.38, 0.045, 1);
  pair(k, M.tail, UNIT.box, -1.33, 0.3, 0.32, 0.02, 0.06, 0.3);
  // side pipes and mirrors
  pair(k, M.chrome, UNIT.cylX, -0.1, 0.11, 0.53, 0.7, 0.03, 0.03);
  pair(k, M.chrome, UNIT.box, 0.45, 0.47, 0.52, 0.05, 0.04, 0.06);
  chassis(k, a, { width: 0.7 });
  return assemble(k, a, axle(0.21, 0.26, 0.45), axle(0.22, 0.3, 0.45), [0.1, 0.53]);
}

// ---------- Aero Stocker: a 1970 winged superspeedway car, nose cone and towering wing ----------
function aero(L) {
  const a = half('aero'), k = new Kit();
  const box = { x0: -1.42, x1: 1.72, y0: 0.08, y1: 1.0, z0: -0.62, z1: 0.62 };
  const body = liveryMat('aero:' + L.id, box, {}, (g, v) => {
    fill(g, v, L.base);
    if (v.side === 'end') return;
    if (v.side === 'top') {
      roundel(g, v, -0.05, 0, 0.2, L.num, L.round, L.numC, true);
      rect(g, v, 0.9, 1.72, -0.62, 0.62, L.a);
      text(g, v, L.sponsor, 0.55, 0, 0.12, L.text, { maxW: 0.9 });
    } else {
      rect(g, v, 0.9, 1.72, 0.08, 1, L.a);
      roundel(g, v, -0.05, 0.27, 0.13, L.num, L.round, L.numC, true);
      text(g, v, L.sponsor, -0.95, 0.3, 0.09, L.text, { maxW: 0.6 });
      text(g, v, L.sponsor, 0.65, 0.3, 0.07, L.text, { maxW: 0.4 });
      arches(g, v, [a, -a], 0.22);
    }
  });
  k.put(body, loft([S(-1.4, 0.52, 0.14, 0.4, { nT: 6, nB: 6 }), S(-1.2, 0.56, 0.12, 0.43, { nT: 6, nB: 6 }), S(0.6, 0.56, 0.11, 0.42, { nT: 6, nB: 6 }),
    S(1.15, 0.53, 0.12, 0.38, { nT: 4, nB: 5 }), S(1.42, 0.42, 0.13, 0.3, { nT: 3, nB: 4 }), S(1.62, 0.24, 0.15, 0.23, { nT: 2.5, nB: 3 }), S(1.7, 0.08, 0.17, 0.2, { nT: 2 })]));
  k.put(M.glass, loft([S(-0.75, 0.47, 0.4, 0.44, { nT: 3 }), S(-0.45, 0.45, 0.4, 0.66, { nT: 3, top: 0.2 }), S(0.15, 0.44, 0.4, 0.68, { nT: 3, top: 0.2 }), S(0.45, 0.46, 0.4, 0.44, { nT: 3 })]));
  k.put(body, loft([S(-0.55, 0.42, 0.58, 0.64, { nT: 2 }), S(-0.4, 0.39, 0.64, 0.695, { nT: 2 }), S(0.1, 0.38, 0.64, 0.695, { nT: 2 })]));
  // the wing: two swept fins rising off the rear deck and a blade across their tops
  for (const s of [-1, 1]) k.put(body, UNIT.box, -1.18, 0.7, s * 0.47, 0, 0, -0.25, 0.22, 0.6, 0.04);
  wing(k, paint(L.wingC ?? L.a), -1.28, 0.98, 0.5, 0.26, 0.04, 0.05);
  // headlight pods in the cone, chrome where the bumper used to be at the back, a fuel filler
  pair(k, M.matte, UNIT.sphere, 1.5, 0.25, 0.22, 0.12, 0.02, 0.05);
  k.box(M.chrome, 0.05, 0.07, 1.08, -1.41, 0.18, 0);
  pair(k, M.tail, UNIT.box, -1.4, 0.32, 0.3, 0.02, 0.05, 0.36);
  k.cylZ(M.chrome, 0.06, 0.02, -0.75, 0.38, -0.565);
  // window net and a roll cage glimpse
  k.box(M.black, 0.2, 0.12, 0.005, -0.05, 0.52, 0.462);
  chassis(k, a, { width: 0.7 });
  return assemble(k, a, axle(0.22, 0.26, 0.46), axle(0.22, 0.28, 0.46), [0.05, 0.56]);
}

// ---------- Street Van: a 1977 custom van, porthole windows, side pipes, murals ----------
function van(L) {
  const a = half('van'), k = new Kit();
  const box = { x0: -1.18, x1: 1.2, y0: 0.08, y1: 1.02, z0: -0.6, z1: 0.6 };
  const body = liveryMat('van:' + L.id, box, {}, (g, v) => {
    fill(g, v, L.base);
    if (v.side === 'end') return;
    if (v.side === 'top') {
      for (let i = 0; i < 3; i++) rect(g, v, -1.18, 0.6, -0.4 + i * 0.3, -0.3 + i * 0.3, L.stripes[i]);
    } else if (L.style === 'flames') {
      flames(g, v, -0.6, 1.2, 0.22, 0.75, L.stripes);
      text(g, v, L.sponsor, -0.62, 0.84, 0.1, L.text, { maxW: 0.9, font: 'Georgia, serif', weight: 700 });
    } else {
      L.stripes.forEach((c, i) => poly(g, v, [[1.2, 0.72 - i * 0.1], [0.2, 0.72 - i * 0.1], [-0.2, 0.36 - i * 0.1], [-1.18, 0.36 - i * 0.1], [-1.18, 0.29 - i * 0.1], [-0.22, 0.29 - i * 0.1], [0.18, 0.65 - i * 0.1], [1.2, 0.65 - i * 0.1]], c));
      text(g, v, L.sponsor, -0.55, 0.8, 0.12, L.text, { maxW: 0.9, font: 'Georgia, serif', weight: 700 });
    }
    if (v.side !== 'top') {
      ellipse(g, v, -0.42, 0.6, 0.17, 0.14, 0x0a0a0a);
      arches(g, v, [a, -a], 0.22);
    }
  });
  k.put(body, loft([S(-1.16, 0.52, 0.12, 0.95, { nT: 7, nB: 7, top: 0.06 }), S(-1.05, 0.56, 0.12, 1.0, { nT: 7, nB: 7, top: 0.06 }), S(0.8, 0.56, 0.12, 1.0, { nT: 7, nB: 7, top: 0.06 }),
    S(1.0, 0.56, 0.12, 0.72, { nT: 5, nB: 7 }), S(1.18, 0.52, 0.13, 0.48, { nT: 4, nB: 6 })]));
  // windscreen and front side glass, raked; rear doors' little windows
  k.put(M.glass, UNIT.box, 0.92, 0.82, 0, 0, 0, -0.85, 0.02, 0.3, 0.98);
  pair(k, M.glass, UNIT.box, 0.6, 0.78, 0.56, 0.36, 0.22, 0.012);
  pair(k, M.glass, UNIT.box, -1.163, 0.75, 0.22, 0.012, 0.2, 0.18);
  // the bubble portholes
  pair(k, M.glass, UNIT.sphere, -0.42, 0.6, 0.555, 0.15, 0.12, 0.04);
  // roof spoiler, roof vent, chrome bumpers, side pipes, lamps
  k.box(body, 0.2, 0.05, 1.08, -1.08, 1.0, 0, 0, 0, 0.3);
  k.box(M.matte, 0.3, 0.04, 0.3, 0.1, 1.01, 0);
  for (const x of [-1.18, 1.19]) k.box(M.chrome, 0.06, 0.08, 1.1, x, 0.2, 0);
  k.box(M.matte, 0.02, 0.12, 0.62, 1.185, 0.36, 0);
  lamps(k, M.head, 1.19, 0.37, 0.4, 0.06, 1);
  pair(k, M.tail, UNIT.box, -1.17, 0.42, 0.45, 0.02, 0.16, 0.06);
  pair(k, M.chrome, UNIT.cylX, 0.0, 0.11, 0.55, 0.85, 0.035, 0.035);
  pair(k, M.chrome, UNIT.box, 0.85, 0.72, 0.6, 0.04, 0.06, 0.06);
  chassis(k, a, { width: 0.7 });
  return assemble(k, a, axle(0.22, 0.26, 0.46), axle(0.22, 0.3, 0.46), [0.7, 0.8]);
}

export const BUILDERS = { f1, canam, longtail, pony, aero, van };

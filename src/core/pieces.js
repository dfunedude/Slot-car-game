// ===== core/pieces: the track pieces, their slots (lanes), and how each palette button attaches one =====
import { PI, ARC, TRACK_W, TRACK_TOP, LANE, BANK, S9, lineRoute, arcRoute, E, smooth } from './geometry.js';

// Lanes. Every piece carries one lane per slot per route, sampled into tables in its own frame.
// A lane runs from end a to end b. At each end its slot has an index seen looking out of that end:
// 0 is the left slot, 1 the right. Two joined ends face each other, so slot i on one side of a joint
// is slot 1 - i on the other.
const STEP = 0.1;
// build a lane from a centreline route, a lateral offset off(t) (right of travel) and a bank phi(t)
// (positive raises the left side of the track)
function makeLane(route, off, phi = () => 0) {
  // fine samples along the centreline, then resampled evenly by distance along the slot
  const N = Math.max(8, Math.ceil(route.len / 0.03)), raw = [];
  const q = {};
  for (let i = 0; i <= N; i++) {
    const t = route.len * i / N;
    route.at(t, q);
    const f = phi(t), o = off(t), dt = route.len / N;
    const dOff = (off(Math.min(route.len, t + dt * 0.5)) - off(Math.max(0, t - dt * 0.5))) / dt;
    const lat = o * Math.cos(f);
    const nx = -Math.sin(q.h), nz = Math.cos(q.h);
    raw.push({ x: q.x + nx * lat, z: q.z + nz * lat, h: q.h + Math.atan(dOff), y: TRACK_TOP + (TRACK_W / 2) * Math.abs(Math.sin(f)) - o * Math.sin(f), roll: f });
  }
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z));
  const len = cum[N], n = Math.max(2, Math.ceil(len / STEP)), ds = len / n;
  const T = { X: new Float32Array(n + 1), Z: new Float32Array(n + 1), H: new Float32Array(n + 1), Y: new Float32Array(n + 1), RL: new Float32Array(n + 1), K: new Float32Array(n + 1) };
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const s = i * ds;
    while (j < N - 1 && cum[j + 1] < s) j++;
    const u = Math.min(1, (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j])), A = raw[j], B = raw[j + 1];
    T.X[i] = A.x + (B.x - A.x) * u; T.Z[i] = A.z + (B.z - A.z) * u; T.Y[i] = A.y + (B.y - A.y) * u;
    T.H[i] = A.h + (B.h - A.h) * u; T.RL[i] = A.roll + (B.roll - A.roll) * u;
  }
  // signed curvature (positive turning right) from the heading's rate of change
  for (let i = 0; i <= n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
    T.K[i] = (T.H[b] - T.H[a]) / ((b - a) * ds);
  }
  const o0 = off(0), o1 = off(route.len);
  return {
    a: route.a, b: route.b, la: o0 > 0 ? 0 : 1, lb: o1 > 0 ? 1 : 0, len, n, ds, ...T,
    // the point t inches along the slot: x, z, heading h, surface height y, roll and curvature k
    at(t, out = {}) {
      const f = Math.max(0, Math.min(n, t / ds)), i = Math.min(n - 1, f | 0), u = f - i;
      out.x = T.X[i] + (T.X[i + 1] - T.X[i]) * u; out.z = T.Z[i] + (T.Z[i + 1] - T.Z[i]) * u;
      out.h = T.H[i] + (T.H[i + 1] - T.H[i]) * u; out.y = T.Y[i] + (T.Y[i + 1] - T.Y[i]) * u;
      out.roll = T.RL[i] + (T.RL[i + 1] - T.RL[i]) * u; out.k = T.K[i] + (T.K[i + 1] - T.K[i]) * u;
      return out;
    },
  };
}
const twoLanes = (route, phi) => [makeLane(route, () => -LANE, phi), makeLane(route, () => LANE, phi)];

function straight(name, len, extra = {}) {
  const r = lineRoute(0, 1, 0, 0, 0, len);
  return { name, len, ends: [E(0, 0, PI), E(len, 0, 0)], routes: [r], lanes: twoLanes(r), ...extra };
}
function curve(R) {
  const r = arcRoute(0, 1, 0, 0, 0, R, ARC, 1);
  const e = r.at(r.len);
  return { name: `Curve ${R}″`, R, curve: true, ends: [E(0, 0, PI), E(e.x, e.z, ARC)], routes: [r], lanes: twoLanes(r) };
}
// Banked turns tilt up to BANK, easing in and out over the first and last 20° so they meet flat track.
function banked(R, ang) {
  const r = arcRoute(0, 1, 0, 0, 0, R, ang, 1);
  const ramp = R * (20 * PI / 180);
  const phi = t => BANK * smooth(Math.min(t, r.len - t) / ramp);
  const e = r.at(r.len);
  return { name: `Banked ${Math.round(ang * 180 / PI)}°`, R, curve: true, banked: true, phi, ends: [E(0, 0, PI), E(e.x, e.z, ang)], routes: [r], lanes: twoLanes(r, phi) };
}
export const XC = 3;   // half the crossing: 3" arms plus a 9" straight meet a 12" curve, so figure eights close
export const START_T = 4.5;   // the start/finish line, along the start piece

export const PIECES = {
  straight: straight('Straight 9″', S9),
  short: straight('Straight 4½″', S9 / 2),
  long: straight('Straight 15″', 15),
  start: straight('Start / finish', S9, { start: true }),
  curve6: curve(6), curve9: curve(9), curve12: curve(12), curve15: curve(15),
  bank90: banked(12, PI / 2),
  bank180: banked(12, PI),
  // criss-cross: the slots swap sides, so both lanes come out the same length over a lap
  swap: (() => {
    const r = lineRoute(0, 1, 0, 0, 0, S9);
    const off = s => t => s * LANE * Math.cos(PI * t / S9);
    return { name: 'Lane swap', swap: true, ends: [E(0, 0, PI), E(S9, 0, 0)], routes: [r], lanes: [makeLane(r, off(1)), makeLane(r, off(-1))] };
  })(),
  cross: (() => {
    const A = lineRoute(0, 1, -XC, 0, 0, 2 * XC), B = lineRoute(2, 3, 0, -XC, PI / 2, 2 * XC);
    return { name: '90° crossing', cross: true, ends: [E(-XC, 0, PI), E(XC, 0, 0), E(0, -XC, -PI / 2), E(0, XC, PI / 2)], routes: [A, B], lanes: [...twoLanes(A), ...twoLanes(B)] };
  })(),
};
for (const [type, def] of Object.entries(PIECES)) {
  def.type = type;
  // centroid of each piece, used as the pivot when a loose piece is rotated
  let sx = 0, sz = 0, n = 0;
  for (const r of def.routes) for (let i = 0; i <= 8; i++) { const q = r.at(r.len * i / 8); sx += q.x; sz += q.z; n++; }
  def.cx = sx / n; def.cz = sz / n;
}

// How each palette button attaches to an open end: which end of the new piece meets the joint, and
// which end becomes the next place to build from. Curves turn right as built; taking them from the
// other end turns left.
export const APPEND = {
  straight: { type: 'straight', at: 0, next: 1 },
  short: { type: 'short', at: 0, next: 1 },
  long: { type: 'long', at: 0, next: 1 },
  start: { type: 'start', at: 0, next: 1 },
  swap: { type: 'swap', at: 0, next: 1 },
  cross: { type: 'cross', at: 0, next: 1 },
};
for (const R of [6, 9, 12, 15]) {
  APPEND[`c${R}L`] = { type: `curve${R}`, at: 1, next: 0 };
  APPEND[`c${R}R`] = { type: `curve${R}`, at: 0, next: 1 };
}
for (const t of ['bank90', 'bank180']) {
  APPEND[t + 'L'] = { type: t, at: 1, next: 0 };
  APPEND[t + 'R'] = { type: t, at: 0, next: 1 };
}

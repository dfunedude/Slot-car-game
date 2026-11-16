// ===== core/pieces: the track pieces, their slots (lanes), and how each palette button attaches one =====
import { PI, ARC, TRACK_TOP, SPACING, BANK, S9, widthOf, lineRoute, arcRoute, E, smooth } from './geometry.js';

// Lanes. Every piece carries one lane per slot per route, sampled into tables in its own frame.
// A lane runs from end a to end b. At each end its slot has an index seen looking out of that end,
// counting from the left: 0 and 1 on two-lane track, 0 to 3 on four-lane. Two joined ends face each
// other, so slot i on one side of a joint is slot nl - 1 - i on the other. Pieces only join pieces
// with the same number of lanes.
const STEP = 0.1;
// build a lane from a centreline route, a lateral offset off(t) (right of travel) and a bank phi(t)
// (positive raises the left side of the track). nl is the piece's lane count, ri which of its
// routes the lane follows (only a crossing has two).
function makeLane(route, off, phi = () => 0, nl = 2, ri = 0) {
  const HW = widthOf(nl) / 2;
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
    raw.push({ x: q.x + nx * lat, z: q.z + nz * lat, h: q.h + Math.atan(dOff), y: TRACK_TOP + HW * Math.abs(Math.sin(f)) - o * Math.sin(f), roll: f });
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
  // the slot index at each end, counted from the left looking out of that end
  const o0 = off(0), o1 = off(route.len), mid = (nl - 1) / 2;
  return {
    a: route.a, b: route.b, la: Math.round(mid - o0 / SPACING), lb: Math.round(mid + o1 / SPACING), route: ri, len, n, ds, ...T,
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
// the lateral offsets of a piece's slots, left to right across the direction of travel
const offsets = nl => Array.from({ length: nl }, (_, i) => (i - (nl - 1) / 2) * SPACING);
const lanesOf = (route, nl, phi, ri = 0) => offsets(nl).map(o => makeLane(route, () => o, phi, nl, ri));
const wide = (nl, name) => (nl === 4 ? `${name} (4)` : name);

function straight(name, len, nl, extra = {}) {
  const r = lineRoute(0, 1, 0, 0, 0, len);
  return { name: wide(nl, name), len, ends: [E(0, 0, PI), E(len, 0, 0)], routes: [r], lanes: lanesOf(r, nl), ...extra };
}
function curve(R, nl) {
  const r = arcRoute(0, 1, 0, 0, 0, R, ARC, 1);
  const e = r.at(r.len);
  return { name: wide(nl, `Curve ${R}″`), R, curve: true, ends: [E(0, 0, PI), E(e.x, e.z, ARC)], routes: [r], lanes: lanesOf(r, nl) };
}
// Banked turns tilt up to BANK, easing in and out over the first and last 20° so they meet flat track.
function banked(R, ang, nl) {
  const r = arcRoute(0, 1, 0, 0, 0, R, ang, 1);
  const ramp = R * (20 * PI / 180);
  const phi = t => BANK * smooth(Math.min(t, r.len - t) / ramp);
  const e = r.at(r.len);
  return { name: wide(nl, `Banked ${Math.round(ang * 180 / PI)}°`), R, curve: true, banked: true, phi, ends: [E(0, 0, PI), E(e.x, e.z, ang)], routes: [r], lanes: lanesOf(r, nl, phi) };
}
// criss-cross: every slot swings across to the mirror-image side, so over two laps each car runs
// the same distance whichever lane it started in. On four-lane track it's longer, so the swing is
// as gentle as on two-lane.
function swap(len, nl) {
  const r = lineRoute(0, 1, 0, 0, 0, len);
  const lanes = offsets(nl).map(o => makeLane(r, t => -o * Math.cos(PI * t / len), undefined, nl));
  return { name: wide(nl, 'Lane swap'), len, swap: true, ends: [E(0, 0, PI), E(len, 0, 0)], routes: [r], lanes };
}
function cross(xc, nl) {
  const A = lineRoute(0, 1, -xc, 0, 0, 2 * xc), B = lineRoute(2, 3, 0, -xc, PI / 2, 2 * xc);
  return { name: wide(nl, '90° crossing'), xc, cross: true, ends: [E(-xc, 0, PI), E(xc, 0, 0), E(0, -xc, -PI / 2), E(0, xc, PI / 2)], routes: [A, B], lanes: [...lanesOf(A, nl, undefined, 0), ...lanesOf(B, nl, undefined, 1)] };
}
// Crossing arms: plus a 9" straight they meet the figure-eight curve (12" on two-lane, 15" on four)
export const XC = 3;
export const START_T = 4.5;   // the start/finish line, along the start piece

export const PIECES = {
  straight: straight('Straight 9″', S9, 2),
  short: straight('Straight 4½″', S9 / 2, 2),
  long: straight('Straight 15″', 15, 2),
  start: straight('Start / finish', S9, 2, { start: true }),
  curve6: curve(6, 2), curve9: curve(9, 2), curve12: curve(12, 2), curve15: curve(15, 2),
  bank90: banked(12, PI / 2, 2),
  bank180: banked(12, PI, 2),
  swap: swap(S9, 2),
  cross: cross(XC, 2),
  // four-lane track: twice as wide, with curves big enough for the inside lane
  wstraight: straight('Straight 9″', S9, 4),
  wshort: straight('Straight 4½″', S9 / 2, 4),
  wlong: straight('Straight 15″', 15, 4),
  wstart: straight('Start / finish', S9, 4, { start: true }),
  wcurve12: curve(12, 4), wcurve15: curve(15, 4), wcurve18: curve(18, 4),
  wbank90: banked(15, PI / 2, 4),
  wbank180: banked(15, PI, 4),
  wswap: swap(15, 4),
  wcross: cross(6, 4),
};
for (const [type, def] of Object.entries(PIECES)) {
  def.type = type;
  def.nl = def.lanes.length / def.routes.length;
  def.width = widthOf(def.nl);
  // centroid of each piece, used as the pivot when a loose piece is rotated
  let sx = 0, sz = 0, n = 0;
  for (const r of def.routes) for (let i = 0; i <= 8; i++) { const q = r.at(r.len * i / 8); sx += q.x; sz += q.z; n++; }
  def.cx = sx / n; def.cz = sz / n;
}

// How each palette button attaches to an open end: which end of the new piece meets the joint, and
// which end becomes the next place to build from. Curves turn right as built; taking them from the
// other end turns left. Four-lane kinds start with w.
export const APPEND = {};
for (const w of ['', 'w']) {
  for (const t of ['straight', 'short', 'long', 'start', 'swap', 'cross']) APPEND[w + t] = { type: w + t, at: 0, next: 1 };
  for (const R of w ? [12, 15, 18] : [6, 9, 12, 15]) {
    APPEND[`${w}c${R}L`] = { type: `${w}curve${R}`, at: 1, next: 0 };
    APPEND[`${w}c${R}R`] = { type: `${w}curve${R}`, at: 0, next: 1 };
  }
  for (const t of ['bank90', 'bank180']) {
    APPEND[`${w}${t}L`] = { type: w + t, at: 1, next: 0 };
    APPEND[`${w}${t}R`] = { type: w + t, at: 0, next: 1 };
  }
}

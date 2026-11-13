// ===== core/geometry: HO slot track dimensions, angle helpers and route shapes (no rendering) =====
// Units are inches. The table is the x/z plane; heading 0 points along +x and positive heading
// changes turn right (clockwise seen from above). "Right of travel" is the normal (-sin h, cos h).

export const PI = Math.PI;
export const TAU = PI * 2;
export const TRACK_W = 3.4;          // two-lane HO track, edge to edge
export const LANE = 0.85;            // each slot sits this far from the centreline (1.7" lane spacing)
export const TRACK_TOP = 0.22;       // the running surface stands this high off the table
export const S9 = 9;                 // standard straight
export const ARC = PI / 4;           // every curve is an eighth of a circle
export const RADII = [6, 9, 12, 15]; // curve radii, to the centreline
export const BANK = 0.42;            // banked curve tilt at its steepest (about 24°)
export const TABLE_W = 96;           // a 4 x 8 ft sheet of plywood
export const TABLE_D = 48;
export const G = 386;                // gravity, in/s²

export function normAng(a) { a %= TAU; if (a > PI) a -= TAU; if (a <= -PI) a += TAU; return a; }
export function rot2(x, z, r) { const c = Math.cos(r), s = Math.sin(r); return [x * c - z * s, x * s + z * c]; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// A centreline route's at(t) gives the point t inches along it, as { x, z, h }.
export function lineRoute(a, b, x0, z0, h, len) {
  const c = Math.cos(h), s = Math.sin(h);
  return { a, b, len, kind: 'line', turn: 0, at(t, out = {}) { out.x = x0 + c * t; out.z = z0 + s * t; out.h = h; return out; } };
}
export function arcRoute(a, b, x0, z0, h0, R, ang, turn) {
  const cx = x0 - Math.sin(h0) * R * turn, cz = z0 + Math.cos(h0) * R * turn;
  return {
    a, b, len: R * ang, kind: 'arc', R, turn,
    at(t, out = {}) { const h = h0 + turn * t / R; out.x = cx + turn * R * Math.sin(h); out.z = cz - turn * R * Math.cos(h); out.h = h; return out; },
  };
}
export const E = (x, z, h) => ({ x, z, h });

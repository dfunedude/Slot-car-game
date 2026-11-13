// ===== core/path: a car's slot, a run of lane segments extended lazily at either end =====
import { PI } from './geometry.js';
import { START_T } from './pieces.js';

// A segment is one lane of one piece, run forwards (d = 1, end a to b) or backwards (d = -1).
// s0 is where it starts along the path; the path's distances only ever grow as the car runs on.
export class LanePath {
  constructor() { this.segs = []; this._q = {}; }
  seg(p, l, d, s0) { return { p, l, d, len: p.def.lanes[l].len, s0 }; }
  // where a segment leaves its piece: which end, and which slot looking out of that end
  exitOf(g) { const L = g.p.def.lanes[g.l]; return g.d > 0 ? { end: L.b, slot: L.lb } : { end: L.a, slot: L.la }; }
  entryOf(g) { const L = g.p.def.lanes[g.l]; return g.d > 0 ? { end: L.a, slot: L.la } : { end: L.b, slot: L.lb }; }
  // the lane of piece p that enters through end e in slot (as seen looking out of e)
  static laneAt(p, e, slot) {
    const ls = p.def.lanes;
    for (let l = 0; l < ls.length; l++) {
      if (ls[l].a === e && ls[l].la === slot) return { l, d: 1 };
      if (ls[l].b === e && ls[l].lb === slot) return { l, d: -1 };
    }
    return null;
  }
  get s0() { return this.segs[0].s0; }
  get s1() { const l = this.segs[this.segs.length - 1]; return l.s0 + l.len; }
  extendFront() {
    const last = this.segs[this.segs.length - 1];
    const x = this.exitOf(last), c = last.p.conn[x.end];
    if (!c) return false;
    const n = LanePath.laneAt(c.p, c.i, 1 - x.slot);
    if (!n) return false;
    this.segs.push(this.seg(c.p, n.l, n.d, last.s0 + last.len));
    return true;
  }
  extendBack() {
    const first = this.segs[0];
    const x = this.entryOf(first), c = first.p.conn[x.end];
    if (!c) return false;
    // running backwards into the neighbour: find its lane that leaves through c.i, then flip it
    const n = LanePath.laneAt(c.p, c.i, 1 - x.slot);
    if (!n) return false;
    const L = c.p.def.lanes[n.l];
    this.segs.unshift(this.seg(c.p, n.l, -n.d, first.s0 - L.len));
    return true;
  }
  // make sure the path covers lo..hi (as far as the track goes); returns false if it ends before hi
  cover(lo, hi) {
    while (this.s1 < hi) if (!this.extendFront()) break;
    while (this.s0 > lo) if (!this.extendBack()) break;
    // drop what's far behind and far ahead, so a lap of the layout doesn't pile up segments
    while (this.segs.length > 1 && this.segs[0].s0 + this.segs[0].len < lo - 2) this.segs.shift();
    while (this.segs.length > 1 && this.segs[this.segs.length - 1].s0 > hi + 40) this.segs.pop();
    return this.s1 >= hi;
  }
  segAt(s) {
    let g = this.segs[0];
    for (let i = 1; i < this.segs.length; i++) { if (s >= this.segs[i].s0) g = this.segs[i]; else break; }
    return g;
  }
  // the world pose s inches along the path: x, z, heading h, height y, roll and curvature k
  at(s, out) {
    const g = this.segAt(s);
    const u = Math.max(0, Math.min(g.len, s - g.s0));
    const q = g.p.def.lanes[g.l].at(g.d > 0 ? u : g.len - u, this._q);
    const c = Math.cos(g.p.rot), sn = Math.sin(g.p.rot);
    out.x = g.p.x + q.x * c - q.z * sn;
    out.z = g.p.z + q.x * sn + q.z * c;
    out.h = q.h + g.p.rot + (g.d > 0 ? 0 : PI);
    out.y = q.y;
    out.roll = g.d > 0 ? q.roll : -q.roll;
    out.k = g.d > 0 ? q.k : -q.k;
    out.seg = g;
    return out;
  }
  uses(p) { return this.segs.some(g => g.p === p); }
  // where the start line falls on segment g, in path distance, or NaN if g isn't a start piece
  lineOn(g) { return g.p.def.start ? g.s0 + (g.d > 0 ? START_T : g.len - START_T) : NaN; }
}

// The closest point on any lane to (x, z). slot picks one lane per route side when given.
export function nearestLanePoint(layout, x, z, filter) {
  let best = null;
  const q = {};
  for (const p of layout.pieces) {
    if (p.lifted) continue;
    p.def.lanes.forEach((L, l) => {
      if (filter && !filter(p, l)) return;
      const n = Math.max(2, Math.ceil(L.len / 0.4));
      for (let i = 0; i <= n; i++) {
        const u = L.len * i / n;
        L.at(u, q);
        const c = Math.cos(p.rot), s = Math.sin(p.rot);
        const wx = p.x + q.x * c - q.z * s, wz = p.z + q.x * s + q.z * c;
        const cost = Math.hypot(wx - x, wz - z);
        if (!best || cost < best.cost) best = { cost, p, l, u };
      }
    });
  }
  return best;
}

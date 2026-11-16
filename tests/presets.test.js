// Every preset must close, stay on the table, keep unrelated track far enough apart that cars in
// neighbouring lanes don't touch, and give both slots a full lap back to the start line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLE_W, TABLE_D } from '../src/core/geometry.js';
import { Layout } from '../src/core/layout.js';
import { PRESETS, buildPreset } from '../src/core/presets.js';
import { LanePath } from '../src/core/path.js';

// the track's edge stays this far in from the table's, and unrelated track this far apart
const EDGE = 0.6, GAP = 0.4;

export function lapOf(L, slot) {
  const st = L.startPiece();
  const P = new LanePath();
  const n = LanePath.laneAt(st, 0, slot);
  P.segs = [P.seg(st, n.l, n.d, 0)];
  let pieces = 1;
  while (pieces < 400) {
    if (!P.extendFront()) return { closed: false };
    pieces++;
    const g = P.segs[P.segs.length - 1];
    if (g.p === st) return { closed: true, len: g.s0, pieces, slotBack: P.entryOf(g).slot };
  }
  return { closed: false };
}

for (const key of Object.keys(PRESETS)) {
  test(`preset ${key} (${PRESETS[key].name})`, () => {
    const L = new Layout(); buildPreset(L, key);
    const issues = [];
    const free = L.freeEnds();
    if (free.length) issues.push(`${free.length} open ends`);
    if (!L.startPiece()) issues.push('no start piece');
    const pts = [];
    for (const p of L.pieces) for (const r of p.def.routes) for (let i = 0; i <= 12; i++) pts.push({ p, ...L.toWorld(p, r.at(r.len * i / 12)) });
    for (const q of pts) {
      const hw = q.p.def.width / 2 + EDGE;
      if (Math.abs(q.x) > TABLE_W / 2 - hw || Math.abs(q.z) > TABLE_D / 2 - hw) { issues.push(`off table at ${q.x.toFixed(1)},${q.z.toFixed(1)}`); break; }
    }
    const near = (a, b) => a === b || a.conn.some(c => c && (c.p === b || c.p.conn.some(d => d && d.p === b)));
    let worst = Infinity, pair = '';
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if (near(a.p, b.p)) continue;
      // how much room there is between the two tracks' edges
      const d = Math.hypot(a.x - b.x, a.z - b.z) - (a.p.def.width + b.p.def.width) / 2;
      if (d < worst) { worst = d; pair = `${a.p.type}#${a.p.id} / ${b.p.type}#${b.p.id}`; }
    }
    if (worst < GAP) issues.push(`tracks ${worst.toFixed(2)}" apart edge to edge (${pair})`);
    if (L.pieces.some(p => p.def.nl !== L.laneCount())) issues.push('mixes two-lane and four-lane track');
    if ((PRESETS[key].lanes || 2) !== L.laneCount()) issues.push(`has ${L.laneCount()} lanes`);
    if (L.startPiece()) for (let slot = 0; slot < L.laneCount(); slot++) {
      const lap = lapOf(L, slot);
      if (!lap.closed) issues.push(`slot ${slot} does not come back to the start`);
      else if (lap.slotBack !== slot && !L.pieces.some(p => p.def.swap)) issues.push(`slot ${slot} comes back in the other slot`);
    }
    assert.deepEqual(issues, []);
  });
}

test('a lap is continuous: each slot runs smoothly from one piece into the next', () => {
  for (const key of Object.keys(PRESETS)) {
    const L = new Layout(); buildPreset(L, key);
    for (let slot = 0; slot < L.laneCount(); slot++) {
      const st = L.startPiece(), P = new LanePath(), n = LanePath.laneAt(st, 0, slot);
      P.segs = [P.seg(st, n.l, n.d, 0)];
      for (let i = 0; i < 60 && P.extendFront(); i++);
      const a = {}, b = {};
      for (const g of P.segs.slice(1)) {
        P.at(g.s0 - 0.001, a); P.at(g.s0 + 0.001, b);
        const dh = Math.atan2(Math.sin(a.h - b.h), Math.cos(a.h - b.h));
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.05, `${key} slot ${slot}: gap at ${g.p.type}#${g.p.id}`);
        assert.ok(Math.abs(dh) < 0.02, `${key} slot ${slot}: kink at ${g.p.type}#${g.p.id}`);
        assert.ok(Math.abs(a.y - b.y) < 0.02, `${key} slot ${slot}: step at ${g.p.type}#${g.p.id}`);
      }
    }
  }
});

// ===== ui/editor: laying, dragging, rotating and deleting track; ready-made circuits =====
import { PI, TAU, TABLE_W, TABLE_D, normAng, clamp } from '../core/geometry.js';
import { APPEND, PIECES } from '../core/pieces.js';
import { PRESETS, appendPiece, buildPreset } from '../core/presets.js';
import { PieceView, showMarkers } from '../world/track.js';
import { layout, views, sound, session, state } from '../state.js';
import { save } from '../storage.js';
import { toast } from './dom.js';
import { updateStat, updateButtons } from './hud.js';
import { view } from './camera.js';

export function syncViews() {
  for (const [p, v] of views) if (!layout.pieces.includes(p)) { v.dispose(); views.delete(p); }
  for (const p of layout.pieces) { if (!views.has(p)) views.set(p, new PieceView(p)); else views.get(p).sync(); }
  refreshMarkers(); highlight(); updateStat(); updateButtons();
}
export function refreshMarkers() {
  const free = layout.freeEnds();
  if (state.active && !free.some(f => f.p === state.active.p && f.i === state.active.i)) state.active = null;
  const a = state.active;
  showMarkers(state.mode === 'track' ? free : [], f => !!a && a.p === f.p && a.i === f.i);
}
export function highlight() {
  for (const [p, v] of views) {
    let mode = null;
    if (state.mode === 'track' && p === state.sel) mode = state.drag && state.drag.snap ? 'snap' : 'sel';
    v.setHighlight(mode);
  }
}
function pushUndo() { state.undo.push(JSON.stringify(layout.serialize())); if (state.undo.length > 80) state.undo.shift(); updateButtons(); }
function pieceOffTable(p) {
  const EDGE = p.def.width / 2 + 0.4;
  for (const r of p.def.routes) for (let i = 0; i <= 8; i++) {
    const q = layout.toWorld(p, r.at(r.len * i / 8));
    if (Math.abs(q.x) > TABLE_W / 2 - EDGE || Math.abs(q.z) > TABLE_D / 2 - EDGE) return true;
  }
  return false;
}
function freeEndNear(x, z, nl) {
  let best = null, bd = Infinity;
  for (const f of layout.freeEnds(null, nl)) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = f; } }
  return best ? { p: best.p, i: best.i } : null;
}
function freeSpot() {
  const t = view.target;
  for (let r = 0; r < 60; r += 6) for (let a = 0; a < TAU; a += PI / 4) {
    const x = clamp(t.x + Math.cos(a) * r, -38, 38), z = clamp(t.z + Math.sin(a) * r, -16, 16);
    if (layout.pieces.every(p => { const c = layout.center(p); return Math.hypot(c.x - x, c.z - z) > 11; })) return { x, z };
    if (r === 0) break;
  }
  return { x: t.x, z: t.z };
}
// The palette shows two-lane or four-lane pieces. Switching moves the place to build to an open
// end of that width, if there is one; otherwise the next piece goes down on its own.
export function setGauge(nl) {
  state.gauge = nl;
  document.querySelectorAll('#gaugeSeg .seg-btn').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.gauge === nl)));
  document.querySelectorAll('#palette .chip').forEach(b => { b.hidden = +b.dataset.lanes !== nl; });
  if (state.active && state.active.p.def.nl !== nl) {
    const f = layout.freeEnds(null, nl)[0];
    state.active = f ? { p: f.p, i: f.i } : null;
    refreshMarkers();
  }
}
export function addPiece(kind) {
  sound.init();
  const a = APPEND[kind];
  pushUndo();
  let p, next;
  // two-lane and four-lane track don't join: a piece of the other width goes down on its own
  if (state.active && state.active.p.def.nl !== PIECES[a.type].nl) state.active = null;
  if (state.active) {
    ({ p, next } = appendPiece(layout, layout.endWorld(state.active.p, state.active.i), kind));
  } else {
    const spot = freeSpot();
    p = layout.add(a.type, 0, 0, 0); next = a.next;
    const c = layout.center(p); p.x = spot.x - c.x; p.z = spot.z - c.z;
  }
  if (pieceOffTable(p)) {
    layout.remove(p); state.undo.pop(); updateButtons();
    toast('No room there. That piece would hang off the table.');
    return;
  }
  layout.connectAll();
  state.active = next >= 0 && !p.conn[next] ? { p, i: next } : freeEndNear(layout.center(p).x, layout.center(p).z, p.def.nl);
  state.sel = p;
  if (p.conn.some(Boolean)) sound.snap();
  trackChanged();
}
export function rotateSel() {
  const p = state.sel;
  if (!p) { toast('Tap a piece first, then rotate it.'); return; }
  pushUndo();
  const before = { x: p.x, z: p.z, rot: p.rot };
  const linked = p.conn.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
  if (linked.length === 1) {
    // swing the piece round the joint it hangs from: flips a turn the other way
    const ci = linked[0], c = p.conn[ci];
    const pose = layout.poseFor(p.type, (ci + 1) % p.def.ends.length, layout.endWorld(c.p, c.i));
    Object.assign(p, pose);
  } else {
    const c0 = layout.center(p);
    p.rot = normAng(p.rot + PI / 4);
    const c1 = layout.center(p);
    p.x += c0.x - c1.x; p.z += c0.z - c1.z;
  }
  if (pieceOffTable(p)) { Object.assign(p, before); state.undo.pop(); updateButtons(); toast('No room to turn it that way.'); return; }
  layout.connectAll();
  if (state.active && state.active.p === p) state.active = null;
  if (!state.active) { const fi = p.conn.findIndex(c => !c); state.active = fi >= 0 ? { p, i: fi } : null; }
  trackChanged();
}
export function deleteSel() {
  let p = state.sel;
  if (!p && state.active) p = state.active.p;
  if (!p) { toast('Tap a piece to select it first.'); return; }
  pushUndo();
  const nb = p.conn.filter(Boolean).map(c => ({ p: c.p, i: c.i }));
  layout.remove(p);
  layout.connectAll();
  state.sel = null;
  state.active = nb[0] || null;
  trackChanged();
}
export function undo() {
  const s = state.undo.pop();
  if (!s) { toast('Nothing to undo.'); return; }
  layout.load(JSON.parse(s));
  state.sel = null; state.active = null;
  trackChanged();
}
// The cars come off while the track is being changed; they go back on the grid when racing resumes.
function trackChanged() {
  for (const c of session.cars) c.racer.lift();
  state.trackDirty = true;
  syncViews();
  save();
}
export function loadPreset(key) {
  pushUndo();
  if (key === 'clear') {
    layout.clear();
    state.sel = null; state.active = null;
    trackChanged();
    toast('Table cleared. Pick a piece to start laying track.');
    return;
  }
  buildPreset(layout, key);
  state.sel = null; state.active = null;
  setGauge(layout.laneCount());
  trackChanged();
  toast(`${PRESETS[key].name} laid out.`);
}
// Dragging works in table coordinates: ui/input turns the pointer into a point on the table.
export function beginDrag(p, at) {
  pushUndo();
  const pt = at || { x: p.x, z: p.z };
  state.drag = { p, start: { x: p.x, z: p.z, rot: p.rot }, off: { x: p.x - pt.x, z: p.z - pt.z }, snap: null };
  if (state.active && state.active.p === p) state.active = null;
  p.lifted = true;
  layout.connectAll();
  state.sel = p;
  refreshMarkers(); highlight();
}
export function dragMove(pt) {
  const d = state.drag, p = d.p;
  if (!pt) return;
  p.x = clamp(pt.x + d.off.x, -TABLE_W / 2, TABLE_W / 2);
  p.z = clamp(pt.z + d.off.z, -TABLE_D / 2, TABLE_D / 2);
  p.rot = d.start.rot;
  let best = null;
  const free = layout.freeEnds(p, p.def.nl);
  for (let i = 0; i < p.def.ends.length; i++) {
    const e = layout.endWorld(p, i);
    for (const f of free) { const dd = Math.hypot(e.x - f.x, e.z - f.z); if (dd < 3.4 && (!best || dd < best.d)) best = { d: dd, i, f }; }
  }
  if (best) Object.assign(p, layout.poseFor(p.type, best.i, best.f));
  d.snap = best;
  views.get(p).sync();
  highlight();
}
export function endDrag(commit) {
  const d = state.drag, p = d.p;
  p.lifted = false;
  if (!commit || pieceOffTable(p)) {
    Object.assign(p, d.start);
    if (commit) toast('Keep the track on the table.');
  }
  state.drag = null;
  layout.connectAll();
  if (commit && d.snap) sound.snap();
  if (!state.active) state.active = freeEndNear(p.x, p.z, p.def.nl);
  trackChanged();
}

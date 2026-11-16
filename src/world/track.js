// ===== world/track: the two-lane track pieces, the start lights and the open-end markers =====
// Black molded track with a slot down each lane, a flat steel rail either side of each slot, red and
// white curbing round the outside of the turns, and a start/finish piece with a light tree.
import * as THREE from 'three';
import { PI, TRACK_TOP, SPACING } from '../core/geometry.js';
import { PIECES, START_T } from '../core/pieces.js';
import { scene } from '../render/stage.js';
import { M, glowMat, paint } from '../render/materials.js';
import { UNIT, mergeList, Kit, castsShadow } from '../render/kit.js';

// the lanes' colours, red to yellow across the track left to right in the racing direction
export const LANE_HEX = [0xc8281c, 0x1d4fb8, 0x2f8f3e, 0xe0b21e];
// the cross-section of a piece hw inches either side of its centreline, at centreline sample q
// (with bank phi): (lat, y) -> world point. Points with y = 0 stay on the table, so a banked turn
// stands on a wedge.
function section(q, phi, hw) {
  const c = Math.cos(phi), s = Math.sin(phi), nx = -Math.sin(q.h), nz = Math.cos(q.h);
  const lift = hw * Math.abs(s);
  return (lat, y) => {
    const l = lat * c, Y = y === 0 ? 0 : lift - lat * s + y * c;
    return [q.x + nx * l, Y, q.z + nz * l];
  };
}
// sweep a cross-section profile [(lat, y)] along a centreline route; u runs along the length
// (one repeat per uLen inches), v across the profile
function sweepRoute(route, phi, profile, hw, uLen = 3, step = 0.4) {
  const n = route.kind === 'arc' ? Math.max(4, Math.ceil(route.len / step)) : 1;
  const pos = [], uv = [], idx = [], P = profile.length;
  const q = {};
  for (let i = 0; i <= n; i++) {
    const t = route.len * i / n;
    route.at(t, q);
    const f = section(q, phi ? phi(t) : 0, hw);
    profile.forEach(([lat, y], j) => { pos.push(...f(lat, y)); uv.push(t / uLen, j / (P - 1)); });
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < P - 1; j++) {
    const a = i * P + j, b = (i + 1) * P + j, c = (i + 1) * P + j + 1, d = i * P + j + 1;
    idx.push(a, d, b, b, d, c);
  }
  return finish(pos, uv, idx);
}
// a flat strip laid along a lane, from lat0 to lat1 either side of the slot, dy above the surface
function stripAlong(lane, lat0, lat1, dy, uLen = 3) {
  const pos = [], uv = [], idx = [];
  const n = lane.n, every = Math.max(1, Math.round(0.3 / lane.ds));
  const q = {};
  let rows = 0;
  for (let i = 0; i <= n; i += every) {
    lane.at(i * lane.ds, q); addRow(q, i * lane.ds); rows++;
    if (i + every > n && i !== n) { lane.at(lane.len, q); addRow(q, lane.len); rows++; }
  }
  function addRow(p, t) {
    const nx = -Math.sin(p.h), nz = Math.cos(p.h), c = Math.cos(p.roll), s = Math.sin(p.roll);
    for (const lat of [lat0, lat1]) { pos.push(p.x + nx * lat * c, p.y + dy - lat * s, p.z + nz * lat * c); uv.push(t / uLen, lat === lat0 ? 0 : 1); }
  }
  for (let i = 0; i < rows - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  return finish(pos, uv, idx);
}
function finish(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// molded body: the top, rounded down at the edges to the table
const BODY = hw => [[-hw, 0], [-hw, TRACK_TOP - 0.05], [-hw + 0.06, TRACK_TOP], [hw - 0.06, TRACK_TOP], [hw, TRACK_TOP - 0.05], [hw, 0]];
// the curb on the outside of a turn (lat is negative: the outside of a right-hand turn as built)
const KERB = hw => [[-hw - 0.75, 0], [-hw - 0.75, 0.05], [-hw - 0.02, TRACK_TOP * 0.75], [-hw, TRACK_TOP * 0.75]];
// on a banked turn the curb carries on up the slope from the raised outside edge
const KERB_BANKED = hw => [[-hw - 0.6, TRACK_TOP * 0.55], [-hw, TRACK_TOP * 0.9]];

// start lights on the start piece: three reds and a green, each its own lens so they light one by one
export const startLamps = [glowMat(0xff2a14, 0), glowMat(0xff2a14, 0), glowMat(0xff2a14, 0), glowMat(0x38ff5a, 0)];
const lampOff = 0.05;

const pieceGeoCache = new Map();
function pieceParts(type) {
  if (pieceGeoCache.has(type)) return pieceGeoCache.get(type);
  const def = PIECES[type];
  const k = new Kit();
  const hw = def.width / 2;
  def.routes.forEach((r, i) => {
    const body = sweepRoute(r, def.phi, BODY(hw), hw, 3);
    // the second road of a crossing sits a hair higher, so the two tops don't flicker through each other
    k.put(M.track, body, 0, i * 0.004, 0);
    if (def.curve) k.put(M.kerb, sweepRoute(r, def.phi, (def.banked ? KERB_BANKED : KERB)(hw), hw, 1.5));
  });
  for (const L of def.lanes) {
    k.put(M.slot, stripAlong(L, -0.045, 0.045, 0.003));
    k.put(M.rail, stripAlong(L, -0.14, -0.075, 0.006));
    k.put(M.rail, stripAlong(L, 0.075, 0.14, 0.006));
  }
  if (def.start) startDressing(k, def);
  if (def.swap) {
    // a white arrow either side, so the swap reads from across the table
    for (const sx of [-1, 1]) k.box(M.whiteLine, 1.2, 0.01, 0.12, def.len / 2 + sx * (def.len / 2 - 1.3), TRACK_TOP + 0.004, 0);
  }
  const parts = { meshes: k.parts(), foot: footprintGeo(def) };
  pieceGeoCache.set(type, parts);
  return parts;
}
function startDressing(k, def) {
  const hw = def.width / 2, nl = def.nl;
  // the checkered line, and a grid box behind it in each lane, with the lane's colour spot
  k.put(M.checker, UNIT.box, START_T, TRACK_TOP + 0.003, 0, 0, PI / 2, 0, def.width - 0.2, 0.004, 0.4);
  for (let i = 0; i < nl; i++) {
    const lat = (i - (nl - 1) / 2) * SPACING;
    for (const s of [-1, 1]) k.box(M.whiteLine, 0.05, 0.004, 0.5, START_T - 3.2, TRACK_TOP + 0.003, lat + s * 0.45);
    k.put(paint(LANE_HEX[i], 0.4, 0), UNIT.cylY, START_T - 1.3, TRACK_TOP + 0.003, lat - 0.45, 0, 0, 0, 0.12, 0.004, 0.12);
  }
  // the terminal tab on the left, where the power pack's wires screw on: a pair for each lane
  const tabW = 0.4 + nl * 0.6;
  k.box(M.trackSide, tabW, TRACK_TOP, 0.7, 1.3 + tabW / 2, TRACK_TOP / 2, -hw - 0.35);
  for (let i = 0; i < nl * 2; i++) {
    const x = 1.6 + i * 0.3;
    k.cylY(M.chrome, 0.065, 0.1, x, TRACK_TOP + 0.05, -hw - 0.4);
    k.cylZ(i % 2 ? M.wireBlack : M.wireRed, 0.03, 0.7, x, 0.03, -hw - 0.95);
  }
  // a little light tree on its post beside the line, about lap-counter size
  const px = START_T, pz = -hw - 0.5;
  k.box(M.black, 0.5, 0.08, 0.5, px, 0.04, pz);
  k.box(M.black, 0.12, 1.3, 0.12, px, 0.7, pz);
  k.box(M.black, 0.3, 0.95, 0.22, px, 1.75, pz);
  for (let i = 0; i < 4; i++) {
    const y = 2.08 - i * 0.22;
    for (const s of [-1, 1]) k.sphere(startLamps[i], 0.016, 0.075, 0.075, px + s * 0.15, y, pz);
  }
}
// lights: red is how many reds are lit (0-3), green whether the green is
export function setStartLights(red, green) {
  for (let i = 0; i < 3; i++) startLamps[i].emissiveIntensity = i < red ? 3.2 : lampOff;
  startLamps[3].emissiveIntensity = green ? 3.2 : lampOff;
}
setStartLights(0, false);

const footMat = new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.32, depthWrite: false });
const footSnapMat = new THREE.MeshBasicMaterial({ color: 0x9fd08a, transparent: true, opacity: 0.38, depthWrite: false });
function footprintGeo(def) {
  const hw = def.width / 2;
  return mergeList(def.routes.map(r => sweepRoute(r, def.phi, [[-hw - 0.3, TRACK_TOP + 0.03], [hw + 0.3, TRACK_TOP + 0.03]], hw, 3, 0.8)));
}

// ---- the track on the table ----
// Every piece of one type draws as one instanced mesh per material, an instance for each piece, so
// a whole layout takes a handful of draw calls. A PieceView holds its piece's slot in those meshes,
// and the footprint shown when it's selected.
const trackRoot = new THREE.Group();
scene.add(trackRoot);
const batches = new Map();
function batchFor(type) {
  if (!batches.has(type)) batches.set(type, { parts: pieceParts(type).meshes, views: [], meshes: [], cap: 0 });
  return batches.get(type);
}
function growBatch(b) {
  const cap = Math.max(8, b.cap * 2);
  b.meshes = b.parts.map(({ geo, mat }, i) => {
    const im = new THREE.InstancedMesh(geo, mat, cap), old = b.meshes[i];
    im.castShadow = castsShadow(mat); im.receiveShadow = true;
    im.matrixAutoUpdate = false;
    if (old) { im.instanceMatrix.array.set(old.instanceMatrix.array); trackRoot.remove(old); old.dispose(); }
    trackRoot.add(im);
    return im;
  });
  b.cap = cap;
}
function placeInBatch(b, slot, matrix) {
  for (const im of b.meshes) { im.setMatrixAt(slot, matrix); im.instanceMatrix.needsUpdate = true; im.boundingSphere = null; }
}
function countBatch(b) {
  for (const im of b.meshes) { im.count = b.views.length; im.visible = im.count > 0; im.boundingSphere = null; }
}
// every piece type once, hidden, so their shaders compile at boot
export function preloadPieces() { for (const t of Object.keys(PIECES)) { const b = batchFor(t); if (!b.cap) growBatch(b); countBatch(b); } }

export class PieceView {
  constructor(p) {
    this.p = p;
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;
    this.foot = new THREE.Mesh(pieceParts(p.type).foot, footMat);
    this.foot.visible = false;
    this.foot.userData.piece = p;
    this.foot.renderOrder = 1;
    this.group.add(this.foot);
    trackRoot.add(this.group);
    const b = this.batch = batchFor(p.type);
    if (b.views.length === b.cap) growBatch(b);
    this.slot = b.views.length;
    b.views.push(this);
    countBatch(b);
    this.sync();
  }
  sync() {
    this.group.position.set(this.p.x, 0, this.p.z); this.group.rotation.y = -this.p.rot;
    this.group.updateMatrix();
    placeInBatch(this.batch, this.slot, this.group.matrix);
  }
  setHighlight(mode) { this.foot.visible = !!mode; this.foot.material = mode === 'snap' ? footSnapMat : footMat; }
  dispose() {
    trackRoot.remove(this.group);
    const b = this.batch, last = b.views.pop();
    if (last !== this) { b.views[this.slot] = last; last.slot = this.slot; placeInBatch(b, last.slot, last.group.matrix); }
    countBatch(b);
  }
}

// ---- open-end markers shown while building ----
const markerRoot = new THREE.Group();
scene.add(markerRoot);
const ringGeo = new THREE.RingGeometry(0.9, 1.25, 40).rotateX(-PI / 2);
const arrowGeo = (() => { const s = new THREE.Shape(); s.moveTo(0.55, 0); s.lineTo(-0.35, 0.5); s.lineTo(-0.35, -0.5); s.closePath(); return new THREE.ShapeGeometry(s).rotateX(-PI / 2); })();
const markerMat = new THREE.MeshBasicMaterial({ color: 0xece2ce, transparent: true, opacity: 0.55, depthWrite: false });
const markerActiveMat = new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.95, depthWrite: false });
const markerHitGeo = new THREE.CircleGeometry(2.6, 20).rotateX(-PI / 2);
export const markers = [];
export function showMarkers(ends, isActive) {
  markerRoot.clear();
  markers.length = 0;
  for (const f of ends) {
    const on = isActive(f);
    const g = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, on ? markerActiveMat : markerMat);
    const arrow = new THREE.Mesh(arrowGeo, on ? markerActiveMat : markerMat);
    const hit = new THREE.Mesh(markerHitGeo, markerMat);
    hit.visible = false; hit.userData.end = f;
    ring.renderOrder = arrow.renderOrder = 3;
    g.add(ring, arrow, hit);
    g.position.set(f.x + Math.cos(f.h) * 1.9, TRACK_TOP + 0.05, f.z + Math.sin(f.h) * 1.9);
    g.rotation.y = -f.h;
    markerRoot.add(g);
    markers.push({ g, hit, on });
  }
  markerRoot.updateMatrixWorld(true);
}
export function animateTrack(now) {
  if (markers.length) { const s = 1 + 0.12 * Math.sin(now / 180); for (const m of markers) if (m.on) m.g.scale.setScalar(s); }
}

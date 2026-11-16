// ===== ui/input: pointer input on the table (mouse, pen and touch share one path) =====
import * as THREE from 'three';
import { TABLE_W, TABLE_D, TRACK_TOP, clamp } from '../core/geometry.js';
import { canvas, scene, camera } from '../render/stage.js';
import { views, sound, session, state } from '../state.js';
import { updateButtons } from './hud.js';
import { view, placeCamera, stopTween, follow, ride, lookAround, zoomRide } from './camera.js';
import { markers } from '../world/track.js';
import { refreshMarkers, highlight, beginDrag, dragMove, endDrag, setGauge } from './editor.js';
import { resetCar } from './controllers.js';

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TRACK_TOP);
function setRay(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function planePoint(cx, cy) { setRay(cx, cy); return ray.ray.intersectPlane(pickPlane, new THREE.Vector3()); }
function pick(cx, cy) {
  scene.updateMatrixWorld();
  setRay(cx, cy);
  if (state.mode === 'track') {
    if (markers.length) {
      const mh = ray.intersectObjects(markers.map(m => m.hit), false);
      if (mh.length) return { kind: 'end', end: mh[0].object.userData.end };
    }
    const hits = ray.intersectObjects([...views.values()].map(v => v.foot), false);
    return hits.length ? { kind: 'piece', p: hits[0].object.userData.piece, point: hits[0].point } : null;
  }
  // a car that's come off can be tapped to put it back
  const cars = session.cars.filter(c => c.racer.state === 'fly' && c.root.visible).map(c => c.hit);
  const ch = ray.intersectObjects(cars, false);
  if (ch.length) return { kind: 'car', car: ch[0].object.userData.car };
  return null;
}
function panBy(x0, y0, x1, y1) {
  const a = planePoint(x0, y0), b = planePoint(x1, y1);
  if (!a || !b) return;
  view.target.x = clamp(view.target.x - (b.x - a.x), -TABLE_W / 2, TABLE_W / 2);
  view.target.z = clamp(view.target.z - (b.z - a.z), -TABLE_D / 2, TABLE_D / 2);
}
const ptrs = new Map();
let gest = null;
function onDown(e) {
  sound.init();
  stopTween();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) {
    gest = { kind: 'pending', x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, button: e.button, mod: e.shiftKey || e.altKey, hit: pick(e.clientX, e.clientY) };
  } else if (ptrs.size === 2) {
    if (gest && gest.kind === 'drag') endDrag(false);
    const [a, b] = [...ptrs.values()];
    gest = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: follow.active ? follow.dist : view.dist, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
}
function onMove(e) {
  const pt = ptrs.get(e.pointerId);
  if (!pt) { hover(e); return; }
  pt.x = e.clientX; pt.y = e.clientY;
  if (!gest) return;
  if (gest.kind === 'pinch') {
    if (ptrs.size < 2) return;
    const [a, b] = [...ptrs.values()];
    const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
    if (ride.active) { zoomRide(gest.last ? gest.last / d : 1); gest.last = d; return; }
    if (follow.active) { follow.dist = clamp(gest.dist0 * gest.d0 / d, 5, 60); return; }
    view.dist = clamp(gest.dist0 * gest.d0 / d, 10, 260);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    placeCamera(view, camera);
    panBy(gest.mx, gest.my, mx, my);
    gest.mx = mx; gest.my = my;
    return;
  }
  if (gest.kind === 'pending') {
    if (Math.hypot(e.clientX - gest.x0, e.clientY - gest.y0) < 7) return;
    const h = gest.hit;
    if (state.mode === 'track' && h && h.kind === 'piece' && gest.button === 0 && !gest.mod) { beginDrag(h.p, planePoint(gest.x0, gest.y0)); gest.kind = 'drag'; }
    else gest.kind = !follow.active && (gest.button === 2 || gest.button === 1 || gest.mod) ? 'pan' : 'orbit';
  }
  const dx = e.clientX - gest.lx, dy = e.clientY - gest.ly;
  if (gest.kind !== 'drag' && ride.active) { ride.held = true; lookAround(dx, dy); }
  else if (gest.kind === 'orbit' && follow.active) {
    follow.yaw -= dx * 0.0055;
    follow.pitch = clamp(follow.pitch + dy * 0.0045, 0.08, 1.4);
  } else if (gest.kind === 'orbit') {
    view.yaw -= dx * 0.0055;
    view.pitch = clamp(view.pitch + dy * 0.0045, 0.12, 1.5);
  } else if (gest.kind === 'pan') panBy(gest.lx, gest.ly, e.clientX, e.clientY);
  else if (gest.kind === 'drag') dragMove(planePoint(e.clientX, e.clientY));
  gest.lx = e.clientX; gest.ly = e.clientY;
}
function onUp(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (!ptrs.size) ride.held = false;
  if (!gest) return;
  if (gest.kind === 'pinch') {
    if (ptrs.size === 1) { const p = [...ptrs.values()][0]; gest = { kind: 'orbit', lx: p.x, ly: p.y }; } else gest = null;
    return;
  }
  if (ptrs.size) return;
  if (gest.kind === 'pending' && e.type === 'pointerup') tap(gest.hit);
  else if (gest.kind === 'drag') endDrag(e.type === 'pointerup');
  gest = null;
}
function hover(e) {
  if (e.pointerType !== 'mouse' || hover.raf) return;
  hover.raf = requestAnimationFrame(() => {
    hover.raf = 0;
    const h = pick(e.clientX, e.clientY);
    canvas.style.cursor = !h ? 'grab' : h.kind === 'piece' ? 'move' : 'pointer';
  });
}
function tap(hit) {
  if (state.mode === 'track') {
    if (hit && hit.kind === 'end') { state.active = { p: hit.end.p, i: hit.end.i }; state.sel = null; setGauge(hit.end.p.def.nl); refreshMarkers(); highlight(); updateButtons(); return; }
    state.sel = hit && hit.kind === 'piece' ? (state.sel === hit.p ? null : hit.p) : null;
    highlight(); updateButtons();
    return;
  }
  if (hit && hit.kind === 'car') resetCar(hit.car.slot);
}
export function bindCanvas() {
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); stopTween();
    const k = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012));
    if (ride.active) zoomRide(k);
    else if (follow.active) follow.dist = clamp(follow.dist * k, 5, 60);
    else view.dist = clamp(view.dist * k, 10, 260);
  }, { passive: false });
}

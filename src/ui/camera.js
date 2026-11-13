// ===== ui/camera: the table view, the chase camera behind your car, and the glides between them =====
import * as THREE from 'three';
import { PI, TABLE_W, TABLE_D } from '../core/geometry.js';
import { canvas, camera } from '../render/stage.js';
import { session } from '../state.js';
import { $, toast } from './dom.js';

export const view = { target: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0.95, dist: 120 };
function defaultYaw() { const r = canvas.getBoundingClientRect(); return r.width >= r.height * 0.95 ? 0 : PI / 2; }
export function placeCamera(v, cam) {
  const cp = Math.cos(v.pitch);
  cam.position.set(v.target.x + v.dist * cp * Math.sin(v.yaw), v.target.y + v.dist * Math.sin(v.pitch), v.target.z + v.dist * cp * Math.cos(v.yaw));
  cam.lookAt(v.target);
  cam.updateMatrixWorld();
}
const probeCam = new THREE.PerspectiveCamera();
function fitDistance(yaw, pitch) {
  probeCam.copy(camera);
  const pts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0.2, -2]) pts.push(new THREE.Vector3(sx * (TABLE_W / 2 + 0.8), y, sz * (TABLE_D / 2 + 0.8)));
  const probe = { target: new THREE.Vector3(), yaw, pitch, dist: 100 };
  let lo = 30, hi = 600;
  for (let i = 0; i < 28; i++) {
    probe.dist = (lo + hi) / 2;
    placeCamera(probe, probeCam);
    const ok = pts.every(p => { const q = p.clone().project(probeCam); return Math.abs(q.x) < 0.96 && q.y > -0.92 && q.y < 0.86; });
    if (ok) hi = probe.dist; else lo = probe.dist;
  }
  return hi;
}
let camTween = null;
export function resetView(animate = true) {
  const goal = { yaw: defaultYaw(), pitch: 0.95 };
  goal.dist = fitDistance(goal.yaw, goal.pitch);
  if (!animate) { Object.assign(view, goal); view.target.set(0, 0, 0); return; }
  let dy = goal.yaw - view.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  camTween = { t: 0, from: { yaw: view.yaw, pitch: view.pitch, dist: view.dist, tx: view.target.x, tz: view.target.z }, to: { yaw: view.yaw + dy, pitch: goal.pitch, dist: goal.dist } };
}
export function stopTween() { camTween = null; }
// Chase view: rides along behind the first human driver's car (or the red car). yaw/pitch/dist are
// the viewer's own offsets; the heading is smoothed so the camera doesn't snap through the turns.
export const follow = { on: false, yaw: 0, pitch: 0.42, dist: 14, head: 0, cam: { target: new THREE.Vector3(), yaw: 0, pitch: 0, dist: 0 } };
export function followedCar() {
  const i = session.drivers.indexOf('human');
  return session.cars[i >= 0 ? i : 0];
}
let camBlend = null;
export function setFollow(on) {
  if (on && !followedCar().racer.placed) { toast('Put a car on the track to follow it.'); on = false; }
  if (on === follow.on) return;
  follow.on = on;
  if (on) camTween = null;
  const b = $('btnFollow');
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Stop following your car' : 'Follow your car');
}
export function stepCamera(dt) {
  const car = followedCar(), r = car.racer;
  const active = follow.on && r.placed;
  if (active !== !!follow.active) {
    camBlend = { t: 0, pos: camera.position.clone(), quat: camera.quaternion.clone() };
    follow.active = active;
    if (active) follow.head = r.pose.h;
  }
  if (active) {
    const o = r.pose, c = follow.cam;
    // while it's flying about, keep looking at it without spinning round with it
    const h = r.state === 'run' ? o.h : follow.head;
    follow.head += Math.atan2(Math.sin(h - follow.head), Math.cos(h - follow.head)) * (1 - Math.exp(-dt * 3));
    const ahead = r.state === 'run' ? 2 : 0;
    c.target.set(o.x + Math.cos(follow.head) * ahead, Math.max(o.y, -28) + 0.8, o.z + Math.sin(follow.head) * ahead);
    c.yaw = Math.atan2(-Math.cos(follow.head), -Math.sin(follow.head)) + follow.yaw;
    c.pitch = follow.pitch; c.dist = follow.dist;
    placeCamera(c, camera);
  } else {
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt / 0.6);
      const k = 1 - Math.pow(1 - camTween.t, 3), f = camTween.from, g = camTween.to;
      view.yaw = f.yaw + (g.yaw - f.yaw) * k; view.pitch = f.pitch + (g.pitch - f.pitch) * k; view.dist = f.dist + (g.dist - f.dist) * k;
      view.target.set(f.tx * (1 - k), 0, f.tz * (1 - k));
      if (camTween.t >= 1) camTween = null;
    }
    placeCamera(view, camera);
  }
  if (camBlend) {
    camBlend.t = Math.min(1, camBlend.t + dt / 0.8);
    const k = 1 - Math.pow(1 - camBlend.t, 3);
    camera.position.lerpVectors(camBlend.pos, camera.position, k);
    camera.quaternion.slerpQuaternions(camBlend.quat, camera.quaternion, k);
    camera.updateMatrixWorld();
    if (camBlend.t >= 1) camBlend = null;
  }
}

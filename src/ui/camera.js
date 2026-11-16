// ===== ui/camera: the table view, the chase camera behind your car, and the glides between them =====
import * as THREE from 'three';
import { PI, TABLE_W, TABLE_D, TRACK_TOP, clamp, smooth } from '../core/geometry.js';
import { LANE_NAMES } from '../core/race.js';
import { canvas, camera } from '../render/stage.js';
import { SPECS } from '../core/specs.js';
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
  if (on) setRide(false);
  follow.on = on;
  if (on) camTween = null;
  const b = $('btnFollow');
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Stop following your car' : 'Follow your car');
}
// ---- driver view ----
// A camera at the driver's eye, bolted to the car: it leans on the banking, swings with the tail and
// pitches over the joints. A wide lens with a very near clip, so the car's own nose and wheels can sit
// in the picture without being cut. The car's own glass is left out, and any car that comes close
// enough to touch the lens is hidden for that frame. When the car comes off, the camera stays above
// the slot where it left and turns to watch it; when the marshal puts it back, it slides back in.
export const ride = { on: false, lane: 0, yaw: 0, pitch: 0, fov: 64, active: false, held: false };
const LENS = { near: 0.5, far: 1200 }, RIDE_LENS = { near: 0.02, far: 420 };
const TABLE_FOV = 36;
const CLEAR = 1.75;     // a car whose centre is nearer the lens than this would touch it
const TILT = 0.07;      // the eye looks a little down the track
const ALIGN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -PI / 2);   // camera's -z onto the car's +x
const rideEye = new THREE.Vector3(), rideQ = new THREE.Quaternion(), rideLook = new THREE.Quaternion(), rideEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const watch = { pos: new THREE.Vector3(), q: new THREE.Quaternion(), from: new THREE.Vector3(), m: new THREE.Matrix4(), up: new THREE.Vector3(0, 1, 0), target: new THREE.Vector3() };
function rideCar() { return session.cars[ride.lane]; }
function canRide(i) { return session.active(i) && session.racers[i].placed; }
function setRide(on, lane = ride.lane) {
  if (ride.on) rideCar().setCockpit(false);
  ride.on = on; ride.lane = lane; ride.yaw = 0; ride.pitch = 0;
  if (on) { follow.on = false; $('btnFollow').setAttribute('aria-pressed', 'false'); camTween = null; }
  const b = $('btnDriver');
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? `Leave the ${LANE_NAMES[lane].toLowerCase()} car` : 'Driver view');
}
// The driver button (and C): into the first player's car, then each racing car in turn, then out.
export function cycleRide() {
  const lanes = [0, 1, 2, 3].filter(canRide);
  if (!lanes.length) { toast('Put a car on the track to ride in it.'); return; }
  let next;
  if (!ride.on) { const h = lanes.find(i => session.drivers[i] === 'human'); next = h ?? lanes[0]; }
  else next = lanes.find(i => i > ride.lane);
  if (next === undefined) { setRide(false); return; }
  setRide(true, next);
  toast(`Driver view: ${LANE_NAMES[next]} · ${SPECS[rideCar().key].name}. Drag to look round; press again for the next car.`, 2600);
}
export function leaveRide() { if (ride.on) setRide(false); }
// the lens: the table view's, or the driver view's wide angle and near clip
function setLens(driverView) {
  const L = driverView ? RIDE_LENS : LENS;
  camera.near = L.near; camera.far = L.far;
  camera.updateProjectionMatrix();
}
// where the eye is and which way it looks, for a car on the track
function cockpitPose(car, pos, q) {
  const root = car.root;
  root.updateMatrixWorld();
  pos.copy(car.eye).applyMatrix4(root.matrixWorld);
  rideEuler.set(-TILT + ride.pitch, ride.yaw, 0);
  q.copy(root.quaternion).multiply(ALIGN).multiply(rideLook.setFromEuler(rideEuler));
}
function fadeCut() {
  const f = $('fade');
  f.classList.remove('lift'); f.classList.add('cut');
  void f.offsetWidth;
  f.classList.remove('cut'); f.classList.add('lift');
}
function stepRide(dt) {
  const car = rideCar(), r = car.racer;
  car.setCockpit(true);
  // the driver's head comes back to the road once you let go
  if (!ride.held) { const k = Math.exp(-dt * 1.5); ride.yaw *= k; ride.pitch *= k; }
  if (r.state === 'run') {
    cockpitPose(car, camera.position, camera.quaternion);
    watch.from.copy(camera.position);
    watch.pos.copy(camera.position); watch.q.copy(camera.quaternion);
  } else {
    // off: rise above the slot where it left, looking at the car (and not along with it)
    const k = 1 - Math.exp(-dt * 8);
    watch.pos.lerp(rideEye.copy(watch.from).setY(Math.max(watch.from.y, TRACK_TOP + 0.3) + 2.2), k);
    watch.target.set(r.pose.x, r.pose.y + 0.3, r.pose.z);
    if (watch.target.distanceTo(watch.pos) > 0.5) {
      watch.m.lookAt(watch.pos, watch.target, watch.up);
      rideQ.setFromRotationMatrix(watch.m);
      watch.q.slerp(rideQ, 1 - Math.exp(-dt * 6));
    }
    camera.position.copy(watch.pos); camera.quaternion.copy(watch.q);
    if (r.state === 'reset') {
      // being put back: slide into the cockpit over the second half of the marshal's lift
      const w = smooth((r.back.t - 0.55) / 0.45);
      cockpitPose(car, rideEye, rideQ);
      camera.position.lerp(rideEye, w); camera.quaternion.slerp(rideQ, w);
    }
  }
  camera.updateMatrixWorld();
  // nothing may come close enough to cut through the lens: hide any car that would
  for (const c of session.cars) {
    if (!c.root.visible) continue;
    if (c === car && r.state === 'run') continue;
    if (c === car && r.state === 'reset' && r.back.t > 0.97) continue;
    if (camera.position.distanceTo(c.root.position) < CLEAR) c.root.visible = false;
  }
}
export function stepCamera(dt) {
  const riding = ride.on && canRide(ride.lane);
  if (riding !== ride.active) {
    // a cut, under a quick fade, rather than a glide: a glide from the table view down into the car
    // would pass through the lamp, the joists or whatever else is in the way
    camBlend = null; camTween = null;
    fadeCut();
    ride.active = riding;
    if (!riding && ride.on) setRide(false);
    setLens(riding);
  }
  if (riding) {
    stepRide(dt);
    blendIn(dt, ride.fov);
    return;
  }
  const car = followedCar(), r = car.racer;
  const active = follow.on && r.placed;
  if (active !== !!follow.active) {
    camBlend = { t: 0, pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov };
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
  blendIn(dt, TABLE_FOV);
}
// glide from where the camera was to where it's going, after a change of view (lens included)
function blendIn(dt, fov) {
  if (camBlend) {
    camBlend.t = Math.min(1, camBlend.t + dt / 0.8);
    const k = 1 - Math.pow(1 - camBlend.t, 3);
    camera.position.lerpVectors(camBlend.pos, camera.position, k);
    camera.quaternion.slerpQuaternions(camBlend.quat, camera.quaternion, k);
    camera.updateMatrixWorld();
    if (camBlend.t >= 1) camBlend = null;
  }
  const f = camBlend && camBlend.fov !== undefined ? camBlend.fov + (fov - camBlend.fov) * (1 - Math.pow(1 - camBlend.t, 3)) : fov;
  if (camera.fov !== f) { camera.fov = f; camera.updateProjectionMatrix(); }
}
// dragging in the driver view turns the driver's head; it comes back to the road by itself
export function lookAround(dx, dy) {
  ride.yaw = clamp(ride.yaw - dx * 0.005, -1.5, 1.5);
  ride.pitch = clamp(ride.pitch - dy * 0.004, -0.5, 0.6);
}
export function zoomRide(k) { ride.fov = clamp(ride.fov * k, 40, 90); }

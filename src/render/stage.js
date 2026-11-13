// ===== render/stage: the WebGL renderer, scene, camera, reflections and the basement's lights =====
import * as THREE from 'three';

export const canvas = document.getElementById('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const FULL_RATIO = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(FULL_RATIO);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
export const ROOM_COLOR = new THREE.Color(0x0c0a09);
scene.background = ROOM_COLOR.clone();
scene.fog = new THREE.Fog(0x0c0a09, 170, 360);
export const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 1200);

const PI2 = Math.PI / 2;
// The lamp hangs this far over the middle of the table (the table top is y = 0).
export const LAMP_Y = 40;

// ---- reflections ----
// A dark box of a room with the one bright lamp over it, rendered once into an environment map, so
// glossy paint and chrome catch a highlight from overhead and fall dark at the sides.
function basementEnvironment() {
  const env = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x1a1511, side: THREE.BackSide }));
  box.scale.set(40, 12, 34); box.position.y = 4;
  env.add(box);
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  lamp.material.color.setScalar(6);
  lamp.rotation.x = PI2; lamp.scale.setScalar(1.6); lamp.position.set(0, 9.9, 0);
  env.add(lamp);
  // the pool of light on the table under it, and a faint blue window high on the back wall
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x4a4a3c }));
  pool.rotation.x = -PI2; pool.scale.set(14, 8, 1); pool.position.y = -1.9;
  env.add(pool);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x24324a }));
  win.scale.set(6, 1.6, 1); win.position.set(4, 8, -16.9);
  env.add(win);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}
scene.environment = basementEnvironment();

// ---- lights ----
// Almost nothing reaches the corners of the basement: a faint wash of warm bounce light and the
// blue of a high window. The lamp does the rest: a spot straight down over the table, with soft edges.
export const hemi = new THREE.HemisphereLight(0x8a7a66, 0x1a130e, 0.14);
scene.add(hemi);
export const lamp = new THREE.SpotLight(0xffe3b8, 6.5, 0, 1.08, 0.85, 0);
lamp.position.set(0, LAMP_Y - 2.5, 0);
lamp.target.position.set(0, 0, 0);
lamp.castShadow = true;
lamp.shadow.mapSize.set(2048, 2048);
lamp.shadow.camera.near = 10; lamp.shadow.camera.far = 120;
lamp.shadow.bias = -0.0003;
lamp.shadow.normalBias = 0.02;
lamp.shadow.radius = 4;
scene.add(lamp, lamp.target);
// the bulb also lights the underside of the shade and the joists around it a little
export const bulb = new THREE.PointLight(0xffd59a, 1.2, 30, 1);
bulb.position.set(0, LAMP_Y + 1.2, 0);
scene.add(bulb);
export const moon = new THREE.DirectionalLight(0x6f86b8, 0.12);
moon.position.set(30, 70, -120);
scene.add(moon);

// ---- resolution and graphics quality ----
// Full graphics renders at the screen's pixel ratio (up to 2). If frames keep coming slower than
// about 40 a second it steps a quarter down towards 1 and stays there. Fast graphics, the player's
// choice, renders at half the screen's ratio (never under 0.75) with a smaller shadow map.
// pace(ms) takes each frame's interval and returns true when the ratio has changed.
const FAST_RATIO = Math.max(0.75, FULL_RATIO / 2);
const SHADOW_SIZE = lamp.shadow.mapSize.x;
export const graphics = { fast: false };
const pacing = { ratio: FULL_RATIO, sum: 0, n: 0, slow: 0, changed: false };
export function setFastGraphics(on) {
  graphics.fast = on;
  Object.assign(pacing, { ratio: on ? FAST_RATIO : FULL_RATIO, sum: 0, n: 0, slow: 0, changed: true });
  renderer.setPixelRatio(pacing.ratio);
  lamp.shadow.mapSize.setScalar(on ? SHADOW_SIZE / 2 : SHADOW_SIZE);
  if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; }
}
export function pace(ms) {
  if (pacing.changed) { pacing.changed = false; return true; }
  if (pacing.ratio <= 1 || ms > 250) return false;
  pacing.sum += ms;
  if (++pacing.n < 60) return false;
  const mean = pacing.sum / pacing.n;
  pacing.sum = pacing.n = 0;
  pacing.slow = mean > 24 ? pacing.slow + 1 : 0;
  if (pacing.slow < 2) return false;
  pacing.slow = 0;
  pacing.ratio = Math.max(1, pacing.ratio - 0.25);
  renderer.setPixelRatio(pacing.ratio);
  return true;
}

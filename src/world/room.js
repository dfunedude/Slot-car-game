// ===== world/room: the basement: the plywood table on sawhorses, the walls, stairs, odds and ends,
// the ceiling joists and the lamp hanging over the table =====
import * as THREE from 'three';
import { PI, TABLE_W, TABLE_D } from '../core/geometry.js';
import { FLOOR_Y, ROOM } from '../core/racer.js';
import { scene, camera, LAMP_Y } from '../render/stage.js';
import { concreteTexture, blockTexture, panelTexture, tableTexture, woodTexture, makeCanvas, canvasTex, TEX } from '../render/textures.js';
import { stdMat, paint, glowMat, M } from '../render/materials.js';
import { Kit, pin, beam } from '../render/kit.js';

export const CEIL_Y = FLOOR_Y + 96;         // an eight-foot basement
const WALL = { x0: -ROOM.x - 2, x1: ROOM.x + 2, z0: ROOM.z0 - 2, z1: ROOM.z1 + 2 };
const ceiling = new THREE.Group();

// a wall that only shows from inside the room, so the camera can look in from outside it
function wall(mat, w, h, x, y, z, ry, rep) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true;
  const uv = m.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep[0], uv.getY(i) * rep[1]);
  return m;
}

export function buildRoom() {
  const g = new THREE.Group();
  const H = CEIL_Y - FLOOR_Y, midY = (CEIL_Y + FLOOR_Y) / 2;
  // ---- floor and walls ----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WALL.x1 - WALL.x0, WALL.z1 - WALL.z0), stdMat({ map: concreteTexture(), roughness: 0.92, metalness: 0, envMapIntensity: 0.05 }));
  floor.rotation.x = -PI / 2; floor.position.set(0, FLOOR_Y, (WALL.z0 + WALL.z1) / 2); floor.receiveShadow = true;
  floor.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * 3; });
  g.add(floor);
  const block = stdMat({ map: blockTexture(), roughness: 0.95, metalness: 0, envMapIntensity: 0.05 });
  const pine = stdMat({ map: panelTexture(), roughness: 0.6, metalness: 0, envMapIntensity: 0.05 });
  const W = WALL.x1 - WALL.x0, D = WALL.z1 - WALL.z0, cz = (WALL.z0 + WALL.z1) / 2;
  g.add(wall(block, W, H, 0, midY, WALL.z0, 0, [W / 32, H / 32]));
  g.add(wall(block, D, H, WALL.x0, midY, cz, PI / 2, [D / 32, H / 32]));
  g.add(wall(pine, D, H, WALL.x1, midY, cz, -PI / 2, [D / 64, 1]));
  g.add(wall(pine, W, H, 0, midY, WALL.z1, PI, [W / 64, 1]));

  const k = new Kit();
  buildTable(k);
  buildStairs(k);
  buildCorner(k);
  buildBench(k);
  buildWindow(g, k);
  buildDriverStand(k);
  const props = k.build();
  props.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  g.add(props);
  buildCeiling();
  pin(g);
  scene.add(g, ceiling);
}

// ---- the table: a sheet of plywood painted green, edged with a strip of pine, on two sawhorses ----
function buildTable(k) {
  const top = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_W, TABLE_D), stdMat({ map: tableTexture(), roughness: 0.88, metalness: 0, envMapIntensity: 0.05 }));
  top.rotation.x = -PI / 2; top.receiveShadow = true;
  scene.add(top); pin(top);
  const ply = paint(0x2f4630, 0.9, 0, 0.05), edge = stdMat({ map: woodTexture('#9a7a52', '60,40,20'), roughness: 0.7, metalness: 0, envMapIntensity: 0.05 });
  // the board under the paint has to cast, or the lamp shines straight through onto the floor
  k.box(ply, TABLE_W, 0.7, TABLE_D, 0, -0.36, 0);
  const t = 0.7, h = 1.5;
  k.box(edge, TABLE_W + 2 * t, h, t, 0, 0.25 - h / 2, TABLE_D / 2 + t / 2);
  k.box(edge, TABLE_W + 2 * t, h, t, 0, 0.25 - h / 2, -TABLE_D / 2 - t / 2);
  k.box(edge, t, h, TABLE_D, TABLE_W / 2 + t / 2, 0.25 - h / 2, 0);
  k.box(edge, t, h, TABLE_D, -TABLE_W / 2 - t / 2, 0.25 - h / 2, 0);
  const wood = stdMat({ map: woodTexture('#b48a5a', '80,50,22'), roughness: 0.75, metalness: 0, envMapIntensity: 0.05 });
  for (const sx of [-30, 30]) {
    // a 2x4 across the top, legs splayed both ways, a cross brace each end
    const yb = -0.72 - 1.75;
    k.box(wood, 3.5, 3.5, TABLE_D + 6, sx, yb, 0);
    for (const sz of [-1, 1]) for (const lx of [-1, 1]) {
      const a = { x: sx + lx * 1.2, y: yb - 1, z: sz * (TABLE_D / 2 - 2) };
      const b = { x: sx + lx * 7, y: FLOOR_Y + 0.75, z: sz * (TABLE_D / 2 + 3) };
      beam(k, wood, a, b, 1.5, 3.4);
    }
    for (const sz of [-1, 1]) k.box(wood, 10, 3, 0.75, sx, FLOOR_Y + 12, sz * (TABLE_D / 2 + 1.3));
  }
  // a cardboard box under the table: the set it all came in
  const box = stdMat({ map: setBoxTexture(), roughness: 0.85, metalness: 0, envMapIntensity: 0.05 });
  k.box(paint(0x8e6e46, 0.9, 0, 0.05), 30, 4, 16, 6, FLOOR_Y + 2, 4, 0, 0.22, 0);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(31, 0.5, 17), [paint(0x8e6e46, 0.9, 0, 0.05), paint(0x8e6e46, 0.9, 0, 0.05), box, paint(0x8e6e46, 0.9, 0, 0.05), paint(0x8e6e46, 0.9, 0, 0.05), paint(0x8e6e46, 0.9, 0, 0.05)]);
  lid.position.set(-14, FLOOR_Y + 0.25, 10); lid.rotation.y = -0.35; lid.receiveShadow = true; lid.castShadow = true;
  scene.add(lid); pin(lid);
}
function setBoxTexture() {
  const c = makeCanvas(1024, 560), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1024, 560);
  grd.addColorStop(0, '#d8461f'); grd.addColorStop(1, '#f2a21b');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 560);
  g.fillStyle = '#121212'; g.fillRect(0, 380, 1024, 180);
  g.strokeStyle = '#f4efe2'; g.lineWidth = 26;
  g.beginPath(); g.moveTo(-40, 420); g.bezierCurveTo(300, 120, 700, 640, 1100, 300); g.stroke();
  g.fillStyle = '#f4efe2'; g.font = 'italic 900 112px Arial Black, Arial'; g.fillText('THUNDER', 50, 140);
  g.font = 'italic 900 84px Arial Black, Arial'; g.fillText('SLOT RACEWAY', 50, 240);
  g.fillStyle = '#f2c21b'; g.font = 'bold 44px Arial'; g.fillText('HO SCALE · 2 CARS · 2 CONTROLLERS', 50, 480);
  return canvasTex(c);
}

// ---- the stairs down along the left wall ----
function buildStairs(k) {
  const wood = stdMat({ map: woodTexture('#7a5a3a', '40,24,10'), roughness: 0.8, metalness: 0, envMapIntensity: 0.05 });
  const x = WALL.x0 + 20, n = 13, rise = 96 / n, run = 9.5, z0 = 40;
  for (let i = 0; i < n - 1; i++) {
    const y = FLOOR_Y + rise * (i + 1), z = z0 - run * i;
    k.box(wood, 36, 1.1, 10.5, x, y - 0.55, z - run / 2);
  }
  for (const sx of [-18, 18]) beam(k, wood, { x: x + sx, y: FLOOR_Y, z: z0 + 3 }, { x: x + sx, y: CEIL_Y, z: z0 - run * (n - 1) - 6 }, 1.5, 10);
  // a handrail on two posts
  const rail = paint(0x3a2a1c, 0.6, 0, 0.3);
  beam(k, rail, { x: x + 19, y: FLOOR_Y + 34, z: z0 + 2 }, { x: x + 19, y: FLOOR_Y + 34 + 96 * 0.85, z: z0 - run * (n - 1) * 0.85 }, 1.6, 1.6);
  k.box(rail, 1.6, 34, 1.6, x + 19, FLOOR_Y + 17, z0 + 2);
}

// ---- the back right corner: the water heater and the furnace with its duct ----
function buildCorner(k) {
  const x = WALL.x1 - 16, z = WALL.z0 + 16;
  const enamel = paint(0xcfc8b4, 0.5, 0.1, 0.4);
  k.cylY(enamel, 10, 58, x, FLOOR_Y + 29, z);
  k.cylY(paint(0x8f8a7c, 0.5, 0.2, 0.4), 10.2, 1.5, x, FLOOR_Y + 58.5, z);
  k.cylY(M.steel, 2, 18, x, FLOOR_Y + 68, z);
  k.cylY(M.copper, 0.6, 30, x - 6, FLOOR_Y + 72, z + 3);
  k.cylY(M.copper, 0.6, 30, x + 6, FLOOR_Y + 72, z + 3);
  k.box(paint(0x1f1f1f, 0.6, 0.2, 0.3), 5, 4, 2, x, FLOOR_Y + 10, z + 10);
  const furnace = paint(0x5a5c4e, 0.6, 0.3, 0.35);
  k.box(furnace, 22, 48, 26, x - 30, FLOOR_Y + 24, WALL.z0 + 15);
  k.box(paint(0x3b3d33, 0.7, 0.3, 0.3), 16, 10, 0.4, x - 30, FLOOR_Y + 12, WALL.z0 + 28.3);
  k.box(M.steel, 14, 48 - 4, 14, x - 30, CEIL_Y - 22, WALL.z0 + 15);
  k.box(M.steel, 14, 10, 90, x - 30, CEIL_Y - 9, WALL.z0 + 60);
}

// ---- a workbench against the paneled wall, with a pegboard and a shelf of cans ----
function buildBench(k) {
  const x = WALL.x1 - 12, z = 40;
  const top = stdMat({ map: woodTexture('#8c6a44', '50,30,12'), roughness: 0.8, metalness: 0, envMapIntensity: 0.05 });
  k.box(top, 22, 1.5, 60, x, FLOOR_Y + 34, z);
  for (const sz of [-27, 27]) for (const sx of [-9, 9]) k.box(top, 3.5, 34, 3.5, x + sx, FLOOR_Y + 17, z + sz);
  k.box(top, 20, 0.75, 56, x, FLOOR_Y + 8, z);
  k.box(paint(0xb59a6a, 0.9, 0, 0.05), 0.4, 26, 48, WALL.x1 - 0.3, FLOOR_Y + 52, z);
  k.box(top, 9, 0.75, 52, WALL.x1 - 4.5, FLOOR_Y + 70, z);
  const cans = [0xb0261a, 0x2a5aa0, 0xd8b23a, 0x3c7a3a, 0xe8e2d4, 0x6a6a6a];
  for (let i = 0; i < 7; i++) {
    const c = paint(cans[i % cans.length], 0.45, 0.4, 0.5);
    k.cylY(c, 2.1, 4.8, WALL.x1 - 4.5, FLOOR_Y + 73, z - 22 + i * 7.2);
  }
  // a vise, a coffee can of brushes and a red toolbox on the bench
  k.box(M.steel, 5, 3, 4, x - 8, FLOOR_Y + 36.5, z - 22);
  k.cylY(M.steel, 2.2, 5, x - 2, FLOOR_Y + 37.3, z + 18);
  k.box(paint(0xa31d16, 0.4, 0.3, 0.6), 7, 6, 16, x + 2, FLOOR_Y + 37.8, z + 2);
  k.box(M.steel, 1, 0.8, 6, x + 2, FLOOR_Y + 41.2, z + 2);
}

// ---- a hopper window high in the back wall, with the night outside ----
function buildWindow(g, k) {
  const x = 30, y = CEIL_Y - 14, z = WALL.z0 + 0.2;
  const frame = paint(0xd8d2c0, 0.6, 0, 0.3);
  k.box(frame, 34, 1.4, 3, x, y - 6.7, z + 1.5);
  k.box(frame, 34, 1.4, 3, x, y + 6.7, z + 1.5);
  for (const sx of [-16.3, 0, 16.3]) k.box(frame, 1.4, 14.8, 3, x + sx, y, z + 1.5);
  const night = new THREE.Mesh(new THREE.PlaneGeometry(32, 12), new THREE.MeshBasicMaterial({ color: 0x1a2a44 }));
  night.position.set(x, y, z + 0.4);
  g.add(night);
}

// ---- a ledge on the front of the table for the power pack and the two hand controllers ----
export const STAND = { y: -1.6, z: TABLE_D / 2 + 4.4 };
function buildDriverStand(k) {
  const wood = stdMat({ map: woodTexture('#9a7a52', '60,40,20'), roughness: 0.7, metalness: 0, envMapIntensity: 0.05 });
  k.box(wood, 36, 0.75, 6.5, 0, STAND.y - 0.38, STAND.z);
  for (const sx of [-15, 15]) k.box(wood, 0.75, 3, 5, sx, STAND.y - 2, STAND.z - 0.5);
  // the power pack: a ribbed grey box with a red lamp and two pairs of terminals
  const pack = paint(0x4a4d52, 0.45, 0.4, 0.6);
  k.box(pack, 6.5, 3, 4.6, 0, STAND.y + 1.5, STAND.z - 0.4);
  for (let i = 0; i < 6; i++) k.box(M.black, 0.25, 0.1, 3.8, -2.6 + i * 1.04, STAND.y + 3.05, STAND.z - 0.4);
  k.sphere(M.tail, 0.28, 0.28, 0.28, 2.6, STAND.y + 2.2, STAND.z + 1.9);
  for (const sx of [-1.8, -0.9, 0.9, 1.8]) k.cylZ(sx < 0 ? M.wireRed : M.black, 0.22, 0.4, sx, STAND.y + 0.9, STAND.z + 1.95);
}

// ---- the joists, the subfloor above them, and the lamp's cord ----
// Only drawn while the camera is below them, so the table can be seen from above the room.
function buildCeiling() {
  const k = new Kit();
  const wood = stdMat({ map: woodTexture('#7d6244', '40,26,12'), roughness: 0.9, metalness: 0, envMapIntensity: 0.05 });
  for (let x = WALL.x0 + 8; x < WALL.x1; x += 16) k.box(wood, 1.5, 7.25, WALL.z1 - WALL.z0, x, CEIL_Y - 3.6, (WALL.z0 + WALL.z1) / 2);
  k.box(paint(0x5a4630, 0.95, 0, 0.05), WALL.x1 - WALL.x0, 0.75, WALL.z1 - WALL.z0, 0, CEIL_Y + 0.4, (WALL.z0 + WALL.z1) / 2);
  // a steel beam across the middle on a lally column
  k.box(M.steel, WALL.x1 - WALL.x0, 8, 4, 0, CEIL_Y - 4, -56);
  k.cylY(paint(0x7a2a1e, 0.6, 0.3, 0.4), 1.8, 96, -70, FLOOR_Y + 48, -56);
  const c = k.build();
  ceiling.add(c);
  pin(ceiling);
}

// ---- the lamp: a green enamel shade on a cord, with a bare bulb inside ----
const shadeOut = paint(0x23452c, 0.35, 0.15, 0.8);
const shadeIn = new THREE.MeshStandardMaterial({ color: 0xf2ecdc, emissive: 0xfff0d0, emissiveIntensity: 0.55, roughness: 0.6, side: THREE.DoubleSide });
const bulbMat = glowMat(0xfff4dc, 3.5);
bulbMat.userData.surface = false;
export function buildLamp() {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(1.2 + 7.6 * Math.pow(t, 1.6), 5 - 5 * t)); }
  const shape = new THREE.LatheGeometry(prof, 40);
  const out = new THREE.Mesh(shape, shadeOut); out.castShadow = false;
  const inner = new THREE.Mesh(shape, shadeIn);
  inner.scale.setScalar(0.985); inner.position.y = -0.04;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 1.6, 20), M.black);
  cap.position.y = 5.6;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14), bulbMat);
  bulb.position.y = 2.2; bulb.scale.set(1, 1.25, 1);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6), M.black);
  const cordLen = CEIL_Y - LAMP_Y - 6;
  cord.scale.y = cordLen; cord.position.y = 6 + cordLen / 2;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffd9a0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(16); glow.position.y = 1.2;
  g.add(out, inner, cap, bulb, cord, glow);
  g.position.set(0, LAMP_Y, 0);
  scene.add(g);
  pin(g);
  lampGroup = g;
}
let lampGroup = null;
// each frame: the ceiling shows only while the camera is under it
export function updateRoom() {
  // looking down from above the lamp, its shade would hide the table: leave it out of the picture
  if (lampGroup) lampGroup.visible = camera.position.y < LAMP_Y + 8;
  ceiling.visible = camera.position.y < CEIL_Y - 1 && Math.abs(camera.position.x) < WALL.x1 && camera.position.z > WALL.z0 && camera.position.z < WALL.z1;
}

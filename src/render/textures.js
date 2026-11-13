// ===== render/textures: procedural canvas textures (concrete, block, paneling, plywood, track) =====
import * as THREE from 'three';
import { TAU } from '../core/geometry.js';
import { renderer } from './stage.js';

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(c, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export const css = hex => '#' + hex.toString(16).padStart(6, '0');
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// grain: scatter per-pixel noise over what's drawn
function grain(g, W, H, amt, r) {
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}
function blotches(g, W, H, n, r, light, dark, size = [40, 160]) {
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, rad = size[0] + r() * (size[1] - size[0]);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, r() > 0.5 ? light : dark);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

// poured basement floor: grey, mottled, a few old stains and a control joint
export function concreteTexture() {
  const W = 1024, H = 1024, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(3);
  g.fillStyle = '#6d6a64'; g.fillRect(0, 0, W, H);
  blotches(g, W, H, 220, r, 'rgba(150,146,138,0.08)', 'rgba(40,38,34,0.1)');
  blotches(g, W, H, 9, r, 'rgba(50,42,30,0.22)', 'rgba(36,32,28,0.25)', [30, 90]);
  g.strokeStyle = 'rgba(30,28,26,0.55)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5); g.moveTo(W * 0.5, 0); g.lineTo(W * 0.5, H); g.stroke();
  grain(g, W, H, 22, r);
  return canvasTex(c, true, true);
}
// painted cinder block: running bond, soft shadow in each mortar joint
export function blockTexture() {
  const W = 512, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#8c877b'; g.fillRect(0, 0, W, H);
  const bw = 256, bh = 128;
  for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
    const x = col * bw + (row % 2 ? bw / 2 : 0), y = row * bh;
    const v = 128 + (r() - 0.5) * 14;
    g.fillStyle = `rgb(${v + 12},${v + 8},${v - 4})`; g.fillRect(x + 4, y + 4, bw - 8, bh - 8);
  }
  g.fillStyle = 'rgba(60,56,50,0.65)';
  for (let row = 0; row <= 4; row++) g.fillRect(0, row * bh - 3, W, 6);
  for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) g.fillRect(col * bw + (row % 2 ? bw / 2 : 0) - 3, row * bh, 6, bh);
  blotches(g, W, H, 40, r, 'rgba(170,165,150,0.08)', 'rgba(50,46,40,0.12)', [20, 70]);
  grain(g, W, H, 30, r);
  return canvasTex(c, true, true);
}
// 1970s knotty-pine paneling: vertical boards with grooves and the odd knot
export function panelTexture() {
  const W = 1024, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(21);
  const boards = 8, bw = W / boards;
  for (let b = 0; b < boards; b++) {
    const tone = 0.85 + r() * 0.3;
    g.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(98 * tone)},${Math.round(54 * tone)})`;
    g.fillRect(b * bw, 0, bw, H);
    for (let i = 0; i < 26; i++) {
      const x = b * bw + r() * bw;
      g.strokeStyle = `rgba(70,38,16,${0.08 + r() * 0.16})`; g.lineWidth = 0.8 + r() * 2.5;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= H; y += 24) g.lineTo(x + Math.sin(y * 0.02 + i) * 3 + (r() - 0.5) * 2, y);
      g.stroke();
    }
    for (let k = 0; k < 2; k++) if (r() > 0.35) {
      const x = b * bw + 10 + r() * (bw - 20), y = r() * H, rx = 5 + r() * 7;
      g.fillStyle = 'rgba(60,30,12,0.75)'; g.beginPath(); g.ellipse(x, y, rx, rx * 1.4, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(80,42,16,0.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, rx * 2.2, rx * 3.4, 0, 0, TAU); g.stroke();
    }
    g.fillStyle = 'rgba(25,14,6,0.8)'; g.fillRect(b * bw - 2, 0, 4, H);
  }
  grain(g, W, H, 14, r);
  return canvasTex(c, true, true);
}
// The table: a sheet of plywood rolled with flat green paint, a little uneven, with the faint
// grain of the plies showing through and a few marks from years of racing.
export function tableTexture() {
  const W = 2048, H = 1024, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(5);
  g.fillStyle = '#3d5a3c'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const y = r() * H;
    g.strokeStyle = `rgba(${r() > 0.5 ? '90,120,80' : '24,40,26'},${0.04 + r() * 0.06})`; g.lineWidth = 1 + r() * 4;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 64) g.lineTo(x, y + Math.sin(x * 0.004 + i) * 6);
    g.stroke();
  }
  blotches(g, W, H, 160, r, 'rgba(110,140,100,0.06)', 'rgba(20,30,20,0.08)', [60, 220]);
  grain(g, W, H, 12, r);
  return canvasTex(c);
}
export function woodTexture(base, dark, w = 1024, h = 256) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(11);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const y = r() * h, a = 0.05 + r() * 0.12;
    g.strokeStyle = `rgba(${dark},${a})`; g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 + (r() - 0.5) * 2);
    g.stroke();
  }
  return canvasTex(c, true, true);
}
// Molded black track: a fine stipple so the light catches it like the real plastic. u runs along the
// track one repeat every 3", v across it.
function trackTexture() {
  const W = 256, H = 256, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(17);
  g.fillStyle = '#1d1d1f'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5000; i++) { const v = 22 + r() * 22; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
  return canvasTex(c, true, true);
}
// red and white curbing painted on the outside of the turns, one block per 0.75"
function kerbTexture() {
  const c = makeCanvas(128, 16), g = c.getContext('2d');
  g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, 128, 16);
  g.fillStyle = '#b8261d'; g.fillRect(0, 0, 64, 16);
  return canvasTex(c, true, true);
}
function checkerTexture() {
  const c = makeCanvas(256, 32), g = c.getContext('2d');
  for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#eee'; g.fillRect(x * 16, y * 16, 16, 16); }
  return canvasTex(c, true, true);
}
function glowTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return canvasTex(c, false);
}
// a five-spoke mag wheel face, the rims most of these cars wore
function magTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#c9c9c4'; g.beginPath(); g.arc(64, 64, 64, 0, TAU); g.fill();
  g.fillStyle = '#2a2a2c'; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.fill();
  g.fillStyle = '#b9b9b4';
  for (let i = 0; i < 5; i++) {
    g.save(); g.translate(64, 64); g.rotate(i / 5 * TAU);
    g.beginPath(); g.moveTo(-9, 0); g.lineTo(-6, -52); g.lineTo(6, -52); g.lineTo(9, 0); g.fill();
    g.restore();
  }
  g.fillStyle = '#ddd'; g.beginPath(); g.arc(64, 64, 14, 0, TAU); g.fill();
  g.fillStyle = '#555'; g.beginPath(); g.arc(64, 64, 5, 0, TAU); g.fill();
  return canvasTex(c);
}
// raised white lettering round a tyre's sidewall
function sidewallTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(64, 64, 64, 0, TAU); g.fill();
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.stroke();
  g.fillStyle = '#d8d4c8'; g.font = 'bold 15px Arial'; g.textAlign = 'center';
  for (const a of [0, Math.PI]) { g.save(); g.translate(64, 64); g.rotate(a); g.fillText('RACING', 0, -46); g.restore(); }
  return canvasTex(c);
}
export const TEX = { track: trackTexture(), kerb: kerbTexture(), checker: checkerTexture(), glow: glowTexture(), mag: magTexture(), sidewall: sidewallTexture() };

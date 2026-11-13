// ===== render/materials: shared materials, paint, lamp lenses and the livery atlas =====
import * as THREE from 'three';
import { makeCanvas, canvasTex, TEX } from './textures.js';

export function stdMat(o) { return new THREE.MeshStandardMaterial({ envMapIntensity: 0.6, ...o }); }
const paintCache = new Map();
// gloss enamel by default: a slot car's paint is shiny, a basement's isn't
export function paint(hex, rough = 0.32, metal = 0.05, env = 0.9) {
  const key = hex + '|' + rough + '|' + metal + '|' + env;
  if (!paintCache.has(key)) paintCache.set(key, stdMat({ color: hex, roughness: rough, metalness: metal, envMapIntensity: env }));
  return paintCache.get(key);
}
// a lamp lens: dark glass that glows. Glowing parts sit on their model's surface and cast no shadow.
export function glowMat(hex, intensity = 1) {
  const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: hex, emissiveIntensity: intensity, roughness: 0.3 });
  m.userData.surface = true;
  return m;
}

export const M = {
  track: stdMat({ color: 0xffffff, map: TEX.track, roughness: 0.42, metalness: 0.0, envMapIntensity: 0.7 }),
  trackSide: stdMat({ color: 0x141416, roughness: 0.6, metalness: 0 }),
  slot: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  rail: stdMat({ color: 0xc4c7c9, roughness: 0.3, metalness: 0.75, envMapIntensity: 1.6 }),
  kerb: stdMat({ color: 0xffffff, map: TEX.kerb, roughness: 0.5, metalness: 0, envMapIntensity: 0.4 }),
  checker: stdMat({ color: 0xffffff, map: TEX.checker, roughness: 0.5, metalness: 0, envMapIntensity: 0.4 }),
  whiteLine: stdMat({ color: 0xe8e2d4, roughness: 0.5, metalness: 0 }),
  chrome: stdMat({ color: 0xe6e6e6, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.4 }),
  steel: stdMat({ color: 0x55575c, roughness: 0.4, metalness: 0.8, envMapIntensity: 0.9 }),
  copper: stdMat({ color: 0xc27a4a, roughness: 0.35, metalness: 1.0, envMapIntensity: 1.0 }),
  black: stdMat({ color: 0x18181a, roughness: 0.45, metalness: 0.1 }),
  matte: stdMat({ color: 0x1c1c1c, roughness: 0.85, metalness: 0 }),
  rubber: stdMat({ color: 0x161616, roughness: 0.82, metalness: 0, envMapIntensity: 0.3 }),
  glass: stdMat({ color: 0x0b0e12, roughness: 0.05, metalness: 0.4, envMapIntensity: 1.6 }),
  mag: stdMat({ map: TEX.mag, roughness: 0.25, metalness: 0.8, envMapIntensity: 1.1 }),
  sidewall: stdMat({ map: TEX.sidewall, roughness: 0.8, metalness: 0, envMapIntensity: 0.3 }),
  wireRed: stdMat({ color: 0x8e1d18, roughness: 0.5, metalness: 0 }),
  wireBlack: stdMat({ color: 0x1a1a1a, roughness: 0.5, metalness: 0 }),
  bakelite: stdMat({ color: 0x2a1c14, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.8 }),
  head: glowMat(0xfff2c8, 0.35),
  tail: glowMat(0xc81e10, 0.5),
};
M.glass.userData.surface = true;
// slots and rails are strips laid on the track surface: keep them off the shadow pass, and draw them
// over the surface they lie on
for (const m of [M.slot, M.rail, M.kerb, M.checker, M.whiteLine]) { m.userData.surface = true; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }

// A livery is painted into a four-band atlas: the top view, the right side seen from the right, the
// left side seen from the left (so lettering reads the right way on both), and the nose and tail. The
// body is box-mapped into it (see mergeList in kit.js); box is the body's extent { x0, x1, y0, y1, z0, z1 }.
// draw(g, view) paints one band: view has w, h, X(x) and Y(y or z) to turn body coordinates into
// pixels, and side ('top', 'right', 'left', 'end'). Made once per key and kept.
const liveryCache = new Map();
export function liveryMat(key, box, opts, draw) {
  if (!liveryCache.has(key)) {
    const W = 1024, BH = 256, c = makeCanvas(W, BH * 4), g = c.getContext('2d');
    const views = [
      { side: 'top', X: x => (x - box.x0) / (box.x1 - box.x0) * W, Y: z => (z - box.z0) / (box.z1 - box.z0) * BH },
      { side: 'right', X: x => (x - box.x0) / (box.x1 - box.x0) * W, Y: y => (box.y1 - y) / (box.y1 - box.y0) * BH },
      { side: 'left', X: x => (box.x1 - x) / (box.x1 - box.x0) * W, Y: y => (box.y1 - y) / (box.y1 - box.y0) * BH },
      { side: 'end', X: z => (z - box.z0) / (box.z1 - box.z0) * W, Y: y => (box.y1 - y) / (box.y1 - box.y0) * BH },
    ];
    views.forEach((v, i) => {
      g.save(); g.beginPath(); g.rect(0, i * BH, W, BH); g.clip(); g.translate(0, i * BH);
      draw(g, { ...v, w: W, h: BH });
      g.restore();
    });
    const m = stdMat({ map: canvasTex(c), roughness: 0.28, metalness: 0.05, envMapIntensity: 1.0, ...opts });
    m.userData.box = box;
    liveryCache.set(key, m);
  }
  return liveryCache.get(key);
}

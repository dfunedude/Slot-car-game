// ===== cars/paintwork: brushes for painting liveries into a car's atlas (see liveryMat) =====
// Each takes the band being painted (v: side, X, Y, w, h) and works in body inches, so a roundel is
// round on the car whichever way the atlas stretches it.
import { css } from '../render/textures.js';

export const hex = c => (typeof c === 'number' ? css(c) : c);
const sx = v => Math.abs(v.X(1) - v.X(0));
const sy = v => Math.abs(v.Y(1) - v.Y(0));

export function fill(g, v, c) { g.fillStyle = hex(c); g.fillRect(0, 0, v.w, v.h); }
// a band from x0 to x1 and between heights (or, on top, between z0 and z1)
export function rect(g, v, x0, x1, a0, a1, c) {
  const X0 = v.X(x0), X1 = v.X(x1), Y0 = v.Y(a0), Y1 = v.Y(a1);
  g.fillStyle = hex(c);
  g.fillRect(Math.min(X0, X1), Math.min(Y0, Y1), Math.abs(X1 - X0), Math.abs(Y1 - Y0));
}
// a four-sided panel given as [x, y] corners in body inches
export function poly(g, v, pts, c) {
  g.fillStyle = hex(c); g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(v.X(x), v.Y(y)) : g.moveTo(v.X(x), v.Y(y))));
  g.closePath(); g.fill();
}
export function ellipse(g, v, x, a, rx, ra, c) {
  g.fillStyle = hex(c); g.beginPath();
  g.ellipse(v.X(x), v.Y(a), rx * sx(v), ra * sy(v), 0, 0, Math.PI * 2); g.fill();
}
// lettering h inches tall centred on (x, a); squash narrows it like period decal type
export function text(g, v, str, x, a, h, c, { weight = 800, italic = true, squash = 0.8, font = 'Arial Black, Arial, sans-serif', maxW = 0, stroke = null } = {}) {
  // work in pixels of the band's height, so the type is rasterised at a sensible size
  const px = h * sy(v), k = squash * sx(v) / sy(v);
  g.save();
  g.translate(v.X(x), v.Y(a));
  g.scale(k, 1);
  g.font = `${italic ? 'italic ' : ''}${weight} ${px}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = maxW ? maxW * sy(v) / squash : undefined;
  if (stroke) { g.lineWidth = px * 0.16; g.strokeStyle = hex(stroke); g.strokeText(str, 0, px * 0.04, w); }
  g.fillStyle = hex(c); g.fillText(str, 0, px * 0.04, w);
  g.restore();
}
// a racing number in a roundel (or a square meatball when square is set)
export function roundel(g, v, x, a, r, num, bg = 0xf4efe2, fg = 0x111111, square = false) {
  if (square) rect(g, v, x - r, x + r, a - r, a + r, bg);
  else ellipse(g, v, x, a, r, r, bg);
  text(g, v, String(num), x, a, r * 1.25, fg, { italic: false, weight: 900, squash: String(num).length > 1 ? 0.62 : 0.8 });
}
// dark wheel arches painted round where the wheels stand proud of a closed body
export function arches(g, v, xs, r, c = 0x0a0a0a) {
  if (v.side === 'top') return;
  for (const x of xs) {
    g.fillStyle = hex(c); g.beginPath();
    g.ellipse(v.X(x), v.Y(r), (r + 0.05) * sx(v), (r + 0.05) * sy(v), 0, Math.PI, 0); g.lineTo(v.X(x) + (r + 0.05) * sx(v), v.h); g.lineTo(v.X(x) - (r + 0.05) * sx(v), v.h); g.fill();
  }
}
// flames licking back from the nose along the side, the custom painter's favourite
export function flames(g, v, x0, x1, y0, y1, cols) {
  if (v.side === 'top') return;
  const n = 6, H = y1 - y0;
  cols.forEach((c, k) => {
    const shrink = k * 0.1;
    g.fillStyle = hex(c); g.beginPath(); g.moveTo(v.X(x1), v.Y(y0 + shrink * H * 0.4));
    for (let i = 0; i < n; i++) {
      const xa = x1 - (x1 - x0) * (0.25 + 0.75 * ((i * 37) % 10) / 10) * (1 - shrink);
      const ya = y0 + H * (i + 0.5) / n;
      g.quadraticCurveTo(v.X((x1 + xa) / 2), v.Y(ya - H * 0.08), v.X(xa), v.Y(ya));
      g.quadraticCurveTo(v.X((x1 + xa) / 2 + 0.2), v.Y(ya + H * 0.05), v.X(x1 - 0.1), v.Y(y0 + H * (i + 1) / n));
    }
    g.lineTo(v.X(x1), v.Y(y1 - shrink * H * 0.4)); g.closePath(); g.fill();
  });
}

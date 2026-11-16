// ===== ui/icons: the track palette's buttons, drawn from the pieces themselves, and car silhouettes =====
import { PIECES, APPEND } from '../core/pieces.js';

// [palette kind, label], for two-lane track; the four-lane palette is below
const ITEMS = [
  ['straight', 'Straight'], ['short', 'Short'], ['long', 'Long'], ['start', 'Start line'],
  ['c9L', '9″ left'], ['c9R', '9″ right'], ['c12L', '12″ left'], ['c12R', '12″ right'],
  ['c15L', '15″ left'], ['c15R', '15″ right'], ['c6L', '6″ left'], ['c6R', '6″ right'],
  ['bank90L', 'Bank 90° L'], ['bank90R', 'Bank 90° R'], ['bank180L', 'Bank 180° L'], ['bank180R', 'Bank 180° R'],
  ['swap', 'Lane swap'], ['cross', 'Crossing'],
];
const WIDE = [
  ['wstraight', 'Straight'], ['wshort', 'Short'], ['wlong', 'Long'], ['wstart', 'Start line'],
  ['wc12L', '12″ left'], ['wc12R', '12″ right'], ['wc15L', '15″ left'], ['wc15R', '15″ right'],
  ['wc18L', '18″ left'], ['wc18R', '18″ right'],
  ['wbank90L', 'Bank 90° L'], ['wbank90R', 'Bank 90° R'], ['wbank180L', 'Bank 180° L'], ['wbank180R', 'Bank 180° R'],
  ['wswap', 'Lane swap'], ['wcross', 'Crossing'],
];
// the piece seen from above, scaled into the chip: the black track, its two slots and (for turns)
// the curb. Left-hand versions are the right-hand piece mirrored.
function pieceIcon(kind) {
  const a = APPEND[kind], def = PIECES[a.type], flip = /L$/.test(kind) && def.curve ? -1 : 1;
  const pts = [];
  const q = {};
  for (const r of def.routes) for (let i = 0; i <= 16; i++) { r.at(r.len * i / 16, q); pts.push([q.x, q.z * flip]); }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const TW = def.width, pad = TW / 2 + 0.6, W = 44, H = 26;
  x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
  const s = Math.min(W / (x1 - x0), H / (z1 - z0)), ox = (W - (x1 - x0) * s) / 2, oz = (H - (z1 - z0) * s) / 2;
  const P = (x, z) => `${(ox + (x - x0) * s).toFixed(1)},${(oz + (z - z0) * s).toFixed(1)}`;
  const line = (r, lat = 0) => {
    const out = [];
    for (let i = 0; i <= 16; i++) { r.at(r.len * i / 16, q); out.push(P(q.x - Math.sin(q.h) * lat, (q.z + Math.cos(q.h) * lat) * flip)); }
    return 'M' + out.join('L');
  };
  const lane = L => { const out = []; for (let i = 0; i <= 16; i++) { L.at(L.len * i / 16, q); out.push(P(q.x, q.z * flip)); } return 'M' + out.join('L'); };
  let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  if (def.curve) for (const r of def.routes) svg += `<path d="${line(r, -TW / 2 - 0.35)}" fill="none" stroke="#c8281c" stroke-width="${(0.7 * s).toFixed(2)}" stroke-dasharray="${(0.7 * s).toFixed(1)}" />`;
  for (const r of def.routes) svg += `<path d="${line(r)}" fill="none" stroke="currentColor" stroke-opacity=".9" stroke-width="${(TW * s).toFixed(2)}" />`;
  for (const r of def.routes) svg += `<path d="${line(r)}" fill="none" stroke="#111" stroke-width="${((TW - 0.5) * s).toFixed(2)}" />`;
  for (const L of def.lanes) svg += `<path d="${lane(L)}" fill="none" stroke="#bbb" stroke-width="0.9" />`;
  if (def.start) { def.routes[0].at(4.5, q); svg += `<path d="M${P(q.x, -TW / 2)}L${P(q.x, TW / 2)}" stroke="#f2c14e" stroke-width="2" />`; }
  if (def.banked) svg += `<text x="${W - 1}" y="${H - 1}" text-anchor="end" font-size="8" font-weight="700" fill="#f07c12">B</text>`;
  return svg + '</svg>';
}
// [kind, label, icon, lanes]
export const PALETTE = [...ITEMS.map(([k, l]) => [k, l, pieceIcon(k), 2]), ...WIDE.map(([k, l]) => [k, l, pieceIcon(k), 4])];

// Car silhouettes for the garage, in profile, nose to the right: the outline (with its wheel arches)
// and where its rear and front wheels sit.
const SIL = {
  f1: ['M4 22h7a5 5 0 0 1 10 0h30a4 4 0 0 1 8 0h14l2-3-12-2-18-1-6-3h-3l-2-6h-5l-1 5-9 1-4-6H5l1 6-2 2z', 16, 55, 4.2, 3.4],
  canam: ['M4 22h9a5 5 0 0 1 10 0h28a5 5 0 0 1 10 0h14l1-4-8-4-14-1-4-3h-4l-2 2-9 0-4-1-2-7H6l1 7-3 2z', 18, 56],
  longtail: ['M2 21l2 1h9a5 5 0 0 1 10 0h31a5 5 0 0 1 10 0h11l1-3-6-4-12-2-6-5-9-1-7 4-13 2-12 2-9-4z', 18, 59],
  pony: ['M4 22h9a5 5 0 0 1 10 0h30a5 5 0 0 1 10 0h11l1-6-3-2-16-1-8-6H35L22 14 6 15l-2 3z', 18, 58],
  aero: ['M3 22h9a5 5 0 0 1 10 0h31a5 5 0 0 1 10 0h12l3-3-8-4-14-1-7-6H35l-9 6-12 1-2-9H6l1 9-4 3z', 17, 58],
  van: ['M5 23h8a5 5 0 0 1 10 0h28a5 5 0 0 1 10 0h11l1-6-3-1-4-9-4-1H8L6 8 5 16z', 18, 56],
};
export function carIcon(key) {
  const [d, rx, fx, rr = 4.2, fr = 4.2] = SIL[key] || SIL.f1, y = key === 'van' ? 23 : 22;
  const wheel = (x, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#111" stroke="currentColor" stroke-width="1.4"/>`;
  return `<svg viewBox="0 0 88 30" aria-hidden="true"><path d="${d}" fill="currentColor"/>${wheel(rx, rr)}${wheel(fx, fr)}</svg>`;
}

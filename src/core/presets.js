// ===== core/presets: ready-made circuits, written as build instructions =====
// Most of them are two identical halves that each turn 180°: laid one after the other, the second
// half is the first turned half a circle, so the lap always closes on the start.
import { PI } from './geometry.js';
import { APPEND } from './pieces.js';

const rep = (op, n) => Array(n).fill(op);
// short names for the build steps; curves and banks are named by radius or angle and the way they turn
const SHORT = { S: 'straight', H: 'short', L: 'long', T: 'start', X: 'swap' };

export const PRESETS = {
  oval: { name: 'Starter oval', ops: ['T', 'S', 'S', ...rep('C12L', 4), 'S', 'S', 'S', ...rep('C12L', 4)] },
  club: {
    name: 'Club circuit',
    ops: ['T', 'S', 'C12L', 'C12L', 'C9R', 'C9R', ...rep('C9L', 4),
      'X', 'S', 'C12L', 'C12L', 'C9R', 'C9R', ...rep('C9L', 4)],
  },
  road: {
    name: 'Road course',
    ops: ['T', 'L', 'S', 'C15L', 'S', 'C15R', ...rep('C9L', 4),
      'S', 'L', 'X', 'C15L', 'S', 'C15R', ...rep('C9L', 4)],
  },
  speedway: { name: 'Banked speedway', ops: ['T', 'L', 'L', 'S', 'B180L', 'S', 'L', 'L', 'S', 'B180L'] },
  fig8: {
    name: 'Figure eight',
    ops: [{ place: 'cross', x: 0, z: 0, rot: -PI / 4, label: 'x' },
      { from: 'x', end: 1 }, 'T', ...rep('C12R', 6), 'S',
      { from: 'x', end: 2 }, 'S', ...rep('C12L', 6), 'S'],
  },
};

const CURVE = new RegExp('^C(\\d+)([LR])$'), BANKED = new RegExp('^B(90|180)([LR])$');
function kindOf(op) {
  if (SHORT[op]) return SHORT[op];
  let m = CURVE.exec(op);
  if (m) return `c${m[1]}${m[2]}`;
  m = BANKED.exec(op);
  if (m) return `bank${m[1]}${m[2]}`;
  throw new Error('unknown preset step ' + op);
}

export function appendPiece(layout, J, kind) {
  const a = APPEND[kind];
  const pose = layout.poseFor(a.type, a.at, J);
  const p = layout.add(a.type, pose.x, pose.z, pose.rot);
  return { p, next: a.next };
}

export function buildPreset(layout, key) {
  const P = PRESETS[key];
  layout.clear();
  if (!P) return;
  const labels = {};
  let J = { x: 0, z: 0, h: 0 };
  for (const op of P.ops) {
    if (typeof op === 'string') {
      const { p, next } = appendPiece(layout, J, kindOf(op));
      J = layout.endWorld(p, next);
    } else if (op.place) {
      const p = layout.add(op.place, op.x, op.z, op.rot);
      if (op.label) labels[op.label] = p;
    } else if (op.from) {
      J = layout.endWorld(labels[op.from], op.end);
    }
  }
  // centre the result on the table
  const b = layout.bounds();
  const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
  for (const p of layout.pieces) { p.x -= mx; p.z -= mz; }
  layout.connectAll();
}

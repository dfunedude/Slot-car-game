// ===== core/presets: ready-made circuits, written as build instructions =====
// Most of them are two identical halves that each turn 180°: laid one after the other, the second
// half is the first turned half a circle, so the lap always closes on the start.
import { PI } from './geometry.js';
import { APPEND } from './pieces.js';

const rep = (op, n) => Array(n).fill(op);
// Short names for the build steps; curves and banks are named by radius or angle and the way they
// turn (C12L, B180R). A W in front picks the four-lane piece (WS, WC15L, WB180L).
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
  // four-lane circuits: each has a four-lane swap, so over two laps every lane runs the same distance
  oval4: { name: 'Four-lane oval', lanes: 4, ops: ['WT', 'WL', ...rep('WC15L', 4), 'WX', 'WS', ...rep('WC15L', 4)] },
  speedway4: { name: 'Four-lane speedway', lanes: 4, ops: ['WT', 'WL', 'WL', 'WS', 'WB180L', 'WX', 'WL', 'WS', 'WS', 'WB180L'] },
  road4: {
    name: 'Four-lane road course', lanes: 4,
    ops: ['WT', 'WL', 'WC15L', 'WC15R', ...rep('WC12L', 4),
      'WX', 'WS', 'WC15L', 'WC15R', ...rep('WC12L', 4)],
  },
  fig84: {
    name: 'Four-lane figure eight', lanes: 4,
    ops: [{ place: 'wcross', x: 0, z: 0, rot: -PI / 4, label: 'x' },
      { from: 'x', end: 1 }, 'WT', ...rep('WC15R', 6), 'WS',
      { from: 'x', end: 2 }, 'WS', ...rep('WC15L', 6), 'WS'],
  },
};

const CURVE = new RegExp('^C(\\d+)([LR])$'), BANKED = new RegExp('^B(90|180)([LR])$');
function kindOf(op) {
  const w = op[0] === 'W' && op.length > 1 ? 'w' : '';
  const o = w ? op.slice(1) : op;
  if (SHORT[o]) return w + SHORT[o];
  let m = CURVE.exec(o);
  if (m) return `${w}c${m[1]}${m[2]}`;
  m = BANKED.exec(o);
  if (m) return `${w}bank${m[1]}${m[2]}`;
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

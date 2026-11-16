// ===== core/traffic: where cars can meet: collisions at crossings, giving way, and the marshal =====
// Slots only meet on a crossing (where one road's slots cross the other's) and on a lane swap
// (where every slot swings across the others). Anywhere else cars pass side by side.
const crossingPiece = p => !!(p.def.cross || p.def.swap);
// do lanes la and lb of crossing piece p cross each other?
const meet = (p, la, lb) => la !== lb && (p.def.swap || p.def.lanes[la].route !== p.def.lanes[lb].route);
const HIT = 1.05;      // closer than this, centre to centre, and two cars on a crossing touch

// pairs of cars that have run into each other this frame
export function collisions(racers) {
  const out = [];
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const a = racers[i], b = racers[j];
    if (!a.onTrack || !b.onTrack) continue;
    if (Math.hypot(a.pose.x - b.pose.x, a.pose.z - b.pose.z) > HIT) continue;
    if (crossingPiece(a.path.segAt(a.s).p) || crossingPiece(b.path.segAt(b.s).p)) out.push([a, b]);
  }
  return out;
}

// When racer r will be in the middle of piece p, as a window of seconds from now, or null if p
// isn't on its way in the next `ahead` inches. inside: it's in the middle already.
function approach(r, p, ahead) {
  for (const g of r.path.segs) {
    if (g.p !== p) continue;
    const d = g.s0 + g.len / 2 - r.s;
    if (d < -2.5 || d > ahead) continue;
    const v = Math.max(r.v, 10);
    return { l: g.l, tin: Math.max(0, d - 2.5) / v, tout: (d + 2.5) / v, inside: d < 2.5 };
  }
  return null;
}
// Should the computer driving r lift to let another car through the crossing ahead? The car that
// would get there later waits; a car sitting in the crossing always goes first; a dead heat goes to
// the lower lane number, so two computers never both wait.
export function giveWay(r, others) {
  const look = Math.min(30, r.v * 0.7 + 6);
  r.path.cover(r.s - r.spec.wb - 3, r.s + look + 1);
  for (const g of r.path.segs) {
    if (!crossingPiece(g.p)) continue;
    const me = approach(r, g.p, look);
    if (!me) continue;
    for (const o of others) {
      if (o === r || !o.onTrack) continue;
      o.path.cover(o.s - o.spec.wb - 3, o.s + 30);
      const them = approach(o, g.p, 30);
      if (!them || !meet(g.p, me.l, them.l)) continue;
      if (me.tin > them.tout + 0.15 || them.tin > me.tout + 0.15) continue;
      if (them.inside && o.v < 12) return true;
      if (me.tin > them.tin + 0.03 || (Math.abs(me.tin - them.tin) <= 0.03 && r.slot > o.slot)) return true;
    }
  }
  return false;
}

// Whether a marshal can put r back on the track now: one car at a time, and not into the path of
// another car that's moving near where it would go (or on top of one that's stopped there).
const home = {};
export function clearToReset(r, others) {
  if (others.some(o => o !== r && o.state === 'reset')) return false;
  r.homePose(home);
  return !others.some(o => o !== r && o.onTrack && Math.hypot(o.pose.x - home.x, o.pose.z - home.z) < (o.v > 5 ? 10 : 3));
}

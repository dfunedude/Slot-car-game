// ===== core/racer: one car's driving: motor, cornering, deslotting, flying off and being put back =====
// No rendering here: the car's pose is worked out as numbers and sim/car.js puts a model there.
import { PI, G, TABLE_W, TABLE_D, clamp, normAng } from './geometry.js';
import { LanePath } from './path.js';

export const FLOOR_Y = -30;                      // the basement floor, under the table top
export const ROOM = { x: 118, z0: -96, z1: 110 }; // the walls a flying car bounces off
export const GUIDE = 0.3;                        // the guide pin sits this far ahead of the front axle
const SUB = 1 / 240;                             // physics steps (a fast car covers under half an inch)
const SLIP_RATE = 5;                             // how fast going over the limit builds up slide
const SLIP_MAX = 0.12;                           // slide past this and the guide pops out of the slot
const HARD_LIMIT = 1.6;                          // or this far over the limit, at once
const RESET_TIME = 0.75;

// sideways grip at curvature k (signed) on track rolled by roll: banking into the turn adds to it
export function cornerLimit(spec, k, roll) {
  const eff = k === 0 ? 0 : Math.sign(k) * roll;
  return spec.grip + G * 0.9 * Math.sin(eff);
}
// The hand controller: squeeze and the motor pulls towards trigger × top speed; let go and the
// controller shorts the motor, which brakes hard.
export function motorAccel(spec, v, trigger) {
  if (trigger < 0.02) return -spec.brake * v - 6;
  const target = trigger * spec.vmax;
  return v < target ? spec.pull * (target - v) : -1.8 * (v - target) - 4;
}

export class Racer {
  constructor(spec, slot) {
    this.spec = spec; this.slot = slot;
    this.path = new LanePath();
    this.state = 'idle';          // idle (not on the table), run, fly (off and tumbling), reset (being put back)
    this.s = 0; this.v = 0; this.trigger = 0; this.hold = false;
    this.ratio = 0; this.slip = 0; this.drift = 0; this.rest = 0;
    this.pose = { x: 0, y: 0, z: 0, h: 0, roll: 0, pitch: 0 };
    this.fly = null; this.back = null;
    this.onLap = null; this.onDeslot = null; this.onLand = null;
    this._g = {}; this._r = {};
  }
  setSpec(spec) { this.spec = spec; }
  get a() { return (this.spec.wb - GUIDE) / 2; }   // half the axle spacing
  // set the guide pin down on lane l of piece p, running in direction d, u inches in from where
  // that direction enters the piece
  place(p, l, d, u) {
    const P = this.path;
    P.segs = [P.seg(p, l, d, 0)];
    this.s = u; this.lastLine = -Infinity;
    this.state = 'run'; this.v = 0; this.slip = 0; this.ratio = 0; this.drift = 0; this.fly = null; this.back = null;
    P.cover(this.s - this.spec.wb - 3, this.s + 3);
    this.trackPose();
  }
  lift() { this.state = 'idle'; this.v = 0; this.fly = null; this.back = null; this.path.segs = []; }
  get onTrack() { return this.state === 'run'; }
  get placed() { return this.state !== 'idle'; }

  step(dt, now) {
    if (this.state === 'run') {
      for (let t = dt; t > 1e-6; t -= SUB) { if (!this.drive(Math.min(SUB, t), now)) break; }
      if (this.state === 'run') this.trackPose();
    }
    if (this.state === 'fly') for (let t = dt; t > 1e-6; t -= SUB) this.tumble(Math.min(SUB, t));
    if (this.state === 'reset') this.putBack(dt);
  }
  // one physics step on the track; false once the car has left it
  drive(h, now) {
    const sp = this.spec, P = this.path;
    const trig = this.hold ? 0 : this.trigger;
    this.v = Math.max(0, this.v + motorAccel(sp, this.v, trig) * h);
    const s0 = this.s;
    this.s += this.v * h;
    P.cover(this.s - sp.wb - 3, this.s + 3);
    // the start line, for lap counting
    for (const g of P.segs) {
      const line = P.lineOn(g);
      // a car put back a little before the line mustn't count the same crossing twice
      if (line > s0 && line <= this.s && line > this.lastLine) { this.lastLine = line; if (this.onLap) this.onLap(this, now); }
    }
    if (this.s > P.s1) { this.s = P.s1; this.deslot('end'); return false; }
    const q = P.at(this.s, this._g);
    const lat = this.v * this.v * Math.abs(q.k);
    this.ratio = lat / cornerLimit(sp, q.k, q.roll);
    if (this.ratio > 1) this.slip += (this.ratio - 1) * h * SLIP_RATE;
    else this.slip = Math.max(0, this.slip - h * 0.9);
    // near the limit the tail steps out, pivoting on the guide pin
    const want = Math.sign(q.k) * sp.drift * clamp((this.ratio - 0.6) / 0.5, 0, 1.25);
    this.drift += (want - this.drift) * Math.min(1, h * 9);
    if (this.slip > SLIP_MAX || this.ratio > HARD_LIMIT) { this.deslot('corner', q.k); return false; }
    return true;
  }
  // the body's pose on the track, from the guide pin and the rear axle
  trackPose(s = this.s, drift = this.drift, o = this.pose) {
    const P = this.path, g = P.at(s, this._g), r = P.at(s - this.spec.wb, this._r);
    const hc = Math.atan2(g.z - r.z, g.x - r.x), hb = hc + drift, back = this.a + GUIDE;
    o.x = g.x - Math.cos(hb) * back; o.z = g.z - Math.sin(hb) * back;
    o.y = (g.y + r.y) / 2; o.h = hb; o.roll = (g.roll + r.roll) / 2;
    o.pitch = Math.atan2(g.y - r.y, this.spec.wb);
    return o;
  }
  // The guide pops out: the car carries on the way it was going, flung towards the outside of the
  // turn, spinning, and rolling if it was fast and tall.
  deslot(why, k = 0) {
    const o = this.pose, v = this.v, sk = Math.sign(k), sp = this.spec;
    const tx = Math.cos(o.h - this.drift), tz = Math.sin(o.h - this.drift);
    const nx = -tz, nz = tx;   // right of travel
    this.fly = {
      x: o.x, y: o.y, z: o.z, h: o.h, roll: o.roll, pitch: o.pitch,
      vx: tx * v * 0.95 - nx * sk * v * 0.22, vz: tz * v * 0.95 - nz * sk * v * 0.22,
      vy: 8 + v * 0.22,
      hr: sk * v * 0.09 + (why === 'end' ? 0 : sk * 2),
      rr: -sk * sp.tumble * Math.max(0, v - 30) * 0.16,
      pr: why === 'end' ? -1.5 : 0,
      ground: false,
    };
    this.sOff = this.s; this.offWhy = why;
    this.state = 'fly'; this.rest = 0; this.ratio = 0; this.slip = 0;
    this.speedOff = v; this.v = 0;
    if (this.onDeslot) this.onDeslot(this, why);
  }
  tumble(h) {
    const f = this.fly, sp = this.spec;
    f.vy -= G * h;
    f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h;
    f.h += f.hr * h; f.roll += f.rr * h; f.pitch += f.pr * h;
    if (Math.abs(f.x) > ROOM.x) { f.x = Math.sign(f.x) * ROOM.x; f.vx *= -0.3; }
    if (f.z < ROOM.z0 || f.z > ROOM.z1) { f.z = clamp(f.z, ROOM.z0, ROOM.z1); f.vz *= -0.3; }
    const over = Math.abs(f.x) < TABLE_W / 2 && Math.abs(f.z) < TABLE_D / 2;
    // lying on its side or roof it sits higher than on its wheels
    const lift = (1 - Math.cos(f.roll)) / 2 * 0.6 + Math.abs(Math.sin(f.roll)) * 0.5;
    // once it has gone over the edge it stays under the table top
    const ground = (over && f.y > -1 ? 0 : FLOOR_Y) + lift;
    if (f.y < ground) {
      const hit = -f.vy;
      f.y = ground;
      if (hit > 40) {
        f.vy = hit * 0.3;
        f.rr = f.rr * 0.6 - Math.sign(f.hr || 1) * sp.tumble * hit * 0.02;
        f.pr *= -0.4;
        if (this.onLand) this.onLand(this, hit);
      } else f.vy = 0;
      f.ground = true;
    } else if (f.y > ground + 0.05) f.ground = false;
    if (f.ground) {
      const sp2 = Math.hypot(f.vx, f.vz), k = sp2 > 0 ? Math.max(0, sp2 - 0.6 * G * h) / sp2 : 0;
      f.vx *= k; f.vz *= k;
      f.hr *= Math.exp(-4 * h);
      if (f.vy === 0) {
        // settle onto the wheels, a side or the roof, whichever is nearest
        const goal = Math.round(f.roll / PI) * PI;
        f.rr = 0; f.roll += (goal - f.roll) * Math.min(1, h * 7);
        f.pr = 0; f.pitch += (0 - f.pitch) * Math.min(1, h * 7);
        if (sp2 < 0.5) this.rest += h; else this.rest = 0;
      }
    }
    const o = this.pose;
    o.x = f.x; o.y = f.y; o.z = f.z; o.h = f.h; o.roll = f.roll; o.pitch = f.pitch;
  }
  get resting() { return this.state === 'fly' && this.rest > 0.25; }
  // a marshal picks the car up and sets it back in its slot a little before where it came off
  // Where the marshal sets the car back down: a little before where it came off, or after a
  // collision, short of the crossing or lane swap it happened on, so it doesn't restart in the way.
  homeS() {
    const P = this.path, sp = this.spec;
    let s = this.sOff - 2.5;
    if (this.offWhy === 'hit') {
      const g = P.segAt(this.sOff);
      if (g.p.def.cross || g.p.def.swap) s = Math.min(s, g.s0 - 1.5);
    }
    P.cover(s - sp.wb - 3, this.sOff + 3);
    return Math.max(P.s0 + sp.wb + 0.5, s);
  }
  homePose(out = {}) { return this.trackPose(this.homeS(), 0, out); }
  reset() {
    if (this.state !== 'fly') return false;
    const from = { ...this.pose };
    this.s = this.homeS(); this.drift = 0;
    const to = this.trackPose(this.s, 0, {});
    this.back = { t: 0, from, to };
    this.state = 'reset';
    return true;
  }
  putBack(dt) {
    const b = this.back, o = this.pose;
    b.t = Math.min(1, b.t + dt / RESET_TIME);
    const k = b.t * b.t * (3 - 2 * b.t), F = b.from, T = b.to;
    o.x = F.x + (T.x - F.x) * k; o.z = F.z + (T.z - F.z) * k;
    o.y = F.y + (T.y - F.y) * k + Math.sin(PI * b.t) * (5 + Math.max(0, -F.y) * 0.4);
    o.h = F.h + normAng(T.h - F.h) * k;
    o.roll = F.roll + (Math.round(F.roll / (2 * PI)) * 2 * PI + T.roll - F.roll) * k;
    o.pitch = F.pitch + (T.pitch - F.pitch) * k;
    if (b.t >= 1) { this.state = 'run'; this.v = 0; this.back = null; this.fly = null; this.trackPose(); }
  }
}

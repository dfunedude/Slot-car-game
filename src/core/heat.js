// ===== core/heat: the racing on the table: who drives each lane, laps, crashes and the marshal =====
// No rendering or sound: sim/session.js wraps a heat with the cars' models and the noises.
import { SPECS } from './specs.js';
import { Racer } from './racer.js';
import { Race, gridPlace, MAX_LANES } from './race.js';
import { SKILLS, aiTrigger } from './ai.js';
import { collisions, clearToReset } from './traffic.js';

// What a lane can have at its controller: a player, a computer driver of some skill, or nobody.
export const DRIVERS = { human: 'Player', rookie: 'CPU · Rookie', pro: 'CPU · Pro', ace: 'CPU · Ace', off: 'Empty' };
export const isCPU = d => !!SKILLS[d];
const AI_RESET = 1.1;     // the computer's marshal waits this long once its car has stopped
const STAGGER = 0.9;      // and after a collision, this much longer per car, so they go back one by one

export class Heat {
  constructor(layout, rnd = Math.random) {
    this.layout = layout; this.rnd = rnd;
    this.racers = Array.from({ length: MAX_LANES }, (_, i) => new Racer(SPECS.f1, i));
    this.race = new Race();
    this.drivers = ['human', 'pro', 'off', 'off'];
    this.trig = this.racers.map(() => 0);       // the players' triggers, 0 to 1
    this.restT = this.racers.map(() => 0);      // how long each computer car has lain waiting
    this.wait = this.racers.map(() => 0);       // and its extra wait after a collision
    this.onEvent = null;                        // (kind, data)
    this.race.onEvent = (kind, d) => this.emit(kind, d);
    this.racers.forEach((r, i) => {
      r.onLap = () => this.race.lap(i);
      r.onDeslot = (rr, why) => this.emit('off', { slot: i, why, speed: rr.speedOff });
      r.onLand = (rr, hit) => this.emit('land', { slot: i, hit, floor: rr.pose.y < -5 });
    });
  }
  emit(kind, d) { if (this.onEvent) this.onEvent(kind, d); }
  get lanes() { return this.layout.laneCount(); }
  // a lane races if it has a driver and the track has that many lanes
  active(i) { return this.drivers[i] !== 'off' && i < this.lanes; }
  count() { return this.racers.filter((r, i) => this.active(i)).length; }
  setDriver(i, d) {
    this.drivers[i] = d;
    if (!this.active(i)) this.racers[i].lift();
    else if (!this.racers[i].placed) gridPlace(this.layout, this.racers[i]);
    this.race.racing = this.count();
  }
  // every car back to the grid, and a new session of the chosen mode
  begin(mode) {
    this.race.begin(mode);
    this.race.racing = this.count();
    this.regrid();
  }
  regrid() {
    this.racers.forEach((r, i) => { if (this.active(i)) gridPlace(this.layout, r); else r.lift(); this.restT[i] = 0; this.wait[i] = 0; });
  }
  reset(i) {
    const r = this.racers[i];
    if (r.state !== 'fly' || !r.reset()) return false;
    this.restT[i] = 0; this.wait[i] = 0;
    this.emit('reset', { slot: i });
    return true;
  }
  // the players' cars that are off and waiting to be put back
  waiting() { return this.racers.filter((r, i) => this.drivers[i] === 'human' && r.state === 'fly').map(r => r.slot); }
  update(dt) {
    const race = this.race;
    race.update(dt);
    this.racers.forEach((r, i) => {
      if (!this.active(i)) { if (r.placed) r.lift(); return; }
      if (!r.placed) gridPlace(this.layout, r);
      const who = this.drivers[i];
      r.hold = race.holding || race.phase === 'done' || (race.timing[i].done && race.isRace);
      if (r.hold) r.trigger = 0;
      else if (isCPU(who)) r.trigger = aiTrigger(r, SKILLS[who], dt, this.rnd, this.racers);
      else r.trigger = this.trig[i];
      r.step(dt, race.clock);
      // the computer's marshal: once its car has come to rest, after a pause, when the way is clear
      if (isCPU(who) && r.state === 'fly' && r.resting && (this.restT[i] += dt) > AI_RESET + this.wait[i] && clearToReset(r, this.racers)) {
        this.reset(i);
      }
    });
    for (const [a, b] of collisions(this.racers)) {
      // (a car hit by two others at once only comes off once)
      if (a.onTrack) a.deslot('hit', a.path.at(a.s, {}).k || 1);
      if (b.onTrack) b.deslot('hit', b.path.at(b.s, {}).k || -1);
      // the marshal puts them back one after the other, the lower lane first
      this.wait[Math.max(a.slot, b.slot)] = Math.max(this.wait[Math.max(a.slot, b.slot)], STAGGER);
      this.emit('collision', { a: a.slot, b: b.slot });
    }
  }
}

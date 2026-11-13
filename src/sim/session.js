// ===== sim/session: the racing: who drives each lane, the start lights, laps, crashes and collisions =====
import { SPECS } from '../core/specs.js';
import { Race, gridPlace } from '../core/race.js';
import { SKILLS, aiTrigger } from '../core/ai.js';
import { setStartLights } from '../world/track.js';
import { CarView } from './car.js';

// what a lane can have at its controller
export const DRIVERS = { human: 'Player', ai: 'Computer', off: 'Empty' };
const AI_RESET = 1.1;   // the computer's marshal puts its car back after this long at rest

export class Session {
  constructor(layout, sound) {
    this.layout = layout; this.sound = sound;
    this.cars = [new CarView(0), new CarView(1)];
    this.race = new Race();
    this.drivers = ['human', 'ai'];
    this.skill = 'pro';
    this.trig = [0, 0];          // the human triggers, 0 to 1, set by ui/controllers
    this.paused = false;
    this.onEvent = null;         // (kind, data) for the deck and the HUD
    this.race.onEvent = (kind, d) => this.raceEvent(kind, d);
    this.cars.forEach((c, i) => {
      const r = c.racer;
      r.onLap = () => this.race.lap(i);
      r.onDeslot = (rr, why) => { this.sound.crash(i, rr.speedOff); this.emit('off', { slot: i, why }); };
      r.onLand = (rr, hit) => this.sound.land(i, hit, rr.pose.y < -5);
      c.restT = 0;
    });
  }
  emit(kind, d) { if (this.onEvent) this.onEvent(kind, d); }
  raceEvent(kind, d) {
    if (kind === 'light') this.sound.beep(440, 0.22);
    else if (kind === 'green') this.sound.beep(880, 0.5, 0.22);
    else if (kind === 'lap') this.sound.tick(d.slot);
    else if (kind === 'finish' && d.place === 1) this.sound.beep(660, 0.12);
    this.emit(kind, d);
  }
  setCar(i, key, li) { this.cars[i].setModel(key, li); }
  setDriver(i, d) {
    this.drivers[i] = d;
    if (d === 'off') this.cars[i].racer.lift();
    else if (!this.cars[i].racer.placed) gridPlace(this.layout, this.cars[i].racer);
    this.race.racing = this.drivers.filter(x => x !== 'off').length;
  }
  // both cars back to the grid, and a new session of the chosen mode
  begin(mode) {
    this.race.begin(mode);
    this.race.racing = this.drivers.filter(x => x !== 'off').length;
    this.regrid();
  }
  regrid() {
    this.cars.forEach((c, i) => { if (this.drivers[i] === 'off') c.racer.lift(); else gridPlace(this.layout, c.racer); c.restT = 0; });
  }
  // put a car that's come off back in its slot
  reset(i) {
    const r = this.cars[i].racer;
    if (r.state === 'fly' && r.reset()) { this.sound.snap(); return true; }
    return false;
  }
  // the humans' cars that are off and waiting
  waiting() { return this.cars.filter((c, i) => this.drivers[i] === 'human' && c.racer.state === 'fly').map(c => c.slot); }
  update(dt) {
    if (this.paused) { for (const c of this.cars) c.update(0, false); return; }
    const race = this.race;
    race.update(dt);
    const L = race.lightState();
    setStartLights(L.red, L.green);
    this.cars.forEach((c, i) => {
      const r = c.racer, who = this.drivers[i];
      if (who === 'off') { c.update(dt, false); this.sound.car(i, 0, 0, 0, false); return; }
      if (!r.placed) gridPlace(this.layout, r);
      r.hold = race.holding || race.phase === 'done' || (race.timing[i].done && race.isRace);
      if (r.hold) r.trigger = 0;
      else if (who === 'ai') r.trigger = aiTrigger(r, SKILLS[this.skill], dt);
      else r.trigger = this.trig[i];
      r.step(dt, race.clock);
      if (who === 'ai' && r.state === 'fly' && r.resting && (c.restT += dt) > AI_RESET) { c.restT = 0; this.reset(i); }
      c.update(dt, who === 'human');
      this.sound.car(i, r.onTrack ? r.v / SPECS[c.key].vmax : 0, r.onTrack ? r.trigger : 0, r.onTrack ? r.ratio : 0, r.onTrack);
    });
    this.collide();
  }
  // Where the slots cross (a crossing or a lane swap) the cars can meet: if they do, both come off.
  collide() {
    const [a, b] = this.cars.map(c => c.racer);
    if (!a.onTrack || !b.onTrack) return;
    const ga = a.path.segAt(a.s), gb = b.path.segAt(b.s);
    const crossing = p => p.def.cross || p.def.swap;
    if (!crossing(ga.p) && !crossing(gb.p)) return;
    const d = Math.hypot(a.pose.x - b.pose.x, a.pose.z - b.pose.z);
    if (d > 1.05) return;
    const ka = a.path.at(a.s, {}).k, kb = b.path.at(b.s, {}).k;
    a.deslot('hit', ka || 1); b.deslot('hit', kb || -1);
    this.emit('collision', {});
  }
}

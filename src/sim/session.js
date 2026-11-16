// ===== sim/session: the heat on the table, with the cars' models and their noises =====
import { SPECS } from '../core/specs.js';
import { Heat } from '../core/heat.js';
import { setStartLights } from '../world/track.js';
import { CarView } from './car.js';

export class Session extends Heat {
  constructor(layout, sound) {
    super(layout);
    this.sound = sound;
    this.cars = this.racers.map((r, i) => new CarView(i, r));
    this.paused = false;
    this.ui = null;              // (kind, data) for the deck and the HUD
    this.onEvent = (kind, d) => this.heard(kind, d);
  }
  heard(kind, d) {
    const s = this.sound;
    if (kind === 'light') s.beep(440, 0.22);
    else if (kind === 'green') s.beep(880, 0.5, 0.22);
    else if (kind === 'lap') s.tick(d.slot);
    else if (kind === 'finish' && d.place === 1) s.beep(660, 0.12);
    else if (kind === 'off') s.crash(d.slot, d.speed);
    else if (kind === 'land') s.land(d.slot, d.hit, d.floor);
    else if (kind === 'reset') s.snap();
    if (this.ui) this.ui(kind, d);
  }
  setCar(i, key, li) { this.cars[i].setModel(key, li); }
  update(dt) {
    if (this.paused) { for (const c of this.cars) c.update(0, false); return; }
    super.update(dt);
    const L = this.race.lightState();
    setStartLights(L.red, L.green);
    this.cars.forEach((c, i) => {
      const r = c.racer, on = this.active(i) && r.onTrack;
      c.update(dt, this.drivers[i] === 'human');
      this.sound.car(i, on ? r.v / SPECS[c.key].vmax : 0, on ? r.trigger : 0, on ? r.ratio : 0, on);
    });
  }
}

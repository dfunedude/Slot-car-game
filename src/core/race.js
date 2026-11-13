// ===== core/race: practice and race sessions, the start lights, lap counting and timing =====
import { START_T } from './pieces.js';
import { LanePath } from './path.js';

export const MODES = {
  practice: { name: 'Practice', laps: 0 },
  r5: { name: 'Race · 5 laps', laps: 5 },
  r10: { name: 'Race · 10 laps', laps: 10 },
  r25: { name: 'Race · 25 laps', laps: 25 },
};
export const LANE_NAMES = ['Red', 'Blue'];
// Lane 1 (red) is the left-hand slot looking down the start straight in the racing direction. Seen
// looking out of the start piece's back end, that's its right-hand slot.
const SLOT_AT_START = [1, 0];
const GRID_GAP = 0.7;            // the guide pins wait this far behind the line
export const COUNTDOWN = 4;      // seconds of lights before the green

// Put a racer on the grid: on its lane of the start piece, just behind the line. Without a start
// piece it goes on the first piece laid.
export function gridPlace(layout, racer) {
  const st = layout.startPiece() || layout.pieces.find(p => !p.lifted);
  if (!st) { racer.lift(); return false; }
  const n = LanePath.laneAt(st, 0, SLOT_AT_START[racer.slot]);
  if (!n) { racer.lift(); return false; }
  const u = st.def.start ? START_T - GRID_GAP : 1;
  racer.place(st, n.l, n.d, Math.max(u, racer.spec.wb + 0.1));
  return true;
}

const blankTiming = () => ({ laps: 0, armed: false, lapStart: 0, last: null, best: null, done: false, place: 0, finishAt: 0 });
export class Race {
  constructor() {
    this.mode = 'practice'; this.phase = 'free';   // free (practice), lights, green, done
    this.clock = 0; this.lights = 0; this.order = [];
    this.racing = 2;       // how many lanes have a driver; the caller keeps it up to date
    this.timing = [blankTiming(), blankTiming()];
    this.onEvent = null;   // (kind, data): 'lap', 'best', 'green', 'light', 'finish', 'done'
  }
  get laps() { return MODES[this.mode].laps; }
  get isRace() { return this.laps > 0; }
  // start a session: practice runs at once, a race waits for the lights
  begin(mode) {
    this.mode = mode;
    this.timing = [blankTiming(), blankTiming()];
    this.clock = 0; this.order = [];
    if (this.isRace) { this.phase = 'lights'; this.lights = COUNTDOWN; this.lastLight = -1; } else this.phase = 'free';
  }
  get holding() { return this.phase === 'lights'; }
  // how many of the start lights are lit (0 to 3), and whether the green is showing
  lightState() {
    if (this.phase !== 'lights') return { red: 0, green: this.phase === 'green' && this.clock < 1.2 };
    const t = COUNTDOWN - this.lights;
    return { red: Math.min(3, Math.floor(t)), green: false };
  }
  update(dt) {
    if (this.phase === 'lights') {
      this.lights -= dt;
      const lit = this.lightState().red;
      if (lit !== this.lastLight) { this.lastLight = lit; if (lit > 0 && this.onEvent) this.onEvent('light', lit); }
      if (this.lights <= 0) { this.phase = 'green'; this.clock = 0; if (this.onEvent) this.onEvent('green'); }
      return;
    }
    if (this.phase === 'green' || this.phase === 'free') this.clock += dt;
  }
  // a car's guide crossed the start line
  lap(slot) {
    if (this.phase === 'lights' || this.phase === 'done') return;
    const T = this.timing[slot], now = this.clock;
    if (!T.armed) { T.armed = true; T.lapStart = this.phase === 'green' ? 0 : now; return; }
    if (T.done) return;
    const t = now - T.lapStart;
    T.lapStart = now; T.last = t; T.laps++;
    const best = T.best === null || t < T.best;
    if (best) T.best = t;
    if (this.onEvent) this.onEvent('lap', { slot, t, best });
    if (this.isRace && T.laps >= this.laps) {
      T.done = true; T.finishAt = now; this.order.push(slot); T.place = this.order.length;
      if (this.onEvent) this.onEvent('finish', { slot, place: T.place, at: now });
      if (this.order.length >= this.racing) { this.phase = 'done'; if (this.onEvent) this.onEvent('done', { order: this.order }); }
    }
  }
}
export function fmtTime(t) {
  if (t === null || t === undefined) return '–.––';
  return t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}` : t.toFixed(2);
}

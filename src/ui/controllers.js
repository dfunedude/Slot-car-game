// ===== ui/controllers: the two hand controllers on the deck: trigger strips, corner meters, reset =====
import { clamp } from '../core/geometry.js';
import { DRIVERS } from '../sim/session.js';
import { sound, session } from '../state.js';
import { save } from '../storage.js';
import { toast } from './dom.js';
import { updateBoard } from './hud.js';

const cards = [0, 1].map(i => document.querySelector(`.ctl[data-lane="${i}"]`));
const pads = cards.map(c => c.querySelector('.trigger'));
// what each pad is doing: held by a pointer, and the trigger the keys are ramping
const held = [null, null];
const keyHeld = [false, false];
const keyTrig = [0, 0];
const padTrig = [0, 0];

export function buildControllers() {
  cards.forEach((card, i) => {
    const sel = card.querySelector('.driver');
    for (const [k, name] of Object.entries(DRIVERS)) sel.add(new Option(name, k));
    sel.value = session.drivers[i];
    sel.addEventListener('change', () => { setLaneDriver(i, sel.value); sel.blur(); });
    card.querySelector('.reset').addEventListener('click', () => resetCar(i));
    const pad = pads[i];
    // hold anywhere on the strip: how far along it you are is how hard you squeeze
    const at = e => { const r = pad.getBoundingClientRect(); return clamp((e.clientX - r.left - 8) / (r.width - 16), 0, 1); };
    pad.addEventListener('pointerdown', e => {
      if (session.drivers[i] !== 'human') return;
      e.preventDefault(); sound.init();
      try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      held[i] = e.pointerId; padTrig[i] = Math.max(0.25, at(e));
    });
    pad.addEventListener('pointermove', e => { if (held[i] === e.pointerId) padTrig[i] = Math.max(0.05, at(e)); });
    const release = e => { if (held[i] === e.pointerId) { held[i] = null; padTrig[i] = 0; } };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, release);
    pad.addEventListener('contextmenu', e => e.preventDefault());
    // with the pad focused, the arrow keys and space work it too
    pad.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); keyHeld[i] = true; } });
    pad.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.stopPropagation(); keyHeld[i] = false; } });
  });
  updateControllers();
}
export function setLaneDriver(i, d) {
  session.setDriver(i, d);
  if (d !== 'human') { held[i] = null; padTrig[i] = 0; keyHeld[i] = false; }
  cards[i].querySelector('.driver').value = d;
  updateControllers(); updateBoard(0, true); save();
}
export function resetCar(i) {
  sound.init();
  if (!session.reset(i)) toast(session.cars[i].racer.onTrack ? 'That car is still in its slot.' : 'Nothing to put back.');
}
export function resetWaiting() {
  const w = session.waiting();
  w.forEach(i => session.reset(i));
  return w.length > 0;
}
// The keyboard: Space or ↑ drives the first human lane, W the second. Held keys squeeze the trigger
// over about a third of a second; letting go springs it straight back.
function laneFor(which) {
  const humans = [0, 1].filter(i => session.drivers[i] === 'human');
  return which === 0 ? humans[0] : humans[1] ?? (humans.length === 1 ? humans[0] : undefined);
}
export function keyTrigger(which, down) {
  const i = laneFor(which);
  if (i === undefined) return false;
  if (down) sound.init();
  keyHeld[i] = down;
  return true;
}
export function releaseAll() { keyHeld.fill(false); held.fill(null); padTrig.fill(0); }

// Each frame: work out each human trigger, then show both triggers and both meters.
const shown = [{}, {}];
export function updateControllers(dt = 0) {
  for (let i = 0; i < 2; i++) {
    keyTrig[i] = keyHeld[i] ? Math.min(1, keyTrig[i] + dt * 3) : 0;
    const human = session.drivers[i] === 'human';
    session.trig[i] = human ? Math.max(padTrig[i], keyTrig[i]) : 0;
    const r = session.cars[i].racer, who = session.drivers[i];
    const trig = who === 'off' ? 0 : r.trigger;
    const meter = r.onTrack ? clamp(r.ratio * 0.8 + r.slip * 2, 0, 1) : 0;
    const off = r.state === 'fly' && who === 'human';
    const S = shown[i], card = cards[i], pad = pads[i];
    const tq = Math.round(trig * 100), mq = Math.round(meter * 200);
    if (S.t !== tq) {
      S.t = tq;
      pad.querySelector('.fill').style.width = `${tq}%`;
      pad.querySelector('.plunger').style.left = `calc(${tq}% - ${tq * 0.24}px)`;
      pad.setAttribute('aria-valuenow', String(tq));
    }
    if (S.m !== mq) {
      S.m = mq;
      const m = card.querySelector('.meter');
      m.querySelector('.needle').style.left = `${mq / 2}%`;
      m.classList.toggle('hot', meter > 0.05);
    }
    if (S.who !== who || S.off !== off) {
      S.who = who; S.off = off;
      pad.classList.toggle('is-auto', who === 'ai');
      pad.classList.toggle('is-off', who === 'off');
      pad.querySelector('.lbl').textContent = who === 'ai' ? 'Computer driving' : who === 'off' ? 'No car' : off ? 'Off! Reset to go on' : 'Hold to go';
      const rb = card.querySelector('.reset');
      rb.classList.toggle('is-due', off);
      rb.disabled = who === 'off';
    }
  }
}

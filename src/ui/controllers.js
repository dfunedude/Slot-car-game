// ===== ui/controllers: a hand controller on the deck for each lane: driver, trigger strip, corner meter, reset =====
import { clamp } from '../core/geometry.js';
import { LANE_NAMES, MAX_LANES } from '../core/race.js';
import { DRIVERS, isCPU } from '../core/heat.js';
import { sound, session } from '../state.js';
import { save } from '../storage.js';
import { $, toast } from './dom.js';
import { updateBoard } from './hud.js';

const RESET_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg>';
const cards = [], pads = [];
// what each pad is doing: held by a pointer, and the trigger the keys are ramping
const held = Array(MAX_LANES).fill(null);
const keyHeld = Array(MAX_LANES).fill(false);
const keyTrig = Array(MAX_LANES).fill(0);
const padTrig = Array(MAX_LANES).fill(0);

function buildCard(i) {
  const name = LANE_NAMES[i], low = name.toLowerCase();
  const card = document.createElement('div');
  card.className = 'ctl'; card.dataset.lane = i;
  card.innerHTML = `<div class="ctl-head">
      <span class="chip-dot ${low}"></span>
      <select class="driver key slim" aria-label="${name} lane driver"></select>
      <button class="reset key slim" aria-label="Put the ${low} car back">${RESET_ICON}<span>Reset</span></button>
    </div>
    <div class="trigger" role="slider" tabindex="0" aria-label="${name} trigger" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <span class="fill"></span><span class="plunger"></span><span class="lbl">Hold to go</span>
    </div>
    <div class="meter" aria-hidden="true"><span class="needle"></span></div>`;
  const sel = card.querySelector('.driver');
  for (const [k, label] of Object.entries(DRIVERS)) sel.add(new Option(label, k));
  sel.value = session.drivers[i];
  sel.addEventListener('change', () => { setLaneDriver(i, sel.value); sel.blur(); });
  card.querySelector('.reset').addEventListener('click', () => resetCar(i));
  const pad = card.querySelector('.trigger');
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
  const isGo = e => e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowUp';
  pad.addEventListener('keydown', e => { if (isGo(e)) { e.preventDefault(); e.stopPropagation(); keyHeld[i] = true; } });
  pad.addEventListener('keyup', e => { if (isGo(e)) { e.stopPropagation(); keyHeld[i] = false; } });
  cards.push(card); pads.push(pad);
  return card;
}
export function buildControllers() {
  const box = $('controllers');
  for (let i = 0; i < MAX_LANES; i++) box.appendChild(buildCard(i));
  syncLanes();
}
// Show a controller for each lane the track has; the deck lays them out for two lanes or four.
export function syncLanes() {
  const n = session.lanes;
  cards.forEach((c, i) => { c.hidden = i >= n; });
  $('deck').classList.toggle('lanes-4', n > 2);
  session.race.racing = session.count();
  updateHint();
  updateControllers(); updateBoard(0, true);
}
function updateHint() {
  const humans = session.drivers.slice(0, session.lanes).filter(d => d === 'human').length;
  const keys = ['Space or ↑', 'W', 'P', 'Z'].slice(0, humans);
  $('raceHint').textContent = humans ? `Keys: ${keys.map((k, i) => (humans > 1 ? `P${i + 1} ${k}` : k)).join(' · ')} · R reset` : 'Computers only: sit back and watch.';
}
export function setLaneDriver(i, d) {
  session.setDriver(i, d);
  if (d !== 'human') { held[i] = null; padTrig[i] = 0; keyHeld[i] = false; }
  cards[i].querySelector('.driver').value = d;
  updateHint(); updateControllers(); updateBoard(0, true); save();
}
export function resetCar(i) {
  sound.init();
  if (!session.reset(i)) toast(session.racers[i].onTrack ? 'That car is still in its slot.' : 'Nothing to put back.');
}
export function resetWaiting() {
  const w = session.waiting();
  w.forEach(i => session.reset(i));
  return w.length > 0;
}
// The keyboard: Space or ↑ drives the first player's lane, W the second's, P the third's and Z the
// fourth's. A held key squeezes the trigger over about a third of a second; letting go springs it back.
function laneFor(which) {
  const humans = [];
  for (let i = 0; i < session.lanes; i++) if (session.drivers[i] === 'human') humans.push(i);
  return humans[which] ?? (which > 0 && humans.length === 1 ? humans[0] : undefined);
}
export function keyTrigger(which, down) {
  const i = laneFor(which);
  if (i === undefined) return false;
  if (down) sound.init();
  keyHeld[i] = down;
  return true;
}
export function releaseAll() { keyHeld.fill(false); held.fill(null); padTrig.fill(0); }

// Each frame: work out each player's trigger, then show every trigger and meter.
const shown = Array.from({ length: MAX_LANES }, () => ({}));
export function updateControllers(dt = 0) {
  for (let i = 0; i < MAX_LANES; i++) {
    keyTrig[i] = keyHeld[i] ? Math.min(1, keyTrig[i] + dt * 3) : 0;
    const who = session.drivers[i], human = who === 'human';
    session.trig[i] = human ? Math.max(padTrig[i], keyTrig[i]) : 0;
    const card = cards[i];
    if (!card || card.hidden) continue;
    const r = session.racers[i];
    const trig = who === 'off' ? 0 : r.trigger;
    const meter = r.onTrack ? clamp(r.ratio * 0.8 + r.slip * 2, 0, 1) : 0;
    const off = r.state === 'fly' && human;
    const S = shown[i], pad = pads[i];
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
      pad.classList.toggle('is-auto', isCPU(who));
      pad.classList.toggle('is-off', who === 'off');
      pad.querySelector('.lbl').textContent = isCPU(who) ? 'Computer' : who === 'off' ? 'No car' : off ? 'Off! Reset to go on' : 'Hold to go';
      const rb = card.querySelector('.reset');
      rb.classList.toggle('is-due', off);
      rb.disabled = who === 'off';
    }
  }
}

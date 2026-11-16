// ===== ui/hud: the timing board, the banner, the clock and the deck's button states =====
import { graphics } from '../render/stage.js';
import { fmtTime, MODES, LANE_NAMES, MAX_LANES } from '../core/race.js';
import { SKILLS } from '../core/ai.js';
import { SPECS } from '../core/specs.js';
import { layout, sound, session, state } from '../state.js';
import { $ } from './dom.js';

export function updateStat() {
  const n = layout.pieces.length;
  const inches = layout.pieces.reduce((s, p) => s + p.def.routes.reduce((a, r) => a + r.len, 0), 0);
  const open = layout.freeEnds().length;
  const start = layout.startPiece() ? '' : ' · no start line';
  $('trackStat').textContent = n ? `${n} pieces · ${(inches / 12).toFixed(1)} ft · ${open} open end${open === 1 ? '' : 's'}${start}` : 'Empty table';
}
export function updateButtons() {
  $('btnRotate').disabled = !state.sel;
  $('btnDelete').disabled = !state.sel && !state.active;
  $('btnUndo').disabled = !state.undo.length;
}
export function updateSoundBtn() {
  const b = $('btnSound');
  b.setAttribute('aria-pressed', String(sound.on));
  b.setAttribute('aria-label', sound.on ? 'Sound on' : 'Sound off');
  b.querySelector('.wave').style.display = sound.on ? '' : 'none';
  b.querySelector('.mute').style.display = sound.on ? 'none' : '';
}
export function updateFastBtn() {
  const b = $('btnFast');
  b.setAttribute('aria-pressed', String(graphics.fast));
  b.setAttribute('aria-label', graphics.fast ? 'Fast graphics on' : 'Fast graphics off');
}

// ---- the timing board ----
// One row per lane, rewritten a few times a second, and each row only when its text changes.
const rows = Array.from({ length: MAX_LANES }, (_, i) => {
  const el = document.createElement('div');
  el.className = 'lane-row'; el.dataset.lane = i;
  el.innerHTML = `<span class="chip-dot ${LANE_NAMES[i].toLowerCase()}"></span><span class="who"></span><span class="laps"></span><span class="t last"></span><span class="t best"></span>`;
  $('board').appendChild(el);
  return el;
});
const rowText = rows.map(() => '');
// what a lane's driver is called: You (or P1, P2… when several people play), or the computer's skill
export function driverName(i, long = false) {
  const who = session.drivers[i];
  if (SKILLS[who]) return long ? `The ${SKILLS[who].name.toLowerCase()} computer` : `CPU ${SKILLS[who].name}`;
  if (who !== 'human') return '';
  const humans = session.drivers.slice(0, session.lanes).map((d, k) => (d === 'human' ? k : -1)).filter(k => k >= 0);
  return humans.length > 1 ? `${long ? 'Player ' : 'P'}${humans.indexOf(i) + 1}` : 'You';
}
let boardT = 0;
export function updateBoard(dt, force) {
  if (!force && (boardT -= dt) > 0) return;
  boardT = 0.12;
  const race = session.race;
  rows.forEach((el, i) => {
    const T = race.timing[i], car = session.cars[i];
    el.hidden = !session.active(i);
    if (el.hidden) { rowText[i] = ''; return; }
    const name = `${driverName(i)} · ${SPECS[car.key || 'f1'].name}`;
    const laps = race.isRace ? `L ${Math.min(T.laps + (T.armed && !T.done ? 1 : 0), race.laps)}/${race.laps}` : `L ${T.laps}`;
    const place = T.done ? ` P${T.place}` : '';
    const off = car.racer.state === 'fly' || car.racer.state === 'reset';
    const text = `${name}|${laps}${place}|${fmtTime(T.last)}|${fmtTime(T.best)}|${off}`;
    if (text === rowText[i]) return;
    rowText[i] = text;
    el.querySelector('.who').textContent = name;
    el.querySelector('.laps').textContent = laps + place;
    el.querySelector('.last').textContent = fmtTime(T.last);
    el.querySelector('.best').textContent = fmtTime(T.best);
    el.classList.toggle('is-off', off);
  });
}
export function flashLane(i) {
  const el = rows[i];
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
// ---- the clock in the tab row ----
let readoutText = '';
export function updateReadout() {
  const race = session.race;
  let text;
  if (race.phase === 'lights') text = `<b>${MODES[race.mode].name}</b><span class="m"> · on the grid</span>`;
  else if (race.phase === 'done') text = `<b>Finished</b> · ${fmtTime(race.timing[race.order[0]].finishAt)}`;
  else text = `<b class="m">${MODES[race.mode].name} · </b>${fmtTime(race.clock)}`;
  if (text === readoutText) return;
  readoutText = text;
  $('readout').innerHTML = text;
}
// ---- the banner in the middle of the view: the start lights, then the result ----
let bannerT = 0, bannerKey = '';
export function banner(html, ms = 0) {
  const el = $('banner');
  if (html === null) { el.hidden = true; bannerKey = ''; return; }
  if (html !== bannerKey) { el.innerHTML = html; bannerKey = html; }
  el.hidden = false;
  bannerT = ms ? ms / 1000 : 0;
}
export function updateBanner(dt) {
  const race = session.race;
  if (race.phase === 'lights') {
    const L = race.lightState();
    banner(`<div class="lights">${[0, 1, 2].map(i => `<i class="${i < L.red ? 'on' : ''}"></i>`).join('')}</div><small>Get ready…</small>`);
    return;
  }
  if (race.phase === 'green' && race.clock < 1) { banner('<div class="lights"><i class="go"></i><i class="go"></i><i class="go"></i></div>GO!'); return; }
  if (bannerKey.includes('class="go"') || bannerKey.includes('Get ready')) banner(null);
  if (bannerT > 0 && (bannerT -= dt) <= 0) banner(null);
}
export function showResult() {
  const race = session.race, [w] = race.order;
  if (w === undefined) return;
  const T = race.timing[w], name = driverName(w, true);
  banner(`${LANE_NAMES[w]} wins<small>${name} · ${race.laps} laps in ${fmtTime(T.finishAt)} · best lap ${fmtTime(T.best)}</small>`, 6000);
}

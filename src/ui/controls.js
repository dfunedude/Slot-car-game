// ===== ui/controls: wires up the deck's tabs and buttons, and the keyboard =====
import { PRESETS } from '../core/presets.js';
import { MODES } from '../core/race.js';
import { SKILLS } from '../core/ai.js';
import { graphics, setFastGraphics } from '../render/stage.js';
import { layout, sound, session, state } from '../state.js';
import { save } from '../storage.js';
import { $, toast } from './dom.js';
import { updateSoundBtn, updateFastBtn, updateButtons, updateBoard, banner } from './hud.js';
import { resetView, follow, setFollow } from './camera.js';
import { refreshMarkers, highlight, addPiece, rotateSel, deleteSel, undo, loadPreset } from './editor.js';
import { buildControllers, keyTrigger, resetWaiting, releaseAll } from './controllers.js';
import { buildGarage } from './garage.js';
import { bindCanvas } from './input.js';
import { PALETTE } from './icons.js';

export function buildControls() {
  const pal = $('palette');
  for (const [kind, label, icon] of PALETTE) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.dataset.kind = kind;
    b.innerHTML = `${icon}<span>${label}</span>`;
    b.addEventListener('click', () => addPiece(kind));
    pal.appendChild(b);
  }
  const sel = $('presetSel');
  for (const [k, P] of Object.entries(PRESETS)) sel.add(new Option(P.name, k));
  sel.add(new Option('Clear the table', 'clear'));
  sel.addEventListener('change', () => { const v = sel.value; sel.value = ''; if (v) loadPreset(v); sel.blur(); });

  const mode = $('modeSel');
  for (const [k, m] of Object.entries(MODES)) mode.add(new Option(m.name, k));
  mode.value = state.raceMode;
  mode.addEventListener('change', () => { state.raceMode = mode.value; mode.blur(); updateStartBtn(); });
  const skill = $('skillSel');
  for (const [k, s] of Object.entries(SKILLS)) skill.add(new Option(`Computer: ${s.name}`, k));
  skill.value = session.skill;
  skill.addEventListener('change', () => { session.skill = skill.value; skill.blur(); save(); });
  $('btnStart').addEventListener('click', startSession);

  buildControllers();
  buildGarage();
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.tab)));
  $('btnRotate').addEventListener('click', rotateSel);
  $('btnDelete').addEventListener('click', deleteSel);
  $('btnUndo').addEventListener('click', undo);
  $('btnSound').addEventListener('click', () => { sound.init(); sound.setOn(!sound.on); updateSoundBtn(); save(); });
  $('btnFast').addEventListener('click', toggleFast);
  $('btnView').addEventListener('click', () => { setFollow(false); resetView(true); });
  $('btnFollow').addEventListener('click', () => setFollow(!follow.on));
  $('btnHelp').addEventListener('click', () => { $('help').hidden = false; $('btnHelpClose').focus(); });
  $('btnHelpClose').addEventListener('click', () => { $('help').hidden = true; });
  $('help').addEventListener('click', e => { if (e.target === $('help')) $('help').hidden = true; });

  bindCanvas();
  document.addEventListener('gesturestart', e => e.preventDefault());
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => sound.init(), { capture: true, passive: true });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { releaseAll(); sound.pause(); save(); } else sound.resume();
  });
}
function updateStartBtn() {
  $('btnStart').textContent = MODES[state.raceMode].laps ? 'Start race' : 'Practice';
}
// back to the grid for a new session of the mode chosen
export function startSession() {
  sound.init();
  if (!layout.pieces.length) { toast('Lay some track first: the Track tab has ready-made circuits.'); return; }
  if (state.mode !== 'race') setMode('race');
  banner(null);
  session.begin(state.raceMode);
  updateBoard(0, true);
  if (!layout.startPiece()) toast('Add a start/finish piece to count laps.');
  else if (!MODES[state.raceMode].laps) toast('Practice: laps are timed from the start line.');
}
function toggleFast() {
  setFastGraphics(!graphics.fast);
  updateFastBtn(); save();
  toast(graphics.fast ? 'Fast graphics: a softer picture that\'s quicker to draw.' : 'Full graphics.');
}
function onKey(e) {
  if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT')) return;
  const k = e.key;
  if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); if (state.mode === 'track') undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === ' ' || k === 'ArrowUp') { if (!e.repeat && state.mode === 'race' && keyTrigger(0, true)) e.preventDefault(); else if (state.mode === 'race') e.preventDefault(); return; }
  if (k === 'w' || k === 'W') { if (!e.repeat && state.mode === 'race') keyTrigger(1, true); return; }
  if (e.repeat) return;
  if (k === 'f' || k === 'F') setFollow(!follow.on);
  else if (k === 'v' || k === 'V') { setFollow(false); resetView(true); }
  else if (k === 'g' || k === 'G') toggleFast();
  else if ((k === 'r' || k === 'R') && state.mode === 'race') { if (!resetWaiting()) toast('No car is waiting to be put back.'); }
  else if ((k === 'r' || k === 'R') && state.mode === 'track') rotateSel();
  else if ((k === 'Delete' || k === 'Backspace') && state.mode === 'track') { e.preventDefault(); deleteSel(); }
  else if (k === 'Enter' && state.mode === 'race' && e.target === document.body) startSession();
  else if (k === '1') setMode('race'); else if (k === '2') setMode('track'); else if (k === '3') setMode('garage');
  else if (k === 'Escape') { $('help').hidden = true; state.sel = null; highlight(); updateButtons(); }
}
function onKeyUp(e) {
  const k = e.key;
  if (k === ' ' || k === 'ArrowUp') keyTrigger(0, false);
  else if (k === 'w' || k === 'W') keyTrigger(1, false);
}
export function setMode(m) {
  const was = state.mode;
  state.mode = m;
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === m)));
  document.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.panel !== m; });
  if (m === 'track' && !state.active) { const f = layout.freeEnds()[0]; state.active = f ? { p: f.p, i: f.i } : null; }
  if (m !== 'track') state.sel = null;
  releaseAll();
  // the cars stand still while the track is being worked on, and go back on the grid after it's changed
  session.paused = m === 'track';
  if (was === 'track' && m !== 'track' && state.trackDirty) {
    state.trackDirty = false;
    session.begin('practice'); state.raceMode = 'practice'; $('modeSel').value = 'practice'; updateStartBtn();
    if (layout.freeEnds().length) toast('The track has open ends: cars that reach one fly off.');
  }
  refreshMarkers(); highlight(); updateButtons(); updateStartBtn();
}

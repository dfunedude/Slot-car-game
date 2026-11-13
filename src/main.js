// ===== main: boot, resize and the frame loop =====
import { buildPreset } from './core/presets.js';
import { canvas, renderer, scene, camera, pace, setFastGraphics } from './render/stage.js';
import { buildRoom, buildLamp, updateRoom } from './world/room.js';
import { animateTrack, preloadPieces } from './world/track.js';
import { layout, session, state, views } from './state.js';
import { save, loadSaved, applySaved } from './storage.js';
import { $, toast } from './ui/dom.js';
import { updateSoundBtn, updateFastBtn, updateButtons, updateBoard, updateReadout, updateBanner, flashLane, showResult } from './ui/hud.js';
import { view, resetView, stepCamera } from './ui/camera.js';
import { syncViews, loadPreset } from './ui/editor.js';
import { updateControllers } from './ui/controllers.js';
import { renderGarage, pickCar } from './ui/garage.js';
import { buildControls, setMode, startSession } from './ui/controls.js';

function resize() {
  const r = $('stage').getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (resize.auto) resetView(false);
}
resize.auto = true;

// what the session tells the deck and the HUD
session.onEvent = (kind, d) => {
  if (kind === 'lap') { flashLane(d.slot); if (d.best && session.race.timing[d.slot].laps > 1 && session.drivers[d.slot] === 'human') toast(`Best lap: ${d.t.toFixed(2)} s`, 1600); }
  else if (kind === 'off' && session.drivers[d.slot] === 'human') {
    toast(d.why === 'end' ? 'Off the end of the track! Tap the car or press R to put it back.' : d.why === 'hit' ? 'Crash at the crossing! Tap the car or press R.' : 'Too fast for that turn! Tap the car or press R to put it back.', 2600);
  } else if (kind === 'finish' && d.place === 1) showResult();
};

// Compile every shader now, while booting, rather than mid-race the first time something shows.
function warmShaders() {
  const hidden = [];
  scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  renderer.compile(scene, camera);
  for (const o of hidden) o.visible = false;
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const ms = now - last, dt = Math.min(0.05, ms / 1000);
  last = now;
  if (pace(ms)) resize();
  updateControllers(dt);
  session.update(dt);
  animateTrack(now);
  updateBoard(dt);
  updateReadout();
  updateBanner(dt);
  stepCamera(dt);
  updateRoom();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
function boot() {
  const saved = loadSaved();
  if (saved) applySaved(saved);
  buildRoom();
  buildLamp();
  preloadPieces();
  session.cars.forEach((c, i) => c.setModel(state.garage[i].key, state.garage[i].li));
  buildControls();
  if (saved && Array.isArray(saved.layout) && saved.layout.length) layout.load(saved.layout);
  else if (!saved) buildPreset(layout, 'club');
  syncViews();
  if (saved && saved.fast === true) setFastGraphics(true);
  session.drivers.forEach((d, i) => session.setDriver(i, d));
  session.begin('practice');
  renderGarage(); updateSoundBtn(); updateFastBtn(); updateButtons(); updateBoard(0, true); updateControllers();
  setMode('race');
  new ResizeObserver(resize).observe($('stage'));
  resize();
  resetView(false);
  warmShaders();
  canvas.addEventListener('pointerdown', () => { resize.auto = false; }, { once: true });
  if (!saved) setTimeout(() => toast('Hold the trigger strip (or Space) to drive. Watch the corner meter!', 4200), 600);
  save();
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
// test handle for scripted checks; release builds drop this line (see tools/build.mjs)
window.__bgp = { layout, session, state, views, view, camera, scene, renderer, setMode, startSession, syncViews, loadPreset, pickCar };

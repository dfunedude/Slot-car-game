// ===== storage: keeps the layout, the cars, the drivers and the settings in localStorage =====
import { graphics } from './render/stage.js';
import { SPECS } from './core/specs.js';
import { LIVERIES } from './cars/liveries.js';
import { SKILLS } from './core/ai.js';
import { DRIVERS } from './core/heat.js';
import { layout, sound, session, state } from './state.js';

const STORE_KEY = 'basement-grand-prix-v1';
// Saving waits for a pause in the changes, then for a moment when the browser is idle between frames.
const whenIdle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 1000 }) : f => f();
function write() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 1, layout: layout.serialize(), garage: state.garage, drivers: session.drivers,
      sound: sound.on, fast: graphics.fast
    }));
  } catch (e) { /* storage unavailable */ }
}
export function save() {
  clearTimeout(save.t);
  save.t = setTimeout(() => whenIdle(write), 300);
}
export function loadSaved() {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) { /* ignore */ }
  return null;
}
// take what was saved, keeping only what still makes sense
export function applySaved(s) {
  if (Array.isArray(s.garage)) s.garage.slice(0, state.garage.length).forEach((g, i) => {
    if (g && SPECS[g.key]) state.garage[i] = { key: g.key, li: Math.max(0, Math.min(LIVERIES[g.key].length - 1, g.li | 0)) };
  });
  // early saves had one computer skill for both lanes, saved as skill, and 'ai' as the driver
  const oldSkill = SKILLS[s.skill] ? s.skill : 'pro';
  if (Array.isArray(s.drivers)) s.drivers.slice(0, session.drivers.length).forEach((d, i) => {
    if (d === 'ai') d = oldSkill;
    if (DRIVERS[d]) session.drivers[i] = d;
  });
  if (s.sound === false) sound.on = false;
}

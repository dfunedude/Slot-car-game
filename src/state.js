// ===== state: the live layout, the racing session, sound, and what the controls are doing =====
import { Layout } from './core/layout.js';
import { Sound } from './fx/sound.js';
import { Session } from './sim/session.js';

export const layout = new Layout();
export const views = new Map();
export const sound = new Sound();
export const session = new Session(layout, sound);
// raceLaps: the race length Start race runs. garage: the car and paint in each lane. gauge: whether the track palette shows two-lane or four-lane pieces. mode: which deck tab is open. sel/active/undo/drag: the editor.
export const state = { mode: 'race', garage: [{ key: 'f1', li: 0 }, { key: 'pony', li: 0 }, { key: 'canam', li: 1 }, { key: 'aero', li: 2 }], garageLane: 0, gauge: 2, raceLaps: 'r5', sel: null, active: null, undo: [], drag: null };

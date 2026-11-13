// ===== core/ai: the computer driver, who reads the track ahead and feathers the trigger =====
import { cornerLimit } from './racer.js';

// margin: how close to the grip limit it dares to corner. wobble: how much that wanders from lap to
// lap (a rookie sometimes overcooks a turn and comes off).
export const SKILLS = {
  rookie: { name: 'Rookie', margin: 0.72, wobble: 0.22 },
  pro: { name: 'Pro', margin: 0.86, wobble: 0.1 },
  ace: { name: 'Ace', margin: 0.95, wobble: 0.035 },
};
const q = {};
// The trigger the computer squeezes this frame. rnd gives numbers in [0, 1); its mood changes now
// and then, which is what makes its laps differ.
export function aiTrigger(r, skill, dt, rnd = Math.random) {
  if (!r.onTrack) return 0;
  const sp = r.spec, P = r.path, v = r.v;
  r.aiMood = r.aiMood ?? 0;
  if ((r.aiT = (r.aiT ?? 0) - dt) <= 0) { r.aiT = 1.5 + rnd() * 2.5; r.aiMood = (rnd() * 2 - 1); }
  const margin = skill.margin * (1 + skill.wobble * r.aiMood * (r.aiMood > 0 ? 1 : 0.5));
  // braking with the trigger let go slows the car in proportion to its speed, so the speed it can
  // shed falls off in a straight line with distance: brake × distance (less a little for reaction)
  const b = sp.brake * 0.82, reach = v / b + 4;
  P.cover(r.s - sp.wb - 3, r.s + reach + 1);
  let target = sp.vmax;
  for (let d = 0; d <= reach; d += 0.5) {
    if (r.s + d > P.s1) { target = Math.min(target, b * Math.max(0, P.s1 - r.s - 3)); break; }
    P.at(r.s + d, q);
    const k = Math.abs(q.k);
    if (k < 1e-4) continue;
    const vlim = Math.sqrt(margin * cornerLimit(sp, q.k, q.roll) / k);
    target = Math.min(target, vlim + b * Math.max(0, d - 0.8));
  }
  if (target > v + 3) return 1;
  if (target < v - 0.5) return 0;
  return Math.max(0.05, target / sp.vmax);
}
